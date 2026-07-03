/**
 * File Lock Manager
 *
 * Provides file locking mechanism for parallel task execution.
 * Supports read/write locks with timeout and conflict detection.
 *
 * @module infra/file-lock
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 40 Parallel Execution
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Types
// ============================================================================

export type LockType = "read" | "write";

export interface LockRequest {
  /** Path to lock */
  path: string;
  /** Lock type */
  type: LockType;
  /** Owner identifier (track/task ID) */
  owner: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to wait for lock acquisition */
  blocking?: boolean;
}

export interface Lock {
  /** Unique lock ID */
  id: string;
  /** Locked path */
  path: string;
  /** Lock type */
  type: LockType;
  /** Owner identifier */
  owner: string;
  /** Acquisition timestamp */
  acquiredAt: Date;
  /** Expiration timestamp (if timeout set) */
  expiresAt?: Date;
}

export interface LockConflict {
  /** The path that has conflict */
  path: string;
  /** Current lock holder */
  holder: Lock;
  /** Requested lock type */
  requestedType: LockType;
  /** Requester identifier */
  requester: string;
  /** Conflict reason */
  reason: string;
}

export interface LockResult {
  /** Whether lock was acquired */
  acquired: boolean;
  /** Lock object if acquired */
  lock?: Lock;
  /** Conflict info if not acquired */
  conflict?: LockConflict;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 100;

// ============================================================================
// File Lock Manager
// ============================================================================

/**
 * FileLockManager - Manages file locks for parallel execution.
 *
 * Features:
 * 1. Read locks (shared) - Multiple readers allowed
 * 2. Write locks (exclusive) - Single writer only
 * 3. Timeout-based acquisition
 * 4. Conflict detection and reporting
 */
export class FileLockManager {
  private locks: Map<string, Lock[]> = new Map();
  private lockCounter = 0;

  /**
   * Acquire a lock on a path.
   */
  async acquire(request: LockRequest): Promise<LockResult> {
    const { path, type, owner, timeout = DEFAULT_TIMEOUT_MS, blocking = true } = request;
    const startTime = Date.now();

    // Try immediate acquisition
    const immediateResult = this.tryAcquire(path, type, owner, timeout);
    if (immediateResult.acquired) {
      return immediateResult;
    }

    // Non-blocking: return immediately with conflict
    if (!blocking) {
      return immediateResult;
    }

    // Blocking: wait for lock
    while (Date.now() - startTime < timeout) {
      await this.sleep(POLL_INTERVAL_MS);

      // Clean expired locks
      this.cleanExpiredLocks(path);

      const result = this.tryAcquire(path, type, owner, timeout);
      if (result.acquired) {
        return result;
      }
    }

    // Timeout: return conflict
    const existingLocks = this.locks.get(path) ?? [];
    return {
      acquired: false,
      conflict: {
        path,
        holder: existingLocks[0]!,
        requestedType: type,
        requester: owner,
        reason: `Lock acquisition timed out after ${timeout}ms`,
      },
    };
  }

  /**
   * Try to acquire lock without waiting.
   */
  private tryAcquire(
    path: string,
    type: LockType,
    owner: string,
    timeout: number
  ): LockResult {
    const existingLocks = this.locks.get(path) ?? [];

    // Check for conflicts
    const conflict = this.detectConflict(existingLocks, type, owner, path);
    if (conflict) {
      return { acquired: false, conflict };
    }

    // Create new lock
    const lock: Lock = {
      id: `lock-${++this.lockCounter}`,
      path,
      type,
      owner,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + timeout),
    };

    // Add to locks
    const pathLocks = this.locks.get(path) ?? [];
    pathLocks.push(lock);
    this.locks.set(path, pathLocks);

    return { acquired: true, lock };
  }

