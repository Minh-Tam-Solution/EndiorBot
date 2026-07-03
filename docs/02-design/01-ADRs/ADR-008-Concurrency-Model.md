# ADR-008: Concurrency Model

| Metadata | Value |
|----------|-------|
| **Status** | ACCEPTED |
| **Date** | 2026-02-22 |
| **Authors** | PM, Architect |
| **Reviewers** | CTO, CPO |
| **Sprint** | 39 |
| **Related ADRs** | ADR-006 (Checkpoint State Model), ADR-007 (Budget Control) |

## Context

### Problem Statement

EndiorBot currently executes tasks sequentially, leading to poor resource utilization and long wall-clock times:

- **Sequential Execution**: Implementation → Tests → Docs takes 15 minutes wall-clock time
- **Idle Resources**: CPU and network idle while waiting for AI responses
- **Poor Scalability**: Can't leverage modern async/await patterns
- **Missed Parallelism**: Independent tasks (formatting, docs, tests) could run concurrently

Current state:
- Single task execution at a time
- No parallel tracks
- No dependency-aware scheduling
- Wall-clock time = sum of all task durations

Goal: Reduce wall-clock time by 50-60% through parallel execution.

### Requirements (from Autonomy Epic)

**CPO/CTO Requirements**:
> "2-3 parallel tracks max. Single-process model. File locks prevent conflicts. No over-engineering."

**Constraints**:
- Max 2-3 concurrent tracks (avoid context switching overhead)
- Single process (no multi-process, no worker threads)
- File-level locking (prevent concurrent edits to same file)
- Dependency-aware scheduling (tests depend on implementation)
- Budget tracking per track
- Graceful degradation (file conflicts → serialize)

## Decision

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Parallel Execution System                     │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Dependency Scheduler                        │   │
│   │                                                          │   │
│   │  • Topological sort (dependency order)                  │   │
│   │  • Group into parallel batches                          │   │
│   │  • Allocate resources (budget, model)                   │   │
│   │  • Detect file conflicts                                │   │
│   └─────────────────┬───────────────────────────────────────┘   │
│                     │                                            │
│                     ▼                                            │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Track Manager                               │   │
│   │                                                          │   │
│   │  Batch 1: [Track 1] [Track 2] [Track 3] (parallel)     │   │
│   │  Batch 2: [Track 4] [Track 5]            (parallel)     │   │
│   │  Batch 3: [Track 6]                      (sequential)   │   │
│   │                                                          │   │
│   │  • Max 3 concurrent tracks                              │   │
│   │  • Promise.all() for parallelism                        │   │
│   │  • File lock coordination                               │   │
│   └─────────────────┬───────────────────────────────────────┘   │
│                     │                                            │
│         ┌───────────┴───────────┬───────────┐                   │
│         ▼                       ▼           ▼                   │
│   ┌──────────┐           ┌──────────┐ ┌──────────┐             │
│   │ Track 1  │           │ Track 2  │ │ Track 3  │             │
│   │ ────────│           │ ────────│ │ ────────│             │
│   │ Task A   │           │ Task B   │ │ Task C   │             │
│   │ Budget:  │           │ Budget:  │ │ Budget:  │             │
│   │ $0.50    │           │ $0.50    │ │ $0.50    │             │
│   │          │           │          │ │          │             │
│   │ Locks:   │           │ Locks:   │ │ Locks:   │             │
│   │ auth.ts  │           │ format.* │ │ README   │             │
│   └─────┬────┘           └─────┬────┘ └─────┬────┘             │
│         │                      │            │                   │
│         └──────────────────────┴────────────┘                   │
│                                │                                │
│                                ▼                                │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │           File Lock Manager                              │   │
│   │                                                          │   │
│   │  Locks: { auth.ts → Track 1 (write)                    │   │
│   │           format.* → Track 2 (write)                    │   │
│   │           README → Track 3 (write) }                    │   │
│   │                                                          │   │
│   │  • Read locks: Multiple allowed                         │   │
│   │  • Write locks: Exclusive                               │   │
│   │  • Timeout: 30 seconds                                  │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Interfaces

