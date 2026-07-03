/**
 * Pattern Analytics
 *
 * Aggregates pattern performance data for adaptive quality tuning.
 * Analyzes trends, identifies problematic patterns, and generates
 * threshold adjustment recommendations.
 *
 * @module agents/routing/pattern-analytics
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 42 Adaptive Quality Tuning
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 4 - Quality Assurance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { TaskType } from "../types.js";
import type {
  PatternPerformanceMetrics,
  PatternTrend,
  ProblematicPatternConfig,
  QualityGateAdjustmentResult,
} from "./adaptive-types.js";
import {
  DEFAULT_PROBLEMATIC_CONFIG,
} from "./adaptive-types.js";
import {
  getPatternManager,
  type ErrorPattern,
} from "../fix-logging/index.js";

// ============================================================================
// Types
// ============================================================================

export interface PatternAnalyticsConfig {
  /** Lookback days for trend analysis */
  lookbackDays: number;
  /** Minimum samples for trend calculation */
  minSamplesForTrend: number;
  /** Problematic pattern thresholds */
  problematicConfig: ProblematicPatternConfig;
}

export interface TaskTypeAnalytics {
  /** Task type */
  taskType: TaskType;
  /** Overall success rate */
  successRate: number;
  /** Total applications */
  totalApplications: number;
  /** Escalation rate */
  escalationRate: number;
  /** Pattern count */
  patternCount: number;
  /** Trend */
  trend: PatternTrend;
}

export interface AnalyticsSummary {
  /** Total patterns analyzed */
  totalPatterns: number;
  /** Average success rate */
  avgSuccessRate: number;
  /** Total applications */
  totalApplications: number;
  /** Problematic pattern count */
  problematicCount: number;
  /** By task type */
  byTaskType: Record<TaskType, TaskTypeAnalytics>;
  /** Generated at */
  generatedAt: string;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_ANALYTICS_CONFIG: PatternAnalyticsConfig = {
  lookbackDays: 7,
  minSamplesForTrend: 10,
  problematicConfig: DEFAULT_PROBLEMATIC_CONFIG,
};

// ============================================================================
// Pattern Analytics
// ============================================================================

/**
 * PatternAnalytics - Analyze pattern performance for adaptive tuning.
 *
 * Features:
 * 1. Aggregate metrics from PatternManager
 * 2. Detect performance trends
 * 3. Identify problematic patterns
 * 4. Generate threshold recommendations
 */
export class PatternAnalytics {
  private config: PatternAnalyticsConfig;

  constructor(config?: Partial<PatternAnalyticsConfig>) {
    this.config = {
      ...DEFAULT_ANALYTICS_CONFIG,
      ...config,
    };
  }

  /**
   * Get performance metrics for all patterns.
   */
  async getAllPatternMetrics(): Promise<PatternPerformanceMetrics[]> {
    const manager = await getPatternManager();
    const patterns = await manager.getAllPatterns();

    return patterns.map((p) => this.patternToMetrics(p));
  }

  /**
   * Get performance metrics for patterns by category.
   */
  async getPatternMetricsByCategory(
    category: string
  ): Promise<PatternPerformanceMetrics[]> {
    const manager = await getPatternManager();
    const patterns = await manager.query({ category: category as "BUILD" | "LINT" | "TYPE" | "TEST" });

    return patterns.map((p) => this.patternToMetrics(p));
  }

  /**
   * Get problematic patterns (low success, high usage).
   */
  async getProblematicPatterns(): Promise<PatternPerformanceMetrics[]> {
    const allMetrics = await this.getAllPatternMetrics();
    const { minSuccessRate, minAppliedCount, maxEscalationRate } =
      this.config.problematicConfig;

    return allMetrics.filter(
      (m) =>
        m.appliedCount >= minAppliedCount &&
        (m.successRate < minSuccessRate || m.escalationRate > maxEscalationRate)
    );
  }

  /**
   * Get top performing patterns.
   */
  async getTopPatterns(limit = 10): Promise<PatternPerformanceMetrics[]> {
    const allMetrics = await this.getAllPatternMetrics();

    return allMetrics
      .filter((m) => m.appliedCount >= this.config.minSamplesForTrend)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit);
  }

  /**
   * Get analytics by task type.
   */
  async getTaskTypeAnalytics(): Promise<Record<TaskType, TaskTypeAnalytics>> {
    const allMetrics = await this.getAllPatternMetrics();

    const taskTypes: TaskType[] = ["code_gen", "bug_fix", "architecture", "security", "research", "general"];
    const result: Record<TaskType, TaskTypeAnalytics> = {} as Record<TaskType, TaskTypeAnalytics>;

    for (const taskType of taskTypes) {
      const categoryPatterns = allMetrics.filter((m) =>
        this.mapCategoryToTaskType(m.category) === taskType
      );

      const totalApps = categoryPatterns.reduce((sum, m) => sum + m.appliedCount, 0);
      const weightedSuccess = categoryPatterns.reduce(
        (sum, m) => sum + m.successRate * m.appliedCount,
        0
      );
      const weightedEscalation = categoryPatterns.reduce(
        (sum, m) => sum + m.escalationRate * m.appliedCount,
        0
      );

      result[taskType] = {
        taskType,
        successRate: totalApps > 0 ? weightedSuccess / totalApps : 0,
        totalApplications: totalApps,
        escalationRate: totalApps > 0 ? weightedEscalation / totalApps : 0,
        patternCount: categoryPatterns.length,
        trend: this.calculateOverallTrend(categoryPatterns),
      };
    }

    return result;
  }

