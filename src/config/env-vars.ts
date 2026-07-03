/**
 * EndiorBot Environment Variables
 *
 * Environment variable definitions and utilities.
 * Provides type-safe access to environment configuration.
 *
 * @module config/env-vars
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 3-4
 * @authority ADR-001 Multi-Model Orchestrator, ADR-002 Project Context Switching
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { parseBooleanValue } from "../utils/boolean.js";

// ============================================================================
// Environment Variable Definitions
// ============================================================================

/**
 * All recognized EndiorBot environment variables.
 */
export const ENV_VARS = {
  // === Core Configuration ===
  /** State directory path */
  STATE_DIR: "ENDIORBOT_STATE_DIR",
  /** Config file path */
  CONFIG_PATH: "ENDIORBOT_CONFIG_PATH",
  /** Active profile name */
  PROFILE: "ENDIORBOT_PROFILE",

  // === Gateway ===
  /** Gateway server port */
  GATEWAY_PORT: "ENDIORBOT_GATEWAY_PORT",
  /** Gateway authentication token */
  GATEWAY_TOKEN: "ENDIORBOT_GATEWAY_TOKEN",

  // === API Keys (Provider-specific) ===
  /** Anthropic API key */
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
  /** OpenAI API key */
  OPENAI_API_KEY: "OPENAI_API_KEY",
  /** Google AI API key */
  GOOGLE_API_KEY: "GOOGLE_API_KEY",
  /** Mistral API key */
  MISTRAL_API_KEY: "MISTRAL_API_KEY",

  // === Logging ===
  /** Log level (debug, info, warn, error) */
  LOG_LEVEL: "ENDIORBOT_LOG_LEVEL",
  /** Enable debug mode */
  DEBUG: "ENDIORBOT_DEBUG",

  // === SDLC ===
  /** Project tier (LITE, STANDARD, PROFESSIONAL, ENTERPRISE) */
  TIER: "ENDIORBOT_TIER",

  // === Runtime Modes ===
  /** Nix mode (disable auto-install) */
  NIX_MODE: "ENDIORBOT_NIX_MODE",
  /** CI mode (non-interactive) */
  CI: "ENDIORBOT_CI",
  /** Test mode */
  TEST: "ENDIORBOT_TEST",

  // === OAuth ===
  /** OAuth credentials directory */
  OAUTH_DIR: "ENDIORBOT_OAUTH_DIR",

  // === Skip Flags ===
  /** Skip version check */
  SKIP_VERSION_CHECK: "ENDIORBOT_SKIP_VERSION_CHECK",
  /** Skip telemetry */
  SKIP_TELEMETRY: "ENDIORBOT_SKIP_TELEMETRY",
} as const;

/**
 * Type for environment variable names.
 */
export type EnvVarName = (typeof ENV_VARS)[keyof typeof ENV_VARS];

// ============================================================================
// Environment Variable Getters
// ============================================================================

/**
 * Get an environment variable value.
 *
 * @param name - Environment variable name
 * @param env - Environment object (default: process.env)
 * @returns Value or undefined
 */
export function getEnvVar(
  name: EnvVarName,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env[name]?.trim() || undefined;
}

/**
 * Get an environment variable as a string with default.
 *
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @param env - Environment object
 * @returns Value or default
 */
export function getEnvString(
  name: EnvVarName,
  defaultValue: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return getEnvVar(name, env) ?? defaultValue;
}

/**
 * Get an environment variable as a number.
 *
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set or invalid
 * @param env - Environment object
 * @returns Parsed number or default
 */
export function getEnvNumber(
  name: EnvVarName,
  defaultValue: number,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const value = getEnvVar(name, env);
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Get an environment variable as a boolean.
 *
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @param env - Environment object
 * @returns Parsed boolean or default
 */
export function getEnvBoolean(
  name: EnvVarName,
  defaultValue: boolean,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = getEnvVar(name, env);
  if (!value) return defaultValue;
  return parseBooleanValue(value) ?? defaultValue;
}

// ============================================================================
// Specific Environment Checks
// ============================================================================

/**
 * Check if running in Nix mode.
 */
export function isNixMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return getEnvBoolean(ENV_VARS.NIX_MODE, false, env);
}

/**
 * Check if running in CI environment.
 */
export function isCIMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    getEnvBoolean(ENV_VARS.CI, false, env) ||
    env.CI === "true" ||
    env.GITHUB_ACTIONS === "true" ||
    env.GITLAB_CI === "true"
  );
}

/**
 * Check if running in test mode.
 */
export function isTestMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    getEnvBoolean(ENV_VARS.TEST, false, env) ||
    env.NODE_ENV === "test" ||
    env.VITEST === "true"
  );
}

/**
 * Check if debug mode is enabled.
 */
export function isDebugMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return getEnvBoolean(ENV_VARS.DEBUG, false, env);
}

/**
 * Get the current log level from environment.
 */
export function getLogLevel(
  env: NodeJS.ProcessEnv = process.env,
): "debug" | "info" | "warn" | "error" {
  const level = getEnvVar(ENV_VARS.LOG_LEVEL, env)?.toLowerCase();
  if (level && ["debug", "info", "warn", "error"].includes(level)) {
    return level as "debug" | "info" | "warn" | "error";
  }
  return isDebugMode(env) ? "debug" : "info";
}

/**
 * Get gateway port from environment.
 */
export function getGatewayPort(env: NodeJS.ProcessEnv = process.env): number {
  return getEnvNumber(ENV_VARS.GATEWAY_PORT, 18790, env);
}

// ============================================================================
// API Key Helpers
// ============================================================================

/**
 * Get API key for a provider.
 *
 * @param provider - Provider name
 * @param env - Environment object
 * @returns API key or undefined
 */
export function getProviderApiKey(
  provider: "anthropic" | "openai" | "google" | "mistral",
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const keyMap: Record<string, string> = {
    anthropic: ENV_VARS.ANTHROPIC_API_KEY,
    openai: ENV_VARS.OPENAI_API_KEY,
    google: ENV_VARS.GOOGLE_API_KEY,
    mistral: ENV_VARS.MISTRAL_API_KEY,
  };
  const envVar = keyMap[provider];
  return envVar ? env[envVar]?.trim() || undefined : undefined;
}

/**
 * Check if API key is available for a provider.
 */
export function hasProviderApiKey(
  provider: "anthropic" | "openai" | "google" | "mistral",
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !!getProviderApiKey(provider, env);
}

/**
 * Get all available provider API keys.
 */
export function getAvailableProviders(
  env: NodeJS.ProcessEnv = process.env,
): Array<"anthropic" | "openai" | "google" | "mistral"> {
  const providers: Array<"anthropic" | "openai" | "google" | "mistral"> = [
    "anthropic",
    "openai",
    "google",
    "mistral",
  ];
  return providers.filter((p) => hasProviderApiKey(p, env));
}

// ============================================================================
// Environment Summary
// ============================================================================

/**
 * Get a summary of the current environment configuration.
 */
export function getEnvironmentSummary(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string | boolean | number | undefined> {
  return {
    stateDir: getEnvVar(ENV_VARS.STATE_DIR, env),
    configPath: getEnvVar(ENV_VARS.CONFIG_PATH, env),
    profile: getEnvVar(ENV_VARS.PROFILE, env),
    gatewayPort: getGatewayPort(env),
    logLevel: getLogLevel(env),
    debugMode: isDebugMode(env),
    nixMode: isNixMode(env),
    ciMode: isCIMode(env),
    testMode: isTestMode(env),
    availableProviders: getAvailableProviders(env).join(", ") || "none",
  };
}
