/**
 * Checkpoint Manager
 *
 * Core checkpoint save/load operations for autonomous execution.
 * Implements checkpoint creation, storage, and retrieval per ADR-006.
 *
 * @module sessions/checkpoint/checkpoint
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 2-3
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { readFile, writeFile, readdir, unlink, stat, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { platform, arch } from "node:os";
import type { Session } from "../types.js";
import {
  type CheckpointState,
  type CheckpointSummary,
  type CheckpointReason,
  type SoulType,
  type ExecutionPhase,
  type CheckpointStore,
  type CheckpointMeta,
  type SessionSnapshot,
  type ExecutionContext,
  type RuntimeProvenance,
  type IdempotencyState,
  type FilesystemDelta,
  type GitStateSnapshot,
  type CostState,
  type BrainReference,
  type StateMachineState,
  type TokenUsageRecord,
  CHECKPOINT_SCHEMA_VERSION,
} from "./types.js";
import {
  serializeCheckpoint,
  deserializeCheckpoint,
  isCompressed,
  extractSummary,
  validateCheckpoint,
  sanitizeCheckpoint,
} from "./serializer.js";
import { getBrainCheckpointReference } from "../../brain/evolution.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Default checkpoint directory.
 */
const DEFAULT_CHECKPOINT_DIR = `${process.env.HOME}/.endiorbot/checkpoints`;

/**
 * Checkpoint file extension.
 */
const CHECKPOINT_EXT = ".ckpt.json";

/**
 * Default number of checkpoints to keep.
 */
const DEFAULT_KEEP_COUNT = 10;

// ============================================================================
// Checkpoint ID Generation
// ============================================================================

/**
 * Generate a unique checkpoint ID.
 *
 * @returns Checkpoint ID (e.g., "ckpt-20260322-143000-abc1")
 */
export function generateCheckpointId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const random = Math.random().toString(36).slice(2, 6);
  return `ckpt-${date}-${time}-${random}`;
}

// ============================================================================
// Provenance Collection
// ============================================================================

/**
 * Get current git commit SHA.
 */
function getGitCommitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get current git branch.
 */
function getGitBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get uncommitted file paths.
 */
function getUncommittedChanges(): string[] {
  try {
    const output = execSync("git status --porcelain", { encoding: "utf8" });
    return output
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.slice(3));
  } catch {
    return [];
  }
}

/**
 * Get lockfile hash for dependency verification.
 */
async function getLockfileHash(): Promise<string> {
  const lockfiles = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"];

  for (const lockfile of lockfiles) {
    if (existsSync(lockfile)) {
      try {
        const content = await readFile(lockfile, "utf8");
        return createHash("sha256").update(content).digest("hex").slice(0, 16);
      } catch {
        continue;
      }
    }
  }

  return "no-lockfile";
}

/**
 * Get environment fingerprint (sanitized).
 */
function getEnvFingerprint(): Record<string, string> {
  const safeKeys = ["SHELL", "LANG", "TERM", "NODE_ENV"];
  const fingerprint: Record<string, string> = {};

  for (const key of safeKeys) {
    if (process.env[key]) {
      fingerprint[key] = process.env[key] as string;
    }
  }

  return fingerprint;
}

/**
 * Get runtime fingerprint.
 */
function getRuntimeFingerprint(): string {
  return `${platform()}-${arch()}-node${process.version.slice(1)}`;
}

// ============================================================================
// File Hashing
// ============================================================================

/**
 * Compute SHA256 hash of a file.
 */
export async function hashFile(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath);
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return "";
  }
}

/**
 * Compute file hashes for a list of paths.
 */
export async function hashFiles(paths: string[]): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};

  for (const path of paths) {
    const hash = await hashFile(path);
    if (hash) {
      hashes[path] = hash;
    }
  }

  return hashes;
}

// ============================================================================
// Checkpoint Builder
// ============================================================================

/**
 * Options for creating a checkpoint.
 */
export interface CreateCheckpointOptions {
  /** Reason for checkpoint */
  reason: CheckpointReason;
  /** Human-readable description */
  description?: string;
  /** Current session */
  session: Session;
  /** Active agent persona */
  activeSoul: SoulType;
  /** Current execution phase */
  currentPhase: ExecutionPhase;
  /** Current task ID */
  currentTaskId?: string;
  /** Session cost so far (USD) */
  sessionCostSoFar: number;
  /** Token usage records */
  tokenUsage: TokenUsageRecord[];
  /** Modified file paths */
  modifiedFiles?: string[];
  /** Created file paths */
  createdFiles?: string[];
  /** Brain version */
  brainVersion?: string;
  /** Custom checkpoint ID */
  checkpointId?: string;
}

/**
 * Create a checkpoint from current state.
 *
 * @param options - Checkpoint creation options
 * @returns Complete checkpoint state
 */
