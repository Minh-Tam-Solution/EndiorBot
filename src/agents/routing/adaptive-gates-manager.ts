/**
 * Adaptive Gates Manager
 *
 * Manages adaptive quality gate thresholds based on pattern performance.
 * Adjusts thresholds dynamically while respecting min/max bounds.
 *
 * @module agents/routing/adaptive-gates-manager
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
  AdaptiveQualityGateConfig,
  ThresholdAdjustment,
  QualityGateAdjustmentResult,
  LearningEngineConfig,
} from "./adaptive-types.js";
import { DEFAULT_LEARNING_CONFIG } from "./adaptive-types.js";
import type { PatternAnalytics } from "./pattern-analytics.js";
import { getPatternAnalytics } from "./pattern-analytics.js";

// ============================================================================
// Types
// ============================================================================

export interface AdaptiveGatesConfig {
  /** Learning engine config */
  learningConfig: LearningEngineConfig;
  /** Default base threshold per task type */
  baseThresholds: Record<TaskType, number>;
  /** Minimum threshold per task type */
  minThresholds: Record<TaskType, number>;
  /** Maximum threshold per task type */
  maxThresholds: Record<TaskType, number>;
}

export interface GateState {
  /** All gate configurations */
  gates: Record<TaskType, AdaptiveQualityGateConfig>;
  /** Last recalculation */
  lastRecalculation: string;
  /** Total adjustments made */
  totalAdjustments: number;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_BASE_THRESHOLDS: Record<TaskType, number> = {
  code_gen: 0.7,
  bug_fix: 0.8,
  architecture: 0.8,
  security: 0.9,
  research: 0.6,
  general: 0.5,
};

const DEFAULT_MIN_THRESHOLDS: Record<TaskType, number> = {
  code_gen: 0.5,
  bug_fix: 0.6,
  architecture: 0.6,
  security: 0.7,
  research: 0.4,
  general: 0.3,
};

const DEFAULT_MAX_THRESHOLDS: Record<TaskType, number> = {
  code_gen: 0.95,
  bug_fix: 0.95,
  architecture: 0.95,
  security: 0.99,
  research: 0.9,
  general: 0.8,
};

const DEFAULT_GATES_CONFIG: AdaptiveGatesConfig = {
  learningConfig: DEFAULT_LEARNING_CONFIG,
  baseThresholds: DEFAULT_BASE_THRESHOLDS,
  minThresholds: DEFAULT_MIN_THRESHOLDS,
  maxThresholds: DEFAULT_MAX_THRESHOLDS,
};

// ============================================================================
// Adaptive Gates Manager
// ============================================================================

/**
 * AdaptiveGatesManager - Manage quality gate thresholds adaptively.
 *
 * Features:
 * 1. Per-task-type threshold management
 * 2. Apply adjustments from pattern analytics
 * 3. Enforce min/max bounds
 * 4. Track adjustment history
 */
export class AdaptiveGatesManager {
  private config: AdaptiveGatesConfig;
  private gates: Map<TaskType, AdaptiveQualityGateConfig>;
  private analytics: PatternAnalytics;

  constructor(config?: Partial<AdaptiveGatesConfig>) {
    this.config = {
      ...DEFAULT_GATES_CONFIG,
      ...config,
    };

    this.gates = new Map();
    this.analytics = getPatternAnalytics();

    // Initialize gates for all task types
    this.initializeGates();
  }

  /**
   * Initialize gates with default values.
   */
  private initializeGates(): void {
    const taskTypes: TaskType[] = ["code_gen", "bug_fix", "architecture", "security", "research", "general"];

    for (const taskType of taskTypes) {
      const baseThreshold = this.config.baseThresholds[taskType];
      this.gates.set(taskType, {
        taskType,
        baseThreshold,
        currentThreshold: baseThreshold,
        minThreshold: this.config.minThresholds[taskType],
        maxThreshold: this.config.maxThresholds[taskType],
        adjustmentHistory: [],
        lastRecalculation: new Date().toISOString(),
      });
    }
  }

  /**
   * Get current threshold for a task type.
   */
  getThreshold(taskType: TaskType): number {
    const gate = this.gates.get(taskType);
    return gate?.currentThreshold ?? this.config.baseThresholds[taskType];
  }

  /**
   * Get gate configuration for a task type.
   */
  getGateConfig(taskType: TaskType): AdaptiveQualityGateConfig | undefined {
    return this.gates.get(taskType);
  }

  /**
   * Get all gate configurations.
   */
  getAllGates(): AdaptiveQualityGateConfig[] {
    return Array.from(this.gates.values());
  }

