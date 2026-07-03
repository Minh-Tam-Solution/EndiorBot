/**
 * Zalo Agent Handler
 *
 * Wires incoming Zalo messages to EndiorBot agent orchestration.
 * Parses [@agent: task] format and invokes orchestration layer.
 *
 * @module channels/zalo/agent-handler
 * @version 1.0.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 57
 * @authority Master Plan v3.1
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import {
  parseMention,
  hasMention,
} from "../../agents/orchestrator/mention-parser.js";
import { getTeamRegistry } from "../../agents/orchestrator/team-registry.js";
import { getAgentRouter } from "../../agents/orchestrator/agent-router.js";
import { getWorkflowEngine } from "../../agents/orchestrator/workflow-engine.js";
import { getClaudeCodeBridge, type InvokeRequest } from "../../agents/invoke/claude-code-bridge.js";
import { parseResponse, extractFirstHandoff } from "../../agents/invoke/response-parser.js";
import {
  formatForZalo,
  formatProcessing,
  formatAgentNotFound,
  formatError,
  type AgentResponse,
} from "../ott/response-formatter.js";
import type { SanitizedChannelMessage } from "../ott/message-router.js";
import type { AgentRole } from "../../agents/types/handoff.js";
import { createLogger, type Logger } from "../../logging/index.js";
import { handleZaloCommand } from "./zalo-commands.js";
import { getConversationStore, type ConversationTurn } from "../conversation/store.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Agent invocation result for Zalo.
 */
export interface ZaloAgentResult {
  /** Whether invocation succeeded */
  success: boolean;
  /** Agent response */
  response?: AgentResponse;
  /** Error if failed */
  error?: string;
  /** Formatted message for Zalo */
  formattedMessage: string;
  /** Suggested next action (for quick replies) */
  suggestedAction?: {
    agent: AgentRole;
    intent: string;
  };
}

/**
 * Zalo send function type.
 */
export type ZaloSendFn = (message: string) => Promise<boolean>;

// ============================================================================
// Zalo Agent Handler
// ============================================================================

/**
 * Handle incoming Zalo message with agent mention.
 *
 * Parses [@agent: task] format and routes to orchestration layer.
 * Returns formatted response for Zalo.
 *
 * NOTE: Zalo is intentionally READ-only — no PATCH mode support.
 * Zalo OA API doesn't support inline keyboards for 2-step PATCH confirmation,
 * and Zalo's quick-reply UX is insufficient for secure mode escalation.
 * PATCH operations should be done via Telegram or CLI. (CTO P1-5, Sprint 76)
 */
export async function handleZaloAgentMention(
  message: SanitizedChannelMessage,
  sendFn: ZaloSendFn,
  conversationHistory?: ConversationTurn[]
): Promise<ZaloAgentResult> {
  const log = createLogger("zalo-agent-handler");
  const content = message.sanitized;

  // Check if message contains agent mention (with team registry for team support)
  const teamRegistry = getTeamRegistry();
  if (!hasMention(content, teamRegistry)) {
    return {
      success: false,
      error: "No agent mention found",
      formattedMessage: "",
    };
  }

  // Parse mention (with team registry for team resolution)
  const parseResult = parseMention(content, teamRegistry);
  if (!parseResult.success) {
    log.warn("Failed to parse agent mention", {
      error: parseResult.error.message,
      input: content.slice(0, 100),
    });

    return {
      success: false,
      error: parseResult.error.message,
      formattedMessage: formatAgentNotFound(content),
    };
  }

  const { agents, message: task } = parseResult.data;
  const primaryAgent = agents[0];

  if (!primaryAgent) {
    return {
      success: false,
      error: "No valid agent found",
      formattedMessage: formatAgentNotFound(content),
    };
  }

  // Send "processing" indicator
  await sendFn(formatProcessing(primaryAgent, task));

  // Invoke agent
  try {
    const result = await invokeZaloAgent(primaryAgent, task, log, conversationHistory);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("Agent invocation failed", { error: errorMsg, agent: primaryAgent });

    return {
      success: false,
      error: errorMsg,
      formattedMessage: formatError(errorMsg, "zalo"),
    };
  }
}

/**
 * Format conversation history as context prefix for userPrompt.
 */
function buildHistoryContext(history: ConversationTurn[]): string {
  if (history.length === 0) return "";
  const lines = history.map((t) =>
    `${t.role === "user" ? "CEO" : "Bot"}: ${t.content.slice(0, 300)}`
  );
  return `[Previous conversation]\n${lines.join("\n")}\n[End of history]\n\n`;
}

/**
 * Invoke agent via orchestration layer for Zalo.
 */