  /**
   * Get full analytics summary.
   */
  async getSummary(): Promise<AnalyticsSummary> {
    const allMetrics = await this.getAllPatternMetrics();
    const problematic = await this.getProblematicPatterns();
    const byTaskType = await this.getTaskTypeAnalytics();

    const totalApps = allMetrics.reduce((sum, m) => sum + m.appliedCount, 0);
    const weightedSuccess = allMetrics.reduce(
      (sum, m) => sum + m.successRate * m.appliedCount,
      0
    );

    return {
      totalPatterns: allMetrics.length,
      avgSuccessRate: totalApps > 0 ? weightedSuccess / totalApps : 0,
      totalApplications: totalApps,
      problematicCount: problematic.length,
      byTaskType,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate threshold adjustment recommendations.
   */
  async generateAdjustmentRecommendations(): Promise<QualityGateAdjustmentResult[]> {
    const byTaskType = await this.getTaskTypeAnalytics();
    const problematicPatterns = await this.getProblematicPatterns();
    const recommendations: QualityGateAdjustmentResult[] = [];

    for (const [taskType, analytics] of Object.entries(byTaskType)) {
      const relevantProblematic = problematicPatterns.filter(
        (p) => this.mapCategoryToTaskType(p.category) === taskType
      );

      // Skip if not enough data
      if (analytics.totalApplications < this.config.minSamplesForTrend) {
        continue;
      }

      let recommendation: "upgrade" | "downgrade" | "no_change" = "no_change";
      let adjustmentMagnitude = 0;
      let reason = "";

      // High success rate + declining problematic patterns → can lower threshold
      if (analytics.successRate >= 0.8 && analytics.trend === "improving") {
        recommendation = "downgrade";
        adjustmentMagnitude = -0.05;
        reason = "High success rate with improving trend allows lower threshold";
      }
      // Low success rate or many problematic patterns → raise threshold
      else if (
        analytics.successRate < 0.5 ||
        relevantProblematic.length >= 3 ||
        analytics.trend === "declining"
      ) {
        recommendation = "upgrade";
        adjustmentMagnitude = 0.1;
        reason = `Low success rate (${(analytics.successRate * 100).toFixed(0)}%) or declining trend requires higher threshold`;
      }

      if (recommendation !== "no_change") {
        recommendations.push({
          taskType: taskType as TaskType,
          newThreshold: 0, // To be calculated by AdaptiveGatesManager
          previousThreshold: 0,
          adjustmentMagnitude,
          affectedPatterns: relevantProblematic,
          recommendation,
          reason,
        });
      }
    }

    return recommendations;
  }

  /**
   * Convert ErrorPattern to PatternPerformanceMetrics.
   */
  private patternToMetrics(pattern: ErrorPattern): PatternPerformanceMetrics {
    const escalationRate =
      pattern.metadata.appliedCount > 0
        ? pattern.metadata.escalationCount / pattern.metadata.appliedCount
        : 0;

    return {
      patternId: pattern.id,
      successRate: pattern.metadata.successRate,
      appliedCount: pattern.metadata.appliedCount,
      escalationRate,
      avgDurationMs: pattern.metadata.avgDurationMs,
      trend: this.detectTrend(pattern),
      category: pattern.category,
      errorCode: pattern.errorCode,
    };
  }

  /**
   * Detect trend for a single pattern.
   * Note: This is a simplified implementation. A full implementation
   * would track historical data points.
   */
  private detectTrend(pattern: ErrorPattern): PatternTrend {
    // Simple heuristic based on success rate
    if (pattern.metadata.appliedCount < this.config.minSamplesForTrend) {
      return "stable";
    }

    // In a full implementation, we'd compare with historical data
    // For now, use success rate as proxy
    if (pattern.metadata.successRate >= 0.8) {
      return "improving";
    } else if (pattern.metadata.successRate < 0.4) {
      return "declining";
    }

    return "stable";
  }

  /**
   * Calculate overall trend from multiple patterns.
   */
  private calculateOverallTrend(patterns: PatternPerformanceMetrics[]): PatternTrend {
    if (patterns.length === 0) {
      return "stable";
    }

    const improving = patterns.filter((p) => p.trend === "improving").length;
    const declining = patterns.filter((p) => p.trend === "declining").length;

    if (improving > declining * 2) {
      return "improving";
    } else if (declining > improving * 2) {
      return "declining";
    }

    return "stable";
  }

  /**
   * Map error category to task type.
   */
  private mapCategoryToTaskType(category: string): TaskType {
    const mapping: Record<string, TaskType> = {
      BUILD: "code_gen",
      LINT: "code_gen",
      TYPE: "code_gen",
      TEST: "bug_fix",
    };

    return mapping[category] ?? "code_gen";
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a PatternAnalytics instance.
 */
export function createPatternAnalytics(
  config?: Partial<PatternAnalyticsConfig>
): PatternAnalytics {
  return new PatternAnalytics(config);
}

// Singleton instance
let globalAnalytics: PatternAnalytics | undefined;

/**
 * Get the global PatternAnalytics instance.
 */
export function getPatternAnalytics(): PatternAnalytics {
  if (!globalAnalytics) {
    globalAnalytics = new PatternAnalytics();
  }
  return globalAnalytics;
}

/**
 * Reset the global PatternAnalytics (for testing).
 */
export function resetPatternAnalytics(): void {
  globalAnalytics = undefined;
}
