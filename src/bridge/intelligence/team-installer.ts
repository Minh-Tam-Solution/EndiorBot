/**
 * Team Installer — Generate .claude/agents/{teamId}-team.md files.
 *
 * Sprint 89 (ADR-026): Generates team leader agent files that include
 * charter context, teammate list, delegation rules, and the Agent tool
 * for sub-agent spawning via Claude Code Agent Teams.
 *
 * CTO conditions:
 * - C1: AGENT_TEAMS flag must be enabled (default false)
 * - C2: Files named {teamId}-team.md
 * - C3: Fullstack team excluded
 * - C7: Agent tool ONLY in team files, not solo agent files
 *
 * @module bridge/intelligence/team-installer
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveTemplatesRoot } from "../../config/paths.js";

import type { AgentRole } from "./envelope.js";
import type { TeamId, TeamDefinition } from "../../agents/types/team.js";
import { TEAM_DISPLAY_NAMES } from "../../agents/types/team.js";
import { createTeamRegistry } from "../../agents/orchestrator/team-registry.js";
import { getFeatureFlagWithEnvOverride } from "../../config/feature-flags.js";
import { SONNET } from "../../config/models.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Static map of team leader roles to team IDs.
 * Used by agent-launcher.ts for fast team file lookup without registry.
 * CTO MF-1: Avoids runtime registry + tier dependency in launch path.
 */
export const TEAM_LEADERS: Partial<Record<AgentRole, TeamId>> = {
  pm: "planning",
  architect: "design",
  coder: "dev",
  reviewer: "qa",
  tester: "qa",
  devops: "ops",
  ceo: "executive",
};

/**
 * Reverse map: teamId → leader role.
 * Used by Telegram command handler to derive agentRole from teamId
 * without runtime registry lookup (CTO MF-1, Sprint 90).
 */
export const TEAM_LEADER_ROLES: Partial<Record<TeamId, AgentRole>> = {
  planning: "pm",
  design: "architect",
  dev: "coder",
  qa: "reviewer",
  ops: "devops",
  executive: "ceo",
};

/** Brief descriptions for teammate entries in generated files */
const TEAMMATE_DESCRIPTIONS: Record<string, string> = {
  researcher: "Discovery and user research",
  pm: "Requirements and user stories",
  pjm: "Sprint coordination and task tracking",
  architect: "System design and ADRs",
  coder: "Implementation and TDD",
  reviewer: "Code review and standards",
  tester: "Testing and quality assurance",
  devops: "Deployment and operations",
  ceo: "Strategic direction",
  cpo: "Product vision and prioritization",
  cto: "Technical standards and architecture review",
  cso: "Security architecture, threat modeling, and compliance",
  assistant: "Message routing and delegation",
};

/**
 * Default allowed tools for team leader files.
 * Includes Agent tool (C7: team files only).
 */
const TEAM_LEADER_TOOLS = ["Agent", "Read", "Write", "Edit", "Bash", "Grep", "Glob"];

/** Max turns for team coordination (higher than solo) */
const TEAM_MAX_TURNS = 25;

/** Model for team leader files */
const TEAM_MODEL = SONNET;

// ============================================================================
// Types
// ============================================================================

export interface TeamInstallResult {
  created: number;
  skipped: number;
  excluded: number;
  details: Array<{
    teamId: string;
    status: "created" | "skipped" | "excluded";
    path: string;
    reason?: string;
  }>;
}

// ============================================================================
// Team Installer
// ============================================================================

/**
 * Install .claude/agents/{teamId}-team.md files in a target project.
 *
 * @param projectPath - Target project directory
 * @param options - Install options (force, tier)
 * @returns TeamInstallResult with per-team status
 * @throws Error if AGENT_TEAMS flag is disabled (A3)
 */
