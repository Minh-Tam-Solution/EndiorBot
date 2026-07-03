/**
 * Error Types Module
 *
 * Unified error hierarchy for EndiorBot.
 *
 * @module errors
 * @version 1.0.0
 * @date 2026-02-25
 * @status ACTIVE - Sprint 49 Day 2
 * @authority ADR-006 CLI Architecture
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Base Error
// ============================================================================

export {
  EndiorBotError,
  isEndiorBotError,
  isRetryable,
  wrapError,
  getErrorMessage,
  type ErrorCategory,
  type ErrorSeverity,
} from "./base.js";

// ============================================================================
// Provider Errors
// ============================================================================

export {
  ProviderError,
  isProviderError,
  rateLimitError,
  authError,
  timeoutError,
  contextTooLongError,
  type ProviderErrorCode,
} from "./provider.js";

// ============================================================================
// Gateway Errors
// ============================================================================

export {
  GatewayError,
  isGatewayError,
  methodNotFoundError,
  invalidParamsError,
  authRequiredError,
  sessionNotFoundError,
  type GatewayErrorCode,
} from "./gateway.js";

// ============================================================================
// Brain Errors
// ============================================================================

export {
  BrainError,
  isBrainError,
  brainNotInitializedError,
  layerNotFoundError,
  brainStorageError,
  type BrainErrorCode,
} from "./brain.js";

// ============================================================================
// Security Errors
// ============================================================================

export {
  SecurityError,
  isSecurityError,
  injectionDetectedError,
  unauthorizedError,
  forbiddenError,
  tokenExpiredError,
  type SecurityErrorCode,
} from "./security.js";

// ============================================================================
// Config Errors
// ============================================================================

export {
  ConfigError,
  isConfigError,
  configNotFoundError,
  invalidJsonError,
  missingRequiredError,
  invalidValueError,
  envMissingError,
  type ConfigErrorCode,
} from "./config.js";

// ============================================================================
// Budget Errors
// ============================================================================

export {
  BudgetError,
  isBudgetError,
  budgetExceededError,
  budgetThresholdWarning,
  approvalRequiredError,
  approvalDeniedError,
  type BudgetErrorCode,
} from "./budget.js";

// ============================================================================
// Agent Errors
// ============================================================================

export {
  AgentError,
  isAgentError,
  agentNotFoundError,
  agentInactiveError,
  handoffBlockedError,
  handoffDepthExceededError,
  invalidTransitionError,
  workflowFailedError,
  workflowTimeoutError,
  invocationFailedError,
  invocationTimeoutError,
  contextTooLargeError,
  responseParseError,
  riskThresholdExceededError,
  modeNotAllowedError,
  type AgentErrorCode,
} from "./agent.js";

// ============================================================================
// Global Error Handler Setup
// ============================================================================

import { configureLoggerFromConfig, type Logger } from "../logging/index.js";
import { EndiorBotError, wrapError } from "./base.js";

// Global error logger instance
let errorLogger: Logger | undefined;

/**
 * Get or create the error logger with file transport.
 */
function getErrorLogger(): Logger {
  if (!errorLogger) {
    // Configure logger with file transport enabled
    errorLogger = configureLoggerFromConfig(
      {
        level: "debug", // Capture all error-related logs
        console: true,
        file: {
          enabled: true,
          dailyRotation: true,
          maxFiles: 7,
          maxSize: "10MB",
        },
      },
      "errors"
    );
  }
  return errorLogger;
}

/**
 * Install global error handlers for uncaught exceptions and rejections.
 */
export function installGlobalErrorHandlers(): void {
  const logger = getErrorLogger();

  process.on("uncaughtException", (error: Error) => {
    const wrapped = wrapError(error, { code: "UNCAUGHT_EXCEPTION" });
    logger.fatal("Uncaught exception", {
      error: wrapped.toJSON(),
    });
    // Exit with failure code for uncaught exceptions
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    const wrapped = wrapError(reason, { code: "UNHANDLED_REJECTION" });
    logger.error("Unhandled rejection", {
      error: wrapped.toJSON(),
    });
    // Don't exit for unhandled rejections, but log them
  });

  // Handle SIGTERM gracefully
  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down gracefully");
    process.exit(0);
  });

  // Handle SIGINT gracefully
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down gracefully");
    process.exit(0);
  });

  logger.debug("Global error handlers installed");
}

/**
 * Format an error for CLI output.
 */
export function formatErrorForCLI(error: unknown): string {
  if (error instanceof EndiorBotError) {
    const lines: string[] = [];
    lines.push(`Error: ${error.message}`);
    lines.push(`  Code: ${error.code}`);
    lines.push(`  Category: ${error.category}`);
    if (error.retryable) {
      lines.push(`  Retryable: yes`);
    }
    if (Object.keys(error.metadata).length > 0) {
      lines.push(`  Details: ${JSON.stringify(error.metadata)}`);
    }
    return lines.join("\n");
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Error: ${String(error)}`;
}

/**
 * Format an error for Gateway JSON-RPC response.
 */
export function formatErrorForGateway(
  error: unknown
): { code: number; message: string; data?: Record<string, unknown> } {
  if (error instanceof EndiorBotError) {
    return {
      code: getJsonRpcCode(error.category),
      message: error.message,
      data: {
        errorCode: error.code,
        category: error.category,
        retryable: error.retryable,
        metadata: error.metadata,
      },
    };
  }

  if (error instanceof Error) {
    return {
      code: -32603, // Internal error
      message: error.message,
    };
  }

  return {
    code: -32603,
    message: String(error),
  };
}

/**
 * Map error category to JSON-RPC error code.
 */
function getJsonRpcCode(category: string): number {
  switch (category) {
    case "GATEWAY":
      return -32000; // Server error
    case "SECURITY":
      return -32001; // Security error
    case "PROVIDER":
      return -32002; // Provider error
    case "BUDGET":
      return -32003; // Budget error
    case "CONFIG":
      return -32004; // Config error
    case "BRAIN":
      return -32005; // Brain error
    case "AGENT":
      return -32006; // Agent error
    default:
      return -32603; // Internal error
  }
}
