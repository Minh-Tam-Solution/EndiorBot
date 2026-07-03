/**
 * EndiorBot CLI
 *
 * Solo developer tool for enterprise-scale projects.
 * Provides commands for project management, SDLC gates, and AI consultation.
 *
 * @module cli
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 6 Implementation
 * @authority ADR-006 CLI Architecture
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Command } from "commander";
import { registerAllCommands, registerShellCommand } from "./commands/index.js";
import { getCLILogger, logDebug, logError } from "./logger.js";
import { installGlobalErrorHandlers, formatErrorForCLI } from "../errors/index.js";
import { ensureSecureStateDir } from "../security/secure-fs.js";
import { resolveStateDir } from "../config/paths.js";

const VERSION = "0.1.0-beta.1";

export async function run(): Promise<void> {
  // Load .env in priority order:
  // 1. EndiorBot's own .env/.env.local — fills in missing vars (NO override — respects process.env)
  // 2. Project's .env/.env.local in cwd — project-specific overrides
  const endiorBotRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  if (existsSync(join(endiorBotRoot, ".env"))) {
    config({ path: join(endiorBotRoot, ".env") });
  }
  if (existsSync(join(endiorBotRoot, ".env.local"))) {
    config({ path: join(endiorBotRoot, ".env.local") }); // No override — don't clobber process.env
  }

  // Then load project-level .env (cwd) — these DO override (project-specific config wins)
  const cwd = process.cwd();
  if (cwd !== endiorBotRoot) {
    if (existsSync(join(cwd, ".env"))) {
      config({ path: join(cwd, ".env"), override: true });
    }
    if (existsSync(join(cwd, ".env.local"))) {
      config({ path: join(cwd, ".env.local"), override: true });
    }
  }

  // Install global error handlers for uncaught exceptions/rejections
  installGlobalErrorHandlers();

  // Ensure state directory exists with secure permissions (0o700)
  // This runs BEFORE any file operations to establish security from first run
  try {
    const stateDir = resolveStateDir();
    ensureSecureStateDir(stateDir);
  } catch {
    // Non-fatal - directory creation will happen on first write
  }

  const program = new Command();

  // Initialize logger based on global options
  program.hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    const loggerConfig: Parameters<typeof getCLILogger>[0] = {};
    if (typeof opts.verbose === "boolean") {
      loggerConfig.verbose = opts.verbose;
    }
    if (typeof opts.debug === "boolean") {
      loggerConfig.debug = opts.debug;
    }
    getCLILogger(loggerConfig);
    logDebug("CLI initialized", { version: VERSION, command: thisCommand.name() });
  });

  program
    .name("endiorbot")
    .description("Solo developer tool for enterprise-scale projects")
    .version(VERSION)
    .option("-v, --verbose", "Show verbose output")
    .option("--debug", "Show debug output");

  // Register all commands (centralized via register-all.ts + shell)
  registerAllCommands(program);
  registerShellCommand(program);

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // -i shorthand throws to abort subcommand and start REPL
    if ((err as Error & { code?: string }).code === "session.started") return;
    throw err;
  }
}

// Re-export logger utilities for commands
export { getCLILogger, logDebug, logError } from "./logger.js";

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err: Error) => {
    console.error(formatErrorForCLI(err));
    logError("CLI error", err);
    process.exit(1);
  });
}
