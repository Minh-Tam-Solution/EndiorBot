/**
 * Config Command
 *
 * Manage EndiorBot configuration files.
 *
 * Usage:
 *   endiorbot config show          - Show current configuration
 *   endiorbot config path          - Show config file path
 *   endiorbot config init          - Initialize config file
 *   endiorbot config env           - Show environment variables
 *   endiorbot config validate      - Validate config file
 *
 * @module cli/commands/config
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 5
 * @authority ADR-001 Multi-Model Orchestrator, ADR-002 Project Context Switching
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync } from "node:fs";
import type { Command } from "commander";
import {
  CONFIG_PATH,
  STATE_DIR,
  resolveConfigPath,
} from "../../config/paths.js";
import {
  loadConfig,
  writeConfig,
  type LoadConfigResult,
} from "../../config/io.js";
import { DEFAULT_CONFIG } from "../../config/index.js";
import {
  getEnvironmentSummary,
  getAvailableProviders,
  isDebugMode,
  isCIMode,
  isNixMode,
  isTestMode,
} from "../../config/env-vars.js";

// ============================================================================
// Show Action
// ============================================================================

/**
 * Show current configuration.
 */
async function showAction(options: { raw?: boolean }): Promise<void> {
  const configPath = resolveConfigPath();
  const result = loadConfig({ configPath });

  if (!result.ok) {
    console.error("Error loading config:");
    console.error(`  ${result.error}`);
    process.exit(1);
  }

  console.log("");
  console.log(`Config file: ${configPath}`);
  console.log("");

  if (options.raw) {
    console.log(JSON.stringify(result.config, null, 2));
  } else {
    displayConfigSummary(result);
  }
}

/**
 * Display config summary in a nice format.
 */
function displayConfigSummary(result: LoadConfigResult): void {
  if (!result.ok) return;

  const config = result.config;

  console.log("Gateway:");
  console.log(`  Port: ${config.gateway?.port ?? 18790}`);
  console.log(`  Host: ${config.gateway?.host ?? "127.0.0.1"}`);
  console.log("");

  console.log("SDLC:");
  console.log(`  Framework: v${config.sdlc?.frameworkVersion ?? "6.4.0"}`);
  console.log(`  Tier: ${config.sdlc?.tier ?? "STANDARD"}`);
  console.log(`  Strict: ${config.sdlc?.strict ?? true}`);
  console.log("");

  console.log("Orchestrator:");
  console.log(`  Query Mode: ${config.orchestrator?.queryMode ?? "parallel"}`);
  console.log(`  Max Parallel: ${config.orchestrator?.maxParallelQueries ?? 3}`);
  console.log(`  Timeout: ${config.orchestrator?.perModelTimeout ?? 30000}ms`);
  console.log("");

  console.log("Logging:");
  console.log(`  Level: ${config.logging?.level ?? "info"}`);
  console.log(`  Format: ${config.logging?.format ?? "pretty"}`);
  console.log("");

  const providers = getAvailableProviders();
  console.log("Providers:");
  if (providers.length > 0) {
    providers.forEach((p) => console.log(`  - ${p} (API key set)`));
  } else {
    console.log("  No API keys configured");
  }
  console.log("");
}

// ============================================================================
// Path Action
// ============================================================================

/**
 * Show config file paths.
 */
async function pathAction(): Promise<void> {
  console.log("");
  console.log("Configuration Paths:");
  console.log(`  Config file: ${CONFIG_PATH}`);
  console.log(`  State dir:   ${STATE_DIR}`);
  console.log("");

  const exists = existsSync(CONFIG_PATH);
  console.log(`  Config exists: ${exists ? "Yes" : "No"}`);

  const stateDirExists = existsSync(STATE_DIR);
  console.log(`  State dir exists: ${stateDirExists ? "Yes" : "No"}`);
  console.log("");
}

// ============================================================================
// Init Action
// ============================================================================

/**
 * Initialize config file with defaults.
 */
async function initAction(options: { force?: boolean }): Promise<void> {
  const configPath = resolveConfigPath();

  if (existsSync(configPath) && !options.force) {
    console.log(`Config file already exists: ${configPath}`);
    console.log("Use --force to overwrite.");
    return;
  }

  const result = writeConfig(DEFAULT_CONFIG, { configPath });

  if (!result.ok) {
    console.error("Error writing config:");
    console.error(result.error);
    process.exit(1);
  }

  console.log("");
  console.log("Config file initialized:");
  console.log(`  Path: ${result.path}`);
  console.log("");
  console.log("Edit this file to customize your configuration.");
  console.log("Run 'endiorbot config show' to view the current settings.");
  console.log("");
}

// ============================================================================
// Env Action
// ============================================================================

