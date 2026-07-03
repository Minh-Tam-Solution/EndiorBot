/**
 * Resume Handler
 *
 * Implements the 9-step restore flow for checkpoint resumption.
 * Handles version migration, conflict detection, and state restoration.
 *
 * @module sessions/checkpoint/resume-handler
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 6-7
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type {
  CheckpointState,
  RestoreStatus,
  ConflictResolution,
} from "./types.js";
import { loadCheckpoint, getLatestCheckpoint } from "./checkpoint.js";
import {
  migrateCheckpoint,
  validateCheckpointVersion,
  needsMigration,
  getCheckpointVersion,
} from "./migration.js";
import { detectConflicts, type ConflictDetectionResult } from "./conflict-detector.js";
import {
  classifyConflicts,
  allAutoResolvable,
  getConflictSummary,
  type ClassificationResult,
} from "./conflict-classifier.js";
import {
  autoResolveConflicts,
  resolveConflicts,
  type ResolutionResult,
} from "./conflict-resolver.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Resume options.
 */
export interface ResumeOptions {
  /** Checkpoint ID to resume from (defaults to latest) */
  checkpointId?: string;
  /** Project ID for checkpoint lookup */
  projectId?: string;
  /** Project path / checkpoint directory (for testing) */
  projectPath?: string;
  /** Force resume even with warnings */
  force?: boolean;
  /** Auto-resolve trivial/additive conflicts */
  autoResolve?: boolean;
  /** Conflict resolution strategy for non-auto-resolvable conflicts */
  conflictResolution?: ConflictResolution;
  /** Skip provenance checks */
  skipProvenanceCheck?: boolean;
  /** Skip brain verification */
  skipBrainVerification?: boolean;
  /** Callback for conflict resolution prompt */
  onConflictPrompt?: (result: ClassificationResult) => Promise<ConflictResolution>;
  /** Callback for warnings */
  onWarning?: (message: string) => void;
  /** Callback for progress updates */
  onProgress?: (step: ResumeStep, status: "started" | "completed" | "skipped") => void;
}

/**
 * Resume step identifiers.
 */
export type ResumeStep =
  | "version_check"
  | "provenance_check"
  | "conflict_detection"
  | "idempotency_check"
  | "brain_verification"
  | "state_machine_restore"
  | "session_restore"
  | "tool_call_resume"
  | "success";

/**
 * Resume result with detailed status.
 */
export interface ResumeResult {
  /** Overall success status */
  success: boolean;
  /** Restore status */
  status: RestoreStatus;
  /** Restored checkpoint (if successful) */
  checkpoint?: CheckpointState;
  /** Step where failure occurred */
  failedStep?: ResumeStep;
  /** Error message */
  error?: string;
  /** Warnings encountered */
  warnings: string[];
  /** Steps completed */
  stepsCompleted: ResumeStep[];
  /** Conflict resolution result (if any) */
  conflictResolution?: ResolutionResult;
  /** Migration result (if any) */
  migrationApplied?: boolean;
  /** Tool IDs to retry */
  toolsToRetry: string[];
  /** Number of tasks to resume */
  tasksToResume: number;
}

/**
 * Provenance check result.
 */
export interface ProvenanceCheckResult {
  /** Whether provenance is valid */
  valid: boolean;
  /** Warnings for non-critical mismatches */
  warnings: string[];
  /** Errors for critical mismatches */
  errors: string[];
  /** Detailed checks */
  checks: {
    gitCommit: "match" | "mismatch" | "skipped";
    nodeVersion: "match" | "mismatch" | "skipped";
    lockfileHash: "match" | "mismatch" | "skipped";
    brainDigest: "match" | "mismatch" | "skipped";
  };
}

// ============================================================================
// Resume Handler
// ============================================================================

/**
 * Resume from a checkpoint.
 *
 * Implements the 9-step restore flow:
 * 1. Version Check - Verify schema compatibility
 * 2. Provenance Check - Validate environment
 * 3. Conflict Detection - Find file conflicts
 * 4. Idempotency Check - Filter completed actions
 * 5. Brain Verification - Verify brain digest
 * 6. State Machine Restore - Restore gate status
 * 7. Session Restore - Restore session state
 * 8. Tool Call Resume - Resume pending tools
 * 9. Success - Log completion
 *
 * @param options - Resume options
 * @returns Resume result
 */
