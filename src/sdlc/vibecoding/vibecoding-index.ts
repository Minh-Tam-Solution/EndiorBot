/**
 * Vibecoding Index
 *
 * Quality metric for code health assessment.
 * Based on SDLC Framework v6.4.0 Section 7 QA System.
 *
 * Zones:
 *   - Green:  0-30  - Ship with confidence
 *   - Yellow: 31-60 - Review recommended
 *   - Orange: 61-80 - Significant review required
 *   - Red:    81-100 - Block until fixed
 *
 * Signals:
 *   - Code complexity (cyclomatic)
 *   - Test coverage
 *   - Lint errors
 *   - Security issues
 *   - Documentation coverage
 *
 * @module sdlc/vibecoding/vibecoding-index
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.4 Implementation
 * @authority ADR-004 SDLC Gate Engine
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Vibecoding zone based on score.
 */
export type VibecodingZone = "green" | "yellow" | "orange" | "red";

/**
 * Individual signal measurement.
 */
export interface VibecodingSignal {
  name: string;
  value: number;
  weight: number;
  threshold: number;
  passed: boolean;
  description: string;
}

/**
 * Full Vibecoding Index result.
 */
export interface VibecodingResult {
  score: number;
  zone: VibecodingZone;
  signals: VibecodingSignal[];
  calculatedAt: string;
}

/**
 * Input metrics for Vibecoding calculation.
 */
export interface VibecodingMetrics {
  /**
   * Average cyclomatic complexity per function.
   */
  complexity?: number;

  /**
   * Test coverage percentage (0-100).
   */
  testCoverage?: number;

  /**
   * Number of lint errors.
   */
  lintErrors?: number;

  /**
   * Number of security issues.
   */
  securityIssues?: number;

  /**
   * Documentation coverage percentage (0-100).
   */
  docCoverage?: number;

  /**
   * Number of TODO/FIXME comments.
   */
  todoCount?: number;

  /**
   * Lines of code changed.
   */
  linesChanged?: number;

  /**
   * Number of files changed.
   */
  filesChanged?: number;
}

/**
 * Configuration for Vibecoding calculator.
 */
export interface VibecodingConfig {
  /**
   * Custom signal weights (default weights used if not provided).
   */
  weights?: Partial<Record<string, number>>;

  /**
   * Custom thresholds (default thresholds used if not provided).
   */
  thresholds?: Partial<Record<string, number>>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Zone thresholds.
 */
export const ZONE_THRESHOLDS = {
  green: 30,
  yellow: 60,
  orange: 80,
  red: 100,
} as const;

/**
 * Default signal weights (must sum to 100).
 */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  complexity: 20,
  testCoverage: 25,
  lintErrors: 15,
  securityIssues: 25,
  docCoverage: 10,
  todoCount: 5,
};

/**
 * Default thresholds for passing signals.
 */
export const DEFAULT_THRESHOLDS: Record<string, number> = {
  complexity: 10, // Max 10 avg complexity
  testCoverage: 80, // Min 80% coverage
  lintErrors: 0, // Zero lint errors
  securityIssues: 0, // Zero security issues
  docCoverage: 50, // Min 50% doc coverage
  todoCount: 10, // Max 10 TODOs
};

// ============================================================================
// Vibecoding Calculator Class
// ============================================================================

/**
 * Calculates Vibecoding Index from code metrics.
 *
 * The index is a 0-100 score where lower is better:
 * - 0-30: Green zone (ship with confidence)
 * - 31-60: Yellow zone (review recommended)
 * - 61-80: Orange zone (significant review required)
 * - 81-100: Red zone (block until fixed)
 */
export class VibecodingCalculator {
  private readonly weights: Map<string, number>;
  private readonly thresholds: Map<string, number>;

  constructor(config: VibecodingConfig = {}) {
    // Build weights map from defaults + config overrides
    this.weights = new Map(Object.entries(DEFAULT_WEIGHTS));
    if (config.weights) {
      for (const [key, value] of Object.entries(config.weights)) {
        if (value !== undefined) {
          this.weights.set(key, value);
        }
      }
    }

    // Build thresholds map from defaults + config overrides
    this.thresholds = new Map(Object.entries(DEFAULT_THRESHOLDS));
    if (config.thresholds) {
      for (const [key, value] of Object.entries(config.thresholds)) {
        if (value !== undefined) {
          this.thresholds.set(key, value);
        }
      }
    }
  }

  /**
   * Get weight for a signal (with fallback).
   */
  private getWeight(name: string): number {
    return this.weights.get(name) ?? 0;
  }

  /**
   * Get threshold for a signal (with fallback).
   */
  private getThreshold(name: string): number {
    return this.thresholds.get(name) ?? 0;
  }

