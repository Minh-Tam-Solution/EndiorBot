/**
 * Base Error Types for EndiorBot
 *
 * Unified error hierarchy for consistent error handling across the system.
 *
 * @module errors/base
 * @version 1.0.0
 * @date 2026-02-25
 * @status ACTIVE - Sprint 49 Day 2
 * @authority ADR-006 CLI Architecture
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Base error code categories.
 */
export type ErrorCategory =
  | "PROVIDER"
  | "GATEWAY"
  | "BRAIN"
  | "SECURITY"
  | "CONFIG"
  | "BUDGET"
  | "AGENT"
  | "SYSTEM";

/**
 * Error severity levels.
 */
export type ErrorSeverity = "critical" | "error" | "warning" | "info";

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Options for creating an EndiorBotError.
 */
export interface EndiorBotErrorOptions {
  code: string;
  category: ErrorCategory;
  retryable?: boolean;
  severity?: ErrorSeverity;
  metadata?: Record<string, unknown>;
  cause?: Error;
  /** Actionable recovery instruction for AI agents consuming this error */
  agentGuidance?: string;
}

/**
 * Base error class for all EndiorBot errors.
 *
 * Provides consistent error structure with:
 * - Error code for programmatic handling
 * - Retryable flag for retry logic
 * - Category for routing/filtering
 * - Metadata for additional context
 * - Serialization support
 */
export class EndiorBotError extends Error {
  /** Error category for routing */
  public readonly category: ErrorCategory;

  /** Error code for programmatic handling */
  public readonly code: string;

  /** Whether the operation can be retried */
  public readonly retryable: boolean;

  /** Error severity */
  public readonly severity: ErrorSeverity;

  /** Additional error context */
  public readonly metadata: Record<string, unknown>;

  /** Actionable recovery instruction for AI agents */
  public readonly agentGuidance?: string;

  /** Original error if this wraps another error */
  public readonly cause?: Error;

  /** Timestamp when error occurred */
  public readonly timestamp: string;

  constructor(message: string, options: EndiorBotErrorOptions) {
    super(message);
    this.name = "EndiorBotError";
    this.code = options.code;
    this.category = options.category;
    this.retryable = options.retryable ?? false;
    this.severity = options.severity ?? "error";
    this.metadata = options.metadata ?? {};
    if (options.agentGuidance) {
      this.agentGuidance = options.agentGuidance;
    }
    if (options.cause) {
      this.cause = options.cause;
    }
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize error for logging/transmission.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      retryable: this.retryable,
      severity: this.severity,
      metadata: this.metadata,
      agentGuidance: this.agentGuidance,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }

  /**
   * Create a user-friendly error message.
   */
  toUserMessage(): string {
    return `[${this.code}] ${this.message}`;
  }

  /**
   * Check if error is of a specific category.
   */
  isCategory(category: ErrorCategory): boolean {
    return this.category === category;
  }

  /**
   * Create a wrapped error with additional context.
   */
  wrap(additionalMessage: string): EndiorBotError {
    const opts: EndiorBotErrorOptions = {
      code: this.code,
      category: this.category,
      retryable: this.retryable,
      severity: this.severity,
      metadata: this.metadata,
      cause: this,
    };
    if (this.agentGuidance) {
      opts.agentGuidance = this.agentGuidance;
    }
    return new EndiorBotError(`${additionalMessage}: ${this.message}`, opts);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is an EndiorBotError.
 */
export function isEndiorBotError(error: unknown): error is EndiorBotError {
  return error instanceof EndiorBotError;
}

/**
 * Check if an error is retryable.
 */
export function isRetryable(error: unknown): boolean {
  if (isEndiorBotError(error)) {
    return error.retryable;
  }
  return false;
}

// ============================================================================
// Error Wrapping Utilities
// ============================================================================

/**
 * Wrap any error as an EndiorBotError.
 */
export function wrapError(
  error: unknown,
  options: {
    code?: string;
    category?: ErrorCategory;
    retryable?: boolean;
    metadata?: Record<string, unknown>;
  } = {}
): EndiorBotError {
  if (isEndiorBotError(error)) {
    // Already an EndiorBotError, optionally add metadata
    if (options.metadata) {
      const newOptions: EndiorBotErrorOptions = {
        code: options.code ?? error.code,
        category: options.category ?? error.category,
        retryable: options.retryable ?? error.retryable,
        severity: error.severity,
        metadata: { ...error.metadata, ...options.metadata },
      };
      if (error.cause) {
        newOptions.cause = error.cause;
      }
      if (error.agentGuidance) {
        newOptions.agentGuidance = error.agentGuidance;
      }
      return new EndiorBotError(error.message, newOptions);
    }
    return error;
  }

  const err = error instanceof Error ? error : new Error(String(error));

  return new EndiorBotError(err.message, {
    code: options.code ?? "UNKNOWN_ERROR",
    category: options.category ?? "SYSTEM",
    retryable: options.retryable ?? false,
    metadata: options.metadata ?? {},
    cause: err,
  });
}

/**
 * Extract error message from any error type.
 */
export function getErrorMessage(error: unknown): string {
  if (isEndiorBotError(error)) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
