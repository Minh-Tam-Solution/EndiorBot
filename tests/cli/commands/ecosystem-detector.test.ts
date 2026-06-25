/**
 * Ecosystem Detector Tests — Sprint 123
 *
 * Covers: detectEcosystem() priority ordering, validateRepoUrl(),
 * extractRepoName(), detectPythonVenv(), detectNodePackageManager().
 * Uses temp dir fixtures — no GitHub clone in CI (PM AC4).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  detectEcosystem,
  validateRepoUrl,
  extractRepoName,
  detectPythonVenv,
  detectNodePackageManager,
  getEcosystemCommands,
} from "../../../src/cli/commands/ecosystem-detector.js";

// ============================================================================
// Helpers
// ============================================================================

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "eco-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function touch(relativePath: string, content = ""): void {
  const fullPath = join(tempDir, relativePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  if (dir !== tempDir) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

// ============================================================================
// detectEcosystem — priority ordering
// ============================================================================

describe("detectEcosystem", () => {
  it("detects Rust from Cargo.toml", () => {
    touch("Cargo.toml", "[package]\nname = \"glass\"");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("rust");
    expect(result.language).toBe("Rust");
    expect(result.packageManager).toBe("cargo");
    expect(result.support).toBe("full");
  });

  it("detects Python (poetry) from pyproject.toml", () => {
    touch("pyproject.toml", "[tool.poetry]\nname = \"myapp\"");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("python");
    expect(result.packageManager).toBe("poetry");
  });

  it("detects Python (pip) from requirements.txt", () => {
    touch("requirements.txt", "flask==2.0\n");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("python");
    expect(result.packageManager).toBe("pip");
  });

  it("detects Go from go.mod (detect-only)", () => {
    touch("go.mod", "module github.com/example/app");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("go");
    expect(result.support).toBe("detect-only");
  });

  it("detects Java/Maven from pom.xml (detect-only)", () => {
    touch("pom.xml", "<project></project>");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("java");
    expect(result.packageManager).toBe("maven");
    expect(result.support).toBe("detect-only");
  });

  it("detects Java/Gradle from build.gradle (detect-only)", () => {
    touch("build.gradle", "plugins { id 'java' }");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("java");
    expect(result.packageManager).toBe("gradle");
  });

  it("Rust takes priority over package.json (polyglot repo)", () => {
    touch("Cargo.toml", "[package]");
    touch("package.json", '{"name": "frontend"}');
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("rust");
  });

  it("Docker takes highest priority (monorepo with docker-compose.yml)", () => {
    touch("docker-compose.yml", "version: '3.8'\nservices:\n  app:\n    build: .");
    touch("backend/go.mod", "module example");
    touch("frontend/package.json", '{"name": "frontend"}');
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("docker");
    expect(result.language).toContain("Go");
    expect(result.language).toContain("JavaScript");
    expect(result.support).toBe("full");
  });

  it("Docker detects compose.yml variant", () => {
    touch("compose.yml", "services:\n  app:\n    build: .");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("docker");
  });

  it("Docker detects monorepo sub-ecosystems (Go + TypeScript)", () => {
    touch("docker-compose.yml", "services: {}");
    touch("backend/go.mod", "module example");
    touch("frontend/package.json", '{"name": "ui"}');
    touch("frontend/tsconfig.json", "{}");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("docker");
    expect(result.language).toContain("Go");
    expect(result.language).toContain("TypeScript");
  });

  it("Go takes priority over package.json (without Docker)", () => {
    touch("go.mod", "module example");
    touch("package.json", '{"name": "tools"}');
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("go");
  });

  it("TypeScript detected when tsconfig.json + package.json", () => {
    touch("tsconfig.json", "{}");
    touch("package.json", '{"name": "app"}');
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("node");
    expect(result.language).toBe("TypeScript");
  });

  it("JavaScript fallback when only package.json", () => {
    touch("package.json", '{"name": "app"}');
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("node");
    expect(result.language).toBe("JavaScript");
  });

  it("Node.js fallback for empty directory", () => {
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("node");
    expect(result.packageManager).toBe("npm");
  });

  it("--ecosystem override forces detection", () => {
    touch("package.json", '{"name": "app"}');
    const result = detectEcosystem(tempDir, "rust");
    expect(result.ecosystem).toBe("rust");
  });

  it("Docker project with root Python + sub TypeScript → language: Python + TypeScript", () => {
    touch("docker-compose.yml", "services: {}");
    touch("pyproject.toml", "[project]\nname = \"deeptutor\"");
    touch("web/package.json", '{"name": "ui"}');
    touch("web/tsconfig.json", "{}");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("docker");
    expect(result.language).toBe("Python + TypeScript");
  });

  it("Docker project with root Python + sub Python → language: Python (no duplicate)", () => {
    touch("docker-compose.yml", "services: {}");
    touch("pyproject.toml", "[project]\nname = \"deeptutor\"");
    touch("backend/pyproject.toml", "[project]\nname = \"api\"");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("docker");
    expect(result.language).toBe("Python");
  });

  it("Docker project with no sub-ecosystems → language: Multi-language", () => {
    touch("docker-compose.yml", "services: {}");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("docker");
    expect(result.language).toBe("Multi-language");
  });

  it("Non-Docker project → scanSubEcosystems not called (unchanged behavior)", () => {
    touch("pyproject.toml", "[project]\nname = \"deeptutor\"");
    touch("web/package.json", '{"name": "ui"}');
    touch("web/tsconfig.json", "{}");
    const result = detectEcosystem(tempDir);
    expect(result.ecosystem).toBe("python");
    expect(result.language).toBe("Python");
  });
});

// ============================================================================
// getEcosystemCommands
// ============================================================================

describe("getEcosystemCommands", () => {
  it("returns docker compose commands for Docker ecosystem", () => {
    touch("docker-compose.yml", "services: {}");
    const eco = detectEcosystem(tempDir);
    const cmds = getEcosystemCommands(eco, tempDir);
    expect(cmds).not.toBeNull();
    expect(cmds!.build).toEqual(["docker", "compose", "build"]);
    expect(cmds!.run).toEqual(["docker", "compose", "up"]);
    expect(cmds!.install).toBeNull();
  });

  it("returns null for detect-only ecosystems", () => {
    touch("go.mod", "module example");
    const eco = detectEcosystem(tempDir);
    const cmds = getEcosystemCommands(eco, tempDir);
    expect(cmds).toBeNull();
  });

  it("returns cargo commands for Rust", () => {
    touch("Cargo.toml", "[package]");
    const eco = detectEcosystem(tempDir);
    const cmds = getEcosystemCommands(eco, tempDir);
    expect(cmds).not.toBeNull();
    expect(cmds!.build).toEqual(["cargo", "build", "--release"]);
    expect(cmds!.run).toEqual(["cargo", "run", "--release"]);
    expect(cmds!.dev).toEqual(["cargo", "run"]);
    expect(cmds!.install).toBeNull();
  });

  it("returns pip commands for Python", () => {
    touch("requirements.txt", "flask==2.0");
    touch("app.py", "print('hello')");
    const eco = detectEcosystem(tempDir);
    const cmds = getEcosystemCommands(eco, tempDir);
    expect(cmds).not.toBeNull();
    expect(cmds!.install).toContain("requirements.txt");
    expect(cmds!.run).toContain("app.py");
  });

  it("returns npm commands for Node.js with build script", () => {
    touch("package.json", '{"name":"app","scripts":{"build":"tsc","start":"node dist"}}');
    const eco = detectEcosystem(tempDir);
    const cmds = getEcosystemCommands(eco, tempDir);
    expect(cmds).not.toBeNull();
    expect(cmds!.install).toEqual(["npm", "install"]);
    expect(cmds!.build).toEqual(["npm", "run", "build"]);
  });
});

// ============================================================================
// validateRepoUrl — CTO C2
// ============================================================================

describe("validateRepoUrl", () => {
  it("allows HTTPS URLs", () => {
    expect(validateRepoUrl("https://github.com/org/repo.git").valid).toBe(true);
  });

  it("allows SSH URLs", () => {
    expect(validateRepoUrl("git@github.com:org/repo.git").valid).toBe(true);
  });

  it("allows localhost HTTP", () => {
    expect(validateRepoUrl("http://localhost:3000/repo.git").valid).toBe(true);
  });

  it("blocks file:// protocol", () => {
    const result = validateRepoUrl("file:///etc/passwd");
    expect(result.valid).toBe(false);
  });

  it("blocks absolute paths", () => {
    const result = validateRepoUrl("/usr/local/repo");
    expect(result.valid).toBe(false);
  });

  it("blocks relative paths", () => {
    const result = validateRepoUrl("../secret-repo");
    expect(result.valid).toBe(false);
  });

  it("blocks random strings", () => {
    const result = validateRepoUrl("not-a-url");
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// extractRepoName
// ============================================================================

describe("extractRepoName", () => {
  it("extracts from HTTPS URL", () => {
    expect(extractRepoName("https://github.com/Glass-HQ/Glass.git")).toBe("Glass");
  });

  it("extracts from SSH URL", () => {
    expect(extractRepoName("git@github.com:org/my-app.git")).toBe("my-app");
  });

  it("handles URL without .git suffix", () => {
    expect(extractRepoName("https://github.com/org/repo")).toBe("repo");
  });
});

// ============================================================================
// detectNodePackageManager
// ============================================================================

describe("detectNodePackageManager", () => {
  it("detects pnpm", () => {
    touch("pnpm-lock.yaml", "");
    expect(detectNodePackageManager(tempDir)).toBe("pnpm");
  });

  it("detects yarn", () => {
    touch("yarn.lock", "");
    expect(detectNodePackageManager(tempDir)).toBe("yarn");
  });

  it("detects bun", () => {
    touch("bun.lockb", "");
    expect(detectNodePackageManager(tempDir)).toBe("bun");
  });

  it("defaults to npm", () => {
    expect(detectNodePackageManager(tempDir)).toBe("npm");
  });
});

// ============================================================================
// detectPythonVenv — CTO C4
// ============================================================================

describe("detectPythonVenv", () => {
  it("detects .venv with bin/activate", () => {
    mkdirSync(join(tempDir, ".venv", "bin"), { recursive: true });
    writeFileSync(join(tempDir, ".venv", "bin", "activate"), "");
    const result = detectPythonVenv(tempDir);
    expect(result.hasVenv).toBe(true);
    expect(result.activateCmd).toContain(".venv");
  });

  it("detects venv with bin/activate", () => {
    mkdirSync(join(tempDir, "venv", "bin"), { recursive: true });
    writeFileSync(join(tempDir, "venv", "bin", "activate"), "");
    const result = detectPythonVenv(tempDir);
    expect(result.hasVenv).toBe(true);
  });

  it("returns false for no venv", () => {
    const result = detectPythonVenv(tempDir);
    expect(result.hasVenv).toBe(false);
  });

  it("ignores .env directory (not venv — CPO note)", () => {
    mkdirSync(join(tempDir, ".env", "bin"), { recursive: true });
    writeFileSync(join(tempDir, ".env", "bin", "activate"), "");
    const result = detectPythonVenv(tempDir);
    expect(result.hasVenv).toBe(false);
  });
});
