/**
 * Routing Module
 *
 * Task routing, quality gates, cost optimization, and adaptive learning.
 *
 * @module agents/routing
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 42 Adaptive Quality Tuning
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// Types
export type {
  ProviderId,
  ModelCapability,
  ModelFeature,
  QualityGate,
  QualityGateResult,
  BudgetConstraint,
  CostEstimate,
  CostOptimizationResult,
  SelectionCriteria,
  ModelSelectionResult,
  RoutingConfig,
} from "./types.js";

// Adaptive Types
export type {
  PatternPerformanceMetrics,
  PatternTrend,
  ProblematicPatternConfig,
  ThresholdAdjustment,
  AdaptiveQualityGateConfig,
  QualityGateAdjustmentResult,
  PatternModelOutcome,
  PatternModelAffinity,
  ConsultationDecision,
  LearningSummary,
  LearningEngineConfig,
  CategoryTaskTypeMap,
} from "./adaptive-types.js";

export {
  DEFAULT_CATEGORY_TASK_MAP,
  DEFAULT_PROBLEMATIC_CONFIG,
  DEFAULT_LEARNING_CONFIG,
} from "./adaptive-types.js";

// Quality Gates
export {
  QualityGatesEvaluator,
  createQualityGates,
  getMinTierForTask,
  MODEL_TIER_HIERARCHY,
  DEFAULT_QUALITY_GATES,
  COMPLEXITY_TIER_MAP,
} from "./quality-gates.js";

// Cost Optimizer
export {
  CostOptimizer,
  createCostOptimizer,
  createCostOptimizerFromEnv,
  DEFAULT_BUDGET,
  DEFAULT_LOCAL_FALLBACK_THRESHOLD,
  TOKEN_ESTIMATES,
  OLLAMA_LOCAL_MODEL,
} from "./cost-optimizer.js";

// Model Selector
export {
  ModelSelector,
  createModelSelector,
  createModelSelectorFromEnv,
  DEFAULT_MODEL_CAPABILITIES,
  CONSULTATION_PRIORITY,
} from "./model-selector.js";

// Pattern Analytics
export {
  PatternAnalytics,
  createPatternAnalytics,
  getPatternAnalytics,
  resetPatternAnalytics,
  type PatternAnalyticsConfig,
  type TaskTypeAnalytics,
  type AnalyticsSummary,
} from "./pattern-analytics.js";

// Adaptive Gates Manager
export {
  AdaptiveGatesManager,
  createAdaptiveGatesManager,
  getAdaptiveGatesManager,
  resetAdaptiveGatesManager,
  type AdaptiveGatesConfig,
  type GateState,
} from "./adaptive-gates-manager.js";

// Pattern Feedback Loop
export {
  PatternFeedbackLoop,
  createPatternFeedbackLoop,
  getPatternFeedbackLoop,
  resetPatternFeedbackLoop,
  type FeedbackLoopConfig,
} from "./pattern-feedback-loop.js";

// Routing Confidence
export {
  RoutingConfidenceCalculator,
  createConfidenceCalculator,
  createConfidenceContext,
  formatConfidence,
  getConfidenceColor,
  isActionable,
  DEFAULT_HITL_THRESHOLD,
  MINIMUM_CONFIDENCE,
  type ConfidenceBreakdown,
  type HITLDecision,
  type RoutingConfidenceResult,
  type ModelSuccessRate,
  type ConfidenceContext,
} from "./confidence.js";
