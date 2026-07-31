/**
 * Budget Tracker Tests
 *
 * Tests for budget tracking, limit enforcement, and cost estimation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  BudgetTracker,
  createBudgetTracker,
  getBudgetStatus,
  estimateCost,
  DEFAULT_BUDGET_CONFIG,
  type BudgetConfig,
  type TokenUsageRecord,
  type TaskContext,
  type BudgetEvent,
} from "../../src/budget/index.js";

// ============================================================================
// Test Helpers
// ============================================================================

function createUsageRecord(
  overrides?: Partial<TokenUsageRecord>,
): TokenUsageRecord {
  return {
    timestamp: new Date(),
    model: "claude-sonnet-5",
    provider: "anthropic",
    inputTokens: 1000,
    outputTokens: 500,
    cost: 0,
    ...overrides,
  };
}

function createTaskContext(overrides?: Partial<TaskContext>): TaskContext {
  return {
    prompt: "Write a function to calculate fibonacci numbers",
    ...overrides,
  };
}

// ============================================================================
// BudgetTracker Constructor Tests
// ============================================================================

describe("BudgetTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-22T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should create with default config", () => {
      const tracker = new BudgetTracker();
      const state = tracker.getState();

      expect(state.session.limit).toBe(2.0);
      expect(state.daily.limit).toBe(10.0);
      expect(state.session.costSoFar).toBe(0);
      expect(state.daily.costSoFar).toBe(0);
    });

    it("should create with custom config", () => {
      const tracker = new BudgetTracker({
        ...DEFAULT_BUDGET_CONFIG,
        per_session_limit: 5.0,
        daily_limit: 20.0,
      });

      const state = tracker.getState();

      expect(state.session.limit).toBe(5.0);
      expect(state.daily.limit).toBe(20.0);
    });
  });

  // ==========================================================================
  // Session Budget Tests
  // ==========================================================================

  describe("Session Budget", () => {
    it("should track session spending", async () => {
      const tracker = createBudgetTracker();

      await tracker.recordUsage(createUsageRecord({ cost: 0.5 }));

      const state = tracker.getState();
      expect(state.session.costSoFar).toBe(0.5);
    });

    it("should accumulate session costs", async () => {
      const tracker = createBudgetTracker();

      await tracker.recordUsage(createUsageRecord({ cost: 0.3 }));
      await tracker.recordUsage(createUsageRecord({ cost: 0.4 }));
      await tracker.recordUsage(createUsageRecord({ cost: 0.2 }));

      const state = tracker.getState();
      expect(state.session.costSoFar).toBeCloseTo(0.9, 2);
    });

    it("should enforce session limit ($2.00)", async () => {
      const tracker = createBudgetTracker({ per_session_limit: 2.0 });

      const result = await tracker.recordUsage(createUsageRecord({ cost: 2.0 }));

      expect(result.action).toBe("pause");
      expect(result.reason).toContain("session_limit_reached");
    });

    it("should pause at session limit", async () => {
      const tracker = createBudgetTracker({ per_session_limit: 1.0 });

      await tracker.recordUsage(createUsageRecord({ cost: 0.8 }));
      const result = await tracker.recordUsage(createUsageRecord({ cost: 0.3 }));

      expect(result.action).toBe("pause");
    });

    it("should not pause below session limit", async () => {
      const tracker = createBudgetTracker({ per_session_limit: 2.0 });

      const result = await tracker.recordUsage(createUsageRecord({ cost: 1.5 }));

      expect(result.action).toBe("continue");
    });
  });

  // ==========================================================================
  // Daily Budget Tests
  // ==========================================================================

  describe("Daily Budget", () => {
    it("should track daily spending", async () => {
      const tracker = createBudgetTracker();

      await tracker.recordUsage(createUsageRecord({ cost: 1.5 }));

      const state = tracker.getState();
      expect(state.daily.costSoFar).toBe(1.5);
    });

    it("should enforce daily limit ($10.00)", async () => {
      // Set session limit higher so we hit daily limit first
      const tracker = createBudgetTracker({
        daily_limit: 10.0,
        per_session_limit: 20.0,
      });

      const result = await tracker.recordUsage(
        createUsageRecord({ cost: 10.0 }),
      );

      expect(result.action).toBe("pause");
      expect(result.reason).toContain("daily_limit_reached");
    });

    it("should reset daily budget at midnight", async () => {
      const tracker = createBudgetTracker();

      // Spend some money today
      await tracker.recordUsage(createUsageRecord({ cost: 5.0 }));
      expect(tracker.getState().daily.costSoFar).toBe(5.0);

      // Advance to next day
      vi.setSystemTime(new Date("2026-02-23T10:00:00Z"));

      // Record new usage (should trigger reset)
      await tracker.recordUsage(createUsageRecord({ cost: 1.0 }));

      const state = tracker.getState();
      expect(state.daily.costSoFar).toBe(1.0); // Reset, then added 1.0
      expect(state.daily.date).toBe("2026-02-23");
    });

    it("should accumulate across sessions", async () => {
      const tracker1 = createBudgetTracker();
      await tracker1.recordUsage(createUsageRecord({ cost: 3.0 }));

      // Save state
      const savedState = tracker1.getState();

      // Create new tracker with saved state
      const tracker2 = createBudgetTracker();
      await tracker2.restoreState(savedState);

      // Continue spending
      await tracker2.recordUsage(createUsageRecord({ cost: 2.0 }));

      expect(tracker2.getState().daily.costSoFar).toBe(5.0);
    });
  });

  // ==========================================================================
  // Cost Estimation Tests
  // ==========================================================================

  describe("Cost Estimation", () => {
    it("should estimate cost for task context", async () => {
      const tracker = createBudgetTracker();

      const estimate = await tracker.estimateCost(
        createTaskContext({ prompt: "Short prompt" }),
        "claude-sonnet-5",
      );

      expect(estimate.estimated_cost).toBeGreaterThan(0);
      expect(estimate.estimated_tokens.input).toBeGreaterThan(0);
      expect(estimate.estimated_tokens.output).toBeGreaterThan(0);
    });

    it("should use model pricing for estimation", async () => {
      const tracker = createBudgetTracker();

      const opusEstimate = await tracker.estimateCost(
        createTaskContext(),
        "claude-opus-5",
      );
      const haikuEstimate = await tracker.estimateCost(
        createTaskContext(),
        "claude-haiku-4-5-20251001",
      );

      // Opus should be more expensive than Haiku
      expect(opusEstimate.estimated_cost).toBeGreaterThan(
        haikuEstimate.estimated_cost,
      );
    });

    it("should estimate higher for complex tasks", async () => {
      const tracker = createBudgetTracker();

      const simpleContext = createTaskContext({
        taskType: "documentation",
        prompt: "Write docs",
      });
      const complexContext = createTaskContext({
        taskType: "architecture",
        prompt: "Design system",
      });

      const simpleEstimate = await tracker.estimateCost(simpleContext);
      const complexEstimate = await tracker.estimateCost(complexContext);

      expect(complexEstimate.estimated_tokens.output).toBeGreaterThan(
        simpleEstimate.estimated_tokens.output,
      );
    });

    it("should provide confidence level", async () => {
      const tracker = createBudgetTracker();

      const estimate = await tracker.estimateCost(createTaskContext());

      expect(["low", "medium", "high"]).toContain(estimate.confidence);
      expect(estimate.confidence_score).toBeGreaterThanOrEqual(0);
      expect(estimate.confidence_score).toBeLessThanOrEqual(1);
    });

    it("should include cost breakdown", async () => {
      const tracker = createBudgetTracker();

      const estimate = await tracker.estimateCost(createTaskContext());

      expect(estimate.breakdown).toBeDefined();
      expect(estimate.breakdown!.model_cost).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Circuit Breaker Integration Tests
  // ==========================================================================

  describe("Circuit Breaker Integration", () => {
    it("should trip session circuit breaker at limit", async () => {
      const tracker = createBudgetTracker({ per_session_limit: 1.0 });

      await tracker.recordUsage(createUsageRecord({ cost: 1.0 }));

      const breaker = tracker.getSessionCircuitBreaker();
      expect(breaker.getStatus()).toBe("open");
    });

    it("should trip daily circuit breaker at limit", async () => {
      const tracker = createBudgetTracker({ daily_limit: 1.0 });

      await tracker.recordUsage(createUsageRecord({ cost: 1.0 }));

      const breaker = tracker.getDailyCircuitBreaker();
      expect(breaker.getStatus()).toBe("open");
    });

    it("should evaluate task circuit breaker", () => {
      const tracker = createBudgetTracker();

      tracker.startTask("task-1");
      tracker.recordTaskRetry("task-1");
      tracker.recordTaskRetry("task-1");
      tracker.recordTaskRetry("task-1");

      const result = tracker.evaluateTask("task-1");

      expect(result.tripped).toBe(true);
      expect(result.reason).toBe("max_retry_exceeded");
    });
  });

  // ==========================================================================
  // canProceed Tests
  // ==========================================================================

  describe("canProceed", () => {
    it("should return true when within budget", async () => {
      const tracker = createBudgetTracker();

      expect(await tracker.canProceed(0.1)).toBe(true);
    });

    it("should return false when would exceed session limit", async () => {
      const tracker = createBudgetTracker({ per_session_limit: 1.0 });

      await tracker.recordUsage(createUsageRecord({ cost: 0.9 }));

      expect(await tracker.canProceed(0.2)).toBe(false);
    });

    it("should return false when would exceed daily limit", async () => {
      const tracker = createBudgetTracker({ daily_limit: 1.0 });

      await tracker.recordUsage(createUsageRecord({ cost: 0.9 }));

      expect(await tracker.canProceed(0.2)).toBe(false);
    });

    it("should return false when circuit breaker is open", async () => {
      const tracker = createBudgetTracker({ per_session_limit: 1.0 });

      await tracker.recordUsage(createUsageRecord({ cost: 1.0 }));

      expect(await tracker.canProceed(0)).toBe(false);
    });
  });

  // ==========================================================================
  // Budget Status Tests
  // ==========================================================================

  describe("getStatus", () => {
    it("should return complete budget status", async () => {
      const tracker = createBudgetTracker();
      await tracker.recordUsage(createUsageRecord({ cost: 0.5 }));

      const status = await tracker.getStatus();

      expect(status.session.used).toBe(0.5);
      expect(status.session.limit).toBe(2.0);
      expect(status.session.remaining).toBeCloseTo(1.5, 2);
      expect(status.session.percentage).toBe(25);
      expect(status.canProceed).toBe(true);
    });

    it("should include warnings at threshold", async () => {
      const tracker = createBudgetTracker({ per_session_limit: 1.0 });
      await tracker.recordUsage(createUsageRecord({ cost: 0.5 }));

      const status = await tracker.getStatus();

      expect(status.warnings.length).toBeGreaterThan(0);
      expect(status.warnings[0]).toContain("50%");
    });

    it("should set canProceed to false at limit", async () => {
      const tracker = createBudgetTracker({ per_session_limit: 1.0 });
      await tracker.recordUsage(createUsageRecord({ cost: 1.0 }));

      const status = await tracker.getStatus();

      expect(status.canProceed).toBe(false);
      expect(status.session.thresholdLevel).toBe("limit");
    });
  });

  // ==========================================================================
  // State Management Tests
  // ==========================================================================

  describe("State Management", () => {
    it("should save budget state", async () => {
      const tracker = createBudgetTracker();
      await tracker.recordUsage(createUsageRecord({ cost: 1.5 }));

      const state = tracker.getState();

      expect(state.session.costSoFar).toBe(1.5);
      expect(state.daily.costSoFar).toBe(1.5);
      expect(state.tokenUsage.length).toBe(1);
    });

    it("should restore budget state", async () => {
      const tracker1 = createBudgetTracker();
      await tracker1.recordUsage(createUsageRecord({ cost: 1.5 }));
      const savedState = tracker1.getState();

      const tracker2 = createBudgetTracker();
      await tracker2.restoreState(savedState);

      expect(tracker2.getState().session.costSoFar).toBe(1.5);
      expect(tracker2.getState().daily.costSoFar).toBe(1.5);
    });

    it("should continue tracking after restore", async () => {
      const tracker1 = createBudgetTracker();
      await tracker1.recordUsage(createUsageRecord({ cost: 1.0 }));
      const savedState = tracker1.getState();

      const tracker2 = createBudgetTracker();
      await tracker2.restoreState(savedState);
      await tracker2.recordUsage(createUsageRecord({ cost: 0.5 }));

      expect(tracker2.getState().session.costSoFar).toBe(1.5);
    });

    it("should reset daily on restore if new day", async () => {
      vi.setSystemTime(new Date("2026-02-22T10:00:00Z"));

      const tracker1 = createBudgetTracker();
      await tracker1.recordUsage(createUsageRecord({ cost: 5.0 }));
      const savedState = tracker1.getState();

      // Advance to next day
      vi.setSystemTime(new Date("2026-02-23T10:00:00Z"));

      const tracker2 = createBudgetTracker();
      await tracker2.restoreState(savedState);

      // Session should be restored, daily should be reset
      expect(tracker2.getState().session.costSoFar).toBe(5.0);
      expect(tracker2.getState().daily.costSoFar).toBe(0);
    });
  });

  // ==========================================================================
  // Task Metrics Tests
  // ==========================================================================

  describe("Task Metrics", () => {
    it("should start task tracking", () => {
      const tracker = createBudgetTracker();

      tracker.startTask("task-1");

      const metrics = tracker.getTaskMetrics("task-1");
      expect(metrics).toBeDefined();
      expect(metrics!.retryCount).toBe(0);
      expect(metrics!.costSoFar).toBe(0);
    });

    it("should record task retries", () => {
      const tracker = createBudgetTracker();

      tracker.startTask("task-1");
      tracker.recordTaskRetry("task-1");
      tracker.recordTaskRetry("task-1");

      const metrics = tracker.getTaskMetrics("task-1");
      expect(metrics!.retryCount).toBe(2);
    });

    it("should record task cost", () => {
      const tracker = createBudgetTracker();

      tracker.startTask("task-1");
      tracker.recordTaskCost("task-1", 0.1);
      tracker.recordTaskCost("task-1", 0.05);

      const metrics = tracker.getTaskMetrics("task-1");
      expect(metrics!.costSoFar).toBeCloseTo(0.15, 2);
    });

    it("should end task tracking", () => {
      const tracker = createBudgetTracker();

      tracker.startTask("task-1");
      tracker.endTask("task-1", true);

      expect(tracker.getTaskMetrics("task-1")).toBeUndefined();
    });
  });

  // ==========================================================================
  // Limit Action Tests
  // ==========================================================================

  describe("Limit Actions", () => {
    it("should pause_and_notify by default", async () => {
      const tracker = createBudgetTracker({
        per_session_limit: 1.0,
        on_limit_reached: { action: "pause_and_notify" },
      });

      const result = await tracker.recordUsage(createUsageRecord({ cost: 1.0 }));

      expect(result.action).toBe("pause");
    });

    it("should switch_to_self_hosted when configured", async () => {
      const tracker = createBudgetTracker({
        per_session_limit: 1.0,
        on_limit_reached: {
          action: "switch_to_self_hosted",
          fallback_model: "self-hosted/qwen3-coder",
        },
      });

      const result = await tracker.recordUsage(createUsageRecord({ cost: 1.0 }));

      expect(result.action).toBe("switch_model");
      expect(result.model).toBe("self-hosted/qwen3-coder");
    });

    it("should fail_fast when configured", async () => {
      const tracker = createBudgetTracker({
        per_session_limit: 1.0,
        on_limit_reached: { action: "fail_fast" },
      });

      const result = await tracker.recordUsage(createUsageRecord({ cost: 1.0 }));

      expect(result.action).toBe("fail");
    });
  });

  // ==========================================================================
  // Fallback Model Tests
  // ==========================================================================

  describe("Fallback Model", () => {
    it("should return fallback model when configured", () => {
      const tracker = createBudgetTracker({
        on_limit_reached: {
          action: "switch_to_self_hosted",
          fallback_model: "self-hosted/qwen3-coder",
        },
      });

      expect(tracker.getFallbackModel()).toBe("self-hosted/qwen3-coder");
    });

    it("should return undefined when not configured", () => {
      const tracker = createBudgetTracker({
        on_limit_reached: { action: "pause_and_notify" },
      });

      expect(tracker.getFallbackModel()).toBeUndefined();
    });

    it("should suggest switch at 80% threshold", async () => {
      const tracker = createBudgetTracker({ per_session_limit: 1.0 });

      await tracker.recordUsage(createUsageRecord({ cost: 0.8 }));

      expect(tracker.shouldSwitchToFallback()).toBe(true);
    });
  });

  // ==========================================================================
  // Event Tests
  // ==========================================================================

  describe("Events", () => {
    it("should emit cost_recorded event", async () => {
      const tracker = createBudgetTracker();
      const events: BudgetEvent[] = [];
      tracker.onEvent((e) => events.push(e));

      await tracker.recordUsage(createUsageRecord({ cost: 0.5 }));

      expect(events.length).toBe(1);
      expect(events[0]!.type).toBe("cost_recorded");
      expect(events[0]!.data.cost).toBe(0.5);
    });

    it("should emit limit_reached event", async () => {
      const tracker = createBudgetTracker({ per_session_limit: 1.0 });
      const events: BudgetEvent[] = [];
      tracker.onEvent((e) => events.push(e));

      await tracker.recordUsage(createUsageRecord({ cost: 1.0 }));

      const limitEvent = events.find((e) => e.type === "limit_reached");
      expect(limitEvent).toBeDefined();
      expect(limitEvent!.data.budgetType).toBe("session");
    });

    it("should emit warning_triggered event", async () => {
      const tracker = createBudgetTracker({
        per_session_limit: 1.0,
        warning_threshold: 80,
      });
      const events: BudgetEvent[] = [];
      tracker.onEvent((e) => events.push(e));

      await tracker.recordUsage(createUsageRecord({ cost: 0.85 }));

      const warningEvent = events.find((e) => e.type === "warning_triggered");
      expect(warningEvent).toBeDefined();
    });

    it("should emit daily_reset event", async () => {
      const tracker = createBudgetTracker();
      const events: BudgetEvent[] = [];
      tracker.onEvent((e) => events.push(e));

      await tracker.recordUsage(createUsageRecord({ cost: 1.0 }));

      // Advance to next day
      vi.setSystemTime(new Date("2026-02-23T10:00:00Z"));

      await tracker.recordUsage(createUsageRecord({ cost: 0.5 }));

      const resetEvent = events.find((e) => e.type === "daily_reset");
      expect(resetEvent).toBeDefined();
    });

    it("should unsubscribe from events", async () => {
      const tracker = createBudgetTracker();
      const events: BudgetEvent[] = [];
      const unsubscribe = tracker.onEvent((e) => events.push(e));

      await tracker.recordUsage(createUsageRecord({ cost: 0.1 }));
      expect(events.length).toBe(1);

      unsubscribe();

      await tracker.recordUsage(createUsageRecord({ cost: 0.1 }));
      expect(events.length).toBe(1); // No new events
    });
  });

  // ==========================================================================
  // Notification Tests
  // ==========================================================================

  describe("Notifications", () => {
    it("should respect notification rate limit", () => {
      const tracker = createBudgetTracker();

      // Can notify initially
      expect(tracker.canNotify()).toBe(true);

      // Send 4 notifications
      for (let i = 0; i < 4; i++) {
        tracker.recordNotification();
      }

      // Should be blocked
      expect(tracker.canNotify()).toBe(false);
    });

    it("should share rate limiter across circuit breakers", () => {
      const tracker = createBudgetTracker();

      // Exhaust rate limit via main tracker
      for (let i = 0; i < 4; i++) {
        tracker.recordNotification();
      }

      // All circuit breakers should also be rate limited
      expect(tracker.getSessionCircuitBreaker().canNotify()).toBe(false);
    });
  });

  // ==========================================================================
  // Config Update Tests
  // ==========================================================================

  describe("Config Updates", () => {
    it("should update config", () => {
      const tracker = createBudgetTracker();

      tracker.updateConfig({ per_session_limit: 5.0 });

      expect(tracker.getConfig().per_session_limit).toBe(5.0);
      expect(tracker.getState().session.limit).toBe(5.0);
    });

    it("should update daily limit", () => {
      const tracker = createBudgetTracker();

      tracker.updateConfig({ daily_limit: 20.0 });

      expect(tracker.getConfig().daily_limit).toBe(20.0);
      expect(tracker.getState().daily.limit).toBe(20.0);
    });
  });

  // ==========================================================================
  // Pricing Tests
  // ==========================================================================

  describe("Pricing", () => {
    it("should get default pricing", () => {
      const tracker = createBudgetTracker();

      const pricing = tracker.getPricing("claude-sonnet-5");

      expect(pricing).toBeDefined();
      expect(pricing!.input_per_1k).toBeGreaterThan(0);
      expect(pricing!.output_per_1k).toBeGreaterThan(0);
    });

    it("should set custom pricing", () => {
      const tracker = createBudgetTracker();

      tracker.setPricing("custom-model", {
        provider: "custom",
        model: "custom-model",
        input_per_1k: 0.001,
        output_per_1k: 0.002,
        updatedAt: new Date(),
      });

      const pricing = tracker.getPricing("custom-model");
      expect(pricing!.input_per_1k).toBe(0.001);
    });

    it("should calculate cost with custom pricing", async () => {
      const tracker = createBudgetTracker();

      tracker.setPricing("free-model", {
        provider: "local",
        model: "free-model",
        input_per_1k: 0,
        output_per_1k: 0,
        updatedAt: new Date(),
      });

      await tracker.recordUsage(
        createUsageRecord({
          model: "free-model",
          inputTokens: 10000,
          outputTokens: 5000,
        }),
      );

      // Cost should be 0 for free model
      expect(tracker.getState().session.costSoFar).toBe(0);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("Factory Functions", () => {
  it("createBudgetTracker should create with defaults", () => {
    const tracker = createBudgetTracker();

    expect(tracker.getConfig().per_session_limit).toBe(2.0);
    expect(tracker.getConfig().daily_limit).toBe(10.0);
  });

  it("createBudgetTracker should merge config", () => {
    const tracker = createBudgetTracker({
      per_session_limit: 5.0,
    });

    expect(tracker.getConfig().per_session_limit).toBe(5.0);
    expect(tracker.getConfig().daily_limit).toBe(10.0); // Default preserved
  });

  it("getBudgetStatus should return status", async () => {
    const tracker = createBudgetTracker();
    await tracker.recordUsage(createUsageRecord({ cost: 0.5 }));

    const status = await getBudgetStatus(tracker);

    expect(status.session.used).toBe(0.5);
  });

  it("estimateCost should return estimate", async () => {
    const tracker = createBudgetTracker();

    const estimate = await estimateCost(tracker, createTaskContext());

    expect(estimate.estimated_cost).toBeGreaterThan(0);
  });
});