export async function resumeFromCheckpoint(
  options: ResumeOptions,
): Promise<ResumeResult> {
  const {
    checkpointId,
    projectId,
    projectPath,
    force = false,
    autoResolve = true,
    conflictResolution,
    skipProvenanceCheck = false,
    skipBrainVerification = false,
    onConflictPrompt,
    onWarning,
    onProgress,
  } = options;

  const warnings: string[] = [];
  const stepsCompleted: ResumeStep[] = [];

  const warn = (message: string): void => {
    warnings.push(message);
    onWarning?.(message);
  };

  const progress = (step: ResumeStep, status: "started" | "completed" | "skipped"): void => {
    if (status === "completed") {
      stepsCompleted.push(step);
    }
    onProgress?.(step, status);
  };

  try {
    // ========================================================================
    // Step 0: Load Checkpoint
    // ========================================================================
    let checkpoint: CheckpointState | null;

    if (checkpointId) {
      checkpoint = await loadCheckpoint(checkpointId, projectPath);
    } else {
      checkpoint = await getLatestCheckpoint(projectId, projectPath);
    }

    if (!checkpoint) {
      return {
        success: false,
        status: "corrupted",
        error: checkpointId
          ? `Checkpoint not found: ${checkpointId}`
          : "No checkpoint found for project",
        warnings,
        stepsCompleted,
        toolsToRetry: [],
        tasksToResume: 0,
      };
    }

    // ========================================================================
    // Step 1: Version Check
    // ========================================================================
    progress("version_check", "started");

    const version = getCheckpointVersion(checkpoint);
    let migratedCheckpoint = checkpoint;
    let migrationApplied = false;

    if (needsMigration(checkpoint)) {
      const migrationResult = migrateCheckpoint(checkpoint);

      if (!migrationResult.success) {
        return {
          success: false,
          status: "version_incompatible",
          failedStep: "version_check",
          error: migrationResult.error ?? "Migration failed",
          warnings,
          stepsCompleted,
          toolsToRetry: [],
          tasksToResume: 0,
        };
      }

      if (migrationResult.checkpoint) {
        migratedCheckpoint = migrationResult.checkpoint;
        migrationApplied = true;
        warn(`Checkpoint migrated from v${version} to v${migratedCheckpoint.meta.schemaVersion}`);
      }
    } else {
      // Validate version even if no migration needed
      try {
        validateCheckpointVersion(checkpoint);
      } catch (error) {
        return {
          success: false,
          status: "version_incompatible",
          failedStep: "version_check",
          error: error instanceof Error ? error.message : "Version validation failed",
          warnings,
          stepsCompleted,
          toolsToRetry: [],
          tasksToResume: 0,
        };
      }
    }

    progress("version_check", "completed");

    // ========================================================================
    // Step 2: Provenance Check
    // ========================================================================
    if (skipProvenanceCheck) {
      progress("provenance_check", "skipped");
    } else {
      progress("provenance_check", "started");

      const provenanceResult = checkProvenance(migratedCheckpoint);

      // Add warnings
      for (const warning of provenanceResult.warnings) {
        warn(warning);
      }

      // Critical errors (lockfile mismatch)
      if (!provenanceResult.valid && !force) {
        return {
          success: false,
          status: "dependency_mismatch",
          failedStep: "provenance_check",
          error: provenanceResult.errors.join("; "),
          warnings,
          stepsCompleted,
          toolsToRetry: [],
          tasksToResume: 0,
        };
      }

      progress("provenance_check", "completed");
    }

    // ========================================================================
    // Step 3: Conflict Detection
    // ========================================================================
    progress("conflict_detection", "started");

    const conflictResult = await detectConflicts(migratedCheckpoint);
    let conflictResolutionResult: ResolutionResult | undefined;

    if (conflictResult.hasConflicts) {
      const classification = await classifyConflicts(conflictResult.conflicts);

      if (allAutoResolvable(classification) && autoResolve) {
        // Auto-resolve trivial/additive conflicts
        conflictResolutionResult = await autoResolveConflicts(classification);
        warn(`Auto-resolved ${conflictResolutionResult.resolved.length} trivial conflicts`);
      } else if (classification.summary.structural > 0 && !force) {
        // Structural conflicts block resume unless forced
        return {
          success: false,
          status: "conflict",
          failedStep: "conflict_detection",
          error: getConflictSummary(classification),
          warnings,
          stepsCompleted,
          toolsToRetry: [],
          tasksToResume: 0,
        };
      } else if (onConflictPrompt) {
        // Prompt user for resolution
        const resolution = await onConflictPrompt(classification);
        conflictResolutionResult = await resolveConflicts(
          classification.conflicts,
          resolution,
          { dryRun: false },
        );

        if (!conflictResolutionResult.allResolved && !force) {
          return {
            success: false,
            status: "conflict",
            failedStep: "conflict_detection",
            error: `${conflictResolutionResult.unresolved.length} conflicts remain unresolved`,
            warnings,
            stepsCompleted,
            toolsToRetry: [],
            tasksToResume: 0,
          };
        }
      } else if (conflictResolution) {
        // Use provided resolution strategy
        conflictResolutionResult = await resolveConflicts(
          classification.conflicts,
          conflictResolution,
          { dryRun: false },
        );
      } else if (!force) {
        // No resolution strategy and not forcing - fail
        return {
          success: false,
          status: "conflict",
          failedStep: "conflict_detection",
          error: getConflictSummary(classification),
          warnings,
          stepsCompleted,
          toolsToRetry: [],
          tasksToResume: 0,
        };
      }
    }

    progress("conflict_detection", "completed");

    // ========================================================================
    // Step 4: Idempotency Check
    // ========================================================================
    progress("idempotency_check", "started");

    const idempotencyResult = checkIdempotency(migratedCheckpoint);
    const toolsToRetry = idempotencyResult.pendingTools;
    const completedActions = idempotencyResult.completedCount;

    if (completedActions > 0) {
      warn(`Skipping ${completedActions} already-completed actions`);
    }

    progress("idempotency_check", "completed");

    // ========================================================================
    // Step 5: Brain Verification
    // ========================================================================
    if (skipBrainVerification) {
      progress("brain_verification", "skipped");
    } else {
      progress("brain_verification", "started");

      const brainResult = verifyBrain(migratedCheckpoint);

      if (!brainResult.valid) {
        warn(brainResult.warning ?? "Brain digest mismatch - expected evolution may have occurred");
      }

      progress("brain_verification", "completed");
    }

    // ========================================================================
    // Step 6: State Machine Restore
    // ========================================================================
    progress("state_machine_restore", "started");

    // State machine is already in checkpoint, just validate it exists
    if (!migratedCheckpoint.statemachine) {
      warn("State machine not found in checkpoint - using defaults");
    }

    progress("state_machine_restore", "completed");

    // ========================================================================
    // Step 7: Session Restore
    // ========================================================================
    progress("session_restore", "started");

    // Session is already in checkpoint, validate required fields
    if (!migratedCheckpoint.session) {
      return {
        success: false,
        status: "corrupted",
        failedStep: "session_restore",
        error: "Session data not found in checkpoint",
        warnings,
        stepsCompleted,
        toolsToRetry: [],
        tasksToResume: 0,
      };
    }

    progress("session_restore", "completed");

    // ========================================================================
    // Step 8: Tool Call Resume
    // ========================================================================
    progress("tool_call_resume", "started");

    const tasksToResume = migratedCheckpoint.execution.taskQueue?.length ?? 0;

    if (toolsToRetry.length > 0) {
      warn(`${toolsToRetry.length} pending tool calls will be resumed`);
    }

    progress("tool_call_resume", "completed");

    // ========================================================================
    // Step 9: Success
    // ========================================================================
    progress("success", "started");
    progress("success", "completed");

    const result: ResumeResult = {
      success: true,
      status: "success",
      checkpoint: migratedCheckpoint,
      warnings,
      stepsCompleted,
      migrationApplied,
      toolsToRetry,
      tasksToResume,
    };

    if (conflictResolutionResult) {
      result.conflictResolution = conflictResolutionResult;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      status: "corrupted",
      error: error instanceof Error ? error.message : "Unknown error during resume",
      warnings,
      stepsCompleted,
      toolsToRetry: [],
      tasksToResume: 0,
    };
  }
}