```typescript
interface Track {
  id: string;                // "track-1", "track-2", "track-3"
  name: string;              // "Implementation", "Testing", "Documentation"
  status: 'idle' | 'running' | 'blocked' | 'completed' | 'failed';
  tasks: Task[];             // Queue of tasks for this track
  currentTask: Task | null;  // Currently executing task
  dependencies: string[];    // Task IDs this track depends on
  fileLocks: Set<string>;    // Files locked by this track
  budget: {
    allocated: number;       // Budget allocated to this track (USD)
    used: number;            // Budget used so far (USD)
  };
  model: string;             // Model used for this track (from router)
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: Error;
}

interface TrackManagerConfig {
  maxConcurrentTracks: number;  // Default: 3
  enableParallelExecution: boolean;  // Default: true
  fileLockTimeout: number;      // Default: 30000 (30s)
  trackBudgetLimit: number;     // Default: $0.50 per track
  checkpointOnBatchComplete: boolean;  // Default: true
}

interface ParallelExecutionConfig {
  budget: number;              // Total budget for all tracks
  maxTracks?: number;          // Override maxConcurrentTracks
  strategy?: 'balanced' | 'aggressive' | 'conservative';
  checkpointOnBatchComplete?: boolean;
  startTime: number;           // For speedup calculation
}

interface DependencyGraph {
  nodes: Map<string, Task>;                // task ID → Task
  edges: Map<string, Set<string>>;         // task ID → dependencies

  addTask(task: Task): void;
  detectCircularDependencies(): string[];
  getReadyTasks(completedTasks: Set<string>): Task[];
  topologicalSort(): Task[];
}

interface FileLock {
  trackId: string;
  filePath: string;
  mode: 'read' | 'write';
  acquiredAt: Date;
  readers?: string[];          // For read locks (multiple allowed)
}

interface FileLockManager {
  locks: Map<string, FileLock>;  // filePath → FileLock

  acquireLock(trackId: string, filePath: string, mode: 'read' | 'write'): Promise<boolean>;
  releaseLock(trackId: string, filePath: string): Promise<void>;
  acquireWithTimeout(trackId: string, filePath: string, mode: 'read' | 'write', timeout: number): Promise<boolean>;
  getLockedFiles(trackId: string): string[];
  hasConflict(filePath: string, mode: 'read' | 'write'): boolean;
}

interface Schedule {
  batches: BatchSchedule[];
  totalBudget: number;
  estimatedDuration: number;   // Milliseconds
  estimatedSpeedup: number;    // Sequential time / parallel time
}

interface BatchSchedule {
  batchId: number;
  tracks: TrackSchedule[];
  estimatedDuration: number;   // Max of track durations (parallel)
  dependencies: string[];      // Task IDs this batch depends on
}

interface TrackSchedule {
  trackId: string;
  task: Task;
  model: string;
  budget: number;
  estimatedCost: number;
  estimatedDuration: number;
  files: string[];             // Files this track will touch
}

interface ParallelExecutionResult {
  batches: BatchResult[];
  totalCost: number;
  totalDuration: number;       // Sum of batch durations (sequential batches)
  wallClockTime: number;       // Actual time elapsed
  speedup: number;             // Sequential estimate / wall-clock time
  success: boolean;
}

interface BatchResult {
  batchId: string;
  tracks: TrackResult[];
  cost: number;
  duration: number;            // Max of track durations
  success: boolean;
}

interface TrackResult {
  trackId: string;
  status: 'completed' | 'failed' | 'blocked';
  reason?: string;
  task?: string;
  cost?: number;
  duration?: number;
}
```

### Single-Process Concurrency Model

**IMPORTANT**: This is a single-process, async/await model, NOT multi-process or multi-threaded.

