/**
 * Checkpoint Types for Autonomous Execution
 *
 * Defines the CheckpointState interface and sub-interfaces for saving
 * and restoring execution state during autonomous sessions.
 *
 * @module sessions/checkpoint/types
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 2-3
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { Session } from "../types.js";

// ============================================================================
// Schema Version
// ============================================================================

/**
 * Current checkpoint schema version (semver).
 * Used for migration compatibility.
 */
export const CHECKPOINT_SCHEMA_VERSION = "1.0.0";

// ============================================================================
// Checkpoint Reason
// ============================================================================

/**
 * Reason for checkpoint creation.
 */
export type CheckpointReason =
  | "interrupt" // User Ctrl+C
  | "gate_pass" // G1/G2 gate passed
  | "budget_pause" // Budget limit reached
  | "manual" // User `endiorbot checkpoint`
  | "crash" // Unexpected error
  | "timeout" // Session timeout
  | "auto" // Auto-checkpoint interval
  // Session lifecycle (Sprint 69-71)
  | "session_start" // Session started
  | "session_end" // Session ended
  | "session_complete" // Session completed
  | "stage_complete" // Stage completed
  | "milestone" // Stage/task completed
  | "escalation" // Issue escalated to human
  | "error_recovery" // Error recovery point
  | "before_risky_action" // Before risky operation
  | "before_rollback" // Before rollback operation
  | "user_pause" // User paused session
  | "time_interval"; // Time-based checkpoint

// ============================================================================
// Soul Types (Agent Personas)
// ============================================================================

/**
 * Active agent persona during execution.
 */
export type SoulType = "pm" | "architect" | "coder" | "reviewer" | "researcher" | "assistant";

// ============================================================================
// SDLC Phase
// ============================================================================

/**
 * Current SDLC execution phase.
 */
export type ExecutionPhase =
  | "research"
  | "planning"
  | "design"
  | "implement"
  | "implementation"
  | "test"
  | "testing"
  | "review"
  | "completion";

// ============================================================================
// Tool Call State
// ============================================================================

/**
 * Status of a tool call.
 */
export type ToolCallStatus = "pending" | "executing" | "partial" | "complete" | "failed";

/**
 * State of a tool call in progress or completed.
 */
export interface ToolCallState {
  /** Unique tool call ID */
  id: string;
  /** Tool name (e.g., "file_write", "git_commit") */
  toolName: string;
  /** Arguments (sanitized, no secrets) */
  args: Record<string, unknown>;
  /** Is this tool call idempotent? */
  idempotent: boolean;
  /** Current status */
  status: ToolCallStatus;
  /** Partial output (for streaming) */
  partialOutput?: unknown;
  /** Error message if failed */
  errorMessage?: string;
  /** When tool call started */
  startedAt: Date;
  /** When tool call completed */
  completedAt?: Date;
}

// ============================================================================
// Completed Action
// ============================================================================

/**
 * Type of completed action.
 */
export type CompletedActionType = "commit" | "push" | "approve" | "tool_call" | "file_write";

/**
 * Record of a completed side-effect that MUST NOT be retried.
 */
