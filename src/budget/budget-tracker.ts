/**
 * Budget Tracker Implementation
 *
 * Tracks costs across sessions, days, and tracks.
 * Enforces budget limits and triggers circuit breakers.
 *
 * Based on ADR-007 Autonomous Execution Budget specification.
 *
 * Per CTO guidance:
 * - Calls needsDailyReset() on every cost record (not just startup)
 * - Integrates with circuit breaker state machine
 */

import { OPUS, SONNET, HAIKU, MODEL_CAPABILITIES } from "../config/models.js";
import type {
  BudgetConfig,
  BudgetState,
  TokenUsageRecord,
  BudgetAction,
  CostEstimate,
  TaskContext,
  TaskType,
  TaskMetrics,
  ConfidenceLevel,
  ModelPricing,
  BudgetEvent,
} from "./types.js";
import type { CostState } from "../sessions/checkpoint/types.js";
import {
  DEFAULT_BUDGET_CONFIG,
  createInitialBudgetState,
  needsDailyReset,
  calculateBudgetPercentage,
  isAtWarningThreshold,
  createEmptyTaskMetrics,
} from "./types.js";
import {
  CircuitBreaker,
  NotificationRateLimiter,
} from "./circuit-breaker.js";
import { AlertService, type BudgetEventEmitter } from "./alert-service.js";
import { BudgetReporter } from "./reporter.js";

// Re-export types from reporter so existing consumers keep working
export type { BudgetScope, BudgetStatus } from "./reporter.js";

// ============================================================================
// Constants
// ============================================================================

