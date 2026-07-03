/**
 * EndiorBot Utilities Module
 *
 * Unified entry point for all utility functions.
 * Provides type-safe helpers for common operations.
 *
 * @module utils
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 6-7
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Boolean Utilities
// ============================================================================

export { parseBooleanValue, type BooleanParseOptions } from "./boolean.js";

// ============================================================================
// String Utilities
// ============================================================================

export {
  // Truncation
  truncate,
  type TruncateOptions,
  // Case Conversion
  capitalize,
  camelCase,
  pascalCase,
  kebabCase,
  snakeCase,
  constantCase,
  // Slugify
  slugify,
  type SlugifyOptions,
  // Padding
  pad,
  // Escaping
  escapeRegExp,
  escapeHtml,
  // Pluralization
  pluralize,
  // Lines
  splitLines,
  joinLines,
  indent,
  dedent,
  // Searching
  containsIgnoreCase,
  findAllOccurrences,
  // Validation
  isBlank,
  isNotBlank,
} from "./string.js";

// ============================================================================
// JSON Utilities
// ============================================================================

export {
  // Safe Parsing
  safeJsonParse,
  parseJsonOrDefault,
  parseJsonOrUndefined,
  type ParseResult,
  // Safe Stringify
  safeJsonStringify,
  prettyJson,
  type StringifyOptions,
  // Object Utilities
  isPlainObject,
  sortObjectKeys,
  jsonClone,
  // Deep Merge
  deepMerge,
  deepMergeAll,
  // Path Access
  getByPath,
  setByPath,
  // Diffing
  shallowDiff,
  deepEqual,
} from "./json.js";

// ============================================================================
// Hash Utilities
// ============================================================================

export {
  // Hash Functions
  hash,
  sha256,
  sha512,
  md5,
  hashBuffer,
  type HashAlgorithm,
  // HMAC
  hmac,
  verifyHmac,
  // Random Generation
  randomHex,
  randomBase64,
  randomBase64Url,
  randomAlphanumeric,
  // UUID
  uuid,
  isUuid,
  // Comparison
  timingSafeEqual,
  // Content Hash
  shortHash,
  contentId,
} from "./hash.js";

// ============================================================================
// Time Utilities
// ============================================================================

export {
  // Constants
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  MS_PER_WEEK,
  // Formatting
  toISOString,
  toDateString,
  toTimeString,
  formatDate,
  toCompactDate,
  toCompactTimestamp,
  // Duration Parsing
  parseDuration,
  parseDurationOrDefault,
  // Duration Formatting
  formatDuration,
  formatDurationCompact,
  type FormatDurationOptions,
  // Relative Time
  formatRelativeTime,
  // Time Manipulation
  addTime,
  subtractTime,
  startOfDay,
  endOfDay,
  // Time Comparison
  isPast,
  isFuture,
  isSameDay,
  // Timestamps
  unixTimestamp,
  fromUnixTimestamp,
  now,
} from "./time.js";
