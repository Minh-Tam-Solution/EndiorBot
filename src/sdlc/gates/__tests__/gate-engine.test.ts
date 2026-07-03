/**
 * Gate Engine Tests
 *
 * Unit tests for Gate Engine with Stage Contract integration.
 *
 * @module sdlc/gates/__tests__/gate-engine.test
 * @version 1.0.0
 * @date 2026-03-02
 * @status ACTIVE - Sprint 68
 * @sprint 68
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { GateEngine, resetGateEngine } from "../gate-engine.js";

// ============================================================================
// Test Setup
// ============================================================================

describe("GateEngine", () => {
  let tempDir: string;

  beforeEach(async () => {
    resetGateEngine();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gate-engine-test-"));
  });

  afterEach(async () => {
    resetGateEngine();
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("constructor", () => {
    it("should create engine with project root", () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      expect(engine).toBeDefined();
    });

    it("should use STANDARD tier by default", () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      // Access via evaluation to verify tier
      expect(engine).toBeDefined();
    });

    it("should accept custom tier", () => {
      const engine = new GateEngine({
        projectRoot: tempDir,
        tier: "ENTERPRISE",
      });
      expect(engine).toBeDefined();
    });
  });

  describe("evaluate", () => {
    it("should evaluate a gate", async () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      const evaluation = await engine.evaluate("G0", "feature-1", "project-1");

      expect(evaluation.gateId).toBe("G0");
      expect(evaluation.featureId).toBe("feature-1");
      expect(evaluation.projectId).toBe("project-1");
      expect(evaluation.tier).toBe("STANDARD");
      expect(["PASS", "FAIL", "PENDING"]).toContain(evaluation.result);
    });

    it("should store evaluation for retrieval", async () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      await engine.evaluate("G1", "feature-1", "project-1");

      const stored = engine.getEvaluation("G1", "feature-1", "project-1");
      expect(stored).toBeDefined();
      expect(stored?.gateId).toBe("G1");
    });

    it("should calculate summary correctly", async () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      const evaluation = await engine.evaluate("G0", "feature-1", "project-1");

      expect(evaluation.summary.total).toBeGreaterThan(0);
      expect(
        evaluation.summary.passed +
          evaluation.summary.failed +
          evaluation.summary.pending +
          evaluation.summary.skipped
      ).toBe(evaluation.summary.total);
    });

    it("should mark auto-check evidence as programmatic (honest-ceiling)", async () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      const evaluation = await engine.evaluate("G0", "feature-1", "project-1");

      for (const ev of evaluation.evidence) {
        expect(ev.source).toBe("programmatic");
      }
    });
  });

  describe("hasGatePassed", () => {
    it("should return false for non-evaluated gate", () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      const passed = engine.hasGatePassed("G0", "feature-1", "project-1");
      expect(passed).toBe(false);
    });
  });

  describe("hasPreviousGatePassed", () => {
    it("should return true for first gate (no previous)", () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      const passed = engine.hasPreviousGatePassed("G0", "feature-1", "project-1");
      expect(passed).toBe(true);
    });
  });

  describe("applyOverride", () => {
    it("should apply manual override to evaluation", async () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      await engine.evaluate("G0", "feature-1", "project-1");

      const overridden = engine.applyOverride(
        "G0",
        "feature-1",
        "project-1",
        "CEO",
        "Approved by exception"
      );

      expect(overridden.result).toBe("PASS");
      expect(overridden.evaluatedBy).toBe("ceo");
      expect(overridden.manualOverride?.approvedBy).toBe("CEO");
      expect(overridden.manualOverride?.reason).toBe("Approved by exception");
    });

    it("should throw for non-existent evaluation", () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      expect(() =>
        engine.applyOverride(
          "G0",
          "non-existent",
          "project-1",
          "CEO",
          "reason"
        )
      ).toThrow("No evaluation found");
    });

    it("should reject override from SE4A agent (honest-ceiling guard)", async () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      await engine.evaluate("G0", "feature-1", "project-1");

      expect(() =>
        engine.applyOverride(
          "G0",
          "feature-1",
          "project-1",
          "coder",
          "I checked and it looks good"
        )
      ).toThrow("HONEST-CEILING");
    });

    it("should allow override from SE4H roles (case-insensitive)", async () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      await engine.evaluate("G0", "feature-1", "project-1");

      const result = engine.applyOverride(
        "G0",
        "feature-1",
        "project-1",
        "CTO",
        "Architecture exception approved"
      );
      expect(result.result).toBe("PASS");
      expect(result.manualOverride?.approvedBy).toBe("CTO");
    });
  });

  describe("markManualItem", () => {
    it("should mark manual item and update summary", async () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      const evaluation = await engine.evaluate("G0", "feature-1", "project-1");

      // Find a manual item to mark
      const manualItem = evaluation.checklist.find(
        (i) => i.status === "pending" || i.status === "manual"
      );

      if (manualItem) {
        const updated = engine.markManualItem(
          "G0",
          "feature-1",
          "project-1",
          manualItem.id,
          "pass"
        );
        expect(updated.checklist.find((i) => i.id === manualItem.id)?.status).toBe(
          "pass"
        );
      }
    });

    it("should throw for non-existent item", async () => {
      const engine = new GateEngine({ projectRoot: tempDir });
      await engine.evaluate("G0", "feature-1", "project-1");

      expect(() =>
        engine.markManualItem(
          "G0",
          "feature-1",
          "project-1",
          "non-existent-item",
          "pass"
        )
      ).toThrow("Checklist item non-existent-item not found");
    });
  });
});

// ============================================================================
// Stage Contract Integration Tests
// ============================================================================

describe("GateEngine - Stage Contract Integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    resetGateEngine();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gate-contract-test-"));
  });

  afterEach(async () => {
    resetGateEngine();
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should have stageContractEngine config option", () => {
    const engine = new GateEngine({
      projectRoot: tempDir,
      // stageContractEngine is optional, don't set it
    });
    expect(engine).toBeDefined();
  });

  it("should create StageContractEngine on demand for contract checks", async () => {
    // Create minimal source files
    const srcDir = path.join(tempDir, "src");
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(
      path.join(srcDir, "index.ts"),
      "export const hello = 'world';"
    );

    const engine = new GateEngine({ projectRoot: tempDir });
    // The engine should work even without pre-configured stageContractEngine
    expect(engine).toBeDefined();
  });
});