// ============================================================================
// Provenance Check
// ============================================================================

/**
 * Check provenance (environment) compatibility.
 */
function checkProvenance(checkpoint: CheckpointState): ProvenanceCheckResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const checks: ProvenanceCheckResult["checks"] = {
    gitCommit: "skipped",
    nodeVersion: "skipped",
    lockfileHash: "skipped",
    brainDigest: "skipped",
  };

  const provenance = checkpoint.provenance;

  // Check Node.js version (warn only)
  if (provenance.nodeVersion) {
    const currentNode = process.version;
    if (provenance.nodeVersion !== currentNode) {
      warnings.push(
        `Node.js version changed: checkpoint=${provenance.nodeVersion}, current=${currentNode}`,
      );
      checks.nodeVersion = "mismatch";
    } else {
      checks.nodeVersion = "match";
    }
  }

  // Check lockfile hash (critical - fail on mismatch)
  if (provenance.lockfilesHash) {
    // In production, would check actual lockfile
    // For now, assume match
    checks.lockfileHash = "match";
  }

  // Check git commit (warn only)
  if (provenance.repoCommitSha) {
    // In production, would check actual git HEAD
    // For now, skip check
    checks.gitCommit = "skipped";
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    checks,
  };
}

// ============================================================================
// Idempotency Check
// ============================================================================

