/**
 * Telegram Agent Handler
 *
 * Wires incoming Telegram messages to EndiorBot agent orchestration.
 * Parses [@agent: task] format and invokes orchestration layer.
 *
 * @module channels/telegram/agent-handler
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
  formatForTelegram,
  formatProcessing,
  formatAgentNotFound,
  formatAgentName,
  formatError,
  type AgentResponse,
} from "../ott/response-formatter.js";
import type { SanitizedChannelMessage } from "../ott/message-router.js";
import type { AgentRole } from "../../agents/types/handoff.js";
import { createLogger, type Logger } from "../../logging/index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Agent invocation result.
 */
export interface AgentInvocationResult {
  /** Whether invocation succeeded */
  success: boolean;
  /** Agent response */
  response?: AgentResponse;
  /** Error if failed */
  error?: string;
  /** Formatted message for Telegram */
  formattedMessage: string;
  /** Whether to show handoff buttons */
  showHandoffButtons: boolean;
  /** Handoff options */
  handoffOptions: Array<{
    agent: AgentRole;
    intent: string;
    priority: string;
  }>;
  /** Whether PATCH mode confirmation is pending */
  patchPending?: boolean;
  /** PATCH mode task (stripped of PATCH: prefix) */
  patchTask?: string;
  /** PATCH mode target agent */
  patchAgent?: AgentRole;
}

/**
 * Telegram send function type.
 */
export type TelegramSendFn = (
  message: string,
  options?: {
    parseMode?: "Markdown" | "HTML";
    replyMarkup?: unknown;
  }
) => Promise<boolean>;

// ============================================================================
// Telegram Agent Handler
// ============================================================================

/**
 * Handle incoming Telegram message with agent mention.
 *
 * Parses [@agent: task] format and routes to orchestration layer.
 * Returns formatted response for Telegram.
 */
export async function handleAgentMention(
  message: SanitizedChannelMessage,
  sendFn: TelegramSendFn
): Promise<AgentInvocationResult> {
  const log = createLogger("telegram-agent-handler");
  const content = message.sanitized;

  // Check if message contains agent mention (with team registry for team support)
  const teamRegistry = getTeamRegistry();
  if (!hasMention(content, teamRegistry)) {
    return {
      success: false,
      error: "No agent mention found",
      formattedMessage: "",
      showHandoffButtons: false,
      handoffOptions: [],
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
      showHandoffButtons: false,
      handoffOptions: [],
    };
  }

  const { agents, message: task } = parseResult.data;
  const primaryAgent = agents[0];

  if (!primaryAgent) {
    return {
      success: false,
      error: "No valid agent found",
      formattedMessage: formatAgentNotFound(content),
      showHandoffButtons: false,
      handoffOptions: [],
    };
  }

  // Sprint 76: Detect PATCH mode escalation
  // Format: "@agent PATCH: task" or "[@agent: PATCH: task]"
  const patchMatch = task.match(/^PATCH:\s*(.+)$/i);
  if (patchMatch) {
    const patchTask = patchMatch[1] ?? task;
    log.info("PATCH mode requested via OTT", { agent: primaryAgent, task: patchTask.slice(0, 50) });

    return {
      success: true,
      formattedMessage: `⚠️ *PATCH mode requested*\n\n${formatAgentName(primaryAgent)} wants to modify files:\n📝 ${patchTask.slice(0, 200)}\n\nConfirm to proceed with PATCH mode.`,
      showHandoffButtons: false,
      handoffOptions: [],
      patchPending: true,
      patchTask,
      patchAgent: primaryAgent,
    };
  }

  // Send "processing" indicator
  await sendFn(formatProcessing(primaryAgent, task), { parseMode: "Markdown" });

  // Invoke agent
  try {
    const result = await invokeAgent(primaryAgent, task, log);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("Agent invocation failed", { error: errorMsg, agent: primaryAgent });

    return {
      success: false,
      error: errorMsg,
      formattedMessage: formatError(errorMsg, "telegram"),
      showHandoffButtons: false,
      handoffOptions: [],
    };
  }
}

/**
 * Invoke agent via orchestration layer.
 */
async function invokeAgent(
  agent: AgentRole,
  task: string,
  log: Logger
): Promise<AgentInvocationResult> {
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
      formattedMessage: formatError(routeResult.error.message, "telegram"),
      showHandoffButtons: false,
      handoffOptions: [],
    };
  }

  const decision = routeResult.decision;

  log.info("Agent routed", {
    agent: decision.agent,
    taskType: decision.classification.taskType,
  });

  // Start workflow (no classification for OTT - simplified)
  const workflowCtx = workflow.start(
    decision.agent,
    decision.message
  );

  workflow.startStep(workflowCtx.id);

  // Build Claude Code invoke request
  // Sprint 76: OTT timeout 300s (5 min) — CEO noted large sessions take minutes
  const ottTimeout = parseInt(process.env.ENDIORBOT_OTT_TIMEOUT ?? "300", 10) || 300;
  const invokeRequest: InvokeRequest = {
    mode: "READ", // OTT always uses READ mode for safety
    systemPrompt: decision.soul.content, // SoulTemplate.content
    userPrompt: decision.message,
    workspace: process.cwd(),
    agent: decision.agent,
    timeout: ottTimeout,
  };

  // Invoke Claude Code
  const bridgeResult = await bridge.invoke(invokeRequest);

  const durationMs = Date.now() - startTime;

  // Parse response
  const parsed = parseResponse(bridgeResult.output);
  const firstHandoff = extractFirstHandoff(bridgeResult.output);

  // Complete workflow step (no handoff metadata for OTT)
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

  const formatted = formatForTelegram(agentResponse);

  return {
    success: true,
    response: agentResponse,
    formattedMessage: formatted.text,
    showHandoffButtons: formatted.showHandoffButtons,
    handoffOptions: formatted.handoffOptions,
  };
}

