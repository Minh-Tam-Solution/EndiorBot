/**
 * Model Selector Module
 *
 * Unified model selection combining quality gates and cost optimization.
 *
 * @module agents/routing/model-selector
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 39 Backlog
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { TaskComplexity, TaskType, ModelTier } from "../types.js";
import type {
  ModelCapability,
  ModelFeature,
  ModelSelectionResult,
  SelectionCriteria,
  ProviderId,
  BudgetConstraint,
} from "./types.js";
import { OPUS, SONNET, HAIKU, getCapability } from "../../config/models.js";
import {
  QualityGatesEvaluator,
  createQualityGates,
  MODEL_TIER_HIERARCHY,
} from "./quality-gates.js";
import {
  CostOptimizer,
  createCostOptimizer,
  OLLAMA_LOCAL_MODEL,
} from "./cost-optimizer.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Build an Anthropic ModelCapability from the SSOT capability registry.
 * cost/context resolve through models.ts — next vendor bump = edit registry only.
 */
function anthropicCapability(
  modelId: string,
  name: string,
  strengths: TaskType[],
  features: ModelFeature[],
): ModelCapability {
  const c = getCapability(modelId);
  return {
    providerId: "anthropic",
    modelId,
    name,
    tier: c.tier as ModelTier,
    inputCost: c.inputPer1M / 1000,   // registry is per-1M; this table is per-1K
    outputCost: c.outputPer1M / 1000,
    maxTokens: c.contextWindow,
    strengths,
    features,
  };
}

/**
 * Default model capabilities for common providers.
 */
export const DEFAULT_MODEL_CAPABILITIES: ModelCapability[] = [
  // Anthropic — resolved through SSOT (Claude 5, 1M context)
  anthropicCapability(OPUS, "Claude Opus 5", ["architecture", "security", "research"], ["reasoning", "coding", "vision", "context"]),
  anthropicCapability(SONNET, "Claude Sonnet 5", ["code_gen", "bug_fix", "general"], ["reasoning", "coding", "vision", "streaming"]),
  anthropicCapability(HAIKU, "Claude Haiku", ["general"], ["fast", "streaming"]),

  // OpenAI
  {
    providerId: "openai",
    modelId: "gpt-4o",
    name: "GPT-4o",
    tier: "powerful",
    inputCost: 0.005,
    outputCost: 0.015,
    maxTokens: 128000,
    strengths: ["architecture", "code_gen", "research"],
    features: ["reasoning", "coding", "vision", "streaming"],
  },
  {
    providerId: "openai",
    modelId: "gpt-4o-mini",
    name: "GPT-4o Mini",
    tier: "balanced",
    inputCost: 0.00015,
    outputCost: 0.0006,
    maxTokens: 128000,
    strengths: ["code_gen", "bug_fix", "general"],
    features: ["fast", "coding", "streaming"],
  },

  // Google
  {
    providerId: "gemini",
    modelId: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    tier: "powerful",
    inputCost: 0.0001,
    outputCost: 0.0004,
    maxTokens: 1000000,
    strengths: ["research", "general"],
    features: ["fast", "context", "streaming"],
  },
  {
    providerId: "gemini",
    modelId: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    tier: "powerful",
    inputCost: 0.00125,
    outputCost: 0.005,
    maxTokens: 2000000,
    strengths: ["architecture", "research"],
    features: ["reasoning", "context", "streaming"],
  },

  // Ollama (Local)
  OLLAMA_LOCAL_MODEL,
];

/**
 * Provider priority for consultation.
 */
export const CONSULTATION_PRIORITY: Record<TaskType, ProviderId[]> = {
  architecture: ["anthropic", "openai", "gemini"],
  security: ["anthropic", "openai"],
  code_gen: ["anthropic", "openai", "ollama"],
  bug_fix: ["anthropic", "ollama"],
  research: ["gemini", "anthropic", "openai"],
  general: ["anthropic", "openai", "gemini", "ollama"],
};

// ============================================================================
// Model Selector
// ============================================================================

