/**
 * EndiorBot String Utilities
 *
 * Common string manipulation functions.
 * Provides type-safe string operations for consistent formatting.
 *
 * @module utils/string
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 6
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Truncation
// ============================================================================

/**
 * Options for truncating strings.
 */
export type TruncateOptions = {
  /** Maximum length (default: 80) */
  length?: number;
  /** Suffix to append when truncated (default: "...") */
  suffix?: string;
  /** Truncate at word boundary (default: true) */
  wordBoundary?: boolean;
};

/**
 * Truncate a string to a maximum length.
 *
 * @param str - String to truncate
 * @param options - Truncation options
 * @returns Truncated string
 *
 * @example
 * ```typescript
 * truncate("Hello World", { length: 8 }) // "Hello..."
 * truncate("Hello World", { length: 8, suffix: "…" }) // "Hello W…"
 * ```
 */
export function truncate(str: string, options: TruncateOptions = {}): string {
  const { length = 80, suffix = "...", wordBoundary = true } = options;

  if (str.length <= length) {
    return str;
  }

  const targetLength = length - suffix.length;
  if (targetLength <= 0) {
    return suffix.slice(0, length);
  }

  let truncated = str.slice(0, targetLength);

  if (wordBoundary) {
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 0 && lastSpace > targetLength * 0.5) {
      truncated = truncated.slice(0, lastSpace);
    }
  }

  return truncated.trimEnd() + suffix;
}

// ============================================================================
// Case Conversion
// ============================================================================

/**
 * Capitalize the first letter of a string.
 *
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to camelCase.
 *
 * @param str - String to convert
 * @returns camelCase string
 */
export function camelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^./, (c) => c.toLowerCase());
}

/**
 * Convert string to PascalCase.
 *
 * @param str - String to convert
 * @returns PascalCase string
 */
export function pascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Convert string to kebab-case.
 *
 * @param str - String to convert
 * @returns kebab-case string
 */
export function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Convert string to snake_case.
 *
 * @param str - String to convert
 * @returns snake_case string
 */
export function snakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

/**
 * Convert string to CONSTANT_CASE.
 *
 * @param str - String to convert
 * @returns CONSTANT_CASE string
 */
export function constantCase(str: string): string {
  return snakeCase(str).toUpperCase();
}

// ============================================================================
// Slugify
// ============================================================================

/**
 * Options for slugifying strings.
 */
export type SlugifyOptions = {
  /** Separator character (default: "-") */
  separator?: string;
  /** Convert to lowercase (default: true) */
  lowercase?: boolean;
  /** Maximum length (default: unlimited) */
  maxLength?: number;
};

/**
 * Convert a string to a URL-safe slug.
 *
 * @param str - String to slugify
 * @param options - Slugify options
 * @returns URL-safe slug
 *
 * @example
 * ```typescript
 * slugify("Hello World!") // "hello-world"
 * slugify("Xin chào") // "xin-chao"
 * ```
 */
export function slugify(str: string, options: SlugifyOptions = {}): string {
  const { separator = "-", lowercase = true, maxLength } = options;

  let slug = str
    // Normalize unicode
    .normalize("NFD")
    // Remove diacritics
    .replace(/[\u0300-\u036f]/g, "")
    // Replace non-alphanumeric with separator
    .replace(/[^a-zA-Z0-9]+/g, separator)
    // Remove leading/trailing separators
    .replace(new RegExp(`^${escapeRegExp(separator)}+|${escapeRegExp(separator)}+$`, "g"), "")
    // Collapse multiple separators
    .replace(new RegExp(`${escapeRegExp(separator)}+`, "g"), separator);

  if (lowercase) {
    slug = slug.toLowerCase();
  }

  if (maxLength && slug.length > maxLength) {
    slug = slug.slice(0, maxLength);
    // Don't end with separator
    if (slug.endsWith(separator)) {
      slug = slug.slice(0, -separator.length);
    }
  }

  return slug;
}

