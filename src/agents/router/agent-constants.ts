/**
 * Agent Constants & Shared Helpers
 *
 * Extracted from channel-router.ts (Sprint 121 T3).
 * Both providers.ts and channel-router.ts import unidirectionally from here
 * to prevent circular dependencies (CTO C3).
 *
 * @module agents/router/agent-constants
 * @sprint 121 — Track 3
 */

import { getSoulLoader } from "../../bridge/intelligence/soul-loader.js";
import { resolveWorkspaceTier } from "../workspace-tier-resolver.js";

// ============================================================================
// Valid Agents
// ============================================================================

export const VALID_AGENTS = [
  "pm", "architect", "coder", "reviewer", "tester", "researcher",
  "devops", "fullstack", "pjm", "ceo", "cpo", "cto", "cso", "assistant",
] as const;

export type AgentName = (typeof VALID_AGENTS)[number];

// ============================================================================
// Provider-Aware Agent Model Routing (ADR-052)
// ============================================================================

/**
 * Provider identifiers for agent routing.
 * @since Sprint 140 — ADR-052 Agent-Model Tier Mapping
 */
export type AgentProviderId = "claude-code" | "kimi" | "openai" | "ollama";

/**
 * Per-agent model configuration with provider.
 */
export interface AgentModelConfig {
  /** Primary provider for this agent */
  provider: AgentProviderId;
  /** Model identifier (provider-specific) */
  model: string;
  /** Tier classification (for documentation) */
  tier: 1 | 2 | 3;
  /** Human-readable rationale */
  rationale?: string;
}

/**
 * Agent-Model Tier Mapping (ADR-052, amended Sprint 156).
 *
 * Two-tier strategy (CEO directive 2026-07-03):
 *   Tier 1 (claude-code/opus): Strategic + critical reasoning
 *   Tier 2 (kimi/kimi-code): Executor agents — CC Sonnet fallback on rate-limit
 *
 * Tier-specific fallback:
 *   Tier 1: CC Opus → Kimi → AI-Platform (last resort)
 *   Tier 2: Kimi Code → CC Sonnet → AI-Platform (last resort)
 *
 * @see docs/02-design/01-ADRs/ADR-052-agent-model-tier-mapping.md
 */
export const AGENT_PROVIDER_MODEL_MAP: Record<AgentName, AgentModelConfig> = {
  // ─── Tier 1: Claude Opus — Strategic + Critical Reasoning ───
  architect:   { provider: "claude-code", model: "opus",     tier: 1, rationale: "ADR writing, system design, G2 gate — deepest reasoning required" },
  cso:         { provider: "claude-code", model: "opus",     tier: 1, rationale: "Security review, threat modeling, ASVS L2 — must not compromise" },
  ceo:         { provider: "claude-code", model: "opus",     tier: 1, rationale: "Strategic decisions, Go/No-Go, resource allocation" },
  pm:          { provider: "claude-code", model: "opus",     tier: 1, rationale: "PRDs, requirements, G0 gate — high-quality output (CEO directive)" },
  cpo:         { provider: "claude-code", model: "opus",     tier: 1, rationale: "Product-market fit, validation — strategic advisory" },
  cto:         { provider: "claude-code", model: "opus",     tier: 1, rationale: "Architecture oversight, framework decisions — strategic advisory" },

  // ─── Tier 2: Kimi Code — Executor Agents (CC Sonnet fallback on rate-limit) ───
  coder:       { provider: "kimi",        model: "kimi-code",           tier: 2, rationale: "Code generation, TDD — Kimi primary, CC Sonnet on rate-limit" },
  reviewer:    { provider: "kimi",        model: "kimi-code",           tier: 2, rationale: "Code review, blast-radius — Kimi primary, CC Sonnet on rate-limit" },
  tester:      { provider: "kimi",        model: "kimi-code",           tier: 2, rationale: "Test plans, E2E, coverage — Kimi primary, CC Sonnet on rate-limit" },
  fullstack:   { provider: "kimi",        model: "kimi-code",           tier: 2, rationale: "Solo loop, all stages — Kimi primary, CC Sonnet on rate-limit" },
  pjm:         { provider: "kimi",        model: "kimi-code",           tier: 2, rationale: "Sprint planning, velocity — Kimi primary, CC Sonnet on rate-limit" },
  researcher:  { provider: "kimi",        model: "kimi-code",           tier: 2, rationale: "Evidence gathering, analysis — Kimi primary, CC Sonnet on rate-limit" },
  devops:      { provider: "kimi",        model: "kimi-code",           tier: 2, rationale: "Deploy scripts, runbooks — Kimi primary, CC Sonnet on rate-limit" },
  assistant:   { provider: "kimi",        model: "kimi-code",           tier: 2, rationale: "Routing, delegation tracking — Kimi primary, CC Sonnet on rate-limit" },
};