export interface CompletedAction {
  /** Action type */
  actionType: CompletedActionType;
  /** Idempotency key for deduplication */
  idempotencyKey: string;
  /** When action completed */
  timestamp: Date;
  /** Result */
  result: "success" | "failure";
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Step Frame (Execution Stack)
// ============================================================================

/**
 * Execution stack frame for nested tool calls.
 */
export interface StepFrame {
  /** Tool or function name */
  name: string;
  /** Depth in call stack (0 = top level) */
  depth: number;
  /** Arguments (sanitized) */
  args?: Record<string, unknown>;
  /** When this step started */
  startedAt: Date;
}

// ============================================================================
// Task
// ============================================================================

/**
 * Task in the execution queue.
 */
export interface Task {
  /** Task ID */
  id: string;
  /** Task description */
  description: string;
  /** Task status */
  status: "pending" | "in_progress" | "completed" | "failed";
  /** Priority (lower is higher priority) */
  priority: number;
  /** Created timestamp */
  createdAt: Date;
  /** Dependencies (task IDs) */
  dependsOn?: string[];
}

// ============================================================================
// Token Usage
// ============================================================================

/**
 * Token usage record per model.
 */
export interface TokenUsageRecord {
  /** Model name */
  model: string;
  /** Input tokens consumed */
  input: number;
  /** Output tokens generated */
  output: number;
  /** Estimated cost in USD */
  cost?: number;
}

// ============================================================================
// File Change
// ============================================================================

/**
 * Record of a file modification.
 */
export interface FileChange {
  /** File path (relative to project root) */
  path: string;
  /** Change type */
  changeType: "created" | "modified" | "deleted";
  /** Hash before change */
  beforeHash?: string;
  /** Hash after change */
  afterHash?: string;
  /** Unified diff patch */
  patch?: string;
}

// ============================================================================
// Approval Request
// ============================================================================

/**
 * Pending approval request.
 */
export interface ApprovalRequest {
  /** Request ID */
  id: string;
  /** Request type */
  type: "gate" | "architecture" | "breaking_change" | "deploy";
  /** Description */
  description: string;
  /** Feature/item ID */
  featureId: string;
  /** Created timestamp */
  createdAt: Date;
  /** Urgency level */
  urgency: "low" | "medium" | "high";
}

// ============================================================================
// Decision
// ============================================================================

/**
 * Decision record for audit trail.
 */
export interface Decision {
  /** Decision ID */
  id: string;
  /** Decision type */
  type: "architecture" | "implementation" | "gate" | "rollback";
  /** Decision description */
  description: string;
  /** Rationale */
  rationale: string;
  /** Made by (CEO or AI agent) */
  madeBy: string;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Checkpoint Sub-Interfaces
// ============================================================================

/**
 * Checkpoint metadata.
 */
export interface CheckpointMeta {
  /** Checkpoint ID (e.g., "ckpt-20260322-143000") */
  id: string;
  /** Schema version (semver) */
  schemaVersion: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Why was this checkpoint created? */
  reason: CheckpointReason;
  /** Human-readable description */
  description?: string;
  /** Migration notes from previous versions */
  migrationNotes?: string[];
}

/**
 * Session state snapshot.
 */
export interface SessionSnapshot {
  /** Session reference */
  session: Session;
  /** Active agent persona */
  activeSoul: SoulType;
  /** Decision log for audit trail */
  decisionLog: Decision[];
}

/**
 * Execution context.
 */
export interface ExecutionContext {
  /** Current SDLC phase */
  currentPhase: ExecutionPhase;
  /** Current task ID */
  currentTaskId?: string;
  /** Queued tasks */
  taskQueue: Task[];
  /** Execution depth stack */
  stepStack: StepFrame[];
  /** Detailed interruption reason */
  interruptionReason?: string;
  /** Pending tool calls */
  pendingToolCalls: ToolCallState[];
  /** Partial results from streaming */
  partialResults: Record<string, unknown>;
}

/**
 * Runtime provenance for execution determinism.
 */
export interface RuntimeProvenance {
  /** Git commit SHA */
  repoCommitSha: string;
  /** Working tree patch (uncommitted changes) */
  workingTreePatch?: string;
  /** Hash of pnpm-lock.yaml */
  lockfilesHash: string;
  /** Node.js version */
  nodeVersion: string;
  /** Model configuration */
  modelConfig: {
    model: string;
    temperature?: number;
  };
  /** Environment fingerprint (sanitized, no secrets) */
  envFingerprint: Record<string, string>;
  /** SHA256 of execution trace */
  executionTraceDigest: string;
  /** Runtime fingerprint (e.g., "darwin-arm64-node22.11.0") */
  runtimeFingerprint: string;
}

/**
 * Idempotency state for retry safety.
 */
export interface IdempotencyState {
  /** Idempotency keys: tool_call_id → key */
  idempotencyKeys: Record<string, string>;
  /** Completed actions that MUST NOT be retried */
  completedActions: CompletedAction[];
  /** Idempotency scope per tool */
  idempotencyScope: Record<string, string>;
  /** Tool call outputs cache */
  toolCallOutputsCache: Record<string, unknown>;
  /** Retry attempts per tool call */
  toolCallAttempts: Record<string, number>;
  /** Remaining retry budget */
  retryBudget: number;
}

/**
 * Filesystem delta for conflict detection.
 */
export interface FilesystemDelta {
  /** Files modified since session start */
  modifiedFiles: FileChange[];
  /** Files created (not committed) */
  createdFiles: string[];
  /** File hashes for conflict detection: path → SHA256 */
  fileHashes: Record<string, string>;
  /** File patches before changes (for rollback) */
  filePatchesBeforeChange?: Record<string, string>;
}

/**
 * Git state snapshot.
 */
export interface GitStateSnapshot {
  /** Current branch */
  branch: string;
  /** Uncommitted file paths */
  uncommittedChanges: string[];
  /** Last commit when checkpoint was created */
  lastCheckpointCommit: string;
  /** Last stable checkpoint ID */
  lastStableCheckpoint?: string;
  /** Git worktree ref for rollback */
  workingTreeRef?: string;
}

/**
 * Cost tracking state.
 */
export interface CostState {
  /** Total cost spent in this session (USD) */
  sessionCostSoFar: number;
  /** Token usage per model */
  tokenUsage: TokenUsageRecord[];
  /** Remaining time budget in milliseconds */
  timeBudgetRemaining?: number;
}

/**
 * Rollback strategy configuration.
 * @deprecated Use stable primitives instead (git reset + patches)
 */
export interface RollbackStrategy {
  /** Last stable commit for rollback */
  lastStableCommit?: string;
  /** Rollback commands (deprecated) */
  rollbackCommands?: string[];
}

/**
 * Layer hashes for granular brain comparison.
 */
export interface BrainLayerHashes {
  events: string;
  patterns: string;
  structures: string;
  mentalModels: string;
  ceoProfile: string;
}

/**
 * Brain reference (AI model state).
 */
export interface BrainReference {
  /** Brain version */
  brainVersion: string;
  /** Brain digest (SHA256) for verification */
  brainDigest: string;
  /** Per-layer hashes for granular comparison */
  layerHashes?: BrainLayerHashes;
  /** Timestamp when reference was captured */
  capturedAt?: string;
}

/**
 * State machine state (SDLC gates).
 */
export interface StateMachineState {
  /** Gate status: gateId → status */
  gateStatus: Record<string, "pending" | "pass" | "fail">;
  /** Evidence bindings: key → file path */
  evidenceBindings: Record<string, string>;
  /** Pending approval requests */
  approvalPending: ApprovalRequest[];
}

// ============================================================================
// CheckpointState (Main Interface)
// ============================================================================

/**
 * Complete checkpoint state for autonomous execution.
 *
 * Per ADR-006, grouped into logical sub-interfaces for maintainability.
 *
 * @example
 * ```typescript
 * const checkpoint: CheckpointState = {
 *   meta: { id: "ckpt-123", schemaVersion: "1.0.0", ... },
 *   session: { session: ..., activeSoul: "architect", ... },
 *   execution: { currentPhase: "design", ... },
 *   provenance: { repoCommitSha: "abc123", ... },
 *   idempotency: { completedActions: [], ... },
 *   filesystem: { fileHashes: {}, ... },
 *   git: { branch: "main", ... },
 *   cost: { sessionCostSoFar: 0.45, ... },
 *   rollback: {},
 *   brain: { brainVersion: "1.0.0", brainDigest: "..." },
 *   statemachine: { gateStatus: {}, ... },
 * };
 * ```
 */
export interface CheckpointState {
  /** Checkpoint metadata */
  meta: CheckpointMeta;
  /** Session state snapshot */
  session: SessionSnapshot;
  /** Execution context */
  execution: ExecutionContext;
  /** Runtime provenance */
  provenance: RuntimeProvenance;
  /** Idempotency state */
  idempotency: IdempotencyState;
  /** Filesystem delta */
  filesystem: FilesystemDelta;
  /** Git state */
  git: GitStateSnapshot;
  /** Cost tracking */
  cost: CostState;
  /** Rollback strategy */
  rollback: RollbackStrategy;
  /** Brain reference */
  brain: BrainReference;
  /** State machine (SDLC gates) */
  statemachine: StateMachineState;
}

// ============================================================================
// Checkpoint Summary (for listing)
// ============================================================================

/**
 * Lightweight checkpoint summary for listing.
 */
export interface CheckpointSummary {
  /** Checkpoint ID */
  id: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Reason for checkpoint */
  reason: CheckpointReason;
  /** Description */
  description?: string;
  /** Session cost at checkpoint */
  sessionCost: number;
  /** Number of files modified */
  filesModified: number;
  /** Current SDLC phase */
  currentPhase: ExecutionPhase;
  /** File size in bytes */
  sizeBytes: number;
  /** Is compressed? */
  compressed: boolean;
}

// ============================================================================
// Restore Result
// ============================================================================

/**
 * Result of checkpoint restore operation.
 */
export type RestoreStatus =
  | "success"
  | "conflict"
  | "migration_required"
  | "dependency_mismatch"
  | "version_incompatible"
  | "corrupted";

/**
 * Conflict severity level.
 */
export type ConflictSeverity = "trivial" | "additive" | "semantic" | "structural" | "unknown";

/**
 * File conflict details.
 */
export interface FileConflict {
  /** File path */
  path: string;
  /** Hash at checkpoint time */
  checkpointHash: string;
  /** Current file hash */
  currentHash: string;
  /** Conflict severity */
  severity: ConflictSeverity;
  /** Diff summary */
  diffSummary?: string;
}

/**
 * Restore conflict resolution options.
 */
export type ConflictResolution =
  | "force_restore" // Overwrite external changes
  | "merge_manual" // Show diffs, let user merge
  | "abort" // Cancel resume
  | "new_baseline"; // Accept external changes

/**
 * Result of checkpoint restore operation.
 */
export interface RestoreResult {
  /** Restore status */
  status: RestoreStatus;
  /** Resumed from timestamp */
  resumedFrom?: Date;
  /** Number of tasks resumed */
  tasksResumed?: number;
  /** Conflicts detected */
  conflicts?: FileConflict[];
  /** Available resolution options */
  options?: ConflictResolution[];
  /** Migration details if needed */
  migration?: {
    fromVersion: string;
    toVersion: string;
    migrationPath: string[];
  };
  /** Error message */
  errorMessage?: string;
}

// ============================================================================
// Checkpoint Store Interface
// ============================================================================

/**
 * Interface for checkpoint storage operations.
 */
export interface CheckpointStore {
  /** Save a checkpoint */
  save(checkpoint: CheckpointState): Promise<void>;
  /** Load a checkpoint by ID */
  load(checkpointId: string): Promise<CheckpointState | null>;
  /** Delete a checkpoint */
  delete(checkpointId: string): Promise<void>;
  /** List checkpoint summaries */
  list(projectId?: string): Promise<CheckpointSummary[]>;
  /** Get the latest checkpoint */
  getLatest(projectId?: string): Promise<CheckpointState | null>;
  /** Cleanup old checkpoints (keep last N) */
  cleanup(keepCount: number): Promise<number>;
}
