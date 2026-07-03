/**
 * Parallel Executor
 *
 * Executes tasks in parallel respecting dependencies and resources.
 * Main orchestration component for parallel task execution.
 *
 * @module agents/parallel/parallel-executor
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 40 Parallel Execution
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type {
  ParallelTask,
  ParallelTaskResult,
  ParallelExecutionResult,
  TaskBatch,
} from "../types.js";
import { createFileLockManager, type FileLockManager } from "../../infra/file-lock.js";
import { createTrackManager, type TrackManager, type TrackConfig } from "./track-manager.js";
import {
  createDependencyScheduler,
  type DependencyScheduler,
  type ScheduleConfig,
} from "./dependency-scheduler.js";

// ============================================================================
// Types
// ============================================================================

export interface ExecutorConfig {
  /** Track configuration */
  tracks?: Partial<TrackConfig>;
  /** Schedule configuration */
  schedule?: Partial<ScheduleConfig>;
  /** Lock timeout in ms */
  lockTimeoutMs: number;
  /** Task timeout in ms */
  taskTimeoutMs: number;
  /** Continue on error */
  continueOnError: boolean;
  /** Dry run (no actual execution) */
  dryRun: boolean;
}

export interface ExecutionContext {
  /** Execution ID */
  executionId: string;
  /** Start time */
  startedAt: Date;
  /** Tasks being executed */
  tasks: Map<string, ParallelTask>;
  /** Task results */
  results: Map<string, ParallelTaskResult>;
  /** Current status */
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  /** Error if failed */
  error?: string;
}

/**
 * Task executor function.
 */
export type TaskExecutor = (
  task: ParallelTask,
  context: ExecutionContext
) => Promise<unknown>;

export interface ExecutorEvents {
  onTaskStart?: (task: ParallelTask, trackId: string) => void;
  onTaskComplete?: (task: ParallelTask, result: ParallelTaskResult) => void;
  onTaskFail?: (task: ParallelTask, error: Error) => void;
  onBatchStart?: (batch: TaskBatch, batchNumber: number) => void;
  onBatchComplete?: (batch: TaskBatch, results: ParallelTaskResult[]) => void;
  onExecutionComplete?: (result: ParallelExecutionResult) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LOCK_TIMEOUT_MS = 30000;
const DEFAULT_TASK_TIMEOUT_MS = 300000; // 5 minutes

// ============================================================================
// Parallel Executor
// ============================================================================

/**
 * ParallelExecutor - Executes tasks in parallel.
 *
 * Features:
 * 1. Batch-based parallel execution
 * 2. File locking for resource safety
 * 3. Track-based execution management
 * 4. Progress tracking and events
 */
export class ParallelExecutor {
  private config: ExecutorConfig;
  private lockManager: FileLockManager;
  private trackManager: TrackManager;
  private scheduler: DependencyScheduler;
  private events: ExecutorEvents;
  private executor: TaskExecutor;
  private currentContext: ExecutionContext | null = null;

  constructor(
    executor: TaskExecutor,
    config?: Partial<ExecutorConfig>,
    events?: ExecutorEvents
  ) {
    this.config = {
      lockTimeoutMs: config?.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
      taskTimeoutMs: config?.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS,
      continueOnError: config?.continueOnError ?? true,
      dryRun: config?.dryRun ?? false,
      ...(config?.tracks !== undefined && { tracks: config.tracks }),
      ...(config?.schedule !== undefined && { schedule: config.schedule }),
    };

    this.lockManager = createFileLockManager();
    this.trackManager = createTrackManager(this.config.tracks);
    this.scheduler = createDependencyScheduler(this.config.schedule);
    this.events = events ?? {};
    this.executor = executor;
  }

