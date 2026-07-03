/**
 * Secrets Command
 *
 * View and manage stored credentials.
 *
 * Usage:
 *   endiorbot secrets list    - List all configured secrets
 *
 * @module cli/commands/secrets
 * @version 1.0.0
 * @date 2026-02-25
 * @status ACTIVE - Sprint 49 Day 7
 * @authority ADR-001 Security Best Practices
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { Command } from "commander";
import keytar from "keytar";
import {
  KEYTAR_SERVICE as GITHUB_KEYTAR_SERVICE,
  KEYTAR_ACCOUNT as GITHUB_KEYTAR_ACCOUNT,
} from "../../providers/github/config.js";

// ============================================================================
// Terminal Colors
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function green(text: string): string {
  return `${colors.green}${text}${colors.reset}`;
}

function red(text: string): string {
  return `${colors.red}${text}${colors.reset}`;
}

function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

// ============================================================================
// Keytar Service Names
// ============================================================================

const TELEGRAM_KEYTAR_SERVICE = "endiorbot-telegram";
const TELEGRAM_KEYTAR_ACCOUNT = "bot-token";

const ZALO_KEYTAR_SERVICE = "endiorbot-zalo";
const ZALO_KEYTAR_ACCOUNT = "access-token";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Mask a secret value for display.
 * Shows first few chars and last 4 chars.
 */
function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "••••••••";
  }
  // Show prefix (up to 7 chars) + dots + last 4 chars
  const prefix = value.slice(0, Math.min(7, value.length - 4));
  const suffix = value.slice(-4);
  return `${prefix}••••${suffix}`;
}

/**
 * Get keytar secret if available.
 */
async function getKeytarSecret(
  service: string,
  account: string
): Promise<string | null> {
  try {
    return await keytar.getPassword(service, account);
  } catch {
    return null;
  }
}

// ============================================================================
// List Action
// ============================================================================

/**
 * List all configured secrets.
 */
async function listAction(): Promise<void> {
  const processEnv = process.env;

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  EndiorBot Secrets"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  // ============================================================================
  // Keychain (OS Secure Storage)
  // ============================================================================

  console.log(`  ${bold("Keychain (OS Secure Storage):")}`);
  console.log("");

  // GitHub Models PAT
  const githubPat = await getKeytarSecret(GITHUB_KEYTAR_SERVICE, GITHUB_KEYTAR_ACCOUNT);
  if (githubPat) {
    console.log(`    GitHub Models PAT    ${green("✓ Configured")}  ${dim(`(${maskSecret(githubPat)})`)}`);
  } else {
    console.log(`    GitHub Models PAT    ${red("✗ Not set")}`);
  }

  // Telegram Bot Token
  const telegramToken = await getKeytarSecret(TELEGRAM_KEYTAR_SERVICE, TELEGRAM_KEYTAR_ACCOUNT);
  if (telegramToken) {
    console.log(`    Telegram Bot Token   ${green("✓ Configured")}  ${dim(`(${maskSecret(telegramToken)})`)}`);
  } else {
    console.log(`    Telegram Bot Token   ${red("✗ Not set")}`);
  }

  // Zalo Access Token
  const zaloToken = await getKeytarSecret(ZALO_KEYTAR_SERVICE, ZALO_KEYTAR_ACCOUNT);
  if (zaloToken) {
    console.log(`    Zalo Access Token    ${green("✓ Configured")}  ${dim(`(${maskSecret(zaloToken)})`)}`);
  } else {
    console.log(`    Zalo Access Token    ${red("✗ Not set")}`);
  }

  console.log("");

  // ============================================================================
  // Environment Variables
  // ============================================================================

  console.log(`  ${bold("Environment Variables:")}`);
  console.log("");

  // ANTHROPIC_API_KEY
  const anthropicKey = processEnv["ANTHROPIC_API_KEY"];
  if (anthropicKey) {
    console.log(`    ANTHROPIC_API_KEY    ${green("✓ Set")}  ${dim(`(${maskSecret(anthropicKey)})`)}`);
  } else {
    console.log(`    ANTHROPIC_API_KEY    ${red("✗ Not set")}`);
  }

  // OPENAI_API_KEY
  const openaiKey = processEnv["OPENAI_API_KEY"];
  if (openaiKey) {
    console.log(`    OPENAI_API_KEY       ${green("✓ Set")}  ${dim(`(${maskSecret(openaiKey)})`)}`);
  } else {
    console.log(`    OPENAI_API_KEY       ${red("✗ Not set")}`);
  }

  // GEMINI_API_KEY / GOOGLE_API_KEY
  const geminiKey = processEnv["GEMINI_API_KEY"] ?? processEnv["GOOGLE_API_KEY"];
  if (geminiKey) {
    console.log(`    GEMINI_API_KEY       ${green("✓ Set")}  ${dim(`(${maskSecret(geminiKey)})`)}`);
  } else {
    console.log(`    GEMINI_API_KEY       ${red("✗ Not set")}`);
  }

  // GITHUB_TOKEN (fallback for GitHub Models)
  const githubEnvToken = processEnv["GITHUB_TOKEN"];
  if (githubEnvToken && !githubPat) {
    // Only show if not in keytar (fallback)
    console.log(`    GITHUB_TOKEN         ${green("✓ Set")}  ${dim(`(${maskSecret(githubEnvToken)}) [fallback]`)}`);
  } else if (githubEnvToken && githubPat) {
    console.log(`    GITHUB_TOKEN         ${dim("Set (keytar preferred)")}`);
  }

  // TELEGRAM_BOT_TOKEN (fallback)
  const telegramEnvToken = processEnv["TELEGRAM_BOT_TOKEN"];
  if (telegramEnvToken && !telegramToken) {
    console.log(`    TELEGRAM_BOT_TOKEN   ${green("✓ Set")}  ${dim(`(${maskSecret(telegramEnvToken)}) [fallback]`)}`);
  } else if (telegramEnvToken && telegramToken) {
    console.log(`    TELEGRAM_BOT_TOKEN   ${dim("Set (keytar preferred)")}`);
  }

  // ZALO_ACCESS_TOKEN (fallback)
  const zaloEnvToken = processEnv["ZALO_ACCESS_TOKEN"];
  if (zaloEnvToken && !zaloToken) {
    console.log(`    ZALO_ACCESS_TOKEN    ${green("✓ Set")}  ${dim(`(${maskSecret(zaloEnvToken)}) [fallback]`)}`);
  } else if (zaloEnvToken && zaloToken) {
    console.log(`    ZALO_ACCESS_TOKEN    ${dim("Set (keytar preferred)")}`);
  }

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  // Help text
  console.log(`  ${dim("To configure secrets:")}`);
  console.log(`    ${dim("• GitHub:    endiorbot setup github")}`);
  console.log(`    ${dim("• Anthropic: export ANTHROPIC_API_KEY=sk-ant-...")}`);
  console.log(`    ${dim("• OpenAI:    export OPENAI_API_KEY=sk-...")}`);
  console.log("");
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register secrets command.
 */
export function registerSecretsCommand(program: Command): void {
  const secrets = program
    .command("secrets")
    .description("Manage stored credentials");

  secrets
    .command("list")
    .description("List all configured secrets")
    .action(listAction);

  // Default action shows help
  secrets.action(() => {
    secrets.help();
  });
}
