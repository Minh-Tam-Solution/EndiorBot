/**
 * AER Calculator
 *
 * Calculates Agent Effectiveness Rating metrics from session logs.
 *
 * @module metrics/aer-calculator
 * @version 1.0.0
 * @date 2026-03-02
 * @status ACTIVE - Sprint 72
 * @authority Master Plan v4.3, Sprint 72 T12.1
 * @sprint 72
 */

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createLogger, type Logger } from "../logging/index.js";
import {
  type AERMetrics,
  type AEREventLogEntry,
  type AERRetrievalLogEntry,
  type AERCalculatorConfig,
  type AERResult,
  type AERTargets,
  type ModelUsageBreakdown,
  DEFAULT_AER_CONFIG,
  DEFAULT_AER_TARGETS,
  createEmptyMetrics,
  calculateModelCost,
  getModelTier,
  checkAERPass,
  isAERPassing,
} from "./types.js";

// ============================================================================
// AER Calculator
// ============================================================================

/**
 * AER Calculator.
 *
 * Calculates Agent Effectiveness Rating metrics from:
 * - events.jsonl (task lifecycle, model calls, escalations)
 * - retrieval-log.jsonl (search evidence, tool usage)
 *
 * @example
 * ```typescript
 * const calculator = new AERCalculator({ eventsDir: '.endiorbot/events' });
 *
 * // Calculate metrics for a session
 * const metrics = await calculator.calculate('session-abc123');
 *
 * // Evaluate against targets
 * const result = await calculator.evaluate('session-abc123');
 * console.log(result.passed); // true/false
 * ```
 */
export class AERCalculator {
  private readonly log: Logger;
  private readonly config: AERCalculatorConfig;

  constructor(config: Partial<AERCalculatorConfig> = {}) {
    this.log = createLogger("AERCalculator");
    this.config = { ...DEFAULT_AER_CONFIG, ...config };
  }

  // ==========================================================================
  // Main API
  // ==========================================================================

  /**
   * Calculate AER metrics for a session.
   *
   * @param sessionId - Session ID to calculate metrics for
   * @returns AER metrics
   */
  async calculate(sessionId: string): Promise<AERMetrics> {
    // Parse logs
    const eventLog = await this.parseEventLog(sessionId);
    const retrievalLog = await this.parseRetrievalLog(sessionId);

    if (eventLog.length === 0) {
      this.log.debug("No events found for session", { sessionId });
      return createEmptyMetrics();
    }

    // Calculate task metrics
    const taskMetrics = this.calculateTaskMetrics(eventLog);

    // Calculate recovery metrics
    const recoveryMetrics = this.calculateRecoveryMetrics(eventLog);

    // Calculate tool metrics
    const toolMetrics = this.calculateToolMetrics(eventLog, retrievalLog);

    // Calculate cost metrics
    const costMetrics = this.calculateCostMetrics(eventLog);

    // Calculate autonomy time
    const autonomyTime = this.calculateAutonomyTime(eventLog);

    // Calculate session duration
    const sessionDuration = this.calculateSessionDuration(eventLog);

    // Calculate model usage
    const modelUsage = this.calculateModelUsage(eventLog);

    // Combine into AERMetrics
    const metrics: AERMetrics = {
      autonomyTime,
      taskCompletionRate: taskMetrics.totalTasks > 0
        ? taskMetrics.completedTasks / taskMetrics.totalTasks
        : 0,
      recoveryRate: recoveryMetrics.totalFailures > 0
        ? recoveryMetrics.recoveries / recoveryMetrics.totalFailures
        : 0,
      toolChoiceAccuracy: toolMetrics.totalToolCalls > 0
        ? toolMetrics.correctToolCalls / toolMetrics.totalToolCalls
        : 0,
      costPerTask: taskMetrics.completedTasks > 0
        ? costMetrics.totalCost / taskMetrics.completedTasks
        : 0,
      totalTasks: taskMetrics.totalTasks,
      completedTasks: taskMetrics.completedTasks,
      failedTasks: taskMetrics.failedTasks,
      escalations: recoveryMetrics.escalations,
      recoveries: recoveryMetrics.recoveries,
      totalFailures: recoveryMetrics.totalFailures,
      totalCost: costMetrics.totalCost,
      sessionDuration,
      totalToolCalls: toolMetrics.totalToolCalls,
      correctToolCalls: toolMetrics.correctToolCalls,
      modelUsage,
    };

    if (this.config.debug) {
      this.log.debug("Calculated AER metrics", { sessionId, metrics });
    }

    return metrics;
  }

