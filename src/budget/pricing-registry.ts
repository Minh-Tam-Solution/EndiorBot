/**
 * Pricing Registry
 *
 * Manages model pricing data with file-based configuration.
 * Addresses CTO concern: Pricing staleness - loadable from .endiorbot/pricing.json
 *
 * Based on ADR-007 Autonomous Execution Budget specification.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import type { ModelPricing } from "./types.js";
import {
  OPUS, SONNET, HAIKU, FABLE,
  KIMI_K3, KIMI_K3_256K, KIMI_FOR_CODING, MOONSHOT_K2_7_CODE,
  MODEL_CAPABILITIES,
} from "../config/models.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Pricing configuration file format.
 */
export interface PricingConfig {
  /** Version of the pricing config */
  version: string;
  /** Last updated timestamp (ISO string) */
  updatedAt: string;
  /** Source of pricing data */
  source: string;
  /** Model pricing entries */
  models: Record<string, ModelPricingEntry>;
}

/**
 * Pricing entry in config file (simplified for JSON).
 */
export interface ModelPricingEntry {
  provider: string;
  input_per_1k: number;
  output_per_1k: number;
  /** Optional notes about the model */
  notes?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default pricing config path */
export const DEFAULT_PRICING_PATH = join(homedir(), ".endiorbot", "pricing.json");

/** Default pricing data (2026-02-22 rates) */
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  version: "1.0.0",
  updatedAt: "2026-02-22",
  source: "manual",
  models: {
    // Anthropic — Claude 5 (per-1k = registry per-1M / 1000)
    [OPUS]: {
      provider: "anthropic",
      input_per_1k: MODEL_CAPABILITIES[OPUS]!.inputPer1M / 1000,
      output_per_1k: MODEL_CAPABILITIES[OPUS]!.outputPer1M / 1000,
      notes: "Most capable",
    },
    [SONNET]: {
      provider: "anthropic",
      input_per_1k: MODEL_CAPABILITIES[SONNET]!.inputPer1M / 1000,
      output_per_1k: MODEL_CAPABILITIES[SONNET]!.outputPer1M / 1000,
      notes: "Balanced performance/cost",
    },
    [FABLE]: {
      provider: "anthropic",
      input_per_1k: MODEL_CAPABILITIES[FABLE]!.inputPer1M / 1000,
      output_per_1k: MODEL_CAPABILITIES[FABLE]!.outputPer1M / 1000,
      notes: "Creative/long-form specialist",
    },
    [HAIKU]: {
      provider: "anthropic",
      input_per_1k: MODEL_CAPABILITIES[HAIKU]!.inputPer1M / 1000,
      output_per_1k: MODEL_CAPABILITIES[HAIKU]!.outputPer1M / 1000,
      notes: "Fast, economical",
    },
    // OpenAI models
    "gpt-4-turbo": {
      provider: "openai",
      input_per_1k: 0.01,
      output_per_1k: 0.03,
    },
    "gpt-4o": {
      provider: "openai",
      input_per_1k: 0.005,
      output_per_1k: 0.015,
    },
    "gpt-4o-mini": {
      provider: "openai",
      input_per_1k: 0.00015,
      output_per_1k: 0.0006,
      notes: "Most economical OpenAI",
    },
    // Google models
    "gemini-2-pro": {
      provider: "google",
      input_per_1k: 0.00125,
      output_per_1k: 0.005,
    },
    "gemini-2-flash": {
      provider: "google",
      input_per_1k: 0.000075,
      output_per_1k: 0.0003,
      notes: "Fast, very economical",
    },
    // Kimi Code subscription (api.kimi.com/coding) — k3, k3-256k, kimi-for-coding.
    // Pricing = estimate (pricingConfirmed:false in registry); confirm at platform.kimi.ai.
    [KIMI_K3]: {
      provider: "kimi",
      input_per_1k: MODEL_CAPABILITIES[KIMI_K3]!.inputPer1M / 1000,
      output_per_1k: MODEL_CAPABILITIES[KIMI_K3]!.outputPer1M / 1000,
      notes: "Kimi K3 (1M ctx) — newest subscription model. Pricing estimate.",
    },
    [KIMI_K3_256K]: {
      provider: "kimi",
      input_per_1k: MODEL_CAPABILITIES[KIMI_K3_256K]!.inputPer1M / 1000,
      output_per_1k: MODEL_CAPABILITIES[KIMI_K3_256K]!.outputPer1M / 1000,
      notes: "Kimi K3 256K. Pricing estimate.",
    },
    [KIMI_FOR_CODING]: {
      provider: "kimi",
      input_per_1k: MODEL_CAPABILITIES[KIMI_FOR_CODING]!.inputPer1M / 1000,
      output_per_1k: MODEL_CAPABILITIES[KIMI_FOR_CODING]!.outputPer1M / 1000,
      notes: "K2.7 Coding. Flat-rate $0 marginal when served by kimi-coding (CEO subscription).",
    },
    [MOONSHOT_K2_7_CODE]: {
      provider: "kimi",
      input_per_1k: MODEL_CAPABILITIES[MOONSHOT_K2_7_CODE]!.inputPer1M / 1000,
      output_per_1k: MODEL_CAPABILITIES[MOONSHOT_K2_7_CODE]!.outputPer1M / 1000,
      notes: "Kimi K2.7 Code via Moonshot direct API (kimi-api backup).",
    },
    // ADR-053: Flat-rate marker for cost tracking when provider is kimi-coding
    "kimi-coding": {
      provider: "kimi-coding",
      input_per_1k: 0,
      output_per_1k: 0,
      notes: "CEO subscription — flat-rate, no marginal cost per token",
    },
    "moonshot-v1-128k": {
      provider: "kimi",
      input_per_1k: 0.002,
      output_per_1k: 0.01,
      notes: "Moonshot v1 128K context",
    },
    "moonshot-v1-32k": {
      provider: "kimi",
      input_per_1k: 0.001,
      output_per_1k: 0.005,
      notes: "Moonshot v1 32K context — economical",
    },
    // Remote Ollama infrastructure
    "self-hosted/qwen3-coder": {
      provider: "self-hosted",
      input_per_1k: 0,
      output_per_1k: 0,
      notes: "Free via self-hosted Ollama infrastructure",
    },
    "self-hosted/deepseek-coder": {
      provider: "self-hosted",
      input_per_1k: 0,
      output_per_1k: 0,
      notes: "Free via self-hosted Ollama infrastructure",
    },
    // Local Ollama models
    "qwen3.5:9b": {
      provider: "ollama",
      input_per_1k: 0,
      output_per_1k: 0,
      notes: "Free local inference — Tier-3 router agent",
    },
    "qwen3-coder:30b": {
      provider: "ollama",
      input_per_1k: 0,
      output_per_1k: 0,
      notes: "Free local inference — code generation",
    },
  },
};

