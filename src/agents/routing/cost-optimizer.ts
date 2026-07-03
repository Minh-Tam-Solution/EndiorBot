/**
 * Cost Optimizer Module
 *
 * Optimizes model selection based on budget constraints.
 * Triggers Ollama fallback when budget is low.
 *
 * @module agents/routing/cost-optimizer
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 39 Backlog
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { TaskComplexity, ModelTier } from "../types.js";
import type {
  BudgetConstraint,
  CostEstimate,
  CostOptimizationResult,
  ModelCapability,
  ProviderId,
} from "./types.js";
import { MODEL_TIER_HIERARCHY } from "./quality-gates.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Default budget constraint.
 */
export const DEFAULT_BUDGET: BudgetConstraint = {
  maxCostPerRequest: 0.50,    // $0.50 max per request
  dailyBudget: 10.00,         // $10 daily
  monthlyBudget: 100.00,      // $100 monthly
  currentDailySpend: 0,
  currentMonthlySpend: 0,
};

/**
 * Local fallback threshold (10% of daily budget remaining).
 */
export const DEFAULT_LOCAL_FALLBACK_THRESHOLD = 0.1;

/**
 * Default token estimates by complexity.
 */
export const TOKEN_ESTIMATES: Record<TaskComplexity, { input: number; output: number }> = {
  simple: { input: 500, output: 200 },
  moderate: { input: 1500, output: 800 },
  complex: { input: 4000, output: 2000 },
  critical: { input: 8000, output: 4000 },
};

/**
 * Ollama model (local, zero cost).
 */
export const OLLAMA_LOCAL_MODEL: ModelCapability = {
  providerId: "ollama",
  modelId: "qwen2.5-coder:14b",
  name: "Qwen 2.5 Coder 14B",
  tier: "balanced",
  inputCost: 0,
  outputCost: 0,
  maxTokens: 32768,
  strengths: ["code_gen", "bug_fix", "general"],
  features: ["coding", "fast"],
};

// ============================================================================
// Cost Optimizer
// ============================================================================

/**
 * CostOptimizer - Manages budget and model cost optimization.
 *
 * Features:
 * 1. Track daily/monthly spending
 * 2. Estimate costs before execution
 * 3. Select cost-effective models within budget
 * 4. Trigger Ollama fallback when budget is low
 */
export class CostOptimizer {
  private budget: BudgetConstraint;
  private models: Map<string, ModelCapability>;
  private localFallbackThreshold: number;

  constructor(
    budget: BudgetConstraint = DEFAULT_BUDGET,
    models: ModelCapability[] = [],
    localFallbackThreshold: number = DEFAULT_LOCAL_FALLBACK_THRESHOLD
  ) {
    this.budget = { ...budget };
    this.models = new Map();
    this.localFallbackThreshold = localFallbackThreshold;

    for (const model of models) {
      this.models.set(`${model.providerId}:${model.modelId}`, model);
    }
  }

  /**
   * Register available models.
   */
  registerModels(models: ModelCapability[]): void {
    for (const model of models) {
      this.models.set(`${model.providerId}:${model.modelId}`, model);
    }
  }

  /**
   * Update budget constraint.
   */
  updateBudget(budget: Partial<BudgetConstraint>): void {
    this.budget = { ...this.budget, ...budget };
  }

  /**
   * Record spending after a request.
   */
  recordSpend(cost: number): void {
    this.budget.currentDailySpend += cost;
    this.budget.currentMonthlySpend += cost;
  }

  /**
   * Reset daily spending (call at midnight).
   */
  resetDailySpend(): void {
    this.budget.currentDailySpend = 0;
  }

  /**
   * Reset monthly spending (call on month start).
   */
  resetMonthlySpend(): void {
    this.budget.currentMonthlySpend = 0;
    this.budget.currentDailySpend = 0;
  }

