/**
 * Template Generator Tests
 *
 * Unit tests for SDLC template generation (CLAUDE.md, AGENTS.md, etc.).
 *
 * @module tests/sdlc/scaffold/templates
 * @version 1.0.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 61
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  generateSdlcConfig,
  serializeSdlcConfig,
  generateMinimalConfig,
  generateClaudeMd,
  generateSubdirClaudeMd,
  generateIdentityMd,
  generateAgentsMd,
  getAllAgents,
  getAgentById,
} from "../../../src/sdlc/scaffold/templates/index.js";
import type { ProjectConfig } from "../../../src/sdlc/scaffold/types.js";
import type { ProjectSnapshot } from "../../../src/sdlc/compliance/fix-types.js";

function createTestProjectPath(): string {
  return mkdtempSync(join(tmpdir(), "endiorbot-template-test-"));
}

function scaffoldDocsStages(projectPath: string, tier: ProjectConfig["tier"] = "STANDARD"): void {
  const stages: Record<ProjectConfig["tier"], string[]> = {
    LITE: ["00-foundation", "01-planning", "02-design", "04-build"],
    STANDARD: [
      "00-foundation", "01-planning", "02-design", "04-build",
      "05-test", "06-deploy", "08-collaborate",
    ],
    PROFESSIONAL: [
      "00-foundation", "01-planning", "02-design", "03-integrate",
      "04-build", "05-test", "06-deploy", "07-operate",
      "08-collaborate", "09-govern",
    ],
    ENTERPRISE: [
      "00-foundation", "01-planning", "02-design", "03-integrate",
      "04-build", "05-test", "06-deploy", "07-operate",
      "08-collaborate", "09-govern", "10-archive",
    ],
  };
  for (const stage of stages[tier]) {
    mkdirSync(join(projectPath, "docs", stage), { recursive: true });
  }
}

// ============================================================================
// Test Data
// ============================================================================

const testProject: ProjectConfig = {
  id: "test-project",
  name: "Test Project",
  description: "A test project for unit testing",
  tier: "STANDARD",
  frameworkVersion: "6.1.1",
};

const liteProject: ProjectConfig = {
  id: "lite-project",
  name: "Lite Project",
  description: "A lite tier project",
  tier: "LITE",
  frameworkVersion: "6.1.1",
};

const enterpriseProject: ProjectConfig = {
  id: "enterprise-project",
  name: "Enterprise Project",
  description: "An enterprise tier project",
  tier: "ENTERPRISE",
  frameworkVersion: "6.1.1",
};

// ============================================================================
// generateSdlcConfig Tests
// ============================================================================

describe("generateSdlcConfig", () => {
  it("should generate config with correct generator", () => {
    const config = generateSdlcConfig(testProject);
    expect(config.generator).toBe("endiorbot");
  });

  it("should include schema version", () => {
    const config = generateSdlcConfig(testProject);
    expect(config.schema_version).toBeDefined();
  });

  it("should include project tier", () => {
    const config = generateSdlcConfig(testProject);
    expect(config.tier).toBe("STANDARD");
  });

  it("should include project metadata", () => {
    const config = generateSdlcConfig(testProject);
    expect(config.project.id).toBe("test-project");
    expect(config.project.name).toBe("Test Project");
    expect(config.project.description).toBe("A test project for unit testing");
  });

  it("should include framework version", () => {
    const config = generateSdlcConfig(testProject);
    expect(config.framework_version).toBe("6.1.1");
  });

  it("should include generated_at timestamp", () => {
    const config = generateSdlcConfig(testProject);
    expect(config.generated_at).toBeDefined();
  });
});

// ============================================================================
// serializeSdlcConfig Tests
// ============================================================================

describe("serializeSdlcConfig", () => {
  it("should return valid JSON", () => {
    const config = generateSdlcConfig(testProject);
    const json = serializeSdlcConfig(config);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("should pretty-print with indentation", () => {
    const config = generateSdlcConfig(testProject);
    const json = serializeSdlcConfig(config);

    expect(json).toContain("\n");
    expect(json).toContain("  "); // Indentation
  });
});

// ============================================================================
// generateMinimalConfig Tests
// ============================================================================

describe("generateMinimalConfig", () => {
  it("should generate minimal config for migration", () => {
    const config = generateMinimalConfig(
      { id: "migrated", name: "Migrated Project" },
      "LITE",
      "tinysdlc",
      { original: true }
    );
    expect(config.generator).toBe("endiorbot");
    expect(config.tier).toBe("LITE");
    expect(config.migrated_from).toBe("tinysdlc");
  });
});

// ============================================================================
// generateClaudeMd Tests
// ============================================================================

describe("generateClaudeMd", () => {
  it("should include project name", () => {
    const content = generateClaudeMd(testProject);
    expect(content).toContain("Test Project");
  });

  it("should include CLAUDE.md header", () => {
    const content = generateClaudeMd(testProject);
    expect(content).toContain("# CLAUDE.md");
  });

  it("should include 4 Non-Negotiable Invariants", () => {
    const content = generateClaudeMd(testProject);
    expect(content).toContain("Non-Negotiable Invariants");
    expect(content).toContain("THIN CLIENT PATTERN");
    expect(content).toContain("STDIN JSON FOR HOOKS");
  });

  it("should include thin client pattern", () => {
    const content = generateClaudeMd(testProject);
    // Content mentions "THIN CLIENT PATTERN" and "Thin client pattern"
    expect(content.toLowerCase()).toContain("thin client");
  });

  it("should include framework version", () => {
    const content = generateClaudeMd(testProject);
    expect(content).toContain("6.1.1");
  });

  it("should include SDLC integration section", () => {
    const content = generateClaudeMd(testProject);
    expect(content).toContain("SDLC");
  });

  it("should include Context Files section for STANDARD tier", () => {
    const content = generateClaudeMd({ ...testProject, tier: "STANDARD" });
    expect(content).toContain("## Context Files");
    expect(content).toContain("src/CLAUDE.md");
  });

  it("should NOT include Context Files section for LITE tier", () => {
    const content = generateClaudeMd({ ...testProject, tier: "LITE" });
    expect(content).not.toContain("## Context Files");
  });
});

// ============================================================================
// generateSubdirClaudeMd Tests — Sprint 150
// ============================================================================

describe("generateSubdirClaudeMd", () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = createTestProjectPath();
    scaffoldDocsStages(projectPath, testProject.tier);
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
  });

  it("should generate src/CLAUDE.md with code conventions", () => {
    const content = generateSubdirClaudeMd("src", testProject, projectPath);
    expect(content).toContain("# CLAUDE.md — src/");
    expect(content).toContain("## Code Conventions");
    expect(content).toContain("See root \`CLAUDE.md\`");
  });

  it("should generate tests/CLAUDE.md with testing conventions", () => {
    const content = generateSubdirClaudeMd("tests", testProject, projectPath);
    expect(content).toContain("# CLAUDE.md — tests/");
    expect(content).toContain("## Testing Conventions");
    expect(content).toContain("Run all tests in this directory");
  });

  it("should generate docs/CLAUDE.md with documentation standards", () => {
    const content = generateSubdirClaudeMd("docs", testProject, projectPath);
    expect(content).toContain("# CLAUDE.md — docs/");
    expect(content).toContain("## Documentation Standards");
    expect(content).toContain("00-foundation");
  });

  it("should be under 100 lines", () => {
    const src = generateSubdirClaudeMd("src", testProject, projectPath);
    const tests = generateSubdirClaudeMd("tests", testProject, projectPath);
    const docs = generateSubdirClaudeMd("docs", testProject, projectPath);
    expect(src.split("\n").length).toBeLessThan(100);
    expect(tests.split("\n").length).toBeLessThan(100);
    expect(docs.split("\n").length).toBeLessThan(100);
  });

  it("should include tech-stack info when snapshot provided", () => {
    const snapshot: ProjectSnapshot = {
      techStack: {
        language: "Python",
        framework: "Flask",
        packageManager: "pip",
        scripts: {},
      },
    } as ProjectSnapshot;
    const content = generateSubdirClaudeMd("src", testProject, projectPath, snapshot);
    expect(content).toContain("Python");
    expect(content).toContain("Flask");
  });

  it("docs/CLAUDE.md only references existing stage dirs", () => {
    // Use a fresh project with no docs/ folder
    const emptyPath = createTestProjectPath();
    try {
      const content = generateSubdirClaudeMd("docs", testProject, emptyPath);
      expect(content).toContain("## Documentation Standards");
      expect(content).not.toContain("- \`00-foundation/\`");
    } finally {
      rmSync(emptyPath, { recursive: true, force: true });
    }
  });

  it("docs/CLAUDE.md with all stages present → all listed", () => {
    const content = generateSubdirClaudeMd("docs", testProject, projectPath);
    expect(content).toContain("- \`00-foundation/\`");
    expect(content).toContain("- \`01-planning/\`");
    expect(content).toContain("- \`02-design/\`");
    expect(content).toContain("- \`04-build/\`");
    expect(content).toContain("- \`05-test/\`");
    expect(content).toContain("- \`06-deploy/\`");
    expect(content).toContain("- \`08-collaborate/\`");
  });

  it("ADR path exists → referenced; ADR path missing → not referenced", () => {
    const content = generateSubdirClaudeMd("docs", testProject, projectPath);
    expect(content).not.toContain("docs/02-design/01-ADRs/");

    mkdirSync(join(projectPath, "docs", "02-design", "01-ADRs"), { recursive: true });
    const withAdr = generateSubdirClaudeMd("docs", testProject, projectPath);
    expect(withAdr).toContain("docs/02-design/01-ADRs/");
  });
});

// ============================================================================
// generateIdentityMd Tests
// ============================================================================

describe("generateIdentityMd", () => {
  it("should include project name", () => {
    const content = generateIdentityMd(testProject);
    expect(content).toContain("Test Project");
  });

  it("should include Project Identity header", () => {
    const content = generateIdentityMd(testProject);
    expect(content).toContain("Project Identity");
  });

  it("should include project description", () => {
    const content = generateIdentityMd(testProject);
    expect(content).toContain("A test project for unit testing");
  });

  it("should include tier information", () => {
    const content = generateIdentityMd(testProject);
    expect(content).toContain("STANDARD");
  });

  it("should include framework version", () => {
    const content = generateIdentityMd(testProject);
    expect(content).toContain("6.1.1");
  });
});

// ============================================================================
// generateAgentsMd Tests
// ============================================================================

describe("generateAgentsMd", () => {
  it("should include project name", () => {
    const content = generateAgentsMd(testProject);
    expect(content).toContain("Test Project");
  });

  it("should include AGENTS.md header", () => {
    const content = generateAgentsMd(testProject);
    expect(content).toContain("AGENTS.md");
  });

  it("should include agent roster table", () => {
    const content = generateAgentsMd(testProject);
    expect(content).toContain("Agent Roster");
    expect(content).toContain("| ID |");
    expect(content).toContain("| Name |");
  });

  it("should include tier in content", () => {
    const content = generateAgentsMd(testProject);
    expect(content).toContain("STANDARD");
  });

  it("should include coder agent for all tiers", () => {
    const liteContent = generateAgentsMd(liteProject);
    const standardContent = generateAgentsMd(testProject);

    expect(liteContent).toContain("@coder");
    expect(standardContent).toContain("@coder");
  });

  it("should include pm agent for STANDARD+", () => {
    const liteContent = generateAgentsMd(liteProject);
    const standardContent = generateAgentsMd(testProject);

    // LITE tier has 3 agents (SASE 6.1.2), STANDARD has more
    expect(liteContent).toContain("Total Agents:** 3");
    expect(standardContent).toContain("Total Agents:** ");
    // The roster table should contain pm for STANDARD but not LITE
    expect(liteContent).toContain("| @coder |");
    expect(liteContent).not.toContain("| @pm |");
    expect(standardContent).toContain("| @pm |");
  });

  it("should include architect agent for STANDARD+ (SASE 6.1.2)", () => {
    const liteContent = generateAgentsMd(liteProject);
    const standardContent = generateAgentsMd(testProject);

    // SASE 6.1.2: architect is STANDARD tier (was PROFESSIONAL)
    expect(liteContent).not.toContain("| @architect |");
    expect(standardContent).toContain("| @architect |");
  });

  it("should include SASE section", () => {
    const content = generateAgentsMd(testProject);
    expect(content).toContain("SASE");
    expect(content).toContain("CRP");
    expect(content).toContain("MRP");
  });

  it("should include usage examples", () => {
    const content = generateAgentsMd(testProject);
    expect(content).toContain("Usage");
    expect(content).toContain("endiorbot");
  });
});

// ============================================================================
// getAllAgents Tests
// ============================================================================

describe("getAllAgents", () => {
  it("should return array of agents", () => {
    const agents = getAllAgents();
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBeGreaterThan(0);
  });

  it("should include required properties for each agent", () => {
    const agents = getAllAgents();

    for (const agent of agents) {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(agent.description).toBeDefined();
      expect(agent.model).toBeDefined();
      expect(agent.minTier).toBeDefined();
      expect(agent.capabilities).toBeDefined();
    }
  });

  it("should include coder agent", () => {
    const agents = getAllAgents();
    const coder = agents.find((a) => a.id === "coder");

    expect(coder).toBeDefined();
    expect(coder?.name).toBe("Coder");
  });

  it("should include assistant agent", () => {
    const agents = getAllAgents();
    const assistant = agents.find((a) => a.id === "assistant");

    expect(assistant).toBeDefined();
    expect(assistant?.minTier).toBe("LITE");
  });

  it("should return a copy, not the original array", () => {
    const agents1 = getAllAgents();
    const agents2 = getAllAgents();

    expect(agents1).not.toBe(agents2);
  });
});

// ============================================================================
// getAgentById Tests
// ============================================================================

describe("getAgentById", () => {
  it("should return agent by ID", () => {
    const coder = getAgentById("coder");

    expect(coder).toBeDefined();
    expect(coder?.id).toBe("coder");
    expect(coder?.name).toBe("Coder");
  });

  it("should return undefined for unknown ID", () => {
    const unknown = getAgentById("nonexistent");
    expect(unknown).toBeUndefined();
  });

  it("should find architect agent", () => {
    const architect = getAgentById("architect");

    expect(architect).toBeDefined();
    expect(architect?.model).toBe("opus");
    expect(architect?.minTier).toBe("STANDARD");
  });

  it("should find ceo agent", () => {
    const ceo = getAgentById("ceo");

    expect(ceo).toBeDefined();
    expect(ceo?.name).toBe("CEO Advisor");
  });
});

// ============================================================================
// Snapshot-aware template tests (Sprint 79)
// ============================================================================

/** Mock snapshot mimicking open-pencil: TypeScript + Vue/Vite + Bun + Tauri 2 */
const mockSnapshot: ProjectSnapshot = {
  name: "open-pencil",
  description: "A collaborative design tool",
  tier: "STANDARD",
  techStack: {
    language: "TypeScript",
    framework: "Vue/Vite",
    packageManager: "bun",
    desktop: "Tauri 2",
    hasTypeScript: true,
    hasDocker: false,
    hasCI: false,
    dependencies: ["vue", "vite", "@tauri-apps/api"],
    devDependencies: ["vitest", "playwright"],
    scripts: {
      dev: "vite",
      build: "vite build",
      test: "vitest run",
      lint: "eslint .",
    },
  },
  codeModules: [],
  testFiles: [
    { path: "tests/e2e/app.spec.ts", name: "app.spec.ts", type: "e2e" },
    { path: "tests/unit/store.test.ts", name: "store.test.ts", type: "unit" },
  ],
  existingDocs: [],
  projectPath: "/tmp/open-pencil",
};

