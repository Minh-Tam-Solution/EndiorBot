/**
 * OTT Response Formatter
 *
 * Formats agent responses for mobile OTT channels (Telegram, Zalo).
 * Optimizes output for mobile screens and messaging constraints.
 *
 * @module channels/ott/response-formatter
 * @version 1.0.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 57
 * @authority Master Plan v3.1
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { AgentRole, ParsedHandoff } from "../../agents/types/handoff.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Agent response structure for OTT formatting.
 */
export interface AgentResponse {
  /** Agent that executed */
  agent: AgentRole;
  /** Task description */
  task: string;
  /** Agent output text */
  output: string;
  /** Execution duration in ms */
  durationMs?: number;
  /** Parsed handoff if any */
  handoff?: ParsedHandoff;
  /** Whether patch was applied */
  patchApplied?: boolean;
  /** Error if execution failed */
  error?: string;
}

/**
 * Formatted OTT response.
 */
export interface FormattedOTTResponse {
  /** Formatted message text */
  text: string;
  /** Parse mode for Telegram (Markdown, HTML) */
  parseMode: "Markdown" | "HTML" | "plain";
  /** Whether to show handoff buttons */
  showHandoffButtons: boolean;
  /** Handoff options if any */
  handoffOptions: Array<{
    agent: AgentRole;
    intent: string;
    priority: string;
  }>;
}

/**
 * OTT channel type for formatting differences.
 */
export type OTTChannel = "telegram" | "zalo";

// ============================================================================
// Constants
// ============================================================================

/** Telegram message length limit */
const TELEGRAM_MAX_LENGTH = 4096;

/** Zalo message length limit */
const ZALO_MAX_LENGTH = 2000;

/** Agent icons for display */
const AGENT_ICONS: Record<string, string> = {
  researcher: "🔍",
  pm: "📋",
  pjm: "📊",
  architect: "🏗️",
  coder: "💻",
  reviewer: "👀",
  tester: "🧪",
  devops: "🚀",
  fullstack: "🛠️",
  assistant: "🤖",
  ceo: "👔",
  cpo: "🎯",
  cto: "⚙️",
};

// ============================================================================
// Formatter Functions
// ============================================================================

/**
 * Format agent role with icon.
 */
export function formatAgentName(role: AgentRole): string {
  const icon = AGENT_ICONS[role] ?? "🔹";
  return `${icon} @${role}`;
}

/**
 * Format duration for display.
 */
function formatDuration(ms: number | undefined): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Truncate text to fit mobile constraints.
 */
function truncateForMobile(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // Find a good break point
  const truncated = text.slice(0, maxLength - 50);
  const lastNewline = truncated.lastIndexOf("\n");
  const lastSpace = truncated.lastIndexOf(" ");

  const breakPoint = lastNewline > maxLength - 200
    ? lastNewline
    : lastSpace > maxLength - 100
      ? lastSpace
      : maxLength - 50;

  return text.slice(0, breakPoint) + "\n\n... (truncated for mobile)";
}

/**
 * Format agent response for Telegram.
 */
export function formatForTelegram(response: AgentResponse): FormattedOTTResponse {
  const parts: string[] = [];

  // Header
  parts.push(`${formatAgentName(response.agent)} completed`);

  // Duration
  if (response.durationMs) {
    parts.push(`⏱ ${formatDuration(response.durationMs)}`);
  }

  // Task summary
  parts.push("");
  parts.push(`📝 *Task:* ${response.task.slice(0, 100)}`);

  // Output
  parts.push("");
  if (response.error) {
    parts.push("❌ *Error:*");
    parts.push(`\`\`\`\n${response.error.slice(0, 500)}\n\`\`\``);
  } else {
    parts.push("*Response:*");
    // Truncate output for mobile
    const output = truncateForMobile(response.output, TELEGRAM_MAX_LENGTH - 500);
    parts.push(output);
  }

  // Patch status
  if (response.patchApplied !== undefined) {
    parts.push("");
    parts.push(response.patchApplied
      ? "✅ Patch applied successfully"
      : "⏸ Patch awaiting confirmation"
    );
  }

  // Handoff
  const handoffOptions: FormattedOTTResponse["handoffOptions"] = [];
  if (response.handoff) {
    parts.push("");
    parts.push(`🔄 *Handoff:* ${formatAgentName(response.handoff.to)}`);
    parts.push(`└ ${response.handoff.intent.slice(0, 100)}`);

    handoffOptions.push({
      agent: response.handoff.to,
      intent: response.handoff.intent,
      priority: response.handoff.priority,
    });
  }

  const text = parts.join("\n");

  return {
    text: truncateForMobile(text, TELEGRAM_MAX_LENGTH),
    parseMode: "Markdown",
    showHandoffButtons: handoffOptions.length > 0,
    handoffOptions,
  };
}