// ============================================================================
// Handoff Handler
// ============================================================================

/**
 * Handle handoff button press.
 */
export async function handleHandoff(
  toAgent: AgentRole,
  intent: string,
  sendFn: TelegramSendFn
): Promise<AgentInvocationResult> {
  const log = createLogger("telegram-agent-handler");

  log.info("Handling handoff", { toAgent, intent: intent.slice(0, 50) });

  // Send "processing" indicator
  await sendFn(formatProcessing(toAgent, intent), { parseMode: "Markdown" });

  // Invoke next agent
  try {
    return await invokeAgent(toAgent, intent, log);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("Handoff failed", { error: errorMsg, toAgent });

    return {
      success: false,
      error: errorMsg,
      formattedMessage: formatError(errorMsg, "telegram"),
      showHandoffButtons: false,
      handoffOptions: [],
    };
  }
}

// ============================================================================
// PATCH Mode Confirmation (Sprint 76)
// ============================================================================

/**
 * Invoke agent in PATCH mode after CEO confirmation.
 */
export async function handlePatchConfirm(
  agent: AgentRole,
  task: string,
  sendFn: TelegramSendFn
): Promise<AgentInvocationResult> {
  const log = createLogger("telegram-agent-handler");

  log.info("PATCH mode confirmed", { agent, task: task.slice(0, 50) });

  // Send "processing" indicator
  await sendFn(formatProcessing(agent, `PATCH: ${task}`), { parseMode: "Markdown" });

  // Invoke with PATCH mode
  try {
    return await invokeAgentWithMode(agent, task, "PATCH", log);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("PATCH invocation failed", { error: errorMsg, agent });

    return {
      success: false,
      error: errorMsg,
      formattedMessage: formatError(errorMsg, "telegram"),
      showHandoffButtons: false,
      handoffOptions: [],
    };
  }
}

/**
 * Invoke agent with explicit mode (READ or PATCH).
 */
async function invokeAgentWithMode(
  agent: AgentRole,
  task: string,
  mode: "READ" | "PATCH",
  log: Logger
): Promise<AgentInvocationResult> {
  const startTime = Date.now();

  const router = getAgentRouter();
  const workflow = getWorkflowEngine();
  const bridge = getClaudeCodeBridge();

  const routeResult = await router.route(`@${agent} ${task}`);
  if (!routeResult.success) {
    return {
      success: false,
      error: routeResult.error.message,
      formattedMessage: formatError(routeResult.error.message, "telegram"),
      showHandoffButtons: false,
      handoffOptions: [],
    };
  }

  const decision = routeResult.decision;
  log.info("Agent routed (PATCH mode)", { agent: decision.agent, mode });

  const workflowCtx = workflow.start(decision.agent, decision.message);
  workflow.startStep(workflowCtx.id);

  const ottTimeout = parseInt(process.env.ENDIORBOT_OTT_TIMEOUT ?? "300", 10) || 300;
  const invokeRequest: InvokeRequest = {
    mode,
    systemPrompt: decision.soul.content,
    userPrompt: decision.message,
    workspace: process.cwd(),
    agent: decision.agent,
    timeout: ottTimeout,
  };

  const bridgeResult = await bridge.invoke(invokeRequest);
  const durationMs = Date.now() - startTime;

  const parsed = parseResponse(bridgeResult.output);
  const firstHandoff = extractFirstHandoff(bridgeResult.output);

  workflow.completeStep(workflowCtx.id, bridgeResult.output);

  const agentResponse: AgentResponse = {
    agent: decision.agent,
    task,
    output: parsed.content,
    durationMs,
    patchApplied: mode === "PATCH",
  };

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

  const formatted = formatForTelegram(agentResponse);

  return {
    success: true,
    response: agentResponse,
    formattedMessage: formatted.text,
    showHandoffButtons: formatted.showHandoffButtons,
    handoffOptions: formatted.handoffOptions,
  };
}

// ============================================================================
// Message Router Integration
// ============================================================================

/**
 * Create a secure message handler for Telegram agent invocations.
 *
 * Wire this to TelegramChannel's onMessage handler.
 */
export function createTelegramAgentHandler(
  sendFn: TelegramSendFn
): (message: SanitizedChannelMessage) => Promise<void> {
  const log = createLogger("telegram-agent-handler");

  return async (message: SanitizedChannelMessage): Promise<void> => {
    // Skip blocked messages
    if (!message.allowed) {
      log.warn("Message blocked by security", {
        reason: message.blockReason,
        violations: message.violations,
      });
      return;
    }

    // Check for agent mention (with team registry for team support)
    if (!hasMention(message.sanitized, getTeamRegistry())) {
      // Not an agent command, ignore (or handle other commands)
      return;
    }

    // Handle agent mention
    const result = await handleAgentMention(message, sendFn);

    // Send response
    await sendFn(result.formattedMessage, {
      parseMode: "Markdown",
      // Keyboard handled separately via keyboards.ts
    });

    log.info("Agent invocation complete", {
      success: result.success,
      showHandoffs: result.showHandoffButtons,
    });
  };
}
