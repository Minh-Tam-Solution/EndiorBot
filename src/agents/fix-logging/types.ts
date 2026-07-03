/**
 * Fix Logging Types
 *
 * Enhanced types for fix logging and learning engine.
 * Extends self-correction types with pattern tracking and learning support.
 *
 * @module agents/fix-logging/types
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 41 Fix Logging
 * @authority ADR-011 Fix Logging Architecture
 * @pillar 4 - Quality Assurance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type {
  ErrorCategory,
  ErrorSeverity,
  FixType,
  FixConfidence,
  FixStatus,
} from "../../self-correction/types.js";

// Re-export base types
export type {
  ErrorCategory,
  ErrorSeverity,
  FixType,
  FixConfidence,
  FixStatus,
};

// ============================================================================
// Enhanced Fix Log Entry
// ============================================================================

/**
 * Enhanced fix log entry for learning engine.
 * Extends basic FixLogEntry with pattern tracking and learning metadata.
 */
export interface EnhancedFixLogEntry {
  /** Unique entry ID (uuid) */
  id: string;
  /** Timestamp (ISO string) */
  timestamp: string;
  /** Session ID */
  sessionId: string;
  /** Track ID for parallel execution context */
  trackId?: string;
  /** Project ID */
  projectId?: string;

  /** Error information */
  error: FixLogError;
  /** Fix information */
  fix: FixLogFix;
  /** Outcome information */
  outcome: FixLogOutcome;

  /** Optional context for learning */
  context?: FixLogContext;
}

/**
 * Error information in fix log.
 */
export interface FixLogError {
  /** Error category */
  category: ErrorCategory;
  /** Error code (e.g., TS2304, prefer-const) */
  code: string;
  /** Error message */
  message: string;
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column?: number;
  /** Severity */
  severity: ErrorSeverity;
  /** Tool that reported the error */
  tool?: string;
}

/**
 * Fix information in fix log.
 */
export interface FixLogFix {
  /** Pattern ID for tracking (category:code:fixType) */
  patternId: string;
  /** Fix type */
  type: FixType;
  /** Fix description */
  description: string;
  /** Fix confidence */
  confidence: FixConfidence;
  /** Files modified */
  filesModified: string[];
  /** Diff information */
  diff?: FixDiff;
  /** Is AI-assisted fix? */
  isAiAssisted: boolean;
}

/**
 * Diff information for fix.
 */
export interface FixDiff {
  /** Original code */
  before: string;
  /** Fixed code */
  after: string;
  /** Number of lines changed */
  linesChanged: number;
}

/**
 * Outcome information in fix log.
 */