  /**
   * Evaluate a session against AER targets.
   *
   * @param sessionId - Session ID to evaluate
   * @param targets - Optional custom targets
   * @returns AER result with pass/fail status
   */
  async evaluate(
    sessionId: string,
    targets: AERTargets = DEFAULT_AER_TARGETS
  ): Promise<AERResult> {
    const metrics = await this.calculate(sessionId);
    const metricStatus = checkAERPass(metrics, targets);
    const passed = isAERPassing(metricStatus);

    return {
      metrics,
      targets,
      passed,
      metricStatus,
      sessionId,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate metrics for multiple sessions.
   *
   * @param sessionIds - Array of session IDs
   * @returns Array of AER metrics
   */
  async calculateMultiple(sessionIds: string[]): Promise<AERMetrics[]> {
    const results: AERMetrics[] = [];
    for (const sessionId of sessionIds) {
      const metrics = await this.calculate(sessionId);
      results.push(metrics);
    }
    return results;
  }

  /**
   * Get aggregate metrics across multiple sessions.
   *
   * @param sessionIds - Array of session IDs
   * @returns Aggregated AER metrics
   */
  async calculateAggregate(sessionIds: string[]): Promise<AERMetrics> {
    const allMetrics = await this.calculateMultiple(sessionIds);

    if (allMetrics.length === 0) {
      return createEmptyMetrics();
    }

    // Sum all numeric values
    const aggregate = createEmptyMetrics();
    for (const m of allMetrics) {
      aggregate.totalTasks += m.totalTasks;
      aggregate.completedTasks += m.completedTasks;
      aggregate.failedTasks += m.failedTasks;
      aggregate.escalations += m.escalations;
      aggregate.recoveries += m.recoveries;
      aggregate.totalFailures += m.totalFailures;
      aggregate.totalCost += m.totalCost;
      aggregate.sessionDuration += m.sessionDuration;
      aggregate.totalToolCalls += m.totalToolCalls;
      aggregate.correctToolCalls += m.correctToolCalls;

      // Model usage
      aggregate.modelUsage.opus.calls += m.modelUsage.opus.calls;
      aggregate.modelUsage.opus.tokens += m.modelUsage.opus.tokens;
      aggregate.modelUsage.opus.cost += m.modelUsage.opus.cost;
      aggregate.modelUsage.opus.timeSeconds += m.modelUsage.opus.timeSeconds;

      aggregate.modelUsage.sonnet.calls += m.modelUsage.sonnet.calls;
      aggregate.modelUsage.sonnet.tokens += m.modelUsage.sonnet.tokens;
      aggregate.modelUsage.sonnet.cost += m.modelUsage.sonnet.cost;
      aggregate.modelUsage.sonnet.timeSeconds += m.modelUsage.sonnet.timeSeconds;

      aggregate.modelUsage.haiku.calls += m.modelUsage.haiku.calls;
      aggregate.modelUsage.haiku.tokens += m.modelUsage.haiku.tokens;
      aggregate.modelUsage.haiku.cost += m.modelUsage.haiku.cost;
      aggregate.modelUsage.haiku.timeSeconds += m.modelUsage.haiku.timeSeconds;
    }

    // Calculate rates
    aggregate.taskCompletionRate = aggregate.totalTasks > 0
      ? aggregate.completedTasks / aggregate.totalTasks
      : 0;
    aggregate.recoveryRate = aggregate.totalFailures > 0
      ? aggregate.recoveries / aggregate.totalFailures
      : 0;
    aggregate.toolChoiceAccuracy = aggregate.totalToolCalls > 0
      ? aggregate.correctToolCalls / aggregate.totalToolCalls
      : 0;
    aggregate.costPerTask = aggregate.completedTasks > 0
      ? aggregate.totalCost / aggregate.completedTasks
      : 0;

    // Average autonomy time across sessions
    const totalAutonomyTime = allMetrics.reduce((sum, m) => sum + m.autonomyTime, 0);
    aggregate.autonomyTime = totalAutonomyTime / allMetrics.length;

    return aggregate;
  }

  // ==========================================================================
  // Log Parsing
  // ==========================================================================

  /**
   * Parse event log for a session.
   */
  async parseEventLog(sessionId: string): Promise<AEREventLogEntry[]> {
    const eventsPath = join(this.config.eventsDir, `${sessionId}.jsonl`);

    // Also check main events.jsonl
    const mainEventsPath = join(this.config.eventsDir, "events.jsonl");

    const entries: AEREventLogEntry[] = [];

    // Try session-specific file first
    if (existsSync(eventsPath)) {
      const content = await readFile(eventsPath, "utf-8");
      entries.push(...this.parseJsonl<AEREventLogEntry>(content));
    }

    // Also check main events file
    if (existsSync(mainEventsPath)) {
      const content = await readFile(mainEventsPath, "utf-8");
      const allEntries = this.parseJsonl<AEREventLogEntry>(content);
      // Filter by session ID if present in context
      const sessionEntries = allEntries.filter(
        (e) => e.context?.sessionId === sessionId || !e.context?.sessionId
      );
      entries.push(...sessionEntries);
    }

    // Sort by timestamp
    entries.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return entries;
  }

  /**
   * Parse retrieval log for a session.
   */
  async parseRetrievalLog(sessionId: string): Promise<AERRetrievalLogEntry[]> {
    const retrievalPath = join(this.config.retrievalDir, `${sessionId}.jsonl`);

    const entries: AERRetrievalLogEntry[] = [];

    if (existsSync(retrievalPath)) {
      const content = await readFile(retrievalPath, "utf-8");
      entries.push(...this.parseJsonl<AERRetrievalLogEntry>(content));
    }

    // Also check evidence directory for JSON files
    if (existsSync(this.config.retrievalDir)) {
      const files = await readdir(this.config.retrievalDir);
      const jsonFiles = files.filter(
        (f) => f.startsWith("search_") && f.endsWith(".json")
      );

      for (const file of jsonFiles) {
        try {
          const content = await readFile(
            join(this.config.retrievalDir, file),
            "utf-8"
          );
          const entry = JSON.parse(content) as AERRetrievalLogEntry;
          entries.push(entry);
        } catch {
          // Skip corrupt files
        }
      }
    }

    return entries;
  }

  /**
   * Parse JSONL content into array of objects.
   */
  private parseJsonl<T>(content: string): T[] {
    const entries: T[] = [];
    const lines = content.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as T);
      } catch {
        // Skip invalid lines
      }
    }

