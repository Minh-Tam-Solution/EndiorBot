/**
 * AER Metrics Types
 *
 * Types for Agent Effectiveness Rating metrics calculation.
 * Measures autonomous agent performance.
 *
 * @module metrics/types
 * @version 1.0.0
 * @date 2026-03-02
 * @status ACTIVE - Sprint 72
 * @authority Master Plan v4.3, Sprint 72 T12.1
 * @sprint 72
 */

import {
  OPUS, SONNET, FABLE, HAIKU,
  KIMI_K3, KIMI_K3_256K, KIMI_FOR_CODING, MOONSHOT_K2_7_CODE,
  LEGACY_OPUS, LEGACY_SONNET, MODEL_CAPABILITIES,
} from "../config/models.js";

// ============================================================================
// Core Metrics
// ============================================================================

/**
 * Agent Effectiveness Rating metrics.
 *
 * Core metrics for measuring autonomous agent performance:
 * - Autonomy Time: Minutes between escalations
 * - TCR: Task Completion Rate (% without intervention)
 * - RR: Recovery Rate (% failures self-healed)
 * - Tool Choice Accuracy: % correct tool selections
 * - Cost per Task: Total cost / tasks completed
 */
export interface AERMetrics {
  // ========== Primary Metrics ==========

  /** Autonomy time: average minutes between escalations */
  autonomyTime: number;

  /** Task completion rate: % tasks done without intervention (0-1) */
  taskCompletionRate: number;

  /** Recovery rate: % failures self-healed (0-1) */
  recoveryRate: number;

  /** Tool choice accuracy: % correct tool selections (0-1) */
  toolChoiceAccuracy: number;

  /** Cost per task: totalCost / completedTasks (USD) */
  costPerTask: number;

  // ========== Breakdown ==========

  /** Total tasks started */
  totalTasks: number;

  /** Tasks completed without intervention */
  completedTasks: number;

  /** Tasks that failed permanently */
  failedTasks: number;

  /** Number of human escalations */
  escalations: number;

  /** Number of successful recoveries */
  recoveries: number;

  /** Total failures encountered */
  totalFailures: number;

  /** Total cost in USD */
  totalCost: number;

  /** Session duration in minutes */
  sessionDuration: number;

  // ========== Tool Usage ==========

  /** Total tool calls made */
  totalToolCalls: number;

  /** Tool calls that were correct for the task */
  correctToolCalls: number;

  // ========== Model Usage ==========

  /** Model usage breakdown */
  modelUsage: ModelUsageBreakdown;
}

/**
 * Model usage breakdown by tier.
 */
export interface ModelUsageBreakdown {
  /** Opus usage */
  opus: ModelTierUsage;

  /** Sonnet usage */
  sonnet: ModelTierUsage;

  /** Haiku usage */
  haiku: ModelTierUsage;

  /** Fable usage */
  fable: ModelTierUsage;
}

/**
 * Usage for a single model tier.
 */
export interface ModelTierUsage {
  /** Number of calls */
  calls: number;

  /** Total tokens used (input + output) */
  tokens: number;

  /** Total cost in USD */
  cost: number;

  /** Total time in seconds */
  timeSeconds: number;
}

// ============================================================================
// Event Log Entry (Extended)
// ============================================================================

/**
 * Event log entry for AER calculation.
 * Extends existing EventLog with additional fields.
 */
export interface AEREventLogEntry {
  /** Event timestamp (ISO 8601) */
  timestamp: string;

  /** Event type */
  type: AEREventType;

  /** Model used (if applicable) */
  model?: string;

  /** Input tokens (if model call) */
  inputTokens?: number;

  /** Output tokens (if model call) */
  outputTokens?: number;

  /** Cost in USD (if model call) */
  cost?: number;

  /** Duration in seconds (if applicable) */
  durationSeconds?: number;

  /** Tool name (if tool call) */
  tool?: string;

  /** Whether tool choice was correct (if tool call) */
  wasCorrect?: boolean;

  /** Whether this had human intervention */
  hadIntervention?: boolean;

  /** Whether recovery was successful (if failure) */
  recovered?: boolean;

  /** Task ID (if task-related) */
  taskId?: string;

  /** Stage ID (if stage-related) */
  stageId?: string;

  /** Additional context */
  context?: Record<string, string>;
}

/**
 * Event types for AER calculation.
 */
export type AEREventType =
  | "task_start"
  | "task_complete"
  | "task_failed"
  | "model_call"
  | "tool_call"
  | "failure"
  | "recovery"
  | "escalation"
  | "checkpoint"
  | "stage_complete";

