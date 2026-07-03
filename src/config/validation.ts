/**
 * EndiorBot Configuration Validation
 *
 * Validation logic for configuration files.
 * Provides typed validation results with detailed error messages.
 *
 * @module config/validation
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 1-2
 * @authority ADR-001 Multi-Model Orchestrator, ADR-002 Project Context Switching
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import {
  parseConfig,
  parsePartialConfig,
  DEFAULT_CONFIG,
  type EndiorBotConfig,
  type ValidationResult,
  type ValidationIssue,
} from "./schema.js";

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Options for config validation.
 */
export type ValidateConfigOptions = {
  /** Apply defaults to missing fields */
  applyDefaults?: boolean;
  /** Strict mode - fail on unknown fields */
  strict?: boolean;
  /** Collect warnings for deprecated fields */
  collectWarnings?: boolean;
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a complete configuration object.
 *
 * @param input - Raw configuration data
 * @param options - Validation options
 * @returns Validation result with typed data or errors
 */
export function validateConfig(
  input: unknown,
  options: ValidateConfigOptions = {},
): ValidationResult<EndiorBotConfig> {
  const { applyDefaults = true, collectWarnings = true } = options;

  // Parse and validate
  const result = parseConfig(input);

  if (!result.ok) {
    return result;
  }

  // Apply defaults if requested
  let data = result.data;
  if (applyDefaults) {
    data = mergeWithDefaults(data);
  }

  // Collect warnings
  const warnings: ValidationIssue[] = [];
  if (collectWarnings) {
    warnings.push(...collectDeprecationWarnings(data));
  }

  return {
    ok: true,
    data,
    warnings,
  };
}

/**
 * Validate a partial configuration update.
 *
 * @param input - Partial configuration data
 * @param options - Validation options
 * @returns Validation result with typed partial data or errors
 */
export function validatePartialConfig(
  input: unknown,
  options: ValidateConfigOptions = {},
): ValidationResult<Partial<EndiorBotConfig>> {
  const { collectWarnings = true } = options;

  // Parse and validate
  const result = parsePartialConfig(input);

  if (!result.ok) {
    return result;
  }

  // Collect warnings
  const warnings: ValidationIssue[] = [];
  if (collectWarnings && result.data) {
    warnings.push(...collectDeprecationWarnings(result.data as EndiorBotConfig));
  }

  return {
    ok: true,
    data: result.data,
    warnings,
  };
}

/**
 * Deep merge two objects, with source values taking precedence over target.
 * Target provides defaults, source provides overrides.
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target } as T;

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (sourceValue === undefined) {
      // Keep target value (default)
      continue;
    }

    if (
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge nested objects
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      // Override with source value
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Merge config with defaults for missing fields.
 */
export function mergeWithDefaults(config: EndiorBotConfig): EndiorBotConfig {
  // Use DEFAULT_CONFIG as base, then merge user config
  return deepMerge(DEFAULT_CONFIG as EndiorBotConfig, config);
}

/**
 * Collect deprecation warnings for config fields.
 */
function collectDeprecationWarnings(_config: EndiorBotConfig): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];

  // Check for deprecated fields (none currently, but structure ready)
  // Example:
  // if (_config.someDeprecatedField) {
  //   warnings.push({
  //     path: 'someDeprecatedField',
  //     message: 'This field is deprecated. Use newField instead.',
  //     code: 'deprecated',
  //   });
  // }

  return warnings;
}

// ============================================================================
// Config Validator Class
// ============================================================================

/**
 * ConfigValidator provides stateful validation with caching.
 */
export class ConfigValidator {
  private lastValidConfig: EndiorBotConfig | undefined;
  private lastValidationTime: number | undefined;

  /**
   * Validate config and cache result.
   */
  validate(
    input: unknown,
    options: ValidateConfigOptions = {},
  ): ValidationResult<EndiorBotConfig> {
    const result = validateConfig(input, options);

    if (result.ok) {
      this.lastValidConfig = result.data;
      this.lastValidationTime = Date.now();
    }

    return result;
  }

  /**
   * Get last valid config if available.
   */
  getLastValidConfig(): EndiorBotConfig | undefined {
    return this.lastValidConfig;
  }

  /**
   * Get time of last successful validation.
   */
  getLastValidationTime(): number | undefined {
    return this.lastValidationTime;
  }

  /**
   * Check if a cached config is available and not stale.
   *
   * @param maxAge - Maximum age in milliseconds
   */
  hasFreshConfig(maxAge: number = 60000): boolean {
    if (!this.lastValidConfig || !this.lastValidationTime) {
      return false;
    }
    return Date.now() - this.lastValidationTime < maxAge;
  }

  /**
   * Clear cached config.
   */
  clearCache(): void {
    this.lastValidConfig = undefined;
    this.lastValidationTime = undefined;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a value is a valid config object (basic structure check).
 */
export function isConfigLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extract validation error summary.
 */
export function formatValidationErrors(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return "No validation errors";
  }

  const lines = issues.map((issue) => {
    const path = issue.path || "(root)";
    return `  - ${path}: ${issue.message}`;
  });

  return `Validation failed with ${issues.length} error(s):\n${lines.join("\n")}`;
}

/**
 * Create a minimal valid config for testing.
 */
export function createMinimalConfig(): EndiorBotConfig {
  return {
    gateway: {
      port: 18790,
      host: "127.0.0.1",
    },
  };
}
