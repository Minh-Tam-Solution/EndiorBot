/**
 * Dependency Graph
 *
 * Manages task dependencies for parallel execution.
 * Supports circular detection, topological sort, and dynamic updates.
 *
 * @module agents/parallel/dependency-graph
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 40 Parallel Execution
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { ParallelTask, ParallelTaskStatus } from "../types.js";

// ============================================================================
// Types
// ============================================================================

export interface TaskNode {
  /** Task definition */
  task: ParallelTask;
  /** Task status */
  status: ParallelTaskStatus;
  /** Direct dependencies (task IDs) */
  dependencies: Set<string>;
  /** Tasks depending on this one (task IDs) */
  dependents: Set<string>;
  /** Files this task reads */
  reads: Set<string>;
  /** Files this task writes */
  writes: Set<string>;
}

export interface DependencyConflict {
  /** Type of conflict */
  type: "circular" | "write-write" | "missing";
  /** Task IDs involved */
  taskIds: string[];
  /** Conflict description */
  description: string;
}

export interface GraphAnalysis {
  /** Total tasks */
  totalTasks: number;
  /** Tasks with no dependencies */
  rootTasks: string[];
  /** Tasks with no dependents */
  leafTasks: string[];
  /** Maximum dependency depth */
  maxDepth: number;
  /** Detected conflicts */
  conflicts: DependencyConflict[];
  /** Valid graph (no conflicts) */
  isValid: boolean;
}

// ============================================================================
// Dependency Graph
// ============================================================================

/**
 * DependencyGraph - Manages task dependencies.
 *
 * Features:
 * 1. Track explicit task dependencies
 * 2. Infer dependencies from file reads/writes
 * 3. Detect circular dependencies
 * 4. Detect write-write conflicts
 * 5. Topological sort for execution order
 */
export class DependencyGraph {
  private nodes: Map<string, TaskNode> = new Map();
  private fileWriters: Map<string, Set<string>> = new Map();

