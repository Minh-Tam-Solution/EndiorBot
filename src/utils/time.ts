/**
 * EndiorBot Time Utilities
 *
 * Date and time formatting, parsing, and manipulation.
 * Provides consistent time handling across the application.
 *
 * @module utils/time
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 6-7
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Constants
// ============================================================================

/** Milliseconds per second */
export const MS_PER_SECOND = 1000;
/** Milliseconds per minute */
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
/** Milliseconds per hour */
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
/** Milliseconds per day */
export const MS_PER_DAY = 24 * MS_PER_HOUR;
/** Milliseconds per week */
export const MS_PER_WEEK = 7 * MS_PER_DAY;

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format date to ISO 8601 string.
 *
 * @param date - Date to format
 * @returns ISO string (e.g., "2026-02-22T10:30:00.000Z")
 */
export function toISOString(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Format date to ISO date only (YYYY-MM-DD).
 *
 * @param date - Date to format
 * @returns Date string (e.g., "2026-02-22")
 */
export function toDateString(date: Date = new Date()): string {
  const parts = date.toISOString().split("T");
  return parts[0] ?? "";
}

/**
 * Format date to ISO time only (HH:MM:SS).
 *
 * @param date - Date to format
 * @returns Time string (e.g., "10:30:00")
 */
export function toTimeString(date: Date = new Date()): string {
  const iso = date.toISOString();
  const timePart = iso.split("T")[1] ?? "";
  return timePart.split(".")[0] ?? "";
}

/**
 * Format date to human-readable string.
 *
 * @param date - Date to format
 * @param locale - Locale string (default: "en-US")
 * @returns Formatted date string
 */
export function formatDate(
  date: Date,
  locale: string = "en-US",
  options?: Intl.DateTimeFormatOptions,
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  };
  return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
}

/**
 * Format date to compact string (YYYYMMDD).
 *
 * @param date - Date to format
 * @returns Compact date string
 */
export function toCompactDate(date: Date = new Date()): string {
  return toDateString(date).replace(/-/g, "");
}

/**
 * Format date to compact timestamp (YYYYMMDD-HHMMSS).
 *
 * @param date - Date to format
 * @returns Compact timestamp string
 */
export function toCompactTimestamp(date: Date = new Date()): string {
  const iso = date.toISOString().replace(/[-:T]/g, "");
  const beforeMs = iso.split(".")[0] ?? "";
  return beforeMs.replace(/(\d{8})(\d{6})/, "$1-$2");
}

// ============================================================================
// Duration Parsing
// ============================================================================

/**
 * Duration units for parsing.
 */
const DURATION_UNITS: Record<string, number> = {
  ms: 1,
  s: MS_PER_SECOND,
  sec: MS_PER_SECOND,
  second: MS_PER_SECOND,
  seconds: MS_PER_SECOND,
  m: MS_PER_MINUTE,
  min: MS_PER_MINUTE,
  minute: MS_PER_MINUTE,
  minutes: MS_PER_MINUTE,
  h: MS_PER_HOUR,
  hr: MS_PER_HOUR,
  hour: MS_PER_HOUR,
  hours: MS_PER_HOUR,
  d: MS_PER_DAY,
  day: MS_PER_DAY,
  days: MS_PER_DAY,
  w: MS_PER_WEEK,
  week: MS_PER_WEEK,
  weeks: MS_PER_WEEK,
};

/**
 * Parse duration string to milliseconds.
 *
 * @param duration - Duration string (e.g., "1h", "30m", "1d 12h")
 * @returns Duration in milliseconds, or undefined if invalid
 *
 * @example
 * ```typescript
 * parseDuration("1h") // 3600000
 * parseDuration("30m") // 1800000
 * parseDuration("1d 12h") // 129600000
 * parseDuration("500ms") // 500
 * ```
 */
export function parseDuration(duration: string): number | undefined {
  if (!duration || typeof duration !== "string") {
    return undefined;
  }

  // Match all value-unit pairs
  const pattern = /(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds?|m|min|minutes?|h|hr|hours?|d|days?|w|weeks?)/gi;
  const matches = [...duration.matchAll(pattern)];

  if (matches.length === 0) {
    // Try parsing as plain number (milliseconds)
    const num = Number(duration);
    return Number.isFinite(num) ? num : undefined;
  }

  let total = 0;
  for (const match of matches) {
    const valueStr = match[1];
    const unitStr = match[2];
    if (valueStr && unitStr) {
      const value = parseFloat(valueStr);
      const unit = unitStr.toLowerCase();
      const multiplier = DURATION_UNITS[unit];
      if (multiplier !== undefined) {
        total += value * multiplier;
      }
    }
  }

  return total;
}

/**
 * Parse duration with default value.
 *
 * @param duration - Duration string
 * @param defaultMs - Default value in milliseconds
 * @returns Duration in milliseconds
 */
export function parseDurationOrDefault(duration: string | undefined, defaultMs: number): number {
  if (!duration) return defaultMs;
  return parseDuration(duration) ?? defaultMs;
}

// ============================================================================
// Duration Formatting
// ============================================================================

/**
 * Options for formatting duration.
 */
export type FormatDurationOptions = {
  /** Include milliseconds */
  includeMs?: boolean;
  /** Abbreviated units (1h vs 1 hour) */
  short?: boolean;
  /** Maximum number of units to show */
  maxUnits?: number;
};