```typescript
// Single-process model using JavaScript event loop
class TrackManager {
  private tracks = new Map<string, Track>();
  private maxTracks = 3;

  async executeTracks(): Promise<TrackResult[]> {
    // Execute all tracks in parallel using Promise.all()
    // JavaScript event loop handles concurrency
    const promises = Array.from(this.tracks.values()).map(track =>
      this.executeTrack(track)  // Returns Promise<TrackResult>
    );

    // Wait for all tracks to complete
    return Promise.all(promises);
  }

  private async executeTrack(track: Track): Promise<TrackResult> {
    // Each track runs independently
    // Async I/O (AI API calls, file operations) allows concurrency
    // No CPU-bound parallelism needed (AI work is on servers)

    track.status = 'running';
    track.startedAt = new Date();

    for (const task of track.tasks) {
      // Acquire file locks
      const files = await this.getTaskFiles(task);
      const lockResults = await Promise.all(
        files.map(file =>
          this.fileLockManager.acquireWithTimeout(track.id, file, 'write', 30000)
        )
      );

      // Check if all locks acquired
      if (!lockResults.every(r => r)) {
        track.status = 'blocked';
        return { trackId: track.id, status: 'blocked', reason: 'file_lock_timeout' };
      }

      // Execute task (async AI API call)
      track.currentTask = task;
      const result = await this.executeTask(task, track);

      // Release locks
      await Promise.all(
        files.map(file =>
          this.fileLockManager.releaseLock(track.id, file)
        )
      );

      // Check result
      if (!result.success) {
        track.status = 'failed';
        return { trackId: track.id, status: 'failed', reason: result.error };
      }

      // Update budget
      track.budget.used += result.cost;
      if (track.budget.used >= track.budget.allocated) {
        track.status = 'blocked';
        return { trackId: track.id, status: 'blocked', reason: 'budget_exhausted' };
      }
    }

    track.status = 'completed';
    track.completedAt = new Date();
    return { trackId: track.id, status: 'completed', cost: track.budget.used };
  }
}
```

**Why Single-Process?**
1. **AI work is I/O-bound**: Waiting for API responses, not CPU computation
2. **JavaScript async/await**: Perfect for concurrent I/O operations
3. **Simpler**: No IPC, no shared memory, no process management
4. **Lower overhead**: No process spawn cost, no context switching penalty
5. **Easier debugging**: Single process, simpler stack traces

### File Lock Manager

```typescript
class FileLockManager {
  private locks = new Map<string, FileLock>();

  async acquireLock(
    trackId: string,
    filePath: string,
    mode: 'read' | 'write'
  ): Promise<boolean> {
    const normalizedPath = path.normalize(filePath);
    const existingLock = this.locks.get(normalizedPath);

    // Write lock requires exclusive access
    if (mode === 'write') {
      if (existingLock) {
        // File locked by another track
        logger.warn('File write lock blocked', {
          trackId,
          filePath: normalizedPath,
          owner: existingLock.trackId,
          mode: existingLock.mode,
        });
        return false;
      }

      // Acquire write lock
      this.locks.set(normalizedPath, {
        trackId,
        filePath: normalizedPath,
        mode: 'write',
        acquiredAt: new Date(),
      });

      logger.debug('Write lock acquired', { trackId, filePath: normalizedPath });
      return true;
    }

    // Read lock allows multiple readers
    if (mode === 'read') {
      if (existingLock && existingLock.mode === 'write') {
        // File has write lock, cannot read
        logger.warn('File read lock blocked (write lock held)', {
          trackId,
          filePath: normalizedPath,
          owner: existingLock.trackId,
        });
        return false;
      }

      // Acquire read lock (multiple allowed)
      if (existingLock && existingLock.mode === 'read') {
        // Add to readers
        existingLock.readers = [...(existingLock.readers ?? [existingLock.trackId]), trackId];
        logger.debug('Read lock shared', {
          trackId,
          filePath: normalizedPath,
          readers: existingLock.readers.length,
        });
      } else {
        // First read lock
        this.locks.set(normalizedPath, {
          trackId,
          filePath: normalizedPath,
          mode: 'read',
          acquiredAt: new Date(),
          readers: [trackId],
        });
        logger.debug('Read lock acquired', { trackId, filePath: normalizedPath });
      }

      return true;
    }

    return false;
  }

  async releaseLock(trackId: string, filePath: string): Promise<void> {
    const normalizedPath = path.normalize(filePath);
    const lock = this.locks.get(normalizedPath);

    if (!lock) {
      logger.warn('Attempted to release non-existent lock', { trackId, filePath: normalizedPath });
      return;
    }

    // Write lock
    if (lock.mode === 'write') {
      if (lock.trackId !== trackId) {
        logger.warn('Attempted to release lock not owned', { trackId, filePath: normalizedPath, owner: lock.trackId });
        return;
      }

      this.locks.delete(normalizedPath);
      logger.debug('Write lock released', { trackId, filePath: normalizedPath });
      return;
    }

    // Read lock
    if (lock.mode === 'read') {
      const readers = lock.readers ?? [lock.trackId];
      const remainingReaders = readers.filter(r => r !== trackId);

      if (remainingReaders.length === 0) {
        // Last reader, remove lock
        this.locks.delete(normalizedPath);
        logger.debug('Read lock released (last reader)', { trackId, filePath: normalizedPath });
      } else {
        // Update readers
        lock.readers = remainingReaders;
        logger.debug('Read lock released (readers remaining)', {
          trackId,
          filePath: normalizedPath,
          remaining: remainingReaders.length,
        });
      }
    }
  }

  async acquireWithTimeout(
    trackId: string,
    filePath: string,
    mode: 'read' | 'write',
    timeout: number = 30000
  ): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const acquired = await this.acquireLock(trackId, filePath, mode);
      if (acquired) return true;

      // Wait 100ms before retrying
      await sleep(100);
    }

    // Timeout
    logger.error('Lock acquisition timeout', {
      trackId,
      filePath,
      mode,
      timeout,
      elapsedMs: Date.now() - start,
    });

    return false;
  }

  getLockedFiles(trackId: string): string[] {
    return Array.from(this.locks.values())
      .filter(lock => lock.trackId === trackId || lock.readers?.includes(trackId))
      .map(lock => lock.filePath);
  }

  hasConflict(filePath: string, mode: 'read' | 'write'): boolean {
    const normalizedPath = path.normalize(filePath);
    const lock = this.locks.get(normalizedPath);

    if (!lock) return false;

    // Write mode conflicts with any lock
    if (mode === 'write') return true;

    // Read mode conflicts only with write lock
    return lock.mode === 'write';
  }

  // Get all locks (for debugging)
  getAllLocks(): FileLock[] {
    return Array.from(this.locks.values());
  }
}
```

