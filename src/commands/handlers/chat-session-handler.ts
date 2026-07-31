/**
 * Chat Session Handler — Shared logic for interactive AI chat (ADR-043)
 *
 * Manages conversation state, provider switching, history accumulation.
 * Used by CLI chat command + future OTT /chat.
 *
 * CTO C1: Separate ChatSessionData (no SDLC fields)
 * CTO C2: Hard-drop beyond 40 turns
 * CTO C3: SystemBlock[] with cache_control for Anthropic
 *
 * @module commands/handlers/chat-session-handler
 * @version 1.0.0
 * @date 2026-04-03
 * @status ACTIVE — Sprint 127
 * @authority ADR-043 Chat Mode
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { getProviderRegistry } from "../../providers/provider-registry.js";
import type { ChatRequest, Message, SystemBlock } from "../../providers/types.js";
import { getSoulLoader } from "../../bridge/intelligence/soul-loader.js";
import { getWorkspaceContext, formatWorkspaceContext } from "../../agents/intelligence/workspace-context.js";
import { HistoryCompactor, type CompactionState } from "../../agents/quality/history-compactor.js";
import { SONNET } from "../../config/models.js";

// ============================================================================
// Types (CTO C1: separate from SDLC Session)
// ============================================================================

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  provider: string;
  tokenUsage: { input: number; output: number };
  timestamp: string;
}

/**
 * Sprint 131: Chat tool usage counters (integers only — no content logged).
 * CTO C7: Reuses existing session JSON path, no new storage.
 */
export interface ChatToolUsage {
  read: number;
  grep: number;
  glob: number;
  ls: number;
}

export interface ChatSessionData {
  sessionId: string;
  provider: string;
  model: string;
  projectPath: string;
  projectName: string;
  turns: ChatTurn[];
  totalTokens: { input: number; output: number };
  totalCostUsd: number;
  startedAt: string;
  lastActiveAt: string;
  /** Sprint 131: Tool read counters (optional for backward compat with old sessions) */
  toolUsage?: ChatToolUsage;
}

export interface ChatTurnResult {
  response: string;
  provider: string;
  model: string;
  tokenUsage: { input: number; output: number };
  turnNumber: number;
}

// ============================================================================
// Constants
// ============================================================================

/** CTO C2: Hard history cap — drop oldest beyond this */
const MAX_HISTORY_TURNS = 40;

/** Warn user at this turn count */
const WARN_TURN_THRESHOLD = 35;

/** Default provider models */
const PROVIDER_MODELS: Record<string, string> = {
  "claude-code": "sonnet",
  openai: "gpt-5.4",
  gemini: "gemini-2.5-pro",
  ollama: "qwen3.5:9b",
  anthropic: SONNET,
};

// ============================================================================
// Session Management
// ============================================================================

/**
 * Create a new chat session.
 */
export function createChatSession(options: {
  provider?: string;
  model?: string;
  projectPath: string;
}): ChatSessionData {
  const provider = options.provider ?? "openai";
  const projectName = options.projectPath.split("/").pop() ?? "project";

  return {
    sessionId: `chat-${randomUUID().slice(0, 8)}`,
    provider,
    model: options.model ?? PROVIDER_MODELS[provider] ?? "unknown",
    projectPath: options.projectPath,
    projectName,
    turns: [],
    totalTokens: { input: 0, output: 0 },
    totalCostUsd: 0,
    startedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    toolUsage: { read: 0, grep: 0, glob: 0, ls: 0 },
  };
}

/**
 * Process a single chat turn.
 */