// ============================================================================
// Padding
// ============================================================================

/**
 * Pad a string to a given length.
 *
 * @param str - String to pad
 * @param length - Target length
 * @param char - Padding character (default: " ")
 * @param position - Pad position (default: "end")
 * @returns Padded string
 */
export function pad(
  str: string,
  length: number,
  char: string = " ",
  position: "start" | "end" | "both" = "end",
): string {
  if (str.length >= length) return str;

  const padLength = length - str.length;

  switch (position) {
    case "start":
      return char.repeat(padLength) + str;
    case "end":
      return str + char.repeat(padLength);
    case "both": {
      const left = Math.floor(padLength / 2);
      const right = padLength - left;
      return char.repeat(left) + str + char.repeat(right);
    }
  }
}

// ============================================================================
// Escaping
// ============================================================================

/**
 * Escape special regex characters in a string.
 *
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Escape HTML special characters.
 *
 * @param str - String to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (c) => htmlEntities[c] ?? c);
}

// ============================================================================
// Pluralization
// ============================================================================

/**
 * Simple pluralization helper.
 *
 * @param count - Number of items
 * @param singular - Singular form
 * @param plural - Plural form (default: singular + "s")
 * @returns Pluralized string
 *
 * @example
 * ```typescript
 * pluralize(1, "file") // "1 file"
 * pluralize(5, "file") // "5 files"
 * pluralize(0, "child", "children") // "0 children"
 * ```
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}

// ============================================================================
// Lines
// ============================================================================

/**
 * Split string into lines.
 *
 * @param str - String to split
 * @returns Array of lines
 */
export function splitLines(str: string): string[] {
  return str.split(/\r?\n/);
}

/**
 * Join lines into a string.
 *
 * @param lines - Array of lines
 * @param separator - Line separator (default: "\n")
 * @returns Joined string
 */
export function joinLines(lines: string[], separator: string = "\n"): string {
  return lines.join(separator);
}

/**
 * Indent each line of a string.
 *
 * @param str - String to indent
 * @param spaces - Number of spaces (default: 2)
 * @returns Indented string
 */
export function indent(str: string, spaces: number = 2): string {
  const indentation = " ".repeat(spaces);
  return splitLines(str)
    .map((line) => (line ? indentation + line : line))
    .join("\n");
}

/**
 * Remove common leading whitespace from all lines.
 *
 * @param str - String to dedent
 * @returns Dedented string
 */
export function dedent(str: string): string {
  const lines = splitLines(str);

  // Find minimum indentation (ignoring empty lines)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim()) {
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      minIndent = Math.min(minIndent, indent);
    }
  }

  if (minIndent === Infinity || minIndent === 0) {
    return str;
  }

  return lines.map((line) => (line.trim() ? line.slice(minIndent) : line)).join("\n");
}

// ============================================================================
// Searching
// ============================================================================

/**
 * Check if string contains substring (case-insensitive).
 *
 * @param str - String to search in
 * @param search - Substring to find
 * @returns True if found
 */
export function containsIgnoreCase(str: string, search: string): boolean {
  return str.toLowerCase().includes(search.toLowerCase());
}

/**
 * Find all occurrences of a substring.
 *
 * @param str - String to search in
 * @param search - Substring to find
 * @returns Array of indices
 */
export function findAllOccurrences(str: string, search: string): number[] {
  const indices: number[] = [];
  let idx = str.indexOf(search);
  while (idx !== -1) {
    indices.push(idx);
    idx = str.indexOf(search, idx + 1);
  }
  return indices;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if string is empty or whitespace only.
 *
 * @param str - String to check
 * @returns True if empty or whitespace
 */
export function isBlank(str: string | null | undefined): boolean {
  return !str || !str.trim();
}

/**
 * Check if string is not empty and has non-whitespace content.
 *
 * @param str - String to check
 * @returns True if has content
 */
export function isNotBlank(str: string | null | undefined): str is string {
  return !!str && !!str.trim();
}
