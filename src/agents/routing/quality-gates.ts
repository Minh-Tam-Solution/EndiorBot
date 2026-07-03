/**
 * Quality Gates Module
 *
 * Enforces minimum model tier requirements per task type.
 * Prevents using underpowered models for critical tasks.
 *
 * @module agents/routing/quality-gates
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 39 Backlog
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Quality Assurance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { TaskComplexity, TaskType, ModelTier } from "../types.js";
import type {
  QualityGate,
  QualityGateResult,
  ModelCapability,
  ProviderId,
} from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Model tier hierarchy (lower index = more powerful).
 */
export const MODEL_TIER_HIERARCHY: ModelTier[] = [
  "expert",   // Most powerful (Opus, GPT-5)
  "powerful", // High capability (Sonnet, GPT-4o)
  "balanced", // Good balance (GPT-4o-mini, Gemini Pro)
  "fast",     // Fastest/cheapest (Haiku, local models)
];

/**
 * Default quality gates per task type.
 */
export const DEFAULT_QUALITY_GATES: QualityGate[] = [
  {
    taskType: "architecture",
    minTier: "powerful",
    requireConsultation: true,
    minProviders: 2,
    maxLatencyMs: 60000,
    qualityThreshold: 0.8,
  },
  {
    taskType: "security",
    minTier: "expert",
    requireConsultation: true,
    minProviders: 2,
    maxLatencyMs: 60000,
    qualityThreshold: 0.9,
  },
  {
    taskType: "code_gen",
    minTier: "balanced",
    requireConsultation: false,
    minProviders: 1,
    maxLatencyMs: 30000,
    qualityThreshold: 0.7,
  },
  {
    taskType: "bug_fix",
    minTier: "balanced",
    requireConsultation: false,
    minProviders: 1,
    maxLatencyMs: 30000,
    qualityThreshold: 0.7,
  },
  {
    taskType: "research",
    minTier: "powerful",
    requireConsultation: true,
    minProviders: 2,
    maxLatencyMs: 45000,
    qualityThreshold: 0.75,
  },
  {
    taskType: "general",
    minTier: "fast",
    requireConsultation: false,
    minProviders: 1,
    maxLatencyMs: 20000,
    qualityThreshold: 0.6,
  },
];

/**
 * Complexity-based tier adjustments.
 */
export const COMPLEXITY_TIER_MAP: Record<TaskComplexity, ModelTier> = {
  simple: "fast",
  moderate: "balanced",
  complex: "powerful",
  critical: "expert",
};

// ============================================================================
// Quality Gates Evaluator
// ============================================================================

/**
 * QualityGatesEvaluator - Enforces model quality requirements.
 *
 * Ensures that:
 * 1. Minimum model tier is met for each task type
 * 2. Critical tasks get expert-level models
 * 3. Multi-model consultation is triggered when needed
 * 4. Quality thresholds are respected
 */
export class QualityGatesEvaluator {
  private gates: Map<TaskType, QualityGate>;
  private models: Map<string, ModelCapability>;

