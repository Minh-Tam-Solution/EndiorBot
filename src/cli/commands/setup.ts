/**
 * Setup Command
 *
 * Guided setup for EndiorBot providers and integrations.
 *
 * Usage:
 *   endiorbot setup github    - Configure GitHub Models Provider
 *   endiorbot setup list      - List available setups
 *   endiorbot setup status    - Show provider status
 *
 * @module cli/commands/setup
 * @version 1.0.0
 * @date 2026-02-25
 * @status ACTIVE - Sprint 49 Day 1
 * @authority ADR-007 Multi-Provider Architecture
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { Command } from "commander";
import * as readline from "node:readline";
import keytar from "keytar";
import {
  KEYTAR_SERVICE,
  KEYTAR_ACCOUNT,
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
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function green(text: string): string {
  return `${colors.green}${text}${colors.reset}`;
}

function red(text: string): string {
  return `${colors.red}${text}${colors.reset}`;
}

function yellow(text: string): string {
  return `${colors.yellow}${text}${colors.reset}`;
}

function cyan(text: string): string {
  return `${colors.cyan}${text}${colors.reset}`;
}

function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Prompt user for input.
 */
async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for sensitive input (hidden).
 */
async function promptSecret(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Note: Node readline doesn't support hidden input natively.
  // For security, we use a simple approach and clear after entry.
  return new Promise((resolve) => {
    process.stdout.write(question);

    // Disable echo
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let input = "";
    const handler = (chunk: Buffer): void => {
      const char = chunk.toString();

      if (char === "\n" || char === "\r") {
        process.stdin.removeListener("data", handler);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.log(); // newline
        rl.close();
        resolve(input);
      } else if (char === "\x7f" || char === "\b") {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
      } else if (char === "\x03") {
        // Ctrl+C
        process.exit(0);
      } else {
        input += char;
        process.stdout.write("*");
      }
    };

    process.stdin.on("data", handler);
    process.stdin.resume();
  });
}


/**
 * Check if token looks valid.
 */
function validateGitHubToken(token: string): boolean {
  // GitHub PATs start with ghp_, github_pat_, or gho_
  return /^(ghp_|github_pat_|gho_)[A-Za-z0-9_]+$/.test(token);
}

// ============================================================================
// Command Actions
// ============================================================================

/**
 * List available setups.
 */
