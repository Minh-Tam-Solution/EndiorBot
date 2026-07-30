/**
 * Team Monitor — On-demand team session health + cost tracking.
 *
 * Sprint 91 (ADR-026): Pure functions with injected dependencies.
 * No background polling — health is checked inline during /team-status.
 * Cost estimation is duration-based (tokens/minute heuristic).
 *
 * @module bridge/teams/team-monitor
 * @version 1.0.0
 * @authority ADR-026 (Sprint 91)
 */

import type { BridgeSession, BridgePolicy } from "../types.js";
import type { SessionRegistry } from "../session-registry.js";
import type { TmuxBridge } from "../tmux/tmux-bridge.js";
import type { PricingRegistry } from "../../budget/pricing-registry.js";
import { TEAM_LEADER_ROLES } from "../intelligence/team-installer.js";
import type { TeamId } from "../../agents/types/team.js";
import { SONNET } from "../../config/models.js";

// ============================================================================
// Types
// ============================================================================

export type TeamMemberHealth = "alive" | "stuck" | "crashed";

export interface TeamMemberStatus {
  sessionId: string;
  agentRole: string;
  health: TeamMemberHealth;
  estimatedCostUsd: number;
  idleSeconds: number;
  isLeader: boolean;
}

export interface TeamStatus {
  teamId: string;
  members: TeamMemberStatus[];
  totalCostUsd: number;
  thresholdUsd: number;
  thresholdExceeded: boolean;
}

export interface TeamStatusDeps {
  registry: SessionRegistry;
  tmux: TmuxBridge;
  policy: BridgePolicy;
  pricingRegistry: PricingRegistry;
  thresholdOverride?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Estimated token throughput per minute for cost calculation. */
export const ESTIMATED_TOKENS_PER_MINUTE = {
  input: 500,
  output: 200,
} as const;

/** Default model for cost estimation. */
const DEFAULT_COST_MODEL = SONNET;

// ============================================================================
// Functions
// ============================================================================

/**
 * Get all active sessions for a team.
 */
export function getTeamSessions(
  teamId: string,
  registry: SessionRegistry,
): BridgeSession[] {
  return registry.getActive().filter((s) => s.teamId === teamId);
}

/**
 * Check health of a single team member session.
 *
 * - alive: pane responding, idle < threshold
 * - stuck: pane exists but idle > threshold
 * - crashed: pane gone (capturePane throws)
 */
export async function checkMemberHealth(
  session: BridgeSession,
  tmux: TmuxBridge,
  stuckThresholdSec: number,
): Promise<{ health: TeamMemberHealth; idleSeconds: number }> {
  try {
    await tmux.capturePane(session.tmuxTarget, 5);
  } catch {
    return { health: "crashed", idleSeconds: 0 };
  }

  const now = Date.now();
  const lastActivity = new Date(session.lastActivityAt).getTime();
  const idleSeconds = Math.floor((now - lastActivity) / 1000);

  if (idleSeconds > stuckThresholdSec) {
    return { health: "stuck", idleSeconds };
  }

  return { health: "alive", idleSeconds };
}

/**
 * Estimate session cost based on duration and model pricing.
 *
 * Uses a heuristic of ESTIMATED_TOKENS_PER_MINUTE * session duration.
 * This is a rough estimate — actual cost depends on real token usage.
 */
export function estimateSessionCost(
  session: BridgeSession,
  pricingRegistry: PricingRegistry,
): number {
  const now = Date.now();
  const created = new Date(session.createdAt).getTime();
  const durationMinutes = Math.max(0, (now - created) / 60_000);

  const inputTokens = Math.round(
    durationMinutes * ESTIMATED_TOKENS_PER_MINUTE.input,
  );
  const outputTokens = Math.round(
    durationMinutes * ESTIMATED_TOKENS_PER_MINUTE.output,
  );

  return pricingRegistry.calculateCost(
    DEFAULT_COST_MODEL,
    inputTokens,
    outputTokens,
  );
}

/**
 * Get full team status with health checks and cost estimation.
 */
export async function getTeamStatus(
  teamId: string,
  deps: TeamStatusDeps,
): Promise<TeamStatus> {
  const sessions = getTeamSessions(teamId, deps.registry);
  const leaderRole = TEAM_LEADER_ROLES[teamId as TeamId];

  const members: TeamMemberStatus[] = [];
  let totalCostUsd = 0;

  for (const session of sessions) {
    const { health, idleSeconds } = await checkMemberHealth(
      session,
      deps.tmux,
      deps.policy.teamStuckIdleThresholdSec,
    );

    const estimatedCostUsd = estimateSessionCost(
      session,
      deps.pricingRegistry,
    );
    totalCostUsd += estimatedCostUsd;

    const isLeader =
      leaderRole !== undefined && session.agentRole === leaderRole;

    members.push({
      sessionId: session.id,
      agentRole: session.agentRole ?? session.agentType,
      health,
      estimatedCostUsd,
      idleSeconds,
      isLeader,
    });
  }

  // Sort: leader first, then alphabetical
  members.sort((a, b) => {
    if (a.isLeader && !b.isLeader) return -1;
    if (!a.isLeader && b.isLeader) return 1;
    return a.agentRole.localeCompare(b.agentRole);
  });

  const thresholdUsd =
    deps.thresholdOverride ?? deps.policy.teamCostThresholdUsd;

  return {
    teamId,
    members,
    totalCostUsd,
    thresholdUsd,
    thresholdExceeded: totalCostUsd > thresholdUsd,
  };
}

/**
 * Format team status as Telegram Markdown dashboard.
 */
export function formatTeamDashboard(status: TeamStatus): string {
  const lines: string[] = [];

  lines.push(`📊 *Team Status* — ${status.teamId}-team`);
  lines.push("");

  for (const m of status.members) {
    const roleLabel = m.isLeader ? `@${m.agentRole} (leader)` : `@${m.agentRole}`;
    const healthIcon =
      m.health === "alive" ? "🟢" : m.health === "stuck" ? "🟡" : "🔴";
    const costStr = `est. $${m.estimatedCostUsd.toFixed(2)}`;

    let line = `  ${healthIcon} ${roleLabel}  ${m.health}  ${costStr}`;
    if (m.health === "stuck" && m.idleSeconds > 0) {
      line += ` (idle ${formatIdleTime(m.idleSeconds)})`;
    }
    lines.push(line);
  }

  lines.push("");
  const thresholdStr = status.thresholdExceeded ? "⚠️ EXCEEDED" : "";
  lines.push(
    `Total: est. $${status.totalCostUsd.toFixed(2)} / $${status.thresholdUsd.toFixed(2)} limit ${thresholdStr}`.trim(),
  );

  if (status.members.length === 0) {
    return `📊 *Team Status* — ${status.teamId}-team\n\nNo active team members found.`;
  }

  return lines.join("\n");
}

// ============================================================================
// Helpers
// ============================================================================

function formatIdleTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