/** Base token estimates by task type */
const BASE_OUTPUT_ESTIMATES: Record<TaskType, number> = {
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

/** Fallback pricing (Sonnet) for unknown models — resolved through SSOT */
const FALLBACK_PRICING: ModelPricing = {
  provider: "anthropic",
  model: SONNET,
  input_per_1k: MODEL_CAPABILITIES[SONNET]!.inputPer1M / 1000,
  output_per_1k: MODEL_CAPABILITIES[SONNET]!.outputPer1M / 1000,
  updatedAt: new Date(),
};

/** Default model pricing (per 1K tokens) — Anthropic resolved through SSOT */
const DEFAULT_PRICING: Record<string, ModelPricing> = {
  [OPUS]: {
    provider: "anthropic",
    model: OPUS,
    input_per_1k: MODEL_CAPABILITIES[OPUS]!.inputPer1M / 1000,
    output_per_1k: MODEL_CAPABILITIES[OPUS]!.outputPer1M / 1000,
    updatedAt: new Date(),
  },
  [SONNET]: FALLBACK_PRICING,
  [HAIKU]: {
    provider: "anthropic",
    model: HAIKU,
    input_per_1k: MODEL_CAPABILITIES[HAIKU]!.inputPer1M / 1000,
    output_per_1k: MODEL_CAPABILITIES[HAIKU]!.outputPer1M / 1000,
    updatedAt: new Date(),
  },
  "gpt-4-turbo": {
    provider: "openai",
    model: "gpt-4-turbo",
    input_per_1k: 0.01,
    output_per_1k: 0.03,
    updatedAt: new Date(),
  },
  "gpt-4o": {
    provider: "openai",
    model: "gpt-4o",
    input_per_1k: 0.005,
    output_per_1k: 0.015,
    updatedAt: new Date(),
  },
  "self-hosted/qwen3-coder": {
    provider: "self-hosted", // self-hosted Ollama server
    model: "qwen3-coder",
    input_per_1k: 0, // Free via self-hosted Ollama infrastructure
    output_per_1k: 0,
    updatedAt: new Date(),
  },
};

// ============================================================================
// Budget Tracker
// ============================================================================

/**
 * BudgetTracker - Main budget tracking and enforcement.
 *
 * Responsibilities:
 * - Track costs across sessions, days, and tracks
 * - Enforce budget limits (session, daily, track)
 * - Trigger circuit breakers when limits approached
 * - Integrate with provider cost data
 * - Persist budget state to checkpoint
 */
export class BudgetTracker {
  private state: BudgetState;
  private config: BudgetConfig;
  private sessionCircuitBreaker: CircuitBreaker;
  private dailyCircuitBreaker: CircuitBreaker;
  private taskCircuitBreaker: CircuitBreaker;
  private notificationRateLimiter: NotificationRateLimiter;
  private pricing: Map<string, ModelPricing>;
  private eventListeners: Array<(event: BudgetEvent) => void> = [];
  private taskMetrics: Map<string, TaskMetrics> = new Map();

  // Extracted sub-services
  private alertService: AlertService;
  private reporter: BudgetReporter;

  constructor(config: BudgetConfig = DEFAULT_BUDGET_CONFIG) {
    this.config = config;
    this.state = createInitialBudgetState(config);
    this.pricing = new Map(Object.entries(DEFAULT_PRICING));

    // Create shared notification rate limiter
    this.notificationRateLimiter = new NotificationRateLimiter(
      config.notification.rate_limit,
    );

    // Create circuit breakers with shared rate limiter
    this.sessionCircuitBreaker = new CircuitBreaker(
      config.circuit_breakers,
      undefined,
      this.notificationRateLimiter,
    );
    this.dailyCircuitBreaker = new CircuitBreaker(
      config.circuit_breakers,
      undefined,
      this.notificationRateLimiter,
    );
    this.taskCircuitBreaker = new CircuitBreaker(
      config.circuit_breakers,
      undefined,
      this.notificationRateLimiter,
    );

    // Build event emitter shim used by sub-services
    const emitter: BudgetEventEmitter = {
      emit: (event) => this.emitEvent(event),
    };

    // Initialize extracted sub-services
    this.alertService = new AlertService(
      config,
      this.sessionCircuitBreaker,
      this.dailyCircuitBreaker,
      emitter,
    );
    this.reporter = new BudgetReporter(
      this.sessionCircuitBreaker,
      this.dailyCircuitBreaker,
    );
  }

  // ==========================================================================
  // Core Tracking
  // ==========================================================================

  /**
   * Record token usage and update budget state.
   *
   * Per CTO guidance: Calls needsDailyReset() on every cost record.
   */
  async recordUsage(usage: TokenUsageRecord): Promise<BudgetAction> {
    // Check for daily reset FIRST (per CTO guidance)
    if (needsDailyReset(this.state)) {
      this.resetDaily();
    }

    // Calculate cost if not provided
    const cost =
      usage.cost > 0
        ? usage.cost
        : this.calculateCost(usage.model, usage.inputTokens, usage.outputTokens);

    // Update usage record with calculated cost
    const recordWithCost: TokenUsageRecord = { ...usage, cost };

    // Update session budget
    this.state.session.costSoFar += cost;

    // Update daily budget
    this.state.daily.costSoFar += cost;

    // Update track budget if applicable
    if (usage.trackId && this.state.tracks) {
      const track = this.state.tracks[usage.trackId];
      if (track) {
        track.costSoFar += cost;
      }
    }

    // Record in token usage history
    this.state.tokenUsage.push(recordWithCost);

    // Update historical data
    this.updateHistoricalData(recordWithCost);

    // Emit event
    const eventData: BudgetEvent["data"] = {
      cost,
      budgetType: "session",
      percentUsed: calculateBudgetPercentage(
        this.state.session.costSoFar,
        this.state.session.limit,
      ),
    };
    if (usage.taskId !== undefined) {
      eventData.sessionId = usage.taskId;
      eventData.taskId = usage.taskId;
    }
    this.emitEvent({ type: "cost_recorded", timestamp: new Date(), data: eventData });

    // Check limits and return action
    return this.alertService.evaluate(this.state);
  }

  /**
   * Estimate cost for a task before execution.
   */
  async estimateCost(
    context: TaskContext,
    model: string = SONNET,
  ): Promise<CostEstimate> {
    const inputTokens = this.estimateInputTokens(context);
    const taskType = context.taskType ?? "general";
    const outputTokens = await this.estimateOutputTokens(taskType, model);
    const pricing = this.pricing.get(model) ?? FALLBACK_PRICING;

    const estimatedCost =
      (inputTokens / 1000) * pricing.input_per_1k +
      (outputTokens / 1000) * pricing.output_per_1k;

    const historicalAvg = this.state.historical.avgCostPerTask[taskType];
    const confidence = this.calculateConfidence(estimatedCost, historicalAvg);
    const recommendation = this.generateRecommendation(taskType, estimatedCost, model);

    const estimate: CostEstimate = {
      estimated_cost: estimatedCost,
      estimated_tokens: { input: inputTokens, output: outputTokens },
      confidence: confidence.level,
      confidence_score: confidence.score,
      breakdown: { model_cost: estimatedCost, tool_cost: 0, api_overhead: 0 },
    };
    if (historicalAvg !== undefined) {
      estimate.historical_avg = historicalAvg;
    }
    if (recommendation !== undefined) {
      estimate.recommendation = recommendation;
    }
    return estimate;
  }

  // ==========================================================================
  // Limit Checking
  // ==========================================================================

  /**
   * Check if a request can proceed based on budget and circuit breakers.
   */
  async canProceed(estimatedCost: number = 0): Promise<boolean> {
    if (needsDailyReset(this.state)) {
      this.resetDaily();
    }

    if (!this.sessionCircuitBreaker.canProceed()) return false;
    if (!this.dailyCircuitBreaker.canProceed()) return false;

    const projectedSession = this.state.session.costSoFar + estimatedCost;
    const projectedDaily = this.state.daily.costSoFar + estimatedCost;

    if (projectedSession >= this.state.session.limit) return false;
    if (projectedDaily >= this.state.daily.limit) return false;

    return true;
  }

  /**
   * Get current budget status.
   */
  async getStatus() {
    if (needsDailyReset(this.state)) {
      this.resetDaily();
    }
    return this.reporter.buildStatus(this.state);
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Get current budget state.
   */
  getState(): BudgetState {
    return { ...this.state };
  }

  /**
   * Restore budget state (e.g., from checkpoint).
   */
  async restoreState(state: BudgetState): Promise<void> {
    this.state = { ...state };
    if (needsDailyReset(this.state)) {
      this.resetDaily();
    }
  }

  /**
   * Restore from checkpoint CostState.
   *
   * Per CTO Day 5 guidance:
   * - Session costs must carry over on resume, not reset to zero
   * - A session that spent $1.80 cannot spend another $2.00 after resume
   */
  restoreFromCheckpoint(costState: CostState): void {
    this.state.session.costSoFar = costState.sessionCostSoFar;

    if (costState.tokenUsage && costState.tokenUsage.length > 0) {
      for (const usage of costState.tokenUsage) {
        this.state.tokenUsage.push({
          timestamp: new Date(),
          model: usage.model,
          provider: this.getProviderForModel(usage.model),
          inputTokens: usage.input,
          outputTokens: usage.output,
          cost: usage.cost ?? 0,
        });
      }
    }

    this.emitEvent({
      type: "budget_restored",
      timestamp: new Date(),
      data: {
        cost: costState.sessionCostSoFar,
        budgetType: "session",
        percentUsed: calculateBudgetPercentage(
          this.state.session.costSoFar,
          this.state.session.limit,
        ),
      },
    });

    if (
      isAtWarningThreshold(
        this.state.session.costSoFar,
        this.state.session.limit,
        this.config.warning_threshold,
      )
    ) {
      this.emitEvent({
        type: "threshold_warning",
        timestamp: new Date(),
        data: {
          budgetType: "session",
          percentUsed: calculateBudgetPercentage(
            this.state.session.costSoFar,
            this.state.session.limit,
          ),
        },
      });
    }
  }

  /**
   * Export current state to checkpoint CostState format.
   */
  toCostState(): CostState {
    const costState: CostState = {
      sessionCostSoFar: this.state.session.costSoFar,
      tokenUsage: this.state.tokenUsage.map((usage) => ({
        model: usage.model,
        input: usage.inputTokens,
        output: usage.outputTokens,
        cost: usage.cost,
      })),
    };
    return costState;
  }

  /**
   * Get provider for a model.
   */
  private getProviderForModel(model: string): string {
    const pricing = this.pricing.get(model);
    return pricing?.provider ?? "unknown";
  }

  /**
   * Get budget config.
   */
  getConfig(): BudgetConfig {
    return { ...this.config };
  }

  /**
   * Update budget config.
   */
  updateConfig(config: Partial<BudgetConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.per_session_limit !== undefined) {
      this.state.session.limit = config.per_session_limit;
    }
    if (config.daily_limit !== undefined) {
      this.state.daily.limit = config.daily_limit;
    }
  }

  // ==========================================================================
  // Task Metrics
  // ==========================================================================

  /**
   * Start tracking a task.
   */
  startTask(taskId: string): void {
    this.taskMetrics.set(taskId, createEmptyTaskMetrics());
  }

  /**
   * Record task retry.
   */
  recordTaskRetry(taskId: string): void {
    const metrics = this.taskMetrics.get(taskId);
    if (metrics) {
      metrics.retryCount++;
    }
  }

  /**
   * Record task cost.
   */
  recordTaskCost(taskId: string, cost: number): void {
    const metrics = this.taskMetrics.get(taskId);
    if (metrics) {
      metrics.costSoFar += cost;
    }
  }

  /**
   * Get task metrics.
   */
  getTaskMetrics(taskId: string): TaskMetrics | undefined {
    const metrics = this.taskMetrics.get(taskId);
    if (metrics) {
      return { ...metrics, durationMs: Date.now() - metrics.startTime.getTime() };
    }
    return undefined;
  }

  /**
   * Evaluate task against circuit breaker.
   */
  evaluateTask(taskId: string): { tripped: boolean; reason?: string } {
    const metrics = this.getTaskMetrics(taskId);
    if (!metrics) {
      return { tripped: false };
    }

    const result = this.taskCircuitBreaker.evaluate(metrics);
    if (result.status === "open" && result.reason) {
      return { tripped: true, reason: result.reason };
    }
    return { tripped: false };
  }

  /**
   * End task tracking.
   */
  endTask(taskId: string, success: boolean): void {
    if (success) {
      this.taskCircuitBreaker.recordSuccess();
    } else {
      this.taskCircuitBreaker.recordFailure();
    }
    this.taskMetrics.delete(taskId);
  }

  // ==========================================================================
  // Model Switching
  // ==========================================================================

  /**
   * Get fallback model when budget is low.
   */
  getFallbackModel(): string | undefined {
    const action = this.config.on_limit_reached;
    if (action.action === "switch_to_self_hosted" && action.fallback_model) {
      return action.fallback_model;
    }
    return undefined;
  }

  /**
   * Check if should switch to fallback model.
   */
  shouldSwitchToFallback(): boolean {
    const sessionPercent = calculateBudgetPercentage(
      this.state.session.costSoFar,
      this.state.session.limit,
    );
    const dailyPercent = calculateBudgetPercentage(
      this.state.daily.costSoFar,
      this.state.daily.limit,
    );
    return sessionPercent >= 80 || dailyPercent >= 80;
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  /**
   * Check if notification can be sent.
   */
  canNotify(): boolean {
    return this.notificationRateLimiter.canSend();
  }

  /**
   * Record notification sent.
   */
  recordNotification(): void {
    this.notificationRateLimiter.recordSent();
  }

  /**
   * Get notification rate limiter.
   */
  getRateLimiter(): NotificationRateLimiter {
    return this.notificationRateLimiter;
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  /**
   * Subscribe to budget events.
   */
  onEvent(listener: (event: BudgetEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index >= 0) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  // ==========================================================================
  // Circuit Breakers
  // ==========================================================================

  /** Get session circuit breaker. */
  getSessionCircuitBreaker(): CircuitBreaker {
    return this.sessionCircuitBreaker;
  }

  /** Get daily circuit breaker. */
  getDailyCircuitBreaker(): CircuitBreaker {
    return this.dailyCircuitBreaker;
  }

  /** Get task circuit breaker. */
  getTaskCircuitBreaker(): CircuitBreaker {
    return this.taskCircuitBreaker;
  }

  /** Reset all circuit breakers. */
  resetCircuitBreakers(): void {
    this.sessionCircuitBreaker.reset();
    this.dailyCircuitBreaker.reset();
    this.taskCircuitBreaker.reset();
  }

  // ==========================================================================
  // Pricing
  // ==========================================================================

  /** Set model pricing. */
  setPricing(model: string, pricing: ModelPricing): void {
    this.pricing.set(model, pricing);
  }

  /** Get model pricing. */
  getPricing(model: string): ModelPricing | undefined {
    return this.pricing.get(model);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.pricing.get(model);
    if (!pricing) {
      return (
        (inputTokens / 1000) * FALLBACK_PRICING.input_per_1k +
        (outputTokens / 1000) * FALLBACK_PRICING.output_per_1k
      );
    }
    return (
      (inputTokens / 1000) * pricing.input_per_1k +
      (outputTokens / 1000) * pricing.output_per_1k
    );
  }

  private estimateInputTokens(context: TaskContext): number {
    let tokens = 500; // Base system prompt
    tokens += this.countTokens(context.prompt);
    for (const file of context.files ?? []) {
      tokens += this.countTokens(file.content);
    }
    tokens += this.countTokens(context.conversationHistory ?? "");
    return Math.ceil(tokens * 1.1);
  }

  private async estimateOutputTokens(taskType: TaskType, model: string): Promise<number> {
    const base = BASE_OUTPUT_ESTIMATES[taskType] ?? 1000;
    const historicalAvg = this.state.historical.avgCostPerModel[model];
    if (historicalAvg !== undefined) {
      return Math.ceil((base + historicalAvg) / 2);
    }
    return base;
  }

  private countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private calculateConfidence(
    estimated: number,
    historical?: number,
  ): { level: ConfidenceLevel; score: number } {
    if (historical === undefined) {
      return { level: "low", score: 0.3 };
    }
    const variance = Math.abs(estimated - historical) / historical;
    if (variance < 0.2) return { level: "high", score: 0.9 };
    if (variance < 0.5) return { level: "medium", score: 0.7 };
    return { level: "low", score: 0.4 };
  }

  private generateRecommendation(
    taskType: TaskType,
    cost: number,
    model: string,
  ): string | undefined {
    if (cost > 0.1 && model.includes("opus")) {
      return `Consider using Sonnet for this task (potentially 80% cheaper)`;
    }
    if (taskType === "documentation" || taskType === "general") {
      return "Consider using Self-Hosted Ollama (free) for this simple task";
    }
    return undefined;
  }

  private updateHistoricalData(usage: TokenUsageRecord): void {
    const taskType = usage.taskType ?? "general";
    const currentAvg = this.state.historical.avgCostPerTask[taskType] ?? usage.cost;
    this.state.historical.avgCostPerTask[taskType] = (currentAvg + usage.cost) / 2;

    const modelAvg = this.state.historical.avgCostPerModel[usage.model] ?? usage.cost;
    this.state.historical.avgCostPerModel[usage.model] = (modelAvg + usage.cost) / 2;

    this.state.historical.totalSpent += usage.cost;
  }

  private resetDaily(): void {
    const now = new Date();
    const isoStr = now.toISOString();
    const todayStr = isoStr.substring(0, 10);
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);

    this.state.daily.costSoFar = 0;
    this.state.daily.date = todayStr;
    this.state.daily.resetAt = midnight;

    this.dailyCircuitBreaker.reset();
    this.emitEvent({ type: "daily_reset", timestamp: now, data: {} });
  }

  private emitEvent(event: BudgetEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a budget tracker with default config.
 */
export function createBudgetTracker(config?: Partial<BudgetConfig>): BudgetTracker {
  const fullConfig: BudgetConfig = { ...DEFAULT_BUDGET_CONFIG, ...config };
  return new BudgetTracker(fullConfig);
}

/**
 * Get budget status from tracker.
 */
export async function getBudgetStatus(tracker: BudgetTracker) {
  return tracker.getStatus();
}

/**
 * Estimate cost using tracker.
 */
export async function estimateCost(
  tracker: BudgetTracker,
  context: TaskContext,
  model?: string,
): Promise<CostEstimate> {
  return tracker.estimateCost(context, model);
}