  /**
   * Detect conflicts with existing locks.
   */
  private detectConflict(
    existingLocks: Lock[],
    requestedType: LockType,
    requester: string,
    path: string
  ): LockConflict | undefined {
    // No existing locks = no conflict
    if (existingLocks.length === 0) {
      return undefined;
    }

    for (const lock of existingLocks) {
      // Same owner can upgrade read to write
      if (lock.owner === requester) {
        // Already has write lock - OK
        if (lock.type === "write") {
          continue;
        }
        // Has read, requesting write - conflict (upgrade not supported)
        if (lock.type === "read" && requestedType === "write") {
          return {
            path,
            holder: lock,
            requestedType,
            requester,
            reason: "Cannot upgrade read lock to write lock",
          };
        }
        continue;
      }

      // Different owner
      // Write lock blocks everything
      if (lock.type === "write") {
        return {
          path,
          holder: lock,
          requestedType,
          requester,
          reason: "Path is locked for writing by another owner",
        };
      }

      // Read lock blocks write
      if (lock.type === "read" && requestedType === "write") {
        return {
          path,
          holder: lock,
          requestedType,
          requester,
          reason: "Cannot acquire write lock while path has read locks",
        };
      }

      // Read locks are compatible with each other
    }

    return undefined;
  }

  /**
   * Release a lock.
   */
  release(lockOrId: Lock | string): boolean {
    const lockId = typeof lockOrId === "string" ? lockOrId : lockOrId.id;

    for (const [path, pathLocks] of this.locks.entries()) {
      const index = pathLocks.findIndex((l) => l.id === lockId);
      if (index !== -1) {
        pathLocks.splice(index, 1);
        if (pathLocks.length === 0) {
          this.locks.delete(path);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Release all locks held by an owner.
   */
  releaseAll(owner: string): number {
    let count = 0;

    for (const [_path, pathLocks] of this.locks.entries()) {
      const ownerLocks = pathLocks.filter((l) => l.owner === owner);
      for (const lock of ownerLocks) {
        this.release(lock);
        count++;
      }
    }

    return count;
  }

  /**
   * Check if a path is locked.
   */
  isLocked(path: string, type?: LockType): boolean {
    const locks = this.locks.get(path);
    if (!locks || locks.length === 0) {
      return false;
    }

    if (!type) {
      return true;
    }

    return locks.some((l) => l.type === type);
  }

  /**
   * Get all locks for a path.
   */
  getLocks(path: string): Lock[] {
    return this.locks.get(path) ?? [];
  }

  /**
   * Get all locks held by an owner.
   */
  getOwnerLocks(owner: string): Lock[] {
    const result: Lock[] = [];

    for (const pathLocks of this.locks.values()) {
      for (const lock of pathLocks) {
        if (lock.owner === owner) {
          result.push(lock);
        }
      }
    }

    return result;
  }

  /**
   * Get all active locks.
   */
  getAllLocks(): Lock[] {
    const result: Lock[] = [];

    for (const pathLocks of this.locks.values()) {
      result.push(...pathLocks);
    }

    return result;
  }

  /**
   * Clean expired locks for a path.
   */
  private cleanExpiredLocks(path: string): void {
    const locks = this.locks.get(path);
    if (!locks) return;

    const now = Date.now();
    const activeLocks = locks.filter((l) => {
      if (!l.expiresAt) return true;
      return l.expiresAt.getTime() > now;
    });

    if (activeLocks.length !== locks.length) {
      if (activeLocks.length === 0) {
        this.locks.delete(path);
      } else {
        this.locks.set(path, activeLocks);
      }
    }
  }

  /**
   * Clean all expired locks.
   */
  cleanAllExpired(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [path, locks] of this.locks.entries()) {
      const before = locks.length;
      const activeLocks = locks.filter((l) => {
        if (!l.expiresAt) return true;
        return l.expiresAt.getTime() > now;
      });

      cleaned += before - activeLocks.length;

      if (activeLocks.length === 0) {
        this.locks.delete(path);
      } else {
        this.locks.set(path, activeLocks);
      }
    }

    return cleaned;
  }

  /**
   * Clear all locks (for testing/reset).
   */
  clear(): void {
    this.locks.clear();
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let globalLockManager: FileLockManager | undefined;

/**
 * Get the global FileLockManager instance.
 */
export function getFileLockManager(): FileLockManager {
  if (!globalLockManager) {
    globalLockManager = new FileLockManager();
  }
  return globalLockManager;
}

/**
 * Reset the global FileLockManager (for testing).
 */
export function resetFileLockManager(): void {
  globalLockManager?.clear();
  globalLockManager = undefined;
}

/**
 * Create a new FileLockManager instance.
 */
export function createFileLockManager(): FileLockManager {
  return new FileLockManager();
}