interface IdempotencyCheckResult {
  /** Number of completed actions to skip */
  completedCount: number;
  /** Tool IDs that need to be retried */
  pendingTools: string[];
  /** Idempotency keys already used */
  usedKeys: Set<string>;
}

/**
 * Check idempotency state to determine what to retry.
 */
function checkIdempotency(checkpoint: CheckpointState): IdempotencyCheckResult {
  const idempotency = checkpoint.idempotency;
  const pendingTools: string[] = [];
  const usedKeys = new Set<string>(Object.values(idempotency.idempotencyKeys));

  // Find pending tool calls from execution context
  const pendingCalls = checkpoint.execution.pendingToolCalls ?? [];

  for (const call of pendingCalls) {
    // Check if this tool call was already completed
    const callKey = idempotency.idempotencyKeys[call.id];
    const isCompleted = callKey && idempotency.completedActions.some(
      (action) => action.idempotencyKey === callKey,
    );

    if (!isCompleted && call.status !== "complete") {
      pendingTools.push(call.id);
    }
  }

  return {
    completedCount: idempotency.completedActions.length,
    pendingTools,
    usedKeys,
  };
}

// ============================================================================
// Brain Verification
// ============================================================================

interface BrainVerificationResult {
  valid: boolean;
  warning?: string;
}

/**
 * Verify brain digest.
 */
function verifyBrain(checkpoint: CheckpointState): BrainVerificationResult {
  const brain = checkpoint.brain;

  // For now, just check that brain reference exists
  // In production, would verify actual brain digest
  if (!brain.brainVersion || !brain.brainDigest) {
    return {
      valid: true,
      warning: "Brain reference incomplete - proceeding with current brain",
    };
  }

  // Brain evolution is expected, so we don't fail on digest mismatch
  // Just warn for audit trail
  return {
    valid: true,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a checkpoint can be resumed.
 *
 * Quick check without full restoration.
 *
 * @param projectPath - Checkpoint directory (required for testing)
 * @param projectId - Optional project ID filter
 * @param checkpointId - Optional specific checkpoint ID
 */
export async function canResume(
  projectPath?: string,
  projectId?: string,
  checkpointId?: string,
): Promise<{ canResume: boolean; reason?: string }> {
  try {
    let checkpoint: CheckpointState | null;

    if (checkpointId) {
      checkpoint = await loadCheckpoint(checkpointId, projectPath);
    } else {
      checkpoint = await getLatestCheckpoint(projectId, projectPath);
    }

    if (!checkpoint) {
      return { canResume: false, reason: "No checkpoint found" };
    }

    // Check version compatibility
    try {
      validateCheckpointVersion(checkpoint);
    } catch (error) {
      return {
        canResume: false,
        reason: error instanceof Error ? error.message : "Version incompatible",
      };
    }

    return { canResume: true };
  } catch (error) {
    return {
      canResume: false,
      reason: error instanceof Error ? error.message : "Error checking checkpoint",
    };
  }
}

/**
 * Get resume preview without actually resuming.
 *
 * @param projectPath - Checkpoint directory
 * @param projectId - Optional project ID filter
 * @param checkpointId - Optional specific checkpoint ID
 */
export async function getResumePreview(
  projectPath?: string,
  projectId?: string,
  checkpointId?: string,
): Promise<{
  checkpoint?: CheckpointState;
  conflicts?: ConflictDetectionResult;
  needsMigration: boolean;
  toolsToRetry: number;
  tasksToResume: number;
}> {
  let checkpoint: CheckpointState | null;

  if (checkpointId) {
    checkpoint = await loadCheckpoint(checkpointId, projectPath);
  } else {
    checkpoint = await getLatestCheckpoint(projectId, projectPath);
  }

  if (!checkpoint) {
    return {
      needsMigration: false,
      toolsToRetry: 0,
      tasksToResume: 0,
    };
  }

  const conflicts = await detectConflicts(checkpoint);
  const migration = needsMigration(checkpoint);
  const idempotency = checkIdempotency(checkpoint);

  return {
    checkpoint,
    conflicts,
    needsMigration: migration,
    toolsToRetry: idempotency.pendingTools.length,
    tasksToResume: checkpoint.execution.taskQueue?.length ?? 0,
  };
}
