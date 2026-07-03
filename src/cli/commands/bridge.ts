/**
 * Bridge Command
 *
 * CLI command for managing Bridge infrastructure.
 *
 * Usage:
 *   endiorbot bridge install-agents <path>   - Install .claude/agents/*.md files
 *   endiorbot bridge install-agents <path> --force  - Overwrite existing files
 *
 * @module cli/commands/bridge
 * @version 1.0.0
 * @date 2026-03-07
 * @status ACTIVE - Sprint 84 (CTO MF-1)
 * @authority ADR-025 Session Intelligence Envelope
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { resolve, join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fork, type ChildProcess } from "node:child_process";
import type { Command } from "commander";
import { installAgents } from "../../bridge/intelligence/agent-installer.js";
import { installHooks } from "../../bridge/hooks/hook-installer.js";
import { installTeams } from "../../bridge/intelligence/team-installer.js";
import { LockManager, UnifiedLauncher } from "../../bridge/launcher/index.js";
import { getSessionRegistry } from "../../bridge/session-registry.js";
import { getTmuxBridge } from "../../bridge/tmux/tmux-bridge.js";
import { getAgentLauncher } from "../../bridge/agent-launcher.js";
import { getBridgeAuditLogger } from "../../bridge/security/bridge-audit.js";

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

function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

// ============================================================================
// Command Actions
// ============================================================================

interface InstallAgentsOptions {
  force?: boolean;
}

/**
 * Install .claude/agents/*.md files in a target project.
 */
function installAgentsAction(projectPath: string, options: InstallAgentsOptions): void {
  const resolvedPath = resolve(projectPath);

  if (!existsSync(resolvedPath)) {
    console.error(red(`✗ Project path not found: ${resolvedPath}`));
    process.exit(1);
  }

  console.log("");
  console.log(dim(`Installing agent files in ${resolvedPath}...`));
  console.log("");

  const installOpts: { force?: boolean } = {};
  if (options.force) installOpts.force = options.force;
  const result = installAgents(resolvedPath, installOpts);

  // Show per-role details
  for (const detail of result.details) {
    if (detail.status === "created") {
      console.log(`  ${green("✓")} ${detail.role}.md ${green("created")}`);
    } else if (detail.status === "skipped") {
      console.log(`  ${yellow("○")} ${detail.role}.md ${yellow("skipped")} ${dim("(already exists)")}`);
    } else {
      console.log(`  ${red("✗")} ${detail.role}.md ${red("failed")}: ${detail.error ?? "unknown"}`);
    }
  }

  // Summary
  console.log("");
  console.log(`  Created: ${result.created}  Skipped: ${result.skipped}  Failed: ${result.failed}`);

  if (result.created > 0) {
    console.log("");
    console.log(dim("  Usage: claude --agent <role>  (e.g., claude --agent pm)"));
  }

  if (result.skipped > 0 && !options.force) {
    console.log(dim("  Use --force to overwrite existing files"));
  }

  console.log("");

  if (result.failed > 0) {
    process.exit(1);
  }
}

interface InstallHooksOptions {
  force?: boolean;
}

/**
 * Install Claude Code hooks in a target project.
 */
function installHooksAction(projectPath: string, options: InstallHooksOptions): void {
  const resolvedPath = resolve(projectPath);

  if (!existsSync(resolvedPath)) {
    console.error(red(`\u2717 Project path not found: ${resolvedPath}`));
    process.exit(1);
  }

  console.log("");
  console.log(dim(`Installing hooks in ${resolvedPath}...`));
  console.log("");

  const installOpts: { force?: boolean } = {};
  if (options.force) installOpts.force = options.force;
  const result = installHooks(resolvedPath, installOpts);

  // Show per-hook details
  for (const detail of result.details) {
    if (detail.status === "installed") {
      console.log(`  ${green("\u2713")} ${detail.hook} ${green("installed")}`);
    } else if (detail.status === "skipped") {
      console.log(`  ${yellow("\u25CB")} ${detail.hook} ${yellow("skipped")} ${dim("(already exists)")}`);
    } else {
      console.log(`  ${red("\u2717")} ${detail.hook} ${red("failed")}: ${detail.error ?? "unknown"}`);
    }
  }

  // Summary
  console.log("");
  console.log(`  Installed: ${result.installed}  Skipped: ${result.skipped}  Failed: ${result.failed}`);

  if (result.skipped > 0 && !options.force) {
    console.log(dim("  Use --force to overwrite existing hooks"));
  }

  console.log("");

  if (result.failed > 0) {
    process.exit(1);
  }
}

interface InstallTeamsOptions {
  force?: boolean;
  tier?: string;
}

/**
 * Generate .claude/agents/{teamId}-team.md files in a target project.
 * CA1: CLI output lists generated and skipped files with reasons.
 */