  /**
   * Calculate Vibecoding Index from metrics.
   */
  calculate(metrics: VibecodingMetrics): VibecodingResult {
    const signals: VibecodingSignal[] = [];

    // Complexity signal (higher is worse)
    if (metrics.complexity !== undefined) {
      const threshold = this.getThreshold("complexity");
      const weight = this.getWeight("complexity");
      const passed = metrics.complexity <= threshold;
      signals.push({
        name: "complexity",
        value: metrics.complexity,
        weight,
        threshold,
        passed,
        description: `Cyclomatic complexity: ${metrics.complexity} (max: ${threshold})`,
      });
    }

    // Test coverage signal (higher is better, inverted)
    if (metrics.testCoverage !== undefined) {
      const threshold = this.getThreshold("testCoverage");
      const weight = this.getWeight("testCoverage");
      const passed = metrics.testCoverage >= threshold;
      signals.push({
        name: "testCoverage",
        value: metrics.testCoverage,
        weight,
        threshold,
        passed,
        description: `Test coverage: ${metrics.testCoverage}% (min: ${threshold}%)`,
      });
    }

    // Lint errors signal (lower is better)
    if (metrics.lintErrors !== undefined) {
      const threshold = this.getThreshold("lintErrors");
      const weight = this.getWeight("lintErrors");
      const passed = metrics.lintErrors <= threshold;
      signals.push({
        name: "lintErrors",
        value: metrics.lintErrors,
        weight,
        threshold,
        passed,
        description: `Lint errors: ${metrics.lintErrors} (max: ${threshold})`,
      });
    }

    // Security issues signal (lower is better)
    if (metrics.securityIssues !== undefined) {
      const threshold = this.getThreshold("securityIssues");
      const weight = this.getWeight("securityIssues");
      const passed = metrics.securityIssues <= threshold;
      signals.push({
        name: "securityIssues",
        value: metrics.securityIssues,
        weight,
        threshold,
        passed,
        description: `Security issues: ${metrics.securityIssues} (max: ${threshold})`,
      });
    }

    // Documentation coverage signal (higher is better)
    if (metrics.docCoverage !== undefined) {
      const threshold = this.getThreshold("docCoverage");
      const weight = this.getWeight("docCoverage");
      const passed = metrics.docCoverage >= threshold;
      signals.push({
        name: "docCoverage",
        value: metrics.docCoverage,
        weight,
        threshold,
        passed,
        description: `Doc coverage: ${metrics.docCoverage}% (min: ${threshold}%)`,
      });
    }

    // TODO-count signal (lower is better)
    if (metrics.todoCount !== undefined) {
      const threshold = this.getThreshold("todoCount");
      const weight = this.getWeight("todoCount");
      const passed = metrics.todoCount <= threshold;
      signals.push({
        name: "todoCount",
        value: metrics.todoCount,
        weight,
        threshold,
        passed,
        description: `TODO/FIXME count: ${metrics.todoCount} (max: ${threshold})`,
      });
    }

    // Calculate score from signals
    const score = this.calculateScore(signals);
    const zone = this.getZone(score);

    return {
      score,
      zone,
      signals,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate overall score from signals.
   */
  private calculateScore(signals: VibecodingSignal[]): number {
    if (signals.length === 0) {
      return 0;
    }

    let totalPenalty = 0;

    for (const signal of signals) {
      if (!signal.passed) {
        // Calculate penalty based on how far over threshold
        const ratio = this.calculatePenaltyRatio(signal);
        totalPenalty += signal.weight * ratio;
      }
    }

    // Clamp to 0-100
    return Math.min(100, Math.max(0, Math.round(totalPenalty)));
  }

  /**
   * Calculate penalty ratio for a failed signal.
   */
  private calculatePenaltyRatio(signal: VibecodingSignal): number {
    // For inverted signals (higher is better), calculate differently
    if (signal.name === "testCoverage" || signal.name === "docCoverage") {
      if (signal.threshold === 0) return 1;
      const deficit = signal.threshold - signal.value;
      return Math.min(1, deficit / signal.threshold);
    }

    // For normal signals (lower is better)
    if (signal.threshold === 0) {
      return signal.value > 0 ? 1 : 0;
    }

    const excess = signal.value - signal.threshold;
    return Math.min(1, excess / signal.threshold);
  }

  /**
   * Determine zone from score.
   */
  private getZone(score: number): VibecodingZone {
    if (score <= ZONE_THRESHOLDS.green) return "green";
    if (score <= ZONE_THRESHOLDS.yellow) return "yellow";
    if (score <= ZONE_THRESHOLDS.orange) return "orange";
    return "red";
  }

  /**
   * Get human-readable zone description.
   */
  static describeZone(zone: VibecodingZone): string {
    switch (zone) {
      case "green":
        return "Ship with confidence";
      case "yellow":
        return "Review recommended";
      case "orange":
        return "Significant review required";
      case "red":
        return "Block until fixed";
    }
  }

  /**
   * Check if score passes for gate.
   */
  static passesGate(score: number, maxScore: number = 30): boolean {
    return score <= maxScore;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalCalculator: VibecodingCalculator | undefined;

export function getVibecodingCalculator(
  config?: VibecodingConfig,
): VibecodingCalculator {
  if (!globalCalculator) {
    globalCalculator = new VibecodingCalculator(config);
  }
  return globalCalculator;
}

/**
 * Reset the global VibecodingCalculator instance.
 * Useful for testing or reconfiguration.
 */
export function resetVibecodingCalculator(): void {
  globalCalculator = undefined;
}
