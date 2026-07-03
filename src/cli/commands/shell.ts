/**
 * Shell Command — CLI Session Mode (Interactive REPL)
 *
 * Provides a persistent REPL that loads context once and dispatches
 * commands interactively without repeated startup cost.
 *
 * Usage:
 *   endiorbot shell              # Enter interactive mode
 *   endiorbot shell --no-banner  # Skip welcome banner
 *   endiorbot -i                 # Shorthand
 *
 * @module cli/commands/shell
 * @version 1.1.0
 * @date 2026-03-03
 * @status ACTIVE - Sprint 73
 * @authority TS-011 CLI Session Mode, ADR-016
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { Command } from "commander";
import type { Command as CommandType } from "commander";
import { loadActiveProject } from "../../config/paths.js";
import {
  type SessionState,
  setSessionState,
  clearSessionState,
  parseTokens,
  executeWithExitGuard,
} from "../session/index.js";
import { registerAllCommands } from "./register-all.js";

const VERSION = "0.1.0-beta.1";
const BANNER_WIDTH = 62;

// ============================================================================
// Banner
// ============================================================================

function truncateLine(line: string, maxWidth: number): string {
  if (line.length > maxWidth - 1) {
    return line.slice(0, maxWidth - 4) + "...";
  }
  return line;
}

function printBanner(state: SessionState): void {
  const projectName = state.project?.name ?? "no project";
  const tier = state.project?.tier ?? "unknown";
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");

  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(truncateLine(`│  EndiorBot v${VERSION} — Interactive Mode`, BANNER_WIDTH).padEnd(BANNER_WIDTH) + "│");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(truncateLine(`│  Project: ${projectName} (${tier})`, BANNER_WIDTH).padEnd(BANNER_WIDTH) + "│");
  console.log(truncateLine(`│  Session: ${now}`, BANNER_WIDTH).padEnd(BANNER_WIDTH) + "│");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log("│  Type 'help' for commands, '/exit' to quit.".padEnd(BANNER_WIDTH) + "│");
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");
}

// ============================================================================
// Prompt
// ============================================================================

function getPrompt(state: SessionState): string {
  const projectName = state.project?.name;
  const errorSuffix = state.lastError ? " ✗" : "";
  if (projectName) {
    return `endiorbot [${projectName}]${errorSuffix}> `;
  }
  return `endiorbot${errorSuffix}> `;
}

// ============================================================================
// Session Commands
// ============================================================================

function handleSessionCommand(input: string, state: SessionState, rl: ReadlineInterface): boolean {
  const cmd = input.toLowerCase().trim();

  switch (cmd) {
    case "/exit":
    case "/quit": {
      console.log("Goodbye.");
      rl.close();
      return true; // signals exit
    }

    case "/clear": {
      // Clear terminal screen
      process.stdout.write("\x1Bc");
      return false;
    }

    case "/reload": {
      state.project = loadActiveProject() ?? null;
      state.lastError = false;
      // NOTE: When gateEngine is added to SessionState, clear it here too
      console.log("  Config and project context reloaded.");
      return false;
    }

    case "/history": {
      if (state.history.length === 0) {
        console.log("  No command history.");
      } else {
        console.log("  Command history:");
        for (let i = 0; i < state.history.length; i++) {
          console.log(`  ${(i + 1).toString().padStart(3)}  ${state.history[i]}`);
        }
      }
      return false;
    }

    case "/status": {
      const uptime = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
      const mins = Math.floor(uptime / 60);
      const secs = uptime % 60;
      const projectName = state.project?.name ?? "none";
      const tier = state.project?.tier ?? "unknown";

      console.log("");
      console.log("  Session Status:");
      console.log(`    Project:    ${projectName} (${tier})`);
      console.log(`    Uptime:     ${mins}m ${secs}s`);
      console.log(`    Commands:   ${state.commandCount}`);
      console.log(`    History:    ${state.history.length} entries`);
      console.log("");
      return false;
    }

    default: {
      console.log(`  Unknown session command: ${cmd}`);
      console.log("  Available: /exit, /quit, /clear, /reload, /history, /status");
      return false;
    }
  }
}

// ============================================================================
// Command Dispatcher
// ============================================================================

async function executeSubcommand(tokens: string[], state: SessionState): Promise<void> {
  const program = new Command();
  program.exitOverride(); // Prevent process.exit() in session mode
  program.configureOutput({
    writeErr: (str) => process.stderr.write(str),
    writeOut: (str) => process.stdout.write(str),
  });

  // Register all commands (fresh instance per input to avoid stale state)
  registerAllCommands(program);

  // Suppress default help/version on the root command for cleaner session UX
  program
    .name("endiorbot")
    .helpOption(false)
    .version(VERSION, "-V, --version");

  const exitCode = await executeWithExitGuard(async () => {
    await program.parseAsync(["node", "endiorbot", ...tokens]);
  });

  state.lastError = exitCode !== 0;
}

async function dispatchCommand(
  input: string,
  state: SessionState,
  rl: ReadlineInterface,
): Promise<boolean> {
  // Tier 1: Session-only commands (/ prefix)
  if (input.startsWith("/")) {
    return handleSessionCommand(input, state, rl);
  }

  // Tier 2: CLI commands
  const tokens = parseTokens(input);
  if (tokens.length === 0) return false;

  // Special: "help" → root --help, "help <cmd>" → "<cmd> --help"
  if (tokens[0] === "help") {
    if (tokens.length > 1) {
      const [, ...rest] = tokens;
      tokens.length = 0;
      tokens.push(...rest, "--help");
    } else {
      tokens[0] = "--help";
    }
  }

  try {
    await executeSubcommand(tokens, state);
  } catch (err) {
    const error = err as { code?: string; message?: string };
    if (error.code === "commander.helpDisplayed") {
      // Help was shown, not an error
    } else if (error.code === "commander.unknownCommand") {
      console.error(`  Unknown command: ${tokens[0]}`);
    } else if (error.code === "commander.version") {
      // Version was shown, not an error
    } else {
      console.error(`  Error: ${error.message ?? "Unknown error"}`);
      state.lastError = true;
    }
  }

  return false;
}

// ============================================================================
// REPL Engine
// ============================================================================

function startREPL(state: SessionState): void {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt(state),
    historySize: 100,
    terminal: process.stdin.isTTY ?? false,
  });

  let ctrlCCount = 0;
  let isCommandRunning = false;

  // Set module-scoped session context
  setSessionState(state);

  // W1 fix: Busy guard prevents race condition with piped/pasted multi-line input
  rl.on("line", async (line) => {
    if (isCommandRunning) {
      console.log("  (busy — please wait for current command to finish)");
      return;
    }
    isCommandRunning = true;
    ctrlCCount = 0; // Reset Ctrl+C counter on any input
    const input = line.trim();

    if (!input) {
      rl.setPrompt(getPrompt(state));
      rl.prompt();
      isCommandRunning = false;
      return;
    }

    state.commandCount++;
    state.history.push(input);

    const shouldExit = await dispatchCommand(input, state, rl);
    isCommandRunning = false;
    if (shouldExit) return;

    rl.setPrompt(getPrompt(state));
    rl.prompt();
  });

  // Ctrl+D (EOF) — clean exit
  rl.on("close", () => {
    console.log("\nGoodbye.");
    clearSessionState();
    process.removeListener("SIGTERM", sigtermHandler);
    process.exit(0);
  });

  // Ctrl+C handling
  rl.on("SIGINT", () => {
    ctrlCCount++;
    if (ctrlCCount >= 2) {
      console.log("\n  Force exit.");
      clearSessionState();
      process.removeListener("SIGTERM", sigtermHandler);
      process.exit(0);
    }
    console.log("\n  Press Ctrl+C again to exit, or type /exit.");
    rl.setPrompt(getPrompt(state));
    rl.prompt();
  });

  // SIGTERM — graceful shutdown (I4 fix: named handler for cleanup)
  const sigtermHandler = (): void => {
    console.log("\n  Received SIGTERM. Exiting...");
    clearSessionState();
    process.removeListener("SIGTERM", sigtermHandler);
    rl.close();
  };
  process.on("SIGTERM", sigtermHandler);

  rl.prompt();
}

// ============================================================================
// Helper: Create session state
// ============================================================================

function createSessionState(): SessionState {
  const project = loadActiveProject();
  return {
    project: project ?? null,
    projectPath: project?.path ?? process.cwd(),
    startedAt: new Date(),
    commandCount: 0,
    history: [],
    lastError: false,
  };
}

// ============================================================================
// Command Registration
// ============================================================================

export function registerShellCommand(program: CommandType): void {
  program
    .command("shell")
    .description("Enter interactive session mode (REPL)")
    .option("--path <path>", "Project directory")
    .option("--no-banner", "Skip welcome banner")
    .action(async (options: { path?: string; banner?: boolean }) => {
      const state = createSessionState();
      if (options.path) {
        state.projectPath = options.path;
      }

      // Show banner unless suppressed
      if (options.banner !== false) {
        printBanner(state);
      }

      startREPL(state);
    });

  // W2 fix: -i shorthand uses preAction hook that throws to abort subcommand
  program.option("-i, --interactive", "Enter interactive session mode");
  program.hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.interactive) {
      const state = createSessionState();
      printBanner(state);
      startREPL(state);
      // Throw CommanderError to prevent Commander from also executing the matched subcommand
      const err = new Error("session started");
      (err as Error & { code: string }).code = "session.started";
      throw err;
    }
  });
}
