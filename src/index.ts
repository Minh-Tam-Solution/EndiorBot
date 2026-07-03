/**
 * EndiorBot
 *
 * Solo developer tool for enterprise-scale projects:
 * - Claude Code + SDLC Framework automation
 * - Multi-model orchestrator
 * - Project context switching
 * - SDLC gate evaluation
 *
 * @packageDocumentation
 */

export { run } from './cli/index.js';

// Re-export core modules for desktop integration
// Sessions module (base exports)
export * from './sessions/index.js';

// Budget module (with renamed collisions)
export {
  // Types
  type TaskType,
  type LimitAction,
  type NotificationConfig,
  type CircuitBreakerConfig,
  type EstimationConfig,
  type BudgetConfig,
  type SessionBudget,
  type DailyBudget,
  type TrackBudget,
  // Renamed to avoid collision with sessions
  type TokenUsageRecord as BudgetTokenUsage,
  type HistoricalData,
  type BudgetState,
  type ConfidenceLevel,
  type CostBreakdown,
  type CostEstimate,
  type TaskContext,
  type BudgetActionType,
  type BudgetAction,
  type CircuitBreakerStatus,
  type CircuitBreakerReason,
  type TaskMetrics,
  type CircuitBreakerResult,
  type NotificationType,
  type NotificationPriority,
  type Notification,
  type ModelPricing,
  type BudgetEventType,
  type BudgetEvent,
  // Values
  DEFAULT_BUDGET_CONFIG,
  createInitialBudgetState,
  createEmptyTaskMetrics,
  needsDailyReset,
  calculateBudgetPercentage,
  isAtWarningThreshold,
  isLimitReached,
  // Circuit Breaker
  CircuitBreaker,
  NotificationRateLimiter,
  createCircuitBreakers,
  createCircuitBreaker,
  DEFAULT_THRESHOLDS,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_MAX_NOTIFICATIONS_PER_HOUR,
  type ThresholdLevel,
  type CircuitBreakerAction,
  type ThresholdEvaluation,
  type CircuitBreakerState,
  // Budget Tracker
  BudgetTracker,
  createBudgetTracker,
  getBudgetStatus,
  estimateCost,
  type BudgetScope,
  type BudgetStatus,
  // Pricing Registry
  PricingRegistry,
  createPricingRegistry,
  getDefaultModelPricing,
  DEFAULT_PRICING_CONFIG,
  DEFAULT_PRICING_PATH,
  type PricingConfig,
  type ModelPricingEntry,
  // Cost Estimator
  CostEstimator,
  createCostEstimator,
  quickEstimate,
  BASE_OUTPUT_ESTIMATES,
  DEFAULT_ESTIMATOR_CONFIG,
  type CostEstimatorConfig,
  type TokenEstimate,
  type ConfidenceResult,
  type ConfidenceFactor,
  // Checkpoint Integration
  DailyBudgetStore,
  createDailyBudgetStore,
  extractCostState,
  restoreBudgetFromCheckpoint,
  createBudgetStateFromCheckpoint,
  syncDailyBudget,
  needsBudgetRestore,
  DEFAULT_DAILY_BUDGET_PATH,
  DEFAULT_DAILY_LIMIT,
  type PersistedDailyBudget,
  type CheckpointBudgetResult,
  // Decision Classifier
  DecisionClassifier,
  createDecisionClassifier,
  classifyDecision,
  isAutoExecutable,
  getBucketPriority,
  getRiskPriority,
  DEFAULT_INTERVENTION_MATRIX,
  type DecisionBucket,
  type DecisionType,
  type RiskLevel,
  type DecisionContext,
  // Renamed to avoid collision with sessions
  type ClassificationResult as DecisionClassificationResult,
  type InterventionRule,
  type EscalationCondition,
  // Escalation Router
  EscalationRouter,
  createEscalationRouter,
  actionRequiresWait,
  actionAllowsContinuation,
  getActionDescription,
  getLevelDescription,
  DEFAULT_ESCALATION_CONFIG,
  type EscalationLevel,
  type EscalationAction,
  type EscalationDecision,
  type EscalationRouterConfig,
  type EscalationHistoryEntry,
  type ApprovalQueueCallback,
  // Approval Queue
  ApprovalQueue,
  createApprovalQueue,
  isActionable,
  getTimeUntilExpiry,
  formatRequest,
  DEFAULT_APPROVAL_QUEUE_PATH,
  MAX_QUEUE_SIZE,
  DEFAULT_EXPIRY_MS,
  type ApprovalStatus,
  type ApprovalUrgency,
  // Renamed to avoid collision with sessions
  type ApprovalRequest as BudgetApprovalRequest,
  type PersistedQueueData,
  type QueueStats,
  // Budget-Escalation Integration
  BudgetEscalationIntegration,
  createBudgetEscalationIntegration,
  createBudgetEscalationIntegrationManual,
  shouldEscalateBudgetEvent,
  getBudgetEventSeverity,
  DEFAULT_INTEGRATION_CONFIG,
  type BudgetEscalationConfig,
  type BudgetEscalationResult,
  type BudgetEscalationListener,
  // Notification System
  NotificationSystem,
  TerminalChannel,
  FileChannel,
  createNotificationSystem,
  getPriorityLevel,
  comparePriorities,
  formatNotification,
  getNotificationIcon,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_NOTIFICATION_LOG_PATH,
  MAX_LOG_ENTRIES,
  type NotificationEventType,
  type NotificationEvent,
  type NotificationChannel,
  type NotificationSystemConfig,
  type NotificationHistoryEntry,
  type NotificationStats,
} from './budget/index.js';

// Self-correction module
export * from './self-correction/index.js';

// Gateway module (Sprint 44)
export * from './gateway/index.js';

// Provider init (for Desktop gateway start – load API keys and register providers)
export { initializeProvidersFromEnv } from './providers/init.js';

// Brain module (Sprint 45)
export * from './brain/index.js';

// Sprint 41: Persistent Fix Logging (file-backed for desktop)
export {
  // FixLogger (async, persistent)
  FixLogger as PersistentFixLogger,
  createFixLogger as createPersistentFixLogger,
  getFixLogger as getPersistentFixLogger,
  resetFixLogger,
  type LogFixParams,
  type FixLoggerConfig as PersistentFixLoggerConfig,
} from './agents/fix-logging/fix-logger.js';

export type {
  WeeklySummary,
  CategorySummary,
  PatternSummary,
  EnhancedFixLogEntry,
} from './agents/fix-logging/types.js';

export const VERSION = '0.1.0-beta.3';
export const FRAMEWORK_VERSION = '6.4.0';
