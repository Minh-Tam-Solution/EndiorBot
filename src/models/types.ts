/**
 * Model Tiering Types
 *
 * Types for model selection and budget management.
 *
 * @module models/types
 * @version 1.0.0
 * @date 2026-03-02
 * @status ACTIVE - Sprint 72
 * @authority Master Plan v4.3, Sprint 72 T12.3-T12.4
 * @sprint 72
 */

import { OPUS, SONNET, HAIKU } from "../config/models.js";

// ============================================================================
// Model Tiers
// ============================================================================

/**
 * Model tier classification.
 *
 * - ELITE: Opus - For architecture decisions, complex reasoning
 * - STANDARD: Sonnet - For general coding, reviews, design
 * - EFFICIENCY: Haiku - For quick queries, formatting, simple edits
 */
export enum ModelTier {
  ELITE = "ELITE",
  STANDARD = "STANDARD",
  EFFICIENCY = "EFFICIENCY",
}

/**
 * Task types that can be assigned to models.
 */
export type TaskType =
  // ELITE tasks (Opus)
  | "architecture"
  | "design_decision"
  | "adr_draft"
  | "complex_analysis"
  | "strategic_planning"
  // STANDARD tasks (Sonnet)
  | "code_generation"
  | "refactor"
  | "bug_fix"
  | "test_write"
  | "code_review"
  | "documentation"
  | "api_design"
  // EFFICIENCY tasks (Haiku)
  | "lint"
  | "format"
  | "simple_edit"
  | "verify"
  | "syntax_check"
  | "quick_lookup";

// ============================================================================
// Model Configuration
// ============================================================================

/**
 * Configuration for a model tier.
 */
export interface ModelConfig {
  /** Model tier */
  tier: ModelTier;

  /** Model ID */
  model: string;

  /** Maximum cost per call in USD */
  maxCostPerCall: number;

  /** Maximum time per call in seconds */
  maxTimePerCall: number;

  /** Task types this model handles */
  taskTypes: TaskType[];

  /** Priority weight (higher = preferred for ambiguous tasks) */
  priority: number;
}

/**
 * Default model configurations.
 */
export const MODEL_CONFIGS: ModelConfig[] = [
  {
    tier: ModelTier.ELITE,
    model: OPUS,
    maxCostPerCall: 1.0,
    maxTimePerCall: 300, // 5 minutes
    taskTypes: [
      "architecture",
      "design_decision",
      "adr_draft",
      "complex_analysis",
      "strategic_planning",
    ],
    priority: 3,
  },
  {
    tier: ModelTier.STANDARD,
    model: SONNET,
    maxCostPerCall: 0.10,
    maxTimePerCall: 60, // 1 minute
    taskTypes: [
      "code_generation",
      "refactor",
      "bug_fix",
      "test_write",
      "code_review",
      "documentation",
      "api_design",
    ],
    priority: 2,
  },
  {
    tier: ModelTier.EFFICIENCY,
    model: HAIKU,
    maxCostPerCall: 0.01,
    maxTimePerCall: 10, // 10 seconds
    taskTypes: [
      "lint",
      "format",
      "simple_edit",
      "verify",
      "syntax_check",
      "quick_lookup",
    ],
    priority: 1,
  },
];

/**
 * Get model config for a tier.
 */
export function getModelConfig(tier: ModelTier): ModelConfig {
  const config = MODEL_CONFIGS.find((c) => c.tier === tier);
  if (!config) {
    // Default to STANDARD
    return MODEL_CONFIGS.find((c) => c.tier === ModelTier.STANDARD)!;
  }
  return config;
}

/**
 * Get model config by model ID.
 */
export function getModelConfigById(modelId: string): ModelConfig | undefined {
  return MODEL_CONFIGS.find((c) => c.model === modelId);
}

// ============================================================================
// Budget Configuration
// ============================================================================

/**
 * Budget configuration for a session.
 */
export interface BudgetConfig {
  /** Total session budget in USD */
  totalUsd: number;

  /** Maximum Opus time in minutes */
  opusCapMin: number;

  /** Maximum Opus cost in USD */
  opusCapUsd: number;

