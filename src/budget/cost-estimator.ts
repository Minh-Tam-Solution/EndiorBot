/**
 * Cost Estimator
 *
 * Estimates task costs before execution with honest confidence levels.
 *
 * Per CTO guidance:
 * - Confidence should default to LOW until historical data is populated
 * - Conservative estimates are better than overconfident ones
 * - After N real sessions, confidence can increase based on historical accuracy
 *
 * Based on ADR-007 Autonomous Execution Budget specification.
 */

import { SONNET } from "../config/models.js";
import type {
  CostEstimate,
  TaskContext,
  TaskType,
  ConfidenceLevel,
  HistoricalData,
  CostBreakdown,
} from "./types.js";
import type { PricingRegistry } from "./pricing-registry.js";
import { createPricingRegistry } from "./pricing-registry.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Confidence calculation result.
 */
export interface ConfidenceResult {
  level: ConfidenceLevel;
  score: number;
  factors: ConfidenceFactor[];
}

/**
 * Factor contributing to confidence.
 */
export interface ConfidenceFactor {
  name: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
  description: string;
}

/**
 * Token estimation result.
 */
export interface TokenEstimate {
  input: number;
  output: number;
  method: "measured" | "heuristic" | "historical";
  confidence: number;
}

/**
 * Cost estimator configuration.
 */
export interface CostEstimatorConfig {
  /** Minimum sessions needed for MEDIUM confidence */
  minSessionsForMedium: number;
  /** Minimum sessions needed for HIGH confidence */
  minSessionsForHigh: number;
  /** Historical accuracy threshold for HIGH confidence */
  accuracyThresholdForHigh: number;
  /** Default model for estimation */
  defaultModel: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default estimator config */
export const DEFAULT_ESTIMATOR_CONFIG: CostEstimatorConfig = {
  minSessionsForMedium: 10, // Need 10 real sessions for MEDIUM
  minSessionsForHigh: 50, // Need 50 real sessions for HIGH
  accuracyThresholdForHigh: 0.8, // 80% accuracy for HIGH
  defaultModel: SONNET,
};

/** Base output token estimates by task type */
export const BASE_OUTPUT_ESTIMATES: Record<TaskType, number> = {
  code_implementation: 2000,
  code_review: 1000,
  test_writing: 1500,
  bug_fix: 800,
  refactoring: 1200,
  documentation: 1000,
  architecture: 3000,
  research: 2500,
  general: 1000,
};

/** Output multipliers for complex tasks */
const COMPLEXITY_MULTIPLIERS = {
  simple: 0.5,
  medium: 1.0,
  complex: 2.0,
  very_complex: 3.0,
};

/** Average characters per token (approximate) */
const CHARS_PER_TOKEN = 4;

// ============================================================================
// Cost Estimator
// ============================================================================

/**
 * CostEstimator - Estimates task costs with honest confidence.
 *
 * Key behaviors per CTO guidance:
 * - Always starts with LOW confidence (no overconfidence)
 * - Increases confidence only with real historical data
 * - Provides conservative estimates by default
 */
export class CostEstimator {
  private pricingRegistry: PricingRegistry;
  private historicalData: HistoricalData;
  private sessionCount: number;
  private config: CostEstimatorConfig;
  private taskTypeCounts: Map<TaskType, number>;
  private modelCounts: Map<string, number>;

  constructor(
    historicalData?: HistoricalData,
    config?: Partial<CostEstimatorConfig>,
    pricingRegistry?: PricingRegistry,
  ) {
    this.pricingRegistry = pricingRegistry ?? createPricingRegistry();
    this.historicalData = historicalData ?? this.createEmptyHistoricalData();
    this.sessionCount = this.calculateSessionCount();
    this.config = { ...DEFAULT_ESTIMATOR_CONFIG, ...config };
    this.taskTypeCounts = new Map();
    this.modelCounts = new Map();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Estimate cost for a task.
   */
  estimate(context: TaskContext, model?: string): CostEstimate {
    const targetModel = model ?? this.config.defaultModel;
    const taskType = context.taskType ?? "general";

    // Estimate tokens
    const tokenEstimate = this.estimateTokens(context, taskType);

    // Calculate cost
    const cost = this.pricingRegistry.calculateCost(
      targetModel,
      tokenEstimate.input,
      tokenEstimate.output,
    );

    // Calculate confidence (per CTO: default to LOW)
    const confidence = this.calculateConfidence(taskType, tokenEstimate);

    // Get historical average if available
    const historicalAvg = this.historicalData.avgCostPerTask[taskType];

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      taskType,
      cost,
      targetModel,
      confidence,
    );

    // Build estimate
    const estimate: CostEstimate = {
      estimated_cost: cost,
      estimated_tokens: {
        input: tokenEstimate.input,
        output: tokenEstimate.output,
      },
      confidence: confidence.level,
      confidence_score: confidence.score,
      breakdown: this.buildBreakdown(targetModel, tokenEstimate),
    };

    // Add optional fields only if defined
    if (historicalAvg !== undefined) {
      estimate.historical_avg = historicalAvg;
    }
    if (recommendation !== undefined) {
      estimate.recommendation = recommendation;
    }

    return estimate;
  }