function listAction(): void {
  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Available Setups"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  console.log(`  ${cyan("github")}      Configure GitHub Models Provider (GPT-4o, GPT-4o-mini)`);
  console.log(`              ${dim("Requires GitHub Personal Access Token")}`);
  console.log("");
  console.log(`  ${dim("anthropic")}   ${dim("(coming soon)")}`);
  console.log(`  ${dim("openai")}      ${dim("(coming soon)")}`);
  console.log(`  ${dim("google")}      ${dim("(coming soon)")}`);
  console.log("");

  console.log(dim("  Usage: endiorbot setup <provider>"));
  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * Show provider status.
 */
async function statusAction(): Promise<void> {
  const processEnv = process.env;

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Provider Status"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  // GitHub - check keytar first, then env
  let githubToken: string | null = null;
  let githubSource = "";
  try {
    githubToken = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (githubToken) {
      githubSource = "keytar";
    }
  } catch {
    // keytar not available
  }
  if (!githubToken && processEnv["GITHUB_TOKEN"]) {
    githubToken = processEnv["GITHUB_TOKEN"];
    githubSource = "env";
  }

  if (githubToken) {
    const masked = githubToken.slice(0, 7) + "..." + githubToken.slice(-4);
    console.log(`  GitHub:       ${green("✓ Configured")}  ${dim(`(${masked} via ${githubSource})`)}`);
  } else {
    console.log(`  GitHub:       ${red("✗ Not configured")}`);
    console.log(`                ${dim("Run: endiorbot setup github")}`);
  }
  console.log("");

  // Anthropic
  const anthropicKey = processEnv["ANTHROPIC_API_KEY"];
  if (anthropicKey) {
    console.log(`  Anthropic:    ${green("✓ Configured")}`);
  } else {
    console.log(`  Anthropic:    ${dim("Not configured")}`);
  }
  console.log("");

  // OpenAI
  const openaiKey = processEnv["OPENAI_API_KEY"];
  if (openaiKey) {
    console.log(`  OpenAI:       ${green("✓ Configured")}`);
  } else {
    console.log(`  OpenAI:       ${dim("Not configured")}`);
  }
  console.log("");

  // Storage info
  console.log(`  ${bold("Storage:")}`);
  console.log(`    GitHub:     OS Keychain (${KEYTAR_SERVICE})`);
  console.log(`    Others:     Environment variables`);
  console.log("");

  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * Setup GitHub Models Provider.
 */
async function githubAction(): Promise<void> {
  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  GitHub Models Provider Setup"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  console.log("  GitHub Models provides access to GPT-4o, GPT-4o-mini, and other");
  console.log("  models through Azure infrastructure with GitHub authentication.");
  console.log("");

  console.log(`  ${bold("Requirements:")}`);
  console.log("    • GitHub account");
  console.log("    • Personal Access Token (PAT) with 'models:read' scope");
  console.log("");

  console.log(`  ${bold("Create a PAT:")}`);
  console.log(`    1. Go to ${cyan("https://github.com/settings/tokens")}`);
  console.log("    2. Click 'Generate new token (classic)'");
  console.log("    3. Select 'models:read' scope");
  console.log("    4. Generate and copy the token");
  console.log("");

  // Check if already configured (keytar first, then env)
  let existingToken: string | null = null;
  let existingSource = "";
  try {
    existingToken = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (existingToken) {
      existingSource = "keytar";
    }
  } catch {
    // keytar not available
  }
  if (!existingToken && process.env["GITHUB_TOKEN"]) {
    existingToken = process.env["GITHUB_TOKEN"];
    existingSource = "env";
  }

  if (existingToken) {
    const masked = existingToken.slice(0, 7) + "..." + existingToken.slice(-4);
    console.log(`  ${yellow("⚠")} Existing token found: ${dim(`${masked} (via ${existingSource})`)}`);
    console.log("");

    const overwrite = await prompt("  Overwrite existing token? (y/N): ");
    if (overwrite.toLowerCase() !== "y") {
      console.log("");
      console.log(dim("  Setup cancelled."));
      console.log("");
      return;
    }
    console.log("");
  }

  // Prompt for token
  const token = await promptSecret("  Enter your GitHub PAT: ");

  if (!token) {
    console.log("");
    console.log(red("  ✗ No token provided. Setup cancelled."));
    console.log("");
    return;
  }

  // Validate token format
  if (!validateGitHubToken(token)) {
    console.log("");
    console.log(yellow("  ⚠ Token format looks unusual (expected ghp_*, github_pat_*, or gho_*)"));
    const proceed = await prompt("  Continue anyway? (y/N): ");
    if (proceed.toLowerCase() !== "y") {
      console.log("");
      console.log(dim("  Setup cancelled."));
      console.log("");
      return;
    }
  }

  // Save token to keytar (OS keychain)
  try {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, token);
    console.log("");
    console.log(green("  ✓ GitHub token saved to OS keychain (secure storage)"));
    console.log("");
  } catch (err) {
    console.log("");
    console.log(red("  ✗ Failed to save to OS keychain"));
    console.log(dim(`    Error: ${err instanceof Error ? err.message : String(err)}`));
    console.log("");
    console.log(yellow("  Fallback: Set GITHUB_TOKEN environment variable manually:"));
    console.log(dim(`    export GITHUB_TOKEN="${token.slice(0, 7)}..."`));
    console.log("");
    return;
  }

  console.log(`  ${bold("Usage:")}`);
  console.log("    The token will be automatically loaded from OS keychain.");
  console.log("    No additional configuration needed.");
  console.log("");

  console.log(`  ${bold("Test the setup:")}`);
  console.log(`    ${dim("endiorbot consult --provider github-models 'Hello'")}`);
  console.log("");

  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register setup command.
 */
export function registerSetupCommand(program: Command): void {
  const setupCmd = program
    .command("setup")
    .description("Configure providers and integrations");

  setupCmd
    .command("list")
    .description("List available provider setups")
    .action(listAction);

  setupCmd
    .command("status")
    .description("Show provider configuration status")
    .action(statusAction);

  setupCmd
    .command("github")
    .description("Configure GitHub Models Provider")
    .action(githubAction);
}
