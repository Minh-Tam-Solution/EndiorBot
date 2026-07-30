/**
 * Consult Command
 *
 * Query multiple AI models for expert consultation.
 * Consolidates responses and provides recommendations.
 *
 * Usage:
 *   endiorbot consult "design payment gateway integration"
 *   endiorbot consult --openai o3 --gemini gemini-2.5-pro "complex design question"
 *   endiorbot consult --full "should we use Redis or PostgreSQL?"
 *
 * Model Selection (same as chatgpt.com/gemini.com):
 *   --openai <model>  - OpenAI model: gpt-5.4, o3, o3-mini, o1, gpt-4o
 *   --gemini <model>  - Gemini model: gemini-2.5-pro, gemini-2.5-flash
 *
 * @module cli/commands/consult
 * @version 2.0.0
 * @date 2026-02-28
 * @status ACTIVE - Sprint 54 Implementation
 * @authority ADR-001 3-Model Consultation
 * @pillar 3 - Agent Personas
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { createInterface } from "node:readline";
import type { Command } from "commander";
import {
  getOrchestrator,
  type ConsultationResult,
  type ModelQueryResult,
} from "../../agents/orchestrator/index.js";
import {
  getChatHandler,
  type ChatHandlerRequest,
} from "../../gateway/chat-handler.js";
import { initializeProvidersFromEnv } from "../../providers/init.js";
import { getClaudeCodeBridge } from "../../agents/invoke/claude-code-bridge.js";
import {
  OPUS,
  SONNET,
  FABLE,
  KIMI_K3,
  KIMI_K3_256K,
  KIMI_FOR_CODING,
  LEGACY_KIMI_K2_6,
} from "../../config/models.js";

// ============================================================================
// Constants - Available Models (per ADR-001)
// ============================================================================

/**
 * Available models for CEO selection.
 * Always use the latest and most capable models — demands top-tier.
 */
export const AVAILABLE_MODELS = {
  openai: ["gpt-5.4", "o3", "o3-mini", "o1", "gpt-4o", "gpt-4o-mini"],
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-thinking", "gemini-2.0-flash"],
  kimi: [KIMI_K3, KIMI_K3_256K, KIMI_FOR_CODING, LEGACY_KIMI_K2_6],
  anthropic: ["claude-opus-5", "claude-sonnet-5", "claude-fable-5", "claude-haiku-4"],
} as const;
// Note: anthropic entries are short aliases resolved via CLAUDE_MODEL_MAP below.

/**
 * Default models — latest and most capable from each provider.
 * CEO consultation demands top-tier reasoning, not budget models.
 */
const DEFAULT_MODELS = {
  openai: "gpt-5.4",
  gemini: "gemini-2.5-pro",
  kimi: KIMI_K3,
} as const;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format task type for display.
 */
function formatTaskType(taskType: string): string {
  const types: Record<string, string> = {
    architecture: "🏗️  Architecture",
    code_review: "👀 Code Review",
    security: "🔒 Security",
    research: "🔍 Research",
    general: "💬 General",
  };
  return types[taskType] ?? taskType;
}

/**
 * Format query status.
 */
function formatStatus(status: string): string {
  const statuses: Record<string, string> = {
    success: "✅",
    timeout: "⏱️",
    error: "❌",
    pending: "⏳",
  };
  return statuses[status] ?? "❓";
}

/**
 * Format provider name.
 */
function formatProvider(provider: string): string {
  const providers: Record<string, string> = {
    anthropic: "Claude",
    openai: "GPT",
    google: "Gemini",
    kimi: "Kimi",
    mistral: "Mistral",
  };
  return providers[provider] ?? provider;
}

/**
 * Display model response.
 */
