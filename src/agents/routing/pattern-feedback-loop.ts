/**
 * Pattern Feedback Loop
 *
 * Orchestrates the learning cycle between pattern performance,
 * analytics, and threshold adjustments.
 *
 * @module agents/routing/pattern-feedback-loop
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 42 Adaptive Quality Tuning
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 4 - Quality Assurance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { ProviderId } from "./types.js";
import type {
  PatternModelOutcome,
  PatternModelAffinity,
  ConsultationDecision,
  LearningSummary,
  LearningEngineConfig,
} from "./adaptive-types.js";
import { DEFAULT_LEARNING_CONFIG } from "./adaptive-types.js";
import type { PatternAnalytics } from "./pattern-analytics.js";
import { getPatternAnalytics } from "./pattern-analytics.js";
import type { AdaptiveGatesManager } from "./adaptive-gates-manager.js";
import { getAdaptiveGatesManager } from "./adaptive-gates-manager.js";
import { getPatternManager } from "../fix-logging/index.js";

// ============================================================================
// Types
// ============================================================================

export interface FeedbackLoopConfig {
  /** Learning engine configuration */
  learningConfig: LearningEngineConfig;
  /** Enable automatic learning cycles */
  autoLearn: boolean;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_FEEDBACK_CONFIG: FeedbackLoopConfig = {
  learningConfig: DEFAULT_LEARNING_CONFIG,
  autoLearn: true,
};

// ============================================================================
// Pattern Feedback Loop
// ============================================================================

/**
 * PatternFeedbackLoop - Orchestrate learning from pattern outcomes.
 *
 * Features:
 * 1. Record pattern execution outcomes
 * 2. Track pattern-model affinity
 * 3. Trigger learning cycles
 * 4. Generate consultation decisions
 */
export class PatternFeedbackLoop {
  private config: FeedbackLoopConfig;
  private analytics: PatternAnalytics;
  private gatesManager: AdaptiveGatesManager;
  private outcomes: PatternModelOutcome[] = [];
  private affinities: Map<string, PatternModelAffinity> = new Map();
  private cycleSummaries: LearningSummary[] = [];

  constructor(config?: Partial<FeedbackLoopConfig>) {
    this.config = {
      ...DEFAULT_FEEDBACK_CONFIG,
      ...config,
    };

    this.analytics = getPatternAnalytics();
    this.gatesManager = getAdaptiveGatesManager();
  }

  /**
   * Record a pattern execution outcome.
   */
  async recordOutcome(outcome: PatternModelOutcome): Promise<void> {
    // Store outcome
    this.outcomes.push(outcome);

    // Keep only recent outcomes (based on lookback days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.learningConfig.lookbackDays);
    this.outcomes = this.outcomes.filter(
      (o) => new Date(o.timestamp) >= cutoff
    );

    // Update pattern manager metadata
    const manager = await getPatternManager();
    await manager.updateMetadata(
      outcome.patternId,
      outcome.success,
      outcome.durationMs
    );

    // Update pattern-model affinity
    this.updateAffinity(outcome);
  }

  /**
   * Update pattern-model affinity based on outcome.
   */
  private updateAffinity(outcome: PatternModelOutcome): void {
    const key = `${outcome.patternId}:${outcome.modelUsed.providerId}:${outcome.modelUsed.modelId}`;

    const existing = this.affinities.get(key);

    if (existing) {
      // Update existing affinity
      const newSampleCount = existing.sampleCount + 1;
      const newSuccessCount = existing.successRate * existing.sampleCount + (outcome.success ? 1 : 0);
      const newSuccessRate = newSuccessCount / newSampleCount;
      const newAvgDuration =
        (existing.avgDurationMs * existing.sampleCount + outcome.durationMs) / newSampleCount;

      this.affinities.set(key, {
        ...existing,
        sampleCount: newSampleCount,
        successRate: newSuccessRate,
        avgDurationMs: newAvgDuration,
        affinity: this.calculateAffinity(newSuccessRate, newAvgDuration),
      });
    } else {
      // Create new affinity
      this.affinities.set(key, {
        patternId: outcome.patternId,
        providerId: outcome.modelUsed.providerId,
        modelId: outcome.modelUsed.modelId,
        sampleCount: 1,
        successRate: outcome.success ? 1 : 0,
        avgDurationMs: outcome.durationMs,
        affinity: outcome.success ? 0.7 : 0.3,
      });
    }
  }

  /**
   * Calculate affinity score from success rate and duration.
   */
  private calculateAffinity(successRate: number, avgDurationMs: number): number {
    // Affinity = 0.7 * successRate + 0.3 * (1 - normalized_duration)
    // Normalize duration: 0-30000ms maps to 0-1
    const normalizedDuration = Math.min(avgDurationMs / 30000, 1);
    return 0.7 * successRate + 0.3 * (1 - normalizedDuration);
  }

  /**
   * Get best model for a pattern based on affinity.
   */
  getBestModelForPattern(patternId: string): PatternModelAffinity | null {
    const affinities = Array.from(this.affinities.values()).filter(
      (a) => a.patternId === patternId && a.sampleCount >= 3
    );

    if (affinities.length === 0) {
      return null;
    }

    return affinities.sort((a, b) => b.affinity - a.affinity)[0] ?? null;
  }

