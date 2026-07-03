/**
 * Conversation Limits
 *
 * 8 loop guard limits enforced per ADR-056 Non-Negotiable #9.
 * Ported from SDLC-Orchestrator: conversation_limits.py
 *
 * Loop guards:
 *   - max_messages: Message count cap (default: 50)
 *   - max_tokens: Token budget cap (default: 100K)
 *   - max_tool_calls: Tool calls per message (default: 20)
 *   - timeout_minutes: Session timeout (default: 30)
 *   - max_diff_size: Code diff lines (default: 10K)
 *   - max_retries_per_step: Dead-letter threshold (default: 3)
 *   - max_delegation_depth: Sub-agent depth (default: 1)
 *   - max_budget_cents: Cost circuit breaker (default: 1000)
 *
 * @module agents/resilience/conversation-limits
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.3 Implementation
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Constants (Default Limits)
// ============================================================================

/**
 * Default maximum messages per conversation.
 */
export const DEFAULT_MAX_MESSAGES = 50;

/**
 * Default maximum tokens per conversation.
 */
export const DEFAULT_MAX_TOKENS = 100_000;

/**
 * Default maximum tool calls per message.
 */
export const DEFAULT_MAX_TOOL_CALLS = 20;

/**
 * Default session timeout in minutes.
 */
export const DEFAULT_TIMEOUT_MINUTES = 30;

/**
 * Default maximum diff size in lines.
 */
export const DEFAULT_MAX_DIFF_SIZE = 10_000;

/**
 * Default maximum retries per step (dead-letter threshold).
 */
export const DEFAULT_MAX_RETRIES_PER_STEP = 3;

/**
 * Default maximum delegation depth for sub-agents.
 */
export const DEFAULT_MAX_DELEGATION_DEPTH = 1;

/**
 * Default maximum budget in cents.
 */
export const DEFAULT_MAX_BUDGET_CENTS = 1000;

// ============================================================================
// Types
// ============================================================================

/**
 * Which limit was violated.
 */
export type LimitViolation =
  | "max_messages"
  | "max_tokens"
  | "max_tool_calls"
  | "timeout_minutes"
  | "max_diff_size"
  | "max_retries_per_step"
  | "max_delegation_depth"
  | "budget_exceeded";

/**
 * Configuration for conversation limits.
 */
export interface ConversationLimitsConfig {
  maxMessages?: number;
  maxTokens?: number;
  maxToolCalls?: number;
  timeoutMinutes?: number;
  maxDiffSize?: number;
  maxRetriesPerStep?: number;
  maxDelegationDepth?: number;
  maxBudgetCents?: number;
}

/**
 * Current conversation state for limit checking.
 */
export interface ConversationState {
  totalMessages?: number;
  totalTokens?: number;
  toolCallCount?: number;
  diffLines?: number;
  failedCount?: number;
  delegationDepth?: number;
  currentCostCents?: number;
}

// ============================================================================
// Conversation Limits Class
// ============================================================================

/**
 * 8 loop guard limits + delegation depth + budget.
 *
 * All values are snapshotted from agent definitions into conversations
 * on creation (Snapshot Precedence — ADR-056 Decision 1).
 */
export class ConversationLimits {
  readonly maxMessages: number;
  readonly maxTokens: number;
  readonly maxToolCalls: number;
  readonly timeoutMinutes: number;
  readonly maxDiffSize: number;
  readonly maxRetriesPerStep: number;
  readonly maxDelegationDepth: number;
  readonly maxBudgetCents: number;

  constructor(config: ConversationLimitsConfig = {}) {
    this.maxMessages = config.maxMessages ?? DEFAULT_MAX_MESSAGES;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.maxToolCalls = config.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS;
    this.timeoutMinutes = config.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES;
    this.maxDiffSize = config.maxDiffSize ?? DEFAULT_MAX_DIFF_SIZE;
    this.maxRetriesPerStep =
      config.maxRetriesPerStep ?? DEFAULT_MAX_RETRIES_PER_STEP;
    this.maxDelegationDepth =
      config.maxDelegationDepth ?? DEFAULT_MAX_DELEGATION_DEPTH;
    this.maxBudgetCents = config.maxBudgetCents ?? DEFAULT_MAX_BUDGET_CENTS;
  }

