/**
 * Chat Handler
 *
 * 3-model consultation handler for CEO Tool MVP.
 * Implements Sprint 54 requirements per Master Plan v2.0:
 * - Claude (Primary) + OpenAI (Critique) + Gemini (Critique)
 * - Task-based routing (coding → Claude only, research → All 3)
 * - primary_with_notes consolidation
 * - Context Budget governance (2K tokens/turn)
 *
 * @module gateway/chat-handler
 * @version 1.0.0
 * @date 2026-02-28
 * @status ACTIVE - Sprint 54
 * @authority ADR-001 3-Model Consultation
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createLogger, type Logger } from "../logging/index.js";
import { TIMEOUTS } from "../config/timeouts.js";
import type { AIProvider, ChatRequest, ChatResponse, Message } from "../providers/types.js";
import { getProviderRegistry } from "../providers/provider-registry.js";
import { getContextBudget } from "../brain/context-budget.js";
import { getWorkspaceContext, formatWorkspaceContext } from "../agents/intelligence/workspace-context.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Task type for routing (per ADR-001).
 */
export type ChatTaskType =
  | "coding"         // → Claude only
  | "documentation"  // → Claude only
  | "architecture"   // → Claude + critics
  | "research"       // → All 3
  | "security"       // → Claude + OpenAI
  | "sdlc_gate";     // → Claude only

/**
 * Model selection for a task.
 */
export interface ModelSelection {
  primary: string;
  critics: string[];
}

/**
 * Chat request from channels.
 */
export interface ChatHandlerRequest {
  message: string;
  channel: "cli" | "web" | "telegram" | "zalo";
  clientId: string;
  conversationId?: string;
  /** Override models (CEO选latest) */
  openaiModel?: string;
  geminiModel?: string;
  kimiModel?: string;
  claudeModel?: string;
  /** Primary provider (default: openai, use gemini/kimi for alternative perspectives) */
  primaryProvider?: "claude" | "openai" | "gemini" | "kimi";
  /** Force full consultation */
  forceConsultation?: boolean;
}

/**
 * Individual model response.
 */
export interface ModelResponse {
  provider: "anthropic" | "openai" | "google" | "kimi" | "kimi-api" | "kimi-coding";
  model: string;
  content: string;
  latencyMs: number;
  status: "success" | "error" | "timeout";
  error?: string;
  tokens?: { input: number; output: number };
}

/**
 * Consolidated response (primary_with_notes).
 */
export interface ConsolidatedResponse {
  primary: string;
  critiques?: {
    openai?: string;
    gemini?: string;
    kimi?: string;
  };
  agreement: "full" | "partial" | "divergent";
  recommendation: string;
}

/**
 * Chat handler response.
 */
export interface ChatHandlerResponse {
  id: string;
  taskType: ChatTaskType;
  primary: string;
  consolidated: ConsolidatedResponse;
  responses: ModelResponse[];
  totalLatencyMs: number;
  tokenUsage: {
    input: number;
    output: number;
    budget: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Default models — latest and most capable (demands top-tier) */
export const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-4-5-20250929", // Claude via Bridge (OAuth), not API
  openai: "gpt-5.4",                       // Latest OpenAI for consultation
  gemini: "gemini-2.5-pro",                // Latest Gemini for consultation
  kimi: "kimi-k2-6",                       // Latest Kimi for consultation
};

/** Per-model timeout (30s) */
const PER_MODEL_TIMEOUT_MS = TIMEOUTS.modelCall;

/** Total timeout (60s) */
const TOTAL_TIMEOUT_MS = TIMEOUTS.chatTotal;

/** Context budget (2K tokens/turn) */
const TOKEN_BUDGET_PER_TURN = 2000;

// ============================================================================
// Task Type Detection (per ADR-001)
// ============================================================================

const TASK_PATTERNS: Record<ChatTaskType, RegExp> = {
  coding: /\b(implement|code|fix|bug|function|class|refactor)\b/i,
  documentation: /\b(document|write|readme|comment|jsdoc)\b/i,
  architecture: /\b(design|architect|pattern|scale|system)\b/i,
  research: /\b(research|compare|evaluate|trend|options)\b/i,
  security: /\b(security|auth|vulnerability|encrypt|owasp)\b/i,
  sdlc_gate: /\b(gate|g[0-4]|sdlc|checklist)\b/i,
};

/**
 * Classify task type from query (per ADR-001).
 */
export function classifyTask(query: string): ChatTaskType {
  for (const [type, pattern] of Object.entries(TASK_PATTERNS)) {
    if (pattern.test(query)) {
      return type as ChatTaskType;
    }
  }
  return "coding"; // Default to Claude only
}

/**
 * Route task to appropriate models (per ADR-001).
 */
/**
 * Route consultation tasks to expert providers (OpenAI + Gemini).
 * Claude development is via Claude Code Bridge (OAuth), NOT API.
 *
 * For `consult` command: OpenAI = primary expert, Gemini = critic.
 * For coding/docs/SDLC: handled by Claude Code Bridge, not this router.
 */
export function routeTask(taskType: ChatTaskType): ModelSelection {
  switch (taskType) {
    case "coding":
    case "documentation":
    case "sdlc_gate":
      // Single expert (fast path — coding/docs normally via Claude Code Bridge)
      return { primary: "openai", critics: [] };

    case "architecture":
    case "research":
      // Full expert panel (OpenAI + Gemini + Kimi)
      return { primary: "openai", critics: ["gemini", "kimi"] };

    case "security":
      // All experts for security critical
      return { primary: "openai", critics: ["gemini", "kimi"] };

    default:
      return { primary: "openai", critics: [] };
  }
}

// ============================================================================
// ChatHandler Class
// ============================================================================

/**
 * ChatHandler - 3-model consultation for CEO Tool.
 *
 * Features:
 * - Task-based routing (coding → Claude only, research → All 3)
 * - primary_with_notes consolidation
 * - Configurable model selection (CEO选latest)
 * - Context budget governance
 */
export class ChatHandler {
  private log: Logger;
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.log = createLogger("chat-handler");
    this.initializeProviders();
  }

