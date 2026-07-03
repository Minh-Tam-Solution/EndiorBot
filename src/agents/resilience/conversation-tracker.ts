/**
 * Conversation Tracker
 *
 * Parent-child inheritance + loop guards + budget tracking.
 * Adapted from SDLC-Orchestrator: conversation_tracker.py
 *
 * This is a simplified file-based version for EndiorBot (no SQLAlchemy).
 * Uses in-memory tracking with file persistence for session state.
 *
 * Features:
 *   - Conversation lifecycle: active → completed/max_reached/error
 *   - Parent-child session inheritance (OpenClaw Pattern 5)
 *   - Loop guard enforcement via ConversationLimits
 *   - Token budget tracking + circuit breaker (Non-Negotiable #13)
 *   - Delegation depth validation (Nanobot N2)
 *
 * @module agents/resilience/conversation-tracker
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.3 Implementation
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import {
  ConversationLimits,
  type ConversationLimitsConfig,
  type LimitViolation,
} from "./conversation-limits.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Conversation status lifecycle.
 */
export type ConversationStatus =
  | "active"
  | "completed"
  | "max_reached"
  | "error"
  | "paused_by_human";

/**
 * Conversation state record.
 */
export interface ConversationRecord {
  id: string;
  parentId: string | undefined;
  delegationDepth: number;
  status: ConversationStatus;

  // Counters
  totalMessages: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  currentCostCents: number;

  // Limits (snapshotted)
  limits: ConversationLimitsConfig;

  // Timestamps
  startedAt: string;
  completedAt: string | undefined;

  // Metadata
  metadata: Record<string, unknown>;
}

/**
 * Token usage record for tracking.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

/**
 * Configuration for conversation creation.
 */
export interface CreateConversationOptions {
  parentId?: string;
  limits?: ConversationLimitsConfig;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Base error for conversation operations.
 */
export class ConversationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationError";
  }
}

/**
 * Conversation not found.
 */
export class ConversationNotFoundError extends ConversationError {
  constructor(conversationId: string) {
    super(`Conversation ${conversationId} not found`);
    this.name = "ConversationNotFoundError";
  }
}

/**
 * Conversation is not in active status.
 */
export class ConversationInactiveError extends ConversationError {
  constructor(conversationId: string, currentStatus: string) {
    super(
      `Conversation ${conversationId} is '${currentStatus}', not active`,
    );
    this.name = "ConversationInactiveError";
  }
}

/**
 * A conversation limit has been exceeded.
 */
export class LimitExceededError extends ConversationError {
  readonly violation: LimitViolation;

  constructor(violation: LimitViolation, message: string) {
    super(message);
    this.name = "LimitExceededError";
    this.violation = violation;
  }
}

/**
 * Delegation depth limit exceeded.
 */
export class DelegationDepthError extends ConversationError {
  constructor(currentDepth: number, maxDepth: number, agentName?: string) {
    const agent = agentName ? ` for agent '${agentName}'` : "";
    super(`Delegation depth ${currentDepth} exceeds max ${maxDepth}${agent}`);
    this.name = "DelegationDepthError";
  }
}

// ============================================================================
// Conversation Tracker Class
// ============================================================================

/**
 * Manages conversation lifecycle, loop guards, budget tracking,
 * and parent-child inheritance.
 *
 * Snapshot Precedence (ADR-056 Decision 1):
 * On conversation creation, limits are copied from agent definition.
 * The conversation copy is authoritative after creation.
 */
export class ConversationTracker {
  private conversations: Map<string, ConversationRecord> = new Map();

  /**
   * Create a new conversation with Snapshot Precedence from limits.
   *
   * Validates delegation depth against parent conversation chain.
   */
  create(options: CreateConversationOptions = {}): ConversationRecord {
    const id = this.generateId();
    let delegationDepth = 0;

    // Validate delegation depth if parent exists
    if (options.parentId) {
      const parent = this.get(options.parentId);
      delegationDepth = parent.delegationDepth + 1;

      const maxDepth = options.limits?.maxDelegationDepth ?? 1;
      if (delegationDepth > maxDepth) {
        throw new DelegationDepthError(delegationDepth, maxDepth);
      }
    }

    const record: ConversationRecord = {
      id,
      parentId: options.parentId,
      delegationDepth,
      status: "active",
      totalMessages: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      currentCostCents: 0,
      limits: options.limits ?? {},
      startedAt: new Date().toISOString(),
      completedAt: undefined,
      metadata: options.metadata ?? {},
    };

    this.conversations.set(id, record);
    return record;
  }

  /**
   * Get conversation by ID.
   *
   * @throws ConversationNotFoundError if not found
   */
  get(conversationId: string): ConversationRecord {
    const record = this.conversations.get(conversationId);
    if (!record) {
      throw new ConversationNotFoundError(conversationId);
    }
    return record;
  }

