/**
 * Plugin Loader Tests
 *
 * Sprint 152 — discoverSkills() and loadSkill() coverage.
 *
 * @module tests/sdlc/scaffold/plugin-loader
 * @sdlc SDLC Framework 6.4.0
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverSkills, loadSkill } from "../../../src/sdlc/scaffold/plugin-loader.js";

let testDir: string;

beforeEach(() => {
  testDir = join(
    tmpdir(),
    `plugin-loader-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

// ============================================================================
// Helper
// ============================================================================

function writeSkill(
  relativePath: string,
  frontmatter: Record<string, string>,
  body = "# Skill body\n"
): void {
  const fullPath = join(testDir, relativePath);
  mkdirSync(fullPath.substring(0, fullPath.lastIndexOf("/")), { recursive: true });
  const fmLines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const content = `---\n${fmLines}\n---\n${body}`;
  writeFileSync(fullPath, content);
}

// ============================================================================
// discoverSkills
// ============================================================================

describe("discoverSkills", () => {
  it("discovers folder-per-skill pattern", () => {
    writeSkill("skills/code-review/SKILL.md", {
      name: "code-review",
      description: "Review code changes",
    });

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: "code-review",
      description: "Review code changes",
      source: "folder",
    });
  });

  it("discovers flat fallback pattern", () => {
    writeSkill("skills/my-skill.md", {
      name: "my-skill",
      description: "My flat skill",
    });

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: "my-skill",
      description: "My flat skill",
      source: "flat",
    });
  });

  it("gives folder priority over flat for same name", () => {
    writeSkill("skills/review/SKILL.md", {
      name: "review",
      description: "Folder version",
    });
    writeSkill("skills/review.md", {
      name: "review",
      description: "Flat version",
    });

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: "review",
      description: "Folder version",
      source: "folder",
    });
  });

  it("excludes README.md", () => {
    writeSkill("skills/README.md", {
      name: "readme-skill",
      description: "Should be excluded",
    });

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(0);
  });

  it("derives name from heading when frontmatter name missing", () => {
    writeSkill("skills/bad/SKILL.md", {
      description: "No name here",
    });
    // The SKILL.md body has "# SKILL" heading from writeSkill, so name is derived
    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.description).toBe("No name here");
  });

  it("derives name from heading when no frontmatter", () => {
    const path = join(testDir, "skills/no-fm.md");
    mkdirSync(join(testDir, "skills"), { recursive: true });
    writeFileSync(path, "# Just body\nNo frontmatter.");

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe("just-body");
  });

  it("skips skill with no name AND no heading", () => {
    const path = join(testDir, "skills/empty.md");
    mkdirSync(join(testDir, "skills"), { recursive: true });
    writeFileSync(path, "No heading, no frontmatter.");

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(0);
  });

  it("returns empty array for empty skills directory", () => {
    mkdirSync(join(testDir, "skills"), { recursive: true });

    const skills = discoverSkills(testDir);
    expect(skills).toEqual([]);
  });

  it("returns empty array when skills directory missing", () => {
    const skills = discoverSkills(testDir);
    expect(skills).toEqual([]);
  });

  it("discovers root SKILL.md with source: root", () => {
    writeSkill("SKILL.md", { name: "root-skill", description: "Project-level skill" });

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: "root-skill",
      description: "Project-level skill",
      source: "root",
    });
  });

  it("gives skills/ priority over root SKILL.md for same name", () => {
    writeSkill("SKILL.md", { name: "review", description: "Root version" });
    writeSkill("skills/review/SKILL.md", { name: "review", description: "Folder version" });

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: "review",
      description: "Folder version",
      source: "folder",
    });
  });

  it("discovers root SKILL.md alongside skills/ with different names", () => {
    writeSkill("SKILL.md", { name: "root-skill", description: "Root version" });
    writeSkill("skills/folder-skill/SKILL.md", { name: "folder-skill", description: "Folder version" });

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name)).toEqual(["folder-skill", "root-skill"]);
  });

  it("sorts skills alphabetically", () => {
    writeSkill("skills/zebra/SKILL.md", { name: "zebra", description: "Z" });
    writeSkill("skills/alpha/SKILL.md", { name: "alpha", description: "A" });
    writeSkill("skills/middle/SKILL.md", { name: "middle", description: "M" });

    const skills = discoverSkills(testDir);
    expect(skills.map((s) => s.name)).toEqual(["alpha", "middle", "zebra"]);
  });

  it("parses argument-hint when present", () => {
    writeSkill("skills/review/SKILL.md", {
      name: "review",
      description: "Review",
      "argument-hint": "<PR URL>",
    });

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].argumentHint).toBe("<PR URL>");
  });

  it("does not set argumentHint when absent (exactOptionalPropertyTypes)", () => {
    writeSkill("skills/review/SKILL.md", {
      name: "review",
      description: "Review",
    });

    const skills = discoverSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0]).not.toHaveProperty("argumentHint");
  });
});

// ============================================================================
// loadSkill
// ============================================================================

describe("loadSkill", () => {
  it("parses frontmatter and body correctly", () => {
    const path = join(testDir, "skill.md");
    writeFileSync(
      path,
      "---\nname: test-skill\ndescription: A test\n---\n# Body\nContent here."
    );

    const skill = loadSkill(path, "flat");
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("test-skill");
    expect(skill!.description).toBe("A test");
    expect(skill!.content).toBe("# Body\nContent here.");
    expect(skill!.source).toBe("flat");
    expect(skill!.filePath).toBe(path);
  });

  it("returns null for unreadable file", () => {
    const skill = loadSkill("/nonexistent/path/skill.md", "flat");
    expect(skill).toBeNull();
  });
});
