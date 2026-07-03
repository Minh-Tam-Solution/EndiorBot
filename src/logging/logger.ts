/**
 * EndiorBot Logger
 *
 * Core logging functionality with levels, context, and child loggers.
 * Provides structured logging for consistent output across the application.
 *
 * @module logging/logger
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 8-9
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { formatLog, type LogFormatter } from "./formatters.js";
import { redactSensitive, type RedactionLevel } from "./redaction.js";
import { type Transport, ConsoleTransport } from "./transports.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Log levels in order of severity.
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Log level numeric values for comparison.
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * Standard fields for request tracing and session tracking.
 * Per ADR-001 (Multi-Model Orchestrator) and ADR-002 (Project Context Switching).
 */
export interface StandardLogFields {
  /** Unique ID for tracing requests across multi-model orchestrator calls */
  correlationId?: string;
  /** Session ID for project context tracking */
  sessionId?: string;
  /** Project ID for multi-project context switching */
  projectId?: string;
}

/**
 * Log entry structure.
 */
export interface LogEntry extends StandardLogFields {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Logger name/context */
  logger?: string;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Error object if applicable */
  error?: Error;
}

/**
 * Logger configuration options.
 */
export interface LoggerOptions extends StandardLogFields {
  /** Logger name for context */
  name?: string;
  /** Minimum log level */
  level?: LogLevel;
  /** Log output format */
  format?: "json" | "pretty";
  /** Redaction level for sensitive data */
  redaction?: RedactionLevel;
  /** Custom formatter */
  formatter?: LogFormatter;
  /** Output transports */
  transports?: Transport[];
  /** Additional context for all log entries */
  context?: Record<string, unknown>;
}

// ============================================================================
// Logger Class
// ============================================================================

/**
 * Structured logger with support for levels, context, and child loggers.
 *
 * @example
 * ```typescript
 * const logger = new Logger({ name: "app", level: "info" });
 * logger.info("Application started");
 * logger.error("Failed to connect", { host: "localhost" });
 *
 * const childLogger = logger.child({ module: "auth" });
 * childLogger.debug("Authenticating user");
 * ```
 */
export class Logger {
  private readonly name: string;
  private readonly level: LogLevel;
  private readonly format: "json" | "pretty";
  private readonly redaction: RedactionLevel;
  private readonly formatter: LogFormatter;
  private readonly transports: Transport[];
  private readonly context: Record<string, unknown>;
  // Standard fields for request tracing
  private readonly correlationId?: string;
  private readonly sessionId?: string;
  private readonly projectId?: string;

  constructor(options: LoggerOptions = {}) {
    this.name = options.name ?? "app";
    this.level = options.level ?? "info";
    this.format = options.format ?? "pretty";
    this.redaction = options.redaction ?? "tools";
    this.formatter = options.formatter ?? formatLog;
    this.transports = options.transports ?? [new ConsoleTransport()];
    this.context = options.context ?? {};
    // Standard fields - only set if provided (exactOptionalPropertyTypes)
    if (options.correlationId !== undefined) {
      this.correlationId = options.correlationId;
    }
    if (options.sessionId !== undefined) {
      this.sessionId = options.sessionId;
    }
    if (options.projectId !== undefined) {
      this.projectId = options.projectId;
    }
  }

  /**
   * Check if a log level should be output.
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.level];
  }

  /**
   * Write a log entry.
   */
  private write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // Apply redaction to context
    const redactedContext = entry.context
      ? redactSensitive(entry.context, this.redaction)
      : undefined;

    // Build the complete entry with standard fields
    const completeEntry: LogEntry = {
      ...entry,
      logger: this.name,
      context: { ...this.context, ...redactedContext },
    };
    // Include standard fields if set (exactOptionalPropertyTypes)
    const finalCorrelationId = entry.correlationId ?? this.correlationId;
    const finalSessionId = entry.sessionId ?? this.sessionId;
    const finalProjectId = entry.projectId ?? this.projectId;
    if (finalCorrelationId !== undefined) {
      completeEntry.correlationId = finalCorrelationId;
    }
    if (finalSessionId !== undefined) {
      completeEntry.sessionId = finalSessionId;
    }
    if (finalProjectId !== undefined) {
      completeEntry.projectId = finalProjectId;
    }

