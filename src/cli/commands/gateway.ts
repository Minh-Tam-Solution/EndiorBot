/**
 * Gateway Command
 *
 * CLI command for managing the WebSocket gateway server.
 *
 * Usage:
 *   endiorbot gateway start      - Start gateway server
 *   endiorbot gateway stop       - Stop gateway server
 *   endiorbot gateway status     - Show gateway status
 *   endiorbot gateway restart    - Restart gateway server
 *
 * @module cli/commands/gateway
 * @version 1.0.0
 * @date 2026-02-24
 * @status ACTIVE - Sprint 44 Day 9
 * @authority ADR-003 CLI-Desktop Protocol
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { Command } from "commander";
import {
  createGatewayServer,
  getGatewayServer,
  setGatewayServer,
} from "../../gateway/index.js";
import { registerAllMethods } from "../../gateway/methods/index.js";
import { initializeProvidersFromEnv } from "../../providers/init.js";

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

function yellow(text: string): string {
  return `${colors.yellow}${text}${colors.reset}`;
}

function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

// ============================================================================
// Command Actions
// ============================================================================

interface GatewayStartOptions {
  port?: string;
}

/**
 * Start gateway server.
 */
async function startAction(options: GatewayStartOptions): Promise<void> {
  const existingServer = getGatewayServer();

  if (existingServer?.isRunning) {
    console.log(yellow("⚠ Gateway server is already running"));
    console.log(dim(`  Port: ${existingServer.config.port}`));
    console.log(dim(`  Connections: ${existingServer.stats.activeConnections}`));
    return;
  }

  const port = options.port ? parseInt(options.port, 10) : 18790;

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(red("✗ Invalid port number"));
    process.exit(1);
  }

  try {
    // Initialize AI providers from environment
    console.log("");
    console.log(dim("Initializing AI providers..."));
    const providerCount = await initializeProvidersFromEnv();
    if (providerCount === 0) {
      console.log(yellow("⚠ No AI providers configured - chat will not work"));
      console.log(dim("  Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY"));
    }
    console.log("");

    const server = createGatewayServer({ port });
    registerAllMethods(server);
    setGatewayServer(server);
    await server.start();

    console.log(green("✓ Gateway server started"));
    console.log(dim(`  Port: ${port}`));
    console.log(dim(`  URL: ws://127.0.0.1:${port}`));
    console.log(dim(`  Press Ctrl+C to stop`));
    console.log("");

    // Keep process alive — gateway is a long-running server
    await new Promise<void>((resolve) => {
      const shutdown = async () => {
        console.log("\n" + yellow("⚡ Shutting down gateway..."));
        await server.stop();
        setGatewayServer(null);
        console.log(green("✓ Gateway stopped"));
        resolve();
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
  } catch (error) {
    console.error(red(`✗ Failed to start gateway: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Stop gateway server.
 */
async function stopAction(): Promise<void> {
  const server = getGatewayServer();

  if (!server) {
    console.log(yellow("⚠ Gateway server is not running"));
    return;
  }

  try {
    await server.stop();
    setGatewayServer(null);

    console.log(green("✓ Gateway server stopped"));
  } catch (error) {
    console.error(red(`✗ Failed to stop gateway: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Show gateway status.
 */
function statusAction(): void {
  const server = getGatewayServer();

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Gateway Status"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  if (!server) {
    console.log(`  Status:       ${red("stopped")}`);
    console.log("");
    console.log(dim("  Run 'endiorbot gateway start' to start the gateway"));
    console.log("");
    console.log(bold("═══════════════════════════════════════════════════════════════"));
    console.log("");
    return;
  }

  const status = server.isRunning ? green("running") : red("stopped");
  const stats = server.stats;
  const config = server.config;

  console.log(`  Status:       ${status}`);
  console.log(`  Port:         ${config.port}`);
  console.log(`  URL:          ws://127.0.0.1:${config.port}`);
  console.log("");
  console.log(`  ${bold("Connections:")}`);
  console.log(`    Active:     ${stats.activeConnections}`);
  console.log(`    Total:      ${stats.totalConnections}`);
  console.log("");
  console.log(`  ${bold("Messages:")}`);
  console.log(`    Received:   ${stats.messagesReceived}`);
  console.log(`    Sent:       ${stats.messagesSent}`);
  console.log("");
  console.log(`  ${bold("Uptime:")}`);

  if (stats.startedAt) {
    const uptimeMs = Date.now() - stats.startedAt.getTime();
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    console.log(`    Started:    ${stats.startedAt.toISOString()}`);
    console.log(`    Uptime:     ${hours}h ${minutes}m ${seconds}s`);
  } else {
    console.log(`    Started:    ${dim("N/A")}`);
  }

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * Restart gateway server.
 */
async function restartAction(options: GatewayStartOptions): Promise<void> {
  const server = getGatewayServer();

  if (server?.isRunning) {
    console.log(dim("Stopping existing gateway..."));
    await server.stop();
    setGatewayServer(null);
  }

  await startAction(options);
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register gateway command.
 */
export function registerGatewayCommand(program: Command): void {
  const gateway = program
    .command("gateway")
    .description("Manage WebSocket gateway server");

  gateway
    .command("start")
    .description("Start gateway server")
    .option("-p, --port <port>", "Port to listen on (default: 18790)")
    .action(startAction);

  gateway
    .command("stop")
    .description("Stop gateway server")
    .action(stopAction);

  gateway
    .command("status")
    .description("Show gateway status")
    .action(statusAction);

  gateway
    .command("restart")
    .description("Restart gateway server")
    .option("-p, --port <port>", "Port to listen on (default: 18790)")
    .action(restartAction);
}
