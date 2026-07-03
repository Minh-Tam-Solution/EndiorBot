/**
 * EndiorBot Log Formatters
 *
 * Format log entries for different output modes.
 * JSON for machine consumption, pretty for human readability.
 *
 * @module logging/formatters
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 8-9
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { LogEntry, LogLevel } from "./logger.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Log formatter function type.
 */
export type LogFormatter = (entry: LogEntry, format: "json" | "pretty") => string;

/**
 * Structured log output (shared fields for both formats).
 * Includes standard fields per ADR-001 and ADR-002.
 */
export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  logger: string;
  message: string;
  /** Correlation ID for request tracing (ADR-001) */
  correlationId?: string;
  /** Session ID for session tracking (ADR-002) */
  sessionId?: string;
  /** Project ID for multi-project tracking (ADR-002) */
  projectId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ============================================================================
// Level Formatting
// ============================================================================

/**
 * Level colors for pretty printing.
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m", // gray
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  fatal: "\x1b[35m", // magenta (unrecoverable)
};

/**
 * Level labels (padded for alignment).
 */
const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
  fatal: "FATAL",
};

const RESET_COLOR = "\x1b[0m";
const DIM_COLOR = "\x1b[2m";
const BOLD_COLOR = "\x1b[1m";

// ============================================================================
// Formatters
// ============================================================================

/**
 * Convert log entry to structured format.
 */
export function toStructuredLog(entry: LogEntry): StructuredLog {
  const structured: StructuredLog = {
    timestamp: entry.timestamp.toISOString(),
    level: entry.level,
    logger: entry.logger ?? "app",
    message: entry.message,
  };

  // Include standard fields if present
  if (entry.correlationId) {
    structured.correlationId = entry.correlationId;
  }
  if (entry.sessionId) {
    structured.sessionId = entry.sessionId;
  }
  if (entry.projectId) {
    structured.projectId = entry.projectId;
  }

  if (entry.context && Object.keys(entry.context).length > 0) {
    structured.context = entry.context;
  }

  if (entry.error) {
    const errorObj: StructuredLog["error"] = {
      name: entry.error.name,
      message: entry.error.message,
    };
    if (entry.error.stack) {
      errorObj.stack = entry.error.stack;
    }
    structured.error = errorObj;
  }

  return structured;
}

/**
 * Format log entry as JSON.
 *
 * @param entry - Log entry to format
 * @returns JSON string
 */
export function formatJson(entry: LogEntry): string {
  const structured = toStructuredLog(entry);

  try {
    return JSON.stringify(structured);
  } catch {
    // Handle circular references or other JSON errors
    return JSON.stringify({
      timestamp: structured.timestamp,
      level: structured.level,
      logger: structured.logger,
      message: structured.message,
      error: "Failed to serialize log entry",
    });
  }
}

/**
 * Format log entry as pretty text.
 *
 * @param entry - Log entry to format
 * @returns Pretty-printed string
 */
export function formatPretty(entry: LogEntry): string {
  const structured = toStructuredLog(entry);
  const color = LEVEL_COLORS[entry.level];
  const label = LEVEL_LABELS[entry.level];

  // Format timestamp (HH:MM:SS.mmm)
  const time = structured.timestamp.split("T")[1]?.split("Z")[0] ?? "";

  // Build the log line
  const parts: string[] = [];

  // Timestamp
  parts.push(`${DIM_COLOR}${time}${RESET_COLOR}`);

  // Level
  parts.push(`${color}${label}${RESET_COLOR}`);

  // Logger name
  if (structured.logger && structured.logger !== "app") {
    parts.push(`${DIM_COLOR}[${structured.logger}]${RESET_COLOR}`);
  }

  // Message
  parts.push(`${BOLD_COLOR}${structured.message}${RESET_COLOR}`);

  let output = parts.join(" ");

  // Context (on same line if small, otherwise indented)
  if (structured.context) {
    const contextStr = formatContext(structured.context);
    if (contextStr.length < 80) {
      output += ` ${DIM_COLOR}${contextStr}${RESET_COLOR}`;
    } else {
      output += `\n${DIM_COLOR}${indent(contextStr, 2)}${RESET_COLOR}`;
    }
  }

  // Error stack
  if (structured.error?.stack) {
    output += `\n${color}${indent(structured.error.stack, 2)}${RESET_COLOR}`;
  }

  return output;
}

/**
 * Format context object for display.
 */
function formatContext(context: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(context)) {
    if (key === "errorStack") continue; // Skip stack in inline context

    let valueStr: string;
    if (typeof value === "string") {
      valueStr = value.length > 50 ? `"${value.slice(0, 47)}..."` : `"${value}"`;
    } else if (typeof value === "number" || typeof value === "boolean") {
      valueStr = String(value);
    } else if (value === null) {
      valueStr = "null";
    } else if (value === undefined) {
      valueStr = "undefined";
    } else {
      try {
        valueStr = JSON.stringify(value);
        if (valueStr.length > 50) {
          valueStr = valueStr.slice(0, 47) + "...";
        }
      } catch {
        valueStr = "[Object]";
      }
    }

    parts.push(`${key}=${valueStr}`);
  }

  return parts.join(" ");
}

/**
 * Indent text by a number of spaces.
 */
function indent(text: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

// ============================================================================
// Main Formatter
// ============================================================================

/**
 * Format a log entry based on format type.
 *
 * @param entry - Log entry to format
 * @param format - Output format ("json" | "pretty")
 * @returns Formatted string
 */
export function formatLog(entry: LogEntry, format: "json" | "pretty"): string {
  if (format === "json") {
    return formatJson(entry);
  }
  return formatPretty(entry);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Strip ANSI color codes from a string.
 */
export function stripColors(str: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes use control chars
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Check if output supports colors.
 */
export function supportsColor(): boolean {
  // Check for NO_COLOR environment variable
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  // Check for FORCE_COLOR
  if (process.env.FORCE_COLOR !== undefined) {
    return true;
  }

  // Check if stdout is a TTY
  if (typeof process.stdout.isTTY === "boolean") {
    return process.stdout.isTTY;
  }

  return false;
}