describe("generateIdentityMd with snapshot", () => {
  it("includes Tech Stack section when snapshot provided", () => {
    const content = generateIdentityMd(testProject, mockSnapshot);
    expect(content).toContain("## Tech Stack");
  });

  it("includes detected language", () => {
    const content = generateIdentityMd(testProject, mockSnapshot);
    expect(content).toContain("TypeScript");
  });

  it("includes detected framework", () => {
    const content = generateIdentityMd(testProject, mockSnapshot);
    expect(content).toContain("Vue/Vite");
  });

  it("includes detected package manager", () => {
    const content = generateIdentityMd(testProject, mockSnapshot);
    expect(content).toContain("bun");
  });

  it("includes desktop runtime", () => {
    const content = generateIdentityMd(testProject, mockSnapshot);
    expect(content).toContain("Tauri 2");
  });

  it("omits Tech Stack section when no snapshot", () => {
    const content = generateIdentityMd(testProject);
    expect(content).not.toContain("## Tech Stack");
  });
});

describe("generateClaudeMd with snapshot", () => {
  it("uses detected package manager in install command", () => {
    const content = generateClaudeMd(testProject, mockSnapshot);
    expect(content).toContain("bun install");
  });

  it("includes bun run dev from scripts", () => {
    const content = generateClaudeMd(testProject, mockSnapshot);
    expect(content).toContain("bun run dev");
  });

  it("includes bun run test from scripts", () => {
    const content = generateClaudeMd(testProject, mockSnapshot);
    expect(content).toContain("bun run test");
  });

  it("does NOT include pnpm install when snapshot provided", () => {
    const content = generateClaudeMd(testProject, mockSnapshot);
    expect(content).not.toContain("pnpm install");
  });

  it("falls back to pnpm commands when no snapshot", () => {
    const content = generateClaudeMd(testProject);
    expect(content).toContain("pnpm install");
  });
});