  /**
   * Check if message count exceeds limit.
   */
  checkMessages(totalMessages: number): LimitViolation | undefined {
    if (totalMessages >= this.maxMessages) {
      return "max_messages";
    }
    return undefined;
  }

  /**
   * Check if token count exceeds limit.
   */
  checkTokens(totalTokens: number): LimitViolation | undefined {
    if (totalTokens >= this.maxTokens) {
      return "max_tokens";
    }
    return undefined;
  }

  /**
   * Check if tool call count exceeds per-message limit.
   */
  checkToolCalls(toolCallCount: number): LimitViolation | undefined {
    if (toolCallCount >= this.maxToolCalls) {
      return "max_tool_calls";
    }
    return undefined;
  }

  /**
   * Check if code diff size exceeds limit.
   */
  checkDiffSize(diffLines: number): LimitViolation | undefined {
    if (diffLines >= this.maxDiffSize) {
      return "max_diff_size";
    }
    return undefined;
  }

  /**
   * Check if retry count exceeds per-step limit (dead-letter threshold).
   */
  checkRetries(failedCount: number): LimitViolation | undefined {
    if (failedCount >= this.maxRetriesPerStep) {
      return "max_retries_per_step";
    }
    return undefined;
  }

  /**
   * Check if delegation depth exceeds limit (Nanobot N2).
   *
   * Uses agentMaxDepth if provided (from agent definitions),
   * otherwise falls back to this.maxDelegationDepth.
   */
  checkDelegationDepth(
    currentDepth: number,
    agentMaxDepth?: number,
  ): LimitViolation | undefined {
    const effectiveMax = agentMaxDepth ?? this.maxDelegationDepth;
    if (currentDepth >= effectiveMax) {
      return "max_delegation_depth";
    }
    return undefined;
  }

  /**
   * Check if budget has been exceeded (circuit breaker).
   */
  checkBudget(currentCostCents: number): LimitViolation | undefined {
    if (currentCostCents >= this.maxBudgetCents) {
      return "budget_exceeded";
    }
    return undefined;
  }

  /**
   * Check all limits in priority order. Returns first violation found.
   *
   * @returns Violation type if any limit exceeded, undefined if all pass.
   */
  checkAll(state: ConversationState = {}): LimitViolation | undefined {
    // Priority order: budget, messages, tokens, tools, retries, diff, depth
    const checks: (LimitViolation | undefined)[] = [
      this.checkBudget(state.currentCostCents ?? 0),
      this.checkMessages(state.totalMessages ?? 0),
      this.checkTokens(state.totalTokens ?? 0),
      this.checkToolCalls(state.toolCallCount ?? 0),
      this.checkRetries(state.failedCount ?? 0),
      this.checkDiffSize(state.diffLines ?? 0),
      this.checkDelegationDepth(state.delegationDepth ?? 0),
    ];

    for (const violation of checks) {
      if (violation !== undefined) {
        return violation;
      }
    }

    return undefined;
  }

  /**
   * Get human-readable description of a limit violation.
   */
  static describeViolation(
    violation: LimitViolation,
    current: number,
    max: number,
  ): string {
    switch (violation) {
      case "max_messages":
        return `Message limit reached: ${current}/${max}`;
      case "max_tokens":
        return `Token limit reached: ${current}/${max}`;
      case "max_tool_calls":
        return `Tool call limit reached: ${current}/${max}`;
      case "timeout_minutes":
        return `Session timeout: ${current} minutes`;
      case "max_diff_size":
        return `Diff size limit: ${current}/${max} lines`;
      case "max_retries_per_step":
        return `Retry limit reached: ${current}/${max} (dead-letter)`;
      case "max_delegation_depth":
        return `Delegation depth exceeded: ${current}/${max}`;
      case "budget_exceeded":
        return `Budget exceeded: ${current}/${max} cents`;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalLimits: ConversationLimits | undefined;

export function getConversationLimits(
  config?: ConversationLimitsConfig,
): ConversationLimits {
  if (!globalLimits) {
    globalLimits = new ConversationLimits(config);
  }
  return globalLimits;
}

/**
 * Reset the global ConversationLimits instance.
 * Useful for testing or reconfiguration.
 */
export function resetConversationLimits(): void {
  globalLimits = undefined;
}
