/**
 * Routing Confidence Score Module
 *
 * Calculates confidence scores for routing decisions and determines
 * when Human-in-the-Loop (HITL) escalation is required.
 *
 * @module agents/routing/confidence
 * @version 1.0.0
 * @date 2026-02-24
 * @status ACTIVE - Sprint 44
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { TaskComplexity, TaskType, ModelTier } from "../types.js";
import type {
  ModelCapability,
  ModelSelectionResult,
  ProviderId,
  SelectionCriteria,
} from "./types.js";
import { MODEL_TIER_HIERARCHY } from "./quality-gates.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Default HITL escalation threshold.
 * Decisions with confidence below this require human approval.
 */
export const DEFAULT_HITL_THRESHOLD = 0.7;

/**
 * Minimum confidence for autonomous action.
 * Below this, the system should not proceed without human input.
 */
export const MINIMUM_CONFIDENCE = 0.3;

/**
 * Confidence weight factors for different signals.
 */
const CONFIDENCE_WEIGHTS = {
  /** Weight for model tier match */
  tierMatch: 0.25,
  /** Weight for task type strength */
  strengthMatch: 0.20,
  /** Weight for required features coverage */
  featuresCoverage: 0.15,
  /** Weight for budget status */
  budgetHealth: 0.15,
  /** Weight for fallback availability */
  fallbackAvailability: 0.10,
  /** Weight for historical success rate */
  historicalSuccess: 0.10,
  /** Weight for consultation consensus */
  consultationConsensus: 0.05,
} as const;

/**
 * Confidence penalties for various conditions.
 */
