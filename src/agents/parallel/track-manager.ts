/**
 * Track Manager
 *
 * Manages execution tracks for parallel task execution.
 * Each track is an independent execution unit with its own budget.
 *
 * @module agents/parallel/track-manager
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 40 Parallel Execution
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type {
  ExecutionTrack,
  ParallelTask,
  ParallelTaskStatus,
} from "../types.js";

// ============================================================================
// Types
// ============================================================================

export interface TrackConfig {
  /** Maximum concurrent tracks */
  maxTracks: number;
  /** Default budget percentage per track */
  defaultBudgetPercent: number;
  /** Track names (optional) */
  trackNames?: string[];
}

export interface TrackAssignment {
  /** Task ID */
  taskId: string;
  /** Assigned track ID */
  trackId: string;
  /** Reason for assignment */
  reason: string;
}

export interface TrackStats {
  /** Track ID */
  trackId: string;
  /** Total tasks assigned */
  totalAssigned: number;
  /** Currently pending */
  pending: number;
  /** Currently running */
  running: number;
  /** Completed successfully */
  completed: number;
  /** Failed */
  failed: number;
  /** Estimated load (0-100) */
  load: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_TRACKS = 3;
const DEFAULT_BUDGET_PERCENT = 33; // 100 / 3

// ============================================================================
// Track Manager
// ============================================================================

/**
 * TrackManager - Manages parallel execution tracks.
 *
 * Features:
 * 1. Create and manage multiple execution tracks
 * 2. Assign tasks to tracks with load balancing
 * 3. Per-track budget allocation
 * 4. Track status monitoring
 */
export class TrackManager {
  private tracks: Map<string, ExecutionTrack> = new Map();
  private taskAssignments: Map<string, string> = new Map(); // taskId -> trackId
  private taskStatuses: Map<string, ParallelTaskStatus> = new Map();
  private config: TrackConfig;

  constructor(config?: Partial<TrackConfig>) {
    this.config = {
      maxTracks: config?.maxTracks ?? DEFAULT_MAX_TRACKS,
      defaultBudgetPercent: config?.defaultBudgetPercent ?? DEFAULT_BUDGET_PERCENT,
      ...(config?.trackNames !== undefined && { trackNames: config.trackNames }),
    };

    this.initializeTracks();
  }

  /**
   * Initialize execution tracks.
   */
  private initializeTracks(): void {
    const budgetEach = Math.floor(100 / this.config.maxTracks);

    for (let i = 0; i < this.config.maxTracks; i++) {
      const trackId = `track-${i + 1}`;
      const trackName = this.config.trackNames?.[i] ?? `Track ${i + 1}`;

      this.tracks.set(trackId, {
        id: trackId,
        name: trackName,
        status: "idle",
        budgetPercent: budgetEach,
        taskIds: [],
        completed: 0,
        failed: 0,
      });
    }
  }

  /**
   * Assign a task to a track.
   * Uses load balancing by default.
   */
  assignTask(task: ParallelTask, preferredTrackId?: string): TrackAssignment {
    // Use preferred track if valid and available
    if (preferredTrackId && this.tracks.has(preferredTrackId)) {
      return this.assignToTrack(task, preferredTrackId, "Preferred track");
    }

    // Find track with lowest load
    const trackStats = this.getTrackStats();
    const sortedTracks = trackStats.sort((a, b) => a.load - b.load);

    if (sortedTracks.length === 0) {
      throw new Error("No tracks available for assignment");
    }

    const targetTrack = sortedTracks[0]!;
    return this.assignToTrack(task, targetTrack.trackId, "Load balanced");
  }

  /**
   * Assign task to specific track.
   */
  private assignToTrack(
    task: ParallelTask,
    trackId: string,
    reason: string
  ): TrackAssignment {
    const track = this.tracks.get(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }

    track.taskIds.push(task.id);
    this.taskAssignments.set(task.id, trackId);
    this.taskStatuses.set(task.id, "pending");

    return {
      taskId: task.id,
      trackId,
      reason,
    };
  }

  /**
   * Assign multiple tasks with load balancing.
   */
  assignTasks(tasks: ParallelTask[]): TrackAssignment[] {
    // Sort by priority and complexity (higher priority/complexity first)
    const sorted = [...tasks].sort((a, b) => {
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;

      // Complexity order: critical > complex > moderate > simple
      const complexityOrder = { critical: 4, complex: 3, moderate: 2, simple: 1 };
      return complexityOrder[b.complexity] - complexityOrder[a.complexity];
    });

    // Round-robin assignment with load balancing
    const assignments: TrackAssignment[] = [];

    for (const task of sorted) {
      const assignment = this.assignTask(task);
      assignments.push(assignment);
    }

    return assignments;
  }

  /**
   * Update task status.
   */
  updateTaskStatus(taskId: string, status: ParallelTaskStatus): void {
    const trackId = this.taskAssignments.get(taskId);
    if (!trackId) return;

    const track = this.tracks.get(trackId);
    if (!track) return;

    this.taskStatuses.set(taskId, status);

    // Update track counters
    if (status === "running") {
      track.status = "running";
      track.currentTaskId = taskId;
    } else if (status === "completed") {
      track.completed++;
      if (track.currentTaskId === taskId) {
        delete track.currentTaskId;
      }
      // Check if track has more tasks
      this.updateTrackStatus(trackId);
    } else if (status === "failed") {
      track.failed++;
      if (track.currentTaskId === taskId) {
        delete track.currentTaskId;
      }
      this.updateTrackStatus(trackId);
    }
  }