export async function createCheckpoint(options: CreateCheckpointOptions): Promise<CheckpointState> {
  const checkpointId = options.checkpointId ?? generateCheckpointId();
  const now = new Date();

  // Collect git state
  const gitBranch = getGitBranch();
  const gitCommit = getGitCommitSha();
  const uncommittedChanges = getUncommittedChanges();

  // Collect provenance
  const lockfileHash = await getLockfileHash();
  const envFingerprint = getEnvFingerprint();
  const runtimeFingerprint = getRuntimeFingerprint();

  // Hash modified files for conflict detection
  const allModifiedPaths = [...(options.modifiedFiles ?? []), ...uncommittedChanges];
  const uniquePaths = [...new Set(allModifiedPaths)];
  const fileHashes = await hashFiles(uniquePaths);

  // Compute execution trace digest
  const traceData = JSON.stringify({
    session: options.session.id,
    phase: options.currentPhase,
    task: options.currentTaskId,
    timestamp: now.toISOString(),
  });
  const executionTraceDigest = createHash("sha256").update(traceData).digest("hex");

  // Get brain reference from Brain module (Sprint 45 integration)
  let brainRef: BrainReference;
  try {
    const brainCheckpointRef = getBrainCheckpointReference();
    brainRef = {
      brainVersion: brainCheckpointRef.brainVersion,
      brainDigest: brainCheckpointRef.brainDigest,
      layerHashes: brainCheckpointRef.layerHashes,
      capturedAt: brainCheckpointRef.capturedAt,
    };
  } catch {
    // Fallback if brain module not initialized
    const brainVersion = options.brainVersion ?? "1.0.0";
    const brainDigest = createHash("sha256").update(`${brainVersion}:${runtimeFingerprint}`).digest("hex");
    brainRef = { brainVersion, brainDigest };
  }

  // Build checkpoint
  const meta: CheckpointMeta = {
    id: checkpointId,
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    createdAt: now,
    reason: options.reason,
  };
  if (options.description !== undefined) {
    meta.description = options.description;
  }

  const session: SessionSnapshot = {
    session: options.session,
    activeSoul: options.activeSoul,
    decisionLog: [],
  };

  const execution: ExecutionContext = {
    currentPhase: options.currentPhase,
    taskQueue: [],
    stepStack: [],
    pendingToolCalls: [],
    partialResults: {},
  };
  if (options.currentTaskId !== undefined) {
    execution.currentTaskId = options.currentTaskId;
  }

  const provenance: RuntimeProvenance = {
    repoCommitSha: gitCommit,
    lockfilesHash: lockfileHash,
    nodeVersion: process.version.slice(1),
    modelConfig: { model: "claude-opus-4" },
    envFingerprint,
    executionTraceDigest,
    runtimeFingerprint,
  };

  const idempotency: IdempotencyState = {
    idempotencyKeys: {},
    completedActions: [],
    idempotencyScope: {},
    toolCallOutputsCache: {},
    toolCallAttempts: {},
    retryBudget: 3,
  };

  const filesystem: FilesystemDelta = {
    modifiedFiles: [],
    createdFiles: options.createdFiles ?? [],
    fileHashes,
  };

  const git: GitStateSnapshot = {
    branch: gitBranch,
    uncommittedChanges,
    lastCheckpointCommit: gitCommit,
  };

  const cost: CostState = {
    sessionCostSoFar: options.sessionCostSoFar,
    tokenUsage: options.tokenUsage,
  };

  const rollback = {};

  const brain: BrainReference = brainRef;

  const statemachine: StateMachineState = {
    gateStatus: {},
    evidenceBindings: {},
    approvalPending: [],
  };

  const checkpoint: CheckpointState = {
    meta,
    session,
    execution,
    provenance,
    idempotency,
    filesystem,
    git,
    cost,
    rollback,
    brain,
    statemachine,
  };

  return checkpoint;
}

// ============================================================================
// File-Based Checkpoint Store
// ============================================================================

/**
 * File-based checkpoint store implementation.
 */
export class FileCheckpointStore implements CheckpointStore {
  private readonly checkpointDir: string;

  constructor(checkpointDir?: string) {
    this.checkpointDir = checkpointDir ?? DEFAULT_CHECKPOINT_DIR;
  }

  /**
   * Ensure checkpoint directory exists.
   */
  private async ensureDir(): Promise<void> {
    if (!existsSync(this.checkpointDir)) {
      await mkdir(this.checkpointDir, { recursive: true });
    }
  }

  /**
   * Get checkpoint file path.
   */
  private getFilePath(checkpointId: string): string {
    return join(this.checkpointDir, `${checkpointId}${CHECKPOINT_EXT}`);
  }

  /**
   * Save a checkpoint to disk.
   */
  async save(checkpoint: CheckpointState): Promise<void> {
    await this.ensureDir();

    // Validate before saving
    validateCheckpoint(checkpoint);

    // Sanitize sensitive data
    const sanitized = sanitizeCheckpoint(checkpoint);

    // Serialize (auto-compress if large)
    const data = serializeCheckpoint(sanitized);

    // Write to file
    const filePath = this.getFilePath(checkpoint.meta.id);
    await writeFile(filePath, data, "utf8");
  }

