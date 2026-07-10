/**
 * Minimal text helpers used across CLI and tools.
 *
 * Intentionally small: avoids the overhead of the larger utils/string module
 * while eliminating copy-pasted local helpers.
 *
 * @module utils/text-helpers
 * @version 1.0.0
 */

/**
 * Truncate a string to a maximum length, appending "..." when truncated.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length (including ellipsis)
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Pad a string to a fixed width with spaces on the right.
 * If the string is longer than the width, it is truncated.
 *
 * @param str - String to pad
 * @param width - Target width
 * @returns Padded or truncated string
 */
export function padEndTruncate(str: string, width: number): string {
  if (str.length >= width) {
    return str.slice(0, width);
  }
  return str + " ".repeat(width - str.length);
}