### Dependency-Aware Scheduler

```typescript
class DependencyScheduler {
  private graph = new DependencyGraph();

  async schedule(tasks: Task[], config: SchedulerConfig): Promise<Schedule> {
    // 1. Build dependency graph
    for (const task of tasks) {
      this.graph.addTask(task);
    }

    // 2. Detect circular dependencies
    const cycles = this.graph.detectCircularDependencies();
    if (cycles.length > 0) {
      throw new Error(`Circular dependencies detected: ${cycles.join(', ')}`);
    }

    // 3. Topological sort (dependency order)
    const sorted = this.graph.topologicalSort();

    // 4. Group into parallel batches
    const batches = await this.groupIntoBatches(sorted, config);

    // 5. Allocate resources (budget, model) per batch
    const schedule = await this.allocateResources(batches, config);

    return schedule;
  }

  private async groupIntoBatches(
    tasks: Task[],
    config: SchedulerConfig
  ): Promise<Task[][]> {
    const batches: Task[][] = [];
    const assigned = new Set<string>();
    const completed = new Set<string>();

    while (assigned.size < tasks.length) {
      // Get tasks ready to run (dependencies satisfied)
      const readyTasks = this.graph.getReadyTasks(completed);
      const unassignedReady = readyTasks.filter(t => !assigned.has(t.id));

      if (unassignedReady.length === 0) {
        // Deadlock or waiting on dependencies
        // Mark first incomplete dependency as "completed" for next iteration
        const blockedTask = tasks.find(t => !assigned.has(t.id));
        if (blockedTask?.dependsOn?.[0]) {
          completed.add(blockedTask.dependsOn[0]);
        }
        continue;
      }

      // Group ready tasks into a batch (max maxTracks tasks)
      const batch: Task[] = [];
      for (const task of unassignedReady) {
        if (batch.length >= config.maxTracks) break;

        // Check file conflicts with tasks already in batch
        const canAdd = await this.canAddToBatch(task, batch);
        if (canAdd) {
          batch.push(task);
          assigned.add(task.id);
        }
      }

      if (batch.length > 0) {
        batches.push(batch);

        // Mark tasks as "completed" for dependency resolution
        for (const task of batch) {
          completed.add(task.id);
        }
      }
    }

    return batches;
  }

  private async canAddToBatch(task: Task, batchTasks: Task[]): Promise<boolean> {
    // Check file conflicts with existing tasks in batch
    const taskFiles = await this.getTaskFiles(task);

    for (const existingTask of batchTasks) {
      const existingFiles = await this.getTaskFiles(existingTask);
      const overlap = taskFiles.filter(f => existingFiles.includes(f));

      if (overlap.length > 0) {
        // File conflict detected
        logger.debug('File conflict detected, cannot add to batch', {
          task: task.id,
          existingTask: existingTask.id,
          conflictingFiles: overlap,
        });
        return false;
      }
    }

    return true;
  }

  private async allocateResources(
    batches: Task[][],
    config: SchedulerConfig
  ): Promise<Schedule> {
    const schedule: Schedule = {
      batches: [],
      totalBudget: config.budget,
      estimatedDuration: 0,
      estimatedSpeedup: 0,
    };

    let sequentialTime = 0;

    for (const [index, batch] of batches.entries()) {
      const batchSchedule = await this.scheduleBatch(batch, config, index);
      schedule.batches.push(batchSchedule);
      schedule.estimatedDuration += batchSchedule.estimatedDuration;

      // Calculate sequential time
      sequentialTime += batch.reduce((sum, task) => {
        const track = batchSchedule.tracks.find(t => t.task.id === task.id);
        return sum + (track?.estimatedDuration ?? 0);
      }, 0);
    }

    // Calculate speedup
    schedule.estimatedSpeedup = sequentialTime / schedule.estimatedDuration;

    return schedule;
  }

  private async scheduleBatch(
    tasks: Task[],
    config: SchedulerConfig,
    batchId: number
  ): Promise<BatchSchedule> {
    const budgetPerTrack = config.budget / tasks.length;
    const tracks: TrackSchedule[] = [];

    for (const task of tasks) {
      // Route model for task (Sprint 38 integration)
      const routing = await resourceRouter.selectModel(task, {
        budget: { session: budgetPerTrack, daily: config.budget },
        qualityGate: await qualityGates.getRequirements(task.type),
        strategy: config.strategy ?? 'balanced',
      });

      // Estimate duration
      const duration = await this.estimateDuration(task, routing.model);

      // Get files task will touch
      const files = await this.getTaskFiles(task);

      tracks.push({
        trackId: `track-${batchId}-${tracks.length + 1}`,
        task,
        model: routing.model,
        budget: budgetPerTrack,
        estimatedCost: routing.estimatedCost,
        estimatedDuration: duration,
        files,
      });
    }

    return {
      batchId,
      tracks,
      estimatedDuration: Math.max(...tracks.map(t => t.estimatedDuration)),  // Parallel, so max
      dependencies: [],
    };
  }

  private async estimateDuration(task: Task, model: string): Promise<number> {
    // Base estimates by task type (milliseconds)
    const baseEstimates: Record<TaskType, number> = {
      code_implementation: 180000,  // 3 min
      test_writing: 120000,         // 2 min
      bug_fix: 60000,               // 1 min
      refactoring: 150000,          // 2.5 min
      documentation: 90000,         // 1.5 min
      formatting: 30000,            // 30 sec
      code_review: 120000,          // 2 min
      architecture: 300000,         // 5 min
    };

    return baseEstimates[task.type] ?? 120000;
  }

  private async getTaskFiles(task: Task): Promise<string[]> {
    // Extract files from task description or metadata
    // Conservative: if uncertain, return all modified files
    return task.files ?? [];
  }
}
```

