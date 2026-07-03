/**
 * EndiorBot Logging Module
 *
 * Unified entry point for structured logging functionality.
 * Provides loggers, formatters, redaction, transports, and event logging.
 *
 * @module logging
 * @version 1.1.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 1
 * @authority ADR-001 Multi-Model Orchestrator, ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Logger
// ============================================================================

export {
  // Core Logger
  Logger,
  getLogger,
  configureLogger,
  createLogger,
  // Types
  type LogLevel,
  type LogEntry,
  type LoggerOptions,
  type StandardLogFields,
  // Constants
  LOG_LEVEL_VALUES,
} from "./logger.js";

// ============================================================================
// Formatters
// ============================================================================

export {
  // Formatter Functions
  formatLog,
  formatJson,
  formatPretty,
  toStructuredLog,
  // Utilities
  stripColors,
  supportsColor,
  // Types
  type LogFormatter,
  type StructuredLog,
} from "./formatters.js";

// ============================================================================
// Redaction
// ============================================================================

export {
  // Redaction Functions
  redactSensitive,
  redactSensitiveWithTracking,
  redactString,
  // Detection Functions
  isSensitiveKey,
  isSensitiveValue,
  // Pattern Management
  addSensitiveKeyPattern,
  addSensitiveValuePattern,
  getSensitivePatternCount,
  // Types
  type RedactionLevel,
  type RedactionResult,
} from "./redaction.js";

// ============================================================================
// Transports
// ============================================================================

export {
  // Transport Classes
  ConsoleTransport,
  FileTransport,
  DailyFileTransport,
  // Factory Functions
  createConsoleTransport,
  createFileTransport,
  createDailyFileTransport,
  createTransports,
  // Utilities
  parseSize,
  // Types
  type Transport,
  type ConsoleTransportOptions,
  type FileTransportOptions,
  type DailyFileTransportOptions,
} from "./transports.js";

// ============================================================================
// Event Types (Sprint 35)
// ============================================================================

export {
  // Event Factory Functions
  createCheckpointEvent,
  createResumeEvent,
  createToolCallEvent,
  createGateEvent,
  createConflictEvent,
  createRollbackEvent,
  // Serialization
  serializeEvent,
  deserializeEvent,
  // Types
  type EventLog,
  type SerializedEventLog,
  type EventPhase,
  type EventOutcome,
} from "./event-types.js";

// ============================================================================
// Events Writer (Sprint 35)
// ============================================================================

export {
  // Writer Class
  EventsWriter,
  // Factory Function
  createEventsWriter,
} from "./events-writer.js";

// ============================================================================
// Events Logger (Sprint 35)
// ============================================================================

export {
  // Logger Class
  EventsLogger,
  // Factory Functions
  getEventsLogger,
  configureEventsLogger,
  createEventsLogger,
  // Types
  type EventsLoggerOptions,
} from "./events-logger.js";

// ============================================================================
// Configuration Integration (Sprint 49)
// ============================================================================

export {
  // Config Functions
  configureLoggerFromConfig,
  createTransportsFromConfig,
  getLogDirectory,
  getDefaultLoggingConfig,
  // Types
  type LoggingConfigInput,
} from "./config.js";

// ============================================================================
// Convenience Functions
// ============================================================================

import { Logger, type LoggerOptions } from "./logger.js";
import { createTransports, type FileTransportOptions } from "./transports.js";
import type { RedactionLevel } from "./redaction.js";

/**
 * Create a fully configured logger (CTO-approved API shape).
 *
 * @example
 * ```typescript
 * const logger = createConfiguredLogger({
 *   name: "app",
 *   level: "info",
 *   format: "pretty",
 *   redact: "tools",
 *   file: { path: "logs/app.log", maxSize: "10MB", maxFiles: 5 },
 * });
 *
 * // Create child logger with context
 * const childLogger = logger.child({
 *   component: "auth",
 *   projectId: "my-project-001",
 *   correlationId: "abc-123",
 * });
 * ```
 */
export function createConfiguredLogger(options: {
  name?: string;
  level?: LoggerOptions["level"];
  format?: LoggerOptions["format"];
  redact?: RedactionLevel;
  console?: boolean;
  file?: FileTransportOptions;
}): Logger {
  const transportConfig: {
    console?: boolean;
    file?: FileTransportOptions;
  } = {
    console: options.console !== false,
  };

  if (options.file) {
    transportConfig.file = options.file;
  }

  const transports = createTransports(transportConfig);

  const loggerOptions: LoggerOptions = {
    level: options.level ?? "info",
    format: options.format ?? "pretty",
    redaction: options.redact ?? "tools",
    transports,
  };

  if (options.name) {
    loggerOptions.name = options.name;
  }

  return new Logger(loggerOptions);
}