  /**
   * Update track status based on tasks.
   */
  private updateTrackStatus(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (!track) return;

    // Check if any task is running
    let hasRunning = false;
    let hasPending = false;

    for (const taskId of track.taskIds) {
      const status = this.taskStatuses.get(taskId);
      if (status === "running") hasRunning = true;
      if (status === "pending" || status === "ready") hasPending = true;
    }

    if (hasRunning) {
      track.status = "running";
    } else if (hasPending) {
      track.status = "idle";
    } else {
      track.status = "stopped";
    }
  }

  /**
   * Get track by ID.
   */
  getTrack(trackId: string): ExecutionTrack | undefined {
    return this.tracks.get(trackId);
  }

  /**
   * Get all tracks.
   */
  getAllTracks(): ExecutionTrack[] {
    return Array.from(this.tracks.values());
  }

  /**
   * Get track for a task.
   */
  getTaskTrack(taskId: string): ExecutionTrack | undefined {
    const trackId = this.taskAssignments.get(taskId);
    if (!trackId) return undefined;
    return this.tracks.get(trackId);
  }

  /**
   * Get tasks for a track.
   */
  getTrackTasks(trackId: string): string[] {
    const track = this.tracks.get(trackId);
    return track?.taskIds ?? [];
  }

  /**
   * Get pending tasks for a track.
   */
  getPendingTasks(trackId: string): string[] {
    const track = this.tracks.get(trackId);
    if (!track) return [];

    return track.taskIds.filter((taskId) => {
      const status = this.taskStatuses.get(taskId);
      return status === "pending" || status === "ready";
    });
  }

  /**
   * Get track statistics.
   */
  getTrackStats(): TrackStats[] {
    const stats: TrackStats[] = [];

    for (const track of this.tracks.values()) {
      let pending = 0;
      let running = 0;
      let completed = 0;
      let failed = 0;

      for (const taskId of track.taskIds) {
        const status = this.taskStatuses.get(taskId);
        switch (status) {
          case "pending":
          case "ready":
            pending++;
            break;
          case "running":
            running++;
            break;
          case "completed":
            completed++;
            break;
          case "failed":
            failed++;
            break;
        }
      }

      const total = track.taskIds.length;
      const load = total > 0 ? ((pending + running) / total) * 100 : 0;

      stats.push({
        trackId: track.id,
        totalAssigned: total,
        pending,
        running,
        completed,
        failed,
        load,
      });
    }

    return stats;
  }

  /**
   * Update track budget.
   */
  setTrackBudget(trackId: string, budgetPercent: number): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.budgetPercent = Math.max(0, Math.min(100, budgetPercent));
    }
  }

  /**
   * Pause a track.
   */
  pauseTrack(trackId: string): boolean {
    const track = this.tracks.get(trackId);
    if (!track) return false;
    track.status = "paused";
    return true;
  }

  /**
   * Resume a track.
   */
  resumeTrack(trackId: string): boolean {
    const track = this.tracks.get(trackId);
    if (!track) return false;
    track.status = "idle";
    this.updateTrackStatus(trackId);
    return true;
  }

  /**
   * Stop a track.
   */
  stopTrack(trackId: string): boolean {
    const track = this.tracks.get(trackId);
    if (!track) return false;
    track.status = "stopped";
    delete track.currentTaskId;
    return true;
  }

  /**
   * Check if all tracks are idle or stopped.
   */
  isIdle(): boolean {
    for (const track of this.tracks.values()) {
      if (track.status === "running") return false;
    }
    return true;
  }

  /**
   * Check if all tasks are completed.
   */
  isComplete(): boolean {
    for (const status of this.taskStatuses.values()) {
      if (status !== "completed" && status !== "failed" && status !== "cancelled") {
        return false;
      }
    }
    return true;
  }

  /**
   * Get overall statistics.
   */
  getOverallStats(): {
    totalTasks: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    tracksRunning: number;
    tracksIdle: number;
  } {
    let pending = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;
    let tracksRunning = 0;
    let tracksIdle = 0;

    for (const status of this.taskStatuses.values()) {
      switch (status) {
        case "pending":
        case "ready":
          pending++;
          break;
        case "running":
          running++;
          break;
        case "completed":
          completed++;
          break;
        case "failed":
          failed++;
          break;
      }
    }

    for (const track of this.tracks.values()) {
      if (track.status === "running") tracksRunning++;
      else if (track.status === "idle") tracksIdle++;
    }

    return {
      totalTasks: this.taskStatuses.size,
      pending,
      running,
      completed,
      failed,
      tracksRunning,
      tracksIdle,
    };
  }

  /**
   * Clear all assignments.
   */
  clear(): void {
    this.taskAssignments.clear();
    this.taskStatuses.clear();
    for (const track of this.tracks.values()) {
      track.taskIds = [];
      track.status = "idle";
      delete track.currentTaskId;
      track.completed = 0;
      track.failed = 0;
    }
  }

  /**
   * Get configuration.
   */
  getConfig(): TrackConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a TrackManager instance.
 */
export function createTrackManager(config?: Partial<TrackConfig>): TrackManager {
  return new TrackManager(config);
}
