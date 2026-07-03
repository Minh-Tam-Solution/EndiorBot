/**
 * Events Logger for Checkpoint/Resume System
 *
 * High-level API for logging events during autonomous execution.
 * Integrates with the Logger class and EventsWriter for dual output.
 *
 * @module logging/events-logger
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 1
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { Logger, type LoggerOptions } from "./logger.js";
import { type EventsWriter, createEventsWriter } from "./events-writer.js";
import {
  type EventLog,
  type EventPhase,
  type EventOutcome,
  createCheckpointEvent,
  createResumeEvent,
  createToolCallEvent,
  createGateEvent,
  createConflictEvent,
  createRollbackEvent,
} from "./event-types.js";

// ============================================================================
// Events Logger Options
// ============================================================================

/**
 * Options for EventsLogger.
 */
export interface EventsLoggerOptions extends LoggerOptions {
  /** State directory for events.jsonl (default: ~/.endiorbot/) */
  stateDir?: string;
  /** Enable writing to events.jsonl (default: true) */
  writeToFile?: boolean;
  /** Enable structured logging via Logger (default: true) */
  logToConsole?: boolean;
}

// ============================================================================
// Events Logger Class
// ============================================================================

/**
 * Events logger for checkpoint/resume system.
 *
 * Provides a high-level API for logging events during autonomous execution.
 * Events are written to both:
 * - ~/.endiorbot/events.jsonl (append-only JSONL for replay/analysis)
 * - Console/transports via Logger (for real-time visibility)
 *
 * @example
 * ```typescript
 * const eventsLogger = new EventsLogger({ name: "autonomy" });
 *
 * // Log checkpoint creation
 * await eventsLogger.checkpoint("save_checkpoint", "success", 12, {
 *   reason: "gate_pass",
 *   gate: "G1",
 * });
 *
 * // Log tool call
 * await eventsLogger.toolCall("file_write", "write_file", "success", 0.001);
 *
 * // Cleanup
 * await eventsLogger.close();
 * ```
 */
export class EventsLogger {
  private readonly logger: Logger;
  private readonly writer: EventsWriter | null;
  private readonly writeToFile: boolean;
  private readonly logToConsole: boolean;

  constructor(options: EventsLoggerOptions = {}) {
    const loggerOptions: LoggerOptions = {
      name: options.name ?? "events",
      level: options.level ?? "debug",
      format: options.format ?? "json",
      redaction: options.redaction ?? "tools",
    };
    if (options.transports !== undefined) {
      loggerOptions.transports = options.transports;
    }
    if (options.context !== undefined) {
      loggerOptions.context = options.context;
    }

    this.logger = new Logger(loggerOptions);

    this.writeToFile = options.writeToFile !== false;
    this.logToConsole = options.logToConsole !== false;

    if (this.writeToFile) {
      this.writer = createEventsWriter(options.stateDir);
    } else {
      this.writer = null;
    }
  }

  /**
   * Log an event to both file and console.
   */
  private async logEvent(event: EventLog): Promise<void> {
    // Write to JSONL file
    if (this.writeToFile && this.writer) {
      await this.writer.write(event);
    }

    // Log to console/transports
    if (this.logToConsole) {
      const level = event.outcome === "failure" ? "error" : "info";
      const context: Record<string, unknown> = {
        phase: event.phase,
        action: event.action,
        outcome: event.outcome,
        files_touched_count: event.files_touched_count,
        retry_count: event.retry_count,
      };

      if (event.tool !== undefined) {
        context.tool = event.tool;
      }
      if (event.cost_delta !== undefined) {
        context.cost_delta = event.cost_delta;
      }
      if (event.context !== undefined) {
        context.event_context = event.context;
      }

      this.logger[level](`[${event.phase}] ${event.action}`, context);
    }
  }

  // ==========================================================================
  // High-Level Event Methods
  // ==========================================================================

  /**
   * Log a checkpoint event.
   *
   * @param action - Action being performed (e.g., "save_checkpoint", "compress")
   * @param outcome - Outcome of the action
   * @param filesTouchedCount - Number of files touched
   * @param context - Additional context
   */
  async checkpoint(
    action: string,
    outcome: EventOutcome,
    filesTouchedCount: number,
    context?: Record<string, string>,
  ): Promise<void> {
    const event = createCheckpointEvent(action, outcome, filesTouchedCount, context);
    await this.logEvent(event);
  }

  /**
   * Log a resume event.
   *
   * @param action - Action being performed (e.g., "restore_session", "skip_completed")
   * @param outcome - Outcome of the action
   * @param filesTouchedCount - Number of files touched
   * @param retryCount - Number of retry attempts
   * @param context - Additional context
   */
  async resume(
    action: string,
    outcome: EventOutcome,
    filesTouchedCount: number,
    retryCount: number = 0,
    context?: Record<string, string>,
  ): Promise<void> {
    const event = createResumeEvent(action, outcome, filesTouchedCount, retryCount, context);
    await this.logEvent(event);
  }