  /**
   * Apply a threshold adjustment.
   */
  applyAdjustment(
    taskType: TaskType,
    adjustment: number,
    reason: string,
    basedOnPatterns: string[] = []
  ): ThresholdAdjustment | null {
    const gate = this.gates.get(taskType);
    if (!gate) {
      return null;
    }

    const previousValue = gate.currentThreshold;
    let newValue = previousValue + adjustment;

    // Enforce bounds
    newValue = Math.max(gate.minThreshold, Math.min(gate.maxThreshold, newValue));

    // Respect max adjustment per cycle
    const maxAdjust = this.config.learningConfig.maxAdjustmentPerCycle;
    const actualAdjustment = Math.max(-maxAdjust, Math.min(maxAdjust, newValue - previousValue));
    newValue = previousValue + actualAdjustment;

    // Skip if no change
    if (Math.abs(newValue - previousValue) < 0.001) {
      return null;
    }

    // Create adjustment record
    const record: ThresholdAdjustment = {
      taskType,
      adjustment: actualAdjustment,
      reason,
      appliedAt: new Date().toISOString(),
      basedOnPatterns,
      previousValue,
      newValue,
    };

    // Update gate
    gate.currentThreshold = newValue;
    gate.adjustmentHistory.push(record);
    gate.lastRecalculation = record.appliedAt;

    // Keep only last 50 adjustments
    if (gate.adjustmentHistory.length > 50) {
      gate.adjustmentHistory = gate.adjustmentHistory.slice(-50);
    }

    return record;
  }

  /**
   * Run recalculation cycle based on pattern analytics.
   */
  async runRecalculationCycle(): Promise<QualityGateAdjustmentResult[]> {
    const recommendations = await this.analytics.generateAdjustmentRecommendations();
    const appliedResults: QualityGateAdjustmentResult[] = [];

    for (const rec of recommendations) {
      const gate = this.gates.get(rec.taskType);
      if (!gate) {
        continue;
      }

      const adjustment = this.applyAdjustment(
        rec.taskType,
        rec.adjustmentMagnitude,
        rec.reason,
        rec.affectedPatterns.map((p) => p.patternId)
      );

      if (adjustment) {
        appliedResults.push({
          ...rec,
          previousThreshold: adjustment.previousValue,
          newThreshold: adjustment.newValue,
        });
      }
    }

    return appliedResults;
  }

  /**
   * Get adjustment history for a task type.
   */
  getAdjustmentHistory(taskType: TaskType): ThresholdAdjustment[] {
    const gate = this.gates.get(taskType);
    return gate?.adjustmentHistory ?? [];
  }

  /**
   * Reset a gate to base threshold.
   */
  resetGate(taskType: TaskType): void {
    const gate = this.gates.get(taskType);
    if (gate) {
      gate.currentThreshold = gate.baseThreshold;
      gate.adjustmentHistory = [];
      gate.lastRecalculation = new Date().toISOString();
    }
  }

  /**
   * Reset all gates to base thresholds.
   */
  resetAllGates(): void {
    const taskTypes: TaskType[] = ["code_gen", "bug_fix", "architecture", "security", "research", "general"];
    for (const taskType of taskTypes) {
      this.resetGate(taskType);
    }
  }

  /**
   * Get current state snapshot.
   */
  getState(): GateState {
    const gates: Record<TaskType, AdaptiveQualityGateConfig> = {} as Record<
      TaskType,
      AdaptiveQualityGateConfig
    >;

    for (const [taskType, config] of this.gates) {
      gates[taskType] = { ...config };
    }

    const totalAdjustments = Array.from(this.gates.values()).reduce(
      (sum, gate) => sum + gate.adjustmentHistory.length,
      0
    );

    return {
      gates,
      lastRecalculation: new Date().toISOString(),
      totalAdjustments,
    };
  }

  /**
   * Load state from snapshot.
   */
  loadState(state: GateState): void {
    for (const [taskType, config] of Object.entries(state.gates)) {
      this.gates.set(taskType as TaskType, config);
    }
  }

  /**
   * Check if threshold is met for a given confidence score.
   */
  meetsThreshold(taskType: TaskType, confidence: number): boolean {
    const threshold = this.getThreshold(taskType);
    return confidence >= threshold;
  }

  /**
   * Get threshold gap (how much confidence needs to improve).
   */
  getThresholdGap(taskType: TaskType, confidence: number): number {
    const threshold = this.getThreshold(taskType);
    return Math.max(0, threshold - confidence);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an AdaptiveGatesManager instance.
 */
export function createAdaptiveGatesManager(
  config?: Partial<AdaptiveGatesConfig>
): AdaptiveGatesManager {
  return new AdaptiveGatesManager(config);
}

// Singleton instance
let globalGatesManager: AdaptiveGatesManager | undefined;

/**
 * Get the global AdaptiveGatesManager instance.
 */
export function getAdaptiveGatesManager(): AdaptiveGatesManager {
  if (!globalGatesManager) {
    globalGatesManager = new AdaptiveGatesManager();
  }
  return globalGatesManager;
}

/**
 * Reset the global AdaptiveGatesManager (for testing).
 */
export function resetAdaptiveGatesManager(): void {
  globalGatesManager = undefined;
}