export function installTeams(
  projectPath: string,
  options?: { force?: boolean; tier?: string },
): TeamInstallResult {
  // A3: Check feature flag before any file I/O
  if (!getFeatureFlagWithEnvOverride("AGENT_TEAMS")) {
    throw new Error(
      "AGENT_TEAMS feature flag is disabled. " +
      "Set ENDIORBOT_FF_AGENT_TEAMS=true or enable in feature-flags.ts to generate team files.",
    );
  }

  const agentsDir = join(projectPath, ".claude", "agents");
  const force = options?.force ?? false;
  const tier = (options?.tier ?? "STANDARD") as "LITE" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE";

  // Create team registry to get team definitions
  const registry = createTeamRegistry(tier);
  const teams = registry.getAvailableTeams();

  // Ensure .claude/agents/ directory exists
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true });
  }

  const result: TeamInstallResult = {
    created: 0,
    skipped: 0,
    excluded: 0,
    details: [],
  };

  for (const team of teams) {
    const teamFilePath = join(agentsDir, `${team.id}-team.md`);

    // C3: Skip fullstack team
    if (team.id === "fullstack") {
      result.excluded++;
      result.details.push({
        teamId: team.id,
        status: "excluded",
        path: teamFilePath,
        reason: "fullstack team excluded (C3)",
      });
      continue;
    }

    // Skip teams with 0 non-leader teammates
    const teammates = team.members.filter((m) => m !== team.leader);
    if (teammates.length === 0) {
      result.excluded++;
      result.details.push({
        teamId: team.id,
        status: "excluded",
        path: teamFilePath,
        reason: "no teammates (leader-only team)",
      });
      continue;
    }

    // Path traversal guard
    if (team.id.includes("..") || team.id.includes("/")) {
      result.excluded++;
      result.details.push({
        teamId: team.id,
        status: "excluded",
        path: teamFilePath,
        reason: "invalid team ID (path traversal)",
      });
      continue;
    }

    // Skip if file exists and not forcing
    if (existsSync(teamFilePath) && !force) {
      result.skipped++;
      result.details.push({
        teamId: team.id,
        status: "skipped",
        path: teamFilePath,
      });
      continue;
    }

    // W3: Load charter — exclude if not found
    let charter: string | undefined;
    try {
      // loadCharter is async but we need sync here — read directly
      charter = loadCharterSync(team.id);
    } catch {
      // Charter not found
    }

    if (!charter) {
      result.excluded++;
      result.details.push({
        teamId: team.id,
        status: "excluded",
        path: teamFilePath,
        reason: "charter not found",
      });
      continue;
    }

    // Build and write team file
    const content = buildTeamFile(team, teammates, charter);
    writeFileSync(teamFilePath, content, { encoding: "utf-8", mode: 0o644 });

    result.created++;
    result.details.push({
      teamId: team.id,
      status: "created",
      path: teamFilePath,
    });
  }

  return result;
}

// ============================================================================
// File Builder
// ============================================================================

/**
 * Build team file content with frontmatter + charter + teammates + delegation.
 */
function buildTeamFile(
  team: TeamDefinition,
  teammates: AgentRole[],
  charter: string,
): string {
  const displayName = TEAM_DISPLAY_NAMES[team.id] ?? team.name;
  const toolsJson = JSON.stringify(TEAM_LEADER_TOOLS);

  // Frontmatter (C2: {teamId}-team naming, C7: Agent in allowed-tools)
  const frontmatter = [
    "---",
    `name: ${team.id}-team`,
    `model: ${TEAM_MODEL}`,
    `description: "${displayName} leader with team coordination. NOTE: Team mode multiplies token cost."`,
    `allowed-tools: ${toolsJson}`,
    `max-turns: ${TEAM_MAX_TURNS}`,
    "---",
    "",
  ].join("\n");

  // Team header
  const header = `# ${displayName} — Leader Context\n\n`;

  // Charter section
  const charterSection = `## Charter\n\n${charter}\n\n`;

  // Teammates section
  const teammateLines = teammates.map((role) => {
    const desc = TEAMMATE_DESCRIPTIONS[role] ?? role;
    return `- **@${role}** — ${desc}`;
  });
  const teammatesSection = `## Teammates\n\n${teammateLines.join("\n")}\n\n`;

  // Delegation rules
  const delegationSection = [
    "## Delegation Rules",
    "",
    "- Spawn teammates using the Agent tool with their role name.",
    "- Delegate atomic subtasks only — do not delegate ambiguous work.",
    "- Collect teammate outputs before reporting final result to CEO.",
    "- Each teammate runs independently — no shared state between sub-agents.",
    "",
  ].join("\n");

  return frontmatter + header + charterSection + teammatesSection + delegationSection;
}

// ============================================================================
// Charter Loader (sync)
// ============================================================================

/**
 * Load charter content synchronously from TEAM-{teamId}.md.
 * Strips YAML frontmatter if present.
 */
function loadCharterSync(teamId: string): string | undefined {
  const charterPath = join(resolveTemplatesRoot(), "teams", `TEAM-${teamId}.md`);

  if (!existsSync(charterPath)) return undefined;

  const raw = readFileSync(charterPath, "utf-8");

  // Strip YAML frontmatter
  const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n/);
  return fmMatch ? raw.slice(fmMatch[0].length).trim() : raw.trim();
}