export async function processChatTurn(
  session: ChatSessionData,
  userInput: string,
): Promise<ChatTurnResult> {
  const registry = getProviderRegistry();
  let provider = registry.get(session.provider);

  // CTO C4: Auto-fallback if primary provider unavailable
  if (!provider) {
    const fallbackOrder = ["gemini", "ollama", "openai", "anthropic"];
    for (const fb of fallbackOrder) {
      const fallback = registry.get(fb);
      if (fallback) {
        session.provider = fb;
        session.model = PROVIDER_MODELS[fb] ?? "unknown";
        provider = fallback;
        console.log(`⚠️  claude-code unavailable → switched to ${fb} (${session.model})`);
        break;
      }
    }
    if (!provider) {
      throw new Error(`No AI provider available. Set OPENAI_API_KEY or GOOGLE_API_KEY, or run: claude login`);
    }
  }

  // Build messages: system context + history + new user message
  const messages = buildMessages(session, userInput);

  // Call provider
  const request: ChatRequest = {
    model: session.model,
    messages,
    temperature: 0.7,
    maxTokens: 2000,
  };

  const response = await provider.chat(request);
  const tokenUsage = {
    input: response.usage?.promptTokens ?? 0,
    output: response.usage?.completionTokens ?? 0,
  };

  // Record turns
  const userTurn: ChatTurn = {
    role: "user",
    content: userInput,
    provider: session.provider,
    tokenUsage: { input: 0, output: 0 },
    timestamp: new Date().toISOString(),
  };
  const assistantTurn: ChatTurn = {
    role: "assistant",
    content: response.content,
    provider: session.provider,
    tokenUsage,
    timestamp: new Date().toISOString(),
  };

  session.turns.push(userTurn, assistantTurn);
  session.totalTokens.input += tokenUsage.input;
  session.totalTokens.output += tokenUsage.output;
  // Accumulate cost estimate (rough: $0.003/1K input, $0.015/1K output for cloud)
  if (session.provider !== "ollama") {
    session.totalCostUsd += (tokenUsage.input / 1000) * 0.003 + (tokenUsage.output / 1000) * 0.015;
  }
  session.lastActiveAt = new Date().toISOString();

  // CTO C2: Hard-drop beyond MAX_HISTORY_TURNS (keep on disk, remove from context)
  if (session.turns.length > MAX_HISTORY_TURNS * 2) {
    session.turns = session.turns.slice(-(MAX_HISTORY_TURNS * 2));
  }

  return {
    response: response.content,
    provider: session.provider,
    model: response.model,
    tokenUsage,
    turnNumber: Math.ceil(session.turns.length / 2),
  };
}

/**
 * Switch provider mid-session.
 * CTO recommendation #4: re-inject system prompt on next turn.
 */
export function switchProvider(session: ChatSessionData, provider: string, model?: string): void {
  session.provider = provider;
  session.model = model ?? PROVIDER_MODELS[provider] ?? "unknown";
}

/**
 * Get turn warning if approaching limit (CTO C2).
 */
export function getTurnWarning(session: ChatSessionData): string | null {
  const turnCount = Math.ceil(session.turns.length / 2);
  if (turnCount >= WARN_TURN_THRESHOLD) {
    return `⚠️ Approaching history limit (${turnCount}/${MAX_HISTORY_TURNS}). Use /clear to reset.`;
  }
  return null;
}

/**
 * Format session status for /status command.
 * CTO recommendation #5: per-provider token breakdown.
 */
export function formatSessionStatus(session: ChatSessionData): string {
  const turnCount = Math.ceil(session.turns.length / 2);
  const cost = session.provider === "ollama" ? "free (local)" : `$${session.totalCostUsd.toFixed(4)}`;

  return [
    `Session: ${session.sessionId}`,
    `Project: ${session.projectName}`,
    `Provider: ${session.provider} (${session.model})`,
    `Turns: ${turnCount}/${MAX_HISTORY_TURNS}`,
    `Tokens: ${session.totalTokens.input} in / ${session.totalTokens.output} out`,
    `Cost: ${cost}`,
    `Started: ${session.startedAt.split("T")[0]}`,
  ].join("\n");
}

// ============================================================================
// Message Building (CTO C3: SystemBlock[] with cache_control)
// ============================================================================

function buildMessages(session: ChatSessionData, userInput: string): Message[] {
  const messages: Message[] = [];

  // System message with project context
  const systemContent = buildSystemContext(session);

  if (session.provider === "anthropic") {
    // CTO C3: Structured blocks with cache_control for Anthropic
    const blocks: SystemBlock[] = [
      { type: "text", text: systemContent, cache_control: { type: "ephemeral" } },
    ];
    messages.push({ role: "system", content: blocks });
  } else {
    messages.push({ role: "system", content: systemContent });
  }

  // Conversation history (excluding system messages)
  for (const turn of session.turns) {
    messages.push({ role: turn.role as "user" | "assistant", content: turn.content });
  }

  // New user message
  messages.push({ role: "user", content: userInput });

  return messages;
}