### Dependency Graph Implementation

```typescript
class DependencyGraph {
  private nodes = new Map<string, Task>();
  private edges = new Map<string, Set<string>>();  // task ID → dependencies

  addTask(task: Task): void {
    this.nodes.set(task.id, task);
    if (!this.edges.has(task.id)) {
      this.edges.set(task.id, new Set());
    }

    // Add dependencies
    if (task.dependsOn) {
      for (const depId of task.dependsOn) {
        this.edges.get(task.id)!.add(depId);
      }
    }
  }

  detectCircularDependencies(): string[] {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const cycles: string[] = [];

    const dfs = (taskId: string): boolean => {
      if (stack.has(taskId)) {
        cycles.push(taskId);
        return true;
      }
      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      stack.add(taskId);

      const deps = this.edges.get(taskId) ?? new Set();
      for (const depId of deps) {
        if (dfs(depId)) return true;
      }

      stack.delete(taskId);
      return false;
    };

    for (const taskId of this.nodes.keys()) {
      dfs(taskId);
    }

    return cycles;
  }

  getReadyTasks(completedTasks: Set<string>): Task[] {
    const ready: Task[] = [];

    for (const [taskId, task] of this.nodes.entries()) {
      if (completedTasks.has(taskId)) continue;

      const deps = this.edges.get(taskId) ?? new Set();
      const allDepsComplete = Array.from(deps).every(depId => completedTasks.has(depId));

      if (allDepsComplete) {
        ready.push(task);
      }
    }

    return ready;
  }

  topologicalSort(): Task[] {
    const sorted: Task[] = [];
    const visited = new Set<string>();

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = this.nodes.get(taskId);
      if (!task) return;

      // Visit dependencies first (DFS)
      const deps = this.edges.get(taskId) ?? new Set();
      for (const depId of deps) {
        visit(depId);
      }

      sorted.push(task);
    };

    for (const taskId of this.nodes.keys()) {
      visit(taskId);
    }

    return sorted;
  }

  getTask(taskId: string): Task | undefined {
    return this.nodes.get(taskId);
  }

  getAllTasks(): Task[] {
    return Array.from(this.nodes.values());
  }
}
```