  /**
   * Add a task to the graph.
   */
  addTask(task: ParallelTask): void {
    // Create node
    const node: TaskNode = {
      task,
      status: "pending",
      dependencies: new Set(task.dependsOn ?? []),
      dependents: new Set(),
      reads: new Set(task.reads ?? []),
      writes: new Set(task.writes ?? []),
    };

    this.nodes.set(task.id, node);

    // Track file writers
    for (const file of node.writes) {
      const writers = this.fileWriters.get(file) ?? new Set();
      writers.add(task.id);
      this.fileWriters.set(file, writers);
    }

    // Update dependents of existing nodes
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents.add(task.id);
      }
    }

    // Infer dependencies from file reads/writes
    this.inferFileDependencies(task.id);
  }

  /**
   * Remove a task from the graph.
   */
  removeTask(taskId: string): boolean {
    const node = this.nodes.get(taskId);
    if (!node) return false;

    // Remove from file writers
    for (const file of node.writes) {
      const writers = this.fileWriters.get(file);
      if (writers) {
        writers.delete(taskId);
        if (writers.size === 0) {
          this.fileWriters.delete(file);
        }
      }
    }

    // Remove from dependencies
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents.delete(taskId);
      }
    }

    // Remove from dependents
    for (const dependentId of node.dependents) {
      const dependentNode = this.nodes.get(dependentId);
      if (dependentNode) {
        dependentNode.dependencies.delete(taskId);
      }
    }

    this.nodes.delete(taskId);
    return true;
  }

  /**
   * Infer dependencies from file operations.
   */
  private inferFileDependencies(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (!node) return;

    // If this task reads a file, it depends on any task that writes to it
    for (const readFile of node.reads) {
      const writers = this.fileWriters.get(readFile);
      if (writers) {
        for (const writerId of writers) {
          if (writerId !== taskId && !node.dependencies.has(writerId)) {
            node.dependencies.add(writerId);
            const writerNode = this.nodes.get(writerId);
            if (writerNode) {
              writerNode.dependents.add(taskId);
            }
          }
        }
      }
    }
  }

  /**
   * Update task status.
   */
  updateStatus(taskId: string, status: ParallelTaskStatus): void {
    const node = this.nodes.get(taskId);
    if (node) {
      node.status = status;
    }
  }

  /**
   * Get task node.
   */
  getTask(taskId: string): TaskNode | undefined {
    return this.nodes.get(taskId);
  }

  /**
   * Get all task nodes.
   */
  getAllTasks(): TaskNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get tasks ready for execution.
   * A task is ready if all dependencies are completed.
   */
  getReadyTasks(): TaskNode[] {
    const ready: TaskNode[] = [];

    for (const node of this.nodes.values()) {
      if (node.status !== "pending") continue;

      // Check all dependencies completed
      let allDepsComplete = true;
      for (const depId of node.dependencies) {
        const depNode = this.nodes.get(depId);
        if (!depNode || depNode.status !== "completed") {
          allDepsComplete = false;
          break;
        }
      }

      if (allDepsComplete) {
        ready.push(node);
      }
    }

    // Sort by priority (higher first)
    return ready.sort((a, b) => (b.task.priority ?? 0) - (a.task.priority ?? 0));
  }

  /**
   * Check for circular dependencies using DFS.
   */
  detectCircularDependencies(): DependencyConflict[] {
    const conflicts: DependencyConflict[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string): boolean => {
      if (recursionStack.has(taskId)) {
        // Found cycle
        const cycleStart = path.indexOf(taskId);
        const cycle = path.slice(cycleStart);
        cycle.push(taskId);
        conflicts.push({
          type: "circular",
          taskIds: cycle,
          description: `Circular dependency: ${cycle.join(" -> ")}`,
        });
        return true;
      }

      if (visited.has(taskId)) return false;

      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const node = this.nodes.get(taskId);
      if (node) {
        for (const depId of node.dependencies) {
          if (dfs(depId)) {
            return true;
          }
        }
      }

      path.pop();
      recursionStack.delete(taskId);
      return false;
    };

    for (const taskId of this.nodes.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    }

    return conflicts;
  }

  /**
   * Detect write-write conflicts.
   */
  detectWriteConflicts(): DependencyConflict[] {
    const conflicts: DependencyConflict[] = [];

    for (const [file, writers] of this.fileWriters) {
      if (writers.size <= 1) continue;

      // Check if writers have dependency relationship
      const writerArray = Array.from(writers);
      for (let i = 0; i < writerArray.length; i++) {
        for (let j = i + 1; j < writerArray.length; j++) {
          const task1 = writerArray[i] as string;
          const task2 = writerArray[j] as string;

          if (!this.hasDependency(task1, task2) && !this.hasDependency(task2, task1)) {
            conflicts.push({
              type: "write-write",
              taskIds: [task1, task2],
              description: `Concurrent writes to ${file} from ${task1} and ${task2}`,
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect missing dependencies.
   */
  detectMissingDependencies(): DependencyConflict[] {
    const conflicts: DependencyConflict[] = [];

    for (const node of this.nodes.values()) {
      for (const depId of node.dependencies) {
        if (!this.nodes.has(depId)) {
          conflicts.push({
            type: "missing",
            taskIds: [node.task.id, depId],
            description: `Task ${node.task.id} depends on missing task ${depId}`,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if task1 depends on task2 (directly or transitively).
   */
  hasDependency(task1: string, task2: string): boolean {
    const visited = new Set<string>();

    const search = (taskId: string): boolean => {
      if (visited.has(taskId)) return false;
      visited.add(taskId);

      const node = this.nodes.get(taskId);
      if (!node) return false;

      if (node.dependencies.has(task2)) return true;

      for (const depId of node.dependencies) {
        if (search(depId)) return true;
      }

      return false;
    };

    return search(task1);
  }

  /**
   * Perform topological sort.
   * Returns tasks in dependency order (dependencies first).
   */
  topologicalSort(): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (taskId: string): boolean => {
      if (temp.has(taskId)) {
        // Circular dependency
        return false;
      }
      if (visited.has(taskId)) {
        return true;
      }

      temp.add(taskId);

      const node = this.nodes.get(taskId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!visit(depId)) {
            return false;
          }
        }
      }

      temp.delete(taskId);
      visited.add(taskId);
      result.push(taskId);

      return true;
    };

    for (const taskId of this.nodes.keys()) {
      if (!visited.has(taskId)) {
        if (!visit(taskId)) {
          // Graph has cycle, return empty
          return [];
        }
      }
    }

    return result;
  }

  /**
   * Analyze the graph.
   */
  analyze(): GraphAnalysis {
    const rootTasks: string[] = [];
    const leafTasks: string[] = [];
    const depths = new Map<string, number>();

    // Find roots and leaves
    for (const [taskId, node] of this.nodes) {
      if (node.dependencies.size === 0) {
        rootTasks.push(taskId);
      }
      if (node.dependents.size === 0) {
        leafTasks.push(taskId);
      }
    }

    // Calculate depths using BFS from roots
    const queue: Array<{ id: string; depth: number }> = rootTasks.map((id) => ({
      id,
      depth: 0,
    }));
    let maxDepth = 0;

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (depths.has(id)) continue;
      depths.set(id, depth);
      maxDepth = Math.max(maxDepth, depth);

      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependents) {
          queue.push({ id: depId, depth: depth + 1 });
        }
      }
    }

    // Detect conflicts
    const conflicts: DependencyConflict[] = [
      ...this.detectCircularDependencies(),
      ...this.detectWriteConflicts(),
      ...this.detectMissingDependencies(),
    ];

    return {
      totalTasks: this.nodes.size,
      rootTasks,
      leafTasks,
      maxDepth,
      conflicts,
      isValid: conflicts.length === 0,
    };
  }

  /**
   * Clear all tasks.
   */
  clear(): void {
    this.nodes.clear();
    this.fileWriters.clear();
  }

  /**
   * Get task count.
   */
  get size(): number {
    return this.nodes.size;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a DependencyGraph instance.
 */
export function createDependencyGraph(): DependencyGraph {
  return new DependencyGraph();
}

/**
 * Create a DependencyGraph from tasks.
 */
export function createDependencyGraphFromTasks(tasks: ParallelTask[]): DependencyGraph {
  const graph = new DependencyGraph();
  for (const task of tasks) {
    graph.addTask(task);
  }
  return graph;
}