/**
 * Format agent response for Zalo.
 * Zalo has stricter limits and less formatting support.
 */
export function formatForZalo(response: AgentResponse): FormattedOTTResponse {
  const parts: string[] = [];

  // Header (simpler for Zalo)
  const icon = AGENT_ICONS[response.agent] ?? "🔹";
  parts.push(`${icon} @${response.agent} completed`);

  // Duration
  if (response.durationMs) {
    parts.push(`⏱ ${formatDuration(response.durationMs)}`);
  }

  // Task
  parts.push("");
  parts.push(`📝 Task: ${response.task.slice(0, 80)}`);

  // Output (more truncated for Zalo)
  parts.push("");
  if (response.error) {
    parts.push("❌ Error:");
    parts.push(response.error.slice(0, 300));
  } else {
    parts.push("Response:");
    // Zalo needs more truncation
    const output = truncateForMobile(response.output, ZALO_MAX_LENGTH - 300);
    parts.push(output);
  }

  // Patch status
  if (response.patchApplied !== undefined) {
    parts.push("");
    parts.push(response.patchApplied
      ? "✅ Patch applied"
      : "⏸ Patch pending"
    );
  }

  // Handoff
  const handoffOptions: FormattedOTTResponse["handoffOptions"] = [];
  if (response.handoff) {
    parts.push("");
    parts.push(`🔄 Handoff: @${response.handoff.to}`);
    parts.push(`Reply: [@${response.handoff.to}: continue]`);

    handoffOptions.push({
      agent: response.handoff.to,
      intent: response.handoff.intent,
      priority: response.handoff.priority,
    });
  }

  const text = parts.join("\n");

  return {
    text: truncateForMobile(text, ZALO_MAX_LENGTH),
    parseMode: "plain",
    showHandoffButtons: handoffOptions.length > 0,
    handoffOptions,
  };
}

/**
 * Format agent response for any OTT channel.
 */
export function formatForOTT(
  response: AgentResponse,
  channel: OTTChannel
): FormattedOTTResponse {
  switch (channel) {
    case "telegram":
      return formatForTelegram(response);
    case "zalo":
      return formatForZalo(response);
    default:
      return formatForTelegram(response);
  }
}

// ============================================================================
// Quick Response Formatters
// ============================================================================

/**
 * Format error message for OTT.
 */
export function formatError(error: string, channel: OTTChannel): string {
  const maxLength = channel === "telegram" ? TELEGRAM_MAX_LENGTH : ZALO_MAX_LENGTH;
  return `❌ Error: ${error.slice(0, maxLength - 20)}`;
}

/**
 * Format "processing" message.
 */
export function formatProcessing(agent: AgentRole, task: string): string {
  return `${formatAgentName(agent)} processing...\n📝 ${task.slice(0, 100)}`;
}

/**
 * All agent roles for display (assistant excluded — router, not user-facing).
 */
const ALL_AGENTS: AgentRole[] = [
  "researcher", "pm", "pjm", "architect", "coder", "reviewer",
  "tester", "devops", "fullstack", "ceo", "cpo", "cto",
];

/**
 * All team IDs for display.
 */
const ALL_TEAMS = ["fullstack", "planning", "design", "dev", "qa", "ops", "executive"];

/**
 * Format "agent not found" message.
 * Dynamically lists all 12 user-facing agents + 7 teams.
 */
export function formatAgentNotFound(_input: string): string {
  const agentList = ALL_AGENTS.map((a) => {
    const icon = AGENT_ICONS[a] ?? "🔹";
    return `${icon} @${a}`;
  }).join(", ");

  const teamList = ALL_TEAMS.map((t) => `@${t}`).join(", ");

  return `❓ Unknown agent or invalid format.

Use: @agent task  or  [@agent: task]
Example: @pm plan payment gateway

Agents: ${agentList}

Teams: ${teamList}
(Note: @fullstack works as both agent and team)`;
}

/**
 * Format confirmation request for patch.
 */
export function formatPatchConfirmation(
  agent: AgentRole,
  patchSummary: string,
  channel: OTTChannel
): string {
  const maxLength = channel === "telegram" ? 2000 : 1000;

  return `${formatAgentName(agent)} wants to apply a patch:

${patchSummary.slice(0, maxLength)}

Reply /approve to apply or /reject to cancel.`;
}

/**
 * Format handoff suggestion for OTT.
 */
export function formatHandoffSuggestion(
  from: AgentRole,
  to: AgentRole,
  intent: string,
  channel: OTTChannel
): string {
  const suggestion = `🔄 ${formatAgentName(from)} suggests handoff to ${formatAgentName(to)}

📝 ${intent.slice(0, 200)}`;

  if (channel === "telegram") {
    return suggestion + "\n\nUse the button below to continue.";
  } else {
    return suggestion + `\n\nReply: [@${to}: continue]`;
  }
}