const CONFIDENCE_PENALTIES = {
  /** Penalty for using local fallback */
  localFallback: 0.25,
  /** Penalty for exceeding budget */
  budgetExceeded: 0.30,
  /** Penalty for no fallback options */
  noFallbacks: 0.15,
  /** Penalty for missing required features */
  missingFeatures: 0.20,
  /** Penalty for tier downgrade */
  tierDowngrade: 0.15,
  /** Penalty for critical task without expert model */
  criticalWithoutExpert: 0.25,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Confidence score breakdown by signal.
 */
export interface ConfidenceBreakdown {
  /** Model tier match score (0-1) */
  tierMatch: number;
  /** Task strength match score (0-1) */
  strengthMatch: number;
  /** Features coverage score (0-1) */
  featuresCoverage: number;
  /** Budget health score (0-1) */
  budgetHealth: number;
  /** Fallback availability score (0-1) */
  fallbackAvailability: number;
  /** Historical success rate (0-1), default 0.8 if no history */
  historicalSuccess: number;
  /** Consultation consensus score (0-1), 1.0 if no consultation */
  consultationConsensus: number;
}

/**
 * HITL escalation decision.
 */
export interface HITLDecision {
  /** Whether HITL escalation is required */
  required: boolean;
  /** Reason for escalation (if required) */
  reason?: string;
  /** Urgency level */
  urgency: "low" | "medium" | "high" | "critical";
  /** Suggested action for human */
  suggestedAction?: string;
  /** Timeout for decision (ms), null = no timeout */
  timeoutMs: number | null;
}

/**
 * Full routing confidence result.
 */
export interface RoutingConfidenceResult {
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Confidence level classification */
  level: "very_low" | "low" | "medium" | "high" | "very_high";
  /** Confidence breakdown by signal */
  breakdown: ConfidenceBreakdown;
  /** Applied penalties */
  penalties: { name: string; value: number; reason: string }[];
  /** HITL decision */
  hitl: HITLDecision;
  /** Recommendations for improving confidence */
  recommendations: string[];
}

/**
 * Historical success tracking for a model.
 */
export interface ModelSuccessRate {
  providerId: ProviderId;
  modelId: string;
  taskType: TaskType;
  totalRequests: number;
  successfulRequests: number;
  successRate: number;
  lastUpdated: Date;
}

/**
 * Confidence evaluation context.
 */
export interface ConfidenceContext {
  /** Selection criteria used */
  criteria: SelectionCriteria;
  /** Selection result */
  result: ModelSelectionResult;
  /** Selected model capabilities */
  modelCapability: ModelCapability;
  /** Budget remaining ratio (0-1) */
  budgetRemainingRatio: number;
  /** Required features that are missing */
  missingFeatures: string[];
  /** Historical success rate for this model+task */
  historicalSuccessRate?: number;
  /** Consultation consensus (if multi-model) */
  consultationConsensus?: number;
}

// ============================================================================
// Confidence Calculator
// ============================================================================

/**
 * RoutingConfidenceCalculator - Calculates confidence scores for routing decisions.
 */
export class RoutingConfidenceCalculator {
  private hitlThreshold: number;
  private successHistory: Map<string, ModelSuccessRate>;

  constructor(hitlThreshold: number = DEFAULT_HITL_THRESHOLD) {
    this.hitlThreshold = hitlThreshold;
    this.successHistory = new Map();
  }

  /**
   * Calculate confidence for a routing decision.
   */
  calculate(context: ConfidenceContext): RoutingConfidenceResult {
    const breakdown = this.calculateBreakdown(context);
    const penalties = this.calculatePenalties(context);

    // Calculate base confidence from weighted signals
    let confidence = this.calculateWeightedScore(breakdown);

    // Apply penalties
    for (const penalty of penalties) {
      confidence -= penalty.value;
    }

    // Clamp to [0, 1]
    confidence = Math.max(0, Math.min(1, confidence));

    const level = this.classifyConfidenceLevel(confidence);
    const hitl = this.evaluateHITL(confidence, context, level);
    const recommendations = this.generateRecommendations(breakdown, penalties, context);

    return {
      confidence,
      level,
      breakdown,
      penalties,
      hitl,
      recommendations,
    };
  }

  /**
   * Quick confidence check (returns just the score).
   */
  quickScore(context: ConfidenceContext): number {
    return this.calculate(context).confidence;
  }

  /**
   * Check if HITL escalation is required.
   */
  requiresHITL(context: ConfidenceContext): boolean {
    return this.calculate(context).hitl.required;
  }

  /**
   * Update HITL threshold.
   */
  setHITLThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error("HITL threshold must be between 0 and 1");
    }
    this.hitlThreshold = threshold;
  }

  /**
   * Get current HITL threshold.
   */
  getHITLThreshold(): number {
    return this.hitlThreshold;
  }

  /**
   * Record success/failure for historical tracking.
   */
  recordOutcome(
    providerId: ProviderId,
    modelId: string,
    taskType: TaskType,
    success: boolean
  ): void {
    const key = `${providerId}:${modelId}:${taskType}`;
    const existing = this.successHistory.get(key);

    if (existing) {
      existing.totalRequests++;
      if (success) existing.successfulRequests++;
      existing.successRate = existing.successfulRequests / existing.totalRequests;
      existing.lastUpdated = new Date();
    } else {
      this.successHistory.set(key, {
        providerId,
        modelId,
        taskType,
        totalRequests: 1,
        successfulRequests: success ? 1 : 0,
        successRate: success ? 1 : 0,
        lastUpdated: new Date(),
      });
    }
  }

  /**
   * Get historical success rate for a model+task combination.
   */
  getSuccessRate(
    providerId: ProviderId,
    modelId: string,
    taskType: TaskType
  ): number | undefined {
    const key = `${providerId}:${modelId}:${taskType}`;
    return this.successHistory.get(key)?.successRate;
  }

  /**
   * Clear historical data.
   */
  clearHistory(): void {
    this.successHistory.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Calculate individual confidence signals.
   */
  private calculateBreakdown(context: ConfidenceContext): ConfidenceBreakdown {
    const { criteria, result, modelCapability } = context;

    // Tier match: how well does selected tier match required tier
    const tierMatch = this.calculateTierMatch(
      modelCapability.tier,
      criteria.minTier,
      criteria.complexity
    );

    // Strength match: does model excel at this task type
    const strengthMatch = modelCapability.strengths.includes(criteria.taskType)
      ? 1.0
      : 0.5;

    // Features coverage: percentage of required features available
    const featuresCoverage = this.calculateFeaturesCoverage(
      context.missingFeatures,
      criteria.requiredFeatures?.length ?? 0
    );

    // Budget health: how much budget remains
    const budgetHealth = Math.min(1.0, context.budgetRemainingRatio + 0.2);

    // Fallback availability: number of fallback options
    const fallbackAvailability = Math.min(1.0, (result.fallbacks.length + 1) * 0.33);

    // Historical success rate
    const historicalSuccess = context.historicalSuccessRate ?? 0.8; // Default to 80%

    // Consultation consensus (if multi-model was used)
    const consultationConsensus = context.consultationConsensus ?? 1.0;

    return {
      tierMatch,
      strengthMatch,
      featuresCoverage,
      budgetHealth,
      fallbackAvailability,
      historicalSuccess,
      consultationConsensus,
    };
  }

  /**
   * Calculate tier match score.
   */
  private calculateTierMatch(
    selectedTier: ModelTier,
    requiredTier: ModelTier,
    complexity: TaskComplexity
  ): number {
    const selectedIndex = MODEL_TIER_HIERARCHY.indexOf(selectedTier);
    const requiredIndex = MODEL_TIER_HIERARCHY.indexOf(requiredTier);

    // Higher tier than required = full match
    if (selectedIndex <= requiredIndex) {
      return 1.0;
    }

    // Lower tier = partial match based on gap
    const gap = selectedIndex - requiredIndex;

    // Critical tasks need tighter matching
    if (complexity === "critical") {
      return Math.max(0, 1 - gap * 0.35);
    }

    return Math.max(0, 1 - gap * 0.25);
  }

  /**
   * Calculate features coverage score.
   */
  private calculateFeaturesCoverage(
    missingFeatures: string[],
    totalRequired: number
  ): number {
    if (totalRequired === 0) return 1.0;
    if (missingFeatures.length >= totalRequired) return 0;

    const covered = totalRequired - missingFeatures.length;
    return covered / totalRequired;
  }

  /**
   * Calculate weighted confidence score from breakdown.
   */
  private calculateWeightedScore(breakdown: ConfidenceBreakdown): number {
    let score = 0;

    score += breakdown.tierMatch * CONFIDENCE_WEIGHTS.tierMatch;
    score += breakdown.strengthMatch * CONFIDENCE_WEIGHTS.strengthMatch;
    score += breakdown.featuresCoverage * CONFIDENCE_WEIGHTS.featuresCoverage;
    score += breakdown.budgetHealth * CONFIDENCE_WEIGHTS.budgetHealth;
    score += breakdown.fallbackAvailability * CONFIDENCE_WEIGHTS.fallbackAvailability;
    score += breakdown.historicalSuccess * CONFIDENCE_WEIGHTS.historicalSuccess;
    score += breakdown.consultationConsensus * CONFIDENCE_WEIGHTS.consultationConsensus;

    return score;
  }

  /**
   * Calculate penalties for the routing decision.
   */
  private calculatePenalties(
    context: ConfidenceContext
  ): RoutingConfidenceResult["penalties"] {
    const penalties: RoutingConfidenceResult["penalties"] = [];
    const { criteria, result, modelCapability } = context;

    // Local fallback penalty
    if (result.primary.providerId === "ollama") {
      penalties.push({
        name: "localFallback",
        value: CONFIDENCE_PENALTIES.localFallback,
        reason: "Using local model instead of cloud provider",
      });
    }

    // Budget exceeded penalty
    if (context.budgetRemainingRatio < 0.1) {
      penalties.push({
        name: "budgetExceeded",
        value: CONFIDENCE_PENALTIES.budgetExceeded,
        reason: "Budget nearly exhausted",
      });
    }

    // No fallbacks penalty
    if (result.fallbacks.length === 0 && result.primary.providerId !== "ollama") {
      penalties.push({
        name: "noFallbacks",
        value: CONFIDENCE_PENALTIES.noFallbacks,
        reason: "No fallback options available",
      });
    }

    // Missing features penalty
    if (context.missingFeatures.length > 0) {
      penalties.push({
        name: "missingFeatures",
        value: CONFIDENCE_PENALTIES.missingFeatures * Math.min(1, context.missingFeatures.length * 0.5),
        reason: `Missing features: ${context.missingFeatures.join(", ")}`,
      });
    }

    // Tier downgrade penalty
    const selectedTierIndex = MODEL_TIER_HIERARCHY.indexOf(modelCapability.tier);
    const requiredTierIndex = MODEL_TIER_HIERARCHY.indexOf(criteria.minTier);
    if (selectedTierIndex > requiredTierIndex) {
      penalties.push({
        name: "tierDowngrade",
        value: CONFIDENCE_PENALTIES.tierDowngrade,
        reason: `Selected ${modelCapability.tier} tier instead of required ${criteria.minTier}`,
      });
    }

    // Critical task without expert model
    if (criteria.complexity === "critical" && modelCapability.tier !== "expert") {
      penalties.push({
        name: "criticalWithoutExpert",
        value: CONFIDENCE_PENALTIES.criticalWithoutExpert,
        reason: "Critical task assigned to non-expert model",
      });
    }

    return penalties;
  }

  /**
   * Classify confidence level.
   */
  private classifyConfidenceLevel(
    confidence: number
  ): RoutingConfidenceResult["level"] {
    if (confidence >= 0.9) return "very_high";
    if (confidence >= 0.75) return "high";
    if (confidence >= 0.55) return "medium";
    if (confidence >= 0.35) return "low";
    return "very_low";
  }

  /**
   * Evaluate HITL requirements.
   */
  private evaluateHITL(
    confidence: number,
    context: ConfidenceContext,
    level: RoutingConfidenceResult["level"]
  ): HITLDecision {
    const { criteria } = context;

    // Determine if HITL is required
    const required = confidence < this.hitlThreshold;

    if (!required) {
      return {
        required: false,
        urgency: "low",
        timeoutMs: null,
      };
    }

    // Determine urgency based on confidence and task complexity
    let urgency: HITLDecision["urgency"];
    let timeoutMs: number | null;
    let suggestedAction: string;

    if (confidence < MINIMUM_CONFIDENCE) {
      urgency = "critical";
      timeoutMs = 30000; // 30 seconds
      suggestedAction = "Immediate review required - very low confidence";
    } else if (criteria.complexity === "critical") {
      urgency = "high";
      timeoutMs = 60000; // 1 minute
      suggestedAction = "Critical task requires human verification";
    } else if (level === "low") {
      urgency = "medium";
      timeoutMs = 120000; // 2 minutes
      suggestedAction = "Review routing decision before proceeding";
    } else {
      urgency = "low";
      timeoutMs = 300000; // 5 minutes
      suggestedAction = "Optional review - confidence slightly below threshold";
    }

    // Build reason
    const reasons: string[] = [];
    if (confidence < this.hitlThreshold) {
      reasons.push(`Confidence ${(confidence * 100).toFixed(1)}% below threshold ${(this.hitlThreshold * 100).toFixed(0)}%`);
    }
    if (criteria.complexity === "critical") {
      reasons.push("Critical task complexity");
    }
    if (context.missingFeatures.length > 0) {
      reasons.push(`Missing features: ${context.missingFeatures.join(", ")}`);
    }

    return {
      required: true,
      reason: reasons.join("; "),
      urgency,
      suggestedAction,
      timeoutMs,
    };
  }

  /**
   * Generate recommendations for improving confidence.
   */
  private generateRecommendations(
    breakdown: ConfidenceBreakdown,
    penalties: RoutingConfidenceResult["penalties"],
    context: ConfidenceContext
  ): string[] {
    const recommendations: string[] = [];

    // Low tier match
    if (breakdown.tierMatch < 0.7) {
      recommendations.push(
        "Consider using a higher-tier model for this task complexity"
      );
    }

    // Low strength match
    if (breakdown.strengthMatch < 0.7) {
      recommendations.push(
        `Consider a model specialized for ${context.criteria.taskType} tasks`
      );
    }

    // Low budget health
    if (breakdown.budgetHealth < 0.5) {
      recommendations.push(
        "Budget is low - consider increasing limits or using local fallback"
      );
    }

    // No fallbacks
    if (breakdown.fallbackAvailability < 0.5) {
      recommendations.push("Configure additional provider fallbacks for resilience");
    }

    // Low historical success
    if (breakdown.historicalSuccess < 0.7) {
      recommendations.push(
        "Historical success rate is low - consider alternative model"
      );
    }

    // Based on penalties
    for (const penalty of penalties) {
      if (penalty.name === "criticalWithoutExpert") {
        recommendations.push(
          "Use Claude Opus or equivalent expert model for critical tasks"
        );
      }
      if (penalty.name === "missingFeatures") {
        recommendations.push(
          `Select a model with: ${context.missingFeatures.join(", ")}`
        );
      }
    }

    // Limit recommendations
    return recommendations.slice(0, 3);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a RoutingConfidenceCalculator instance.
 */
export function createConfidenceCalculator(
  hitlThreshold?: number
): RoutingConfidenceCalculator {
  return new RoutingConfidenceCalculator(hitlThreshold);
}

/**
 * Create confidence context from selection result.
 */
export function createConfidenceContext(
  criteria: SelectionCriteria,
  result: ModelSelectionResult,
  modelCapability: ModelCapability,
  options?: {
    budgetRemainingRatio?: number;
    missingFeatures?: string[];
    historicalSuccessRate?: number;
    consultationConsensus?: number;
  }
): ConfidenceContext {
  const context: ConfidenceContext = {
    criteria,
    result,
    modelCapability,
    budgetRemainingRatio: options?.budgetRemainingRatio ?? 1.0,
    missingFeatures: options?.missingFeatures ?? [],
  };

  // Only set optional properties if they have values
  if (options?.historicalSuccessRate !== undefined) {
    context.historicalSuccessRate = options.historicalSuccessRate;
  }
  if (options?.consultationConsensus !== undefined) {
    context.consultationConsensus = options.consultationConsensus;
  }

  return context;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format confidence as percentage string.
 */
export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}

/**
 * Get confidence color indicator.
 */
export function getConfidenceColor(
  level: RoutingConfidenceResult["level"]
): "green" | "yellow" | "orange" | "red" {
  switch (level) {
    case "very_high":
    case "high":
      return "green";
    case "medium":
      return "yellow";
    case "low":
      return "orange";
    case "very_low":
      return "red";
  }
}

/**
 * Check if confidence is actionable (above minimum).
 */
export function isActionable(confidence: number): boolean {
  return confidence >= MINIMUM_CONFIDENCE;
}