function displayResponse(response: ModelQueryResult): void {
  const status = formatStatus(response.status);
  const provider = formatProvider(response.provider);
  const role = response.role === "primary" ? " (Primary)" : "";
  const latency = `${response.latencyMs}ms`;

  console.log(`│  ${status} ${provider}${role} - ${latency}`.padEnd(62) + "│");

  if (response.content) {
    // Wrap content to fit in box
    const lines = response.content.split("\n").slice(0, 4);
    for (const line of lines) {
      const truncated = line.slice(0, 55);
      console.log(`│     ${truncated.padEnd(55)}│`);
    }
    if (lines.length < response.content.split("\n").length) {
      console.log(`│     ...`.padEnd(62) + "│");
    }
  }

  if (response.error) {
    console.log(`│     Error: ${response.error.slice(0, 45)}`.padEnd(62) + "│");
  }

  console.log("│".padEnd(62) + "│");
}

/**
 * Display consultation result.
 */
function displayResult(result: ConsultationResult, verbose: boolean): void {
  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│  🤖 Expert Consultation                                     │`);
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  ID: ${result.taskId.padEnd(54)}│`);
  console.log(`│  Type: ${formatTaskType(result.taskType).padEnd(52)}│`);
  console.log(`│  Query: ${result.query.slice(0, 50).padEnd(51)}│`);
  console.log("├─────────────────────────────────────────────────────────────┤");

  // Show responses
  console.log(`│  📊 Responses (${result.modelsResponded}/${result.modelsQueried})`.padEnd(62) + "│");
  console.log("│".padEnd(62) + "│");

  if (verbose) {
    for (const response of result.responses) {
      displayResponse(response);
    }
  } else {
    // Just show summary
    for (const response of result.responses) {
      const status = formatStatus(response.status);
      const provider = formatProvider(response.provider);
      const role = response.role === "primary" ? " ★" : "";
      console.log(`│  ${status} ${provider}${role}`.padEnd(62) + "│");
    }
    console.log("│".padEnd(62) + "│");
  }

  // Show consensus
  console.log("├─────────────────────────────────────────────────────────────┤");
  if (result.consensus.hasConsensus) {
    const agreement = result.consensus.points[0]?.agreement ?? 0;
    console.log(
      `│  ✅ Consensus: ${Math.round(agreement * 100)}% agreement`.padEnd(62) + "│",
    );
    for (const point of result.consensus.points) {
      console.log(`│     • ${point.description.slice(0, 52)}`.padEnd(62) + "│");
    }
  } else {
    console.log("│  ⚠️  No clear consensus".padEnd(62) + "│");
  }

  // Show disagreements if any
  if (result.consensus.disagreements.length > 0) {
    console.log("│".padEnd(62) + "│");
    console.log("│  ⚖️  Disagreements:".padEnd(62) + "│");
    for (const d of result.consensus.disagreements) {
      console.log(`│     ${d.topic}:`.padEnd(62) + "│");
      for (const pos of d.positions) {
        console.log(
          `│       ${formatProvider(pos.provider)}: ${pos.position.slice(0, 40)}`.padEnd(62) + "│",
        );
      }
    }
  }

  // Show recommendation
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log("│  💡 Recommendation:".padEnd(62) + "│");
  const recLines = result.recommendation.match(/.{1,55}/g) ?? [];
  for (const line of recLines.slice(0, 3)) {
    console.log(`│     ${line.padEnd(55)}│`);
  }

  // Show SDLC compliance
  if (result.sdlcCompliance.notes.length > 0) {
    console.log("│".padEnd(62) + "│");
    console.log("│  📋 SDLC Notes:".padEnd(62) + "│");
    for (const note of result.sdlcCompliance.notes) {
      console.log(`│     • ${note.slice(0, 52)}`.padEnd(62) + "│");
    }
  }

  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  ⏱️  Total: ${result.totalLatencyMs}ms`.padEnd(62) + "│");
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");
}

// ============================================================================
// Command Action
// ============================================================================

/**
 * Consult options with model selection.
 */
interface ConsultOptions {
  models?: string;
  claude?: string;
  openai?: string;
  gemini?: string;
  kimi?: string;
  primary?: "claude" | "openai" | "gemini" | "kimi";
  viaClaudeCode?: boolean;
  full?: boolean;
  verbose?: boolean;
}

/**
 * Map short Claude aliases to full model IDs.
 */
const CLAUDE_MODEL_MAP: Record<string, string> = {
  "claude-opus-5": OPUS,
  "claude-sonnet-5": SONNET,
  "claude-fable-5": FABLE,
  "claude-haiku-4": "claude-haiku-4-5-20251001",
  // Legacy aliases still resolve for backward compat.
  "claude-opus-4": OPUS,
  "claude-sonnet-4": SONNET,
};

/**
 * Validate model selection.
 */
function validateModel(
  provider: "openai" | "gemini" | "kimi" | "anthropic",
  model: string,
): boolean {
  const available = AVAILABLE_MODELS[provider] as readonly string[];
  return available.includes(model);
}

/**
 * Consult command action.
 */
async function consultAction(
  query: string,
  options: ConsultOptions,
): Promise<void> {
  console.log("");
  console.log("🔄 Consulting expert panel...");

  // Initialize providers from environment variables
  await initializeProvidersFromEnv();

  // Validate model selections if provided
  if (options.claude && !validateModel("anthropic", options.claude)) {
    console.error(`❌ Invalid Claude model: ${options.claude}`);
    console.log(`   Available: ${AVAILABLE_MODELS.anthropic.join(", ")}`);
    process.exit(1);
  }

  if (options.openai && !validateModel("openai", options.openai)) {
    console.error(`❌ Invalid OpenAI model: ${options.openai}`);
    console.log(`   Available: ${AVAILABLE_MODELS.openai.join(", ")}`);
    process.exit(1);
  }

  if (options.gemini && !validateModel("gemini", options.gemini)) {
    console.error(`❌ Invalid Gemini model: ${options.gemini}`);
    console.log(`   Available: ${AVAILABLE_MODELS.gemini.join(", ")}`);
    process.exit(1);
  }

  if (options.kimi && !validateModel("kimi", options.kimi)) {
    console.error(`❌ Invalid Kimi model: ${options.kimi}`);
    console.log(`   Available: ${AVAILABLE_MODELS.kimi.join(", ")}`);
    process.exit(1);
  }

  // Handle --via-claude-code option (uses Max 200 subscription)
  if (options.viaClaudeCode) {
    // Note: Safe to use even if CLAUDECODE env var is set, because we use
    // -p --no-session-persistence (non-interactive mode) which doesn't share
    // runtime resources with any parent Claude Code session.

    console.log("   Using Claude Code CLI (Max 200 subscription)");
    console.log("");

    try {
      const bridge = getClaudeCodeBridge();

      // Check availability
      const isAvailable = await bridge.isAvailable();
      if (!isAvailable) {
        console.error("❌ Claude Code CLI not available. Install with:");
        console.log("   npm install -g @anthropic-ai/claude-code");
        process.exit(1);
      }

      const response = await bridge.invokeRead({
        systemPrompt: "You are an expert consultant for software engineering decisions.",
        userPrompt: query,
        workspace: process.cwd(),
        agent: "researcher",
        timeout: 120,
      });

      if (response.success) {
        displayClaudeCodeResponse(response.output, response.durationMs, options.verbose ?? false);
      } else {
        console.error(`❌ Claude Code failed: ${response.error}`);
        process.exit(1);
      }
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ Claude Code bridge failed: ${message}`);
      process.exit(1);
    }
  }

  // Show selected models (OpenAI + Gemini + Kimi expert panel)
  const openaiModel = options.openai ?? DEFAULT_MODELS.openai;
  const geminiModel = options.gemini ?? DEFAULT_MODELS.gemini;
  const kimiModel = options.kimi ?? DEFAULT_MODELS.kimi;
  const primaryProvider = options.primary ?? "openai";

  // Display with correct primary indicator
  const openaiLabel = primaryProvider === "openai" ? `${openaiModel} (Primary)` : openaiModel;
  const geminiLabel = primaryProvider === "gemini" ? `${geminiModel} (Primary)` : geminiModel;
  const kimiLabel = primaryProvider === "kimi" ? `${kimiModel} (Primary)` : kimiModel;
  console.log(`   ${openaiLabel} + ${geminiLabel} + ${kimiLabel}`);
  console.log("");

  try {
    // Use ChatHandler for Sprint 54 3-model consultation
    const chatHandler = getChatHandler();

    // Build request with only defined properties
    const request: ChatHandlerRequest = {
      message: query,
      channel: "cli",
      clientId: "cli-consult",
    };

    // Add optional model selections if provided
    if (options.claude) {
      // Map short alias to full model ID
      request.claudeModel = CLAUDE_MODEL_MAP[options.claude] ?? options.claude;
    }
    if (options.openai) {
      request.openaiModel = options.openai;
    }
    if (options.gemini) {
      request.geminiModel = options.gemini;
    }
    if (options.kimi) {
      request.kimiModel = options.kimi;
    }
    if (options.primary) {
      request.primaryProvider = options.primary;
    }
    if (options.full) {
      request.forceConsultation = options.full;
    }

    const response = await chatHandler.consult(request);

    // Display using new format for ChatHandler response
    displayChatResponse(response, options.verbose ?? false);

    // Interactive action prompt
    const action = await promptAction();
    if (action === "d") {
      console.log("\nℹ️  Use: endiorbot consult --full \"<follow-up question>\" to discuss further.");
    } else if (action === "r") {
      console.log("\nℹ️  Use: endiorbot consult \"<new question>\" to re-consult.");
    } else {
      console.log("\n✅ Recommendation noted.");
    }
    console.log("");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Fallback to orchestrator if ChatHandler not available
    if (message.includes("not available") || message.includes("not initialized")) {
      console.log("⚠️  ChatHandler not available, using orchestrator fallback...");
      console.log("");

      const orchestrator = getOrchestrator();
      const result = await orchestrator.consult(query);
      displayResult(result, options.verbose ?? false);
    } else {
      console.error(`❌ Consultation failed: ${message}`);
      process.exit(1);
    }
  }
}

