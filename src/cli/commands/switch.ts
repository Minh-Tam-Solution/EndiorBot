/**
 * Switch Command
 *
 * Switch between projects with context preservation.
 * Saves current project state and loads new project context.
 *
 * Usage:
 *   endiorbot switch <project>
 *   endiorbot switch my-project
 *   endiorbot switch my-app
 *
 * @module cli/commands/switch
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 6 Implementation
 * @authority ADR-002 Project Context Switching
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import type { Command } from "commander";
import { STATE_DIR, saveActiveProject } from "../../config/paths.js";

// ============================================================================
// Types
// ============================================================================

interface ProjectContext {
  id: string;
  name: string;
  path: string;
  tier: string;
  lastActive: string;
  sessionId?: string;
}

interface ActiveProjectState {
  currentProject?: string;
  projects: Record<string, ProjectContext>;
}

// ============================================================================
// State Management
// ============================================================================

const STATE_FILE = "projects.json";

/**
 * Get projects state file path.
 */
function getStateFilePath(): string {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  return join(STATE_DIR, STATE_FILE);
}

/**
 * Load projects state.
 */
function loadState(): ActiveProjectState {
  const statePath = getStateFilePath();
  if (!existsSync(statePath)) {
    return { projects: {} };
  }

  try {
    const content = readFileSync(statePath, "utf-8");
    return JSON.parse(content) as ActiveProjectState;
  } catch {
    return { projects: {} };
  }
}

/**
 * Save projects state.
 */
function saveState(state: ActiveProjectState): void {
  const statePath = getStateFilePath();
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

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

  return resolve(project);
}

/**
 * Load SDLC config from project.
 */
function loadSDLCConfig(projectPath: string): { tier: string; name: string } {
  const configPath = join(projectPath, ".sdlc-config.json");
  if (!existsSync(configPath)) {
    return { tier: "STANDARD", name: basename(projectPath) };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);
    return {
      tier: config.tier ?? "STANDARD",
      name: config.project?.name ?? basename(projectPath),
    };
  } catch {
    return { tier: "STANDARD", name: basename(projectPath) };
  }
}

// ============================================================================
// Command Action
// ============================================================================

/**
 * Switch command action.
 */
async function switchAction(
  project: string,
  _options: Record<string, unknown>,
): Promise<void> {
  const state = loadState();
  const projectPath = resolveProjectPath(project);

  // Validate project exists
  if (!existsSync(projectPath)) {
    console.error(`❌ Project not found: ${projectPath}`);
    process.exit(1);
  }

  // Get project info
  const sdlcInfo = loadSDLCConfig(projectPath);
  const projectId = basename(projectPath).toLowerCase().replace(/[^a-z0-9-]/g, "-");

  // Save current project if exists
  const previousProject = state.currentProject;
  if (previousProject && state.projects[previousProject]) {
    console.log(`💾 Saving context for ${previousProject}...`);
    state.projects[previousProject].lastActive = new Date().toISOString();
  }

  // Update or create project entry
  state.projects[projectId] = {
    id: projectId,
    name: sdlcInfo.name,
    path: projectPath,
    tier: sdlcInfo.tier,
    lastActive: new Date().toISOString(),
  };

  // Set as current project
  state.currentProject = projectId;

  // Save state
  saveState(state);

  // Save active project (for status command)
  saveActiveProject({
    path: projectPath,
    name: sdlcInfo.name,
    tier: sdlcInfo.tier,
    startedAt: Date.now(),
  });

  // Display switch info
  console.log("");
  if (previousProject && previousProject !== projectId) {
    console.log(`📤 Saved: ${previousProject}`);
  }
  console.log(`📂 Switched to: ${sdlcInfo.name}`);
  console.log("");

  // Show project info
  const tierEmoji: Record<string, string> = {
    LITE: "🟢",
    STANDARD: "🔵",
    PROFESSIONAL: "🟣",
    ENTERPRISE: "🟠",
  };

  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│  ${tierEmoji[sdlcInfo.tier] ?? "⚪"} ${sdlcInfo.name.padEnd(56)}│`);
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Path: ${projectPath.slice(0, 52).padEnd(52)}│`);
  console.log(`│  Tier: ${sdlcInfo.tier.padEnd(52)}│`);
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");
}

/**
 * List projects action.
 */
async function listProjectsAction(): Promise<void> {
  const state = loadState();
  const projects = Object.values(state.projects);

  if (projects.length === 0) {
    console.log("No projects tracked. Use 'endiorbot start <project>' to add one.");
    return;
  }

  console.log("");
  console.log("📂 Tracked Projects:");
  console.log("");

  for (const project of projects) {
    const isCurrent = project.id === state.currentProject;
    const marker = isCurrent ? "▶" : " ";
    const tierEmoji: Record<string, string> = {
      LITE: "🟢",
      STANDARD: "🔵",
      PROFESSIONAL: "🟣",
      ENTERPRISE: "🟠",
    };

    console.log(`${marker} ${tierEmoji[project.tier] ?? "⚪"} ${project.name}`);
    console.log(`    ${project.path}`);
    console.log("");
  }
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register switch command.
 */
export function registerSwitchCommand(program: Command): void {
  program
    .command("switch <project>")
    .description("Switch to a different project")
    .option("-v, --verbose", "Show detailed output")
    .action(switchAction);

  program
    .command("projects")
    .description("List tracked projects")
    .action(listProjectsAction);
}
