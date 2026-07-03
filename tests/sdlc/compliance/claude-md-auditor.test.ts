/**
 * CLAUDE.md Auditor Tests
 *
 * Sprint 153 — Staleness detection coverage.
 *
 * @module tests/sdlc/compliance/claude-md-auditor
 * @sdlc SDLC Framework 6.4.0
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  auditClaudeMd,
  acceptWarning,
} from "../../../src/sdlc/compliance/claude-md-auditor.js";
import { FRAMEWORK_VERSION } from "../../../src/index.js";

let testDir: string;

beforeEach(() => {
  testDir = join(
    tmpdir(),
    `claude-md-auditor-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

// ============================================================================
// Helpers
// ============================================================================

function writeClaudeMd(
  relativePath: string,
  content: string,
  mtime?: Date
): void {
  const fullPath = join(testDir, relativePath);
  mkdirSync(fullPath.substring(0, fullPath.lastIndexOf("/")), {
    recursive: true,
  });
  writeFileSync(fullPath, content);
  if (mtime) {
    utimesSync(fullPath, mtime, mtime);
  }
}

function makeLines(n: number): string {
  return Array.from({ length: n }, (_, i) => `Line ${i + 1}`).join("\n");
}

// ============================================================================
// Tests
// ============================================================================

describe("auditClaudeMd", () => {
  it("returns empty result when no CLAUDE.md files exist", () => {
    const result = auditClaudeMd(testDir);
    expect(result.files).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.activeWarnings).toHaveLength(0);
  });

  it("finds no warnings for clean small CLAUDE.md", () => {
    writeClaudeMd(
      "CLAUDE.md",
      `# Project\n\nSee \`src/main.ts\`.\n\nFramework ${FRAMEWORK_VERSION}.`
    );
    mkdirSync(join(testDir, "src"), { recursive: true });
    writeFileSync(join(testDir, "src/main.ts"), "// main");

    const result = auditClaudeMd(testDir);
    expect(result.files).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.activeWarnings).toHaveLength(0);
  });

  it("detects stale file reference", () => {
    writeClaudeMd(
      "CLAUDE.md",
      `# Project\n\nSee \`src/deleted-file.ts\` for details.`
    );

    const result = auditClaudeMd(testDir);
    const refWarnings = result.activeWarnings.filter((w) =>
      w.id.startsWith("REF-")
    );
    expect(refWarnings).toHaveLength(1);
    expect(refWarnings[0].severity).toBe("warning");
    expect(refWarnings[0].message).toContain("src/deleted-file.ts");
  });

  it("detects outdated framework version", () => {
    writeClaudeMd("CLAUDE.md", `# Project\n\nFramework 6.3.0 compliant.`);

    const result = auditClaudeMd(testDir);
    const verWarnings = result.activeWarnings.filter((w) =>
      w.id.startsWith("VER-")
    );
    expect(verWarnings).toHaveLength(1);
    expect(verWarnings[0].severity).toBe("warning");
    expect(verWarnings[0].message).toContain("6.3.0");
    expect(verWarnings[0].message).toContain(FRAMEWORK_VERSION);
  });

  it("warns when root CLAUDE.md exceeds 300 lines", () => {
    writeClaudeMd("CLAUDE.md", makeLines(350));

    const result = auditClaudeMd(testDir);
    const sizeWarnings = result.activeWarnings.filter((w) =>
      w.id.startsWith("SIZE-")
    );
    expect(sizeWarnings).toHaveLength(1);
    expect(sizeWarnings[0].severity).toBe("warning");
    expect(sizeWarnings[0].message).toContain("350");
    expect(sizeWarnings[0].message).toContain("300");
  });

  it("info when subdir CLAUDE.md exceeds 100 lines", () => {
    writeClaudeMd("src/CLAUDE.md", makeLines(120));

    const result = auditClaudeMd(testDir);
    const sizeWarnings = result.activeWarnings.filter((w) =>
      w.id.startsWith("SIZE-")
    );
    expect(sizeWarnings).toHaveLength(1);
    expect(sizeWarnings[0].severity).toBe("info");
    expect(sizeWarnings[0].message).toContain("120");
    expect(sizeWarnings[0].message).toContain("100");
  });

  it("info when file is older than 90 days", () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    writeClaudeMd("CLAUDE.md", `# Project\n`, oldDate);

    const result = auditClaudeMd(testDir);
    const ageWarnings = result.activeWarnings.filter((w) =>
      w.id.startsWith("AGE-")
    );
    expect(ageWarnings).toHaveLength(1);
    expect(ageWarnings[0].severity).toBe("info");
    expect(ageWarnings[0].message).toContain("100");
  });

  it("does not flag URL references", () => {
    writeClaudeMd(
      "CLAUDE.md",
      `# Project\n\nSee [docs](https://example.com/docs).`
    );

    const result = auditClaudeMd(testDir);
    const refWarnings = result.activeWarnings.filter((w) =>
      w.id.startsWith("REF-")
    );
    expect(refWarnings).toHaveLength(0);
  });

  it("suppresses warnings via baseline", () => {
    writeClaudeMd("CLAUDE.md", `# Project\n\nSee \`src/missing.ts\`.`);

    // First run: should have warning
    const result1 = auditClaudeMd(testDir);
    const refWarnings = result1.warnings.filter((w) => w.id.startsWith("REF-"));
    expect(refWarnings).toHaveLength(1);
    const warningId = refWarnings[0].id;

    // Accept the warning
    acceptWarning(testDir, warningId);

    // Second run: should be suppressed
    const result2 = auditClaudeMd(testDir);
    expect(result2.suppressed).toContain(warningId);
    expect(result2.activeWarnings).toHaveLength(0);
  });

  it("audits multiple files (root + subdirs)", () => {
    writeClaudeMd("CLAUDE.md", `# Root`);
    writeClaudeMd("src/CLAUDE.md", `# Src`);
    writeClaudeMd("docs/CLAUDE.md", `# Docs`);

    const result = auditClaudeMd(testDir);
    expect(result.files).toHaveLength(3);
    const paths = result.files.map((f) => f.path).sort();
    expect(paths).toEqual(["CLAUDE.md", "docs/CLAUDE.md", "src/CLAUDE.md"]);
  });

  it("does not flag current framework version", () => {
    writeClaudeMd(
      "CLAUDE.md",
      `# Project\n\nFramework ${FRAMEWORK_VERSION} compliant.`
    );

    const result = auditClaudeMd(testDir);
    const verWarnings = result.activeWarnings.filter((w) =>
      w.id.startsWith("VER-")
    );
    expect(verWarnings).toHaveLength(0);
  });
});
