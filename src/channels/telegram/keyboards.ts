/**
 * Telegram Inline Keyboards
 *
 * Creates inline keyboard markup for Telegram bot interactions.
 * Used for handoff buttons, confirmations, and quick actions.
 *
 * @module channels/telegram/keyboards
 * @version 2.0.0
 * @date 2026-03-04
 * @status ACTIVE - Sprint 76 (OTT Channel Enhancement)
 * @authority Master Plan v3.1
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { AgentRole, SE4ARole, SE4HRole } from "../../agents/types/handoff.js";
import type { TeamId } from "../../agents/types/team.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Telegram inline keyboard button.
 */
export interface InlineKeyboardButton {
  /** Button label */
  text: string;
  /** Callback data (for callback_query) */
  callback_data?: string;
  /** URL to open */
  url?: string;
}

/**
 * Telegram inline keyboard markup.
 */
export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

/**
 * Callback data prefix for parsing.
 */
export const CALLBACK_PREFIX = {
  HANDOFF: "handoff:",
  CONFIRM: "confirm:",
  REJECT: "reject:",
  CANCEL: "cancel:",
  AGENT_SELECT: "agent:",
  TEAM_SELECT: "team:",
  MODE: "mode:",
  // Sprint 85 — Permission Approval
  PERMISSION: "perm:",
  // Sprint 90 — Complexity Gate
  COMPLEXITY: "cplx:",
  // Sprint 91 — Team Cost Threshold
  TEAM_COST: "tcost:",
} as const;

// ============================================================================
// Keyboard Builders
// ============================================================================

/**
 * Create handoff inline keyboard.
 *
 * Shows buttons to continue to suggested agents.
 */
export function createHandoffKeyboard(
  handoffs: Array<{
    agent: AgentRole;
    intent: string;
    priority: string;
  }>
): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[][] = [];

  // Add handoff buttons (one per row for better visibility on mobile)
  for (const handoff of handoffs) {
    const icon = getAgentIcon(handoff.agent);
    const priorityTag = handoff.priority === "HIGH" ? "⚡" : "";

    buttons.push([
      {
        text: `${icon} Continue to @${handoff.agent} ${priorityTag}`,
        callback_data: `${CALLBACK_PREFIX.HANDOFF}${handoff.agent}:${encodeIntent(handoff.intent)}`,
      },
    ]);
  }

  // Add cancel button
  buttons.push([
    {
      text: "❌ Cancel Workflow",
      callback_data: `${CALLBACK_PREFIX.CANCEL}workflow`,
    },
  ]);

  return { inline_keyboard: buttons };
}

/**
 * Create confirmation keyboard for patch application.
 */
export function createPatchConfirmKeyboard(
  patchId: string
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "✅ Apply Patch",
          callback_data: `${CALLBACK_PREFIX.CONFIRM}${patchId}`,
        },
        {
          text: "❌ Reject",
          callback_data: `${CALLBACK_PREFIX.REJECT}${patchId}`,
        },
      ],
    ],
  };
}

/**
 * SE4A executor agents (9) — available at all tiers.
 */
const SE4A_AGENTS: SE4ARole[] = [
  "researcher", "pm", "pjm",
  "architect", "coder", "reviewer",
  "tester", "devops", "fullstack",
];

/**
 * SE4H advisor agents (3) — available at STANDARD+ tier.
 */
const SE4H_AGENTS: SE4HRole[] = ["ceo", "cpo", "cto"];

/**
 * Teams available per tier (from tier config JSON).
 */
const TIER_TEAMS: Record<string, TeamId[]> = {
  LITE: ["fullstack"],
  STANDARD: ["planning", "dev", "qa"],
  PROFESSIONAL: ["planning", "design", "dev", "qa", "executive"],
  ENTERPRISE: ["planning", "design", "dev", "qa", "ops", "executive"],
};

/**
 * Team display icons.
 */
const TEAM_ICONS: Record<TeamId, string> = {
  fullstack: "🛠️",
  planning: "📋",
  design: "🎨",
  dev: "💻",
  qa: "🧪",
  ops: "🚀",
  executive: "👔",
};