    // Format the log entry
    const formatted = this.formatter(completeEntry, this.format);

    // Write to all transports
    for (const transport of this.transports) {
      transport.write(entry.level, formatted);
    }
  }

  /**
   * Create a log entry and write it.
   */
  private log(
    level: LogLevel,
    message: string,
    contextOrError?: Record<string, unknown> | Error,
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
    };

    if (contextOrError instanceof Error) {
      entry.error = contextOrError;
      entry.context = {
        errorMessage: contextOrError.message,
        errorStack: contextOrError.stack,
      };
    } else if (contextOrError) {
      entry.context = contextOrError;
    }

    this.write(entry);
  }

  /**
   * Log a debug message.
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  /**
   * Log an info message.
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  /**
   * Log a warning message.
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  /**
   * Log an error message.
   */
  error(message: string, contextOrError?: Record<string, unknown> | Error): void {
    this.log("error", message, contextOrError);
  }

  /**
   * Log a fatal message (unrecoverable error).
   */
  fatal(message: string, contextOrError?: Record<string, unknown> | Error): void {
    this.log("fatal", message, contextOrError);
  }

  /**
   * Create a child logger with additional context.
   *
   * @param context - Additional context for child logger
   * @returns New logger instance with merged context
   */
  child(context: Record<string, unknown>): Logger {
    const options: LoggerOptions = {
      name: this.name,
      level: this.level,
      format: this.format,
      redaction: this.redaction,
      formatter: this.formatter,
      transports: this.transports,
      context: { ...this.context, ...context },
    };
    if (this.correlationId !== undefined) {
      options.correlationId = this.correlationId;
    }
    if (this.sessionId !== undefined) {
      options.sessionId = this.sessionId;
    }
    if (this.projectId !== undefined) {
      options.projectId = this.projectId;
    }
    return new Logger(options);
  }

  /**
   * Create a child logger with a new name.
   *
   * @param name - New logger name
   * @returns New logger instance with new name
   */
  named(name: string): Logger {
    const options: LoggerOptions = {
      name,
      level: this.level,
      format: this.format,
      redaction: this.redaction,
      formatter: this.formatter,
      transports: this.transports,
      context: this.context,
    };
    if (this.correlationId !== undefined) {
      options.correlationId = this.correlationId;
    }
    if (this.sessionId !== undefined) {
      options.sessionId = this.sessionId;
    }
    if (this.projectId !== undefined) {
      options.projectId = this.projectId;
    }
    return new Logger(options);
  }

  /**
   * Create a child logger with a correlation ID for request tracing.
   * Per ADR-001 Multi-Model Orchestrator.
   *
   * @param correlationId - Unique ID for tracing requests
   * @returns New logger instance with correlation ID
   */
  withCorrelation(correlationId: string): Logger {
    const options: LoggerOptions = {
      name: this.name,
      level: this.level,
      format: this.format,
      redaction: this.redaction,
      formatter: this.formatter,
      transports: this.transports,
      context: this.context,
      correlationId,
    };
    if (this.sessionId !== undefined) {
      options.sessionId = this.sessionId;
    }
    if (this.projectId !== undefined) {
      options.projectId = this.projectId;
    }
    return new Logger(options);
  }

  /**
   * Create a child logger with a session ID for session tracking.
   * Per ADR-002 Project Context Switching.
   *
   * @param sessionId - Session ID for tracking
   * @returns New logger instance with session ID
   */
  withSession(sessionId: string): Logger {
    const options: LoggerOptions = {
      name: this.name,
      level: this.level,
      format: this.format,
      redaction: this.redaction,
      formatter: this.formatter,
      transports: this.transports,
      context: this.context,
      sessionId,
    };
    if (this.correlationId !== undefined) {
      options.correlationId = this.correlationId;
    }
    if (this.projectId !== undefined) {
      options.projectId = this.projectId;
    }
    return new Logger(options);
  }

  /**
   * Create a child logger with a project ID for multi-project tracking.
   * Per ADR-002 Project Context Switching.
   *
   * @param projectId - Project ID for tracking
   * @returns New logger instance with project ID
   */
  withProject(projectId: string): Logger {
    const options: LoggerOptions = {
      name: this.name,
      level: this.level,
      format: this.format,
      redaction: this.redaction,
      formatter: this.formatter,
      transports: this.transports,
      context: this.context,
      projectId,
    };
    if (this.correlationId !== undefined) {
      options.correlationId = this.correlationId;
    }
    if (this.sessionId !== undefined) {
      options.sessionId = this.sessionId;
    }
    return new Logger(options);
  }

  /**
   * Create a child logger with all standard fields set.
   * Convenience method for setting correlation, session, and project at once.
   *
   * @param fields - Standard fields to set
   * @returns New logger instance with standard fields
   */
  withStandardFields(fields: StandardLogFields): Logger {
    const options: LoggerOptions = {
      name: this.name,
      level: this.level,
      format: this.format,
      redaction: this.redaction,
      formatter: this.formatter,
      transports: this.transports,
      context: this.context,
    };
    const finalCorrelationId = fields.correlationId ?? this.correlationId;
    const finalSessionId = fields.sessionId ?? this.sessionId;
    const finalProjectId = fields.projectId ?? this.projectId;
    if (finalCorrelationId !== undefined) {
      options.correlationId = finalCorrelationId;
    }
    if (finalSessionId !== undefined) {
      options.sessionId = finalSessionId;
    }
    if (finalProjectId !== undefined) {
      options.projectId = finalProjectId;
    }
    return new Logger(options);
  }

  /**
   * Get current log level.
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Get logger name.
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get correlation ID.
   */
  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  /**
   * Get session ID.
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Get project ID.
   */
  getProjectId(): string | undefined {
    return this.projectId;
  }

  /**
   * Get all standard fields.
   */
  getStandardFields(): StandardLogFields {
    const fields: StandardLogFields = {};
    if (this.correlationId !== undefined) {
      fields.correlationId = this.correlationId;
    }
    if (this.sessionId !== undefined) {
      fields.sessionId = this.sessionId;
    }
    if (this.projectId !== undefined) {
      fields.projectId = this.projectId;
    }
    return fields;
  }

  /**
   * Check if debug level is enabled.
   */
  isDebugEnabled(): boolean {
    return this.shouldLog("debug");
  }

  /**
   * Flush all transports (for graceful shutdown).
   */
  async flush(): Promise<void> {
    await Promise.all(this.transports.map((t) => t.flush?.() ?? Promise.resolve()));
  }

  /**
   * Close all transports.
   */
  async close(): Promise<void> {
    await Promise.all(this.transports.map((t) => t.close?.() ?? Promise.resolve()));
  }
}

// ============================================================================
// Default Logger
// ============================================================================

/**
 * Default application logger instance.
 */
let defaultLogger: Logger | undefined;

/**
 * Get or create the default logger.
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}

/**
 * Configure the default logger.
 */
export function configureLogger(options: LoggerOptions): Logger {
  defaultLogger = new Logger(options);
  return defaultLogger;
}

/**
 * Create a named logger (child of default).
 */
export function createLogger(name: string, options: Partial<LoggerOptions> = {}): Logger {
  const base = getLogger();
  const loggerOptions: LoggerOptions = {
    name,
    level: options.level ?? base.getLevel(),
  };

  if (options.format) {
    loggerOptions.format = options.format;
  }
  if (options.transports) {
    loggerOptions.transports = options.transports;
  }
  if (options.redaction) {
    loggerOptions.redaction = options.redaction;
  }
  if (options.context) {
    loggerOptions.context = options.context;
  }

  return new Logger(loggerOptions);
}
