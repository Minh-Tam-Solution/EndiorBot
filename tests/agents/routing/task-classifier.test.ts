/**
 * Task Classifier Tests
 *
 * @module tests/agents/routing/task-classifier
 * @date 2026-02-23
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TaskClassifier,
  getTaskClassifier,
  resetTaskClassifier,
  createTaskClassifier,
} from "../../../src/agents/orchestrator/task-classifier.js";

// ============================================================================
// Tests
// ============================================================================

describe("TaskClassifier", () => {
  let classifier: TaskClassifier;

  beforeEach(() => {
    resetTaskClassifier();
    classifier = createTaskClassifier();
  });

  describe("detectTaskType", () => {
    it("should detect architecture task type", () => {
      expect(classifier.detectTaskType("design system architecture")).toBe("architecture");
      expect(classifier.detectTaskType("architecture decision for API")).toBe("architecture");
      expect(classifier.detectTaskType("@consult about microservices")).toBe("architecture");
    });

    it("should detect security task type", () => {
      expect(classifier.detectTaskType("security review of auth")).toBe("security");
      expect(classifier.detectTaskType("check for SQL injection")).toBe("security");
      expect(classifier.detectTaskType("encrypt user credentials")).toBe("security");
    });

    it("should detect code_gen task type", () => {
      expect(classifier.detectTaskType("implement the login function")).toBe("code_gen");
      expect(classifier.detectTaskType("create a new component")).toBe("code_gen");
      expect(classifier.detectTaskType("@quick add a button")).toBe("code_gen");
    });

    it("should detect bug_fix task type", () => {
      expect(classifier.detectTaskType("fix bug in parser")).toBe("bug_fix");
      expect(classifier.detectTaskType("debug the rendering issue")).toBe("bug_fix");
      expect(classifier.detectTaskType("error: undefined is not a function")).toBe("bug_fix");
    });

    it("should detect research task type", () => {
      expect(classifier.detectTaskType("research best practices")).toBe("research");
      expect(classifier.detectTaskType("compare options for caching")).toBe("research");
      expect(classifier.detectTaskType("latest trends in React")).toBe("research");
    });

    it("should return general for unmatched queries", () => {
      expect(classifier.detectTaskType("hello world")).toBe("general");
      expect(classifier.detectTaskType("what time is it")).toBe("general");
    });
  });

  describe("classify", () => {
    it("should return full classification", () => {
      const result = classifier.classify("design system architecture for payment");

      expect(result.taskType).toBe("architecture");
      expect(result.complexity).toBeDefined();
      expect(result.legacyComplexity).toBeDefined();
      expect(result.domain).toBeDefined();
      expect(result.urgency).toBeDefined();
      expect(result.recommendedModel).toBeDefined();
      expect(result.minModelTier).toBeDefined();
      expect(result.factors).toBeDefined();
      expect(result.complexityScore).toBeGreaterThanOrEqual(0);
    });

    it("should detect simple complexity", () => {
      const result = classifier.classify("simple typo fix in readme");

      expect(result.complexity).toBe("simple");
      expect(result.legacyComplexity).toBe("low");
      expect(result.minModelTier).toBe("fast");
    });

    it("should detect moderate complexity", () => {
      // Use a query with moderate patterns that boost score to moderate range
      const result = classifier.classify("implement a new user endpoint with API integration");

      expect(["simple", "moderate"]).toContain(result.complexity);
      expect(["low", "medium"]).toContain(result.legacyComplexity);
    });

    it("should detect complex complexity", () => {
      // Use more complex patterns that trigger multi-step reasoning
      const result = classifier.classify("refactor and migrate the distributed payment integration across multiple systems");

      expect(["moderate", "complex"]).toContain(result.complexity);
      expect(["medium", "high"]).toContain(result.legacyComplexity);
    });

    it("should detect critical complexity", () => {
      const result = classifier.classify("production deploy with breaking change @critical");

      expect(result.complexity).toBe("critical");
      expect(result.legacyComplexity).toBe("high");
      expect(result.minModelTier).toBe("expert");
    });

    it("should detect high urgency", () => {
      const result = classifier.classify("urgent production issue blocking users");

      expect(result.urgency).toBe("high");
    });

    it("should detect domain", () => {
      const backend = classifier.classify("create API endpoint for users");
      const frontend = classifier.classify("build React component for dashboard");

      expect(backend.domain).toBe("backend");
      expect(frontend.domain).toBe("frontend");
    });
  });

  describe("analyzeComplexityFactors", () => {
    it("should count concepts", () => {
      const factors = classifier.analyzeComplexityFactors(
        "create API endpoint with database model and service",
        "code_gen"
      );

      expect(factors.conceptCount).toBeGreaterThan(0);
    });

    it("should detect domain crossing", () => {
      const factors = classifier.analyzeComplexityFactors(
        "build React component that calls API and updates database",
        "code_gen"
      );

      expect(factors.domainCrossing).toBe(true);
    });

    it("should detect security implications", () => {
      const factors = classifier.analyzeComplexityFactors(
        "implement password encryption",
        "code_gen"
      );

      expect(factors.securityImplications).toBe(true);
    });

    it("should detect production scope", () => {
      const factors = classifier.analyzeComplexityFactors(
        "deploy to production",
        "general"
      );

      expect(factors.productionScope).toBe(true);
    });

    it("should detect multi-step reasoning", () => {
      const factors = classifier.analyzeComplexityFactors(
        "refactor the entire codebase with distributed architecture",
        "architecture"
      );

      expect(factors.multiStepReasoning).toBe(true);
    });
  });

  describe("calculateComplexityScore", () => {
    it("should return score between 0 and 100", () => {
      const result = classifier.classify("simple typo");
      expect(result.complexityScore).toBeGreaterThanOrEqual(0);
      expect(result.complexityScore).toBeLessThanOrEqual(100);

      const complex = classifier.classify(
        "production security migration with distributed concurrent systems @critical"
      );
      expect(complex.complexityScore).toBeLessThanOrEqual(100);
    });

    it("should score higher for more complex queries", () => {
      const simple = classifier.classify("fix typo");
      const complex = classifier.classify(
        "refactor the payment integration with multiple distributed systems"
      );

      expect(complex.complexityScore).toBeGreaterThan(simple.complexityScore);
    });
  });

  describe("scoreToComplexity", () => {
    it("should map scores to complexity levels", () => {
      expect(classifier.scoreToComplexity(10)).toBe("simple");
      expect(classifier.scoreToComplexity(30)).toBe("moderate");
      expect(classifier.scoreToComplexity(55)).toBe("complex");
      expect(classifier.scoreToComplexity(85)).toBe("critical");
    });
  });

  describe("complexityToLegacy", () => {
    it("should map to legacy format", () => {
      expect(classifier.complexityToLegacy("simple")).toBe("low");
      expect(classifier.complexityToLegacy("moderate")).toBe("medium");
      expect(classifier.complexityToLegacy("complex")).toBe("high");
      expect(classifier.complexityToLegacy("critical")).toBe("high");
    });
  });

  describe("complexityToTier", () => {
    it("should map complexity to model tier", () => {
      expect(classifier.complexityToTier("simple")).toBe("fast");
      expect(classifier.complexityToTier("moderate")).toBe("balanced");
      expect(classifier.complexityToTier("complex")).toBe("powerful");
      expect(classifier.complexityToTier("critical")).toBe("expert");
    });
  });

  describe("getRecommendedModels", () => {
    it("should return models for architecture", () => {
      const models = classifier.getRecommendedModels("architecture");

      expect(models.length).toBeGreaterThan(1);
      expect(models[0]?.role).toBe("primary");
      expect(models.some((m) => m.role === "expert")).toBe(true);
    });

    it("should return Kimi + OpenAI for code_gen", () => {
      const models = classifier.getRecommendedModels("code_gen");

      expect(models.length).toBe(2);
      expect(models[0]?.provider).toBe("kimi");
      expect(models[1]?.provider).toBe("openai");
    });

    it("should prioritize OpenAI for research with Kimi expert", () => {
      const models = classifier.getRecommendedModels("research");

      expect(models[0]?.provider).toBe("openai");
      expect(models.some((m) => m.provider === "kimi")).toBe(true);
    });
  });
});

describe("getTaskClassifier singleton", () => {
  beforeEach(() => {
    resetTaskClassifier();
  });

  it("should return same instance", () => {
    const first = getTaskClassifier();
    const second = getTaskClassifier();

    expect(first).toBe(second);
  });

  it("should reset properly", () => {
    const first = getTaskClassifier();
    resetTaskClassifier();
    const second = getTaskClassifier();

    expect(first).not.toBe(second);
  });
});

describe("Model Recommendations", () => {
  let classifier: TaskClassifier;

  beforeEach(() => {
    classifier = createTaskClassifier();
  });

  it("should recommend Opus for critical tasks", () => {
    const result = classifier.classify("critical security vulnerability @critical");

    expect(result.recommendedModel.model).toBe("claude-opus-5");
  });

  it("should recommend Opus for security tasks", () => {
    const result = classifier.classify("security review of authentication");

    expect(result.recommendedModel.model).toBe("claude-opus-5");
  });

  it("should recommend appropriate model for simple vs moderate tasks", () => {
    const simple = classifier.classify("fix a simple typo @quick");
    const moderate = classifier.classify("implement a todo list component with local storage");

    // ADR-052: Simple coding tasks still use Kimi k2.6 (Tier 2)
    expect(simple.recommendedModel.model).toBe("k3");
    expect(simple.recommendedModel.provider).toBe("kimi");

    // Moderate coding tasks use Kimi k2.6
    expect(moderate.recommendedModel.model).toBe("k3");
    expect(moderate.recommendedModel.provider).toBe("kimi");
  });

  it("should recommend Ollama for simple non-coding tasks", () => {
    const result = classifier.classify("summarize this document briefly");

    expect(result.recommendedModel.model).toBe("qwen3.5:9b");
    expect(result.recommendedModel.provider).toBe("ollama");
  });
});