/**
 * Create tier-aware agent selection keyboard.
 *
 * Shows 12 agents (assistant excluded — router, not user-facing):
 * - SE4A row (9): 3 per row for mobile readability
 * - SE4H row (3): STANDARD+ tier only
 *
 * @param tier - Project tier (defaults to "STANDARD")
 */
export function createAgentSelectionKeyboard(
  tier?: "LITE" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE",
): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[][] = [];

  // SE4A agents: 3 per row
  for (let i = 0; i < SE4A_AGENTS.length; i += 3) {
    const row: InlineKeyboardButton[] = [];
    for (let j = 0; j < 3 && i + j < SE4A_AGENTS.length; j++) {
      const agent = SE4A_AGENTS[i + j]!;
      row.push({
        text: `${getAgentIcon(agent)} @${agent}`,
        callback_data: `${CALLBACK_PREFIX.AGENT_SELECT}${agent}:start`,
      });
    }
    buttons.push(row);
  }

  // SE4H agents: STANDARD+ tier only (all 3 in one row)
  const effectiveTier = tier ?? "STANDARD";
  if (effectiveTier !== "LITE") {
    const row: InlineKeyboardButton[] = SE4H_AGENTS.map((agent) => ({
      text: `${getAgentIcon(agent)} @${agent}`,
      callback_data: `${CALLBACK_PREFIX.AGENT_SELECT}${agent}:start`,
    }));
    buttons.push(row);
  }

  return { inline_keyboard: buttons };
}

/**
 * Create tier-aware team selection keyboard.
 *
 * Shows teams appropriate for the project tier:
 * - LITE: fullstack only
 * - STANDARD: planning, dev, qa
 * - PROFESSIONAL: + design, executive
 * - ENTERPRISE: + ops
 *
 * @param tier - Project tier (defaults to "STANDARD")
 */
export function createTeamSelectionKeyboard(
  tier?: "LITE" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE",
): InlineKeyboardMarkup {
  const effectiveTier = tier ?? "STANDARD";
  const teams = TIER_TEAMS[effectiveTier] ?? TIER_TEAMS["STANDARD"]!;

  const buttons: InlineKeyboardButton[][] = [];

  // 2 teams per row for readability
  for (let i = 0; i < teams.length; i += 2) {
    const row: InlineKeyboardButton[] = [];
    for (let j = 0; j < 2 && i + j < teams.length; j++) {
      const team = teams[i + j]!;
      const icon = TEAM_ICONS[team] ?? "🔹";
      row.push({
        text: `${icon} @${team}`,
        callback_data: `${CALLBACK_PREFIX.TEAM_SELECT}${team}:start`,
      });
    }
    buttons.push(row);
  }

  return { inline_keyboard: buttons };
}

/**
 * Create mode escalation confirmation keyboard.
 *
 * Used when CEO requests PATCH mode via OTT.
 * Two-step confirm: CEO must explicitly approve before PATCH invocation.
 */
export function createModeConfirmKeyboard(
  requestId: string,
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "✅ Confirm PATCH",
          callback_data: `${CALLBACK_PREFIX.MODE}confirm:${requestId}`,
        },
        {
          text: "❌ Cancel",
          callback_data: `${CALLBACK_PREFIX.MODE}cancel:${requestId}`,
        },
      ],
    ],
  };
}

/**
 * Create yes/no confirmation keyboard.
 */
export function createYesNoKeyboard(
  actionId: string
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "✅ Yes",
          callback_data: `${CALLBACK_PREFIX.CONFIRM}${actionId}`,
        },
        {
          text: "❌ No",
          callback_data: `${CALLBACK_PREFIX.REJECT}${actionId}`,
        },
      ],
    ],
  };
}

/**
 * Create permission approval keyboard (Sprint 85).
 *
 * Shows Approve / Deny inline buttons for a hook permission request.
 */
