/**
 * EndiorBot Configuration I/O
 *
 * File system operations for reading and writing configuration.
 * Supports JSON5 format with environment variable substitution.
 *
 * @module config/io
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 3-4
 * @authority ADR-001 Multi-Model Orchestrator, ADR-002 Project Context Switching
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import fs from "node:fs";
import path from "node:path";
import JSON5 from "json5";
import { resolveConfigPath, resolveStateDir } from "./paths.js";
import { validateConfig, mergeWithDefaults } from "./validation.js";
import { DEFAULT_CONFIG, type EndiorBotConfig, type ValidationIssue } from "./schema.js";
import { ensureSecureDir, SECURE_FILE_MODE } from "../security/secure-fs.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of loading configuration.
 */
export type LoadConfigResult =
  | { ok: true; config: EndiorBotConfig; path: string; warnings: ValidationIssue[] }
  | { ok: false; error: string; path: string };

/**
 * Result of writing configuration.
 */
export type WriteConfigResult =
  | { ok: true; path: string; backup: string | undefined }
  | { ok: false; error: string };

/**
 * Options for loading configuration.
 */
export type LoadConfigOptions = {
  /** Path to config file (default: resolved from env/defaults) */
  configPath?: string;
  /** Apply defaults to missing fields */
  applyDefaults?: boolean;
  /** Substitute environment variables in config values */
  substituteEnv?: boolean;
  /** Create default config if file doesn't exist */
  createIfMissing?: boolean;
};

/**
 * Options for writing configuration.
 */
export type WriteConfigOptions = {
  /** Path to config file (default: resolved from env/defaults) */
  configPath?: string;
  /** Create backup before writing */
  backup?: boolean;
  /** Merge with existing config instead of overwriting */
  merge?: boolean;
  /** Pretty print JSON */
  pretty?: boolean;
};

// ============================================================================
// Environment Variable Substitution
// ============================================================================

/**
 * Pattern for environment variable substitution.
 * Matches: ${VAR_NAME} or ${VAR_NAME:-default}
 */
const ENV_VAR_PATTERN = /\$\{([^}:]+)(?::-([^}]*))?\}/g;

/**
 * Substitute environment variables in a string.
 *
 * @param value - String containing ${VAR} patterns
 * @param env - Environment variables (default: process.env)
 * @returns String with substituted values
 */
export function substituteEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return value.replace(ENV_VAR_PATTERN, (_match, varName, defaultValue) => {
    const envValue = env[varName];
    if (envValue !== undefined) {
      return envValue;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    // Return empty string if no value and no default
    return "";
  });
}

/**
 * Recursively substitute environment variables in an object.
 */
export function substituteEnvVarsDeep(
  obj: unknown,
  env: NodeJS.ProcessEnv = process.env,
): unknown {
  if (typeof obj === "string") {
    return substituteEnvVars(obj, env);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => substituteEnvVarsDeep(item, env));
  }
  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVarsDeep(value, env);
    }
    return result;
  }
  return obj;
}

// ============================================================================
// Config I/O Functions
// ============================================================================

/**
 * Load configuration from file.
 *
 * @param options - Loading options
 * @returns Configuration or error
 */
export function loadConfig(options: LoadConfigOptions = {}): LoadConfigResult {
  const {
    configPath = resolveConfigPath(),
    applyDefaults = true,
    substituteEnv = true,
    createIfMissing = false,
  } = options;

  // Check if file exists
  if (!fs.existsSync(configPath)) {
    if (createIfMissing) {
      // Create default config
      const writeResult = writeConfig(DEFAULT_CONFIG, { configPath, backup: false });
      if (!writeResult.ok) {
        return { ok: false, error: writeResult.error, path: configPath };
      }
      return {
        ok: true,
        config: DEFAULT_CONFIG,
        path: configPath,
        warnings: [],
      };
    }
    return {
      ok: false,
      error: `Config file not found: ${configPath}`,
      path: configPath,
    };
  }

  // Read file
  let content: string;
  try {
    content = fs.readFileSync(configPath, "utf-8");
  } catch (err) {
    return {
      ok: false,
      error: `Failed to read config file: ${err instanceof Error ? err.message : String(err)}`,
      path: configPath,
    };
  }

  // Parse JSON5
  let parsed: unknown;
  try {
    parsed = JSON5.parse(content);
  } catch (err) {
    return {
      ok: false,
      error: `Failed to parse config file: ${err instanceof Error ? err.message : String(err)}`,
      path: configPath,
    };
  }

  // Substitute environment variables
  if (substituteEnv) {
    parsed = substituteEnvVarsDeep(parsed);
  }

  // Validate
  const result = validateConfig(parsed, { applyDefaults });

  if (!result.ok) {
    return {
      ok: false,
      error: `Invalid configuration: ${result.issues.map((i) => i.message).join(", ")}`,
      path: configPath,
    };
  }

  return {
    ok: true,
    config: result.data,
    path: configPath,
    warnings: result.warnings,
  };
}

