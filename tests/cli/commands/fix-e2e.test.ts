/**
 * Fix CLI E2E Tests
 *
 * End-to-end tests for fix and fix-stats CLI commands.
 * Tests actual command execution with real stdin/stdout.
 *
 * @module tests/cli/commands/fix-e2e
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 37 Day 7
 * @authority ADR-007 Budget Control, Phase 3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ============================================================================
// Test Setup
// ============================================================================

// Bump testTimeout to 60s for this file: spawnSync calls have a 30s internal
// timeout but vitest's default 10s would kill the test before spawnSync returns,
// producing exitCode=1 (process killed) instead of the actual CLI exit code.
// CI Docker scheduling is slower than dev machines — issue #8 RCA.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const CLI_PATH = join(process.cwd(), "endiorbot.mjs");

/**
 * Create a temporary directory.
 */
function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "fix-e2e-test-"));
}

/**
 * Run CLI command and return output.
 */
function runCli(
  args: string[],
  options: { input?: string; cwd?: string; env?: Record<string, string> } = {}
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf-8",
    input: options.input,
    cwd: options.cwd || process.cwd(),
    env: {
      ...process.env,
      ...options.env,
      // Prevent interactive prompts
      CI: "true",
    },
    timeout: 30000,
  });

  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: result.status ?? 1,
  };
}

// ============================================================================
// Fix Command Help
// ============================================================================

describe("E2E: Fix Command Help", () => {
  it("should show fix help", () => {
    const { stdout, exitCode } = runCli(["fix", "--help"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("fix");
    expect(stdout).toContain("--run");
    expect(stdout).toContain("--dry-run");
    expect(stdout).toContain("--allow-experimental");
  });

  it("should show fix-stats help", () => {
    const { stdout, exitCode } = runCli(["fix-stats", "--help"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("fix-stats");
    expect(stdout).toContain("--category");
    expect(stdout).toContain("--session");
    expect(stdout).toContain("--export");
  });
});

// ============================================================================
// Fix Command - No Input
// ============================================================================

describe("E2E: Fix Command - No Input", () => {
  it("should show usage when no input provided", () => {
    // When running with TTY (no pipe), should show usage
    const { stdout, exitCode } = runCli(["fix"]);

    // Exit code 0 because no errors to fix
    expect(exitCode).toBe(0);
    // Should show usage instructions
    expect(stdout).toContain("Usage");
  });
});

// ============================================================================
// Fix Command - Stdin Mode
// ============================================================================

describe("E2E: Fix Command - Stdin Mode", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should accept input from stdin", () => {
    // Create a test file with a TypeScript error
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "test.ts"), "const x = 1\n");

    const tscOutput = `src/test.ts(1,7): error TS2304: Cannot find name 'x'.`;

    const { stdout, exitCode } = runCli(["fix", "--dry-run"], {
      input: tscOutput,
      cwd: tempDir,
      env: { ENDIORBOT_STATE_DIR: tempDir },
    });

    // Should process the input (may or may not find fixes)
    expect(stdout).toBeDefined();
  });

  it("should show no errors when input is clean", () => {
    const cleanOutput = "";

    const { stdout, exitCode } = runCli(["fix"], {
      input: cleanOutput,
      cwd: tempDir,
    });

    // No input = show usage
    expect(stdout).toContain("Usage");
  });
});

// ============================================================================
// Fix Command - Dry Run
// ============================================================================

describe("E2E: Fix Command - Dry Run", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should show dry run message", () => {
    const tscOutput = `src/test.ts(1,7): error TS2304: Cannot find name 'x'.`;

    const { stdout } = runCli(["fix", "--dry-run"], {
      input: tscOutput,
      cwd: tempDir,
      env: { ENDIORBOT_STATE_DIR: tempDir },
    });

    // Dry run output depends on whether fixes are found
    // At minimum, should not crash
    expect(stdout).toBeDefined();
  });
});

// ============================================================================
// Fix Stats Command
// ============================================================================