export function createPermissionKeyboard(
  permissionId: string,
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "✅ Approve",
          callback_data: `${CALLBACK_PREFIX.PERMISSION}approve:${permissionId}`,
        },
        {
          text: "❌ Deny",
          callback_data: `${CALLBACK_PREFIX.PERMISSION}deny:${permissionId}`,
        },
      ],
    ],
  };
}

/**
 * Create complexity gate keyboard (Sprint 90).
 *
 * Shows team/solo choice when a task is flagged as potentially too simple
 * for team mode (3x token cost).
 */
export function createComplexityGateKeyboard(
  gateId: string,
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "✅ Yes, use team mode",
          callback_data: `${CALLBACK_PREFIX.COMPLEXITY}team:${gateId}`,
        },
        {
          text: "🔄 Switch to solo",
          callback_data: `${CALLBACK_PREFIX.COMPLEXITY}solo:${gateId}`,
        },
      ],
    ],
  };
}

/**
 * Create team cost threshold keyboard (Sprint 91).
 *
 * Shows Continue (+$2) / Stop team when team cost exceeds threshold.
 */
export function createTeamCostKeyboard(
  teamId: string,
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "➕ Continue (+$2 limit)",
          callback_data: `${CALLBACK_PREFIX.TEAM_COST}extend:${teamId}`,
        },
        {
          text: "🛑 Stop team",
          callback_data: `${CALLBACK_PREFIX.TEAM_COST}stop:${teamId}`,
        },
      ],
    ],
  };
}

/**
 * Create workflow status keyboard with actions.
 */
export function createWorkflowKeyboard(
  workflowId: string,
  hasHandoff: boolean
): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[][] = [];

  if (hasHandoff) {
    buttons.push([
      {
        text: "🔄 Continue Handoff",
        callback_data: `${CALLBACK_PREFIX.HANDOFF}continue:${workflowId}`,
      },
    ]);
  }

  buttons.push([
    {
      text: "📊 View Status",
      callback_data: `status:${workflowId}`,
    },
    {
      text: "❌ Cancel",
      callback_data: `${CALLBACK_PREFIX.CANCEL}${workflowId}`,
    },
  ]);

  return { inline_keyboard: buttons };
}

// ============================================================================
// Callback Data Parser
// ============================================================================

/**
 * Parsed callback data.
 */
export interface ParsedCallback {
  /** Action type */
  action: "handoff" | "confirm" | "reject" | "cancel" | "status" | "agent_select" | "team_select" | "mode" | "permission" | "complexity_gate" | "team_cost" | "unknown";
  /** Target (agent, patchId, workflowId, teamId) */
  target: string;
  /** Additional data (intent, etc.) */
  data?: string;
}

/**
 * Parse callback data from button press.
 */