function installTeamsAction(projectPath: string, options: InstallTeamsOptions): void {
  const resolvedPath = resolve(projectPath);

  if (!existsSync(resolvedPath)) {
    console.error(red(`✗ Project path not found: ${resolvedPath}`));
    process.exit(1);
  }

  console.log("");
  console.log(dim(`Generating team files in ${resolvedPath}...`));
  console.log("");

  try {
    const installOpts: { force?: boolean; tier?: string } = {};
    if (options.force) installOpts.force = options.force;
    if (options.tier) installOpts.tier = options.tier;
    const result = installTeams(resolvedPath, installOpts);

    // Show per-team details (CA1)
    for (const detail of result.details) {
      if (detail.status === "created") {
        console.log(`  ${green("✓")} ${detail.teamId}-team.md ${green("created")}`);
      } else if (detail.status === "skipped") {
        console.log(`  ${yellow("○")} ${detail.teamId}-team.md ${yellow("skipped")} ${dim("(already exists)")}`);
      } else {
        console.log(`  ${dim("—")} ${detail.teamId}-team.md ${dim("excluded")} ${dim(`(${detail.reason ?? "unknown"})`)}`);
      }
    }

    // Summary
    console.log("");
    console.log(`  Created: ${result.created}  Skipped: ${result.skipped}  Excluded: ${result.excluded}`);

    if (result.created > 0) {
      console.log("");
      console.log(dim("  Usage: claude --agent <teamId>-team  (e.g., claude --agent dev-team)"));
    }

    if (result.skipped > 0 && !options.force) {
      console.log(dim("  Use --force to overwrite existing files"));
    }

    console.log("");
  } catch (err) {
    console.error(red(`✗ ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

// ============================================================================
// Sprint 92 — Launcher Actions
// ============================================================================

/**
 * Resolve the project root directory (from dist/cli/commands/ → project root).
 */
function getProjectRoot(): string {
  // __dirname equivalent for ESM
  const thisFile = fileURLToPath(import.meta.url);
  // dist/cli/commands/bridge.js → project root (3 levels up)
  return resolve(dirname(thisFile), "..", "..", "..");
}

/**
 * Spawn a child service (Telegram or Gateway) as a forked process.
 */
function spawnService(
  scriptPath: string,
  label: string,
): ChildProcess | null {
  if (!existsSync(scriptPath)) {
    console.log(yellow(`  ○ ${label}: script not found (${scriptPath})`));
    return null;
  }

  const child = fork(scriptPath, [], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env },
    detached: false,
  });

  // Prefix child stdout/stderr with label
  child.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().trimEnd().split("\n");
    for (const line of lines) {
      console.log(dim(`[${label}]`) + ` ${line}`);
    }
  });

  child.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().trimEnd().split("\n");
    for (const line of lines) {
      console.error(red(`[${label}]`) + ` ${line}`);
    }
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(red(`  ✗ ${label} exited with code ${code}`));
    }
  });

  return child;
}

interface LauncherStartOptions {
  noTelegram?: boolean;
  noGateway?: boolean;
}

/**
 * Start the unified launcher (foreground).
 *
 * Starts all services in one process:
 * 1. Session Manager (lock + PID tracking + crash recovery)
 * 2. Telegram Polling (CEO command channel)
 * 3. Web Gateway (WebSocket API)
 */
async function launcherStartAction(options: LauncherStartOptions): Promise<void> {
  const root = getProjectRoot();
  const childProcesses: ChildProcess[] = [];

  console.log("");
  console.log(dim("╔══════════════════════════════════════════╗"));
  console.log(dim("║") + green("  EndiorBot — Unified Launcher") + dim("            ║"));
  console.log(dim("╚══════════════════════════════════════════╝"));
  console.log("");

  // 1. Start session manager
  const launcher = new UnifiedLauncher({
    registry: getSessionRegistry(),
    tmux: getTmuxBridge(),
    agentLauncher: getAgentLauncher(),
    audit: getBridgeAuditLogger(),
  });

  const result = await launcher.start();

  if (!result.success) {
    console.error(red(`✗ Session Manager: ${result.error}`));
    process.exit(1);
  }

  console.log(green("  ✓ Session Manager") + dim(` (PID ${process.pid})`));

  if (result.staleLockRemoved) {
    console.log(yellow("    ○ Stale lock removed"));
  }
  if (result.recoveredSessions !== undefined && result.recoveredSessions > 0) {
    console.log(green(`    ✓ ${result.recoveredSessions} session(s) recovered`));
  }
  if (result.lostSessions !== undefined && result.lostSessions > 0) {
    console.log(red(`    ✗ ${result.lostSessions} session(s) lost`));
  }

  // 2. Start Telegram polling
  //    MF-1 (Sprint 94): Detect serve mode or stub scripts → skip spawn + print migration
  if (process.env.ENDIORBOT_SERVE_MODE === "true") {
    console.log(dim("  ○ Telegram Polling: managed by `endiorbot serve`"));
    console.log(dim("  ○ Web Gateway: managed by `endiorbot serve`"));
  } else if (!options.noTelegram || !options.noGateway) {
    if (!options.noTelegram) {
      const telegramScript = join(root, "scripts", "telegram-poll.mjs");
      const telegram = spawnService(telegramScript, "Telegram");
      if (telegram) {
        childProcesses.push(telegram);
        console.log(green("  ✓ Telegram Polling") + dim(` (PID ${telegram.pid})`));
      }
    } else {
      console.log(dim("  ○ Telegram Polling: skipped (--no-telegram)"));
    }

    // 3. Start Web Gateway
    if (!options.noGateway) {
      const gatewayScript = join(root, "scripts", "web-gateway.mjs");
      const gateway = spawnService(gatewayScript, "Gateway");
      if (gateway) {
        childProcesses.push(gateway);
        console.log(green("  ✓ Web Gateway") + dim(` (PID ${gateway.pid})`));
      }
    } else {
      console.log(dim("  ○ Web Gateway: skipped (--no-gateway)"));
    }
  }

  console.log("");
  console.log(dim("  Press Ctrl+C to stop all services"));
  console.log("");

  // Graceful shutdown: stop all child processes + launcher
  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log("");
    console.log(dim("Shutting down..."));

    // Kill child processes
    for (const child of childProcesses) {
      if (child.pid && !child.killed) {
        child.kill("SIGTERM");
      }
    }

    // Wait for children to exit (max 5s)
    await Promise.race([
      Promise.all(childProcesses.map((c) =>
        new Promise<void>((resolve) => {
          if (c.killed || c.exitCode !== null) { resolve(); return; }
          c.on("exit", () => resolve());
        })
      )),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);

    // Force kill any remaining
    for (const child of childProcesses) {
      if (child.pid && !child.killed) {
        child.kill("SIGKILL");
      }
    }

    await launcher.stop();
    console.log(green("✓ All services stopped"));
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Keep process alive
  await new Promise(() => {});
}

/**
 * Stop the running launcher.
 */
function launcherStopAction(): void {
  const lock = new LockManager();
  const status = lock.isRunning();

  if (!status.running || status.pid === undefined) {
    console.log(yellow("No launcher is running."));
    return;
  }

  try {
    process.kill(status.pid, "SIGTERM");
    console.log(green(`✓ Sent SIGTERM to launcher (PID ${status.pid})`));
  } catch (err) {
    console.error(red(`✗ Failed to stop launcher: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

/**
 * Show launcher status and active sessions.
 */
function launcherStatusAction(): void {
  const lock = new LockManager();
  const lockStatus = lock.isRunning();

  console.log("");

  if (!lockStatus.running) {
    console.log(yellow("Launcher: not running"));
  } else {
    const uptime = lockStatus.startTime
      ? Math.floor((Date.now() - lockStatus.startTime) / 1000)
      : 0;
    const uptimeStr = `${Math.floor(uptime / 60)}m ${uptime % 60}s`;
    console.log(green(`Launcher: running`) + dim(` (PID ${lockStatus.pid}, uptime ${uptimeStr})`));
  }

  // Show active sessions
  const registry = getSessionRegistry();
  const sessions = registry.getActive();

  if (sessions.length === 0) {
    console.log(dim("  No active sessions"));
  } else {
    console.log(`  Active sessions: ${sessions.length}`);
    for (const s of sessions) {
      const role = s.agentRole ? ` @${s.agentRole}` : "";
      const team = s.teamId ? ` (${s.teamId}-team)` : "";
      const pid = s.providerPid ? ` PID:${s.providerPid}` : "";
      console.log(dim(`    ${s.id} ${s.agentType}${role}${team}${pid}`));
    }
  }

  console.log("");
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register bridge command.
 */
export function registerBridgeCommand(program: Command): void {
  const bridge = program
    .command("bridge")
    .description("Manage Bridge infrastructure (agents, sessions, hooks)");

  bridge
    .command("install-agents <path>")
    .description("Install .claude/agents/*.md files for all 14 agent roles")
    .option("--force", "Overwrite existing agent files")
    .action(installAgentsAction);

  bridge
    .command("install-hooks <path>")
    .description("Install Claude Code hooks (.claude/hooks/ + settings.json)")
    .option("--force", "Overwrite existing hook files")
    .action(installHooksAction);

  bridge
    .command("install-teams <path>")
    .description("Generate team leader agent files (.claude/agents/{teamId}-team.md)")
    .option("--force", "Overwrite existing team files")
    .option("--tier <tier>", "Project tier (LITE/STANDARD/PROFESSIONAL/ENTERPRISE)", "STANDARD")
    .action(installTeamsAction);

  // Sprint 92 — Unified Launcher CLI
  const launcher = bridge
    .command("launcher")
    .description("Manage the unified session launcher");

  launcher
    .command("start")
    .description("Start the unified launcher (all services)")
    .option("--no-telegram", "Skip Telegram polling")
    .option("--no-gateway", "Skip Web Gateway")
    .action(launcherStartAction);

  launcher
    .command("stop")
    .description("Stop the running launcher")
    .action(launcherStopAction);

  launcher
    .command("status")
    .description("Show launcher status and active sessions")
    .action(launcherStatusAction);
}
