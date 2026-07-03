/**
 * Resilience Module
 *
 * Provides resilience patterns for agent interactions:
 * - Failover classification for error handling
 * - Conversation limits for loop guards
 * - Conversation tracking for lifecycle management
 *
 * @module agents/resilience
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.3 Implementation
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// Conversation Limits
export {
  ConversationLimits,
  getConversationLimits,
  resetConversationLimits,
  DEFAULT_MAX_MESSAGES,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MAX_TOOL_CALLS,
  DEFAULT_TIMEOUT_MINUTES,
  DEFAULT_MAX_DIFF_SIZE,
  DEFAULT_MAX_RETRIES_PER_STEP,
  DEFAULT_MAX_DELEGATION_DEPTH,
  DEFAULT_MAX_BUDGET_CENTS,
  type LimitViolation,
  type ConversationLimitsConfig,
  type ConversationState,
} from "./conversation-limits.js";

// Failover Classifier
export {
  FailoverClassifier,
  getFailoverClassifier,
  resetFailoverClassifier,
  formatProfileKey,
  parseProfileKey,
  getCooldownKey,
  ABORT_MATRIX,
  COOLDOWN_TTLS,
  type FailoverReason,
  type FailoverAction,
  type ProviderProfileKey,
  type ClassificationResult,
} from "./failover-classifier.js";

// Conversation Tracker
export {
  ConversationTracker,
  getConversationTracker,
  resetConversationTracker,
  ConversationError,
  ConversationNotFoundError,
  ConversationInactiveError,
  LimitExceededError,
  DelegationDepthError,
  type ConversationStatus,
  type ConversationRecord,
  type TokenUsage,
  type CreateConversationOptions,
} from "./conversation-tracker.js";