/**
 * Write configuration to file.
 *
 * @param config - Configuration to write
 * @param options - Writing options
 * @returns Success or error
 */
export function writeConfig(
  config: EndiorBotConfig | Partial<EndiorBotConfig>,
  options: WriteConfigOptions = {},
): WriteConfigResult {
  const {
    configPath = resolveConfigPath(),
    backup = true,
    merge = false,
    pretty = true,
  } = options;

  // Ensure directory exists with secure permissions (0o700)
  const dir = path.dirname(configPath);
  try {
    ensureSecureDir(dir);
  } catch (err) {
    return {
      ok: false,
      error: `Failed to create config directory: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Load existing config if merging
  let finalConfig = config;
  if (merge && fs.existsSync(configPath)) {
    const existing = loadConfig({ configPath, applyDefaults: false, substituteEnv: false });
    if (existing.ok) {
      finalConfig = mergeWithDefaults({
        ...existing.config,
        ...config,
      } as EndiorBotConfig);
    }
  }

  // Create backup if requested
  let backupPath: string | undefined;
  if (backup && fs.existsSync(configPath)) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      backupPath = `${configPath}.${timestamp}.bak`;
      fs.copyFileSync(configPath, backupPath);
    } catch (err) {
      // Backup failure is not fatal, but log it
      console.warn(
        `Warning: Failed to create backup: ${err instanceof Error ? err.message : String(err)}`,
      );
      backupPath = undefined;
    }
  }

  // Write config with secure permissions (0o600)
  try {
    const content = pretty
      ? JSON.stringify(finalConfig, null, 2)
      : JSON.stringify(finalConfig);
    fs.writeFileSync(configPath, content, { encoding: "utf-8", mode: SECURE_FILE_MODE });
  } catch (err) {
    return {
      ok: false,
      error: `Failed to write config file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {
    ok: true,
    path: configPath,
    backup: backupPath,
  };
}

/**
 * Update specific config values without rewriting entire file.
 *
 * @param updates - Partial config to merge
 * @param options - Writing options
 * @returns Success or error
 */
export function updateConfig(
  updates: Partial<EndiorBotConfig>,
  options: Omit<WriteConfigOptions, "merge"> = {},
): WriteConfigResult {
  return writeConfig(updates, { ...options, merge: true });
}

/**
 * Reset configuration to defaults.
 *
 * @param options - Writing options
 * @returns Success or error
 */
export function resetConfig(options: WriteConfigOptions = {}): WriteConfigResult {
  return writeConfig(DEFAULT_CONFIG, { ...options, merge: false });
}

/**
 * Ensure config directory exists with secure permissions and return its path.
 */
export function ensureConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  const stateDir = resolveStateDir(env);
  ensureSecureDir(stateDir);
  return stateDir;
}

// ============================================================================
// Config Cache
// ============================================================================

/**
 * Simple in-memory cache for loaded config.
 */
let cachedConfig: EndiorBotConfig | undefined;
let cacheTime: number | undefined;
const CACHE_TTL = 60000; // 1 minute

/**
 * Get config with caching.
 *
 * @param options - Loading options
 * @returns Configuration or error
 */
export function getConfig(
  options: LoadConfigOptions & { forceReload?: boolean } = {},
): LoadConfigResult {
  const { forceReload = false, ...loadOptions } = options;

  // Return cached if fresh
  if (
    !forceReload &&
    cachedConfig &&
    cacheTime &&
    Date.now() - cacheTime < CACHE_TTL
  ) {
    return {
      ok: true,
      config: cachedConfig,
      path: loadOptions.configPath ?? resolveConfigPath(),
      warnings: [],
    };
  }

  // Load and cache
  const result = loadConfig(loadOptions);
  if (result.ok) {
    cachedConfig = result.config;
    cacheTime = Date.now();
  }

  return result;
}

/**
 * Clear config cache.
 */
export function clearConfigCache(): void {
  cachedConfig = undefined;
  cacheTime = undefined;
}
