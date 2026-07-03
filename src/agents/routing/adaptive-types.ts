/**
 * Adaptive Routing Types
 *
 * Types for adaptive quality gates and pattern-based learning.
 *
 * @module agents/routing/adaptive-types
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 42 Adaptive Quality Tuning
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 4 - Quality Assurance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { TaskType, ModelTier } from "../types.js";
import type { ProviderId } from "./types.js";

// ============================================================================
// Pattern Performance Types
// ============================================================================

/**
 * Performance metrics for a pattern.
 */
export interface PatternPerformanceMetrics {
  /** Pattern ID */
  patternId: string;
  /** Success rate (0-1) */
  successRate: number;
  /** Total applications */
  appliedCount: number;
  /** Escalation rate (0-1) */
  escalationRate: number;
  /** Average fix duration (ms) */
  avgDurationMs: number;
  /** Performance trend */
  trend: PatternTrend;
  /** Last adjustment timestamp */
  lastAdjustmentTime?: string;
  /** Category for task type mapping */
  category: string;
  /** Error code */
  errorCode: string;
}

/**
 * Pattern performance trend.
 */
export type PatternTrend = "improving" | "stable" | "declining";

/**
 * Problematic pattern threshold config.
 */
export interface ProblematicPatternConfig {
  /** Minimum success rate to be considered "good" */
  minSuccessRate: number;
  /** Minimum applications to be considered "high usage" */
  minAppliedCount: number;
  /** Maximum escalation rate */
  maxEscalationRate: number;
}

// ============================================================================
// Threshold Adjustment Types
// ============================================================================

/**
 * Record of a threshold adjustment.
 */
export interface ThresholdAdjustment {
  /** Task type adjusted */
  taskType: TaskType;
  /** Adjustment amount (-1 to +1) */
  adjustment: number;
  /** Reason for adjustment */
  reason: string;
  /** When applied */
  appliedAt: string;
  /** Pattern IDs that triggered this */
  basedOnPatterns: string[];
  /** Previous threshold value */
  previousValue: number;
  /** New threshold value */
  newValue: number;
}

/**
 * Adaptive quality gate configuration.
 */
export interface AdaptiveQualityGateConfig {
  /** Task type */
  taskType: TaskType;
  /** Base (initial) threshold */
  baseThreshold: number;
  /** Current effective threshold */
  currentThreshold: number;
  /** Minimum allowed threshold */
  minThreshold: number;
  /** Maximum allowed threshold */
  maxThreshold: number;
  /** Adjustment history */
  adjustmentHistory: ThresholdAdjustment[];
  /** Last recalculation time */
  lastRecalculation: string;
}

/**
 * Result of a threshold adjustment calculation.
 */
export interface QualityGateAdjustmentResult {
  /** Task type */
  taskType: TaskType;
  /** New threshold */
  newThreshold: number;
  /** Previous threshold */
  previousThreshold: number;
  /** Change magnitude */
  adjustmentMagnitude: number;
  /** Patterns that influenced this */
  affectedPatterns: PatternPerformanceMetrics[];
  /** Recommendation action */
  recommendation: "upgrade" | "downgrade" | "no_change";
  /** Reasoning */
  reason: string;
}

// ============================================================================
// Pattern Feedback Types
// ============================================================================

/**
 * Record of a pattern execution with model info.
 */
export interface PatternModelOutcome {
  /** Pattern ID */
  patternId: string;
  /** Model used */
  modelUsed: {
    providerId: ProviderId;
    modelId: string;
    tier: ModelTier;
  };
  /** Success status */
  success: boolean;
  /** Duration in ms */
  durationMs: number;
  /** Timestamp */
  timestamp: string;
}

/**
 * Pattern-model affinity score.
 */
export interface PatternModelAffinity {
  /** Pattern ID */
  patternId: string;
  /** Provider ID */
  providerId: ProviderId;
  /** Model ID */
  modelId: string;
  /** Affinity score (0-1) */
  affinity: number;
  /** Based on N samples */
  sampleCount: number;
  /** Success rate with this model */
  successRate: number;
  /** Average duration with this model */
  avgDurationMs: number;
}

/**
 * Decision on whether to consult for a pattern.
 */
export interface ConsultationDecision {
  /** Should consult */
  shouldConsult: boolean;
  /** Reason */
  reason: string;
  /** Estimated ROI */
  estimatedROI: number;
  /** Recommended models for consultation */
  recommendedModels?: ProviderId[];
}

// ============================================================================
// Learning Engine Types
// ============================================================================

/**
 * Learning cycle summary.
 */
export interface LearningSummary {
  /** Cycle ID */
  cycleId: string;
  /** Start time */
  startedAt: string;
  /** End time */
  completedAt?: string;
  /** Patterns analyzed */
  patternsAnalyzed: number;
  /** Thresholds adjusted */
  thresholdsAdjusted: number;
  /** Patterns flagged for consultation */
  flaggedForConsultation: number;
  /** Adjustments made */
  adjustments: QualityGateAdjustmentResult[];
  /** Status */
  status: "running" | "completed" | "failed";
  /** Error if failed */
  error?: string;
}

/**
 * Learning engine configuration.
 */
export interface LearningEngineConfig {
  /** Cycle interval in ms (default: 1 hour) */
  cycleIntervalMs: number;
  /** Lookback days for analysis (default: 7) */
  lookbackDays: number;
  /** Minimum samples for threshold adjustment */
  minSamplesForAdjustment: number;
  /** Maximum adjustment per cycle (0-1) */
  maxAdjustmentPerCycle: number;
  /** Enable automatic consultation routing */
  enableConsultationRouting: boolean;
  /** Consultation threshold (min success rate) */
  consultationThreshold: number;
}

// ============================================================================
// Task Type Mapping
// ============================================================================

/**
 * Map error category to task type.
 */
export type CategoryTaskTypeMap = {
  BUILD: TaskType;
  LINT: TaskType;
  TYPE: TaskType;
  TEST: TaskType;
};

/**
 * Default category to task type mapping.
 */
export const DEFAULT_CATEGORY_TASK_MAP: CategoryTaskTypeMap = {
  BUILD: "code_gen",
  LINT: "code_gen",
  TYPE: "code_gen",
  TEST: "bug_fix",
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Default problematic pattern config.
 */
export const DEFAULT_PROBLEMATIC_CONFIG: ProblematicPatternConfig = {
  minSuccessRate: 0.5,
  minAppliedCount: 10,
  maxEscalationRate: 0.3,
};

/**
 * Default learning engine config.
 */
export const DEFAULT_LEARNING_CONFIG: LearningEngineConfig = {
  cycleIntervalMs: 60 * 60 * 1000, // 1 hour
  lookbackDays: 7,
  minSamplesForAdjustment: 50,
  maxAdjustmentPerCycle: 0.1,
  enableConsultationRouting: true,
  consultationThreshold: 0.5,
};