function buildSystemContext(session: ChatSessionData): string {
  const parts: string[] = [];

  // Agent SOUL (assistant role for chat)
  const soul = getSoulLoader().load("assistant");
  parts.push(soul.content);

  // Project identity
  const identityPath = join(session.projectPath, "IDENTITY.md");
  if (existsSync(identityPath)) {
    try {
      const content = readFileSync(identityPath, "utf-8");
      parts.push(`\n[Project]\n${content.split("\n").slice(0, 30).join("\n")}\n[/Project]`);
    } catch { /* ignore */ }
  }

  // Workspace context (git branch, recent commits)
  const wsCtx = getWorkspaceContext(session.projectPath);
  const wsFormatted = formatWorkspaceContext(wsCtx);
  if (wsFormatted) parts.push(wsFormatted);

  return parts.join("\n\n");
}

// ============================================================================
// T1: Session Resume (Sprint 128)
// ============================================================================

const SESSIONS_DIR = join(homedir(), ".endiorbot", "sessions");

/**
 * Load a saved chat session by ID.
 * CTO C2: Project mismatch guard.
 * CTO C3: Provider validation.
 */
export function loadChatSession(
  sessionId: string,
  currentProjectPath?: string,
): { session: ChatSessionData; warnings: string[] } {
  // CPO fix: sanitize sessionId — prevent path traversal
  if (!/^chat-[a-zA-Z0-9_-]+$/.test(sessionId)) {
    throw new Error(`Invalid session ID format: ${sessionId}. Expected: chat-<alphanumeric>`);
  }

  const filePath = join(SESSIONS_DIR, `${sessionId}.json`);

  // Path traversal guard: resolved path must stay in SESSIONS_DIR
  if (!resolve(filePath).startsWith(resolve(SESSIONS_DIR))) {
    throw new Error(`Invalid session path: ${sessionId}`);
  }

  if (!existsSync(filePath)) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const raw = readFileSync(filePath, "utf-8");
  const session = JSON.parse(raw) as ChatSessionData;
  const warnings: string[] = [];

  // CTO C2: Project mismatch guard
  if (currentProjectPath && session.projectPath !== currentProjectPath) {
    warnings.push(`⚠️ Session was from "${session.projectName}" but you're in "${currentProjectPath.split("/").pop()}". Context may be stale.`);
  }

  // CTO C3: Provider validation
  const registry = getProviderRegistry();
  if (!registry.get(session.provider === "ollama" ? "ollama" : session.provider)) {
    warnings.push(`⚠️ Provider "${session.provider}" not available. Use /model to switch.`);
  }

  return { session, warnings };
}

/**
 * List recent chat sessions.
 */
export function listRecentChatSessions(limit = 5): Array<{ id: string; project: string; turns: number; age: string }> {
  if (!existsSync(SESSIONS_DIR)) return [];

  const files = readdirSync(SESSIONS_DIR)
    .filter(f => f.startsWith("chat-") && f.endsWith(".json"));

  // CPO fix: Sort by lastActiveAt (parsed from file), not filename
  const parsed: Array<{ file: string; lastActiveAt: number; data: ChatSessionData }> = [];
  for (const file of files) {
    try {
      const raw = readFileSync(join(SESSIONS_DIR, file), "utf-8");
      const data = JSON.parse(raw) as ChatSessionData;
      parsed.push({ file, lastActiveAt: new Date(data.lastActiveAt).getTime(), data });
    } catch { /* skip */ }
  }

  parsed.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  const recent = parsed.slice(0, limit);

  const results: Array<{ id: string; project: string; turns: number; age: string }> = [];
  for (const { data } of recent) {
    const ageMs = Date.now() - new Date(data.lastActiveAt).getTime();
    const ageHours = Math.round(ageMs / 3600000);
    const age = ageHours < 1 ? "just now" : ageHours < 24 ? `${ageHours}h ago` : `${Math.round(ageHours / 24)}d ago`;
    results.push({ id: data.sessionId, project: data.projectName, turns: Math.ceil(data.turns.length / 2), age });
  }
  return results;
}

