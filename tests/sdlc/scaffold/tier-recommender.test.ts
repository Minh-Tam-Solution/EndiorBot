/**
 * Tier Recommender Tests
 *
 * Unit tests for project tier auto-recommendation (ADR-054, Sprint 149).
 *
 * @module tests/sdlc/scaffold/tier-recommender
 * @version 1.0.0
 * @date 2026-05-20
 * @status ACTIVE - Sprint 149
 * @sdlc SDLC Framework 6.4.0
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recommendTier } from "../../../src/sdlc/scaffold/tier-recommender.js";

// ============================================================================
// Test Fixtures
// ============================================================================

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `tier-rec-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

/** Create a file with optional content. */
function createFile(relativePath: string, content = ""): void {
  const fullPath = join(testDir, relativePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content);
}

/** Create N source files. */
function createSourceFiles(count: number, ext = ".py"): void {
  for (let i = 0; i < count; i++) {
    createFile(`src/module_${i}${ext}`, `# module ${i}\n`);
  }
}

// ============================================================================
// LITE Tier Tests
// ============================================================================

describe("Tier Recommender", () => {
  describe("LITE recommendation", () => {
    it("should recommend LITE for empty project", () => {
      const result = recommendTier(testDir);
      expect(result.tier).toBe("LITE");
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it("should recommend LITE for small Python project (VatDownload pattern)", () => {
      // VatDownload: app.py, config.py, downloader.py, models.py + templates/static
      createFile("app.py", "from flask import Flask\n");
      createFile("config.py", "DB_URL = 'sqlite:///data.db'\n");
      createFile("downloader.py", "import requests\n");
      createFile("models.py", "class Invoice:\n    pass\n");
      createFile("requirements.txt", "flask\nrequests\nbeautifulsoup4\n");
      createFile("Dockerfile", "FROM python:3.11\n");

      const result = recommendTier(testDir);
      expect(result.tier).toBe("LITE");
      expect(result.signals.sourceFileCount).toBeLessThanOrEqual(10);
    });

    it("should recommend LITE for small script project", () => {
      createFile("main.ts", "console.log('hello');\n");
      createFile("package.json", JSON.stringify({
        name: "tiny-tool",
        dependencies: { "chalk": "^5.0.0" },
      }));

      const result = recommendTier(testDir);
      expect(result.tier).toBe("LITE");
    });
  });

  // ============================================================================
  // STANDARD Tier Tests
  // ============================================================================

  describe("STANDARD recommendation", () => {
    it("should recommend STANDARD for medium project with tests", () => {
      createSourceFiles(15);
      createFile("tests/test_main.py", "def test_main(): pass\n");
      createFile("tests/test_utils.py", "def test_utils(): pass\n");
      createFile("requirements.txt", Array.from({ length: 12 }, (_, i) => `pkg${i}`).join("\n"));

      const result = recommendTier(testDir);
      expect(result.tier).toBe("STANDARD");
    });

    it("should recommend STANDARD for project with CI/CD and enough files", () => {
      createSourceFiles(15);
      mkdirSync(join(testDir, ".github/workflows"), { recursive: true });
      createFile(".github/workflows/ci.yml", "name: CI\n");

      const result = recommendTier(testDir);
      expect(result.tier).toBe("STANDARD");
      expect(result.signals.hasCiCd).toBe(true);
    });

    it("should recommend STANDARD for 20+ source files with dependencies", () => {
      createSourceFiles(25);
      createFile("requirements.txt", Array.from({ length: 12 }, (_, i) => `pkg${i}`).join("\n"));

      const result = recommendTier(testDir);
      expect(result.tier).toBe("STANDARD");
      expect(result.signals.sourceFileCount).toBeGreaterThanOrEqual(20);
    });
  });

  // ============================================================================
  // PROFESSIONAL Tier Tests
  // ============================================================================

  describe("PROFESSIONAL recommendation", () => {
    it("should recommend PROFESSIONAL for large project with CI + tests + many deps", () => {
      createSourceFiles(60);
      // Add test files
      for (let i = 0; i < 15; i++) {
        createFile(`tests/test_module_${i}.py`, `def test_${i}(): pass\n`);
      }
      mkdirSync(join(testDir, ".github/workflows"), { recursive: true });
      createFile(".github/workflows/ci.yml", "name: CI\n");
      createFile("requirements.txt", Array.from({ length: 35 }, (_, i) => `pkg${i}`).join("\n"));

      const result = recommendTier(testDir);
      expect(result.tier).toBe("PROFESSIONAL");
    });
  });

  // ============================================================================
  // ENTERPRISE Tier Tests
  // ============================================================================

  describe("ENTERPRISE recommendation", () => {
    it("should recommend ENTERPRISE for monorepo with many indicators", () => {
      createSourceFiles(120);
      for (let i = 0; i < 20; i++) {
        createFile(`tests/test_module_${i}.py`, `def test_${i}(): pass\n`);
      }
      mkdirSync(join(testDir, ".github/workflows"), { recursive: true });
      createFile(".github/workflows/ci.yml", "name: CI\n");
      createFile("requirements.txt", Array.from({ length: 40 }, (_, i) => `pkg${i}`).join("\n"));
      createFile("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
      createFile("CODEOWNERS", "* @team-lead\n");
      createFile("SECURITY.md", "# Security Policy\n");
      createFile("LICENSE", "MIT\n");

      const result = recommendTier(testDir);
      expect(result.tier).toBe("ENTERPRISE");
      expect(result.signals.hasMonorepo).toBe(true);
      expect(result.signals.hasTeamFiles).toBe(true);
      expect(result.signals.hasComplianceFiles).toBe(true);
    });
  });

  // ============================================================================
  // Signal Detection Tests
  // ============================================================================

  describe("signal detection", () => {
    it("should detect Node.js dependencies from package.json", () => {
      createFile("index.ts", "export default {};\n");
      createFile("package.json", JSON.stringify({
        name: "test",
        dependencies: { a: "1", b: "2", c: "3" },
        devDependencies: { d: "1", e: "2" },
      }));

      const result = recommendTier(testDir);
      expect(result.signals.dependencyCount).toBe(5);
    });

    it("should detect Python dependencies from requirements.txt", () => {
      createFile("main.py", "print('hello')\n");
      createFile("requirements.txt", "flask\nrequests\n# comment\nbeautifulsoup4\n");

      const result = recommendTier(testDir);
      expect(result.signals.dependencyCount).toBe(3);
    });

    it("should detect CI/CD from GitHub Actions", () => {
      mkdirSync(join(testDir, ".github/workflows"), { recursive: true });
      createFile(".github/workflows/ci.yml", "name: CI\n");

      const result = recommendTier(testDir);
      expect(result.signals.hasCiCd).toBe(true);
    });

    it("should detect monorepo from pnpm-workspace.yaml", () => {
      createFile("pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");

      const result = recommendTier(testDir);
      expect(result.signals.hasMonorepo).toBe(true);
    });

    it("should detect monorepo from package.json workspaces", () => {
      createFile("package.json", JSON.stringify({
        name: "monorepo",
        workspaces: ["packages/*"],
      }));

      const result = recommendTier(testDir);
      expect(result.signals.hasMonorepo).toBe(true);
    });

    it("should detect team files", () => {
      createFile("CONTRIBUTING.md", "# Contributing\n");

      const result = recommendTier(testDir);
      expect(result.signals.hasTeamFiles).toBe(true);
    });

    it("should require 2+ compliance files", () => {
      // Just LICENSE alone should NOT trigger
      createFile("LICENSE", "MIT\n");
      let result = recommendTier(testDir);
      expect(result.signals.hasComplianceFiles).toBe(false);

      // LICENSE + SECURITY.md should trigger
      createFile("SECURITY.md", "# Security\n");
      result = recommendTier(testDir);
      expect(result.signals.hasComplianceFiles).toBe(true);
    });

    it("should count test files from test directories", () => {
      createFile("src/main.py", "print('hello')\n");
      createFile("tests/test_main.py", "def test_main(): pass\n");
      createFile("tests/test_utils.py", "def test_utils(): pass\n");

      const result = recommendTier(testDir);
      expect(result.signals.testFileCount).toBe(2);
    });
  });

  // ============================================================================
  // Result Structure Tests
  // ============================================================================

  describe("result structure", () => {
    it("should return all required fields", () => {
      const result = recommendTier(testDir);

      expect(result).toHaveProperty("tier");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("reason");
      expect(result).toHaveProperty("signals");
      expect(["LITE", "STANDARD", "PROFESSIONAL", "ENTERPRISE"]).toContain(result.tier);
      expect(typeof result.score).toBe("number");
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it("should include tier name in reason string", () => {
      const result = recommendTier(testDir);
      expect(result.reason).toContain(result.tier);
    });
  });
});