// ============================================================================
// Pricing Registry
// ============================================================================

/**
 * PricingRegistry - Manages model pricing with file-based config.
 *
 * Per CTO guidance:
 * - Loads from .endiorbot/pricing.json (not hardcoded)
 * - Falls back to defaults if file missing
 * - Supports manual updates via JSON file
 */
export class PricingRegistry {
  private pricing: Map<string, ModelPricing>;
  private config: PricingConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath ?? DEFAULT_PRICING_PATH;
    this.config = this.loadConfig();
    this.pricing = this.buildPricingMap();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get pricing for a model.
   */
  getPricing(model: string): ModelPricing | undefined {
    return this.pricing.get(model);
  }

  /**
   * Get pricing or fallback to default.
   */
  getPricingOrDefault(model: string, fallback: string = SONNET): ModelPricing {
    return this.pricing.get(model) ?? this.pricing.get(fallback) ?? this.getDefaultPricing();
  }

  /**
   * Check if model exists.
   */
  hasModel(model: string): boolean {
    return this.pricing.has(model);
  }

  /**
   * List all available models.
   */
  listModels(): string[] {
    return Array.from(this.pricing.keys());
  }

  /**
   * List models by provider.
   */
  listModelsByProvider(provider: string): string[] {
    return this.listModels().filter((model) => {
      const pricing = this.pricing.get(model);
      return pricing?.provider === provider;
    });
  }

  /**
   * Get free models (self-hosted Ollama infrastructure).
   */
  getFreeModels(): string[] {
    return this.listModels().filter((model) => {
      const pricing = this.pricing.get(model);
      return pricing && pricing.input_per_1k === 0 && pricing.output_per_1k === 0;
    });
  }