/**
 * ModelSelector - Unified model selection.
 *
 * Combines:
 * 1. Quality gates for minimum tier enforcement
 * 2. Cost optimization for budget management
 * 3. Provider preference for task-specific routing
 */
export class ModelSelector {
  private qualityGates: QualityGatesEvaluator;
  private costOptimizer: CostOptimizer;
  private models: Map<string, ModelCapability>;
  private availableProviders: Set<ProviderId>;

  constructor(
    models: ModelCapability[] = DEFAULT_MODEL_CAPABILITIES,
    budget?: Partial<BudgetConstraint>
  ) {
    this.models = new Map();
    this.availableProviders = new Set();

    for (const model of models) {
      this.models.set(`${model.providerId}:${model.modelId}`, model);
      this.availableProviders.add(model.providerId);
    }

    this.qualityGates = createQualityGates(undefined, models);
    this.costOptimizer = createCostOptimizer(budget, models);
  }

  /**
   * Register additional models.
   */
  registerModels(models: ModelCapability[]): void {
    for (const model of models) {
      this.models.set(`${model.providerId}:${model.modelId}`, model);
      this.availableProviders.add(model.providerId);
    }
    this.qualityGates.registerModels(models);
    this.costOptimizer.registerModels(models);
  }

  /**
   * Update budget constraint.
   */
  updateBudget(budget: Partial<BudgetConstraint>): void {
    this.costOptimizer.updateBudget(budget);
  }

  /**
   * Record spending after a request.
   */
  recordSpend(cost: number): void {
    this.costOptimizer.recordSpend(cost);
  }

  /**
   * Select the best model for given criteria.
   */
  select(criteria: SelectionCriteria): ModelSelectionResult {
    const {
      taskType,
      complexity,
      minTier,
      budget,
      preferredProviders,
      requiredFeatures,
      latencyPreference,
    } = criteria;

    // Update budget if provided
    if (budget) {
      this.costOptimizer.updateBudget(budget);
    }

    // Get minimum tier from quality gates
    const qualityMinTier = this.qualityGates.getMinTier(taskType, complexity);
    const effectiveMinTier = this.getHigherTier(minTier, qualityMinTier);

    // Get candidates that meet requirements
    const candidates = this.getCandidates(
      taskType,
      effectiveMinTier,
      preferredProviders,
      requiredFeatures
    );

    if (candidates.length === 0) {
      // Fallback to local model
      return this.createLocalFallbackResult(taskType, complexity, "No candidates match criteria");
    }

    // Apply latency preference
    const sorted = this.sortByPreference(candidates, latencyPreference);

    // Optimize for cost
    const costResult = this.costOptimizer.optimize(sorted, complexity, effectiveMinTier);

    if (costResult.shouldFallbackToLocal) {
      return this.createLocalFallbackResult(
        taskType,
        complexity,
        costResult.fallbackReason ?? "Budget constraint"
      );
    }

    // Build selection result
    const primary = this.models.get(
      `${costResult.recommendedModel.providerId}:${costResult.recommendedModel.modelId}`
    )!;

    const fallbacks = costResult.alternatives.map((alt) => ({
      providerId: alt.providerId,
      modelId: alt.modelId,
      tier: this.models.get(`${alt.providerId}:${alt.modelId}`)?.tier ?? ("balanced" as ModelTier),
      reason: alt.qualityTradeoff,
    }));

    // Check if consultation is required
    const requiresConsultation = this.qualityGates.requiresConsultation(taskType, complexity);

    // Evaluate quality gate
    const gateResult = this.qualityGates.evaluate(taskType, complexity, {
      providerId: primary.providerId,
      modelId: primary.modelId,
      tier: primary.tier,
    });

    // Build result with conditional consultationModels
    const result: ModelSelectionResult = {
      primary: {
        providerId: primary.providerId,
        modelId: primary.modelId,
        tier: primary.tier,
        reason: this.buildSelectionReason(primary, taskType, complexity),
      },
      fallbacks,
      metadata: {
        criteriaUsed: this.buildCriteriaList(criteria),
        budgetConsidered: true,
        qualityGatePassed: gateResult.passed,
        estimatedCost: costResult.recommendedModel.estimatedCost,
      },
    };

    // Add consultation models if required
    if (requiresConsultation) {
      const consultationModels = this.getConsultationModels(taskType, primary.providerId);
      if (consultationModels.length > 0) {
        result.consultationModels = consultationModels;
      }
    }

    return result;
  }