  /**
   * Initialize providers from registry.
   */
  private initializeProviders(): void {
    try {
      const registry = getProviderRegistry();
      const allProviders = registry.list();

      for (const provider of allProviders) {
        this.providers.set(provider.id, provider);
      }

      this.log.info("ChatHandler initialized", {
        providers: Array.from(this.providers.keys()),
      });
    } catch (error) {
      this.log.warn("Failed to initialize providers", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Check if providers are available.
   */
  hasProviders(): boolean {
    return this.providers.size > 0;
  }

  /**
   * Get available provider IDs.
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Handle chat request with 3-model consultation.
   */
  async handle(request: ChatHandlerRequest): Promise<ChatHandlerResponse> {
    const startTime = Date.now();

    // P0 Fix: Check if providers are initialized
    if (this.providers.size === 0) {
      this.log.warn("No providers available, attempting to re-initialize");
      this.initializeProviders();

      if (this.providers.size === 0) {
        throw new Error(
          "No AI providers initialized. Ensure API keys are configured and run initializeProvidersFromEnv() first.",
        );
      }
    }

    const taskType = classifyTask(request.message);
    const routing = request.forceConsultation
      ? { primary: "openai", critics: ["gemini", "kimi"] }
      : routeTask(taskType);

    this.log.info("Handling chat request", {
      taskType,
      routing,
      forceConsultation: request.forceConsultation,
      availableProviders: this.getAvailableProviders(),
    });

    // P0 Fix: Apply Context Budget governance
    const budget = getContextBudget();
    const sessionId = request.clientId;

    // Check if session needs reset (30 turns)
    if (budget.needsReset(sessionId)) {
      this.log.info("Session needs reset, clearing context", { sessionId });
      budget.reset(sessionId);
    }

    // Step 2 (ADR-001): Inject project context before querying models
    const projectContext = buildProjectContext(process.cwd());
    if (projectContext) {
      this.log.info("Project context injected", { contextLength: projectContext.length });
    }

    // Query models based on routing
    const responses: ModelResponse[] = [];

    // Query primary provider (default: OpenAI — Claude is via Bridge, not API)
    const primaryProvider = request.primaryProvider ?? "openai";
    let primaryResponse: ModelResponse;

    if (primaryProvider === "gemini") {
      primaryResponse = await this.queryProvider(
        "google",
        request.geminiModel ?? DEFAULT_MODELS.gemini,
        request.message,
        projectContext,
      );
    } else if (primaryProvider === "kimi") {
      primaryResponse = await this.queryProvider(
        "kimi",
        request.kimiModel ?? DEFAULT_MODELS.kimi,
        request.message,
        projectContext,
      );
    } else {
      // Default: OpenAI (expert primary)
      primaryResponse = await this.queryProvider(
        "openai",
        request.openaiModel ?? DEFAULT_MODELS.openai,
        request.message,
        projectContext,
      );
    }
    responses.push(primaryResponse);

    // Query critics if needed (parallel)
    if (routing.critics.length > 0) {
      const criticPromises: Promise<ModelResponse>[] = [];

      if (routing.critics.includes("openai")) {
        criticPromises.push(
          this.queryProvider(
            "openai",
            request.openaiModel ?? DEFAULT_MODELS.openai,
            request.message,
            projectContext,
          ),
        );
      }

      if (routing.critics.includes("gemini")) {
        criticPromises.push(
          this.queryProvider(
            "google",
            request.geminiModel ?? DEFAULT_MODELS.gemini,
            request.message,
            projectContext,
          ),
        );
      }

      if (routing.critics.includes("kimi")) {
        criticPromises.push(
          this.queryProvider(
            "kimi",
            request.kimiModel ?? DEFAULT_MODELS.kimi,
            request.message,
            projectContext,
          ),
        );
      }

      // Wait for critics with timeout
      const criticResults = await Promise.race([
        Promise.allSettled(criticPromises),
        new Promise<PromiseSettledResult<ModelResponse>[]>((resolve) =>
          setTimeout(
            () => resolve(criticPromises.map(() => ({
              status: "rejected" as const,
              reason: new Error("Timeout"),
            }))),
            TOTAL_TIMEOUT_MS - (Date.now() - startTime),
          ),
        ),
      ]);

      for (const result of criticResults) {
        if (result.status === "fulfilled") {
          responses.push(result.value);
        } else {
          // Add timeout/error response
          responses.push({
            provider: "kimi",
            model: "unknown",
            content: "",
            latencyMs: Date.now() - startTime,
            status: "timeout",
            error: result.reason?.message ?? "Timeout",
          });
        }
      }
    }

    // Consolidate responses (primary_with_notes)
    const consolidated = this.consolidate(primaryResponse, responses);

    // Calculate token usage
    const totalTokens = responses.reduce(
      (acc, r) => ({
        input: acc.input + (r.tokens?.input ?? 0),
        output: acc.output + (r.tokens?.output ?? 0),
      }),
      { input: 0, output: 0 },
    );

    // P0 Fix: Record turn with Context Budget
    const tokensUsedThisTurn = totalTokens.input + totalTokens.output;
    budget.recordTurn(sessionId, tokensUsedThisTurn);

    // Check if approaching budget limit (warning at 80%)
    if (budget.isApproachingLimit(tokensUsedThisTurn)) {
      this.log.warn("Approaching token budget limit", {
        sessionId,
        tokensUsed: tokensUsedThisTurn,
        budget: TOKEN_BUDGET_PER_TURN,
      });
    }

    const result: ChatHandlerResponse = {
      id: randomUUID(),
      taskType,
      primary: primaryResponse.content,
      consolidated,
      responses,
      totalLatencyMs: Date.now() - startTime,
      tokenUsage: {
        input: totalTokens.input,
        output: totalTokens.output,
        budget: TOKEN_BUDGET_PER_TURN,
      },
    };

    this.log.debug("Chat request completed", {
      id: result.id,
      taskType,
      responseCount: responses.length,
      totalLatencyMs: result.totalLatencyMs,
      tokensUsed: tokensUsedThisTurn,
    });

    return result;
  }

  /**
   * Query a single provider.
   */
  private async queryProvider(
    providerId: "anthropic" | "openai" | "google" | "kimi" | "kimi-api" | "kimi-coding",
    model: string,
    message: string,
    systemContext?: string,
  ): Promise<ModelResponse> {
    const startTime = Date.now();
    // Sprint 141 P1-1: resolve "kimi" via provider registry instead of
    // conditional this.providers.get() checks (tech debt from Sprint 140).
    // ADR-053: Registry lookup order: kimi-coding (primary) → kimi-api (backup)
    type ProviderId = ModelResponse["provider"];
    let resolvedId: ProviderId | null = providerId;
    if (providerId === "kimi") {
      const registry = getProviderRegistry();
      if (registry.has("kimi-coding")) resolvedId = "kimi-coding";
      else if (registry.has("kimi-api")) resolvedId = "kimi-api";
      else resolvedId = null;
    }
    const provider = resolvedId ? this.providers.get(resolvedId) : undefined;

    if (!provider) {
      return {
        provider: resolvedId ?? providerId,
        model,
        content: "",
        latencyMs: Date.now() - startTime,
        status: "error",
        error: `Provider ${providerId} not available`,
      };
    }

    try {
      // Build messages with project context injection (ADR-001 step 2)
      // ADR-040: Use SystemBlock[] for Anthropic to enable prompt caching
      const messages: Message[] = [];
      if (systemContext) {
        if (providerId === "anthropic") {
          // Structured blocks — mark project context as cacheable
          messages.push({
            role: "system",
            content: [
              { type: "text" as const, text: systemContext, cache_control: { type: "ephemeral" as const } },
            ],
          });
        } else {
          messages.push({ role: "system", content: systemContext });
        }
      }
      messages.push({ role: "user", content: message });

      const request: ChatRequest = {
        model,
        messages,
        maxTokens: TOKEN_BUDGET_PER_TURN,
        temperature: 0.7,
      };

      // Add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PER_MODEL_TIMEOUT_MS);

      const response: ChatResponse = await provider.chat(request);
      clearTimeout(timeoutId);

      return {
        provider: resolvedId ?? providerId,
        model: response.model,
        content: response.content,
        latencyMs: Date.now() - startTime,
        status: "success",
        tokens: {
          input: response.usage.promptTokens,
          output: response.usage.completionTokens,
        },
      };
    } catch (error) {
      return {
        provider: resolvedId ?? providerId,
        model,
        content: "",
        latencyMs: Date.now() - startTime,
        status: (error as Error).name === "AbortError" ? "timeout" : "error",
        error: (error as Error).message,
      };
    }
  }

  /**
   * Consolidate responses using primary_with_notes algorithm.
   */
  private consolidate(
    primary: ModelResponse,
    allResponses: ModelResponse[],
  ): ConsolidatedResponse {
    const critiques: { openai?: string; gemini?: string; kimi?: string } = {};

    // Extract critiques from non-primary responses
    for (const response of allResponses) {
      if (response.provider === "openai" && response.status === "success") {
        critiques.openai = response.content;
      }
      if (response.provider === "google" && response.status === "success") {
        critiques.gemini = response.content;
      }
      if ((response.provider === "kimi" || response.provider === "kimi-api" || response.provider === "kimi-coding") && response.status === "success") {
        critiques.kimi = response.content;
      }
    }

    // If no critiques, return primary only
    if (!critiques.openai && !critiques.gemini && !critiques.kimi) {
      return {
        primary: primary.content,
        agreement: "full",
        recommendation: primary.content,
      };
    }

    // Calculate agreement level (simplified - check for common keywords)
    const agreement = this.calculateAgreement(primary.content, critiques);

    // Generate recommendation based on agreement
    let recommendation: string;
    if (agreement === "full") {
      recommendation = primary.content;
    } else if (agreement === "partial") {
      const notes = this.extractDifferentPoints(critiques, primary.content);
      recommendation = `${primary.content}\n\n📝 Alternative views:\n${notes}`;
    } else {
      recommendation = this.formatDivergentViews(primary.content, critiques);
    }

    return {
      primary: primary.content,
      critiques,
      agreement,
      recommendation,
    };
  }

  /**
   * Calculate agreement level between primary and critiques.
   */
  private calculateAgreement(
    primary: string,
    critiques: { openai?: string; gemini?: string; kimi?: string },
  ): "full" | "partial" | "divergent" {
    const allResponses = [primary, critiques.openai, critiques.gemini, critiques.kimi].filter(
      Boolean,
    ) as string[];

    if (allResponses.length === 1) return "full";

    // Simple keyword-based similarity
    const primaryWords = new Set(primary.toLowerCase().match(/\b\w{4,}\b/g) ?? []);
    let matchCount = 0;
    let totalWords = 0;

    for (const response of [critiques.openai, critiques.gemini, critiques.kimi]) {
      if (!response) continue;
      const words = response.toLowerCase().match(/\b\w{4,}\b/g) ?? [];
      totalWords += words.length;
      matchCount += words.filter((w) => primaryWords.has(w)).length;
    }

    const similarity = totalWords > 0 ? matchCount / totalWords : 0;

    if (similarity > 0.6) return "full";
    if (similarity > 0.3) return "partial";
    return "divergent";
  }

  /**
   * Extract different points from critiques.
   */
  private extractDifferentPoints(
    critiques: { openai?: string; gemini?: string; kimi?: string },
    _primary: string,
  ): string {
    const notes: string[] = [];

    if (critiques.openai) {
      // Extract first sentence or key point
      const firstSentence = critiques.openai.split(/[.!?]/)[0];
      notes.push(`• OpenAI: ${firstSentence?.trim() ?? "No specific point"}`);
    }

    if (critiques.gemini) {
      const firstSentence = critiques.gemini.split(/[.!?]/)[0];
      notes.push(`• Gemini: ${firstSentence?.trim() ?? "No specific point"}`);
    }

    if (critiques.kimi) {
      const firstSentence = critiques.kimi.split(/[.!?]/)[0];
      notes.push(`• Kimi: ${firstSentence?.trim() ?? "No specific point"}`);
    }

    return notes.join("\n");
  }

  /**
   * Format divergent views for CEO review.
   */
  private formatDivergentViews(
    primary: string,
    critiques: { openai?: string; gemini?: string; kimi?: string },
  ): string {
    const parts: string[] = [];

    parts.push("⚠️ **Divergent Views - CEO Review Required**\n");
    parts.push("**OpenAI (Primary):**");
    parts.push(primary.slice(0, 500));

    if (critiques.openai) {
      parts.push("\n**OpenAI (Critique):**");
      parts.push(critiques.openai.slice(0, 300));
    }

    if (critiques.gemini) {
      parts.push("\n**Gemini (Critique):**");
      parts.push(critiques.gemini.slice(0, 300));
    }

    if (critiques.kimi) {
      parts.push("\n**Kimi (Critique):**");
      parts.push(critiques.kimi.slice(0, 300));
    }

    return parts.join("\n");
  }

  /**
   * Consult method - simplified interface for CLI.
   * Wraps handle() with a simpler return format.
   */
  async consult(request: ChatHandlerRequest): Promise<{
    text: string;
    model: string;
    provider: string;
    agreement?: "full" | "partial" | "divergent";
    notes?: string;
    tokenUsage: {
      input: number;
      output: number;
      budget: number;
    };
  }> {
    const response = await this.handle(request);

    // Format notes from critiques
    let notes: string | undefined;
    if (response.consolidated.critiques) {
      const notesParts: string[] = [];
      if (response.consolidated.critiques.openai) {
        notesParts.push(`OpenAI: ${response.consolidated.critiques.openai.slice(0, 200)}`);
      }
      if (response.consolidated.critiques.gemini) {
        notesParts.push(`Gemini: ${response.consolidated.critiques.gemini.slice(0, 200)}`);
      }
      if (response.consolidated.critiques.kimi) {
        notesParts.push(`Kimi: ${response.consolidated.critiques.kimi.slice(0, 200)}`);
      }
      if (notesParts.length > 0) {
        notes = notesParts.join("\n\n");
      }
    }

    const result: {
      text: string;
      model: string;
      provider: string;
      agreement?: "full" | "partial" | "divergent";
      notes?: string;
      tokenUsage: {
        input: number;
        output: number;
        budget: number;
      };
    } = {
      text: response.consolidated.recommendation,
      model: response.responses[0]?.model ?? "unknown",
      provider: response.responses[0]?.provider ?? "unknown",
      agreement: response.consolidated.agreement,
      tokenUsage: response.tokenUsage,
    };

    // Conditionally add notes if present
    if (notes) {
      result.notes = notes;
    }

    return result;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalChatHandler: ChatHandler | undefined;

/**
 * Get the global ChatHandler instance.
 */
export function getChatHandler(): ChatHandler {
  if (!globalChatHandler) {
    globalChatHandler = new ChatHandler();
  }
  return globalChatHandler;
}

/**
 * Reset the global ChatHandler (for testing).
 */
export function resetChatHandler(): void {
  globalChatHandler = undefined;
}

// ============================================================================
// Project Context Builder (ADR-001 Step 2)
// ============================================================================

/**
 * Build project context from current working directory.
 * Reads IDENTITY.md, README.md (first 50 lines), workspace git info.
 * Capped at ~500 tokens to stay within 2K budget.
 */
function buildProjectContext(projectPath: string): string | undefined {
  const parts: string[] = [];

  // 1. IDENTITY.md — project identity (highest priority)
  const identityPath = join(projectPath, "IDENTITY.md");
  if (existsSync(identityPath)) {
    try {
      const content = readFileSync(identityPath, "utf-8");
      // Take first 30 lines (overview section)
      const lines = content.split("\n").slice(0, 30).join("\n").trim();
      if (lines) parts.push(`[Project Identity]\n${lines}`);
    } catch { /* ignore */ }
  }

  // 2. README.md — project description (fallback if no IDENTITY)
  if (parts.length === 0) {
    const readmePath = join(projectPath, "README.md");
    if (existsSync(readmePath)) {
      try {
        const content = readFileSync(readmePath, "utf-8");
        const lines = content.split("\n").slice(0, 30).join("\n").trim();
        if (lines) parts.push(`[Project README]\n${lines}`);
      } catch { /* ignore */ }
    }
  }

  // 3. Workspace context — git branch, recent commits
  const wsCtx = getWorkspaceContext(projectPath);
  const wsFormatted = formatWorkspaceContext(wsCtx);
  if (wsFormatted) parts.push(wsFormatted);

  if (parts.length === 0) return undefined;

  return `You are consulting on a project. Here is the project context:\n\n${parts.join("\n\n")}`;
}