// ============================================================================
// T2: Context Compaction (Sprint 128 — reuse HistoryCompactor)
// ============================================================================

/** Max message count for HistoryCompactor (30 pairs = 60 entries) */
const COMPACTION_MAX_COUNT = 75;

/** Per-session compaction state for stale-guard */
const compactionStates = new WeakMap<ChatSessionData, CompactionState>();

/**
 * Adapt ChatTurn[] to Message[] for HistoryCompactor.
 */
function turnsToMessages(turns: ChatTurn[]): Message[] {
  return turns.map(t => ({ role: t.role, content: t.content }));
}

/**
 * Compact chat history using HistoryCompactor with provider-backed summarizer.
 * CTO C1: Reuses HistoryCompactor (not a parallel implementation).
 * CTO C7: Tracks compaction cost.
 * CPO C-CPO-1: Summary stored as role: "assistant".
 */
export async function compactChatHistory(session: ChatSessionData): Promise<boolean> {
  const registry = getProviderRegistry();
  const provider = registry.get(session.provider === "ollama" ? "ollama" : session.provider);
  if (!provider) return false;

  // Track cost from summarization call
  let summaryCost = { input: 0, output: 0 };

  const compactor = new HistoryCompactor({
    keepRecent: 20,
    thresholdRatio: 0.80,
    staleGuardDelta: 5,
    summarizer: async (text: string): Promise<string> => {
      const response = await provider.chat({
        model: session.model,
        messages: [
          { role: "system", content: "Summarize this conversation in 3-5 bullet points. Be concise." },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        maxTokens: 500,
      });

      // CTO C7: Track compaction cost
      if (response.usage) {
        summaryCost = {
          input: response.usage.promptTokens,
          output: response.usage.completionTokens,
        };
      }

      return response.content;
    },
  });

  // Get or create compaction state for stale-guard
  let state = compactionStates.get(session);
  if (!state) {
    state = {};
    compactionStates.set(session, state);
  }

  const messages = turnsToMessages(session.turns);
  const result = await compactor.compact(messages, COMPACTION_MAX_COUNT, state);

  if (!result.compacted || !result.messages) return false;

  // CTO C7: Apply cost tracking
  session.totalTokens.input += summaryCost.input;
  session.totalTokens.output += summaryCost.output;
  if (session.provider !== "ollama") {
    session.totalCostUsd += (summaryCost.input / 1000) * 0.003 + (summaryCost.output / 1000) * 0.015;
  }

  // Convert compacted Message[] back to ChatTurn[]
  // First message is the summary (system role from HistoryCompactor)
  // CPO C-CPO-1: Convert to assistant role for ChatTurn compatibility
  const newTurns: ChatTurn[] = [];
  for (const msg of result.messages) {
    if (msg.role === "system" && typeof msg.content === "string" && msg.content.startsWith("Previous conversation summary:")) {
      newTurns.push({
        role: "assistant",
        content: `[Conversation Summary]\n${result.summary ?? msg.content}`,
        provider: session.provider,
        tokenUsage: summaryCost,
        timestamp: new Date().toISOString(),
      });
    } else {
      newTurns.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        provider: session.provider,
        tokenUsage: { input: 0, output: 0 },
        timestamp: new Date().toISOString(),
      });
    }
  }

  session.turns = newTurns;
  return true;
}

// ============================================================================
// T3: CLI Command Routing — Allowlist (Sprint 128)
// ============================================================================

/** Read-only commands safe for chat mode (CPO: no init/config — they write files) */
export const CHAT_SAFE_COMMANDS = new Set([
  "gate", "plan", "audit", "status", "help",
  "compliance", "agents", "teams",
]);

/**
 * Check if a command is safe to run in chat mode.
 */
export function isSafeChatCommand(cmd: string): boolean {
  return CHAT_SAFE_COMMANDS.has(cmd.toLowerCase());
}
