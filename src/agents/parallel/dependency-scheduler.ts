/**
 * Dependency Scheduler
 *
 * Builds execution batches respecting task dependencies.
 * Groups independent tasks for parallel execution.
 *
 * @module agents/parallel/dependency-scheduler
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 40 Parallel Execution
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { ParallelTask, TaskBatch, TaskComplexity } from "../types.js";
import { DependencyGraph, type GraphAnalysis } from "./dependency-graph.js";

// ============================================================================
// Types
// ============================================================================

export interface ScheduleConfig {
  /** Maximum tasks per batch (parallel limit) */
  maxBatchSize: number;
  /** Maximum total complexity per batch */
  maxBatchComplexity: number;
  /** Prioritize by complexity */
  prioritizeComplex: boolean;
  /** Sort order within batches */
  sortOrder: "priority" | "complexity" | "name";
}

export interface Schedule {
  /** Ordered batches */
  batches: TaskBatch[];
  /** Total tasks scheduled */
  totalTasks: number;
  /** Estimated parallelism */
  estimatedParallelism: number;
  /** Graph analysis */
  analysis: GraphAnalysis;
  /** Scheduling errors */
  errors: string[];
  /** Valid schedule */
  isValid: boolean;
}

export interface ScheduleStats {
  /** Number of batches */
  batchCount: number;
  /** Average tasks per batch */
  avgTasksPerBatch: number;
  /** Max tasks in a batch */
  maxTasksInBatch: number;
  /** Critical path length */
  criticalPathLength: number;
  /** Total complexity */
  totalComplexity: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_BATCH_SIZE = 5;
const DEFAULT_MAX_BATCH_COMPLEXITY = 20;

const COMPLEXITY_WEIGHTS: Record<TaskComplexity, number> = {
  simple: 1,
  moderate: 3,
  complex: 7,
  critical: 15,
};

// ============================================================================
// Dependency Scheduler
// ============================================================================

/**
 * DependencyScheduler - Creates execution schedule from tasks.
 *
 * Features:
 * 1. Build batches respecting dependencies
 * 2. Optimize batch size and complexity
 * 3. Critical path analysis
 * 4. Parallelism estimation
 */
export class DependencyScheduler {
  private config: ScheduleConfig;

  constructor(config?: Partial<ScheduleConfig>) {
    this.config = {
      maxBatchSize: config?.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
      maxBatchComplexity: config?.maxBatchComplexity ?? DEFAULT_MAX_BATCH_COMPLEXITY,
      prioritizeComplex: config?.prioritizeComplex ?? true,
      sortOrder: config?.sortOrder ?? "priority",
    };
  }

  /**
   * Create a schedule from tasks.
   */
  createSchedule(tasks: ParallelTask[]): Schedule {
    const graph = new DependencyGraph();
    const errors: string[] = [];

    // Add tasks to graph
    for (const task of tasks) {
      graph.addTask(task);
    }

    // Analyze graph
    const analysis = graph.analyze();

    // Check for conflicts
    if (!analysis.isValid) {
      for (const conflict of analysis.conflicts) {
        errors.push(conflict.description);
      }

      return {
        batches: [],
        totalTasks: tasks.length,
        estimatedParallelism: 0,
        analysis,
        errors,
        isValid: false,
      };
    }

    // Build batches using level-based scheduling
    const batches = this.buildBatches(graph, tasks);

    // Calculate parallelism
    const estimatedParallelism = this.calculateParallelism(batches);

    return {
      batches,
      totalTasks: tasks.length,
      estimatedParallelism,
      analysis,
      errors,
      isValid: true,
    };
  }

  /**
   * Build batches using level-based scheduling.
   */
  private buildBatches(graph: DependencyGraph, tasks: ParallelTask[]): TaskBatch[] {
    const batches: TaskBatch[] = [];
    const scheduled = new Set<string>();
    let batchOrder = 0;

    while (scheduled.size < tasks.length) {
      // Find tasks whose dependencies are all scheduled
      const candidates: ParallelTask[] = [];

      for (const task of tasks) {
        if (scheduled.has(task.id)) continue;

        const node = graph.getTask(task.id);
        if (!node) continue;

        // Check if all dependencies are scheduled
        let allDepsScheduled = true;
        for (const depId of node.dependencies) {
          if (!scheduled.has(depId)) {
            allDepsScheduled = false;
            break;
          }
        }

        if (allDepsScheduled) {
          candidates.push(task);
        }
      }

      if (candidates.length === 0) {
        // No more tasks can be scheduled (shouldn't happen if graph is valid)
        break;
      }

      // Sort candidates
      const sorted = this.sortCandidates(candidates);

      // Group into sub-batches respecting constraints
      const subBatches = this.groupIntoBatches(sorted);

      for (const subBatch of subBatches) {
        const batchId = `batch-${++batchOrder}`;
        const dependsOnBatches = this.findBatchDependencies(
          subBatch,
          batches,
          graph
        );

        batches.push({
          id: batchId,
          order: batchOrder,
          taskIds: subBatch,
          dependsOnBatches,
        });

        // Mark as scheduled
        for (const taskId of subBatch) {
          scheduled.add(taskId);
        }
      }
    }

    return batches;
  }