// ============================================================================
// Retrieval Log Entry
// ============================================================================

/**
 * Retrieval log entry for AER calculation.
 * From retrieval-log.jsonl.
 */
export interface AERRetrievalLogEntry {
  /** Timestamp */
  timestamp: string;

  /** Search query */
  query: string;

  /** Provider used */
  provider: string;

  /** Elapsed time in ms */
  elapsed_ms: number;

  /** Total hits found */
  totalHits: number;

  /** Whether tool choice was correct for this query */
  wasCorrect?: boolean;

  /** Search context */
  context?: {
    stage?: string;
    role?: string;
  };
}

// ============================================================================
// Calculator Config
// ============================================================================

/**
 * AER Calculator configuration.
 */
export interface AERCalculatorConfig {
  /** Path to events log directory */
  eventsDir: string;

  /** Path to retrieval log directory */
  retrievalDir: string;

  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default calculator configuration.
 */
export const DEFAULT_AER_CONFIG: AERCalculatorConfig = {
  eventsDir: ".endiorbot/events",
  retrievalDir: ".endiorbot/evidence",
  debug: false,
};

// ============================================================================
// Targets
// ============================================================================

/**
 * AER target thresholds for v2.0 Autonomy.
 */
export interface AERTargets {
  /** Minimum autonomy time in minutes */
  autonomyTimeMin: number;

  /** Minimum task completion rate (0-1) */
  taskCompletionRateMin: number;

  /** Minimum recovery rate (0-1) */
  recoveryRateMin: number;

  /** Minimum tool choice accuracy (0-1) */
  toolChoiceAccuracyMin: number;

  /** Maximum cost per task in USD */
  costPerTaskMax: number;

  /** Maximum escalations per 2h session */
  escalationsMax: number;
}

/**
 * Default AER targets from Sprint 72 spec.
 */
export const DEFAULT_AER_TARGETS: AERTargets = {
  autonomyTimeMin: 30,      // ≥30min between escalations
  taskCompletionRateMin: 0.7, // ≥70% tasks without intervention
  recoveryRateMin: 0.8,     // ≥80% failures self-healed
  toolChoiceAccuracyMin: 0.85, // ≥85% correct tool selections
  costPerTaskMax: 1.0,      // <$1 per task
  escalationsMax: 3,        // <3 escalations in 2h
};

// ============================================================================
// Result Types
// ============================================================================

/**
 * AER evaluation result with pass/fail status.
 */
export interface AERResult {
  /** Calculated metrics */
  metrics: AERMetrics;

  /** Target thresholds used */
  targets: AERTargets;

  /** Overall pass status */
  passed: boolean;

  /** Individual metric pass status */
  metricStatus: AERMetricStatus;

  /** Session ID */
  sessionId: string;