  /**
   * Estimate cost for multiple models (comparison).
   */
  estimateForModels(
    context: TaskContext,
    models: string[],
  ): Map<string, CostEstimate> {
    const estimates = new Map<string, CostEstimate>();
    for (const model of models) {
      estimates.set(model, this.estimate(context, model));
    }
    return estimates;
  }

  /**
   * Get cheapest model for a task.
   */
  findCheapestModel(
    context: TaskContext,
    models?: string[],
  ): { model: string; estimate: CostEstimate } | undefined {
    const targetModels = models ?? this.pricingRegistry.listModels();
    const estimates = this.estimateForModels(context, targetModels);

    let cheapest: { model: string; estimate: CostEstimate } | undefined;
    let lowestCost = Infinity;

    for (const [model, estimate] of estimates) {
      if (estimate.estimated_cost < lowestCost) {
        lowestCost = estimate.estimated_cost;
        cheapest = { model, estimate };
      }
    }

    return cheapest;
  }

  /**
   * Update historical data with actual usage.
   */
  recordActualCost(taskType: TaskType, model: string, actualCost: number): void {
    // Get current counts
    const taskCount = this.taskTypeCounts.get(taskType) ?? 0;
    const modelCount = this.modelCounts.get(model) ?? 0;

    // Update task type average using running average formula
    const currentTaskAvg = this.historicalData.avgCostPerTask[taskType] ?? 0;
    const newTaskAvg =
      taskCount === 0
        ? actualCost
        : (currentTaskAvg * taskCount + actualCost) / (taskCount + 1);
    this.historicalData.avgCostPerTask[taskType] = newTaskAvg;
    this.taskTypeCounts.set(taskType, taskCount + 1);

    // Update model average using running average formula
    const currentModelAvg = this.historicalData.avgCostPerModel[model] ?? 0;
    const newModelAvg =
      modelCount === 0
        ? actualCost
        : (currentModelAvg * modelCount + actualCost) / (modelCount + 1);
    this.historicalData.avgCostPerModel[model] = newModelAvg;
    this.modelCounts.set(model, modelCount + 1);

    // Update total spent
    this.historicalData.totalSpent += actualCost;

    // Increment session count
    this.sessionCount++;
  }

  /**
   * Get current confidence level (overall).
   */
  getOverallConfidence(): ConfidenceLevel {
    if (this.sessionCount >= this.config.minSessionsForHigh) {
      return "high";
    }
    if (this.sessionCount >= this.config.minSessionsForMedium) {
      return "medium";
    }
    return "low";
  }

  /**
   * Get session count.
   */
  getSessionCount(): number {
    return this.sessionCount;
  }

  /**
   * Get historical data.
   */
  getHistoricalData(): HistoricalData {
    return { ...this.historicalData };
  }

  /**
   * Reset historical data.
   */
  resetHistoricalData(): void {
    this.historicalData = this.createEmptyHistoricalData();
    this.sessionCount = 0;
    this.taskTypeCounts.clear();
    this.modelCounts.clear();
  }

  // ==========================================================================
  // Token Estimation
  // ==========================================================================