### Parallel Executor

```typescript
class ParallelExecutor {
  private trackManager: TrackManager;
  private scheduler: DependencyScheduler;
  private fileLockManager: FileLockManager;

  async execute(
    tasks: Task[],
    config: ParallelExecutionConfig
  ): Promise<ParallelExecutionResult> {
    // 1. Schedule tasks into batches
    const schedule = await this.scheduler.schedule(tasks, {
      budget: config.budget,
      maxTracks: config.maxTracks ?? 3,
      strategy: config.strategy ?? 'balanced',
    });

    logger.info('Parallel execution schedule created', {
      batches: schedule.batches.length,
      totalTracks: schedule.batches.reduce((sum, b) => sum + b.tracks.length, 0),
      estimatedDuration: schedule.estimatedDuration,
      estimatedSpeedup: schedule.estimatedSpeedup,
    });

    // 2. Execute batches sequentially (tasks within batch run in parallel)
    const results: BatchResult[] = [];
    for (const batch of schedule.batches) {
      const batchResult = await this.executeBatch(batch, config);
      results.push(batchResult);

      // Checkpoint after each batch (optional)
      if (config.checkpointOnBatchComplete) {
        await checkpoint.create({
          reason: 'parallel_batch_complete',
          description: `Batch ${batch.batchId} completed (${batchResult.tracks.length} tracks)`,
          metadata: {
            batchId: batch.batchId,
            trackCount: batchResult.tracks.length,
            cost: batchResult.cost,
            duration: batchResult.duration,
          },
        });
      }

      // Check budget
      const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
      if (totalCost >= config.budget) {
        logger.warn('Budget exhausted during parallel execution', { totalCost, budget: config.budget });
        break;
      }
    }

    // 3. Calculate results
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const wallClockTime = Date.now() - config.startTime;
    const speedup = this.calculateSpeedup(results);

    return {
      batches: results,
      totalCost,
      totalDuration,
      wallClockTime,
      speedup,
      success: results.every(r => r.success),
    };
  }

  private async executeBatch(
    batch: BatchSchedule,
    config: ParallelExecutionConfig
  ): Promise<BatchResult> {
    const startTime = Date.now();

    // Create tracks from batch schedule
    const tracks = await Promise.all(
      batch.tracks.map(t => this.trackManager.createTrack(t.trackId, [t.task], t.budget, t.model))
    );

    logger.info(`Executing batch ${batch.batchId} with ${tracks.length} parallel tracks`);

    // Execute tracks in parallel (Promise.all)
    const trackResults = await this.trackManager.executeTracks();

    const duration = Date.now() - startTime;
    const cost = trackResults.reduce((sum, r) => sum + (r.cost ?? 0), 0);

    return {
      batchId: `batch-${batch.batchId}`,
      tracks: trackResults,
      cost,
      duration,
      success: trackResults.every(r => r.status === 'completed'),
    };
  }

  private calculateSpeedup(results: BatchResult[]): number {
    // Sequential time: sum of all track durations
    const sequentialTime = results.reduce((sum, batch) =>
      sum + batch.tracks.reduce((trackSum, track) => trackSum + (track.duration ?? 0), 0),
      0
    );

    // Parallel time: sum of batch durations (max of concurrent tracks)
    const parallelTime = results.reduce((sum, batch) => sum + batch.duration, 0);

    if (parallelTime === 0) return 1;

    return sequentialTime / parallelTime;
  }
}
```