/**
 * Fallback chain per tier (ordered by preference).
 * @since Sprint 140 — ADR-052
 */
export const TIER_FALLBACK_CHAIN: Record<1 | 2, AgentProviderId[]> = {
  1: ["claude-code", "kimi", "ollama"],              // Tier 1: CC Opus → Kimi → AI-Platform
  2: ["kimi", "claude-code", "ollama"],              // Tier 2: Kimi → CC Sonnet → AI-Platform
};

// ============================================================================
// Legacy Tier-Aware Model Routing (Claude-only, preserved for backward compat)
// ============================================================================

/**
 * @deprecated Use AGENT_PROVIDER_MODEL_MAP instead. Kept for backward compatibility.
 */
export const TIER_AGENT_MODEL_MAP: Record<string, Record<string, string>> = {
  LITE: { assistant: "sonnet", coder: "sonnet", tester: "sonnet" },
  STANDARD: { pm: "opus", architect: "opus", reviewer: "sonnet" },
  PROFESSIONAL: { devops: "sonnet", fullstack: "sonnet", pjm: "sonnet", researcher: "sonnet", cso: "opus" },
  ENTERPRISE: { ceo: "opus", cto: "opus", cpo: "opus" },
};

/** Backward-compatible flat map — all agents (ENTERPRISE tier). */
export const AGENT_MODEL_MAP: Record<string, string> = Object.assign(
  {}, ...Object.values(TIER_AGENT_MODEL_MAP),
);

/**
 * Get the provider-model configuration for an agent (ADR-052).
 *
 * @param agent - Agent name (e.g., "pm", "coder")
 * @returns AgentModelConfig or undefined if agent unknown
 */
export function getAgentProviderModel(agent: string): AgentModelConfig | undefined {
  return AGENT_PROVIDER_MODEL_MAP[agent as AgentName];
}

/**
 * Get model for an agent at a specific tier.
 * Returns undefined if agent is not available at the requested tier (strict enforcement).
 *
 * @param agent - Agent name (e.g., "pm", "coder")
 * @param tier - Project tier (defaults to ENTERPRISE = all agents available)
 * @returns Model name or undefined if agent not available at tier
 * @deprecated Use getAgentProviderModel() for provider-aware routing.
 */
export function getAgentModel(agent: string, tier?: string): string | undefined {
  const tierOrder = ["LITE", "STANDARD", "PROFESSIONAL", "ENTERPRISE"];
  const targetTier = tier ?? "ENTERPRISE";
  const tierIdx = tierOrder.indexOf(targetTier);

  // Check tier restrictions first (strict enforcement)
  let agentAvailableAtTier = false;
  if (tierIdx < 0) {
    agentAvailableAtTier = agent in AGENT_MODEL_MAP; // unknown tier → flat map
  } else {
    for (let i = 0; i <= tierIdx; i++) {
      const tierKey = tierOrder[i]!;
      const tierAgents = TIER_AGENT_MODEL_MAP[tierKey];
      if (tierAgents && agent in tierAgents) {
        agentAvailableAtTier = true;
        break;
      }
    }
  }

  if (!agentAvailableAtTier) return undefined;

  // ADR-052: Return provider-aware model if agent is available at tier
  const providerConfig = getAgentProviderModel(agent);
  if (providerConfig) return providerConfig.model;

  // Fallback to legacy tier map
  if (tierIdx < 0) return AGENT_MODEL_MAP[agent];
  for (let i = 0; i <= tierIdx; i++) {
    const tierKey = tierOrder[i]!;
    const tierAgents = TIER_AGENT_MODEL_MAP[tierKey];
    if (tierAgents && agent in tierAgents) return tierAgents[agent];
  }
  return undefined;
}

/**
 * Get SOUL content for an agent.
 * Uses SoulLoader (SSOT) — loads from filesystem first, falls back to inline.
 * @deprecated Use getSoulLoader().load(agent) directly for full SoulLoadResult.
 */
export function getAgentSoul(agent: string): string {
  const result = getSoulLoader().load(agent);
  return result.content;
}

/**
 * @deprecated Use getAgentSoul() or getSoulLoader().load() instead.
 * Kept as computed property for backward compatibility with existing imports.
 */
export const AGENT_SOULS: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  {
    get(_target, prop: string): string {
      return getAgentSoul(prop);
    },
    has(_target, prop: string): boolean {
      return VALID_AGENTS.includes(prop as AgentName);
    },
  },
);

// ============================================================================
// Per-Agent Timeout Class (Sprint 137 B6)
// ============================================================================