  /**
   * Quick select for simple cases.
   */
  quickSelect(
    taskType: TaskType,
    complexity: TaskComplexity
  ): { providerId: ProviderId; modelId: string } {
    const result = this.select({
      taskType,
      complexity,
      minTier: "fast",
      latencyPreference: "balanced",
    });

    return {
      providerId: result.primary.providerId,
      modelId: result.primary.modelId,
    };
  }

  /**
   * Get models for consultation.
   */
  getConsultationModels(
    taskType: TaskType,
    primaryProvider: ProviderId
  ): NonNullable<ModelSelectionResult["consultationModels"]> {
    const priority = CONSULTATION_PRIORITY[taskType] ?? CONSULTATION_PRIORITY.general;
    const minProviders = this.qualityGates.getMinConsultationProviders(taskType);

    const models: NonNullable<ModelSelectionResult["consultationModels"]> = [];

    for (const providerId of priority) {
      if (!this.availableProviders.has(providerId)) continue;

      // Get best model for this provider
      const providerModels = Array.from(this.models.values())
        .filter((m) => m.providerId === providerId)
        .sort((a, b) => MODEL_TIER_HIERARCHY.indexOf(a.tier) - MODEL_TIER_HIERARCHY.indexOf(b.tier));

      if (providerModels.length > 0) {
        const model = providerModels[0]!;
        models.push({
          providerId: model.providerId,
          modelId: model.modelId,
          role: model.providerId === primaryProvider ? "primary" : "expert",
        });
      }

      if (models.length >= minProviders) break;
    }

    return models;
  }

  /**
   * Check if local fallback should be used.
   */
  shouldUseLocalFallback(): boolean {
    return this.costOptimizer.shouldUseLocalFallback();
  }

