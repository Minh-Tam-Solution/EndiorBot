/**
 * EndiorBot JSON Utilities
 *
 * Safe JSON parsing and manipulation functions.
 * Provides error handling and type safety for JSON operations.
 *
 * @module utils/json
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 6
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Safe Parsing
// ============================================================================

/**
 * Result of JSON parse operation.
 */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Safely parse JSON string.
 *
 * @param json - JSON string to parse
 * @returns Parse result with data or error
 *
 * @example
 * ```typescript
 * const result = safeJsonParse('{"name": "test"}');
 * if (result.ok) {
 *   console.log(result.data.name);
 * }
 * ```
 */
export function safeJsonParse<T = unknown>(json: string): ParseResult<T> {
  try {
    const data = JSON.parse(json) as T;
    return { ok: true, data };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}

/**
 * Parse JSON with a default fallback value.
 *
 * @param json - JSON string to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed value or default
 */
export function parseJsonOrDefault<T>(json: string, defaultValue: T): T {
  const result = safeJsonParse<T>(json);
  return result.ok ? result.data : defaultValue;
}

/**
 * Parse JSON, returning undefined on failure.
 *
 * @param json - JSON string to parse
 * @returns Parsed value or undefined
 */
export function parseJsonOrUndefined<T>(json: string): T | undefined {
  const result = safeJsonParse<T>(json);
  return result.ok ? result.data : undefined;
}

// ============================================================================
// Safe Stringify
// ============================================================================

/**
 * Options for JSON stringify.
 */
export type StringifyOptions = {
  /** Pretty print with indentation */
  pretty?: boolean;
  /** Number of spaces for indentation (default: 2) */
  indent?: number;
  /** Replacer function or allowed keys */
  replacer?: (key: string, value: unknown) => unknown | null | string[];
  /** Sort object keys */
  sortKeys?: boolean;
};

/**
 * Safely stringify value to JSON.
 *
 * @param value - Value to stringify
 * @param options - Stringify options
 * @returns JSON string or error result
 */
export function safeJsonStringify(
  value: unknown,
  options: StringifyOptions = {},
): ParseResult<string> {
  try {
    const { pretty = false, indent = 2, replacer, sortKeys = false } = options;

    let actualValue = value;
    if (sortKeys && isPlainObject(value)) {
      actualValue = sortObjectKeys(value);
    }

    const space = pretty ? indent : undefined;
    const json = JSON.stringify(
      actualValue,
      replacer as (key: string, value: unknown) => unknown,
      space,
    );
    return { ok: true, data: json };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}

/**
 * Stringify value to pretty-printed JSON.
 *
 * @param value - Value to stringify
 * @param indent - Indentation spaces
 * @returns Pretty JSON string
 */
export function prettyJson(value: unknown, indent: number = 2): string {
  const result = safeJsonStringify(value, { pretty: true, indent });
  return result.ok ? result.data : "[Cannot stringify]";
}

// ============================================================================
// Object Utilities
// ============================================================================

/**
 * Check if value is a plain object.
 *
 * @param value - Value to check
 * @returns True if plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Sort object keys recursively.
 *
 * @param obj - Object to sort
 * @returns Object with sorted keys
 */
export function sortObjectKeys<T>(obj: T): T {
  if (!isPlainObject(obj)) {
    return obj;
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }

  return sorted as T;
}

/**
 * Deep clone a value using JSON serialization.
 *
 * Note: Does not preserve functions, Dates, or special objects.
 *
 * @param value - Value to clone
 * @returns Cloned value
 */
export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// ============================================================================
// Deep Merge
// ============================================================================

/**
 * Deep merge two objects.
 *
 * @param target - Target object (base)
 * @param source - Source object (overrides)
 * @returns Merged object
 *
 * @example
 * ```typescript
 * const result = deepMerge(
 *   { a: 1, b: { c: 2 } },
 *   { b: { d: 3 } }
 * );
 * // { a: 1, b: { c: 2, d: 3 } }
 * ```
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target } as T;

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (
      isPlainObject(sourceValue) &&
      isPlainObject(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Deep merge multiple objects.
 *
 * @param objects - Objects to merge (later objects override earlier)
 * @returns Merged object
 */
export function deepMergeAll<T extends Record<string, unknown>>(
  ...objects: Partial<T>[]
): T {
  let result = {} as T;
  for (const obj of objects) {
    result = deepMerge(result, obj);
  }
  return result;
}

// ============================================================================
// Path Access
// ============================================================================

/**
 * Get nested value by path.
 *
 * @param obj - Object to access
 * @param path - Dot-separated path
 * @param defaultValue - Default if not found
 * @returns Value at path or default
 *
 * @example
 * ```typescript
 * const obj = { a: { b: { c: 1 } } };
 * getByPath(obj, "a.b.c") // 1
 * getByPath(obj, "a.b.x", 0) // 0
 * ```
 */
export function getByPath<T = unknown>(
  obj: Record<string, unknown>,
  path: string,
  defaultValue?: T,
): T | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    if (typeof current !== "object") {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return (current as T) ?? defaultValue;
}

/**
 * Set nested value by path.
 *
 * @param obj - Object to modify
 * @param path - Dot-separated path
 * @param value - Value to set
 * @returns Modified object
 *
 * @example
 * ```typescript
 * const obj = { a: { b: 1 } };
 * setByPath(obj, "a.c", 2) // { a: { b: 1, c: 2 } }
 * ```
 */
export function setByPath<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown,
): T {
  const keys = path.split(".");
  const lastKey = keys.pop();

  if (!lastKey) {
    return obj;
  }

  let current: Record<string, unknown> = obj;

  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[lastKey] = value;
  return obj;
}

// ============================================================================
// Diffing
// ============================================================================

/**
 * Simple object diff (shallow comparison).
 *
 * @param a - First object
 * @param b - Second object
 * @returns Object with changed keys and their new values
 */
export function shallowDiff<T extends Record<string, unknown>>(
  a: T,
  b: T,
): Partial<T> {
  const diff: Partial<T> = {};

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    if (a[key] !== b[key]) {
      diff[key as keyof T] = b[key] as T[keyof T];
    }
  }

  return diff;
}

/**
 * Check if two values are deeply equal.
 *
 * @param a - First value
 * @param b - Second value
 * @returns True if deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
}