/**
 * Timeout class per agent. Three tiers map to expected response cadence:
 *   - executor (60s): quick reads, status, light edits — coder, tester,
 *     devops, fullstack, pjm, researcher, assistant
 *   - advisory (180s): reasoning-heavy responses — pm, reviewer, ceo, cpo,
 *     cto, cso
 *   - adr-writer (600s): @architect specifically when producing ADRs or
 *     long architectural docs; the broad architect timeout sits here so the
 *     CLI doesn't get killed mid-spec.
 *
 * Override per-agent at runtime: ENDIORBOT_AGENT_TIMEOUT_<NAME>_MS
 * (e.g. ENDIORBOT_AGENT_TIMEOUT_ARCHITECT_MS=900000).
 *
 * Override per-class at runtime:
 *   ENDIORBOT_AGENT_TIMEOUT_EXECUTOR_MS
 *   ENDIORBOT_AGENT_TIMEOUT_ADVISORY_MS
 *   ENDIORBOT_AGENT_TIMEOUT_ADR_WRITER_MS
 *
 * Falls back to TIMEOUTS.claudeCode (envInt ENDIORBOT_CLAUDE_TIMEOUT_MS,
 * default 300_000 ms) when no agent / class override applies.
 */
export type AgentTimeoutClass = "executor" | "advisory" | "adr-writer";

export const AGENT_TIMEOUT_CLASS: Record<AgentName, AgentTimeoutClass> = {
  pm: "advisory",
  architect: "adr-writer",
  coder: "executor",
  reviewer: "advisory",
  tester: "executor",
  researcher: "executor",
  devops: "executor",
  fullstack: "executor",
  pjm: "executor",
  ceo: "advisory",
  cpo: "advisory",
  cto: "advisory",
  cso: "advisory",
  assistant: "executor",
};

const DEFAULT_AGENT_TIMEOUT_MS_BY_CLASS: Record<AgentTimeoutClass, number> = {
  // Sprint 143: bumped executor from 60s to 180s. CEO feedback: @coder
  // timeout "quá nhanh" — codebase reading takes 60-90s under load.
  // Advisory agents already at 180s; executors should match since they
  // also read before acting. Override per-agent via ENDIORBOT_AGENT_TIMEOUT_CODER_MS.
  executor: 180_000,
  advisory: 180_000,
  "adr-writer": 600_000,
};

function envIntLocal(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Resolve the timeout (in milliseconds) for an agent's Claude Code invocation.
 *
 * Resolution order (Sprint 137 B6):
 *   1. ENDIORBOT_AGENT_TIMEOUT_<AGENT>_MS (per-agent override)
 *   2. ENDIORBOT_AGENT_TIMEOUT_<CLASS>_MS (per-class override)
 *   3. AGENT_TIMEOUT_CLASS[agent] → DEFAULT_AGENT_TIMEOUT_MS_BY_CLASS
 *   4. TIMEOUTS.claudeCode (legacy global; passed via fallbackMs)
 *
 * @param agent — agent name (e.g. "coder", "architect")
 * @param fallbackMs — fallback when agent is unknown (typically TIMEOUTS.claudeCode)
 */
export function getAgentTimeoutMs(agent: string, fallbackMs: number): number {
  const upper = agent.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const perAgent = envIntLocal(`ENDIORBOT_AGENT_TIMEOUT_${upper}_MS`, NaN);
  if (Number.isFinite(perAgent)) return perAgent;

  const klass = AGENT_TIMEOUT_CLASS[agent as AgentName];
  if (!klass) return fallbackMs;

  const classKey = klass.toUpperCase().replace("-", "_");
  const perClass = envIntLocal(`ENDIORBOT_AGENT_TIMEOUT_${classKey}_MS`, NaN);
  if (Number.isFinite(perClass)) return perClass;

  return DEFAULT_AGENT_TIMEOUT_MS_BY_CLASS[klass];
}

// ============================================================================
// Conversation History
// ============================================================================

/**
 * Max tokens for conversation history injection.
 * Budget: 2K total per turn (CLAUDE.md) = soul (~300) + history (800) + context transfer (600) + overhead.
 */
const MAX_HISTORY_TOKENS = 800;

/** Rough token estimate: ~4 chars per token */
const CHARS_PER_TOKEN = 4;

/**
 * Format conversation history as context prefix for system prompt.
 * Truncates oldest turns first to fit within MAX_HISTORY_TOKENS.
 */
export function formatHistoryContext(
  history: Array<{ role: string; content: string }>,
): string {
  if (!history || history.length === 0) return "";

  const maxChars = MAX_HISTORY_TOKENS * CHARS_PER_TOKEN;
  const lines: string[] = [];
  let totalChars = 0;

  // Include newest turns first (reverse), then reverse back for chronological order
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (!turn) continue;
    const line = `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`;
    if (totalChars + line.length > maxChars) break;
    lines.unshift(line);
    totalChars += line.length;
  }

  if (lines.length === 0) return "";

  return `\n\n[Conversation History]\n${lines.join("\n")}\n[/Conversation History]`;
}

/**
 * Resolve the workspace tier for model selection.
 * Re-exported for convenience.
 */
export { resolveWorkspaceTier };
