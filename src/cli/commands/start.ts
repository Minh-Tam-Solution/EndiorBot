/**
 * Start Command
 *
 * Initialize and start working on a project.
 * Loads project context, validates SDLC config, and sets up session.
 *
 * Usage:
 *   endiorbot start <project>
 *   endiorbot start my-project
 *   endiorbot start ~/Projects/my-app
 *
 * @module cli/commands/start
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 6 Implementation
 * @authority ADR-002 Project Context Switching
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import type { Command } from "commander";
import { getCommandLogger } from "../logger.js";
import { saveActiveProject } from "../../config/paths.js";

// ============================================================================
// Types
// ============================================================================

interface SDLCConfig {
  version: string;
  project: {
    id: string;
    name: string;
    description: string;
    repository?: string;
  };
  tier: "LITE" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE";
  team_size?: number;
  docs_root?: string;
  strict?: boolean;
  framework?: {
    name: string;
    version: string;
  };
}

interface ProjectInfo {
  name: string;
  path: string;
  tier: string;
  hasSDLCConfig: boolean;
  sdlcConfig: SDLCConfig | undefined;
  hasGit: boolean;
  currentBranch: string | undefined;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve project path from name or path.
 */
function resolveProjectPath(project: string): string {
  // If it's an absolute path, use it directly
  if (project.startsWith("/") || project.startsWith("~")) {
    return resolve(project.replace("~", process.env.HOME ?? ""));
  }

  // Check common project locations
  const searchPaths = [
    process.cwd(),
    join(process.env.HOME ?? "", "Projects"),
    join(process.env.HOME ?? "", "Documents/Projects"),
    join(process.env.HOME ?? "", "Developer"),
  ];

  for (const base of searchPaths) {
    const candidate = join(base, project);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Return as-is, will fail validation later
  return resolve(project);
}

/**
 * Load SDLC configuration from project.
 */
function loadSDLCConfig(projectPath: string): SDLCConfig | undefined {
  const configPath = join(projectPath, ".sdlc-config.json");
  if (!existsSync(configPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content) as SDLCConfig;
  } catch {
    return undefined;
  }
}

/**
 * Get current git branch.
 */
function getCurrentBranch(projectPath: string): string | undefined {
  const headPath = join(projectPath, ".git", "HEAD");
  if (!existsSync(headPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(headPath, "utf-8").trim();
    if (content.startsWith("ref: refs/heads/")) {
      return content.replace("ref: refs/heads/", "");
    }
    return content.slice(0, 7); // Short SHA for detached HEAD
  } catch {
    return undefined;
  }
}

/**
 * Get project information.
 */
function getProjectInfo(projectPath: string): ProjectInfo {
  const sdlcConfig = loadSDLCConfig(projectPath);
  const hasGit = existsSync(join(projectPath, ".git"));

  return {
    name: sdlcConfig?.project.name ?? basename(projectPath),
    path: projectPath,
    tier: sdlcConfig?.tier ?? "STANDARD",
    hasSDLCConfig: sdlcConfig !== undefined,
    sdlcConfig,
    hasGit,
    currentBranch: hasGit ? getCurrentBranch(projectPath) : undefined,
  };
}

/**
 * Format tier with emoji.
 */
function formatTier(tier: string): string {
  const tiers: Record<string, string> = {
    LITE: "🟢 LITE",
    STANDARD: "🔵 STANDARD",
    PROFESSIONAL: "🟣 PROFESSIONAL",
    ENTERPRISE: "🟠 ENTERPRISE",
  };
  return tiers[tier] ?? tier;
}

// ============================================================================
// Command Action
// ============================================================================

/**
 * Start command action.
 */
async function startAction(
  project: string,
  _options: Record<string, unknown>,
): Promise<void> {
  const log = getCommandLogger("start");
  log.debug("Resolving project path", { project });

  const projectPath = resolveProjectPath(project);
  log.debug("Resolved project path", { projectPath });

  // Validate project exists
  if (!existsSync(projectPath)) {
    log.error("Project not found", { projectPath });
    console.error(`❌ Project not found: ${projectPath}`);
    console.error(`\nTry:\n  endiorbot start ~/Projects/${project}`);
    process.exit(1);
  }

  // Get project info
  const info = getProjectInfo(projectPath);
  log.debug("Loaded project info", { name: info.name, tier: info.tier, hasSDLC: info.hasSDLCConfig });

  // Display project info
  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│  📂 ${info.name.padEnd(55)}│`);
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Path: ${info.path.slice(0, 52).padEnd(52)}│`);
  console.log(`│  Tier: ${formatTier(info.tier).padEnd(52)}│`);

  if (info.hasGit && info.currentBranch) {
    console.log(`│  Branch: ${info.currentBranch.padEnd(50)}│`);
  }

  if (info.hasSDLCConfig && info.sdlcConfig) {
    console.log(`│  SDLC: v${info.sdlcConfig.framework?.version ?? "6.4.0"}`.padEnd(62) + "│");
  } else {
    console.log("│  SDLC: Not configured (run: endiorbot init)".padEnd(62) + "│");
  }

  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");

  // Show next actions
  console.log("📋 Quick Actions:");
  console.log("   endiorbot status        - Show project status");
  console.log("   endiorbot gate status   - Show SDLC gate status");
  console.log("   endiorbot consult       - Query AI experts");
  console.log("");

  // Save active project to state dir
  saveActiveProject({
    name: info.name,
    path: info.path,
    tier: info.tier,
    startedAt: Date.now(),
  });

  log.info("Project started", { project: info.name, tier: info.tier });
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register start command.
 */
export function registerStartCommand(program: Command): void {
  program
    .command("start <project>")
    .description("Start working on a project")
    .option("-v, --verbose", "Show detailed output")
    .action(startAction);
}
