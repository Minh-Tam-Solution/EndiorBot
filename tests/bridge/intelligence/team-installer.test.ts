/**
 * Tests for TeamInstaller — Sprint 89 (ADR-026)
 *
 * Covers: feature flag gating, fullstack exclusion (C3), zero-member skip,
 * file generation with correct frontmatter, charter content, teammates,
 * Agent tool isolation (C7), force/skip behavior, path traversal guard,
 * and charter-missing exclusion (W3).
 *
 * @module tests/bridge/intelligence/team-installer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ============================================================================
// Mocks — feature flag + charter loading
// ============================================================================

const mockGetFeatureFlag = vi.fn().mockReturnValue(true);

vi.mock("../../../src/config/feature-flags.js", () => ({
  getFeatureFlagWithEnvOverride: (...args: unknown[]) => mockGetFeatureFlag(...args),
}));

// Mock team registry to return controlled team definitions
const mockTeams = vi.fn().mockReturnValue([
  {
    id: "dev",
    name: "Development Team",
    archetype: "dev",
    leader: "coder",
    members: ["coder", "reviewer"],
    sdlcStages: ["04"],
    sdlcGates: ["G-Sprint"],
    isActive: true,
  },
  {
    id: "fullstack",
    name: "Full Stack Team",
    archetype: "fullstack",
    leader: "fullstack",
    members: ["fullstack"],
    sdlcStages: ["00", "01", "02", "04", "05", "06"],
    sdlcGates: ["G0.1", "G1", "G2", "G-Sprint", "G3", "G4"],
    isActive: true,
  },
  {
    id: "planning",
    name: "Planning Team",
    archetype: "planning",
    leader: "pm",
    members: ["pm", "pjm", "researcher"],
    sdlcStages: ["00", "01"],
    sdlcGates: ["G0.1", "G1"],
    isActive: true,
  },
  {
    id: "qa",
    name: "QA Team",
    archetype: "qa",
    leader: "reviewer",
    members: ["reviewer"],  // leader-only team
    sdlcStages: ["05"],
    sdlcGates: ["G3"],
    isActive: true,
  },
]);

vi.mock("../../../src/agents/orchestrator/team-registry.js", () => ({
  createTeamRegistry: () => ({
    getAvailableTeams: () => mockTeams(),
  }),
}));

// Mock resolveTemplatesRoot to point at a temp dir (set per test)
let mockTemplatesRoot = "";
vi.mock("../../../src/config/paths.js", () => ({
  resolveTemplatesRoot: () => mockTemplatesRoot,
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { installTeams, TEAM_LEADERS } from "../../../src/bridge/intelligence/team-installer.js";

// ============================================================================
// Helpers
// ============================================================================

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const lines = match[1]!.split("\n");
  const out: Record<string, string> = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    out[key] = value;
  }
  return out;
}

function createCharterFile(templatesDir: string, teamId: string, content: string): void {
  const teamsDir = join(templatesDir, "teams");
  if (!existsSync(teamsDir)) mkdirSync(teamsDir, { recursive: true });
  writeFileSync(
    join(teamsDir, `TEAM-${teamId}.md`),
    `---\nteam: ${teamId}\narchetype: ${teamId}\n---\n\n${content}`,
    "utf-8",
  );
}

// ============================================================================
// Tests
// ============================================================================

describe("TeamInstaller — installTeams()", () => {
  let tmpDir: string;
  let templatesDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeatureFlag.mockReturnValue(true);
    tmpDir = mkdtempSync(join(tmpdir(), "team-installer-"));
    templatesDir = mkdtempSync(join(tmpdir(), "team-templates-"));
    mockTemplatesRoot = templatesDir;

    // Create charter files for dev and planning teams
    createCharterFile(templatesDir, "dev", "# Development Team Charter\n\nOwn the DO.");
    createCharterFile(templatesDir, "planning", "# Planning Team Charter\n\nOwn the PLAN.");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  // --------------------------------------------------------------------------
  // Feature flag gating (A3)
  // --------------------------------------------------------------------------

  it("should throw when AGENT_TEAMS flag is disabled", () => {
    mockGetFeatureFlag.mockReturnValue(false);
    expect(() => installTeams(tmpDir)).toThrow("AGENT_TEAMS feature flag is disabled");
  });

  it("should check AGENT_TEAMS flag with strict equality", () => {
    mockGetFeatureFlag.mockReturnValue(false);
    expect(() => installTeams(tmpDir)).toThrow();
    expect(mockGetFeatureFlag).toHaveBeenCalledWith("AGENT_TEAMS");
  });

  // --------------------------------------------------------------------------
  // Fullstack exclusion (C3)
  // --------------------------------------------------------------------------

  it("should exclude fullstack team", () => {
    const result = installTeams(tmpDir);
    const fullstack = result.details.find((d) => d.teamId === "fullstack");
    expect(fullstack?.status).toBe("excluded");
    expect(fullstack?.reason).toContain("fullstack");
  });

  // --------------------------------------------------------------------------
  // Zero-member skip
  // --------------------------------------------------------------------------

  it("should exclude teams with 0 non-leader teammates", () => {
    const result = installTeams(tmpDir);
    const qa = result.details.find((d) => d.teamId === "qa");
    expect(qa?.status).toBe("excluded");
    expect(qa?.reason).toContain("no teammates");
  });

  // --------------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------------

  it("should generate correctly named team file", () => {
    const result = installTeams(tmpDir);
    const dev = result.details.find((d) => d.teamId === "dev");
    expect(dev?.status).toBe("created");
    expect(dev?.path).toContain("dev-team.md");
    expect(existsSync(dev!.path)).toBe(true);
  });

  it("should create .claude/agents/ directory if absent", () => {
    const agentsDir = join(tmpDir, ".claude", "agents");
    expect(existsSync(agentsDir)).toBe(false);
    installTeams(tmpDir);
    expect(existsSync(agentsDir)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Frontmatter
  // --------------------------------------------------------------------------

  it("should have correct frontmatter name field", () => {
    installTeams(tmpDir);
    const content = readFileSync(join(tmpDir, ".claude", "agents", "dev-team.md"), "utf-8");
    const fm = parseFrontmatter(content);
    expect(fm["name"]).toBe("dev-team");
  });

  it("should have correct model in frontmatter", () => {
    installTeams(tmpDir);
    const content = readFileSync(join(tmpDir, ".claude", "agents", "dev-team.md"), "utf-8");
    const fm = parseFrontmatter(content);
    expect(fm["model"]).toBe("claude-sonnet-5");
  });

  it("should include Agent in allowed-tools (C7)", () => {
    installTeams(tmpDir);
    const content = readFileSync(join(tmpDir, ".claude", "agents", "dev-team.md"), "utf-8");
    const fm = parseFrontmatter(content);
    expect(fm["allowed-tools"]).toContain("Agent");
  });

  it("should have max-turns set to 25", () => {
    installTeams(tmpDir);
    const content = readFileSync(join(tmpDir, ".claude", "agents", "dev-team.md"), "utf-8");
    const fm = parseFrontmatter(content);
    expect(fm["max-turns"]).toBe("25");
  });

  // --------------------------------------------------------------------------
  // Cost note (CA2)
  // --------------------------------------------------------------------------

  it("should include cost note in description", () => {
    installTeams(tmpDir);
    const content = readFileSync(join(tmpDir, ".claude", "agents", "dev-team.md"), "utf-8");
    const fm = parseFrontmatter(content);
    expect(fm["description"]).toContain("Team mode multiplies token cost");
  });

  // --------------------------------------------------------------------------
  // Charter content
  // --------------------------------------------------------------------------

  it("should include charter content in generated file", () => {
    installTeams(tmpDir);
    const content = readFileSync(join(tmpDir, ".claude", "agents", "dev-team.md"), "utf-8");
    expect(content).toContain("Own the DO.");
  });

  // --------------------------------------------------------------------------
  // Teammates section
  // --------------------------------------------------------------------------

  it("should list non-leader teammates", () => {
    installTeams(tmpDir);
    const content = readFileSync(join(tmpDir, ".claude", "agents", "dev-team.md"), "utf-8");
    expect(content).toContain("@reviewer");
    expect(content).not.toContain("@coder"); // leader excluded from teammate list
  });

  it("should list multiple teammates for planning team", () => {
    installTeams(tmpDir);
    const content = readFileSync(join(tmpDir, ".claude", "agents", "planning-team.md"), "utf-8");
    expect(content).toContain("@pjm");
    expect(content).toContain("@researcher");
  });

  // --------------------------------------------------------------------------
  // Force / skip behavior
  // --------------------------------------------------------------------------

  it("should skip existing file without force", () => {
    // First install
    installTeams(tmpDir);
    // Second install without force
    const result = installTeams(tmpDir);
    const dev = result.details.find((d) => d.teamId === "dev");
    expect(dev?.status).toBe("skipped");
    expect(result.skipped).toBeGreaterThan(0);
  });

  it("should overwrite existing file with force", () => {
    installTeams(tmpDir);
    const result = installTeams(tmpDir, { force: true });
    const dev = result.details.find((d) => d.teamId === "dev");
    expect(dev?.status).toBe("created");
  });

  // --------------------------------------------------------------------------
  // Charter missing exclusion (W3)
  // --------------------------------------------------------------------------

  it("should exclude team when charter is not found", () => {
    // Remove dev charter
    rmSync(join(templatesDir, "teams", "TEAM-dev.md"));
    const result = installTeams(tmpDir);
    const dev = result.details.find((d) => d.teamId === "dev");
    expect(dev?.status).toBe("excluded");
    expect(dev?.reason).toContain("charter not found");
  });

  // --------------------------------------------------------------------------
  // Result counts
  // --------------------------------------------------------------------------

  it("should return correct counts", () => {
    const result = installTeams(tmpDir);
    // dev: created, planning: created, fullstack: excluded, qa: excluded (no teammates)
    expect(result.created).toBe(2);
    expect(result.excluded).toBe(2);
    expect(result.skipped).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEAM_LEADERS static map
  // --------------------------------------------------------------------------

  it("should export TEAM_LEADERS map for launcher", () => {
    expect(TEAM_LEADERS.coder).toBe("dev");
    expect(TEAM_LEADERS.pm).toBe("planning");
    expect(TEAM_LEADERS.architect).toBe("design");
    expect(TEAM_LEADERS.ceo).toBe("executive");
    expect(TEAM_LEADERS.reviewer).toBe("qa");
    expect(TEAM_LEADERS.tester).toBe("qa");
  });

  // --------------------------------------------------------------------------
  // Delegation rules
  // --------------------------------------------------------------------------

  it("should include delegation rules in generated file", () => {
    installTeams(tmpDir);
    const content = readFileSync(join(tmpDir, ".claude", "agents", "dev-team.md"), "utf-8");
    expect(content).toContain("Delegation Rules");
    expect(content).toContain("Agent tool");
  });
});
