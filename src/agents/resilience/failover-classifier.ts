/**
 * Failover Classifier
 *
 * FailoverError classification + Provider Profile Key + Abort Matrix.
 * Ported from SDLC-Orchestrator: failover_classifier.py
 *
 * Features:
 *   - 6 classified error reasons (auth, format, rate_limit, billing, timeout, unknown)
 *   - Abort Matrix determines action per reason (ABORT, FALLBACK, RETRY)
 *   - Cooldown TTLs for rate limiting and circuit breaking
 *   - Error-as-string for LLM self-correction (Nanobot N3 pattern)
 *   - Provider Profile Key for multi-account tracking
 *
 * @module agents/resilience/failover-classifier
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.3 Implementation
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 6 classified error reasons — CTO verified against OpenClaw source.
 */
export type FailoverReason =
  | "auth"
  | "format"
  | "rate_limit"
  | "billing"
  | "timeout"
  | "unknown";

/**
 * What to do when a provider fails.
 */
export type FailoverAction = "abort" | "fallback" | "retry";

/**
 * Provider Profile Key components.
 */
export interface ProviderProfileKey {
  provider: string;
  account: string;
  region: string;
  modelFamily: string;
}

/**
 * Classification result with reason, action, and error string.
 */
export interface ClassificationResult {
  reason: FailoverReason;
  action: FailoverAction;
  errorString: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Abort vs Fallback Matrix (ADR-056 Decision 3).
 */
export const ABORT_MATRIX: Record<FailoverReason, FailoverAction> = {
  auth: "abort",
  billing: "abort",
  rate_limit: "fallback",
  timeout: "fallback",
  format: "retry",
  unknown: "abort",
};

/**
 * Cooldown TTLs in seconds per reason (for caching/Redis key expiry).
 */
export const COOLDOWN_TTLS: Record<FailoverReason, number> = {
  rate_limit: 60,
  timeout: 120,
  auth: 300,
  billing: 600,
  format: 0, // No cooldown for format errors
  unknown: 0, // No cooldown for unknown errors
};

/**
 * Network error patterns for timeout detection.
 */
const TIMEOUT_PATTERN =
  /timeout|timed out|deadline exceeded|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i;

// ============================================================================
// Provider Profile Key Functions
// ============================================================================

/**
 * Format a ProviderProfileKey as a string.
 *
 * Format: {provider}:{account}:{region}:{model_family}
 *
 * @example
 * formatProfileKey({ provider: "anthropic", account: "default", region: "us", modelFamily: "claude" })
 * // Returns: "anthropic:default:us:claude"
 */
export function formatProfileKey(key: ProviderProfileKey): string {
  return `${key.provider}:${key.account}:${key.region}:${key.modelFamily}`;
}

/**
 * Parse a provider profile key string.
 *
 * @param keyStr - String in format "provider:account:region:model_family"
 * @returns Parsed ProviderProfileKey
 * @throws Error if format is invalid
 */
export function parseProfileKey(keyStr: string): ProviderProfileKey {
  const parts = keyStr.split(":");
  if (parts.length !== 4) {
    throw new Error(
      `Invalid provider profile key: "${keyStr}". ` +
        `Expected format: provider:account:region:model_family`,
    );
  }
  // Safe after length check - use non-null assertion
  return {
    provider: parts[0] as string,
    account: parts[1] as string,
    region: parts[2] as string,
    modelFamily: parts[3] as string,
  };
}

/**
 * Get Redis/cache key for cooldown state.
 */
export function getCooldownKey(key: ProviderProfileKey): string {
  return `cooldown:${formatProfileKey(key)}`;
}

// ============================================================================
// Failover Classifier Class
// ============================================================================

/**
 * Classifies provider errors into 6 FailoverReasons and routes to
 * ABORT/FALLBACK/RETRY actions per the Abort Matrix (ADR-056 Decision 3).
 *
 * Error-as-String (Nanobot N3): For RETRY actions, returns error as
 * structured content for LLM self-correction instead of raising exceptions.
 */
export class FailoverClassifier {
  /**
   * Classify HTTP status codes into FailoverReasons.
   */
  classifyHttpError(statusCode: number): FailoverReason {
    if (statusCode === 401 || statusCode === 403) {
      return "auth";
    }
    if (statusCode === 402) {
      return "billing";
    }
    if (statusCode === 429) {
      return "rate_limit";
    }
    if (statusCode === 408 || statusCode === 504) {
      return "timeout";
    }
    if (statusCode === 400) {
      return "format";
    }
    return "unknown";
  }