  /** Calculation timestamp */
  calculatedAt: string;
}

/**
 * Individual metric pass status.
 */
export interface AERMetricStatus {
  autonomyTime: boolean;
  taskCompletionRate: boolean;
  recoveryRate: boolean;
  toolChoiceAccuracy: boolean;
  costPerTask: boolean;
}

/**
 * Check if all metrics pass.
 */
export function checkAERPass(metrics: AERMetrics, targets: AERTargets): AERMetricStatus {
  return {
    autonomyTime: metrics.autonomyTime >= targets.autonomyTimeMin,
    taskCompletionRate: metrics.taskCompletionRate >= targets.taskCompletionRateMin,
    recoveryRate: metrics.recoveryRate >= targets.recoveryRateMin,
    toolChoiceAccuracy: metrics.toolChoiceAccuracy >= targets.toolChoiceAccuracyMin,
    costPerTask: metrics.costPerTask <= targets.costPerTaskMax,
  };
}

/**
 * Check if overall AER passes.
 */
export function isAERPassing(status: AERMetricStatus): boolean {
  return (
    status.autonomyTime &&
    status.taskCompletionRate &&
    status.recoveryRate &&
    status.toolChoiceAccuracy &&
    status.costPerTask
  );
}

// ============================================================================
// Model Pricing
// ============================================================================

/**
 * Model pricing per 1M tokens (as of 2026).
 */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

/**
 * Known model pricing (per 1M tokens).
 *
 * Current = Claude 5 family + Kimi K3. Legacy IDs kept so historical
 * sessions/checkpoints still price correctly.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Current — resolved through the SSOT capability registry (models.ts)
  [OPUS]: { inputPer1M: MODEL_CAPABILITIES[OPUS]!.inputPer1M, outputPer1M: MODEL_CAPABILITIES[OPUS]!.outputPer1M },
  [SONNET]: { inputPer1M: MODEL_CAPABILITIES[SONNET]!.inputPer1M, outputPer1M: MODEL_CAPABILITIES[SONNET]!.outputPer1M },
  [FABLE]: { inputPer1M: MODEL_CAPABILITIES[FABLE]!.inputPer1M, outputPer1M: MODEL_CAPABILITIES[FABLE]!.outputPer1M },
  [HAIKU]: { inputPer1M: MODEL_CAPABILITIES[HAIKU]!.inputPer1M, outputPer1M: MODEL_CAPABILITIES[HAIKU]!.outputPer1M },
  [KIMI_K3]: { inputPer1M: MODEL_CAPABILITIES[KIMI_K3]!.inputPer1M, outputPer1M: MODEL_CAPABILITIES[KIMI_K3]!.outputPer1M },
  [KIMI_K3_256K]: { inputPer1M: MODEL_CAPABILITIES[KIMI_K3_256K]!.inputPer1M, outputPer1M: MODEL_CAPABILITIES[KIMI_K3_256K]!.outputPer1M },
  [KIMI_FOR_CODING]: { inputPer1M: MODEL_CAPABILITIES[KIMI_FOR_CODING]!.inputPer1M, outputPer1M: MODEL_CAPABILITIES[KIMI_FOR_CODING]!.outputPer1M },
  [MOONSHOT_K2_7_CODE]: { inputPer1M: MODEL_CAPABILITIES[MOONSHOT_K2_7_CODE]!.inputPer1M, outputPer1M: MODEL_CAPABILITIES[MOONSHOT_K2_7_CODE]!.outputPer1M },
  // Legacy (backward compat for historical sessions — dated IDs only)
  [LEGACY_OPUS]: { inputPer1M: 15.0, outputPer1M: 75.0 },
  [LEGACY_SONNET]: { inputPer1M: 3.0, outputPer1M: 15.0 },
};

/**
 * Conservative proxy for UNPRICED models — highest known tier.
 *
 * CEO directive: $0 for unpriced = budget-guard NEVER fires (budget blind).
 * Over-estimate instead so the guard trips early rather than never.
 */
const CONSERVATIVE_PROXY_PRICING: ModelPricing = { inputPer1M: 10.0, outputPer1M: 50.0 };

/**
 * Calculate cost for a model call.
 */
export function calculateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? CONSERVATIVE_PROXY_PRICING;
  if (!MODEL_PRICING[model]) {
    // Loud, not silent — unpriced model uses over-estimate proxy.
    console.warn(
      `[metrics] No pricing for model "${model}" — using conservative proxy ` +
        `($${CONSERVATIVE_PROXY_PRICING.inputPer1M}/$${CONSERVATIVE_PROXY_PRICING.outputPer1M} per 1M). ` +
        `Add real pricing to MODEL_PRICING.`
    );
  }
  return (
    (inputTokens * pricing.inputPer1M + outputTokens * pricing.outputPer1M) / 1_000_000
  );
}

/**
 * Get model tier from model ID.
 */
export function getModelTier(model: string): "opus" | "sonnet" | "haiku" | "fable" {
  if (model.includes("opus")) return "opus";
  if (model.includes("fable")) return "fable";
  if (model.includes("haiku")) return "haiku";
  return "sonnet";
}

// ============================================================================
// Empty Metrics
// ============================================================================

/**
 * Create empty metrics (for empty sessions).
 */
export function createEmptyMetrics(): AERMetrics {
  return {
    autonomyTime: 0,
    taskCompletionRate: 0,
    recoveryRate: 0,
    toolChoiceAccuracy: 0,
    costPerTask: 0,
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    escalations: 0,
    recoveries: 0,
    totalFailures: 0,
    totalCost: 0,
    sessionDuration: 0,
    totalToolCalls: 0,
    correctToolCalls: 0,
    modelUsage: {
      opus: { calls: 0, tokens: 0, cost: 0, timeSeconds: 0 },
      sonnet: { calls: 0, tokens: 0, cost: 0, timeSeconds: 0 },
      haiku: { calls: 0, tokens: 0, cost: 0, timeSeconds: 0 },
      fable: { calls: 0, tokens: 0, cost: 0, timeSeconds: 0 },
    },
  };
}
