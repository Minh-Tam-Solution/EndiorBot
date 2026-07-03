/**
 * EndiorBot CLI Logger
 *
 * Configures and provides logging for CLI operations.
 * Uses the logging module with CLI-appropriate settings.
 *
 * @module cli/logger
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 34 Day 3-4
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import {
  createConfiguredLogger,
  type Logger,
  type LogLevel,
} from "../logging/index.js";

// ============================================================================
// Configuration
// ============================================================================

interface CLILoggerConfig {
  /** Log level (default: "info") */
  level?: LogLevel;
  /** Enable verbose output */
  verbose?: boolean;
  /** Enable debug output */
  debug?: boolean;
  /** Log format: json or pretty (default: "pretty") */
  format?: "json" | "pretty";
  /** Log file path (optional) */
  logFile?: string;
}

// ============================================================================
// Singleton Logger
// ============================================================================

let cliLogger: Logger | undefined;

/**
 * Get or create the CLI logger.
 *
 * @param config - Logger configuration (only used on first call)
 * @returns CLI logger instance
 */
export function getCLILogger(config?: CLILoggerConfig): Logger {
  if (cliLogger) {
    return cliLogger;
  }

  const level = getLogLevel(config);
  const format = config?.format ?? "pretty";

  const loggerConfig: Parameters<typeof createConfiguredLogger>[0] = {
    name: "cli",
    level,
    format,
    redact: "tools",
    console: true,
  };

  if (config?.logFile) {
    loggerConfig.file = { path: config.logFile };
  }

  cliLogger = createConfiguredLogger(loggerConfig);

  return cliLogger;
}

/**
 * Determine log level from config and environment.
 */
function getLogLevel(config?: CLILoggerConfig): LogLevel {
  // Check environment first
  if (process.env.ENDIORBOT_DEBUG === "true") {
    return "debug";
  }
  if (process.env.ENDIORBOT_LOG_LEVEL) {
    const envLevel = process.env.ENDIORBOT_LOG_LEVEL.toLowerCase();
    if (["debug", "info", "warn", "error"].includes(envLevel)) {
      return envLevel as LogLevel;
    }
  }

  // Check config
  if (config?.debug) {
    return "debug";
  }
  if (config?.verbose) {
    return "debug";
  }
  if (config?.level) {
    return config.level;
  }

  return "info";
}

/**
 * Reset the CLI logger (for testing).
 */
export function resetCLILogger(): void {
  cliLogger = undefined;
}

// ============================================================================
// Component Loggers
// ============================================================================

/**
 * Create a child logger for a specific CLI component.
 *
 * @param component - Component name (e.g., "start", "gate", "config")
 * @returns Child logger with component context
 */
export function getComponentLogger(component: string): Logger {
  return getCLILogger().child({ component });
}

/**
 * Create a child logger for a specific command execution.
 *
 * @param command - Command name
 * @param projectId - Optional project ID for context
 * @returns Child logger with command context
 */
export function getCommandLogger(command: string, projectId?: string): Logger {
  const context: Record<string, unknown> = { command };
  if (projectId) {
    context.projectId = projectId;
  }
  return getCLILogger().child(context);
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Log a debug message (only shown with --verbose or --debug).
 */
export function logDebug(message: string, context?: Record<string, unknown>): void {
  getCLILogger().debug(message, context);
}

/**
 * Log an info message.
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
  getCLILogger().info(message, context);
}

/**
 * Log a warning message.
 */
export function logWarn(message: string, context?: Record<string, unknown>): void {
  getCLILogger().warn(message, context);
}

/**
 * Log an error message.
 */
export function logError(message: string, errorOrContext?: Error | Record<string, unknown>): void {
  getCLILogger().error(message, errorOrContext);
}