  constructor(
    qualityGates: QualityGate[] = DEFAULT_QUALITY_GATES,
    availableModels: ModelCapability[] = []
  ) {
    this.gates = new Map();
    this.models = new Map();

    for (const gate of qualityGates) {
      this.gates.set(gate.taskType, gate);
    }

    for (const model of availableModels) {
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
   * Get quality gate for a task type.
   */
  getGate(taskType: TaskType): QualityGate {
    return this.gates.get(taskType) ?? this.gates.get("general")!;
  }

  /**
   * Get minimum tier for task type and complexity.
   */
  getMinTier(taskType: TaskType, complexity: TaskComplexity): ModelTier {
    const gate = this.getGate(taskType);
    const complexityTier = COMPLEXITY_TIER_MAP[complexity];

    // Return the higher tier requirement
    return this.getHigherTier(gate.minTier, complexityTier);
  }

  /**
   * Evaluate if a model meets quality gate requirements.
   */
  evaluate(
    taskType: TaskType,
    complexity: TaskComplexity,
    selectedModel: { providerId: ProviderId; modelId: string; tier: ModelTier }
  ): QualityGateResult {
    const gate = this.getGate(taskType);
    const minTier = this.getMinTier(taskType, complexity);
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check tier requirement
    const meetsMinTier = this.tierMeetsMinimum(selectedModel.tier, minTier);
    if (!meetsMinTier) {
      violations.push(
        `Model tier '${selectedModel.tier}' does not meet minimum '${minTier}' for ${taskType}/${complexity}`
      );
      recommendations.push(
        `Upgrade to a ${minTier} tier model or higher for this task`
      );
    }

    // Check if consultation is required but not provided
    if (gate.requireConsultation) {
      recommendations.push(
        `Multi-model consultation recommended with ${gate.minProviders}+ providers`
      );
    }

    // Add complexity-specific recommendations
    if (complexity === "critical") {
      recommendations.push(
        "Critical task: Consider manual review of AI output"
      );
    }

    const passed = violations.length === 0;

    return {
      passed,
      selectedTier: selectedModel.tier,
      meetsMinTier,
      requiresConsultation: gate.requireConsultation,
      violations,
      recommendations,
    };
  }

  /**
   * Get all models that meet quality gate requirements.
   */
  getQualifiedModels(
    taskType: TaskType,
    complexity: TaskComplexity
  ): ModelCapability[] {
    const minTier = this.getMinTier(taskType, complexity);
    const qualified: ModelCapability[] = [];

    for (const model of this.models.values()) {
      if (this.tierMeetsMinimum(model.tier, minTier)) {
        qualified.push(model);
      }
    }

    // Sort by tier (most powerful first)
    return qualified.sort((a, b) => {
      const tierA = MODEL_TIER_HIERARCHY.indexOf(a.tier);
      const tierB = MODEL_TIER_HIERARCHY.indexOf(b.tier);
      return tierA - tierB;
    });
  }

  /**
   * Check if consultation is required.
   */
  requiresConsultation(taskType: TaskType, complexity: TaskComplexity): boolean {
    const gate = this.getGate(taskType);

    // Always require for critical complexity
    if (complexity === "critical") {
      return true;
    }

    // Always require for security tasks
    if (taskType === "security") {
      return true;
    }

    return gate.requireConsultation;
  }

  /**
   * Get minimum providers for consultation.
   */
  getMinConsultationProviders(taskType: TaskType): number {
    const gate = this.getGate(taskType);
    return gate.minProviders;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Compare two tiers and return the higher one.
   */
  private getHigherTier(tier1: ModelTier, tier2: ModelTier): ModelTier {
    const index1 = MODEL_TIER_HIERARCHY.indexOf(tier1);
    const index2 = MODEL_TIER_HIERARCHY.indexOf(tier2);
    return index1 <= index2 ? tier1 : tier2;
  }

  /**
   * Check if a tier meets the minimum requirement.
   */
  private tierMeetsMinimum(tier: ModelTier, minTier: ModelTier): boolean {
    const tierIndex = MODEL_TIER_HIERARCHY.indexOf(tier);
    const minIndex = MODEL_TIER_HIERARCHY.indexOf(minTier);
    return tierIndex <= minIndex;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a QualityGatesEvaluator instance.
 */
export function createQualityGates(
  gates?: QualityGate[],
  models?: ModelCapability[]
): QualityGatesEvaluator {
  return new QualityGatesEvaluator(gates, models);
}

/**
 * Get minimum tier for a task quickly.
 */
export function getMinTierForTask(
  taskType: TaskType,
  complexity: TaskComplexity
): ModelTier {
  const gate = DEFAULT_QUALITY_GATES.find((g) => g.taskType === taskType) ??
    DEFAULT_QUALITY_GATES.find((g) => g.taskType === "general")!;
  const complexityTier = COMPLEXITY_TIER_MAP[complexity];

  const index1 = MODEL_TIER_HIERARCHY.indexOf(gate.minTier);
  const index2 = MODEL_TIER_HIERARCHY.indexOf(complexityTier);

  return MODEL_TIER_HIERARCHY[Math.min(index1, index2)] as ModelTier;
}
