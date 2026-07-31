/**
 * Pricing Registry Tests
 *
 * Tests for file-based pricing configuration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  PricingRegistry,
  createPricingRegistry,
  getDefaultModelPricing,
  DEFAULT_PRICING_CONFIG,
  DEFAULT_PRICING_PATH,
} from "../../src/budget/pricing-registry.js";

// ============================================================================
// Test Setup
// ============================================================================

describe("PricingRegistry", () => {
  let tempDir: string;
  let tempConfigPath: string;

  beforeEach(() => {
    // Create temp directory for test configs
    tempDir = join(tmpdir(), `pricing-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    tempConfigPath = join(tempDir, "pricing.json");
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create with default config when no file exists", () => {
      const registry = new PricingRegistry(tempConfigPath);

      expect(registry.hasModel("claude-opus-5")).toBe(true);
      expect(registry.hasModel("claude-sonnet-5")).toBe(true);
    });

    it("should load from file when it exists", () => {
      // Write custom config
      const customConfig = {
        version: "2.0.0",
        updatedAt: "2026-03-01",
        source: "custom",
        models: {
          "custom-model": {
            provider: "custom",
            input_per_1k: 0.05,
            output_per_1k: 0.1,
          },
        },
      };
      writeFileSync(tempConfigPath, JSON.stringify(customConfig));

      const registry = new PricingRegistry(tempConfigPath);

      expect(registry.hasModel("custom-model")).toBe(true);
      const pricing = registry.getPricing("custom-model");
      expect(pricing?.input_per_1k).toBe(0.05);
    });

    it("should merge custom config with defaults", () => {
      // Write partial config
      const partialConfig = {
        version: "1.1.0",
        updatedAt: "2026-02-25",
        source: "partial",
        models: {
          "new-model": {
            provider: "new",
            input_per_1k: 0.01,
            output_per_1k: 0.02,
          },
        },
      };
      writeFileSync(tempConfigPath, JSON.stringify(partialConfig));

      const registry = new PricingRegistry(tempConfigPath);

      // Should have both default and custom models
      expect(registry.hasModel("claude-opus-5")).toBe(true);
      expect(registry.hasModel("new-model")).toBe(true);
    });

    it("should use defaults when file has invalid JSON", () => {
      writeFileSync(tempConfigPath, "invalid json {{{");

      const registry = new PricingRegistry(tempConfigPath);

      expect(registry.hasModel("claude-opus-5")).toBe(true);
    });
  });

  // ==========================================================================
  // getPricing Tests
  // ==========================================================================

  describe("getPricing", () => {
    it("should return pricing for known model", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const pricing = registry.getPricing("claude-opus-5");

      expect(pricing).toBeDefined();
      expect(pricing?.provider).toBe("anthropic");
      expect(pricing?.input_per_1k).toBe(0.005);
      expect(pricing?.output_per_1k).toBe(0.025);
    });

    it("should return undefined for unknown model", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const pricing = registry.getPricing("unknown-model");

      expect(pricing).toBeUndefined();
    });
  });

  // ==========================================================================
  // getPricingOrDefault Tests
  // ==========================================================================

  describe("getPricingOrDefault", () => {
    it("should return pricing for known model", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const pricing = registry.getPricingOrDefault("claude-opus-5");

      expect(pricing.input_per_1k).toBe(0.005);
    });

    it("should return fallback for unknown model", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const pricing = registry.getPricingOrDefault("unknown-model");

      // Should return sonnet pricing (default fallback)
      expect(pricing.input_per_1k).toBe(0.003);
    });

    it("should use custom fallback when specified", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const pricing = registry.getPricingOrDefault(
        "unknown-model",
        "claude-haiku-4-5-20251001",
      );

      expect(pricing.input_per_1k).toBe(0.00025);
    });
  });

  // ==========================================================================
  // listModels Tests
  // ==========================================================================

  describe("listModels", () => {
    it("should list all available models", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const models = registry.listModels();

      expect(models).toContain("claude-opus-5");
      expect(models).toContain("claude-sonnet-5");
      expect(models).toContain("gpt-4o");
      expect(models).toContain("self-hosted/qwen3-coder");
    });
  });

  // ==========================================================================
  // listModelsByProvider Tests
  // ==========================================================================

  describe("listModelsByProvider", () => {
    it("should list Anthropic models", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const models = registry.listModelsByProvider("anthropic");

      expect(models).toContain("claude-opus-5");
      expect(models).toContain("claude-sonnet-5");
      expect(models).toContain("claude-haiku-4-5-20251001");
      expect(models).not.toContain("gpt-4o");
    });

    it("should list OpenAI models", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const models = registry.listModelsByProvider("openai");

      expect(models).toContain("gpt-4-turbo");
      expect(models).toContain("gpt-4o");
      expect(models).not.toContain("claude-opus-5");
    });

    it("should list self-hosted models", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const models = registry.listModelsByProvider("self-hosted");

      expect(models).toContain("self-hosted/qwen3-coder");
      expect(models).toContain("self-hosted/deepseek-coder");
    });
  });

  // ==========================================================================
  // getFreeModels Tests
  // ==========================================================================

  describe("getFreeModels", () => {
    it("should return self-hosted models (free)", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const freeModels = registry.getFreeModels();

      expect(freeModels).toContain("self-hosted/qwen3-coder");
      expect(freeModels).toContain("self-hosted/deepseek-coder");
      expect(freeModels).not.toContain("claude-opus-5");
    });
  });

  // ==========================================================================
  // calculateCost Tests
  // ==========================================================================

  describe("calculateCost", () => {
    it("should calculate cost for Opus", () => {
      const registry = new PricingRegistry(tempConfigPath);

      // 1000 input + 1000 output tokens
      const cost = registry.calculateCost("claude-opus-5", 1000, 1000);

      // (1000/1000 * 0.005) + (1000/1000 * 0.025) = 0.005 + 0.025 = 0.03
      expect(cost).toBeCloseTo(0.03, 5);
    });

    it("should calculate cost for Sonnet", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const cost = registry.calculateCost("claude-sonnet-5", 1000, 1000);

      // (1000/1000 * 0.003) + (1000/1000 * 0.015) = 0.003 + 0.015 = 0.018
      expect(cost).toBeCloseTo(0.018, 5);
    });

    it("should return 0 for free self-hosted models", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const cost = registry.calculateCost("self-hosted/qwen3-coder", 10000, 10000);

      expect(cost).toBe(0);
    });

    it("should use fallback for unknown models", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const cost = registry.calculateCost("unknown-model", 1000, 1000);

      // Should use Sonnet pricing as fallback
      expect(cost).toBeCloseTo(0.018, 5);
    });
  });

  // ==========================================================================
  // getCheapestModel Tests
  // ==========================================================================

  describe("getCheapestModel", () => {
    it("should return cheapest overall model", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const cheapest = registry.getCheapestModel();

      // self-hosted models and kimi-coding (flat-rate subscription) are free (cheapest)
      expect(cheapest).toMatch(/^(self-hosted\/|kimi-coding)$/);
    });

    it("should return cheapest Anthropic model", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const cheapest = registry.getCheapestModel("anthropic");

      expect(cheapest).toBe("claude-haiku-4-5-20251001");
    });

    it("should return cheapest OpenAI model", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const cheapest = registry.getCheapestModel("openai");

      expect(cheapest).toBe("gpt-4o-mini");
    });
  });

  // ==========================================================================
  // getConfigInfo Tests
  // ==========================================================================

  describe("getConfigInfo", () => {
    it("should return config info", () => {
      const registry = new PricingRegistry(tempConfigPath);

      const info = registry.getConfigInfo();

      expect(info.version).toBe("1.0.0");
      expect(info.updatedAt).toBe("2026-02-22");
      expect(info.source).toBe("manual");
    });
  });

  // ==========================================================================
  // isStale Tests
  // ==========================================================================

  describe("isStale", () => {
    it("should return false for recent config", () => {
      // Create config with today's date
      const todayConfig = {
        ...DEFAULT_PRICING_CONFIG,
        updatedAt: new Date().toISOString().substring(0, 10),
      };
      writeFileSync(tempConfigPath, JSON.stringify(todayConfig));

      const registry = new PricingRegistry(tempConfigPath);

      expect(registry.isStale(30)).toBe(false);
    });

    it("should return true for old config", () => {
      // Create config with old date
      const oldConfig = {
        ...DEFAULT_PRICING_CONFIG,
        updatedAt: "2025-01-01", // Over a year old
      };
      writeFileSync(tempConfigPath, JSON.stringify(oldConfig));

      const registry = new PricingRegistry(tempConfigPath);

      expect(registry.isStale(30)).toBe(true);
    });
  });

  // ==========================================================================
  // reload Tests
  // ==========================================================================

  describe("reload", () => {
    it("should reload config from file", () => {
      const registry = new PricingRegistry(tempConfigPath);

      // Initially no custom model
      expect(registry.hasModel("new-model")).toBe(false);

      // Write new config
      const newConfig = {
        ...DEFAULT_PRICING_CONFIG,
        models: {
          ...DEFAULT_PRICING_CONFIG.models,
          "new-model": {
            provider: "new",
            input_per_1k: 0.01,
            output_per_1k: 0.02,
          },
        },
      };
      writeFileSync(tempConfigPath, JSON.stringify(newConfig));

      // Reload
      registry.reload();

      expect(registry.hasModel("new-model")).toBe(true);
    });
  });

  // ==========================================================================
  // updatePricing Tests
  // ==========================================================================

  describe("updatePricing", () => {
    it("should update pricing for a model", () => {
      const registry = new PricingRegistry(tempConfigPath);

      registry.updatePricing("claude-opus-5", {
        provider: "anthropic",
        input_per_1k: 0.02,
        output_per_1k: 0.08,
      });

      const pricing = registry.getPricing("claude-opus-5");
      expect(pricing?.input_per_1k).toBe(0.02);
      expect(pricing?.output_per_1k).toBe(0.08);
    });

    it("should add new model", () => {
      const registry = new PricingRegistry(tempConfigPath);

      registry.updatePricing("brand-new-model", {
        provider: "new",
        input_per_1k: 0.001,
        output_per_1k: 0.002,
      });

      expect(registry.hasModel("brand-new-model")).toBe(true);
    });
  });

  // ==========================================================================
  // saveConfig Tests
  // ==========================================================================

  describe("saveConfig", () => {
    it("should save config to file", () => {
      const registry = new PricingRegistry(tempConfigPath);

      registry.updatePricing("saved-model", {
        provider: "saved",
        input_per_1k: 0.01,
        output_per_1k: 0.02,
      });
      registry.saveConfig();

      // Create new registry and verify model exists
      const newRegistry = new PricingRegistry(tempConfigPath);
      expect(newRegistry.hasModel("saved-model")).toBe(true);
    });

    it("should create directory if not exists", () => {
      const deepPath = join(tempDir, "nested", "deep", "pricing.json");
      const registry = new PricingRegistry(deepPath);

      registry.saveConfig();

      expect(existsSync(deepPath)).toBe(true);
    });
  });

  // ==========================================================================
  // initializeConfig Tests
  // ==========================================================================

  describe("initializeConfig", () => {
    it("should create config file with defaults", () => {
      const registry = new PricingRegistry(tempConfigPath);

      registry.initializeConfig();

      expect(existsSync(tempConfigPath)).toBe(true);

      // Verify file contents
      const newRegistry = new PricingRegistry(tempConfigPath);
      expect(newRegistry.hasModel("claude-opus-5")).toBe(true);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("createPricingRegistry", () => {
  it("should create registry with default path", () => {
    const registry = createPricingRegistry();

    expect(registry).toBeInstanceOf(PricingRegistry);
  });

  it("should create registry with custom path", () => {
    const tempPath = join(tmpdir(), `test-pricing-${Date.now()}.json`);
    const registry = createPricingRegistry(tempPath);

    expect(registry).toBeInstanceOf(PricingRegistry);

    // Cleanup
    if (existsSync(tempPath)) {
      rmSync(tempPath);
    }
  });
});

// ============================================================================
// getDefaultModelPricing Tests
// ============================================================================

describe("getDefaultModelPricing", () => {
  it("should return pricing for known model", () => {
    const pricing = getDefaultModelPricing("claude-opus-5");

    expect(pricing).toBeDefined();
    expect(pricing?.input_per_1k).toBe(0.005);
  });

  it("should return undefined for unknown model", () => {
    const pricing = getDefaultModelPricing("unknown-model");

    expect(pricing).toBeUndefined();
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe("Constants", () => {
  it("should have correct default path", () => {
    expect(DEFAULT_PRICING_PATH).toContain(".endiorbot");
    expect(DEFAULT_PRICING_PATH).toContain("pricing.json");
  });

  it("should have all required models in default config", () => {
    const models = Object.keys(DEFAULT_PRICING_CONFIG.models);

    expect(models).toContain("claude-opus-5");
    expect(models).toContain("claude-sonnet-5");
    expect(models).toContain("claude-haiku-4-5-20251001");
    expect(models).toContain("gpt-4-turbo");
    expect(models).toContain("gpt-4o");
    expect(models).toContain("self-hosted/qwen3-coder");
  });
});
