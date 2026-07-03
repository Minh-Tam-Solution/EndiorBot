/**
 * EndiorBot Log Redaction
 *
 * Sensitive data redaction for log output.
 * Prevents accidental exposure of secrets, tokens, and API keys.
 *
 * @module logging/redaction
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 8-9
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Redaction levels.
 * - "none": No redaction
 * - "tools": Redact tool call sensitive data (API keys, tokens)
 * - "all": Redact all potentially sensitive data
 */
export type RedactionLevel = "none" | "tools" | "all";

/**
 * Redaction result for tracking what was redacted.
 */
export interface RedactionResult<T> {
  data: T;
  redactedKeys: string[];
}

// ============================================================================
// Patterns
// ============================================================================

/**
 * Sensitive key patterns (case-insensitive).
 */
const SENSITIVE_KEY_PATTERNS = [
  // API Keys
  /api[_-]?key/i,
  /apikey/i,
  /secret[_-]?key/i,
  /secretkey/i,
  /access[_-]?key/i,
  /accesskey/i,

  // Tokens
  /token/i,
  /bearer/i,
  /jwt/i,
  /auth[_-]?token/i,
  /refresh[_-]?token/i,
  /session[_-]?token/i,

  // Credentials
  /password/i,
  /passwd/i,
  /credential/i,
  /secret/i,

  // Private keys
  /private[_-]?key/i,
  /privatekey/i,
  /signing[_-]?key/i,

  // Provider-specific (only key-like names, not provider names)
  /anthropic[_-]?key/i,
  /openai[_-]?key/i,
  /aws[_-]?secret/i,
  /azure[_-]?key/i,
  /gcp[_-]?key/i,

  // OAuth
  /client[_-]?secret/i,

  // HTTP Headers
  /^authorization$/i,
  /^x-api-key$/i,
];

/**
 * Value patterns that indicate sensitive data.
 */
const SENSITIVE_VALUE_PATTERNS = [
  // API key formats
  /^sk-[a-zA-Z0-9]{20,}$/,  // OpenAI/Anthropic style
  /^pk-[a-zA-Z0-9]{20,}$/,  // Public key style
  /^api[_-][a-zA-Z0-9]{20,}$/i, // Generic API key

  // JWT tokens
  /^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,

  // Base64 encoded secrets (common pattern)
  /^[A-Za-z0-9+/]{40,}={0,2}$/,

  // AWS keys
  /^AKIA[0-9A-Z]{16}$/,
  /^[A-Za-z0-9/+=]{40}$/,

  // Private keys
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /-----BEGIN OPENSSH PRIVATE KEY-----/,
];

/**
 * Redaction placeholder.
 */
const REDACTED = "[REDACTED]";

// ============================================================================
// Redaction Functions
// ============================================================================

/**
 * Check if a key name indicates sensitive data.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Check if a value looks like sensitive data.
 */
export function isSensitiveValue(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Redact sensitive data from an object.
 *
 * @param data - Object to redact
 * @param level - Redaction level
 * @returns Redacted copy of the object
 */
export function redactSensitive<T>(data: T, level: RedactionLevel = "tools"): T {
  if (level === "none") {
    return data;
  }

  return redactValue(data, level, new Set()) as T;
}

/**
 * Redact sensitive data with tracking of redacted keys.
 *
 * @param data - Object to redact
 * @param level - Redaction level
 * @returns Redaction result with data and list of redacted keys
 */
export function redactSensitiveWithTracking<T>(
  data: T,
  level: RedactionLevel = "tools",
): RedactionResult<T> {
  if (level === "none") {
    return { data, redactedKeys: [] };
  }

  const redactedKeys: string[] = [];
  const redacted = redactValueWithTracking(data, level, [], redactedKeys, new Set());

  return {
    data: redacted as T,
    redactedKeys,
  };
}

/**
 * Internal recursive redaction.
 */
function redactValue(value: unknown, level: RedactionLevel, seen: Set<unknown>): unknown {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives
  if (typeof value !== "object") {
    // Check if string value looks sensitive
    if (level === "all" && typeof value === "string" && isSensitiveValue(value)) {
      return REDACTED;
    }
    return value;
  }

  // Prevent circular reference issues
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, level, seen));
  }

  // Handle objects
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
    } else if (level === "all" && typeof val === "string" && isSensitiveValue(val)) {
      result[key] = REDACTED;
    } else {
      result[key] = redactValue(val, level, seen);
    }
  }

  return result;
}

/**
 * Internal recursive redaction with tracking.
 */
function redactValueWithTracking(
  value: unknown,
  level: RedactionLevel,
  path: string[],
  redactedKeys: string[],
  seen: Set<unknown>,
): unknown {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives
  if (typeof value !== "object") {
    if (level === "all" && typeof value === "string" && isSensitiveValue(value)) {
      redactedKeys.push(path.join(".") || "(root)");
      return REDACTED;
    }
    return value;
  }

  // Prevent circular reference issues
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      redactValueWithTracking(item, level, [...path, String(index)], redactedKeys, seen),
    );
  }

  // Handle objects
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    const currentPath = [...path, key];

    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
      redactedKeys.push(currentPath.join("."));
    } else if (level === "all" && typeof val === "string" && isSensitiveValue(val)) {
      result[key] = REDACTED;
      redactedKeys.push(currentPath.join("."));
    } else {
      result[key] = redactValueWithTracking(val, level, currentPath, redactedKeys, seen);
    }
  }

  return result;
}

// ============================================================================
// String Redaction
// ============================================================================

/**
 * Redact sensitive patterns from a string.
 *
 * @param text - Text to redact
 * @returns Redacted text
 */
export function redactString(text: string): string {
  let result = text;

  // Redact API keys (sk-xxx, pk-xxx, sk-ant-xxx patterns)
  result = result.replace(/\b(sk-ant-|sk-proj-|sk-|pk-|api[-_])[a-zA-Z0-9-]{4,}/gi, "$1[REDACTED]");

  // Redact JWT tokens
  result = result.replace(
    /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
    "[REDACTED_JWT]",
  );

  // Redact Bearer tokens (must come after JWT to not double-redact)
  result = result.replace(/Bearer\s+(?!\[REDACTED)[a-zA-Z0-9_.-]+/gi, "Bearer [REDACTED]");

  // Redact AWS access keys
  result = result.replace(/\bAKIA[0-9A-Z]{16}\b/g, "AKIA[REDACTED]");

  // Redact common credential patterns in config strings
  result = result.replace(
    /(password|secret|token|apikey|api_key|api-key)\s*[=:]\s*["']?[^"'\s,}]+["']?/gi,
    "$1=[REDACTED]",
  );

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Add custom sensitive key pattern.
 */
export function addSensitiveKeyPattern(pattern: RegExp): void {
  SENSITIVE_KEY_PATTERNS.push(pattern);
}

/**
 * Add custom sensitive value pattern.
 */
export function addSensitiveValuePattern(pattern: RegExp): void {
  SENSITIVE_VALUE_PATTERNS.push(pattern);
}

/**
 * Get count of sensitive patterns.
 */
export function getSensitivePatternCount(): { keys: number; values: number } {
  return {
    keys: SENSITIVE_KEY_PATTERNS.length,
    values: SENSITIVE_VALUE_PATTERNS.length,
  };
}