    return entries;
  }

  // ==========================================================================
  // Metric Calculations
  // ==========================================================================

  /**
   * Calculate task completion metrics.
   */
  private calculateTaskMetrics(events: AEREventLogEntry[]): {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
  } {
    const totalTasks = events.filter((e) => e.type === "task_start").length;
    const completedTasks = events.filter(
      (e) => e.type === "task_complete" && !e.hadIntervention
    ).length;
    const failedTasks = events.filter((e) => e.type === "task_failed").length;

    return { totalTasks, completedTasks, failedTasks };
  }

  /**
   * Calculate recovery metrics.
   */
  private calculateRecoveryMetrics(events: AEREventLogEntry[]): {
    escalations: number;
    recoveries: number;
    totalFailures: number;
  } {
    const escalations = events.filter((e) => e.type === "escalation").length;
    const failures = events.filter((e) => e.type === "failure");
    const totalFailures = failures.length;
    const recoveries = failures.filter((f) => f.recovered).length;

    return { escalations, recoveries, totalFailures };
  }

  /**
   * Calculate tool metrics.
   */
  private calculateToolMetrics(
    events: AEREventLogEntry[],
    retrievalLog: AERRetrievalLogEntry[]
  ): {
    totalToolCalls: number;
    correctToolCalls: number;
  } {
    // From event log
    const toolEvents = events.filter((e) => e.type === "tool_call");
    const eventToolCalls = toolEvents.length;
    const eventCorrectCalls = toolEvents.filter((t) => t.wasCorrect !== false).length;

    // From retrieval log
    const retrievalToolCalls = retrievalLog.length;
    const retrievalCorrectCalls = retrievalLog.filter(
      (r) => r.wasCorrect !== false
    ).length;

    return {
      totalToolCalls: eventToolCalls + retrievalToolCalls,
      correctToolCalls: eventCorrectCalls + retrievalCorrectCalls,
    };
  }

  /**
   * Calculate cost metrics.
   */
  private calculateCostMetrics(events: AEREventLogEntry[]): {
    totalCost: number;
  } {
    let totalCost = 0;

    for (const event of events) {
      if (event.type === "model_call") {
        if (event.cost !== undefined) {
          totalCost += event.cost;
        } else if (event.model && event.inputTokens && event.outputTokens) {
          totalCost += calculateModelCost(
            event.model,
            event.inputTokens,
            event.outputTokens
          );
        }
      }
    }

    return { totalCost };
  }

  /**
   * Calculate autonomy time (average minutes between escalations).
   */
  private calculateAutonomyTime(events: AEREventLogEntry[]): number {
    const escalations = events.filter((e) => e.type === "escalation");

    if (escalations.length <= 1) {
      // No escalations or only 1 → return session duration
      return this.calculateSessionDuration(events);
    }

    const intervals: number[] = [];
    for (let i = 1; i < escalations.length; i++) {
      const prev = new Date(escalations[i - 1]!.timestamp);
      const curr = new Date(escalations[i]!.timestamp);
      const intervalMinutes = (curr.getTime() - prev.getTime()) / 1000 / 60;
      intervals.push(intervalMinutes);
    }

    // Average interval
    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  /**
   * Calculate session duration in minutes.
   */
  private calculateSessionDuration(events: AEREventLogEntry[]): number {
    if (events.length < 2) return 0;

    const first = new Date(events[0]!.timestamp);
    const last = new Date(events[events.length - 1]!.timestamp);

    return (last.getTime() - first.getTime()) / 1000 / 60;
  }

  /**
   * Calculate model usage breakdown.
   */
  private calculateModelUsage(events: AEREventLogEntry[]): ModelUsageBreakdown {
    const usage: ModelUsageBreakdown = {
      opus: { calls: 0, tokens: 0, cost: 0, timeSeconds: 0 },
      sonnet: { calls: 0, tokens: 0, cost: 0, timeSeconds: 0 },
      haiku: { calls: 0, tokens: 0, cost: 0, timeSeconds: 0 },
      fable: { calls: 0, tokens: 0, cost: 0, timeSeconds: 0 },
    };

    for (const event of events) {
      if (event.type === "model_call" && event.model) {
        const tier = getModelTier(event.model);
        const tierUsage = usage[tier];

        tierUsage.calls += 1;
        tierUsage.tokens += (event.inputTokens ?? 0) + (event.outputTokens ?? 0);
        tierUsage.timeSeconds += event.durationSeconds ?? 0;

        if (event.cost !== undefined) {
          tierUsage.cost += event.cost;
        } else if (event.inputTokens && event.outputTokens) {
          tierUsage.cost += calculateModelCost(
            event.model,
            event.inputTokens,
            event.outputTokens
          );
        }
      }
    }

    return usage;
  }

  // ==========================================================================
  // Session Discovery
  // ==========================================================================

  /**
   * List available sessions.
   */
  async listSessions(): Promise<string[]> {
    const sessions: string[] = [];

    if (!existsSync(this.config.eventsDir)) {
      return sessions;
    }

    const files = await readdir(this.config.eventsDir);
    for (const file of files) {
      if (file.endsWith(".jsonl") && file !== "events.jsonl") {
        sessions.push(file.replace(".jsonl", ""));
      }
    }

    return sessions.sort();
  }

  /**
   * Get the most recent N sessions.
   */
  async getRecentSessions(count: number = 10): Promise<string[]> {
    const sessions = await this.listSessions();
    return sessions.slice(-count);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let globalCalculator: AERCalculator | undefined;

/**
 * Get the global AER Calculator instance.
 */
export function getAERCalculator(
  config?: Partial<AERCalculatorConfig>
): AERCalculator {
  if (!globalCalculator) {
    globalCalculator = new AERCalculator(config);
  }
  return globalCalculator;
}

/**
 * Reset the global AER Calculator (for testing).
 */
export function resetAERCalculator(): void {
  globalCalculator = undefined;
}

/**
 * Create a new AER Calculator instance.
 */
export function createAERCalculator(
  config?: Partial<AERCalculatorConfig>
): AERCalculator {
  return new AERCalculator(config);
}