  /**
   * Sort candidates by configured order.
   */
  private sortCandidates(candidates: ParallelTask[]): ParallelTask[] {
    return [...candidates].sort((a, b) => {
      switch (this.config.sortOrder) {
        case "priority":
          return (b.priority ?? 0) - (a.priority ?? 0);
        case "complexity":
          return COMPLEXITY_WEIGHTS[b.complexity] - COMPLEXITY_WEIGHTS[a.complexity];
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }

  /**
   * Group tasks into batches respecting size and complexity constraints.
   */
  private groupIntoBatches(tasks: ParallelTask[]): string[][] {
    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentComplexity = 0;

    for (const task of tasks) {
      const taskComplexity = COMPLEXITY_WEIGHTS[task.complexity];

      // Check if adding this task would exceed limits
      const wouldExceedSize = currentBatch.length >= this.config.maxBatchSize;
      const wouldExceedComplexity =
        currentComplexity + taskComplexity > this.config.maxBatchComplexity;

      if (currentBatch.length > 0 && (wouldExceedSize || wouldExceedComplexity)) {
        // Start new batch
        batches.push(currentBatch);
        currentBatch = [];
        currentComplexity = 0;
      }

      currentBatch.push(task.id);
      currentComplexity += taskComplexity;
    }

    // Add remaining batch
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Find which batches this batch depends on.
   */
  private findBatchDependencies(
    taskIds: string[],
    previousBatches: TaskBatch[],
    graph: DependencyGraph
  ): string[] {
    const dependsOnBatches = new Set<string>();

    for (const taskId of taskIds) {
      const node = graph.getTask(taskId);
      if (!node) continue;

      for (const depId of node.dependencies) {
        // Find which batch contains this dependency
        for (const batch of previousBatches) {
          if (batch.taskIds.includes(depId)) {
            dependsOnBatches.add(batch.id);
            break;
          }
        }
      }
    }

    return Array.from(dependsOnBatches);
  }

  /**
   * Calculate estimated parallelism.
   */
  private calculateParallelism(batches: TaskBatch[]): number {
    if (batches.length === 0) return 0;

    const totalTasks = batches.reduce((sum, b) => sum + b.taskIds.length, 0);
    return totalTasks / batches.length;
  }

  /**
   * Get schedule statistics.
   */
  getStats(schedule: Schedule): ScheduleStats {
    const { batches, totalTasks } = schedule;

    if (batches.length === 0) {
      return {
        batchCount: 0,
        avgTasksPerBatch: 0,
        maxTasksInBatch: 0,
        criticalPathLength: 0,
        totalComplexity: 0,
      };
    }

    const taskCounts = batches.map((b) => b.taskIds.length);
    const maxTasksInBatch = Math.max(...taskCounts);
    const avgTasksPerBatch = totalTasks / batches.length;

    // Calculate critical path (longest chain through batches)
    const criticalPathLength = this.calculateCriticalPath(batches);

    return {
      batchCount: batches.length,
      avgTasksPerBatch,
      maxTasksInBatch,
      criticalPathLength,
      totalComplexity: 0, // Would need tasks to calculate
    };
  }

  /**
   * Calculate critical path through batches.
   */
  private calculateCriticalPath(batches: TaskBatch[]): number {
    if (batches.length === 0) return 0;

    const depths = new Map<string, number>();

    // Process batches in order
    for (const batch of batches) {
      let maxDepth = 0;

      for (const depBatchId of batch.dependsOnBatches) {
        const depDepth = depths.get(depBatchId) ?? 0;
        maxDepth = Math.max(maxDepth, depDepth);
      }

      depths.set(batch.id, maxDepth + 1);
    }

    return Math.max(...depths.values());
  }

  /**
   * Visualize schedule as text.
   */
  visualize(schedule: Schedule): string {
    const lines: string[] = [];
    lines.push("=== Execution Schedule ===");
    lines.push(`Total Tasks: ${schedule.totalTasks}`);
    lines.push(`Batches: ${schedule.batches.length}`);
    lines.push(`Est. Parallelism: ${schedule.estimatedParallelism.toFixed(2)}`);
    lines.push("");

    for (const batch of schedule.batches) {
      const deps = batch.dependsOnBatches.length > 0
        ? ` (depends: ${batch.dependsOnBatches.join(", ")})`
        : " (root)";

      lines.push(`${batch.id}${deps}`);
      for (const taskId of batch.taskIds) {
        lines.push(`  - ${taskId}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Get dry-run execution plan.
   */
  getDryRunPlan(schedule: Schedule): string[] {
    const plan: string[] = [];

    for (const batch of schedule.batches) {
      plan.push(`\n[${batch.id}] Execute ${batch.taskIds.length} tasks in parallel:`);
      for (const taskId of batch.taskIds) {
        plan.push(`  → ${taskId}`);
      }
    }

    return plan;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<ScheduleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration.
   */
  getConfig(): ScheduleConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a DependencyScheduler instance.
 */
export function createDependencyScheduler(
  config?: Partial<ScheduleConfig>
): DependencyScheduler {
  return new DependencyScheduler(config);
}

/**
 * Quick schedule creation.
 */
export function scheduleTasksForExecution(
  tasks: ParallelTask[],
  config?: Partial<ScheduleConfig>
): Schedule {
  const scheduler = new DependencyScheduler(config);
  return scheduler.createSchedule(tasks);
}