  /**
   * Get current budget status.
   */
  getBudgetStatus(): {
    dailyRemaining: number;
    monthlyRemaining: number;
    dailyUsedPercent: number;
    monthlyUsedPercent: number;
    shouldFallbackToLocal: boolean;
  } {
    const dailyRemaining = this.budget.dailyBudget - this.budget.currentDailySpend;
    const monthlyRemaining = this.budget.monthlyBudget - this.budget.currentMonthlySpend;
    const dailyUsedPercent = (this.budget.currentDailySpend / this.budget.dailyBudget) * 100;
    const monthlyUsedPercent = (this.budget.currentMonthlySpend / this.budget.monthlyBudget) * 100;

    const shouldFallbackToLocal =
      dailyRemaining < this.budget.dailyBudget * this.localFallbackThreshold ||
      monthlyRemaining < this.budget.monthlyBudget * this.localFallbackThreshold;

    return {
      dailyRemaining,
      monthlyRemaining,
      dailyUsedPercent,
      monthlyUsedPercent,
      shouldFallbackToLocal,
    };
  }

  /**
   * Estimate cost for a request.
   */
  estimateCost(
    providerId: ProviderId,
    modelId: string,
    complexity: TaskComplexity
  ): CostEstimate {
    const key = `${providerId}:${modelId}`;
    const model = this.models.get(key);
    const tokens = TOKEN_ESTIMATES[complexity];

    if (!model) {
      // Unknown model, return high estimate
      return {
        providerId,
        modelId,
        estimatedInputTokens: tokens.input,
        estimatedOutputTokens: tokens.output,
        estimatedCost: this.budget.maxCostPerRequest, // Assume max
        withinBudget: false,
      };
    }

    const inputCost = (tokens.input / 1000) * model.inputCost;
    const outputCost = (tokens.output / 1000) * model.outputCost;
    const estimatedCost = inputCost + outputCost;

    const budgetStatus = this.getBudgetStatus();
    const withinBudget =
      estimatedCost <= this.budget.maxCostPerRequest &&
      estimatedCost <= budgetStatus.dailyRemaining &&
      estimatedCost <= budgetStatus.monthlyRemaining;

    return {
      providerId,
      modelId,
      estimatedInputTokens: tokens.input,
      estimatedOutputTokens: tokens.output,
      estimatedCost,
      withinBudget,
    };
  }

  /**
   * Optimize model selection for cost.
   */
  optimize(
    candidates: ModelCapability[],
    complexity: TaskComplexity,
    minTier: ModelTier
  ): CostOptimizationResult {
    const budgetStatus = this.getBudgetStatus();

    // Check if we should fallback to local
    if (budgetStatus.shouldFallbackToLocal) {
      return this.createLocalFallbackResult(
        budgetStatus,
        `Budget low: ${budgetStatus.dailyUsedPercent.toFixed(1)}% daily used`
      );
    }

    // Filter candidates by minimum tier
    const minTierIndex = MODEL_TIER_HIERARCHY.indexOf(minTier);
    const qualified = candidates.filter((m) => {
      const tierIndex = MODEL_TIER_HIERARCHY.indexOf(m.tier);
      return tierIndex <= minTierIndex;
    });

    if (qualified.length === 0) {
      // No qualified candidates, fallback to local
      return this.createLocalFallbackResult(
        budgetStatus,
        `No models meet minimum tier '${minTier}'`
      );
    }

    // Sort by cost (cheapest first) then by tier (more powerful first)
    const sorted = qualified.sort((a, b) => {
      const costA = this.calculateModelCost(a, complexity);
      const costB = this.calculateModelCost(b, complexity);

      if (Math.abs(costA - costB) < 0.001) {
        // Same cost, prefer more powerful
        return MODEL_TIER_HIERARCHY.indexOf(a.tier) - MODEL_TIER_HIERARCHY.indexOf(b.tier);
      }

      return costA - costB;
    });

    // Find best model within budget
    let recommended: ModelCapability | undefined;
    const alternatives: CostOptimizationResult["alternatives"] = [];

    for (const model of sorted) {
      const cost = this.calculateModelCost(model, complexity);
      const estimate = this.estimateCost(model.providerId, model.modelId, complexity);

      if (!recommended && estimate.withinBudget) {
        recommended = model;
      } else if (recommended) {
        alternatives.push({
          providerId: model.providerId,
          modelId: model.modelId,
          estimatedCost: cost,
          qualityTradeoff: this.describeTradeoff(model, recommended),
        });
      }
    }

    // If no model is within budget, fallback to local
    if (!recommended) {
      return this.createLocalFallbackResult(
        budgetStatus,
        "All models exceed budget constraints"
      );
    }

    const estimatedCost = this.calculateModelCost(recommended, complexity);

    return {
      recommendedModel: {
        providerId: recommended.providerId,
        modelId: recommended.modelId,
        estimatedCost,
      },
      alternatives: alternatives.slice(0, 3), // Top 3 alternatives
      budgetStatus: {
        withinDailyBudget: estimatedCost <= budgetStatus.dailyRemaining,
        withinMonthlyBudget: estimatedCost <= budgetStatus.monthlyRemaining,
        remainingDaily: budgetStatus.dailyRemaining,
        remainingMonthly: budgetStatus.monthlyRemaining,
      },
      shouldFallbackToLocal: false,
    };
  }