### Task Dependency Examples

```typescript
// Example 1: Tests depend on implementation
const implementTask: Task = {
  id: 'impl-auth-1',
  type: 'code_implementation',
  description: 'Implement user authentication',
  files: ['src/auth/auth.ts', 'src/auth/types.ts'],
  dependsOn: [],  // No dependencies
};

const testTask: Task = {
  id: 'test-auth-1',
  type: 'test_writing',
  description: 'Write tests for authentication',
  files: ['tests/auth/auth.test.ts'],
  dependsOn: ['impl-auth-1'],  // Depends on implementation
};

// Example 2: Parallel independent tasks
const formatTask: Task = {
  id: 'format-all',
  type: 'formatting',
  description: 'Format codebase',
  files: ['src/**/*.ts'],
  dependsOn: [],  // Independent
};

const docsTask: Task = {
  id: 'docs-readme',
  type: 'documentation',
  description: 'Update README',
  files: ['README.md'],
  dependsOn: [],  // Independent
};

// Execution schedule:
// Batch 1 (parallel): implementTask, formatTask, docsTask
// Batch 2 (sequential): testTask (depends on implementTask)
```

### Max Tracks Enforcement

```typescript
class TrackManager {
  private maxTracks = 3;  // Hard limit

  async createTrack(
    id: string,
    tasks: Task[],
    budget: number,
    model: string
  ): Promise<Track> {
    if (this.tracks.size >= this.maxTracks) {
      throw new Error(`Maximum tracks (${this.maxTracks}) reached. Cannot create more tracks.`);
    }

    const track: Track = {
      id,
      name: `Track ${this.tracks.size + 1}`,
      status: 'idle',
      tasks,
      currentTask: null,
      dependencies: [],
      fileLocks: new Set(),
      budget: { allocated: budget, used: 0 },
      model,
      createdAt: new Date(),
    };

    this.tracks.set(id, track);
    logger.info('Track created', { trackId: id, taskCount: tasks.length, budget, model });

    return track;
  }

  // Enforce max tracks in scheduler
  private async groupIntoBatches(tasks: Task[]): Promise<Task[][]> {
    // ...
    for (const task of unassignedReady) {
      if (batch.length >= this.maxTracks) break;  // Enforce limit
      // ...
    }
    // ...
  }
}
```

## Alternatives Considered

### 1. Multi-Process Model
- **Pros**: True CPU parallelism, process isolation
- **Cons**: IPC complexity, shared state issues, higher overhead
- **Decision**: Rejected - AI work is I/O-bound, not CPU-bound

### 2. Worker Threads
- **Pros**: Shared memory, true parallelism
- **Cons**: Thread safety, complexity, overkill for I/O
- **Decision**: Rejected - async/await is simpler and sufficient

### 3. Unlimited Parallel Tracks
- **Pros**: Maximum parallelism
- **Cons**: Context switching overhead, API rate limits, complexity
- **Decision**: Rejected - 2-3 tracks is optimal balance

### 4. No File Locking
- **Pros**: Simpler, faster
- **Cons**: Concurrent edit conflicts, data corruption
- **Decision**: Rejected - file locking is critical for correctness

### 5. Database-Based Locking
- **Pros**: Distributed locking, persistent
- **Cons**: Overkill for single-process, adds dependency
- **Decision**: Rejected - in-memory locking is sufficient

## Consequences