/**
 * Format milliseconds to human-readable duration.
 *
 * @param ms - Duration in milliseconds
 * @param options - Formatting options
 * @returns Formatted duration string
 *
 * @example
 * ```typescript
 * formatDuration(3665000) // "1 hour, 1 minute, 5 seconds"
 * formatDuration(3665000, { short: true }) // "1h 1m 5s"
 * ```
 */
export function formatDuration(ms: number, options: FormatDurationOptions = {}): string {
  const { includeMs = false, short = false, maxUnits = 3 } = options;

  if (ms < 0) {
    return short ? "-" : "0 seconds";
  }

  const units: Array<{ name: string; short: string; ms: number }> = [
    { name: "week", short: "w", ms: MS_PER_WEEK },
    { name: "day", short: "d", ms: MS_PER_DAY },
    { name: "hour", short: "h", ms: MS_PER_HOUR },
    { name: "minute", short: "m", ms: MS_PER_MINUTE },
    { name: "second", short: "s", ms: MS_PER_SECOND },
  ];

  if (includeMs) {
    units.push({ name: "millisecond", short: "ms", ms: 1 });
  }

  const parts: string[] = [];
  let remaining = ms;

  for (const unit of units) {
    if (parts.length >= maxUnits) break;

    const value = Math.floor(remaining / unit.ms);
    if (value > 0) {
      if (short) {
        parts.push(`${value}${unit.short}`);
      } else {
        parts.push(`${value} ${unit.name}${value > 1 ? "s" : ""}`);
      }
      remaining -= value * unit.ms;
    }
  }

  if (parts.length === 0) {
    return short ? "0s" : "0 seconds";
  }

  return short ? parts.join(" ") : parts.join(", ");
}

/**
 * Format duration in compact form (HH:MM:SS).
 *
 * @param ms - Duration in milliseconds
 * @returns Compact duration string
 */
export function formatDurationCompact(ms: number): string {
  const totalSeconds = Math.floor(ms / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ============================================================================
// Relative Time
// ============================================================================

/**
 * Format relative time (e.g., "2 hours ago").
 *
 * @param date - Date to format
 * @param now - Reference date (default: current time)
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff > 0;

  const units: Array<{ threshold: number; unit: string; ms: number }> = [
    { threshold: MS_PER_MINUTE, unit: "second", ms: MS_PER_SECOND },
    { threshold: MS_PER_HOUR, unit: "minute", ms: MS_PER_MINUTE },
    { threshold: MS_PER_DAY, unit: "hour", ms: MS_PER_HOUR },
    { threshold: MS_PER_WEEK, unit: "day", ms: MS_PER_DAY },
    { threshold: MS_PER_WEEK * 52, unit: "week", ms: MS_PER_WEEK },
    { threshold: Infinity, unit: "year", ms: MS_PER_WEEK * 52 },
  ];

  for (const { threshold, unit, ms } of units) {
    if (absDiff < threshold) {
      const value = Math.round(absDiff / ms);
      if (value === 0) {
        return "just now";
      }
      const plural = value === 1 ? "" : "s";
      return isPast ? `${value} ${unit}${plural} ago` : `in ${value} ${unit}${plural}`;
    }
  }

  return formatDate(date);
}

// ============================================================================
// Time Manipulation
// ============================================================================

/**
 * Add duration to a date.
 *
 * @param date - Base date
 * @param ms - Milliseconds to add
 * @returns New date
 */
export function addTime(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/**
 * Subtract duration from a date.
 *
 * @param date - Base date
 * @param ms - Milliseconds to subtract
 * @returns New date
 */
export function subtractTime(date: Date, ms: number): Date {
  return new Date(date.getTime() - ms);
}

/**
 * Get start of day (00:00:00).
 *
 * @param date - Date to process
 * @returns Start of day
 */
export function startOfDay(date: Date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day (23:59:59.999).
 *
 * @param date - Date to process
 * @returns End of day
 */
export function endOfDay(date: Date = new Date()): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

// ============================================================================
// Time Comparison
// ============================================================================

/**
 * Check if date is in the past.
 *
 * @param date - Date to check
 * @param now - Reference date
 * @returns True if in past
 */
export function isPast(date: Date, now: Date = new Date()): boolean {
  return date.getTime() < now.getTime();
}

/**
 * Check if date is in the future.
 *
 * @param date - Date to check
 * @param now - Reference date
 * @returns True if in future
 */
export function isFuture(date: Date, now: Date = new Date()): boolean {
  return date.getTime() > now.getTime();
}

/**
 * Check if two dates are on the same day.
 *
 * @param a - First date
 * @param b - Second date
 * @returns True if same day
 */
export function isSameDay(a: Date, b: Date): boolean {
  return toDateString(a) === toDateString(b);
}

// ============================================================================
// Timestamps
// ============================================================================

/**
 * Get current Unix timestamp (seconds).
 *
 * @returns Unix timestamp
 */
export function unixTimestamp(): number {
  return Math.floor(Date.now() / MS_PER_SECOND);
}

/**
 * Convert Unix timestamp to Date.
 *
 * @param timestamp - Unix timestamp (seconds)
 * @returns Date object
 */
export function fromUnixTimestamp(timestamp: number): Date {
  return new Date(timestamp * MS_PER_SECOND);
}

/**
 * Get current timestamp in milliseconds.
 *
 * @returns Milliseconds since epoch
 */
export function now(): number {
  return Date.now();
}
