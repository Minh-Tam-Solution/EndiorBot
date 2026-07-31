/**
 * Cost Estimator Tests
 *
 * Tests for cost estimation with honest confidence levels.
 * Per CTO guidance: Confidence defaults to LOW until historical data proves accuracy.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CostEstimator,
  createCostEstimator,
  quickEstimate,
  BASE_OUTPUT_ESTIMATES,
  DEFAULT_ESTIMATOR_CONFIG,
} from "../../src/budget/cost-estimator.js";
import type { TaskContext, HistoricalData, TaskType } from "../../src/budget/types.js";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestContext(overrides?: Partial<TaskContext>): TaskContext {
  return {
    prompt: "Write a function to calculate fibonacci numbers",
    ...overrides,
  };
}

function createHistoricalData(overrides?: Partial<HistoricalData>): HistoricalData {
  return {
    avgCostPerTask: {},
    avgCostPerModel: {},
    totalSpent: 0,
    ...overrides,
  };
}

// ============================================================================
// CostEstimator Tests
// ============================================================================

describe("CostEstimator", () => {
  let estimator: CostEstimator;

  beforeEach(() => {
    estimator = new CostEstimator();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create with default settings", () => {
      const estimator = new CostEstimator();

      expect(estimator.getSessionCount()).toBe(0);
      expect(estimator.getOverallConfidence()).toBe("low");
    });

    it("should create with historical data", () => {
      const historical = createHistoricalData({
        totalSpent: 5.0, // ~50 sessions at $0.10 avg
      });

      const estimator = new CostEstimator(historical);

      expect(estimator.getSessionCount()).toBeGreaterThan(0);
    });

    it("should create with custom config", () => {
      const estimator = new CostEstimator(undefined, {
        minSessionsForMedium: 5,
        minSessionsForHigh: 20,
      });

      // Custom config should be applied
      expect(estimator.getOverallConfidence()).toBe("low");
    });
  });

  // ==========================================================================
  // estimate Tests
  // ==========================================================================

  describe("estimate", () => {
    it("should return estimate with LOW confidence by default", () => {
      const context = createTestContext();

      const estimate = estimator.estimate(context);

      // Per CTO: Default to LOW confidence
      expect(estimate.confidence).toBe("low");
      expect(estimate.confidence_score).toBeLessThan(0.5);
    });

    it("should estimate cost for simple prompt", () => {
      const context = createTestContext({
        prompt: "Hello",
      });

      const estimate = estimator.estimate(context);

      expect(estimate.estimated_cost).toBeGreaterThan(0);
      expect(estimate.estimated_tokens.input).toBeGreaterThan(0);
      expect(estimate.estimated_tokens.output).toBeGreaterThan(0);
    });

    it("should estimate higher cost for complex prompt", () => {
      const simpleContext = createTestContext({ prompt: "Hello" });
      const complexContext = createTestContext({
        prompt: "A".repeat(5000),
        files: [
          { path: "file1.ts", content: "B".repeat(10000) },
          { path: "file2.ts", content: "C".repeat(10000) },
        ],
      });

      const simpleEstimate = estimator.estimate(simpleContext);
      const complexEstimate = estimator.estimate(complexContext);

      expect(complexEstimate.estimated_cost).toBeGreaterThan(
        simpleEstimate.estimated_cost,
      );
    });

    it("should use task type for output estimation", () => {
      const architectureContext = createTestContext({
        prompt: "Design system architecture",
        taskType: "architecture",
      });
      const bugFixContext = createTestContext({
        prompt: "Fix null pointer bug",
        taskType: "bug_fix",
      });

      const architectureEstimate = estimator.estimate(architectureContext);
      const bugFixEstimate = estimator.estimate(bugFixContext);

      // Architecture typically generates more output than bug fix
      expect(architectureEstimate.estimated_tokens.output).toBeGreaterThan(
        bugFixEstimate.estimated_tokens.output,
      );
    });

    it("should calculate cost for different models", () => {
      const context = createTestContext();

      const opusEstimate = estimator.estimate(context, "claude-opus-5");
      const sonnetEstimate = estimator.estimate(context, "claude-sonnet-5");
      const haikuEstimate = estimator.estimate(context, "claude-haiku-4-5-20251001");

      // Opus > Sonnet > Haiku in cost
      expect(opusEstimate.estimated_cost).toBeGreaterThan(
        sonnetEstimate.estimated_cost,
      );
      expect(sonnetEstimate.estimated_cost).toBeGreaterThan(
        haikuEstimate.estimated_cost,
      );
    });

    it("should return zero cost for self-hosted models", () => {
      const context = createTestContext();

      const estimate = estimator.estimate(context, "self-hosted/qwen3-coder");

      expect(estimate.estimated_cost).toBe(0);
    });

    it("should include cost breakdown", () => {
      const context = createTestContext();

      const estimate = estimator.estimate(context);

      expect(estimate.breakdown).toBeDefined();
      expect(estimate.breakdown?.model_cost).toBeDefined();
    });
  });

  // ==========================================================================
  // Confidence Level Tests (CTO Requirement)
  // ==========================================================================

  describe("confidence levels", () => {
    it("should default to LOW confidence with no historical data", () => {
      const context = createTestContext();

      const estimate = estimator.estimate(context);

      expect(estimate.confidence).toBe("low");
    });

    it("should remain LOW until minSessionsForMedium reached", () => {
      const historical = createHistoricalData({
        totalSpent: 0.5, // ~5 sessions
        avgCostPerTask: { general: 0.1 },
      });
      const estimator = new CostEstimator(historical);

      expect(estimator.getOverallConfidence()).toBe("low");
    });

    it("should reach MEDIUM after enough sessions", () => {
      const historical = createHistoricalData({
        totalSpent: 1.5, // ~15 sessions (> 10 minSessionsForMedium)
        avgCostPerTask: { general: 0.1 },
      });
      const estimator = new CostEstimator(historical);

      expect(estimator.getOverallConfidence()).toBe("medium");
    });

    it("should reach HIGH after many sessions", () => {
      const historical = createHistoricalData({
        totalSpent: 6.0, // ~60 sessions (> 50 minSessionsForHigh)
        avgCostPerTask: { general: 0.1 },
      });
      const estimator = new CostEstimator(historical);

      expect(estimator.getOverallConfidence()).toBe("high");
    });

    it("should include confidence factors in estimate", () => {
      const context = createTestContext();

      // Access internal confidence via estimate
      const estimate = estimator.estimate(context);

      expect(estimate.confidence_score).toBeGreaterThanOrEqual(0);
      expect(estimate.confidence_score).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================================================
  // estimateForModels Tests
  // ==========================================================================

  describe("estimateForModels", () => {
    it("should estimate for multiple models", () => {
      const context = createTestContext();
      const models = ["claude-opus-5", "claude-sonnet-5", "self-hosted/qwen3-coder"];

      const estimates = estimator.estimateForModels(context, models);

      expect(estimates.size).toBe(3);
      expect(estimates.has("claude-opus-5")).toBe(true);
      expect(estimates.has("self-hosted/qwen3-coder")).toBe(true);
    });
  });

  // ==========================================================================
  // findCheapestModel Tests
  // ==========================================================================

  describe("findCheapestModel", () => {
    it("should find cheapest model", () => {
      const context = createTestContext();

      const result = estimator.findCheapestModel(context);

      expect(result).toBeDefined();
      // self-hosted models and kimi-coding (flat-rate subscription) are free
      expect(result?.model).toMatch(/^(self-hosted\/|kimi-coding)$/);
      expect(result?.estimate.estimated_cost).toBe(0);
    });

    it("should find cheapest from specified models", () => {
      const context = createTestContext();
      const models = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"];

      const result = estimator.findCheapestModel(context, models);

      expect(result?.model).toBe("claude-haiku-4-5-20251001");
    });
  });

  // ==========================================================================
  // recordActualCost Tests
  // ==========================================================================

  describe("recordActualCost", () => {
    it("should update historical data", () => {
      estimator.recordActualCost("general", "claude-sonnet-5", 0.05);

      const historical = estimator.getHistoricalData();

      expect(historical.avgCostPerTask.general).toBe(0.05);
      expect(historical.avgCostPerModel["claude-sonnet-5"]).toBe(0.05);
      expect(historical.totalSpent).toBe(0.05);
    });

    it("should average costs over multiple records", () => {
      estimator.recordActualCost("general", "claude-sonnet-5", 0.10);
      estimator.recordActualCost("general", "claude-sonnet-5", 0.20);

      const historical = estimator.getHistoricalData();

      // First record: 0.10, Second record: (0.10 + 0.20) / 2 = 0.15
      expect(historical.avgCostPerTask.general).toBeCloseTo(0.15, 2);
    });

    it("should increment session count", () => {
      const initialCount = estimator.getSessionCount();

      estimator.recordActualCost("general", "claude-sonnet-5", 0.05);

      expect(estimator.getSessionCount()).toBe(initialCount + 1);
    });
  });

  // ==========================================================================
  // estimateTokens Tests
  // ==========================================================================

  describe("estimateTokens", () => {
    it("should estimate input tokens from prompt", () => {
      const context = createTestContext({ prompt: "A".repeat(400) }); // ~100 tokens

      const tokenEstimate = estimator.estimateTokens(context, "general");

      expect(tokenEstimate.input).toBeGreaterThan(90);
      expect(tokenEstimate.input).toBeLessThan(110);
    });

    it("should include file content in input tokens", () => {
      const contextNoFiles = createTestContext({ prompt: "Hello" });
      const contextWithFiles = createTestContext({
        prompt: "Hello",
        files: [{ path: "test.ts", content: "A".repeat(4000) }],
      });

      const estimateNoFiles = estimator.estimateTokens(contextNoFiles, "general");
      const estimateWithFiles = estimator.estimateTokens(
        contextWithFiles,
        "general",
      );

      expect(estimateWithFiles.input).toBeGreaterThan(estimateNoFiles.input);
    });

    it("should use base estimates for output tokens", () => {
      const context = createTestContext({ taskType: "architecture" });

      const tokenEstimate = estimator.estimateTokens(context, "architecture");

      // Should be around BASE_OUTPUT_ESTIMATES.architecture (3000)
      expect(tokenEstimate.output).toBeGreaterThan(1000);
    });

    it("should return heuristic method without historical data", () => {
      const context = createTestContext();

      const tokenEstimate = estimator.estimateTokens(context, "general");

      expect(tokenEstimate.method).toBe("heuristic");
    });
  });

  // ==========================================================================
  // Recommendation Tests
  // ==========================================================================

  describe("recommendations", () => {
    it("should recommend Self-Hosted Ollama for simple tasks", () => {
      const context = createTestContext({
        prompt: "Write documentation",
        taskType: "documentation",
      });

      const estimate = estimator.estimate(context, "claude-opus-5");

      expect(estimate.recommendation).toContain("Self-Hosted");
    });

    it("should warn about low confidence", () => {
      const context = createTestContext();

      const estimate = estimator.estimate(context);

      expect(estimate.recommendation).toContain("LOW confidence");
    });

    it("should recommend cheaper model for expensive tasks", () => {
      const context = createTestContext({
        prompt: "A".repeat(10000),
        files: [{ path: "big.ts", content: "B".repeat(50000) }],
      });

      const estimate = estimator.estimate(context, "claude-opus-5");

      expect(estimate.recommendation).toContain("Sonnet");
    });
  });

  // ==========================================================================
  // Historical Data Tests
  // ==========================================================================

  describe("historical data", () => {
    it("should improve estimates with historical data", () => {
      const historical = createHistoricalData({
        avgCostPerTask: { general: 0.05 },
        totalSpent: 5.0,
      });
      const estimatorWithHistory = new CostEstimator(historical);

      const context = createTestContext({ taskType: "general" });
      const estimate = estimatorWithHistory.estimate(context);

      expect(estimate.historical_avg).toBe(0.05);
    });

    it("should reset historical data", () => {
      estimator.recordActualCost("general", "claude-sonnet-5", 0.10);
      expect(estimator.getHistoricalData().totalSpent).toBe(0.10);

      estimator.resetHistoricalData();

      expect(estimator.getHistoricalData().totalSpent).toBe(0);
      expect(estimator.getSessionCount()).toBe(0);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("createCostEstimator", () => {
  it("should create estimator with defaults", () => {
    const estimator = createCostEstimator();

    expect(estimator).toBeInstanceOf(CostEstimator);
    expect(estimator.getOverallConfidence()).toBe("low");
  });

  it("should create estimator with historical data", () => {
    const historical = createHistoricalData({ totalSpent: 10.0 });

    const estimator = createCostEstimator(historical);

    expect(estimator.getHistoricalData().totalSpent).toBe(10.0);
  });
});

// ============================================================================
// quickEstimate Tests
// ============================================================================

describe("quickEstimate", () => {
  it("should estimate for simple prompt", () => {
    const estimate = quickEstimate("Hello world");

    expect(estimate.estimated_cost).toBeGreaterThan(0);
    expect(estimate.confidence).toBe("low");
  });

  it("should use specified task type", () => {
    const architectureEstimate = quickEstimate("Design", "architecture");
    const generalEstimate = quickEstimate("Design", "general");

    expect(architectureEstimate.estimated_tokens.output).toBeGreaterThan(
      generalEstimate.estimated_tokens.output,
    );
  });

  it("should use specified model", () => {
    const opusEstimate = quickEstimate("Hello", "general", "claude-opus-5");
    const haikuEstimate = quickEstimate("Hello", "general", "claude-haiku-4-5-20251001");

    expect(opusEstimate.estimated_cost).toBeGreaterThan(
      haikuEstimate.estimated_cost,
    );
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe("Constants", () => {
  it("should have all task types in BASE_OUTPUT_ESTIMATES", () => {
    const taskTypes: TaskType[] = [
      "code_implementation",
      "code_review",
      "test_writing",
      "bug_fix",
      "refactoring",
      "documentation",
      "architecture",
      "research",
      "general",
    ];

    for (const taskType of taskTypes) {
      expect(BASE_OUTPUT_ESTIMATES[taskType]).toBeDefined();
      expect(BASE_OUTPUT_ESTIMATES[taskType]).toBeGreaterThan(0);
    }
  });

  it("should have sensible default config", () => {
    expect(DEFAULT_ESTIMATOR_CONFIG.minSessionsForMedium).toBe(10);
    expect(DEFAULT_ESTIMATOR_CONFIG.minSessionsForHigh).toBe(50);
    expect(DEFAULT_ESTIMATOR_CONFIG.accuracyThresholdForHigh).toBe(0.8);
  });
});
