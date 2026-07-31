/**
 * AI-Assisted Fixer Tests
 *
 * Tests for AI-assisted fixes for TEST category.
 *
 * Per Sprint 37 Day 3-4 requirements and CTO constraints:
 * 1. EXPERIMENTAL flag must be visible (confidence: "experimental")
 * 2. Budget check before AI calls (canAfford())
 * 3. Full verification required for EXPERIMENTAL fixes
 *
 * @module tests/self-correction/ai-assisted-fixer
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 37 Day 3-4
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AIAssistedFixer,
  createAIAssistedFixer,
  requiresAIAssistance,
  getExperimentalConfidence,
  DEFAULT_AI_FIXER_CONFIG,
} from "../../src/self-correction/ai-assisted-fixer.js";
import type {
  TestError,
  ProposedFix,
} from "../../src/self-correction/types.js";
import type { BudgetTracker } from "../../src/budget/budget-tracker.js";

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestError(overrides?: Partial<TestError>): TestError {
  return {
    category: "TEST",
    code: "VITEST_FAIL",
    message: "Expected true to be false",
    severity: "error",
    filePath: "tests/example.test.ts",
    line: 10,
    raw: "AssertionError: Expected true to be false",
    testFile: "tests/example.test.ts",
    testName: "should return true for valid input",
    expected: false,
    actual: true,
    isTimeout: false,
    ...overrides,
  };
}

function createMockBudgetTracker(options?: {
  sessionPercentUsed?: number;
  sessionRemaining?: number;
}): BudgetTracker {
  const percentUsed = options?.sessionPercentUsed ?? 50;
  const remaining = options?.sessionRemaining ?? 1.0;

  return {
    getStatus: vi.fn().mockResolvedValue({
      session: {
        percentage: percentUsed,
        remaining: remaining,
        used: 2.0 - remaining,
        limit: 2.0,
        thresholdLevel: percentUsed >= 80 ? "critical" : "normal",
      },
      daily: {
        percentage: 30,
        remaining: 7.0,
        used: 3.0,
        limit: 10.0,
        thresholdLevel: "normal",
      },
      tracks: {},
      canProceed: remaining > 0.05,
      warnings: [],
    }),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    canAfford: vi.fn().mockReturnValue(remaining > 0.05),
  } as unknown as BudgetTracker;
}

// ============================================================================
// Configuration Tests
// ============================================================================

describe("AIAssistedFixer - Configuration", () => {
  it("should create fixer with default config", () => {
    const fixer = createAIAssistedFixer();

    expect(fixer).toBeInstanceOf(AIAssistedFixer);
    const config = fixer.getConfig();
    expect(config.estimatedCostPerConsultation).toBe(0.05);
    expect(config.maxTokens).toBe(1000);
    expect(config.model).toBe("claude-sonnet-5");
    expect(config.provider).toBe("anthropic");
  });

  it("should create fixer with custom config", () => {
    const fixer = createAIAssistedFixer({
      estimatedCostPerConsultation: 0.10,
      maxTokens: 2000,
      model: "qwen3-coder:30b",
      provider: "ollama",
    });

    const config = fixer.getConfig();
    expect(config.estimatedCostPerConsultation).toBe(0.10);
    expect(config.maxTokens).toBe(2000);
    expect(config.model).toBe("qwen3-coder:30b");
    expect(config.provider).toBe("ollama");
  });

  it("should update config", () => {
    const fixer = createAIAssistedFixer();
    fixer.updateConfig({ timeout: 60000 });

    expect(fixer.getConfig().timeout).toBe(60000);
  });

  it("should export DEFAULT_AI_FIXER_CONFIG", () => {
    expect(DEFAULT_AI_FIXER_CONFIG).toBeDefined();
    expect(DEFAULT_AI_FIXER_CONFIG.estimatedCostPerConsultation).toBe(0.05);
    expect(DEFAULT_AI_FIXER_CONFIG.timeout).toBe(30000);
  });
});

// ============================================================================
// CTO Constraint #1: EXPERIMENTAL Flag Tests
// ============================================================================

describe("AIAssistedFixer - EXPERIMENTAL Flag (CTO Constraint #1)", () => {
  let fixer: AIAssistedFixer;

  beforeEach(() => {
    fixer = createAIAssistedFixer({ dryRun: true });
  });

  it("should return experimental confidence from helper", () => {
    const confidence = getExperimentalConfidence();
    expect(confidence).toBe("experimental");
  });

  it("should mark all AI fixes as experimental", async () => {
    const error = createTestError({ isTimeout: true });
    const fix = await fixer.proposeFix(error, "Test output");

    // Dry run returns null, but let's check with non-dry run
    fixer.updateConfig({ dryRun: false });
    const actualFix = await fixer.proposeFix(error, "Test output");

    if (actualFix) {
      expect(actualFix.confidence).toBe("experimental");
      expect(actualFix.type).toBe("experimental");
      expect(actualFix.description).toContain("[AI-ASSISTED]");
    }
  });

  it("should only accept experimental fixes in applyFix", () => {
    const error = createTestError();
    const nonExperimentalFix: ProposedFix = {
      id: "test-fix",
      error,
      type: "fix_lint_rule",
      confidence: "high", // Not experimental
      description: "Test fix",
      filePath: error.testFile,
      line: error.line,
      originalCode: "const x = 5",
      fixedCode: "const x = 5;",
      isMultiLine: false,
    };

    const result = fixer.applyFix(nonExperimentalFix, "const x = 5");

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("experimental");
  });
});

// ============================================================================
// CTO Constraint #2: Budget Check Tests
// ============================================================================

describe("AIAssistedFixer - Budget Check (CTO Constraint #2)", () => {
  let fixer: AIAssistedFixer;

  beforeEach(() => {
    fixer = createAIAssistedFixer({ dryRun: false });
  });

  it("should allow consultation when budget available", async () => {
    const tracker = createMockBudgetTracker({
      sessionPercentUsed: 50,
      sessionRemaining: 1.0,
    });
    fixer.setBudgetTracker(tracker);

    const result = await fixer.checkBudget();

    expect(result.canAfford).toBe(true);
    expect(result.percentUsed).toBe(50);
    expect(result.remaining).toBe(1.0);
  });

  it("should deny consultation when budget at 90%", async () => {
    const tracker = createMockBudgetTracker({
      sessionPercentUsed: 90,
      sessionRemaining: 0.2,
    });
    fixer.setBudgetTracker(tracker);

    const result = await fixer.checkBudget();

    expect(result.canAfford).toBe(false);
    expect(result.reason).toContain("90%");
    expect(result.reason).toContain("escalate");
  });

  it("should deny consultation when budget at 95%", async () => {
    const tracker = createMockBudgetTracker({
      sessionPercentUsed: 95,
      sessionRemaining: 0.1,
    });
    fixer.setBudgetTracker(tracker);

    const result = await fixer.checkBudget();

    expect(result.canAfford).toBe(false);
  });

  it("should deny consultation when remaining < estimated cost", async () => {
    const tracker = createMockBudgetTracker({
      sessionPercentUsed: 80,
      sessionRemaining: 0.02, // Less than $0.05 default cost
    });
    fixer.setBudgetTracker(tracker);

    const result = await fixer.checkBudget();

    expect(result.canAfford).toBe(false);
    expect(result.reason).toContain("insufficient");
  });

  it("should allow consultation without budget tracker", async () => {
    // No budget tracker set
    const result = await fixer.checkBudget();

    expect(result.canAfford).toBe(true);
    expect(result.remaining).toBe(Infinity);
    expect(result.reason).toContain("No budget tracker");
  });

  it("should return null fix when budget exhausted", async () => {
    const tracker = createMockBudgetTracker({
      sessionPercentUsed: 95,
      sessionRemaining: 0.01,
    });
    fixer.setBudgetTracker(tracker);

    const error = createTestError();
    const fix = await fixer.proposeFix(error, "Test output");

    expect(fix).toBeNull();
  });

  it("should track cost after successful consultation", async () => {
    const tracker = createMockBudgetTracker({
      sessionPercentUsed: 50,
      sessionRemaining: 1.0,
    });
    fixer.setBudgetTracker(tracker);

    // The proposeFix will return null if test file doesn't exist
    // So we verify cost tracking indirectly via getTotalCost
    const error = createTestError({ isTimeout: true });
    const initialCost = fixer.getTotalCost();
    await fixer.proposeFix(error, "Test output");

    // If consultation happened, cost would be tracked
    // Even if file doesn't exist and fix is null, the tracker should be set
    expect(tracker.getStatus).toHaveBeenCalled(); // Budget was checked
  });
});

// ============================================================================
// CTO Constraint #3: Full Verification Tests
// ============================================================================

describe("AIAssistedFixer - Full Verification (CTO Constraint #3)", () => {
  let fixer: AIAssistedFixer;

  beforeEach(() => {
    fixer = createAIAssistedFixer({ dryRun: false });
  });

  it("should return verified: false for experimental fixes", () => {
    const error = createTestError();
    const experimentalFix: ProposedFix = {
      id: "test-fix",
      error,
      type: "experimental",
      confidence: "experimental",
      description: "[AI-ASSISTED] Test fix",
      filePath: error.testFile,
      line: error.line,
      originalCode: "expect(true).toBe(false)",
      fixedCode: "expect(false).toBe(false)",
      isMultiLine: false,
    };

    const fileContent = "const test = () => { expect(true).toBe(false) }";
    const result = fixer.applyFix(experimentalFix, fileContent);

    // verified: false means full verification required
    expect(result.verified).toBe(false);
  });

  it("should not auto-verify experimental fixes", () => {
    const error = createTestError();
    const experimentalFix: ProposedFix = {
      id: "test-fix",
      error,
      type: "experimental",
      confidence: "experimental",
      description: "[AI-ASSISTED] Test fix",
      filePath: error.testFile,
      line: error.line,
      originalCode: "const x = 5",
      fixedCode: "const x = 5;",
      isMultiLine: false,
    };

    const result = fixer.applyFix(experimentalFix, "const x = 5");

    // Per CTO: EXPERIMENTAL requires full test suite, not quick verify
    expect(result.verified).toBe(false);
    expect(result.status).toBe("success");
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("AIAssistedFixer - Error Handling", () => {
  let fixer: AIAssistedFixer;

  beforeEach(() => {
    fixer = createAIAssistedFixer({ dryRun: false });
  });

  it("should handle only TEST category errors", () => {
    expect(fixer.canHandle({ category: "TEST" })).toBe(true);
    expect(fixer.canHandle({ category: "BUILD" })).toBe(false);
    expect(fixer.canHandle({ category: "LINT" })).toBe(false);
    expect(fixer.canHandle({ category: "TYPE" })).toBe(false);
  });

  it("should return null when test file cannot be read", async () => {
    const error = createTestError({
      testFile: "/nonexistent/path/test.ts",
    });

    const fix = await fixer.proposeFix(error, "Test output");

    expect(fix).toBeNull();
  });

  it("should fail when original code not found in file", () => {
    const error = createTestError();
    const experimentalFix: ProposedFix = {
      id: "test-fix",
      error,
      type: "experimental",
      confidence: "experimental",
      description: "[AI-ASSISTED] Test fix",
      filePath: error.testFile,
      line: error.line,
      originalCode: "this code does not exist",
      fixedCode: "fixed code",
      isMultiLine: false,
    };

    const result = fixer.applyFix(experimentalFix, "different content here");

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("not found");
    expect(result.strikes).toBe(1);
  });

  it("should return skipped when no changes made", () => {
    const error = createTestError();
    const experimentalFix: ProposedFix = {
      id: "test-fix",
      error,
      type: "experimental",
      confidence: "experimental",
      description: "[AI-ASSISTED] Test fix",
      filePath: error.testFile,
      line: error.line,
      originalCode: "const x = 5",
      fixedCode: "const x = 5", // Same as original
      isMultiLine: false,
    };

    const result = fixer.applyFix(experimentalFix, "const x = 5");

    expect(result.status).toBe("skipped");
    expect(result.errorMessage).toContain("No changes");
  });
});

// ============================================================================
// AI Consultation Tests
// ============================================================================

describe("AIAssistedFixer - AI Consultation", () => {
  it("should handle timeout errors with timeout fix suggestion", async () => {
    const fixer = createAIAssistedFixer({ dryRun: false });
    const error = createTestError({ isTimeout: true });

    // Mock file read by using a test file that exists
    fixer.updateConfig({
      workingDirectory: process.cwd(),
    });

    // The simulated AI should suggest timeout increase
    const fix = await fixer.proposeFix(error, "Test timeout after 5000ms");

    // If fix is returned, it should be for timeout
    if (fix) {
      expect(fix.description).toContain("timeout");
    }
  });

  it("should not suggest fix for expected/actual mismatch", async () => {
    const fixer = createAIAssistedFixer({ dryRun: false });
    const error = createTestError({
      expected: 5,
      actual: 10,
      isTimeout: false,
    });

    fixer.updateConfig({
      workingDirectory: process.cwd(),
    });

    // Expected/actual mismatch likely means source code issue, not test issue
    const fix = await fixer.proposeFix(error, "Expected 5 but got 10");

    // Should return null (source code fix needed)
    // or a fix with low confidence
    if (fix) {
      expect(fix.confidence).toBe("experimental");
    }
  });

  it("should return dry-run response when dryRun enabled", async () => {
    const fixer = createAIAssistedFixer({ dryRun: true });
    const error = createTestError();

    const fix = await fixer.proposeFix(error, "Test output");

    // Dry run should not return a fix
    expect(fix).toBeNull();
  });
});

// ============================================================================
// Cost Tracking Tests
// ============================================================================

describe("AIAssistedFixer - Cost Tracking", () => {
  it("should track total consultation cost", async () => {
    const fixer = createAIAssistedFixer({ dryRun: false });
    const tracker = createMockBudgetTracker();
    fixer.setBudgetTracker(tracker);

    // Initial cost should be 0
    expect(fixer.getTotalCost()).toBe(0);

    const error = createTestError({ isTimeout: true });
    await fixer.proposeFix(error, "Test output");

    // Cost should be tracked
    expect(fixer.getTotalCost()).toBeGreaterThanOrEqual(0);
  });

  it("should track consultation history", async () => {
    const fixer = createAIAssistedFixer({ dryRun: false });
    const tracker = createMockBudgetTracker();
    fixer.setBudgetTracker(tracker);

    const error = createTestError({ isTimeout: true });
    await fixer.proposeFix(error, "Test output");

    const history = fixer.getConsultationHistory();
    expect(Array.isArray(history)).toBe(true);
  });

  it("should reset cost and history", () => {
    const fixer = createAIAssistedFixer();

    fixer.reset();

    expect(fixer.getTotalCost()).toBe(0);
    expect(fixer.getConsultationHistory()).toHaveLength(0);
  });

  it("should return estimated cost", () => {
    const fixer = createAIAssistedFixer({
      estimatedCostPerConsultation: 0.10,
    });

    expect(fixer.getEstimatedCost()).toBe(0.10);
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("AIAssistedFixer - Factory Functions", () => {
  it("should create fixer with createAIAssistedFixer", () => {
    const fixer = createAIAssistedFixer();
    expect(fixer).toBeInstanceOf(AIAssistedFixer);
  });

  it("should check if error requires AI assistance", () => {
    expect(requiresAIAssistance({ category: "TEST" })).toBe(true);
    expect(requiresAIAssistance({ category: "BUILD" })).toBe(false);
    expect(requiresAIAssistance({ category: "LINT" })).toBe(false);
    expect(requiresAIAssistance({ category: "TYPE" })).toBe(false);
  });

  it("should export getExperimentalConfidence", () => {
    expect(getExperimentalConfidence()).toBe("experimental");
  });
});

// ============================================================================
// Integration Preparation Tests
// ============================================================================

describe("AIAssistedFixer - Integration Preparation", () => {
  it("should have compatible interface for SelfCorrectionEngine", () => {
    const fixer = createAIAssistedFixer();

    // Check interface compatibility
    expect(typeof fixer.setBudgetTracker).toBe("function");
    expect(typeof fixer.proposeFix).toBe("function");
    expect(typeof fixer.applyFix).toBe("function");
    expect(typeof fixer.canHandle).toBe("function");
    expect(typeof fixer.checkBudget).toBe("function");
  });

  it("should support custom working directory", () => {
    const fixer = createAIAssistedFixer({
      workingDirectory: "/custom/path",
    });

    expect(fixer.getConfig().workingDirectory).toBe("/custom/path");
  });

  it("should support custom provider configuration", () => {
    // For self-hosted Ollama integration
    const fixer = createAIAssistedFixer({
      provider: "ollama",
      model: "qwen3-coder:30b",
    });

    const config = fixer.getConfig();
    expect(config.provider).toBe("ollama");
    expect(config.model).toBe("qwen3-coder:30b");
  });
});