  /**
   * Get budget status.
   */
  getBudgetStatus() {
    return this.costOptimizer.getBudgetStatus();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get candidates matching criteria.
   */
  private getCandidates(
    _taskType: TaskType, // Reserved for future strength-based filtering
    minTier: ModelTier,
    preferredProviders?: ProviderId[],
    requiredFeatures?: string[]
  ): ModelCapability[] {
    const minTierIndex = MODEL_TIER_HIERARCHY.indexOf(minTier);

    return Array.from(this.models.values()).filter((model) => {
      // Check tier
      const tierIndex = MODEL_TIER_HIERARCHY.indexOf(model.tier);
      if (tierIndex > minTierIndex) return false;

      // Check preferred providers
      if (preferredProviders && preferredProviders.length > 0) {
        if (!preferredProviders.includes(model.providerId)) return false;
      }

      // Check available providers
      if (!this.availableProviders.has(model.providerId)) return false;

      // Check required features
      if (requiredFeatures && requiredFeatures.length > 0) {
        const hasFeatures = requiredFeatures.every((f) =>
          model.features.includes(f as ModelCapability["features"][number])
        );
        if (!hasFeatures) return false;
      }

      return true;
    });
  }

  /**
   * Sort candidates by latency preference.
   */
  private sortByPreference(
    candidates: ModelCapability[],
    preference: SelectionCriteria["latencyPreference"]
  ): ModelCapability[] {
    return candidates.sort((a, b) => {
      switch (preference) {
        case "fastest":
          // Prefer fast tier, then by cost
          if (a.tier === "fast" && b.tier !== "fast") return -1;
          if (b.tier === "fast" && a.tier !== "fast") return 1;
          return a.inputCost - b.inputCost;

        case "quality":
          // Prefer expert tier, then powerful
          const tierDiff = MODEL_TIER_HIERARCHY.indexOf(a.tier) - MODEL_TIER_HIERARCHY.indexOf(b.tier);
          if (tierDiff !== 0) return tierDiff;
          return b.inputCost - a.inputCost; // More expensive usually better quality

        case "balanced":
        default:
          // Balance tier and cost
          const aTierScore = MODEL_TIER_HIERARCHY.indexOf(a.tier);
          const bTierScore = MODEL_TIER_HIERARCHY.indexOf(b.tier);
          const aCostScore = Math.log(a.inputCost + a.outputCost + 0.001);
          const bCostScore = Math.log(b.inputCost + b.outputCost + 0.001);
          return (aTierScore + aCostScore) - (bTierScore + bCostScore);
      }
    });
  }

  /**
   * Get the higher tier between two.
   */
  private getHigherTier(tier1: ModelTier, tier2: ModelTier): ModelTier {
    const index1 = MODEL_TIER_HIERARCHY.indexOf(tier1);
    const index2 = MODEL_TIER_HIERARCHY.indexOf(tier2);
    return MODEL_TIER_HIERARCHY[Math.min(index1, index2)] as ModelTier;
  }

  /**
   * Build selection reason string.
   */
  private buildSelectionReason(
    model: ModelCapability,
    taskType: TaskType,
    complexity: TaskComplexity
  ): string {
    const reasons: string[] = [];

    if (model.strengths.includes(taskType)) {
      reasons.push(`Specialized for ${taskType}`);
    }

    if (complexity === "critical" && model.tier === "expert") {
      reasons.push("Expert-level for critical task");
    }

    if (model.inputCost === 0) {
      reasons.push("Zero cost (local)");
    }

    if (reasons.length === 0) {
      reasons.push(`${model.tier} tier selected for ${complexity} complexity`);
    }

    return reasons.join(", ");
  }

  /**
   * Build criteria list for metadata.
   */
  private buildCriteriaList(criteria: SelectionCriteria): string[] {
    const list: string[] = [];

    list.push(`taskType: ${criteria.taskType}`);
    list.push(`complexity: ${criteria.complexity}`);
    list.push(`minTier: ${criteria.minTier}`);
    list.push(`latency: ${criteria.latencyPreference}`);

    if (criteria.preferredProviders?.length) {
      list.push(`preferred: ${criteria.preferredProviders.join(",")}`);
    }

    if (criteria.requiredFeatures?.length) {
      list.push(`features: ${criteria.requiredFeatures.join(",")}`);
    }

    return list;
  }

  /**
   * Create a local fallback result.
   */
  private createLocalFallbackResult(
    taskType: TaskType,
    complexity: TaskComplexity,
    reason: string
  ): ModelSelectionResult {
    // Note: consultationModels is intentionally omitted (not set to undefined)
    // to satisfy exactOptionalPropertyTypes
    return {
      primary: {
        providerId: "ollama",
        modelId: OLLAMA_LOCAL_MODEL.modelId,
        tier: OLLAMA_LOCAL_MODEL.tier,
        reason: `Local fallback: ${reason}`,
      },
      fallbacks: [],
      metadata: {
        criteriaUsed: [`taskType: ${taskType}`, `complexity: ${complexity}`],
        budgetConsidered: true,
        qualityGatePassed: false,
        estimatedCost: 0,
      },
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a ModelSelector instance.
 */
export function createModelSelector(
  models?: ModelCapability[],
  budget?: Partial<BudgetConstraint>
): ModelSelector {
  return new ModelSelector(models, budget);
}

/**
 * Create ModelSelector from environment.
 */
export function createModelSelectorFromEnv(): ModelSelector {
  const budget: Partial<BudgetConstraint> = {
    maxCostPerRequest: parseFloat(process.env.MAX_COST_PER_REQUEST ?? "0.50"),
    dailyBudget: parseFloat(process.env.DAILY_BUDGET ?? "10.00"),
    monthlyBudget: parseFloat(process.env.MONTHLY_BUDGET ?? "100.00"),
  };

  return new ModelSelector(DEFAULT_MODEL_CAPABILITIES, budget);
}