  /**
   * Estimate tokens for a task.
   */
  estimateTokens(context: TaskContext, taskType: TaskType): TokenEstimate {
    // Input tokens from prompt and context
    const inputTokens = this.estimateInputTokens(context);

    // Output tokens from task type and complexity
    const outputTokens = this.estimateOutputTokens(taskType, context);

    // Determine estimation method
    const method = this.hasHistoricalData(taskType) ? "historical" : "heuristic";

    // Calculate confidence for this estimate
    const confidence = method === "historical" ? 0.7 : 0.4;

    return {
      input: inputTokens,
      output: outputTokens,
      method,
      confidence,
    };
  }

  /**
   * Estimate input tokens.
   */
  private estimateInputTokens(context: TaskContext): number {
    let totalChars = 0;

    // Prompt
    totalChars += context.prompt.length;

    // Files
    if (context.files) {
      for (const file of context.files) {
        totalChars += file.content.length;
      }
    }

    // Conversation history
    if (context.conversationHistory) {
      totalChars += context.conversationHistory.length;
    }

    // Convert to tokens (conservative estimate)
    return Math.ceil(totalChars / CHARS_PER_TOKEN);
  }

  /**
   * Estimate output tokens.
   */
  private estimateOutputTokens(taskType: TaskType, context: TaskContext): number {
    // Base estimate from task type
    let baseEstimate = BASE_OUTPUT_ESTIMATES[taskType];

    // Adjust for historical data if available
    if (this.hasHistoricalData(taskType)) {
      const historicalAvg = this.getHistoricalOutputAvg(taskType);
      if (historicalAvg > 0) {
        // Blend base with historical (70% historical, 30% base)
        baseEstimate = Math.round(historicalAvg * 0.7 + baseEstimate * 0.3);
      }
    }

    // Adjust for complexity
    const complexity = this.estimateComplexity(context);
    const multiplier = COMPLEXITY_MULTIPLIERS[complexity];

    return Math.ceil(baseEstimate * multiplier);
  }

  /**
   * Estimate task complexity.
   */
  private estimateComplexity(
    context: TaskContext,
  ): keyof typeof COMPLEXITY_MULTIPLIERS {
    let score = 0;

    // Prompt length
    if (context.prompt.length > 2000) score += 2;
    else if (context.prompt.length > 500) score += 1;

    // File count
    const fileCount = context.files?.length ?? 0;
    if (fileCount > 5) score += 2;
    else if (fileCount > 2) score += 1;

    // Total file size
    const totalFileSize =
      context.files?.reduce((sum, f) => sum + f.content.length, 0) ?? 0;
    if (totalFileSize > 50000) score += 2;
    else if (totalFileSize > 10000) score += 1;

    // Map score to complexity
    if (score >= 5) return "very_complex";
    if (score >= 3) return "complex";
    if (score >= 1) return "medium";
    return "simple";
  }

  // ==========================================================================
  // Confidence Calculation
  // ==========================================================================

  /**
   * Calculate confidence for an estimate.
   *
   * Per CTO: Default to LOW until historical data proves accuracy.
   */
  private calculateConfidence(
    taskType: TaskType,
    tokenEstimate: TokenEstimate,
  ): ConfidenceResult {
    const factors: ConfidenceFactor[] = [];
    let score = 0;

    // Factor 1: Historical data availability
    if (this.hasHistoricalData(taskType)) {
      factors.push({
        name: "historical_data",
        impact: "positive",
        weight: 0.3,
        description: "Historical data available for this task type",
      });
      score += 0.3;
    } else {
      factors.push({
        name: "no_historical_data",
        impact: "negative",
        weight: -0.2,
        description: "No historical data - using heuristics only",
      });
      score -= 0.2;
    }

    // Factor 2: Session count (more sessions = more confidence)
    if (this.sessionCount >= this.config.minSessionsForHigh) {
      factors.push({
        name: "high_session_count",
        impact: "positive",
        weight: 0.3,
        description: `${this.sessionCount} sessions completed`,
      });
      score += 0.3;
    } else if (this.sessionCount >= this.config.minSessionsForMedium) {
      factors.push({
        name: "medium_session_count",
        impact: "positive",
        weight: 0.2,
        description: `${this.sessionCount} sessions completed`,
      });
      score += 0.2;
    } else {
      factors.push({
        name: "low_session_count",
        impact: "negative",
        weight: -0.1,
        description: `Only ${this.sessionCount} sessions - need more data`,
      });
      score -= 0.1;
    }

    // Factor 3: Token estimation method
    if (tokenEstimate.method === "historical") {
      factors.push({
        name: "historical_tokens",
        impact: "positive",
        weight: 0.2,
        description: "Token estimate based on historical data",
      });
      score += 0.2;
    } else {
      factors.push({
        name: "heuristic_tokens",
        impact: "neutral",
        weight: 0,
        description: "Token estimate based on heuristics",
      });
    }

    // Normalize score to 0-1
    const normalizedScore = Math.max(0, Math.min(1, (score + 0.3) / 0.8));

    // Determine level (per CTO: conservative)
    let level: ConfidenceLevel;
    if (normalizedScore >= 0.7 && this.sessionCount >= this.config.minSessionsForHigh) {
      level = "high";
    } else if (
      normalizedScore >= 0.4 &&
      this.sessionCount >= this.config.minSessionsForMedium
    ) {
      level = "medium";
    } else {
      level = "low"; // Default to LOW
    }

    return { level, score: normalizedScore, factors };
  }

