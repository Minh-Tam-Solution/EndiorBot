/**
 * Status Command
 *
 * Show current project status including SDLC stage, gates, and metrics.
 *
 * Usage:
 *   endiorbot status
 *   endiorbot status --verbose
 *
 * @module cli/commands/status
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 6 Implementation
 * @authority ADR-002 Project Context Switching
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { loadActiveProject } from "../../config/paths.js";
import { computeDecisionVelocity } from "../../metrics/decision-velocity.js";

// ============================================================================
// Types
// ============================================================================

interface ProjectContext {
  id: string;
  name: string;
  path: string;
  tier: string;
  lastActive: string;
}

interface SDLCConfig {
  version: string;
  project: {
    id: string;
    name: string;
    description: string;
  };
  tier: string;
  framework?: {
    version: string;
  };
}

interface ProjectStatus {
  name: string;
  path: string;
  tier: string;
  sdlcVersion: string;
  hasGit: boolean;
  branch: string | undefined;
  uncommittedFiles: number;
  srcFiles: number;
  testFiles: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get current project from state.
 */
function getCurrentProject(): ProjectContext | undefined {
  const active = loadActiveProject();
  if (!active) {
    return undefined;
  }

  return {
    id: active.name,
    name: active.name,
    path: active.path,
    tier: active.tier,
    lastActive: new Date(active.startedAt).toISOString(),
  };
}

/**
 * Load SDLC config from project.
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
    return content.slice(0, 7);
  } catch {
    return undefined;
  }
}

/**
 * Count files in directory recursively.
 */
function countFiles(dir: string, pattern: RegExp): number {
  if (!existsSync(dir)) {
    return 0;
  }

  let count = 0;

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules" || entry === "dist") {
        continue;
      }

      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        count += countFiles(fullPath, pattern);
      } else if (pattern.test(entry)) {
        count++;
      }
    }
  } catch {
    // Ignore errors
  }

  return count;
}

/**
 * Get project status.
 */
function getProjectStatus(projectPath: string): ProjectStatus {
  const sdlcConfig = loadSDLCConfig(projectPath);
  const hasGit = existsSync(join(projectPath, ".git"));

  return {
    name: sdlcConfig?.project.name ?? projectPath.split("/").pop() ?? "Unknown",
    path: projectPath,
    tier: sdlcConfig?.tier ?? "STANDARD",
    sdlcVersion: sdlcConfig?.framework?.version ?? "6.4.0",
    hasGit,
    branch: hasGit ? getCurrentBranch(projectPath) : undefined,
    uncommittedFiles: 0, // DEFERRED(Sprint 147): wire git status check via existing GitAutomation module
    srcFiles: countFiles(join(projectPath, "src"), /\.(ts|tsx|js|jsx)$/),
    testFiles: countFiles(join(projectPath, "tests"), /\.test\.(ts|tsx|js|jsx)$/),
  };
}

/**
 * Format tier with color.
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
 * Status command action.
 */
async function statusAction(options: { verbose?: boolean }): Promise<void> {
  // Get current project
  const currentProject = getCurrentProject();

  if (!currentProject) {
    console.log("");
    console.log("⚠️  No active project");
    console.log("");
    console.log("Start a project with:");
    console.log("  endiorbot start <project>");
    console.log("");
    return;
  }

  // Check project exists
  if (!existsSync(currentProject.path)) {
    console.error(`❌ Project path not found: ${currentProject.path}`);
    console.error("Use 'endiorbot switch <project>' to change projects.");
    process.exit(1);
  }

  // Get status
  const status = getProjectStatus(currentProject.path);

  // Display status
  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│  📊 Project Status                                          │`);
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Name: ${status.name.padEnd(52)}│`);
  console.log(`│  Path: ${status.path.slice(0, 52).padEnd(52)}│`);
  console.log(`│  Tier: ${formatTier(status.tier).padEnd(52)}│`);
  console.log(`│  SDLC: v${status.sdlcVersion.padEnd(51)}│`);

  if (status.hasGit && status.branch) {
    console.log("├─────────────────────────────────────────────────────────────┤");
    console.log(`│  Branch: ${status.branch.padEnd(50)}│`);
  }

  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Source files: ${String(status.srcFiles).padEnd(44)}│`);
  console.log(`│  Test files: ${String(status.testFiles).padEnd(46)}│`);

  // Sprint 131 (Sau Sheong cherry-pick): Decision velocity metric
  // Median time from `plan` creation to first matching `agent` execution
  // over the last 7 days. Fail-soft: omit line if unavailable.
  const velocity = computeDecisionVelocity(currentProject.path, 7);
  if (velocity && velocity.matchedPlans > 0) {
    const line = `│  Decision velocity: ${velocity.medianMinutes} min (median plan → first execution, last 7 days, n=${velocity.matchedPlans})`;
    console.log(line.slice(0, 62).padEnd(62) + "│");
  }

  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");

  if (options.verbose) {
    console.log("📋 Available Commands:");
    console.log("   endiorbot gate status     - Show SDLC gate checklist");
    console.log("   endiorbot gate propose G2 - Propose gate evaluation");
    console.log("   endiorbot consult <query> - Query AI experts");
    console.log("   endiorbot switch <project>- Switch to another project");
    console.log("");
  }
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register status command.
 */
export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show current project status")
    .option("-v, --verbose", "Show detailed output with available commands")
    .action(statusAction);
}