  /**
   * Load a checkpoint from disk.
   */
  async load(checkpointId: string): Promise<CheckpointState | null> {
    const filePath = this.getFilePath(checkpointId);

    if (!existsSync(filePath)) {
      return null;
    }

    const data = await readFile(filePath, "utf8");
    return deserializeCheckpoint(data);
  }

  /**
   * Delete a checkpoint.
   */
  async delete(checkpointId: string): Promise<void> {
    const filePath = this.getFilePath(checkpointId);

    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  /**
   * List checkpoint summaries.
   */
  async list(projectId?: string): Promise<CheckpointSummary[]> {
    await this.ensureDir();

    const files = await readdir(this.checkpointDir);
    const summaries: CheckpointSummary[] = [];

    for (const file of files) {
      if (!file.endsWith(CHECKPOINT_EXT)) continue;

      const filePath = join(this.checkpointDir, file);
      const data = await readFile(filePath, "utf8");
      const checkpoint = deserializeCheckpoint(data);

      // Filter by project if specified
      if (projectId && checkpoint.session.session.projectId !== projectId) {
        continue;
      }

      const stats = await stat(filePath);
      summaries.push(extractSummary(checkpoint, stats.size, isCompressed(data)));
    }

    // Sort by creation date (newest first)
    // Note: createdAt may be string (from JSON) or Date object
    summaries.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    return summaries;
  }

  /**
   * Get the latest checkpoint.
   */
  async getLatest(projectId?: string): Promise<CheckpointState | null> {
    const summaries = await this.list(projectId);
    const firstSummary = summaries[0];

    if (!firstSummary) {
      return null;
    }

    return this.load(firstSummary.id);
  }

  /**
   * Cleanup old checkpoints (keep last N).
   */
  async cleanup(keepCount: number = DEFAULT_KEEP_COUNT): Promise<number> {
    const summaries = await this.list();

    if (summaries.length <= keepCount) {
      return 0;
    }

    // Delete oldest checkpoints
    const toDelete = summaries.slice(keepCount);
    let deleted = 0;

    for (const summary of toDelete) {
      await this.delete(summary.id);
      deleted++;
    }

    return deleted;
  }

  /**
   * Get checkpoint directory.
   */
  getCheckpointDir(): string {
    return this.checkpointDir;
  }
}

// ============================================================================
// Default Store
// ============================================================================

let defaultStore: FileCheckpointStore | null = null;

/**
 * Get the default checkpoint store.
 */
export function getCheckpointStore(): FileCheckpointStore {
  if (!defaultStore) {
    defaultStore = new FileCheckpointStore();
  }
  return defaultStore;
}

/**
 * Reset the default checkpoint store (for testing).
 */
export function resetCheckpointStore(): void {
  defaultStore = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get a checkpoint store for a specific directory (or default).
 */
function getStoreForDir(checkpointDir?: string): FileCheckpointStore {
  if (checkpointDir) {
    return new FileCheckpointStore(checkpointDir);
  }
  return getCheckpointStore();
}

/**
 * Save a checkpoint to the default store (or specified directory).
 *
 * @param checkpoint - Checkpoint to save
 * @param checkpointDir - Optional directory override (for testing)
 */
export async function saveCheckpoint(
  checkpoint: CheckpointState,
  checkpointDir?: string,
): Promise<void> {
  const store = getStoreForDir(checkpointDir);
  await store.save(checkpoint);
}

/**
 * Load a checkpoint from the default store (or specified directory).
 *
 * @param checkpointId - Checkpoint ID to load
 * @param checkpointDir - Optional directory override (for testing)
 */
export async function loadCheckpoint(
  checkpointId: string,
  checkpointDir?: string,
): Promise<CheckpointState | null> {
  const store = getStoreForDir(checkpointDir);
  return store.load(checkpointId);
}

/**
 * Get the latest checkpoint from the default store (or specified directory).
 *
 * @param projectId - Optional project ID filter
 * @param checkpointDir - Optional directory override (for testing)
 */
export async function getLatestCheckpoint(
  projectId?: string,
  checkpointDir?: string,
): Promise<CheckpointState | null> {
  const store = getStoreForDir(checkpointDir);
  return store.getLatest(projectId);
}

/**
 * List checkpoints from the default store (or specified directory).
 *
 * @param projectId - Optional project ID filter
 * @param checkpointDir - Optional directory override (for testing)
 */
export async function listCheckpoints(
  projectId?: string,
  checkpointDir?: string,
): Promise<CheckpointSummary[]> {
  const store = getStoreForDir(checkpointDir);
  return store.list(projectId);
}

/**
 * Cleanup old checkpoints.
 *
 * @param keepCount - Number of checkpoints to keep
 * @param checkpointDir - Optional directory override (for testing)
 */
export async function cleanupCheckpoints(
  keepCount: number = DEFAULT_KEEP_COUNT,
  checkpointDir?: string,
): Promise<number> {
  const store = getStoreForDir(checkpointDir);
  return store.cleanup(keepCount);
}