  /**
   * Check if Ollama fallback should be used.
   */
  shouldUseLocalFallback(): boolean {
    return this.getBudgetStatus().shouldFallbackToLocal;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Calculate cost for a model and complexity.
   */
  private calculateModelCost(model: ModelCapability, complexity: TaskComplexity): number {
    const tokens = TOKEN_ESTIMATES[complexity];
    const inputCost = (tokens.input / 1000) * model.inputCost;
    const outputCost = (tokens.output / 1000) * model.outputCost;
    return inputCost + outputCost;
  }

  /**
   * Create a local fallback result.
   */
  private createLocalFallbackResult(
    budgetStatus: ReturnType<typeof this.getBudgetStatus>,
    reason: string
  ): CostOptimizationResult {
    return {
      recommendedModel: {
        providerId: "ollama",
        modelId: OLLAMA_LOCAL_MODEL.modelId,
        estimatedCost: 0,
      },
      alternatives: [],
      budgetStatus: {
        withinDailyBudget: true,
        withinMonthlyBudget: true,
        remainingDaily: budgetStatus.dailyRemaining,
        remainingMonthly: budgetStatus.monthlyRemaining,
      },
      shouldFallbackToLocal: true,
      fallbackReason: reason,
    };
  }

  /**
   * Describe the tradeoff between alternative and recommended.
   */
  private describeTradeoff(
    alternative: ModelCapability,
    recommended: ModelCapability
  ): string {
    const altTierIndex = MODEL_TIER_HIERARCHY.indexOf(alternative.tier);
    const recTierIndex = MODEL_TIER_HIERARCHY.indexOf(recommended.tier);

    if (altTierIndex > recTierIndex) {
      return `Lower capability (${alternative.tier} vs ${recommended.tier})`;
    } else if (altTierIndex < recTierIndex) {
      return `Higher capability but more expensive`;
    }

    return "Similar capability, different provider";
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a CostOptimizer instance.
 */
export function createCostOptimizer(
  budget?: Partial<BudgetConstraint>,
  models?: ModelCapability[]
): CostOptimizer {
  return new CostOptimizer(
    budget ? { ...DEFAULT_BUDGET, ...budget } : DEFAULT_BUDGET,
    models
  );
}

/**
 * Create CostOptimizer from environment variables.
 */
export function createCostOptimizerFromEnv(models?: ModelCapability[]): CostOptimizer {
  const budget: BudgetConstraint = {
    maxCostPerRequest: parseFloat(process.env.MAX_COST_PER_REQUEST ?? "0.50"),
    dailyBudget: parseFloat(process.env.DAILY_BUDGET ?? "10.00"),
    monthlyBudget: parseFloat(process.env.MONTHLY_BUDGET ?? "100.00"),
    currentDailySpend: 0,
    currentMonthlySpend: 0,
  };

  const threshold = parseFloat(process.env.LOCAL_FALLBACK_THRESHOLD ?? "0.1");

  return new CostOptimizer(budget, models, threshold);
}
