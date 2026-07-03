/**
 * Routing Types
 *
 * Common types for task routing, quality gates, and cost optimization.
 *
 * @module agents/routing/types
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 39 Backlog
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { TaskComplexity, TaskType, ModelTier } from "../types.js";

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported provider identifiers.
 */
export type ProviderId = "anthropic" | "openai" | "gemini" | "ollama";

/**
 * Model capability level for routing decisions.
 */
export interface ModelCapability {
  /** Provider ID */
  providerId: ProviderId;
  /** Model identifier */
  modelId: string;
  /** Display name */
  name: string;
  /** Capability tier */
  tier: ModelTier;
  /** Cost per 1K input tokens (USD) */
  inputCost: number;
  /** Cost per 1K output tokens (USD) */
  outputCost: number;
  /** Max context window */
  maxTokens: number;
  /** Task types this model excels at */
  strengths: TaskType[];
  /** Supported features */
  features: ModelFeature[];
}

/**
 * Model features for capability matching.
 */
export type ModelFeature =
  | "reasoning"      // Strong reasoning capabilities
  | "coding"         // Code generation/analysis
  | "vision"         // Image understanding
  | "fast"           // Low latency
  | "context"        // Large context window
  | "streaming";     // Streaming support

// ============================================================================
// Quality Gate Types
// ============================================================================

/**
 * Quality gate configuration per task type.
 */
export interface QualityGate {
  /** Task type */
  taskType: TaskType;
  /** Minimum model tier required */
  minTier: ModelTier;
  /** Require multi-model consultation */
  requireConsultation: boolean;
  /** Minimum providers for consultation */
  minProviders: number;
  /** Maximum acceptable latency (ms) */
  maxLatencyMs: number;
  /** Quality threshold (0-1) */
  qualityThreshold: number;
}

/**
 * Quality gate evaluation result.
 */
export interface QualityGateResult {
  /** Gate passed */
  passed: boolean;
  /** Selected model tier */
  selectedTier: ModelTier;
  /** Meets minimum requirements */
  meetsMinTier: boolean;
  /** Consultation required */
  requiresConsultation: boolean;
  /** Gate violations */
  violations: string[];
  /** Recommendations */
  recommendations: string[];
}

// ============================================================================
// Cost Optimization Types
// ============================================================================

/**
 * Budget constraint for cost optimization.
 */
export interface BudgetConstraint {
  /** Maximum cost per request (USD) */
  maxCostPerRequest: number;
  /** Daily budget (USD) */
  dailyBudget: number;
  /** Monthly budget (USD) */
  monthlyBudget: number;
  /** Current daily spend */
  currentDailySpend: number;
  /** Current monthly spend */
  currentMonthlySpend: number;
}

/**
 * Cost estimation result.
 */
export interface CostEstimate {
  /** Provider ID */
  providerId: ProviderId;
  /** Model ID */
  modelId: string;
  /** Estimated input tokens */
  estimatedInputTokens: number;
  /** Estimated output tokens */
  estimatedOutputTokens: number;
  /** Estimated cost (USD) */
  estimatedCost: number;
  /** Within budget */
  withinBudget: boolean;
}

/**
 * Cost optimization result.
 */
export interface CostOptimizationResult {
  /** Recommended model */
  recommendedModel: {
    providerId: ProviderId;
    modelId: string;
    estimatedCost: number;
  };
  /** Alternative models (cheaper) */
  alternatives: {
    providerId: ProviderId;
    modelId: string;
    estimatedCost: number;
    qualityTradeoff: string;
  }[];
  /** Budget status */
  budgetStatus: {
    withinDailyBudget: boolean;
    withinMonthlyBudget: boolean;
    remainingDaily: number;
    remainingMonthly: number;
  };
  /** Fallback to local (Ollama) */
  shouldFallbackToLocal: boolean;
  /** Fallback reason */
  fallbackReason?: string;
}

// ============================================================================
// Model Selection Types
// ============================================================================

/**
 * Model selection criteria.
 */
export interface SelectionCriteria {
  /** Task type */
  taskType: TaskType;
  /** Task complexity */
  complexity: TaskComplexity;
  /** Minimum tier required */
  minTier: ModelTier;
  /** Budget constraint */
  budget?: BudgetConstraint;
  /** Preferred providers */
  preferredProviders?: ProviderId[];
  /** Required features */
  requiredFeatures?: ModelFeature[];
  /** Latency preference */
  latencyPreference: "fastest" | "balanced" | "quality";
}

/**
 * Model selection result.
 */
export interface ModelSelectionResult {
  /** Primary model selection */
  primary: {
    providerId: ProviderId;
    modelId: string;
    tier: ModelTier;
    reason: string;
  };
  /** Fallback options */
  fallbacks: {
    providerId: ProviderId;
    modelId: string;
    tier: ModelTier;
    reason: string;
  }[];
  /** Consultation models (for multi-model) */
  consultationModels?: {
    providerId: ProviderId;
    modelId: string;
    role: "primary" | "expert";
  }[];
  /** Selection metadata */
  metadata: {
    criteriaUsed: string[];
    budgetConsidered: boolean;
    qualityGatePassed: boolean;
    estimatedCost: number;
  };
}

// ============================================================================
// Routing Configuration
// ============================================================================

/**
 * Full routing configuration.
 */
export interface RoutingConfig {
  /** Available models */
  models: ModelCapability[];
  /** Quality gates per task type */
  qualityGates: QualityGate[];
  /** Budget constraint */
  budget: BudgetConstraint;
  /** Enable cost optimization */
  enableCostOptimization: boolean;
  /** Enable local fallback (Ollama) */
  enableLocalFallback: boolean;
  /** Local fallback threshold (remaining budget ratio) */
  localFallbackThreshold: number;
}