export interface FixLogOutcome {
  /** Fix status */
  status: FixStatus;
  /** Was the fix verified? */
  verified: boolean;
  /** Duration in ms */
  durationMs: number;
  /** Number of strikes used */
  strikesUsed: number;
  /** Was the error escalated? */
  escalated: boolean;
  /** Did it violate anti-cheat? */
  antiCheatViolation: boolean;
  /** New errors introduced? */
  newErrorsCount: number;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Context information for learning.
 */
export interface FixLogContext {
  /** File extension */
  fileExtension?: string;
  /** Is test file? */
  isTestFile?: boolean;
  /** Related error codes */
  relatedErrorCodes?: string[];
  /** Previous fix attempts count */
  previousAttempts?: number;
  /** Budget state at time of fix */
  budgetPercent?: number;
}

// ============================================================================
// Pattern Types
// ============================================================================

/**
 * Error pattern for learning.
 */
export interface ErrorPattern {
  /** Pattern ID (category:code:fixType) */
  id: string;
  /** Human-readable description */
  description: string;
  /** Error category */
  category: ErrorCategory;
  /** Error code */
  errorCode: string;
  /** Recommended fix type */
  fixType: FixType;
  /** Confidence level */
  confidence: FixConfidence;
  /** Pattern status */
  status: PatternStatus;
  /** Pattern metadata */
  metadata: PatternMetadata;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

/**
 * Pattern status.
 */
export type PatternStatus = "active" | "deprecated" | "experimental" | "disabled";

/**
 * Pattern metadata for learning.
 */
export interface PatternMetadata {
  /** Total times applied */
  appliedCount: number;
  /** Successful applications */
  successCount: number;
  /** Failed applications */
  failureCount: number;
  /** Escalation count */
  escalationCount: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average fix duration in ms */
  avgDurationMs: number;
  /** Last used timestamp */
  lastUsedAt?: string;
  /** Source of pattern */
  source: "manual" | "extracted" | "default";
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Weekly summary report.
 */
export interface WeeklySummary {
  /** Week start date (ISO) */
  weekStart: string;
  /** Week end date (ISO) */
  weekEnd: string;
  /** Total fix attempts */
  totalAttempts: number;
  /** Successful fixes */
  successfulFixes: number;
  /** Failed fixes */
  failedFixes: number;
  /** Escalated fixes */
  escalatedFixes: number;
  /** Success rate (0-1) */
  successRate: number;
  /** By category breakdown */
  byCategory: Record<ErrorCategory, CategorySummary>;
  /** Top patterns */
  topPatterns: PatternSummary[];
  /** Problematic patterns */
  problematicPatterns: PatternSummary[];
}

/**
 * Category summary in weekly report.
 */
export interface CategorySummary {
  /** Total errors */
  total: number;
  /** Fixed count */
  fixed: number;
  /** Remaining count */
  remaining: number;
  /** Success rate */
  successRate: number;
  /** Target rate */
  targetRate: number;
  /** Met target? */
  metTarget: boolean;
}

/**
 * Pattern summary in weekly report.
 */
export interface PatternSummary {
  /** Pattern ID */
  patternId: string;
  /** Total applications */
  count: number;
  /** Success rate */
  successRate: number;
  /** Trend (compared to previous week) */
  trend: "improving" | "stable" | "declining";
  /** Recommendation */
  recommendation?: string;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Fix log storage format.
 */
export interface FixLogStorage {
  /** Schema version */
  schemaVersion: string;
  /** Last updated */
  lastUpdated: string;
  /** Entries */
  entries: EnhancedFixLogEntry[];
  /** Metadata */
  metadata: {
    /** Total entries ever recorded */
    totalRecorded: number;
    /** Entries rotated out */
    rotatedCount: number;
    /** Last rotation date */
    lastRotation?: string;
  };
}

/**
 * Pattern storage format.
 */
export interface PatternStorage {
  /** Schema version */
  schemaVersion: string;
  /** Last updated */
  lastUpdated: string;
  /** Patterns */
  patterns: ErrorPattern[];
  /** Metadata */
  metadata: {
    /** Source description */
    source: string;
    /** Import date */
    importedAt?: string;
  };
}

// ============================================================================
// Query Types
// ============================================================================

/**
 * Fix log query options.
 */
export interface FixLogQueryOptions {
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by project ID */
  projectId?: string;
  /** Filter by category */
  category?: ErrorCategory;
  /** Filter by status */
  status?: FixStatus;
  /** Filter by pattern ID */
  patternId?: string;
  /** Filter by date range (start) */
  from?: Date;
  /** Filter by date range (end) */
  to?: Date;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort order */
  sortBy?: "timestamp" | "patternId" | "status";
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

/**
 * Pattern query options.
 */
export interface PatternQueryOptions {
  /** Filter by category */
  category?: ErrorCategory;
  /** Filter by status */
  status?: PatternStatus;
  /** Filter by error code */
  errorCode?: string;
  /** Minimum success rate */
  minSuccessRate?: number;
  /** Sort by */
  sortBy?: "successRate" | "appliedCount" | "createdAt";
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Current schema version for fix log storage.
 */
export const FIX_LOG_SCHEMA_VERSION = "1.0.0";

/**
 * Current schema version for pattern storage.
 */
export const PATTERN_SCHEMA_VERSION = "1.0.0";

/**
 * Maximum entries before rotation.
 */
export const MAX_LOG_ENTRIES = 10000;

/**
 * Entries to keep after rotation (80%).
 */
export const ROTATION_KEEP_PERCENT = 0.8;

/**
 * Default storage location.
 */
export const DEFAULT_STORAGE_DIR = "~/.endiorbot/learning";

/**
 * Fix log filename.
 */
export const FIX_LOG_FILENAME = "fix-log.json";

/**
 * Patterns filename.
 */
export const PATTERNS_FILENAME = "patterns.json";