async function invokeZaloAgent(
  agent: AgentRole,
  task: string,
  log: Logger,
  conversationHistory?: ConversationTurn[]
): Promise<ZaloAgentResult> {
  const startTime = Date.now();

  // Get orchestration components
  const router = getAgentRouter();
  const workflow = getWorkflowEngine();
  const bridge = getClaudeCodeBridge();

  // Route to agent (single input argument)
  const routeResult = await router.route(`@${agent} ${task}`);

  if (!routeResult.success) {
    return {
      success: false,
      error: routeResult.error.message,
      formattedMessage: formatError(routeResult.error.message, "zalo"),
    };
  }

  const decision = routeResult.decision;

  log.info("Agent routed", {
    agent: decision.agent,
    taskType: decision.classification.taskType,
  });

  // Start workflow (simplified for OTT - no full classification)
  const workflowCtx = workflow.start(
    decision.agent,
    decision.message
  );

  workflow.startStep(workflowCtx.id);

  // Build Claude Code invoke request
  // Sprint 76: OTT timeout 300s (5 min) — CEO noted large sessions take minutes
  const ottTimeout = parseInt(process.env.ENDIORBOT_OTT_TIMEOUT ?? "300", 10) || 300;
  // B2: Prepend conversation history to userPrompt for multi-turn context
  const historyPrefix = buildHistoryContext(conversationHistory ?? []);
  const invokeRequest: InvokeRequest = {
    mode: "READ", // Zalo is intentionally READ-only (no PATCH mode — CTO P1-5)
    systemPrompt: decision.soul.content, // SoulTemplate.content
    userPrompt: historyPrefix + decision.message,
    workspace: process.cwd(),
    agent: decision.agent,
    timeout: ottTimeout,
  };

  // W1: Runtime assertion — defense-in-depth (ADR-020 §6, CTO P1-5)
  if (invokeRequest.mode !== "READ") {
    throw new Error("Zalo channel is READ-only (CTO P1-5)");
  }

  // Invoke Claude Code
  const bridgeResult = await bridge.invoke(invokeRequest);

  const durationMs = Date.now() - startTime;

  // Parse response
  const parsed = parseResponse(bridgeResult.output);
  const firstHandoff = extractFirstHandoff(bridgeResult.output);

  // Complete workflow step
  workflow.completeStep(workflowCtx.id, bridgeResult.output);

  // Build agent response
  const agentResponse: AgentResponse = {
    agent: decision.agent,
    task,
    output: parsed.content,
    durationMs,
  };

  // Add handoff if present
  if (firstHandoff) {
    agentResponse.handoff = {
      to: firstHandoff.to,
      intent: firstHandoff.intent,
      priority: firstHandoff.priority,
      inputs: firstHandoff.inputs,
      reason: firstHandoff.reason,
      from: decision.agent,
      depth: 0,
      timestamp: new Date(),
      correlationId: workflowCtx.id,
    };
  }

  const formatted = formatForZalo(agentResponse);

  // Build result with suggested action
  const result: ZaloAgentResult = {
    success: true,
    response: agentResponse,
    formattedMessage: formatted.text,
  };

  if (firstHandoff) {
    result.suggestedAction = {
      agent: firstHandoff.to,
      intent: firstHandoff.intent,
    };
  }

  return result;
}

// ============================================================================
// Handoff Handler
// ============================================================================

/**
 * Handle handoff continuation for Zalo.
 */
export async function handleZaloHandoff(
  toAgent: AgentRole,
  intent: string,
  sendFn: ZaloSendFn
): Promise<ZaloAgentResult> {
  const log = createLogger("zalo-agent-handler");

  log.info("Handling handoff", { toAgent, intent: intent.slice(0, 50) });

  // Send "processing" indicator
  await sendFn(formatProcessing(toAgent, intent));

  // Invoke next agent
  try {
    return await invokeZaloAgent(toAgent, intent, log);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("Handoff failed", { error: errorMsg, toAgent });

    return {
      success: false,
      error: errorMsg,
      formattedMessage: formatError(errorMsg, "zalo"),
    };
  }
}

// ============================================================================
// Message Router Integration
// ============================================================================

/**
 * Create a secure message handler for Zalo agent invocations.
 *
 * Wire this to ZaloBotChannel's onMessage handler.
 */
export function createZaloAgentHandler(
  sendFn: ZaloSendFn
): (message: SanitizedChannelMessage) => Promise<void> {
  const log = createLogger("zalo-agent-handler");

  const store = getConversationStore();

  return async (message: SanitizedChannelMessage): Promise<void> => {
    // Skip blocked messages
    if (!message.allowed) {
      log.warn("Message blocked by security", {
        reason: message.blockReason,
        violations: message.violations,
      });
      return;
    }

    // B2: Use senderId as conversation key (Zalo bot is 1:1 with CEO)
    const chatId = message.original.senderId;

    // Sprint 77 (ADR-020 §1): Check for slash commands BEFORE agent mentions
    // P0-1 fix: Use original content for command detection — sanitized text
    // is wrapped in [EXTERNAL_INPUT] tags by InputSanitizer and never starts with "/"
    const rawContent = message.original.content.trim();
    if (rawContent.startsWith("/")) {
      const handled = await handleZaloCommand(rawContent, sendFn, chatId);
      if (handled) return;
      // Unknown command — fall through to mention handler
    }

    // Check for agent mention (with team registry for team support)
    if (!hasMention(message.sanitized, getTeamRegistry())) {
      // Not an agent command, ignore
      return;
    }

    // B2: Record user turn before invoking
    store.add(chatId, "user", rawContent);
    const history = store.get(chatId);

    // Handle agent mention (pass history for multi-turn context)
    const result = await handleZaloAgentMention(message, sendFn, history);

    // B2: Record assistant response after invoking
    const responseText = result.response?.output ?? result.formattedMessage;
    if (result.success && responseText) {
      store.add(chatId, "assistant", responseText);
    }

    // Send response
    await sendFn(result.formattedMessage);

    // If there's a suggested action, include quick reply hint
    if (result.suggestedAction) {
      const hint = `\n\n💡 Continue: [@${result.suggestedAction.agent}: continue]`;
      await sendFn(hint);
    }

    log.info("Agent invocation complete", {
      success: result.success,
      hasSuggestion: !!result.suggestedAction,
      historyTurns: history.length,
    });
  };
}