describe("generateClaudeMd ecosystem-aware commands", () => {
  function makeSnapshot(ecosystem: ProjectSnapshot["techStack"]["ecosystem"], pm?: string): ProjectSnapshot {
    return {
      name: "eco-project",
      description: "Eco project",
      tier: "STANDARD",
      techStack: {
        language: "Generic",
        packageManager: pm,
        ecosystem,
        hasTypeScript: false,
        hasDocker: ecosystem === "docker",
        hasCI: false,
        dependencies: [],
        devDependencies: [],
        scripts: {},
      },
      codeModules: [],
      testFiles: [],
      existingDocs: [],
      projectPath: "/tmp/eco-project",
    };
  }

  it("Python project → CLAUDE.md shows pip/pytest commands", () => {
    const content = generateClaudeMd(testProject, makeSnapshot("python"));
    expect(content).toContain("pip install -r requirements.txt");
    expect(content).toContain("pytest");
    expect(content).not.toContain("pnpm install");
  });

  it("Python (poetry) project → CLAUDE.md shows poetry commands", () => {
    const content = generateClaudeMd(testProject, makeSnapshot("python", "poetry"));
    expect(content).toContain("poetry install");
    expect(content).toContain("poetry run pytest");
  });

  it("Docker project → CLAUDE.md shows docker compose commands", () => {
    const content = generateClaudeMd(testProject, makeSnapshot("docker"));
    expect(content).toContain("docker compose build");
    expect(content).toContain("docker compose up");
    expect(content).toContain("docker compose down");
    expect(content).not.toContain("pnpm install");
  });

  it("Rust project → CLAUDE.md shows cargo commands", () => {
    const content = generateClaudeMd(testProject, makeSnapshot("rust"));
    expect(content).toContain("cargo build");
    expect(content).toContain("cargo test");
    expect(content).toContain("cargo clippy");
    expect(content).not.toContain("pnpm install");
  });

  it("Node.js project → existing pnpm behavior preserved", () => {
    const snapshot = makeSnapshot("node", "pnpm");
    snapshot.techStack.scripts = { dev: "vite", test: "vitest run" };
    const content = generateClaudeMd(testProject, snapshot);
    expect(content).toContain("pnpm install");
    expect(content).toContain("pnpm run dev");
    expect(content).toContain("pnpm run test");
  });

  it("No snapshot → generic fallback (backward compat)", () => {
    const content = generateClaudeMd(testProject);
    expect(content).toContain("pnpm install");
    expect(content).toContain("pnpm build");
  });
});

describe("generateSdlcConfig with snapshot", () => {
  it("includes techStack when snapshot provided", () => {
    const config = generateSdlcConfig(testProject, mockSnapshot);
    expect(config.techStack).toBeDefined();
    expect(config.techStack?.language).toBe("TypeScript");
    expect(config.techStack?.framework).toBe("Vue/Vite");
  });

  it("includes analyzedAt when snapshot provided", () => {
    const config = generateSdlcConfig(testProject, mockSnapshot);
    expect(config.analyzedAt).toBeDefined();
    expect(typeof config.analyzedAt).toBe("string");
  });

  it("omits techStack when no snapshot", () => {
    const config = generateSdlcConfig(testProject);
    expect(config.techStack).toBeUndefined();
    expect(config.analyzedAt).toBeUndefined();
  });
});