  /** Budget allocation per stage (percentages, should sum to 100) */
  perStage: {
    planning: number;
    design: number;
    build: number;
    test: number;
  };

  /** Enable budget warnings */
  enableWarnings: boolean;

  /** Warning threshold (% of budget) */
  warningThreshold: number;
}

/**
 * Default budget configuration.
 */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  totalUsd: 10.0, // $10 per session
  opusCapMin: 20, // 20 minutes max Opus
  opusCapUsd: 3.0, // $3 max Opus
  perStage: {
    planning: 15,
    design: 25,
    build: 40,
    test: 20,
  },
  enableWarnings: true,
  warningThreshold: 80, // Warn at 80% budget used
};

// ============================================================================
// Budget State
// ============================================================================

/**
 * Spending record for a model tier.
 */
export interface TierSpending {
  /** Cost in USD */
  usd: number;

  /** Time in seconds */
  seconds: number;

  /** Number of calls */
  calls: number;

  /** Total tokens used */
  tokens: number;
}

/**
 * Budget state tracking.
 */
export interface BudgetState {
  /** Spending per tier */
  spending: Record<ModelTier, TierSpending>;

  /** Current stage */
  currentStage: string;

  /** Stage spending */
  stageSpending: Record<string, number>;

  /** Session start time */
  startTime: string;

  /** Last update time */
  lastUpdate: string;
}

/**
 * Create initial budget state.
 */
export function createInitialBudgetState(): BudgetState {
  const now = new Date().toISOString();
  return {
    spending: {
      [ModelTier.ELITE]: { usd: 0, seconds: 0, calls: 0, tokens: 0 },
      [ModelTier.STANDARD]: { usd: 0, seconds: 0, calls: 0, tokens: 0 },
      [ModelTier.EFFICIENCY]: { usd: 0, seconds: 0, calls: 0, tokens: 0 },
    },
    currentStage: "planning",
    stageSpending: {},
    startTime: now,
    lastUpdate: now,
  };
}

// ============================================================================
// Budget Events
// ============================================================================

/**
 * Budget event types.
 */
export type BudgetEventType =
  | "model_call_recorded"
  | "warning_threshold_reached"
  | "opus_cap_reached"
  | "budget_exceeded"
  | "stage_budget_exceeded";

/**
 * Budget event.
 */
export interface BudgetEvent {
  /** Event type */
  type: BudgetEventType;

  /** Event timestamp */
  timestamp: string;

  /** Event details */
  details: Record<string, unknown>;
}

// ============================================================================
// Model Selection Result
// ============================================================================

/**
 * Result of model selection.
 */
export interface ModelSelectionResult {
  /** Selected model config */
  config: ModelConfig;

  /** Reason for selection */
  reason: ModelSelectionReason;

  /** Was the model downgraded due to budget? */
  downgraded: boolean;

  /** Original tier before downgrade (if applicable) */
  originalTier?: ModelTier;

  /** Warning message (if any) */
  warning?: string;
}

/**
 * Reason for model selection.
 */
export type ModelSelectionReason =
  | "task_type_match"
  | "escalation_due_to_failures"
  | "downgrade_due_to_budget"
  | "default_fallback";

// ============================================================================
// Model Call Record
// ============================================================================

/**
 * Record of a model call for budget tracking.
 */
export interface ModelCallRecord {
  /** Model tier used */
  tier: ModelTier;

  /** Model ID */
  model: string;

  /** Cost in USD */
  cost: number;

  /** Duration in seconds */
  durationSeconds: number;

  /** Input tokens */
  inputTokens: number;

  /** Output tokens */
  outputTokens: number;

  /** Task type */
  taskType?: TaskType;

  /** Stage */
  stage?: string;

  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// Budget Check Result
// ============================================================================

/**
 * Result of budget check.
 */
export interface BudgetCheckResult {
  /** Can afford the call? */
  canAfford: boolean;

  /** Remaining total budget */
  remainingTotal: number;

  /** Remaining Opus budget */
  remainingOpus: number;

  /** Remaining Opus time in minutes */
  remainingOpusMinutes: number;

  /** Warning message (if any) */
  warning?: string;

  /** Suggested alternative tier (if cannot afford) */
  suggestedAlternative?: ModelTier;
}