  /**
   * Execute tasks in parallel.
   */
  async execute(tasks: ParallelTask[]): Promise<ParallelExecutionResult> {
    const startTime = Date.now();

    // Create execution context
    const context: ExecutionContext = {
      executionId: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      startedAt: new Date(),
      tasks: new Map(tasks.map((t) => [t.id, t])),
      results: new Map(),
      status: "pending",
    };
    this.currentContext = context;

    // Create schedule
    const schedule = this.scheduler.createSchedule(tasks);

    if (!schedule.isValid) {
      context.status = "failed";
      context.error = schedule.errors.join("; ");

      return {
        totalTasks: tasks.length,
        completedTasks: 0,
        failedTasks: 0,
        batches: [],
        totalDurationMs: Date.now() - startTime,
        taskResults: context.results,
      };
    }

    // Assign tasks to tracks
    this.trackManager.clear();
    this.trackManager.assignTasks(tasks);

    // Execute batches
    context.status = "running";
    const batchResults: ParallelExecutionResult["batches"] = [];

    try {
      for (let i = 0; i < schedule.batches.length; i++) {
        const batch = schedule.batches[i]!;
        const batchStartTime = Date.now();

        this.events.onBatchStart?.(batch, i + 1);

        // Execute batch tasks in parallel
        const results = await this.executeBatch(batch, context);

        // Update batch results
        let successCount = 0;
        let failCount = 0;

        for (const result of results) {
          if (result.status === "completed") {
            successCount++;
          } else if (result.status === "failed") {
            failCount++;
          }
        }

        batchResults.push({
          batchId: batch.id,
          taskCount: batch.taskIds.length,
          successCount,
          failCount,
          durationMs: Date.now() - batchStartTime,
        });

        this.events.onBatchComplete?.(batch, results);

        // Check if we should continue
        if (failCount > 0 && !this.config.continueOnError) {
          context.status = "failed";
          context.error = "Execution stopped due to task failure";
          break;
        }
      }

      // Determine final status
      if (context.status !== "failed") {
        context.status = "completed";
      }
    } catch (error) {
      context.status = "failed";
      context.error = error instanceof Error ? error.message : String(error);
    } finally {
      // Release all locks
      this.lockManager.clear();
    }

    // Build result
    const result: ParallelExecutionResult = {
      totalTasks: tasks.length,
      completedTasks: Array.from(context.results.values()).filter(
        (r) => r.status === "completed"
      ).length,
      failedTasks: Array.from(context.results.values()).filter(
        (r) => r.status === "failed"
      ).length,
      batches: batchResults,
      totalDurationMs: Date.now() - startTime,
      taskResults: context.results,
    };

    this.events.onExecutionComplete?.(result);
    this.currentContext = null;

    return result;
  }

  /**
   * Execute a batch of tasks in parallel.
   */
  private async executeBatch(
    batch: TaskBatch,
    context: ExecutionContext
  ): Promise<ParallelTaskResult[]> {
    const tasks = batch.taskIds
      .map((id) => context.tasks.get(id))
      .filter((t): t is ParallelTask => t !== undefined);

    // Dry run: just record as completed
    if (this.config.dryRun) {
      return tasks.map((task) => {
        const result: ParallelTaskResult = {
          taskId: task.id,
          status: "completed",
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 0,
          result: { dryRun: true },
        };
        context.results.set(task.id, result);
        return result;
      });
    }

    // Execute in parallel
    const promises = tasks.map((task) => this.executeTask(task, context));
    return Promise.all(promises);
  }