export function parseCallbackData(callbackData: string): ParsedCallback {
  // Handoff format: handoff:agent:intent
  if (callbackData.startsWith(CALLBACK_PREFIX.HANDOFF)) {
    const parts = callbackData.slice(CALLBACK_PREFIX.HANDOFF.length).split(":");
    const result: ParsedCallback = {
      action: "handoff",
      target: parts[0] ?? "",
    };
    if (parts[1]) {
      result.data = decodeIntent(parts[1]);
    }
    return result;
  }

  // Confirm format: confirm:id
  if (callbackData.startsWith(CALLBACK_PREFIX.CONFIRM)) {
    return {
      action: "confirm",
      target: callbackData.slice(CALLBACK_PREFIX.CONFIRM.length),
    };
  }

  // Reject format: reject:id
  if (callbackData.startsWith(CALLBACK_PREFIX.REJECT)) {
    return {
      action: "reject",
      target: callbackData.slice(CALLBACK_PREFIX.REJECT.length),
    };
  }

  // Cancel format: cancel:id
  if (callbackData.startsWith(CALLBACK_PREFIX.CANCEL)) {
    return {
      action: "cancel",
      target: callbackData.slice(CALLBACK_PREFIX.CANCEL.length),
    };
  }

  // Agent select format: agent:role:data
  if (callbackData.startsWith(CALLBACK_PREFIX.AGENT_SELECT)) {
    const parts = callbackData.slice(CALLBACK_PREFIX.AGENT_SELECT.length).split(":");
    const result: ParsedCallback = {
      action: "agent_select",
      target: parts[0] ?? "",
    };
    if (parts[1]) {
      result.data = parts[1];
    }
    return result;
  }

  // Team select format: team:teamId:data
  if (callbackData.startsWith(CALLBACK_PREFIX.TEAM_SELECT)) {
    const parts = callbackData.slice(CALLBACK_PREFIX.TEAM_SELECT.length).split(":");
    const result: ParsedCallback = {
      action: "team_select",
      target: parts[0] ?? "",
    };
    if (parts[1]) {
      result.data = parts[1];
    }
    return result;
  }

  // Mode format: mode:action:requestId
  if (callbackData.startsWith(CALLBACK_PREFIX.MODE)) {
    const parts = callbackData.slice(CALLBACK_PREFIX.MODE.length).split(":");
    const result: ParsedCallback = {
      action: "mode",
      target: parts[0] ?? "",
    };
    if (parts[1]) {
      result.data = parts[1];
    }
    return result;
  }

  // Permission format: perm:approve:permId or perm:deny:permId
  if (callbackData.startsWith(CALLBACK_PREFIX.PERMISSION)) {
    const parts = callbackData.slice(CALLBACK_PREFIX.PERMISSION.length).split(":");
    const target = parts[0] ?? "";
    const data = parts[1] ?? "";
    // MF-5: Validate non-empty permissionId — reject malformed callbacks
    if (!data || !target) {
      return { action: "unknown", target: callbackData };
    }
    return {
      action: "permission",
      target, // "approve" or "deny"
      data,   // permissionId
    };
  }

  // Complexity gate format: cplx:team:gateId or cplx:solo:gateId
  if (callbackData.startsWith(CALLBACK_PREFIX.COMPLEXITY)) {
    const parts = callbackData.slice(CALLBACK_PREFIX.COMPLEXITY.length).split(":");
    const target = parts[0] ?? ""; // "team" or "solo"
    const data = parts[1] ?? "";   // gateId
    if (!data || !target) {
      return { action: "unknown", target: callbackData };
    }
    return {
      action: "complexity_gate",
      target, // "team" or "solo"
      data,   // gateId
    };
  }

  // Team cost format: tcost:extend:teamId or tcost:stop:teamId
  if (callbackData.startsWith(CALLBACK_PREFIX.TEAM_COST)) {
    const parts = callbackData.slice(CALLBACK_PREFIX.TEAM_COST.length).split(":");
    const target = parts[0] ?? ""; // "extend" or "stop"
    const data = parts[1] ?? "";   // teamId
    if (!data || !target) {
      return { action: "unknown", target: callbackData };
    }
    return {
      action: "team_cost",
      target, // "extend" or "stop"
      data,   // teamId
    };
  }

  // Status format: status:id
  if (callbackData.startsWith("status:")) {
    return {
      action: "status",
      target: callbackData.slice(7),
    };
  }

  return {
    action: "unknown",
    target: callbackData,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Encode intent for callback data (limited to 64 bytes in Telegram).
 */
function encodeIntent(intent: string): string {
  // B3 fix: truncate to 25 raw chars to stay within Telegram 64-byte callback_data limit
  // Calculation: "handoff:" (8) + agent (10 max) + ":" (1) + base64(25 chars = ~36 chars) = ~55 bytes < 64
  const truncated = intent.slice(0, 25);
  return Buffer.from(truncated).toString("base64").replace(/=/g, "");
}

/**
 * Decode intent from callback data.
 */
function decodeIntent(encoded: string): string {
  try {
    // Pad base64 if needed
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    return Buffer.from(padded, "base64").toString("utf-8");
  } catch {
    return encoded;
  }
}

/**
 * Get agent icon.
 */
export function getAgentIcon(agent: AgentRole): string {
  const icons: Record<string, string> = {
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
  return icons[agent] ?? "🔹";
}
