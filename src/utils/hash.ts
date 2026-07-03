/**
 * EndiorBot Hash Utilities
 *
 * Cryptographic hash functions for data integrity.
 * Uses Node.js built-in crypto module for performance.
 *
 * @module utils/hash
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 6-7
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { createHash, randomBytes, createHmac } from "node:crypto";

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * Supported hash algorithms.
 */
export type HashAlgorithm = "sha256" | "sha512" | "sha1" | "md5";

/**
 * Compute hash of a string.
 *
 * @param data - Data to hash
 * @param algorithm - Hash algorithm (default: "sha256")
 * @returns Hex-encoded hash
 *
 * @example
 * ```typescript
 * hash("hello") // "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
 * hash("hello", "md5") // "5d41402abc4b2a76b9719d911017c592"
 * ```
 */
export function hash(data: string, algorithm: HashAlgorithm = "sha256"): string {
  return createHash(algorithm).update(data).digest("hex");
}

/**
 * Compute SHA-256 hash.
 *
 * @param data - Data to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function sha256(data: string): string {
  return hash(data, "sha256");
}

/**
 * Compute SHA-512 hash.
 *
 * @param data - Data to hash
 * @returns Hex-encoded SHA-512 hash
 */
export function sha512(data: string): string {
  return hash(data, "sha512");
}

/**
 * Compute MD5 hash (for legacy/compatibility only).
 *
 * Note: MD5 is cryptographically broken. Use SHA-256 for security.
 *
 * @param data - Data to hash
 * @returns Hex-encoded MD5 hash
 */
export function md5(data: string): string {
  return hash(data, "md5");
}

// ============================================================================
// Buffer Hashing
// ============================================================================

/**
 * Compute hash of a buffer.
 *
 * @param buffer - Buffer to hash
 * @param algorithm - Hash algorithm (default: "sha256")
 * @returns Hex-encoded hash
 */
export function hashBuffer(buffer: Buffer, algorithm: HashAlgorithm = "sha256"): string {
  return createHash(algorithm).update(buffer).digest("hex");
}

// ============================================================================
// HMAC
// ============================================================================

/**
 * Compute HMAC of a string.
 *
 * @param data - Data to sign
 * @param key - Secret key
 * @param algorithm - Hash algorithm (default: "sha256")
 * @returns Hex-encoded HMAC
 *
 * @example
 * ```typescript
 * hmac("message", "secret") // HMAC-SHA256 signature
 * ```
 */
export function hmac(data: string, key: string, algorithm: HashAlgorithm = "sha256"): string {
  return createHmac(algorithm, key).update(data).digest("hex");
}

/**
 * Verify HMAC signature (timing-safe comparison).
 *
 * @param data - Original data
 * @param signature - Expected signature
 * @param key - Secret key
 * @param algorithm - Hash algorithm
 * @returns True if signature matches
 */
export function verifyHmac(
  data: string,
  signature: string,
  key: string,
  algorithm: HashAlgorithm = "sha256",
): boolean {
  const expected = hmac(data, key, algorithm);
  return timingSafeEqual(expected, signature);
}

// ============================================================================
// Random Generation
// ============================================================================

/**
 * Generate cryptographically secure random bytes.
 *
 * @param length - Number of bytes
 * @returns Hex-encoded random bytes
 */
export function randomHex(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Generate a random base64 string.
 *
 * @param length - Number of bytes (not characters)
 * @returns Base64-encoded random bytes
 */
export function randomBase64(length: number = 32): string {
  return randomBytes(length).toString("base64");
}

/**
 * Generate a URL-safe random string.
 *
 * @param length - Number of bytes
 * @returns URL-safe base64 string
 */
export function randomBase64Url(length: number = 32): string {
  return randomBytes(length)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate a random alphanumeric string.
 *
 * @param length - String length
 * @returns Random alphanumeric string
 */
export function randomAlphanumeric(length: number = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      result += chars[byte % chars.length];
    }
  }
  return result;
}

// ============================================================================
// UUID
// ============================================================================

/**
 * Generate a UUID v4.
 *
 * @returns UUID v4 string
 *
 * @example
 * ```typescript
 * uuid() // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function uuid(): string {
  const bytes = randomBytes(16);

  // Set version (4) and variant (RFC 4122)
  const byte6 = bytes[6];
  const byte8 = bytes[8];
  if (byte6 !== undefined && byte8 !== undefined) {
    bytes[6] = (byte6 & 0x0f) | 0x40;
    bytes[8] = (byte8 & 0x3f) | 0x80;
  }

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Check if string is a valid UUID.
 *
 * @param str - String to check
 * @returns True if valid UUID
 */
export function isUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// ============================================================================
// Comparison
// ============================================================================

/**
 * Timing-safe string comparison.
 *
 * Prevents timing attacks by ensuring comparison time is constant.
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

// ============================================================================
// Content Hash
// ============================================================================

/**
 * Generate a short content hash (for cache keys, etc.).
 *
 * @param content - Content to hash
 * @param length - Hash length (default: 8)
 * @returns Short hash
 */
export function shortHash(content: string, length: number = 8): string {
  return sha256(content).slice(0, length);
}

/**
 * Generate a deterministic ID from content.
 *
 * @param parts - Parts to include in ID
 * @returns Deterministic ID
 */
export function contentId(...parts: string[]): string {
  return shortHash(parts.join(":"), 12);
}