### Positive
- **50-60% Faster**: Wall-clock time reduced significantly
- **Better Resource Utilization**: CPU and network idle time minimized
- **Correctness Preserved**: File locks prevent conflicts
- **Simple**: Single-process async/await model
- **Scalable**: Easy to tune max tracks (2-3 optimal)

### Negative
- **Complexity**: More moving parts than sequential execution
- **Deadlock Risk**: File lock timeout required
- **Budget Tracking**: Per-track budgets add complexity
- **Debugging**: Parallel execution harder to trace

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **File Lock Deadlock** | Tasks blocked forever | 30s timeout, escalate on timeout |
| **Context Switching Overhead** | Slower than sequential | Max 3 tracks limit |
| **Budget Tracking Errors** | Overspending per track | Separate budget allocator, clear logging |
| **Dependency Graph Errors** | Wrong execution order | Circular dependency detection, tests |
| **Single-Process Limitations** | Can't fully utilize CPU | Acceptable for I/O-bound AI tasks |

## Implementation Plan

### Sprint 39 Week 1: Track Manager & File Locks
- Day 1: ADR-008 approval, track types
- Day 2-3: FileLockManager, lock registry, conflict detector
- Day 4: DependencyGraph, dependency resolver
- Day 5: TrackManager core, track executor

### Sprint 39 Week 2: Scheduler & Integration
- Day 6-7: DependencyScheduler, resource allocator
- Day 8: ParallelExecutor integration
- Day 9: CLI integration (parallel commands)
- Day 10: E2E testing, sprint review

## Verification

### Unit Tests
```typescript
describe('FileLockManager', () => {
  it('should acquire write lock exclusively');
  it('should allow multiple read locks');
  it('should block write lock if read lock held');
  it('should timeout after 30 seconds');
  it('should release locks correctly');
});

describe('DependencyGraph', () => {
  it('should detect circular dependencies');
  it('should topologically sort tasks');
  it('should return ready tasks');
  it('should handle complex dependencies');
});

describe('TrackManager', () => {
  it('should enforce max 3 tracks');
  it('should execute tracks in parallel');
  it('should handle track failures');
  it('should track budget per track');
});

describe('DependencyScheduler', () => {
  it('should group independent tasks into batches');
  it('should respect task dependencies');
  it('should detect file conflicts');
  it('should allocate resources correctly');
});
```

### Integration Tests
- Full parallel execution: schedule → execute → checkpoint
- File conflict detection and serialization
- Budget tracking per track
- Dependency resolution correctness

### E2E Test Scenarios (Sprint 39 Day 10)
1. 3 independent tasks → 3 parallel tracks
2. Tasks with dependencies → sequential batches
3. File conflict → tasks serialized
4. Budget per track → track pauses at limit
5. File lock timeout → track blocked
6. Circular dependency → error
7. Wall-clock time reduced 50-60%
8. Checkpoint on batch completion
9. Mixed Ollama + Claude tracks
10. Full parallel session with routing + budget

## Related ADRs
- **ADR-006**: Checkpoint State Model (checkpoint on batch completion)
- **ADR-007**: Autonomous Execution Budget (per-track budgets)
- **ADR-009**: Self-Correction (parallel test fixing)

## Expert Feedback

### CPO Feedback (Autonomy Epic Planning)
> "2-3 parallel tracks max. Single-process model. File locks prevent conflicts. No over-engineering."

**Decision**: Max 3 tracks, single-process async/await, file-level locking.

### CTO Feedback (Concurrency Model)
> "JavaScript event loop is perfect for I/O-bound AI work. No need for worker threads or multi-process."

**Decision**: Single-process async/await model.

### Architect Feedback (File Locking)
> "30 second timeout is reasonable. If a file lock can't be acquired in 30s, something's wrong."

**Decision**: 30s timeout with escalation on failure.

## References

### Concurrency Patterns
- JavaScript async/await: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
- Dependency graphs: https://en.wikipedia.org/wiki/Topological_sorting
- File locking: https://en.wikipedia.org/wiki/File_locking

### Tools Evaluated
- **Bull Queue**: Job scheduling (overkill for single-process)
- **Async.js**: Async utilities (decided on native Promise.all)
- **Custom Implementation**: Chosen for full control

---

*ADR-008 created for EndiorBot Concurrency Model*
*SDLC Framework v6.4.0*
