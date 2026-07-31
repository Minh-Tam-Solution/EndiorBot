/**
 * AER Calculator Tests
 *
 * Unit tests for AERCalculator.
 *
 * @module metrics/__tests__/aer-calculator.test
 * @version 1.0.0
 * @date 2026-03-02
 * @status ACTIVE - Sprint 72
 * @sprint 72
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  AERCalculator,
  createAERCalculator,
  resetAERCalculator,
  type AEREventLogEntry,
  type AERMetrics,
  createEmptyMetrics,
  calculateModelCost,
  getModelTier,
  checkAERPass,
  isAERPassing,
  DEFAULT_AER_TARGETS,
} from "../index.js";

// ============================================================================
// Test Setup
// ============================================================================

const TEST_DIR = "/tmp/endiorbot-aer-test";
const EVENTS_DIR = join(TEST_DIR, "events");
const RETRIEVAL_DIR = join(TEST_DIR, "evidence");

function setupTestDirs(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
  mkdirSync(EVENTS_DIR, { recursive: true });
  mkdirSync(RETRIEVAL_DIR, { recursive: true });
}

function cleanupTestDirs(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
}

function writeEventLog(sessionId: string, events: AEREventLogEntry[]): void {
  const content = events.map((e) => JSON.stringify(e)).join("\n");
  writeFileSync(join(EVENTS_DIR, `${sessionId}.jsonl`), content);
}

// ============================================================================
// Tests
// ============================================================================

describe("AERCalculator", () => {
  let calculator: AERCalculator;

  beforeEach(() => {
    setupTestDirs();
    resetAERCalculator();
    calculator = new AERCalculator({
      eventsDir: EVENTS_DIR,
      retrievalDir: RETRIEVAL_DIR,
      debug: false,
    });
  });

  afterEach(() => {
    cleanupTestDirs();
  });

  // ==========================================================================
  // Empty Session Tests
  // ==========================================================================

  describe("empty session", () => {
    it("should return empty metrics for non-existent session", async () => {
      const metrics = await calculator.calculate("non-existent");

      expect(metrics.totalTasks).toBe(0);
      expect(metrics.completedTasks).toBe(0);
      expect(metrics.autonomyTime).toBe(0);
      expect(metrics.taskCompletionRate).toBe(0);
    });

    it("should return empty metrics for session with no events", async () => {
      writeEventLog("empty-session", []);
      const metrics = await calculator.calculate("empty-session");

      expect(metrics).toEqual(createEmptyMetrics());
    });
  });

  // ==========================================================================
  // Task Metrics Tests
  // ==========================================================================

  describe("task metrics", () => {
    it("should count total tasks", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start", taskId: "t1" },
        { timestamp: "2026-03-02T10:01:00Z", type: "task_complete", taskId: "t1" },
        { timestamp: "2026-03-02T10:02:00Z", type: "task_start", taskId: "t2" },
        { timestamp: "2026-03-02T10:03:00Z", type: "task_complete", taskId: "t2" },
      ];
      writeEventLog("task-count", events);

      const metrics = await calculator.calculate("task-count");

      expect(metrics.totalTasks).toBe(2);
      expect(metrics.completedTasks).toBe(2);
    });

    it("should track failed tasks", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start", taskId: "t1" },
        { timestamp: "2026-03-02T10:01:00Z", type: "task_failed", taskId: "t1" },
      ];
      writeEventLog("task-failed", events);

      const metrics = await calculator.calculate("task-failed");

      expect(metrics.totalTasks).toBe(1);
      expect(metrics.failedTasks).toBe(1);
      expect(metrics.completedTasks).toBe(0);
    });

    it("should not count tasks with intervention", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start", taskId: "t1" },
        { timestamp: "2026-03-02T10:01:00Z", type: "task_complete", taskId: "t1", hadIntervention: true },
        { timestamp: "2026-03-02T10:02:00Z", type: "task_start", taskId: "t2" },
        { timestamp: "2026-03-02T10:03:00Z", type: "task_complete", taskId: "t2", hadIntervention: false },
      ];
      writeEventLog("task-intervention", events);

      const metrics = await calculator.calculate("task-intervention");

      expect(metrics.totalTasks).toBe(2);
      expect(metrics.completedTasks).toBe(1); // Only t2 (no intervention)
    });

    it("should calculate task completion rate", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start", taskId: "t1" },
        { timestamp: "2026-03-02T10:01:00Z", type: "task_complete", taskId: "t1" },
        { timestamp: "2026-03-02T10:02:00Z", type: "task_start", taskId: "t2" },
        { timestamp: "2026-03-02T10:03:00Z", type: "task_complete", taskId: "t2" },
        { timestamp: "2026-03-02T10:04:00Z", type: "task_start", taskId: "t3" },
        { timestamp: "2026-03-02T10:05:00Z", type: "task_failed", taskId: "t3" },
      ];
      writeEventLog("tcr", events);

      const metrics = await calculator.calculate("tcr");

      expect(metrics.totalTasks).toBe(3);
      expect(metrics.completedTasks).toBe(2);
      expect(metrics.taskCompletionRate).toBeCloseTo(2 / 3);
    });
  });

  // ==========================================================================
  // Recovery Metrics Tests
  // ==========================================================================

  describe("recovery metrics", () => {
    it("should count escalations", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start", taskId: "t1" },
        { timestamp: "2026-03-02T10:01:00Z", type: "escalation" },
        { timestamp: "2026-03-02T10:02:00Z", type: "escalation" },
      ];
      writeEventLog("escalations", events);

      const metrics = await calculator.calculate("escalations");

      expect(metrics.escalations).toBe(2);
    });

    it("should calculate recovery rate", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "failure", recovered: true },
        { timestamp: "2026-03-02T10:01:00Z", type: "failure", recovered: true },
        { timestamp: "2026-03-02T10:02:00Z", type: "failure", recovered: false },
        { timestamp: "2026-03-02T10:03:00Z", type: "failure", recovered: true },
      ];
      writeEventLog("recovery", events);

      const metrics = await calculator.calculate("recovery");

      expect(metrics.totalFailures).toBe(4);
      expect(metrics.recoveries).toBe(3);
      expect(metrics.recoveryRate).toBeCloseTo(0.75);
    });

    it("should handle zero failures", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start", taskId: "t1" },
        { timestamp: "2026-03-02T10:01:00Z", type: "task_complete", taskId: "t1" },
      ];
      writeEventLog("no-failures", events);

      const metrics = await calculator.calculate("no-failures");

      expect(metrics.totalFailures).toBe(0);
      expect(metrics.recoveryRate).toBe(0);
    });
  });

  // ==========================================================================
  // Autonomy Time Tests
  // ==========================================================================

  describe("autonomy time", () => {
    it("should calculate autonomy time between escalations", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start" },
        { timestamp: "2026-03-02T10:10:00Z", type: "escalation" },
        { timestamp: "2026-03-02T10:30:00Z", type: "escalation" },
        { timestamp: "2026-03-02T11:00:00Z", type: "escalation" },
      ];
      writeEventLog("autonomy", events);

      const metrics = await calculator.calculate("autonomy");

      // Intervals: 20min, 30min → average = 25min
      expect(metrics.autonomyTime).toBeCloseTo(25);
    });

    it("should return session duration when no escalations", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start" },
        { timestamp: "2026-03-02T11:00:00Z", type: "task_complete" },
      ];
      writeEventLog("no-escalation", events);

      const metrics = await calculator.calculate("no-escalation");

      expect(metrics.autonomyTime).toBe(60); // 60 minutes
    });

    it("should return session duration when only one escalation", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start" },
        { timestamp: "2026-03-02T10:30:00Z", type: "escalation" },
        { timestamp: "2026-03-02T11:00:00Z", type: "task_complete" },
      ];
      writeEventLog("one-escalation", events);

      const metrics = await calculator.calculate("one-escalation");

      expect(metrics.autonomyTime).toBe(60); // Full session duration
    });
  });

  // ==========================================================================
  // Cost Metrics Tests
  // ==========================================================================

  describe("cost metrics", () => {
    it("should calculate total cost from events", async () => {
      const events: AEREventLogEntry[] = [
        {
          timestamp: "2026-03-02T10:00:00Z",
          type: "model_call",
          model: "claude-sonnet-5",
          cost: 0.05,
        },
        {
          timestamp: "2026-03-02T10:01:00Z",
          type: "model_call",
          model: "claude-sonnet-5",
          cost: 0.03,
        },
      ];
      writeEventLog("cost", events);

      const metrics = await calculator.calculate("cost");

      expect(metrics.totalCost).toBeCloseTo(0.08);
    });

    it("should calculate cost from tokens when no cost field", async () => {
      const events: AEREventLogEntry[] = [
        {
          timestamp: "2026-03-02T10:00:00Z",
          type: "model_call",
          model: "claude-sonnet-5",
          inputTokens: 1000,
          outputTokens: 500,
        },
      ];
      writeEventLog("cost-tokens", events);

      const metrics = await calculator.calculate("cost-tokens");

      // Sonnet: (1000 * 3 + 500 * 15) / 1M = 0.0105
      expect(metrics.totalCost).toBeCloseTo(0.0105);
    });

    it("should calculate cost per task", async () => {
      const events: AEREventLogEntry[] = [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start", taskId: "t1" },
        { timestamp: "2026-03-02T10:00:30Z", type: "model_call", cost: 0.10 },
        { timestamp: "2026-03-02T10:01:00Z", type: "task_complete", taskId: "t1" },
        { timestamp: "2026-03-02T10:02:00Z", type: "task_start", taskId: "t2" },
        { timestamp: "2026-03-02T10:02:30Z", type: "model_call", cost: 0.20 },
        { timestamp: "2026-03-02T10:03:00Z", type: "task_complete", taskId: "t2" },
      ];
      writeEventLog("cost-per-task", events);

      const metrics = await calculator.calculate("cost-per-task");

      expect(metrics.totalCost).toBeCloseTo(0.30);
      expect(metrics.costPerTask).toBeCloseTo(0.15);
    });
  });

  // ==========================================================================
  // Model Usage Tests
  // ==========================================================================

  describe("model usage", () => {
    it("should track model usage by tier", async () => {
      const events: AEREventLogEntry[] = [
        {
          timestamp: "2026-03-02T10:00:00Z",
          type: "model_call",
          model: "claude-opus-5",
          inputTokens: 1000,
          outputTokens: 500,
          durationSeconds: 10,
        },
        {
          timestamp: "2026-03-02T10:01:00Z",
          type: "model_call",
          model: "claude-sonnet-5",
          inputTokens: 2000,
          outputTokens: 1000,
          durationSeconds: 5,
        },
        {
          timestamp: "2026-03-02T10:02:00Z",
          type: "model_call",
          model: "claude-haiku-4-5-20251001",
          inputTokens: 500,
          outputTokens: 200,
          durationSeconds: 2,
        },
      ];
      writeEventLog("model-usage", events);

      const metrics = await calculator.calculate("model-usage");

      expect(metrics.modelUsage.opus.calls).toBe(1);
      expect(metrics.modelUsage.opus.tokens).toBe(1500);
      expect(metrics.modelUsage.opus.timeSeconds).toBe(10);

      expect(metrics.modelUsage.sonnet.calls).toBe(1);
      expect(metrics.modelUsage.sonnet.tokens).toBe(3000);
      expect(metrics.modelUsage.sonnet.timeSeconds).toBe(5);

      expect(metrics.modelUsage.haiku.calls).toBe(1);
      expect(metrics.modelUsage.haiku.tokens).toBe(700);
      expect(metrics.modelUsage.haiku.timeSeconds).toBe(2);
    });
  });

  // ==========================================================================
  // Evaluate Tests
  // ==========================================================================

  describe("evaluate", () => {
    it("should pass when all targets met", async () => {
      const events: AEREventLogEntry[] = [
        // 3 tasks, all complete
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start", taskId: "t1" },
        { timestamp: "2026-03-02T10:05:00Z", type: "task_complete", taskId: "t1" },
        { timestamp: "2026-03-02T10:10:00Z", type: "task_start", taskId: "t2" },
        { timestamp: "2026-03-02T10:15:00Z", type: "task_complete", taskId: "t2" },
        { timestamp: "2026-03-02T10:20:00Z", type: "task_start", taskId: "t3" },
        { timestamp: "2026-03-02T10:25:00Z", type: "task_complete", taskId: "t3" },
        // 1 failure, recovered
        { timestamp: "2026-03-02T10:30:00Z", type: "failure", recovered: true },
        // Low cost
        { timestamp: "2026-03-02T10:35:00Z", type: "model_call", cost: 0.50 },
        // Tool calls
        { timestamp: "2026-03-02T10:40:00Z", type: "tool_call", tool: "read", wasCorrect: true },
        // Session end (60 minutes, no escalations = high autonomy)
        { timestamp: "2026-03-02T11:00:00Z", type: "task_complete", taskId: "end" },
      ];
      writeEventLog("pass-session", events);

      const result = await calculator.evaluate("pass-session");

      expect(result.passed).toBe(true);
      expect(result.metricStatus.taskCompletionRate).toBe(true);
      expect(result.metricStatus.recoveryRate).toBe(true);
    });

    it("should fail when targets not met", async () => {
      const events: AEREventLogEntry[] = [
        // Only 1 of 3 tasks complete
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start", taskId: "t1" },
        { timestamp: "2026-03-02T10:01:00Z", type: "task_failed", taskId: "t1" },
        { timestamp: "2026-03-02T10:02:00Z", type: "task_start", taskId: "t2" },
        { timestamp: "2026-03-02T10:03:00Z", type: "task_failed", taskId: "t2" },
        { timestamp: "2026-03-02T10:04:00Z", type: "task_start", taskId: "t3" },
        { timestamp: "2026-03-02T10:05:00Z", type: "task_complete", taskId: "t3" },
        // Many escalations
        { timestamp: "2026-03-02T10:06:00Z", type: "escalation" },
        { timestamp: "2026-03-02T10:07:00Z", type: "escalation" },
        { timestamp: "2026-03-02T10:08:00Z", type: "escalation" },
        { timestamp: "2026-03-02T10:09:00Z", type: "escalation" },
      ];
      writeEventLog("fail-session", events);

      const result = await calculator.evaluate("fail-session");

      expect(result.passed).toBe(false);
      expect(result.metricStatus.taskCompletionRate).toBe(false); // 1/3 < 0.7
      expect(result.metricStatus.autonomyTime).toBe(false); // < 30min between escalations
    });
  });

  // ==========================================================================
  // Aggregate Tests
  // ==========================================================================

  describe("calculateAggregate", () => {
    it("should aggregate metrics across sessions", async () => {
      // Session 1: 2 tasks, $0.20
      writeEventLog("session-1", [
        { timestamp: "2026-03-02T10:00:00Z", type: "task_start", taskId: "t1" },
        { timestamp: "2026-03-02T10:01:00Z", type: "task_complete", taskId: "t1" },
        { timestamp: "2026-03-02T10:02:00Z", type: "task_start", taskId: "t2" },
        { timestamp: "2026-03-02T10:03:00Z", type: "task_complete", taskId: "t2" },
        { timestamp: "2026-03-02T10:04:00Z", type: "model_call", cost: 0.20 },
      ]);

      // Session 2: 1 task, $0.10
      writeEventLog("session-2", [
        { timestamp: "2026-03-02T11:00:00Z", type: "task_start", taskId: "t3" },
        { timestamp: "2026-03-02T11:01:00Z", type: "task_complete", taskId: "t3" },
        { timestamp: "2026-03-02T11:02:00Z", type: "model_call", cost: 0.10 },
      ]);

      const aggregate = await calculator.calculateAggregate(["session-1", "session-2"]);

      expect(aggregate.totalTasks).toBe(3);
      expect(aggregate.completedTasks).toBe(3);
      expect(aggregate.totalCost).toBeCloseTo(0.30);
      expect(aggregate.taskCompletionRate).toBe(1);
      expect(aggregate.costPerTask).toBeCloseTo(0.10);
    });
  });
});

// ============================================================================
// Type Function Tests
// ============================================================================

describe("Type Functions", () => {
  describe("calculateModelCost", () => {
    it("should calculate Opus 5 cost", () => {
      // Opus 5: $5/1M input, $25/1M output
      const cost = calculateModelCost("claude-opus-5", 1_000_000, 100_000);
      expect(cost).toBeCloseTo(5 + 2.5);
    });

    it("should calculate Sonnet 5 cost", () => {
      // Sonnet 5: $3/1M input, $15/1M output
      const cost = calculateModelCost("claude-sonnet-5", 1_000_000, 100_000);
      expect(cost).toBeCloseTo(3 + 1.5);
    });

    it("should calculate Haiku cost", () => {
      // Haiku: $0.25/1M input, $1.25/1M output
      const cost = calculateModelCost("claude-haiku-4-5-20251001", 1_000_000, 100_000);
      expect(cost).toBeCloseTo(0.25 + 0.125);
    });

    it("should use conservative proxy (highest tier) for unknown models", () => {
      // CEO directive: $0/silent-Sonnet for unpriced = budget-guard blind.
      // Unknown → over-estimate at $10/$50 per 1M so the guard trips early.
      const cost = calculateModelCost("unknown-model", 1_000_000, 100_000);
      expect(cost).toBeCloseTo(10 + 5);
    });
  });

  describe("getModelTier", () => {
    it("should identify Opus tier", () => {
      expect(getModelTier("claude-opus-4")).toBe("opus");
      expect(getModelTier("claude-opus-4-5-20251101")).toBe("opus");
    });

    it("should identify Sonnet tier", () => {
      expect(getModelTier("claude-sonnet-4")).toBe("sonnet");
      expect(getModelTier("claude-sonnet-4-5-20250929")).toBe("sonnet");
    });

    it("should identify Haiku tier", () => {
      expect(getModelTier("claude-haiku-4")).toBe("haiku");
      expect(getModelTier("claude-haiku-4-5-20251001")).toBe("haiku");
    });

    it("should default to Sonnet for unknown", () => {
      expect(getModelTier("unknown-model")).toBe("sonnet");
    });
  });

  describe("checkAERPass", () => {
    it("should pass all metrics when above targets", () => {
      const metrics: AERMetrics = {
        ...createEmptyMetrics(),
        autonomyTime: 60,
        taskCompletionRate: 0.85,
        recoveryRate: 0.90,
        toolChoiceAccuracy: 0.90,
        costPerTask: 0.50,
      };

      const status = checkAERPass(metrics, DEFAULT_AER_TARGETS);

      expect(status.autonomyTime).toBe(true);
      expect(status.taskCompletionRate).toBe(true);
      expect(status.recoveryRate).toBe(true);
      expect(status.toolChoiceAccuracy).toBe(true);
      expect(status.costPerTask).toBe(true);
    });

    it("should fail metrics below targets", () => {
      const metrics: AERMetrics = {
        ...createEmptyMetrics(),
        autonomyTime: 10,
        taskCompletionRate: 0.50,
        recoveryRate: 0.60,
        toolChoiceAccuracy: 0.70,
        costPerTask: 2.00,
      };

      const status = checkAERPass(metrics, DEFAULT_AER_TARGETS);

      expect(status.autonomyTime).toBe(false);
      expect(status.taskCompletionRate).toBe(false);
      expect(status.recoveryRate).toBe(false);
      expect(status.toolChoiceAccuracy).toBe(false);
      expect(status.costPerTask).toBe(false);
    });
  });

  describe("isAERPassing", () => {
    it("should return true when all pass", () => {
      const status = {
        autonomyTime: true,
        taskCompletionRate: true,
        recoveryRate: true,
        toolChoiceAccuracy: true,
        costPerTask: true,
      };
      expect(isAERPassing(status)).toBe(true);
    });

    it("should return false when any fail", () => {
      const status = {
        autonomyTime: true,
        taskCompletionRate: false,
        recoveryRate: true,
        toolChoiceAccuracy: true,
        costPerTask: true,
      };
      expect(isAERPassing(status)).toBe(false);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("Factory Functions", () => {
  beforeEach(() => {
    resetAERCalculator();
  });

  it("should create calculator with createAERCalculator", () => {
    const calc = createAERCalculator({ debug: true });
    expect(calc).toBeInstanceOf(AERCalculator);
  });
});