  /**
   * Calculate cost for tokens.
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.getPricingOrDefault(model);
    return (
      (inputTokens / 1000) * pricing.input_per_1k +
      (outputTokens / 1000) * pricing.output_per_1k
    );
  }

  /**
   * Get cheapest model for a provider.
   */
  getCheapestModel(provider?: string): string | undefined {
    const models = provider ? this.listModelsByProvider(provider) : this.listModels();

    let cheapest: string | undefined;
    let lowestCost = Infinity;

    for (const model of models) {
      const pricing = this.pricing.get(model);
      if (pricing) {
        // Use output cost as primary metric (typically higher)
        const cost = pricing.output_per_1k;
        if (cost < lowestCost) {
          lowestCost = cost;
          cheapest = model;
        }
      }
    }

    return cheapest;
  }

  /**
   * Get config version and update info.
   */
  getConfigInfo(): { version: string; updatedAt: string; source: string } {
    return {
      version: this.config.version,
      updatedAt: this.config.updatedAt,
      source: this.config.source,
    };
  }

  /**
   * Check if config is stale (older than N days).
   */
  isStale(maxAgeDays: number = 30): boolean {
    const updatedAt = new Date(this.config.updatedAt);
    const now = new Date();
    const ageMs = now.getTime() - updatedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > maxAgeDays;
  }

  /**
   * Reload config from file.
   */
  reload(): void {
    this.config = this.loadConfig();
    this.pricing = this.buildPricingMap();
  }

  /**
   * Update pricing for a model.
   */
  updatePricing(model: string, entry: ModelPricingEntry): void {
    this.config.models[model] = entry;
    this.config.updatedAt = new Date().toISOString().substring(0, 10);
    this.pricing = this.buildPricingMap();
  }

  /**
   * Save config to file.
   */
  saveConfig(): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Initialize config file with defaults.
   */
  initializeConfig(): void {
    this.config = { ...DEFAULT_PRICING_CONFIG };
    this.config.updatedAt = new Date().toISOString().substring(0, 10);
    this.saveConfig();
    this.pricing = this.buildPricingMap();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Load config from file or use defaults.
   */
  private loadConfig(): PricingConfig {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(content) as PricingConfig;
        // Merge with defaults to ensure all models exist
        // Deep copy models to avoid mutating DEFAULT_PRICING_CONFIG
        return {
          ...DEFAULT_PRICING_CONFIG,
          ...parsed,
          models: {
            ...this.deepCopyModels(DEFAULT_PRICING_CONFIG.models),
            ...parsed.models,
          },
        };
      } catch {
        // Invalid JSON, use defaults with deep copy
        return this.cloneDefaultConfig();
      }
    }
    return this.cloneDefaultConfig();
  }

  /**
   * Deep copy default config to avoid mutation.
   */
  private cloneDefaultConfig(): PricingConfig {
    return {
      ...DEFAULT_PRICING_CONFIG,
      models: this.deepCopyModels(DEFAULT_PRICING_CONFIG.models),
    };
  }

  /**
   * Deep copy models object.
   */
  private deepCopyModels(
    models: Record<string, ModelPricingEntry>,
  ): Record<string, ModelPricingEntry> {
    const copy: Record<string, ModelPricingEntry> = {};
    for (const [key, value] of Object.entries(models)) {
      copy[key] = { ...value };
    }
    return copy;
  }

  /**
   * Build pricing map from config.
   */
  private buildPricingMap(): Map<string, ModelPricing> {
    const map = new Map<string, ModelPricing>();

    for (const [model, entry] of Object.entries(this.config.models)) {
      map.set(model, {
        provider: entry.provider,
        model: model,
        input_per_1k: entry.input_per_1k,
        output_per_1k: entry.output_per_1k,
        updatedAt: new Date(this.config.updatedAt),
      });
    }

    return map;
  }

  /**
   * Get default pricing (Sonnet).
   */
  private getDefaultPricing(): ModelPricing {
    return {
      provider: "anthropic",
      model: SONNET,
      input_per_1k: MODEL_CAPABILITIES[SONNET]!.inputPer1M / 1000,
      output_per_1k: MODEL_CAPABILITIES[SONNET]!.outputPer1M / 1000,
      updatedAt: new Date(),
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a pricing registry with default path.
 */
export function createPricingRegistry(configPath?: string): PricingRegistry {
  return new PricingRegistry(configPath);
}

/**
 * Get default pricing for a model.
 */
export function getDefaultModelPricing(model: string): ModelPricing | undefined {
  const entry = DEFAULT_PRICING_CONFIG.models[model];
  if (!entry) return undefined;

  return {
    provider: entry.provider,
    model: model,
    input_per_1k: entry.input_per_1k,
    output_per_1k: entry.output_per_1k,
    updatedAt: new Date(DEFAULT_PRICING_CONFIG.updatedAt),
  };
}