  /**
   * Decide whether to consult additional models for a pattern.
   */
  async shouldConsult(patternId: string): Promise<ConsultationDecision> {
    const manager = await getPatternManager();
    const pattern = await manager.getPattern(patternId);

    if (!pattern) {
      return {
        shouldConsult: false,
        reason: "Pattern not found",
        estimatedROI: 0,
      };
    }

    const successRate = pattern.metadata.successRate;
    const appliedCount = pattern.metadata.appliedCount;
    const threshold = this.config.learningConfig.consultationThreshold;

    // Consult if:
    // 1. Low success rate + enough samples
    // 2. Consultation routing is enabled
    if (
      this.config.learningConfig.enableConsultationRouting &&
      appliedCount >= this.config.learningConfig.minSamplesForAdjustment &&
      successRate < threshold
    ) {
      // Estimate ROI based on improvement potential
      const potentialImprovement = threshold - successRate;
      const estimatedROI = potentialImprovement * appliedCount;

      return {
        shouldConsult: true,
        reason: `Success rate ${(successRate * 100).toFixed(0)}% below threshold ${(threshold * 100).toFixed(0)}%`,
        estimatedROI,
        recommendedModels: this.getRecommendedModels(patternId),
      };
    }

    return {
      shouldConsult: false,
      reason: "Pattern performing adequately",
      estimatedROI: 0,
    };
  }

  /**
   * Get recommended models for consultation based on affinity history.
   */
  private getRecommendedModels(patternId: string): ProviderId[] {
    const affinities = Array.from(this.affinities.values())
      .filter((a) => a.patternId === patternId)
      .sort((a, b) => b.affinity - a.affinity);

    // Return top 2 providers
    const providers = new Set<ProviderId>();
    for (const aff of affinities) {
      providers.add(aff.providerId);
      if (providers.size >= 2) break;
    }

    // Default to common providers if no history
    if (providers.size === 0) {
      return ["anthropic", "openai"];
    }

    return Array.from(providers);
  }

  /**
   * Run a learning cycle.
   */
  async runLearningCycle(): Promise<LearningSummary> {
    const cycleId = `cycle-${Date.now()}`;
    const startedAt = new Date().toISOString();

    const summary: LearningSummary = {
      cycleId,
      startedAt,
      patternsAnalyzed: 0,
      thresholdsAdjusted: 0,
      flaggedForConsultation: 0,
      adjustments: [],
      status: "running",
    };

    try {
      // Get pattern analytics
      const analyticsSummary = await this.analytics.getSummary();
      summary.patternsAnalyzed = analyticsSummary.totalPatterns;

      // Run recalculation cycle
      const adjustments = await this.gatesManager.runRecalculationCycle();
      summary.adjustments = adjustments;
      summary.thresholdsAdjusted = adjustments.length;

      // Check patterns for consultation
      const problematic = await this.analytics.getProblematicPatterns();
      for (const pattern of problematic) {
        const decision = await this.shouldConsult(pattern.patternId);
        if (decision.shouldConsult) {
          summary.flaggedForConsultation++;
        }
      }

      summary.completedAt = new Date().toISOString();
      summary.status = "completed";

      // Store summary
      this.cycleSummaries.push(summary);

      // Keep only last 100 summaries
      if (this.cycleSummaries.length > 100) {
        this.cycleSummaries = this.cycleSummaries.slice(-100);
      }

      return summary;
    } catch (error) {
      summary.status = "failed";
      summary.error = error instanceof Error ? error.message : String(error);
      return summary;
    }
  }

  /**
   * Get recent cycle summaries.
   */
  getCycleSummaries(limit = 10): LearningSummary[] {
    return this.cycleSummaries.slice(-limit);
  }

  /**
   * Get last cycle summary.
   */
  getLastCycle(): LearningSummary | null {
    return this.cycleSummaries.length > 0
      ? this.cycleSummaries[this.cycleSummaries.length - 1]!
      : null;
  }

  /**
   * Get all pattern-model affinities.
   */
  getAllAffinities(): PatternModelAffinity[] {
    return Array.from(this.affinities.values());
  }

  /**
   * Get affinities for a specific pattern.
   */
  getPatternAffinities(patternId: string): PatternModelAffinity[] {
    return Array.from(this.affinities.values()).filter(
      (a) => a.patternId === patternId
    );
  }

  /**
   * Clear all outcomes and affinities (for testing).
   */
  clear(): void {
    this.outcomes = [];
    this.affinities.clear();
    this.cycleSummaries = [];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a PatternFeedbackLoop instance.
 */
export function createPatternFeedbackLoop(
  config?: Partial<FeedbackLoopConfig>
): PatternFeedbackLoop {
  return new PatternFeedbackLoop(config);
}

// Singleton instance
let globalFeedbackLoop: PatternFeedbackLoop | undefined;

/**
 * Get the global PatternFeedbackLoop instance.
 */
export function getPatternFeedbackLoop(): PatternFeedbackLoop {
  if (!globalFeedbackLoop) {
    globalFeedbackLoop = new PatternFeedbackLoop();
  }
  return globalFeedbackLoop;
}

/**
 * Reset the global PatternFeedbackLoop (for testing).
 */
export function resetPatternFeedbackLoop(): void {
  globalFeedbackLoop = undefined;
}