  /**
   * Log a tool call event.
   *
   * @param tool - Tool name (e.g., "file_write", "git_commit")
   * @param action - Action being performed
   * @param outcome - Outcome of the action
   * @param costDelta - Cost incurred (in USD)
   * @param retryCount - Number of retry attempts
   * @param context - Additional context
   */
  async toolCall(
    tool: string,
    action: string,
    outcome: EventOutcome,
    costDelta?: number,
    retryCount: number = 0,
    context?: Record<string, string>,
  ): Promise<void> {
    const event = createToolCallEvent(tool, action, outcome, costDelta, retryCount, context);
    await this.logEvent(event);
  }

  /**
   * Log a gate evaluation event.
   *
   * @param gate - Gate ID (e.g., "G1", "G2")
   * @param outcome - Outcome of the evaluation
   * @param context - Additional context
   */
  async gate(gate: string, outcome: EventOutcome, context?: Record<string, string>): Promise<void> {
    const event = createGateEvent(gate, outcome, context);
    await this.logEvent(event);
  }

  /**
   * Log a conflict detection event.
   *
   * @param action - Action being performed (e.g., "detect_conflicts", "auto_resolve")
   * @param outcome - Outcome of the action
   * @param filesTouchedCount - Number of files with conflicts
   * @param context - Additional context
   */
  async conflict(
    action: string,
    outcome: EventOutcome,
    filesTouchedCount: number,
    context?: Record<string, string>,
  ): Promise<void> {
    const event = createConflictEvent(action, outcome, filesTouchedCount, context);
    await this.logEvent(event);
  }

  /**
   * Log a rollback event.
   *
   * @param action - Action being performed (e.g., "git_reset", "apply_patch")
   * @param outcome - Outcome of the action
   * @param filesTouchedCount - Number of files affected
   * @param context - Additional context
   */
  async rollback(
    action: string,
    outcome: EventOutcome,
    filesTouchedCount: number,
    context?: Record<string, string>,
  ): Promise<void> {
    const event = createRollbackEvent(action, outcome, filesTouchedCount, context);
    await this.logEvent(event);
  }

  /**
   * Log a generic execution event.
   *
   * @param phase - Event phase
   * @param action - Action being performed
   * @param outcome - Outcome of the action
   * @param options - Additional options
   */
  async execute(
    phase: EventPhase,
    action: string,
    outcome: EventOutcome,
    options: {
      tool?: string;
      costDelta?: number;
      filesTouchedCount?: number;
      retryCount?: number;
      context?: Record<string, string>;
    } = {},
  ): Promise<void> {
    const event: EventLog = {
      timestamp: new Date(),
      phase,
      action,
      outcome,
      files_touched_count: options.filesTouchedCount ?? 0,
      retry_count: options.retryCount ?? 0,
    };

    if (options.tool !== undefined) {
      event.tool = options.tool;
    }
    if (options.costDelta !== undefined) {
      event.cost_delta = options.costDelta;
    }
    if (options.context !== undefined) {
      event.context = options.context;
    }

    await this.logEvent(event);
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Flush pending writes.
   */
  async flush(): Promise<void> {
    if (this.writer) {
      await this.writer.flush();
    }
    await this.logger.flush();
  }

  /**
   * Close the events logger.
   */
  async close(): Promise<void> {
    if (this.writer) {
      await this.writer.close();
    }
    await this.logger.close();
  }

  /**
   * Get the underlying Logger instance.
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get the underlying EventsWriter instance.
   */
  getWriter(): EventsWriter | null {
    return this.writer;
  }

  /**
   * Get the events file path.
   */
  getEventsFilePath(): string | null {
    return this.writer?.getFilePath() ?? null;
  }
}

// ============================================================================
// Default Events Logger
// ============================================================================

let defaultEventsLogger: EventsLogger | null = null;

/**
 * Get or create the default events logger.
 */
export function getEventsLogger(): EventsLogger {
  if (!defaultEventsLogger) {
    defaultEventsLogger = new EventsLogger();
  }
  return defaultEventsLogger;
}

/**
 * Configure the default events logger.
 */
export function configureEventsLogger(options: EventsLoggerOptions): EventsLogger {
  if (defaultEventsLogger) {
    void defaultEventsLogger.close();
  }
  defaultEventsLogger = new EventsLogger(options);
  return defaultEventsLogger;
}

/**
 * Create a named events logger.
 */
export function createEventsLogger(
  name: string,
  options: Partial<EventsLoggerOptions> = {},
): EventsLogger {
  return new EventsLogger({ name, ...options });
}