  /**
   * Classify error messages into FailoverReasons.
   */
  classifyErrorMessage(errorMsg: string): FailoverReason {
    const lowerMsg = errorMsg.toLowerCase();

    if (TIMEOUT_PATTERN.test(errorMsg)) {
      return "timeout";
    }

    if (lowerMsg.includes("unauthorized") || lowerMsg.includes("forbidden")) {
      return "auth";
    }

    if (
      lowerMsg.includes("rate limit") ||
      lowerMsg.includes("too many requests")
    ) {
      return "rate_limit";
    }

    if (lowerMsg.includes("billing") || lowerMsg.includes("payment")) {
      return "billing";
    }

    if (lowerMsg.includes("invalid") || lowerMsg.includes("malformed")) {
      return "format";
    }

    return "unknown";
  }

  /**
   * Classify an Error object into FailoverReason.
   */
  classifyException(error: Error): FailoverReason {
    return this.classifyErrorMessage(error.message);
  }

  /**
   * Get the action for a classified error reason.
   */
  getAction(reason: FailoverReason): FailoverAction {
    return ABORT_MATRIX[reason];
  }

  /**
   * Get cooldown TTL in seconds for a given reason.
   */
  getCooldownTtl(reason: FailoverReason): number {
    return COOLDOWN_TTLS[reason];
  }

  /**
   * Format error as string content for LLM self-correction (Nanobot N3).
   *
   * For RETRY actions, this string is fed back into the conversation
   * as a system message so the LLM can self-correct.
   */
  formatErrorAsString(
    reason: FailoverReason,
    error: Error | string,
    providerKey?: ProviderProfileKey,
  ): string {
    const errorMsg = typeof error === "string" ? error : error.message;
    const providerInfo = providerKey
      ? ` (provider: ${formatProfileKey(providerKey)})`
      : "";
    return (
      `Error [${reason}]${providerInfo}: ${errorMsg}\n` +
      `Action: ${ABORT_MATRIX[reason]}`
    );
  }

  /**
   * Full classification pipeline: classify error, determine action,
   * format error string.
   *
   * @param error - The error to classify
   * @param providerKey - Optional provider profile key for context
   * @param statusCode - Optional HTTP status code (takes priority if provided)
   * @returns Classification result with reason, action, and error string
   */
  classifyAndRoute(
    error: Error,
    providerKey?: ProviderProfileKey,
    statusCode?: number,
  ): ClassificationResult {
    let reason: FailoverReason;

    if (statusCode !== undefined) {
      reason = this.classifyHttpError(statusCode);
    } else {
      reason = this.classifyException(error);
    }

    const action = this.getAction(reason);
    const errorString = this.formatErrorAsString(reason, error, providerKey);

    return { reason, action, errorString };
  }

  /**
   * Check if an action should trigger a fallback to another provider.
   */
  shouldFallback(action: FailoverAction): boolean {
    return action === "fallback";
  }

  /**
   * Check if an action should trigger a retry with the same provider.
   */
  shouldRetry(action: FailoverAction): boolean {
    return action === "retry";
  }

  /**
   * Check if an action should abort immediately.
   */
  shouldAbort(action: FailoverAction): boolean {
    return action === "abort";
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalClassifier: FailoverClassifier | undefined;

export function getFailoverClassifier(): FailoverClassifier {
  if (!globalClassifier) {
    globalClassifier = new FailoverClassifier();
  }
  return globalClassifier;
}

/**
 * Reset the global FailoverClassifier instance.
 * Useful for testing or reconfiguration.
 */
export function resetFailoverClassifier(): void {
  globalClassifier = undefined;
}