/**
 * Prompt user for action after consultation.
 */
function promptAction(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question("📋 Action — [A]pprove / [D]iscuss / [R]e-consult (default: A): ", (answer) => {
      rl.close();
      resolve((answer || "a").trim().toLowerCase());
    });
  });
}

/**
 * Display ChatHandler response in CLI format.
 * Full response printed outside box (not truncated).
 */
function displayChatResponse(
  response: Awaited<ReturnType<ReturnType<typeof getChatHandler>["consult"]>>,
  _verbose: boolean,
): void {
  const agreementEmoji: Record<string, string> = {
    full: "✅",
    partial: "⚠️",
    divergent: "🔀",
  };

  // Compact header box (metadata only)
  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│  🤖 Expert Consultation                                     │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Primary: ${response.model.padEnd(49)}│`);
  console.log(`│  Provider: ${response.provider.padEnd(48)}│`);
  if (response.agreement) {
    console.log(
      `│  Agreement: ${agreementEmoji[response.agreement] ?? ""} ${response.agreement.padEnd(45)}│`,
    );
  }
  console.log(
    `│  Tokens: ${response.tokenUsage.input} in / ${response.tokenUsage.output} out (budget: ${response.tokenUsage.budget})`.padEnd(62) + "│",
  );
  console.log("└─────────────────────────────────────────────────────────────┘");

  // Full response — NOT truncated
  console.log("");
  console.log("📝 Response:");
  console.log("─".repeat(60));
  console.log(response.text);
  console.log("─".repeat(60));

  // Alternative views — full content
  if (response.notes) {
    console.log("");
    console.log("📋 Alternative Views:");
    console.log("─".repeat(60));
    console.log(response.notes);
    console.log("─".repeat(60));
  }
  console.log("");
}

/**
 * Display Claude Code bridge response.
 */
function displayClaudeCodeResponse(
  output: string,
  durationMs: number,
  verbose: boolean,
): void {
  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│  🤖 Claude Code (Max 200 Subscription)                      │`);
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log("│  Provider: Claude Code CLI                                  │");
  console.log(`│  Duration: ${durationMs}ms`.padEnd(62) + "│");
  console.log("├─────────────────────────────────────────────────────────────┤");

  // Show response
  console.log("│  📝 Response:".padEnd(62) + "│");
  const lines = output.split("\n").slice(0, verbose ? 30 : 10);
  for (const line of lines) {
    const truncated = line.slice(0, 55);
    console.log(`│     ${truncated.padEnd(55)}│`);
  }
  if (lines.length < output.split("\n").length) {
    console.log(`│     ...`.padEnd(62) + "│");
  }

  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log("│  ✅ Using Max 200 subscription (no API credits used)        │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register consult command.
 *
 * Per ADR-001 Consultation (amended):
 * - OpenAI (Primary expert) - CEO can select: o3, o3-mini, o1, gpt-4o
 * - Gemini (Critic) - CEO can select: gemini-2.5-pro, gemini-2.0-flash-thinking
 * - Claude development is via Claude Code Bridge (OAuth), NOT API
 */
export function registerConsultCommand(program: Command): void {
  program
    .command("consult <query>")
    .description("Query expert panel for consultation (OpenAI + Gemini + Kimi)")
    .option("--openai <model>", `OpenAI model (${AVAILABLE_MODELS.openai.join(", ")})`, DEFAULT_MODELS.openai)
    .option("--gemini <model>", `Gemini model (${AVAILABLE_MODELS.gemini.join(", ")})`, DEFAULT_MODELS.gemini)
    .option("--kimi <model>", `Kimi model (${AVAILABLE_MODELS.kimi.join(", ")})`, DEFAULT_MODELS.kimi)
    .option("--primary <provider>", "Primary provider: openai, gemini, or kimi (default: openai)")
    .option("--via-claude-code", "Use Claude Code CLI for single-model query")
    .option("--full", "Force full 3-model consultation regardless of task type")
    .option("-v, --verbose", "Show detailed responses from each model")
    .option("-m, --models <models>", "Legacy: Specific models to query (comma-separated)")
    .action(consultAction);

  // Also add 'models' command to list available models
  program
    .command("models")
    .description("List available AI models for consultation")
    .action(() => {
      console.log("");
      console.log("┌─────────────────────────────────────────────────────────────┐");
      console.log("│  🤖 Available Models for Consultation                       │");
      console.log("├─────────────────────────────────────────────────────────────┤");
      console.log("│  OpenAI (Primary Expert):".padEnd(62) + "│");
      for (const model of AVAILABLE_MODELS.openai) {
        const isDefault = model === DEFAULT_MODELS.openai ? " (default)" : "";
        console.log(`│     • ${model}${isDefault}`.padEnd(62) + "│");
      }
      console.log("│".padEnd(62) + "│");
      console.log("│  Gemini (Critic):".padEnd(62) + "│");
      for (const model of AVAILABLE_MODELS.gemini) {
        const isDefault = model === DEFAULT_MODELS.gemini ? " (default)" : "";
        console.log(`│     • ${model}${isDefault}`.padEnd(62) + "│");
      }
      console.log("│".padEnd(62) + "│");
      console.log("│  Kimi (Expert):".padEnd(62) + "│");
      for (const model of AVAILABLE_MODELS.kimi) {
        const isDefault = model === DEFAULT_MODELS.kimi ? " (default)" : "";
        console.log(`│     • ${model}${isDefault}`.padEnd(62) + "│");
      }
      console.log("│".padEnd(62) + "│");
      console.log("│  Claude (via Claude Code Bridge — development only):".padEnd(62) + "│");
      console.log("│     • Use --via-claude-code for single-model query".padEnd(62) + "│");
      console.log("└─────────────────────────────────────────────────────────────┘");
      console.log("");
      console.log("Usage:");
      console.log("  endiorbot consult --openai o3 --gemini gemini-2.5-pro --kimi kimi-k2-6 \"your question\"");
      console.log("");
    });
}