  // ==========================================================================
  // Recommendations
  // ==========================================================================

  /**
   * Generate cost-saving recommendation.
   */
  private generateRecommendation(
    taskType: TaskType,
    cost: number,
    model: string,
    confidence: ConfidenceResult,
  ): string | undefined {
    const recommendations: string[] = [];

    // High cost warning
    if (cost > 0.5) {
      recommendations.push(
        `High estimated cost ($${cost.toFixed(2)}). Consider breaking into smaller tasks.`,
      );
    }

    // Suggest cheaper model for expensive tasks
    if (cost > 0.1 && model.includes("opus")) {
      recommendations.push(
        "Consider using Sonnet for this task (potentially 80% cheaper).",
      );
    }

    // Suggest Self-Hosted Ollama for simple tasks
    if (taskType === "documentation" || taskType === "general") {
      recommendations.push(
        "Consider using Self-Hosted Ollama (free) for this simple task.",
      );
    }

    // Low confidence warning
    if (confidence.level === "low") {
      recommendations.push(
        "LOW confidence estimate - actual cost may vary significantly.",
      );
    }

    // Pricing staleness warning
    if (this.pricingRegistry.isStale()) {
      recommendations.push(
        "Pricing data may be outdated. Consider updating .endiorbot/pricing.json.",
      );
    }

    return recommendations.length > 0 ? recommendations.join(" ") : undefined;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Build cost breakdown.
   */
  private buildBreakdown(
    model: string,
    tokenEstimate: TokenEstimate,
  ): CostBreakdown {
    const pricing = this.pricingRegistry.getPricingOrDefault(model);
    const inputCost = (tokenEstimate.input / 1000) * pricing.input_per_1k;
    const outputCost = (tokenEstimate.output / 1000) * pricing.output_per_1k;

    return {
      model_cost: inputCost + outputCost,
      tool_cost: 0, // Future: tool usage costs
      api_overhead: 0, // Future: API overhead
    };
  }

  /**
   * Check if historical data exists for task type.
   */
  private hasHistoricalData(taskType: TaskType): boolean {
    return this.historicalData.avgCostPerTask[taskType] !== undefined;
  }

  /**
   * Get historical output average for task type.
   */
  private getHistoricalOutputAvg(_taskType: TaskType): number {
    // Future: store actual output token counts
    // For now, return 0 (will use base estimates)
    return 0;
  }

  /**
   * Calculate session count from historical data.
   */
  private calculateSessionCount(): number {
    // Estimate from total spent (average $0.10 per session)
    if (this.historicalData.totalSpent > 0) {
      return Math.floor(this.historicalData.totalSpent / 0.1);
    }
    return 0;
  }

  /**
   * Create empty historical data.
   */
  private createEmptyHistoricalData(): HistoricalData {
    return {
      avgCostPerTask: {},
      avgCostPerModel: {},
      totalSpent: 0,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a cost estimator with default settings.
 */
export function createCostEstimator(
  historicalData?: HistoricalData,
  config?: Partial<CostEstimatorConfig>,
): CostEstimator {
  return new CostEstimator(historicalData, config);
}

/**
 * Quick estimate for a prompt.
 */
export function quickEstimate(
  prompt: string,
  taskType: TaskType = "general",
  model: string = SONNET,
): CostEstimate {
  const estimator = createCostEstimator();
  return estimator.estimate({ prompt, taskType }, model);
}
