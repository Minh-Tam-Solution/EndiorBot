/**
 * Claude Code Provider — Chat via `claude` CLI (OAuth, Max subscription)
 *
 * Uses `claude -p --session-id/--resume` for native multi-turn sessions.
 * CTO C5: Does NOT modify existing ClaudeCodeBridge — separate class.
 *
 * @module providers/claude-code
 * @version 1.0.0
 * @date 2026-04-06
 * @status ACTIVE — Sprint 130
 * @authority ADR-043-A1 Claude Code Chat Provider
 * @sdlc SDLC Framework 6.4.0
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type {
  AIProvider,
  ProviderConfig,
  ModelDefinition,
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ProviderHealth,
  Message,
} from "../types.js";
import { TIMEOUTS } from "../../config/timeouts.js";

// ============================================================================
// Constants
// ============================================================================

const CLAUDE_CLI = "claude";

const MODELS: ModelDefinition[] = [
  { id: "sonnet", name: "Claude Sonnet", contextWindow: 200000, maxOutputTokens: 16384, supportedFeatures: ["chat"] },
  { id: "haiku", name: "Claude Haiku", contextWindow: 200000, maxOutputTokens: 8192, supportedFeatures: ["chat"] },
  { id: "opus", name: "Claude Opus", contextWindow: 200000, maxOutputTokens: 16384, supportedFeatures: ["chat"] },
];

// ============================================================================
// ClaudeCodeProvider
// ============================================================================

export class ClaudeCodeProvider implements AIProvider {
  readonly id = "claude-code";
  readonly name = "Claude Code (OAuth)";
  readonly models = MODELS;

  private sessionId: string | null = null;
  private turnCount = 0;
  private claudePath = CLAUDE_CLI;
  private timeout = TIMEOUTS.claudeCode; // 5 min default — see TIMEOUTS.claudeCode

  async initialize(config: ProviderConfig): Promise<void> {
    if (config.timeout) this.timeout = config.timeout;
  }

  async dispose(): Promise<void> {
    // Sessions persist in Claude Code — no cleanup needed
  }

  /**
   * Start a new Claude Code session (called on /clear or first use).
   */
  newSession(): string {
    this.sessionId = `eb-chat-${randomUUID().slice(0, 8)}`;
    this.turnCount = 0;
    return this.sessionId;
  }

  /**
   * Chat via Claude Code CLI.
   *
   * First turn: --session-id <uuid> (creates session)
   * Subsequent: --resume <uuid> (continues session)
   *
   * History managed by Claude Code natively — EndiorBot only sends new message.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Ensure session exists
    if (!this.sessionId) {
      this.newSession();
    }

    // Extract user message (last message in array)
    const userMessage = this.extractUserMessage(request.messages);
    const systemPrompt = this.extractSystemPrompt(request.messages);

    // Build CLI args
    const args: string[] = ["-p", "--output-format", "json"];

    // Model selection
    args.push("--model", request.model || "sonnet");

    // Session management
    // Note: --session-id with custom IDs causes empty stdout in Claude CLI 2.1.x
    // Let Claude create its own session on first turn, then --resume with that ID
    if (this.turnCount > 0 && this.sessionId) {
      args.push("--resume", this.sessionId);
    }

    // System prompt only on first turn
    if (this.turnCount === 0 && systemPrompt) {
      args.push("--append-system-prompt", systemPrompt);
    }

    // User message as positional arg
    args.push(userMessage);

    // Spawn claude CLI
    const result = await this.spawnClaude(args, request.metadata?.workspace as string | undefined);

    this.turnCount++;

    // Parse JSON response
    const parsed = this.parseResponse(result.stdout);

    // Capture session_id from Claude's response for --resume on subsequent turns
    if (this.turnCount === 1 && parsed.sessionId) {
      this.sessionId = parsed.sessionId;
    }

    return {
      id: `cc-${this.sessionId}-${this.turnCount}`,
      model: request.model || "sonnet",
      content: parsed.content,
      usage: {
        promptTokens: parsed.inputTokens,
        completionTokens: parsed.outputTokens,
        totalTokens: parsed.inputTokens + parsed.outputTokens,
      },
      finishReason: parsed.finishReason,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async *chatStream(_request: ChatRequest): AsyncIterable<ChatChunk> {
    // Claude Code -p mode doesn't support streaming
    // Yield single chunk with full response
    const response = await this.chat(_request);
    yield {
      id: response.id,
      model: response.model,
      delta: response.content,
      finishReason: response.finishReason,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const result = await this.spawnClaude(["--version"], undefined, 5000);
      return {
        status: "healthy",
        message: result.stdout.trim(),
      };
    } catch {
      return {
        status: "unhealthy",
        message: "Claude Code CLI not found or OAuth expired. Run: claude login",
      };
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private extractUserMessage(messages: Message[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === "user") {
        const content = messages[i]!.content;
        if (typeof content === "string") return content;
        if (Array.isArray(content)) return this.extractText(content);
      }
    }
    return "";
  }

  private extractSystemPrompt(messages: Message[]): string | undefined {
    const systemMsgs = messages.filter(m => m.role === "system");
    if (systemMsgs.length === 0) return undefined;

    return systemMsgs.map(m => {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) return this.extractText(m.content);
      return "";
    }).join("\n\n");
  }

  /** Extract text from ContentPart[] or SystemBlock[] union */
  private extractText(parts: Array<{ type: string; text?: string }>): string {
    return parts
      .filter(p => p.type === "text" && typeof p.text === "string")
      .map(p => p.text!)
      .join("\n");
  }

  private parseResponse(stdout: string): {
    content: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    finishReason: "stop" | "length" | "error";
    sessionId?: string;
  } {
    // Try JSON parse first (--output-format json)
    try {
      const data = JSON.parse(stdout);
      const result: {
        content: string;
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
        finishReason: "stop" | "length" | "error";
        sessionId?: string;
      } = {
        content: data.result ?? data.content ?? data.text ?? stdout,
        inputTokens: data.usage?.input_tokens ?? data.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? data.output_tokens ?? 0,
        costUsd: data.cost_usd ?? data.usage?.cost_usd ?? 0,
        finishReason: data.stop_reason === "max_tokens" ? "length" : "stop",
      };
      if (data.session_id) result.sessionId = data.session_id;
      return result;
    } catch {
      // Fallback: plain text response
      return {
        content: stdout.trim(),
        inputTokens: Math.ceil(stdout.length / 4), // estimate
        outputTokens: Math.ceil(stdout.length / 4),
        costUsd: 0,
        finishReason: "stop",
      };
    }
  }

  private spawnClaude(
    args: string[],
    cwd?: string,
    timeoutMs?: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      const child = spawn(this.claudePath, args, {
        cwd: cwd || process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          CLAUDECODE: undefined,       // Allow invocation from CC session
          ANTHROPIC_API_KEY: undefined, // Force OAuth (CTO: no API key extraction)
        },
      });

      const effectiveTimeout = timeoutMs ?? this.timeout;
      let lastActivityTime = Date.now();
      let idleHinted = false;

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Claude Code timed out after ${effectiveTimeout / 1000}s`));
      }, effectiveTimeout);

      // Idle hint: if no output for 20s in chat mode, show a dot
      const idleHintId = setInterval(() => {
        if (Date.now() - lastActivityTime >= 20_000 && !idleHinted) {
          idleHinted = true;
          process.stderr.write("⏳ ");
        }
      }, 10_000);

      child.stdout?.on("data", (data: Buffer) => {
        stdoutChunks.push(data.toString());
        lastActivityTime = Date.now();
        idleHinted = false;
      });
      child.stderr?.on("data", (data: Buffer) => {
        stderrChunks.push(data.toString());
        lastActivityTime = Date.now();
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        clearInterval(idleHintId);
        resolve({
          stdout: stdoutChunks.join(""),
          stderr: stderrChunks.join(""),
          exitCode: code ?? 1,
        });
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