  /**
   * Execute a single task.
   */
  private async executeTask(
    task: ParallelTask,
    context: ExecutionContext
  ): Promise<ParallelTaskResult> {
    const startTime = Date.now();
    const track = this.trackManager.getTaskTrack(task.id);
    const trackId = track?.id ?? "unknown";

    // Update status
    this.trackManager.updateTaskStatus(task.id, "running");
    this.events.onTaskStart?.(task, trackId);

    const result: ParallelTaskResult = {
      taskId: task.id,
      status: "running",
      startedAt: new Date(),
      trackId,
    };

    try {
      // Acquire file locks
      await this.acquireLocks(task, trackId);

      // Execute with timeout
      const execResult = await this.executeWithTimeout(task, context);

      result.status = "completed";
      result.result = execResult;
      result.completedAt = new Date();
      result.durationMs = Date.now() - startTime;

      this.trackManager.updateTaskStatus(task.id, "completed");
      this.events.onTaskComplete?.(task, result);
    } catch (error) {
      result.status = "failed";
      result.error = error instanceof Error ? error.message : String(error);
      result.completedAt = new Date();
      result.durationMs = Date.now() - startTime;

      this.trackManager.updateTaskStatus(task.id, "failed");
      this.events.onTaskFail?.(task, error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Release file locks
      this.releaseLocks(task, trackId);
    }

    context.results.set(task.id, result);
    return result;
  }

  /**
   * Execute task with timeout.
   */
  private async executeWithTimeout(
    task: ParallelTask,
    context: ExecutionContext
  ): Promise<unknown> {
    const timeout = task.timeout ?? this.config.taskTimeoutMs;

    return Promise.race([
      this.executor(task, context),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task ${task.id} timed out after ${timeout}ms`));
        }, timeout);
      }),
    ]);
  }

  /**
   * Acquire file locks for a task.
   */
  private async acquireLocks(task: ParallelTask, owner: string): Promise<void> {
    // Acquire read locks
    if (task.reads) {
      for (const path of task.reads) {
        const result = await this.lockManager.acquire({
          path,
          type: "read",
          owner,
          timeout: this.config.lockTimeoutMs,
        });

        if (!result.acquired) {
          throw new Error(
            `Failed to acquire read lock for ${path}: ${result.conflict?.reason}`
          );
        }
      }
    }

    // Acquire write locks
    if (task.writes) {
      for (const path of task.writes) {
        const result = await this.lockManager.acquire({
          path,
          type: "write",
          owner,
          timeout: this.config.lockTimeoutMs,
        });

        if (!result.acquired) {
          throw new Error(
            `Failed to acquire write lock for ${path}: ${result.conflict?.reason}`
          );
        }
      }
    }
  }

  /**
   * Release file locks for a task.
   */
  private releaseLocks(_task: ParallelTask, owner: string): void {
    this.lockManager.releaseAll(owner);
  }

  /**
   * Cancel execution.
   */
  cancel(): void {
    if (this.currentContext) {
      this.currentContext.status = "cancelled";
    }
  }

  /**
   * Get current execution status.
   */
  getStatus(): ExecutionContext | null {
    return this.currentContext;
  }

  /**
   * Get dry-run execution plan.
   */
  getDryRunPlan(tasks: ParallelTask[]): string {
    const schedule = this.scheduler.createSchedule(tasks);
    return this.scheduler.visualize(schedule);
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<ExecutorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration.
   */
  getConfig(): ExecutorConfig {
    return { ...this.config };
  }

  /**
   * Get track manager.
   */
  getTrackManager(): TrackManager {
    return this.trackManager;
  }

  /**
   * Get scheduler.
   */
  getScheduler(): DependencyScheduler {
    return this.scheduler;
  }

  /**
   * Get lock manager.
   */
  getLockManager(): FileLockManager {
    return this.lockManager;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a ParallelExecutor instance.
 */
export function createParallelExecutor(
  executor: TaskExecutor,
  config?: Partial<ExecutorConfig>,
  events?: ExecutorEvents
): ParallelExecutor {
  return new ParallelExecutor(executor, config, events);
}

/**
 * Create a no-op executor for testing.
 */
export function createNoOpExecutor(
  config?: Partial<ExecutorConfig>
): ParallelExecutor {
  const noOpTaskExecutor: TaskExecutor = async (task) => {
    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { taskId: task.id, executed: true };
  };

  return new ParallelExecutor(noOpTaskExecutor, config);
}

/**
 * Quick parallel execution.
 */
export async function executeTasksInParallel(
  tasks: ParallelTask[],
  executor: TaskExecutor,
  config?: Partial<ExecutorConfig>
): Promise<ParallelExecutionResult> {
  const parallelExecutor = new ParallelExecutor(executor, config);
  return parallelExecutor.execute(tasks);
}