/**
 * Show environment variables.
 */
async function envAction(): Promise<void> {
  const summary = getEnvironmentSummary();

  console.log("");
  console.log("Environment Configuration:");
  console.log("");

  console.log("Paths:");
  console.log(`  State Dir:    ${summary.stateDir ?? "(default: ~/.endiorbot)"}`);
  console.log(`  Config Path:  ${summary.configPath ?? "(default)"}`);
  console.log(`  Profile:      ${summary.profile ?? "(default)"}`);
  console.log("");

  console.log("Gateway:");
  console.log(`  Port:         ${summary.gatewayPort}`);
  console.log("");

  console.log("Logging:");
  console.log(`  Level:        ${summary.logLevel}`);
  console.log(`  Debug Mode:   ${summary.debugMode}`);
  console.log("");

  console.log("Runtime Modes:");
  console.log(`  Nix Mode:     ${isNixMode()}`);
  console.log(`  CI Mode:      ${isCIMode()}`);
  console.log(`  Test Mode:    ${isTestMode()}`);
  console.log(`  Debug Mode:   ${isDebugMode()}`);
  console.log("");

  console.log("Available Providers:");
  const providers = getAvailableProviders();
  if (providers.length > 0) {
    providers.forEach((p) => console.log(`  - ${p}`));
  } else {
    console.log("  None (set ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)");
  }
  console.log("");
}

// ============================================================================
// Set Action
// ============================================================================

/**
 * Forbidden keys that must not be set via config set.
 * These should use secure storage (keytar) or environment variables.
 */
const FORBIDDEN_CONFIG_KEYS = [
  "apiKey",
  "apikey",
  "api_key",
  "token",
  "secret",
  "password",
  "pat",
  "accessToken",
  "access_token",
];

/**
 * Set a configuration value.
 * Security: Rejects API keys and secrets - use secure storage instead.
 */
async function setAction(key: string, value: string): Promise<void> {
  // Security: Block API keys and secrets
  const keyLower = key.toLowerCase();
  const isForbidden = FORBIDDEN_CONFIG_KEYS.some(
    (forbidden) => keyLower.includes(forbidden.toLowerCase())
  );

  if (isForbidden) {
    console.error("");
    console.error("\x1b[31m✗ API keys must not be stored in config.\x1b[0m");
    console.error("");
    console.error("  Use secure storage instead:");
    console.error("    \x1b[36mendiorbot setup github\x1b[0m     (for GitHub Models)");
    console.error("    \x1b[36mexport ANTHROPIC_API_KEY=...\x1b[0m (for Anthropic)");
    console.error("    \x1b[36mexport OPENAI_API_KEY=...\x1b[0m   (for OpenAI)");
    console.error("");
    console.error("  Secrets in config files are:");
    console.error("    • Visible in git history if committed");
    console.error("    • Readable by any process with file access");
    console.error("    • Not rotated automatically");
    console.error("");
    process.exit(1);
  }

  // For now, just show help - full implementation would update config
  console.log("");
  console.log(`Setting ${key} = ${value}`);
  console.log("");
  console.log("\x1b[33mNote: config set is currently limited.\x1b[0m");
  console.log("Edit the config file directly: endiorbot config path");
  console.log("");
}

// ============================================================================
// Validate Action
// ============================================================================

/**
 * Validate config file.
 */
async function validateAction(): Promise<void> {
  const configPath = resolveConfigPath();

  if (!existsSync(configPath)) {
    console.log(`Config file not found: ${configPath}`);
    console.log("Run 'endiorbot config init' to create one.");
    return;
  }

  const result = loadConfig({ configPath });

  if (!result.ok) {
    console.error("Config validation FAILED:");
    console.error("");
    console.error(`  ${result.error}`);
    process.exit(1);
  }

  console.log("");
  console.log("Config validation PASSED");
  console.log(`  File: ${configPath}`);

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    result.warnings.forEach((w) => {
      console.log(`  - ${w.path}: ${w.message}`);
    });
  }

  console.log("");
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register config command.
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("Manage EndiorBot configuration");

  configCmd
    .command("show")
    .description("Show current configuration")
    .option("--raw", "Output raw JSON")
    .action(showAction);

  configCmd
    .command("path")
    .description("Show config file paths")
    .action(pathAction);

  configCmd
    .command("init")
    .description("Initialize config file with defaults")
    .option("-f, --force", "Overwrite existing config")
    .action(initAction);

  configCmd
    .command("env")
    .description("Show environment variable configuration")
    .action(envAction);

  configCmd
    .command("validate")
    .description("Validate config file")
    .action(validateAction);

  configCmd
    .command("set <key> <value>")
    .description("Set a configuration value (blocks API keys)")
    .action(setAction);
}