  /**
   * Get conversation by ID, ensuring it is active.
   *
   * @throws ConversationNotFoundError if not found
   * @throws ConversationInactiveError if not active
   */
  getActive(conversationId: string): ConversationRecord {
    const record = this.get(conversationId);
    if (record.status !== "active") {
      throw new ConversationInactiveError(conversationId, record.status);
    }
    return record;
  }

  /**
   * Build ConversationLimits from snapshotted conversation fields.
   */
  buildLimits(conversation: ConversationRecord): ConversationLimits {
    return new ConversationLimits(conversation.limits);
  }

  /**
   * Check all conversation limits. Throws LimitExceededError on violation.
   *
   * On violation, also updates conversation status to 'max_reached'.
   */
  checkLimits(conversationId: string): void {
    const record = this.get(conversationId);
    const limits = this.buildLimits(record);

    // Check message count
    const msgViolation = limits.checkMessages(record.totalMessages);
    if (msgViolation) {
      this.setStatus(conversationId, "max_reached");
      throw new LimitExceededError(
        msgViolation,
        ConversationLimits.describeViolation(
          msgViolation,
          record.totalMessages,
          limits.maxMessages,
        ),
      );
    }

    // Check budget
    const budgetViolation = limits.checkBudget(record.currentCostCents);
    if (budgetViolation) {
      this.setStatus(conversationId, "max_reached");
      throw new LimitExceededError(
        budgetViolation,
        ConversationLimits.describeViolation(
          budgetViolation,
          record.currentCostCents,
          limits.maxBudgetCents,
        ),
      );
    }

    // Check tokens
    const tokenViolation = limits.checkTokens(record.totalTokens);
    if (tokenViolation) {
      this.setStatus(conversationId, "max_reached");
      throw new LimitExceededError(
        tokenViolation,
        ConversationLimits.describeViolation(
          tokenViolation,
          record.totalTokens,
          limits.maxTokens,
        ),
      );
    }
  }

  /**
   * Increment total_messages and return new count.
   */
  incrementMessageCount(conversationId: string): number {
    const record = this.get(conversationId);
    record.totalMessages += 1;
    return record.totalMessages;
  }

  /**
   * Record token usage and cost for budget circuit breaker tracking.
   */
  recordTokenUsage(conversationId: string, usage: TokenUsage): void {
    const record = this.get(conversationId);
    record.inputTokens += usage.inputTokens;
    record.outputTokens += usage.outputTokens;
    record.totalTokens += usage.inputTokens + usage.outputTokens;
    record.currentCostCents += usage.costCents;
  }

  /**
   * Mark conversation as completed.
   */
  complete(conversationId: string): ConversationRecord {
    this.setStatus(conversationId, "completed");
    return this.get(conversationId);
  }

  /**
   * Mark conversation as errored.
   */
  error(conversationId: string, errorDetail?: string): ConversationRecord {
    const record = this.get(conversationId);
    this.setStatus(conversationId, "error");
    if (errorDetail) {
      record.metadata["last_error"] = errorDetail.slice(0, 2000);
    }
    return record;
  }

  /**
   * Pause conversation via human-in-the-loop interrupt.
   */
  pause(conversationId: string, reason: string): ConversationRecord {
    const record = this.get(conversationId);
    this.setStatus(conversationId, "paused_by_human");
    record.metadata["pause_reason"] = reason.slice(0, 500);
    return record;
  }

  /**
   * Resume a paused conversation.
   */
  resume(conversationId: string): ConversationRecord {
    const record = this.get(conversationId);
    if (record.status !== "paused_by_human") {
      throw new ConversationInactiveError(
        conversationId,
        `Cannot resume: status is '${record.status}', expected 'paused_by_human'`,
      );
    }
    record.status = "active";
    return record;
  }

  /**
   * Check if a conversation exists.
   */
  has(conversationId: string): boolean {
    return this.conversations.has(conversationId);
  }

  /**
   * Get all conversations.
   */
  list(): ConversationRecord[] {
    return Array.from(this.conversations.values());
  }

  /**
   * Get active conversations only.
   */
  listActive(): ConversationRecord[] {
    return this.list().filter((c) => c.status === "active");
  }

  /**
   * Delete a conversation record.
   */
  delete(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  /**
   * Clear all conversations.
   */
  clear(): void {
    this.conversations.clear();
  }

  /**
   * Set conversation status with timestamp on terminal states.
   */
  private setStatus(
    conversationId: string,
    newStatus: ConversationStatus,
  ): void {
    const record = this.get(conversationId);
    record.status = newStatus;
    if (
      newStatus === "completed" ||
      newStatus === "max_reached" ||
      newStatus === "error"
    ) {
      record.completedAt = new Date().toISOString();
    }
  }

  /**
   * Generate a unique conversation ID.
   */
  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalTracker: ConversationTracker | undefined;

export function getConversationTracker(): ConversationTracker {
  if (!globalTracker) {
    globalTracker = new ConversationTracker();
  }
  return globalTracker;
}

/**
 * Reset the global ConversationTracker instance.
 * Useful for testing or reconfiguration.
 */
export function resetConversationTracker(): void {
  globalTracker = undefined;
}