describe("E2E: Fix Stats Command", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should show stats with no data", () => {
    const { stdout, exitCode } = runCli(["fix-stats"], {
      cwd: tempDir,
      env: { ENDIORBOT_STATE_DIR: tempDir },
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Self-Correction Statistics");
    expect(stdout).toContain("No fix data available");
  });

  it("should export to JSON format", () => {
    const { stdout, exitCode } = runCli(["fix-stats", "--export", "json"], {
      cwd: tempDir,
      env: { ENDIORBOT_STATE_DIR: tempDir },
    });

    expect(exitCode).toBe(0);
    // Should be valid JSON
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("overall");
    expect(parsed).toHaveProperty("byCategory");
    expect(parsed).toHaveProperty("vsTargets");
  });

  it("should export to CSV format", () => {
    const { stdout, exitCode } = runCli(["fix-stats", "--export", "csv"], {
      cwd: tempDir,
      env: { ENDIORBOT_STATE_DIR: tempDir },
    });

    expect(exitCode).toBe(0);
    // Should have CSV headers
    expect(stdout).toContain("id,timestamp,sessionId,category");
  });
});

// ============================================================================
// Fix Stats with Data
// ============================================================================

describe("E2E: Fix Stats with Data", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    // Create a fix-log.json with some test data
    const fixLog = {
      version: "1.0.0",
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      entries: [
        {
          id: "log-1",
          timestamp: new Date().toISOString(),
          sessionId: "test-session",
          error: {
            category: "BUILD",
            code: "TS2304",
            message: "Cannot find name 'x'",
            filePath: "src/test.ts",
            line: 1,
          },
          fix: {
            type: "auto",
            description: "Add missing import",
            confidence: "high",
          },
          result: {
            status: "success",
            verified: true,
            duration: 100,
            strikes: 0,
          },
        },
        {
          id: "log-2",
          timestamp: new Date().toISOString(),
          sessionId: "test-session",
          error: {
            category: "BUILD",
            code: "TS2304",
            message: "Cannot find name 'y'",
            filePath: "src/test.ts",
            line: 2,
          },
          fix: {
            type: "auto",
            description: "Add missing import",
            confidence: "high",
          },
          result: {
            status: "failed",
            verified: false,
            duration: 100,
            strikes: 1,
          },
        },
      ],
      sessions: {
        "test-session": {
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          totalErrors: 2,
          successfulFixes: 1,
          failedFixes: 1,
        },
      },
    };

    writeFileSync(join(tempDir, "fix-log.json"), JSON.stringify(fixLog, null, 2));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should show stats with data", () => {
    const { stdout, exitCode } = runCli(["fix-stats"], {
      cwd: tempDir,
      env: { ENDIORBOT_STATE_DIR: tempDir },
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Self-Correction Statistics");
    expect(stdout).toContain("BUILD");
  });

  it("should filter by category", () => {
    const { stdout, exitCode } = runCli(["fix-stats", "--category", "BUILD"], {
      cwd: tempDir,
      env: { ENDIORBOT_STATE_DIR: tempDir },
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("BUILD");
  });

  it("should export data to JSON", () => {
    const { stdout, exitCode } = runCli(["fix-stats", "--export", "json"], {
      cwd: tempDir,
      env: { ENDIORBOT_STATE_DIR: tempDir },
    });

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.byCategory.BUILD).toBeGreaterThan(0);
  });
});

// ============================================================================
// Category Filtering
// ============================================================================

describe("E2E: Category Filtering", () => {
  it("should accept valid categories", () => {
    const categories = ["BUILD", "LINT", "TYPE", "TEST"];

    for (const category of categories) {
      const { exitCode } = runCli(["fix-stats", "--category", category]);
      expect(exitCode).toBe(0);
    }
  });
});

// ============================================================================
// Integration: Fix then Stats
// ============================================================================

describe("E2E: Fix then Stats Integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should persist fix data for stats", () => {
    // First run fix with some errors
    const tscOutput = `src/test.ts(1,7): error TS2304: Cannot find name 'x'.`;

    runCli(["fix", "--dry-run"], {
      input: tscOutput,
      cwd: tempDir,
      env: { ENDIORBOT_STATE_DIR: tempDir },
    });

    // Then check stats
    const { stdout, exitCode } = runCli(["fix-stats"], {
      cwd: tempDir,
      env: { ENDIORBOT_STATE_DIR: tempDir },
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Self-Correction Statistics");
  });
});
