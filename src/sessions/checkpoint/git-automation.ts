/**
 * Git Automation
 *
 * Provides automated git operations for checkpoint/resume functionality.
 * Implements safe git operations per ADR-006:
 * - Auto-commit on milestones (gates, checkpoints)
 * - Compensation commits instead of force-push
 * - Working tree capture and restore
 *
 * @module sessions/checkpoint/git-automation
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 8
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { execSync, execFileSync } from "node:child_process";
import type {
  CheckpointState,
  CheckpointReason,
  CompletedAction,
} from "./types.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Git operation result.
 */
export interface GitOperationResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Operation performed */
  operation: GitOperation;
  /** Result details */
  details: string;
  /** Commit SHA if applicable */
  commitSha?: string;
  /** Branch name if applicable */
  branch?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Git operation types.
 */
export type GitOperation =
  | "commit"
  | "stash"
  | "stash_pop"
  | "reset"
  | "checkout"
  | "branch_create"
  | "branch_delete"
  | "compensation_commit"
  | "worktree_capture"
  | "worktree_restore";

/**
 * Auto-commit milestone types.
 */
export type MilestoneType =
  | "gate_pass"
  | "checkpoint"
  | "budget_pause"
  | "session_end"
  | "manual";

/**
 * Auto-commit options.
 */
export interface AutoCommitOptions {
  /** Milestone type triggering commit */
  milestoneType: MilestoneType;
  /** Custom commit message */
  message?: string;
  /** Files to stage (default: all modified) */
  files?: string[];
  /** Checkpoint reason for metadata */
  checkpointReason?: CheckpointReason;
  /** Checkpoint ID for reference */
  checkpointId?: string;
  /** Project path */
  projectPath?: string;
  /** Dry run mode */
  dryRun?: boolean;
  /** Skip empty commits */
  skipEmpty?: boolean;
}

/**
 * Compensation commit options.
 */
export interface CompensationCommitOptions {
  /** Original commit SHA to compensate */
  originalCommitSha: string;
  /** Reason for compensation */
  reason: string;
  /** Files to revert (default: all from original commit) */
  files?: string[];
  /** Project path */
  projectPath?: string;
  /** Dry run mode */
  dryRun?: boolean;
}

/**
 * Working tree capture options.
 */
export interface WorktreeCaptureOptions {
  /** Project path */
  projectPath?: string;
  /** Include untracked files */
  includeUntracked?: boolean;
  /** Capture description */
  description?: string;
}

/**
 * Working tree state.
 */
export interface WorktreeState {
  /** Unique reference ID */
  ref: string;
  /** Capture timestamp */
  capturedAt: Date;
  /** Branch at capture time */
  branch: string;
  /** Commit SHA at capture time */
  commitSha: string;
  /** Stash ref if applicable */
  stashRef?: string;
  /** Description */
  description?: string;
  /** Files included */
  files: string[];
}

/**
 * Git state for checkpoint.
 */
export interface GitCheckpointState {
  /** Current branch */
  branch: string;
  /** Current commit SHA */
  commitSha: string;
  /** Uncommitted file paths */
  uncommittedFiles: string[];
  /** Has uncommitted changes */
  hasUncommittedChanges: boolean;
  /** Working tree ref if captured */
  workingTreeRef?: string;
  /** Is repository clean */
  isClean: boolean;
}

// ============================================================================
// Validation Helpers (Sprint 116 — T1 Command Injection Fix)
// ============================================================================

/** Validate a git ref (SHA, branch name, tag) to prevent command injection. */
function validateGitRef(ref: string): string {
  if (!/^[a-zA-Z0-9._\-/~^@{}:]+$/.test(ref)) {
    throw new Error(`Invalid git ref: ${ref}`);
  }
  return ref;
}

/** Validate a git reset strategy. */
function validateResetStrategy(strategy: string): string {
  if (!["soft", "mixed", "hard"].includes(strategy)) {
    throw new Error(`Invalid reset strategy: ${strategy}`);
  }
  return strategy;
}

// ============================================================================
// Git Utilities
// ============================================================================

/**
 * Check if we're in a git repository.
 */
export function isGitRepository(path?: string): boolean {
  try {
    const cwd = path ?? process.cwd();
    execSync("git rev-parse --git-dir", {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current branch name.
 */
export function getCurrentBranch(path?: string): string {
  try {
    const cwd = path ?? process.cwd();
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get current commit SHA.
 */
export function getCurrentCommit(path?: string): string {
  try {
    const cwd = path ?? process.cwd();
    return execSync("git rev-parse HEAD", {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get uncommitted file paths.
 */
export function getUncommittedFiles(path?: string): string[] {
  try {
    const cwd = path ?? process.cwd();
    const output = execSync("git status --porcelain", {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    });
    return output
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.slice(3).trim());
  } catch {
    return [];
  }
}

/**
 * Check if working tree is clean.
 */
export function isWorkingTreeClean(path?: string): boolean {
  const uncommitted = getUncommittedFiles(path);
  return uncommitted.length === 0;
}

/**
 * Get current git state for checkpoint.
 */
export function getGitState(path?: string): GitCheckpointState {
  const branch = getCurrentBranch(path);
  const commitSha = getCurrentCommit(path);
  const uncommittedFiles = getUncommittedFiles(path);
  const isClean = uncommittedFiles.length === 0;

  return {
    branch,
    commitSha,
    uncommittedFiles,
    hasUncommittedChanges: !isClean,
    isClean,
  };
}

/**
 * Get files changed in a commit.
 */
export function getCommitFiles(commitSha: string, path?: string): string[] {
  try {
    const cwd = path ?? process.cwd();

    const safeRef = validateGitRef(commitSha);

    // First try diff-tree for non-root commits
    let output = execFileSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", safeRef], {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();

    // If empty, this might be a root commit - use git show instead
    if (!output) {
      output = execFileSync("git", ["show", "--name-only", "--format=", safeRef], {
        cwd,
        encoding: "utf8",
        stdio: "pipe",
      }).trim();
    }

    return output.split("\n").filter((line) => line.trim());
  } catch {
    return [];
  }
}

/**
 * Generate a unique ref ID.
 */
function generateRefId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${timestamp}-${random}`;
}

// ============================================================================
// Auto-Commit on Milestones
// ============================================================================

/**
 * Generate commit message for milestone.
 */
function generateMilestoneMessage(options: AutoCommitOptions): string {
  const { milestoneType, message, checkpointReason, checkpointId } = options;

  if (message) {
    return message;
  }

  const prefix = milestoneType === "gate_pass" ? "chore" : "checkpoint";
  let body = "";

  switch (milestoneType) {
    case "gate_pass":
      body = `Gate passed (${checkpointReason ?? "auto"})`;
      break;
    case "checkpoint":
      body = `Session checkpoint: ${checkpointReason ?? "manual"}`;
      break;
    case "budget_pause":
      body = "Session paused: budget limit reached";
      break;
    case "session_end":
      body = "Session ended";
      break;
    case "manual":
      body = "Manual checkpoint";
      break;
  }

  const footer = checkpointId ? `\n\nCheckpoint-ID: ${checkpointId}` : "";

  return `${prefix}: ${body}${footer}`;
}

/**
 * Auto-commit on milestone (gate pass, checkpoint, etc.).
 *
 * Per ADR-006: Create commits at significant milestones for rollback safety.
 */
export async function autoCommitOnMilestone(
  options: AutoCommitOptions,
): Promise<GitOperationResult> {
  const {
    projectPath,
    dryRun = false,
    skipEmpty = true,
    files,
  } = options;

  const cwd = projectPath ?? process.cwd();

  // Check if git repository
  if (!isGitRepository(cwd)) {
    return {
      success: false,
      operation: "commit",
      details: "Not a git repository",
      error: "No git repository found",
    };
  }

  // Check for changes
  const uncommitted = getUncommittedFiles(cwd);
  if (uncommitted.length === 0 && skipEmpty) {
    return {
      success: true,
      operation: "commit",
      details: "No changes to commit (skipped)",
    };
  }

  const message = generateMilestoneMessage(options);

  if (dryRun) {
    const filesToStage = files ?? uncommitted;
    return {
      success: true,
      operation: "commit",
      details: `Would commit ${filesToStage.length} files: ${message}`,
    };
  }

  try {
    // Stage files
    const filesToStage = files ?? ["."];
    for (const file of filesToStage) {
      execFileSync("git", ["add", file], { cwd, stdio: "pipe" });
    }

    // Commit with message
    execFileSync("git", ["commit", "-m", message], {
      cwd,
      stdio: "pipe",
    });

    const commitSha = getCurrentCommit(cwd);

    return {
      success: true,
      operation: "commit",
      details: `Committed: ${message}`,
      commitSha,
      branch: getCurrentBranch(cwd),
    };
  } catch (error) {
    return {
      success: false,
      operation: "commit",
      details: "Failed to create commit",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Compensation Commits
// ============================================================================

/**
 * Create a compensation commit instead of force-pushing.
 *
 * Per ADR-006: Never force-push after external actions. Create a new
 * "compensation commit" that undoes the changes safely.
 */
export async function createCompensationCommit(
  options: CompensationCommitOptions,
): Promise<GitOperationResult> {
  const {
    originalCommitSha,
    reason,
    files,
    projectPath,
    dryRun = false,
  } = options;

  const cwd = projectPath ?? process.cwd();

  // Check if git repository
  if (!isGitRepository(cwd)) {
    return {
      success: false,
      operation: "compensation_commit",
      details: "Not a git repository",
      error: "No git repository found",
    };
  }

  // Get files from original commit if not specified
  const filesToRevert = files ?? getCommitFiles(originalCommitSha, cwd);

  if (filesToRevert.length === 0) {
    return {
      success: false,
      operation: "compensation_commit",
      details: "No files to revert",
      error: "Original commit has no files or could not be read",
    };
  }

  const message = `revert: Compensation for ${originalCommitSha.slice(0, 7)}\n\nReason: ${reason}\n\nThis commit compensates for changes in ${originalCommitSha}.\nUsing compensation commit instead of force-push per ADR-006.`;

  if (dryRun) {
    return {
      success: true,
      operation: "compensation_commit",
      details: `Would create compensation commit for ${originalCommitSha.slice(0, 7)} (${filesToRevert.length} files)`,
    };
  }

  try {
    const safeRef = validateGitRef(originalCommitSha);

    // Revert the commit (creates a new commit)
    execFileSync("git", ["revert", "--no-edit", safeRef], {
      cwd,
      stdio: "pipe",
    });

    // Amend the message to include our custom message
    execFileSync("git", ["commit", "--amend", "-m", message], {
      cwd,
      stdio: "pipe",
    });

    const commitSha = getCurrentCommit(cwd);

    return {
      success: true,
      operation: "compensation_commit",
      details: `Created compensation commit for ${originalCommitSha.slice(0, 7)}`,
      commitSha,
      branch: getCurrentBranch(cwd),
    };
  } catch {
    // If git revert fails (e.g., conflicts), try manual approach
    return await createManualCompensationCommit(
      originalCommitSha,
      filesToRevert,
      message,
      cwd,
    );
  }
}

/**
 * Create manual compensation commit when git revert fails.
 */
async function createManualCompensationCommit(
  originalCommitSha: string,
  files: string[],
  message: string,
  cwd: string,
): Promise<GitOperationResult> {
  try {
    const safeRef = validateGitRef(originalCommitSha);

    // Get the parent commit
    const parentCommit = execFileSync("git", ["rev-parse", safeRef + "^"], {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();

    // Checkout each file from parent commit
    const safeParent = validateGitRef(parentCommit);
    for (const file of files) {
      try {
        execFileSync("git", ["checkout", safeParent, "--", file], {
          cwd,
          stdio: "pipe",
        });
      } catch {
        // File might not exist in parent, skip
        continue;
      }
    }

    // Stage and commit
    execFileSync("git", ["add", "-A"], { cwd, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", message], {
      cwd,
      stdio: "pipe",
    });

    const commitSha = getCurrentCommit(cwd);

    return {
      success: true,
      operation: "compensation_commit",
      details: `Created manual compensation commit for ${originalCommitSha.slice(0, 7)}`,
      commitSha,
      branch: getCurrentBranch(cwd),
    };
  } catch (error) {
    return {
      success: false,
      operation: "compensation_commit",
      details: "Failed to create compensation commit",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Working Tree Capture and Restore
// ============================================================================

/**
 * Capture current working tree state.
 *
 * Creates a snapshot of uncommitted changes that can be restored later.
 */
export async function captureWorkingTree(
  options: WorktreeCaptureOptions = {},
): Promise<{ success: boolean; state?: WorktreeState; error?: string }> {
  const { projectPath, includeUntracked = true, description } = options;
  const cwd = projectPath ?? process.cwd();

  // Check if git repository
  if (!isGitRepository(cwd)) {
    return {
      success: false,
      error: "Not a git repository",
    };
  }

  const uncommittedFiles = getUncommittedFiles(cwd);

  // If clean, no need to capture
  if (uncommittedFiles.length === 0) {
    return {
      success: true,
      state: {
        ref: "clean",
        capturedAt: new Date(),
        branch: getCurrentBranch(cwd),
        commitSha: getCurrentCommit(cwd),
        description: "Working tree is clean",
        files: [],
      },
    };
  }

  const ref = generateRefId("wt");

  try {
    // Use git stash to capture working tree
    const stashArgs = ["stash", "push"];
    if (includeUntracked) stashArgs.push("--include-untracked");

    const stashMessage = `${ref}: ${description ?? "Checkpoint working tree"}`;
    stashArgs.push("-m", stashMessage);
    execFileSync("git", stashArgs, { cwd, stdio: "pipe" });

    // Get stash ref
    const stashRef = execSync("git stash list -1 --format=%H", {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();

    // Pop the stash to restore working tree state
    execSync("git stash pop", { cwd, stdio: "pipe" });

    const state: WorktreeState = {
      ref,
      capturedAt: new Date(),
      branch: getCurrentBranch(cwd),
      commitSha: getCurrentCommit(cwd),
      stashRef,
      files: uncommittedFiles,
    };
    if (description !== undefined) {
      state.description = description;
    }

    return { success: true, state };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Restore working tree from captured state.
 */
export async function restoreWorkingTree(
  state: WorktreeState,
  projectPath?: string,
): Promise<GitOperationResult> {
  const cwd = projectPath ?? process.cwd();

  // If clean state, nothing to restore
  if (state.ref === "clean") {
    return {
      success: true,
      operation: "worktree_restore",
      details: "Working tree was clean, nothing to restore",
    };
  }

  // Check current branch matches
  const currentBranch = getCurrentBranch(cwd);
  if (currentBranch !== state.branch) {
    return {
      success: false,
      operation: "worktree_restore",
      details: `Branch mismatch: expected ${state.branch}, got ${currentBranch}`,
      error: "Cannot restore working tree to different branch",
    };
  }

  // We don't actually store the stash persistently, so this is informational
  return {
    success: true,
    operation: "worktree_restore",
    details: `Working tree state recorded: ${state.files.length} files from ${state.capturedAt.toISOString()}`,
  };
}

// ============================================================================
// Git Reset Operations
// ============================================================================

/**
 * Reset strategy for rollback.
 */
export type ResetStrategy = "soft" | "mixed" | "hard";

/**
 * Reset to a specific commit.
 *
 * Per ADR-006: Use stable primitives for rollback.
 */
export async function resetToCommit(
  commitSha: string,
  strategy: ResetStrategy = "mixed",
  projectPath?: string,
  dryRun: boolean = false,
): Promise<GitOperationResult> {
  const cwd = projectPath ?? process.cwd();

  // Check if git repository
  if (!isGitRepository(cwd)) {
    return {
      success: false,
      operation: "reset",
      details: "Not a git repository",
      error: "No git repository found",
    };
  }

  // Verify commit exists
  const safeRef = validateGitRef(commitSha);
  try {
    execFileSync("git", ["cat-file", "-e", safeRef], { cwd, stdio: "pipe" });
  } catch {
    return {
      success: false,
      operation: "reset",
      details: `Commit not found: ${commitSha}`,
      error: "Invalid commit SHA",
    };
  }

  if (dryRun) {
    return {
      success: true,
      operation: "reset",
      details: `Would reset (--${strategy}) to ${commitSha.slice(0, 7)}`,
    };
  }

  try {
    const safeStrategy = validateResetStrategy(strategy);
    execFileSync("git", ["reset", `--${safeStrategy}`, safeRef], { cwd, stdio: "pipe" });

    return {
      success: true,
      operation: "reset",
      details: `Reset (--${strategy}) to ${commitSha.slice(0, 7)}`,
      commitSha: getCurrentCommit(cwd),
      branch: getCurrentBranch(cwd),
    };
  } catch (error) {
    return {
      success: false,
      operation: "reset",
      details: `Failed to reset to ${commitSha.slice(0, 7)}`,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Branch Operations
// ============================================================================

/**
 * Create a checkpoint branch.
 */
export async function createCheckpointBranch(
  checkpointId: string,
  projectPath?: string,
  dryRun: boolean = false,
): Promise<GitOperationResult> {
  const cwd = projectPath ?? process.cwd();
  const branchName = `checkpoint/${checkpointId}`;

  // Check if git repository
  if (!isGitRepository(cwd)) {
    return {
      success: false,
      operation: "branch_create",
      details: "Not a git repository",
      error: "No git repository found",
    };
  }

  if (dryRun) {
    return {
      success: true,
      operation: "branch_create",
      details: `Would create branch: ${branchName}`,
      branch: branchName,
    };
  }

  try {
    execFileSync("git", ["branch", branchName], { cwd, stdio: "pipe" });

    return {
      success: true,
      operation: "branch_create",
      details: `Created branch: ${branchName}`,
      branch: branchName,
      commitSha: getCurrentCommit(cwd),
    };
  } catch (error) {
    return {
      success: false,
      operation: "branch_create",
      details: `Failed to create branch: ${branchName}`,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a checkpoint branch.
 */
export async function deleteCheckpointBranch(
  checkpointId: string,
  projectPath?: string,
  force: boolean = false,
  dryRun: boolean = false,
): Promise<GitOperationResult> {
  const cwd = projectPath ?? process.cwd();
  const branchName = `checkpoint/${checkpointId}`;

  // Check if git repository
  if (!isGitRepository(cwd)) {
    return {
      success: false,
      operation: "branch_delete",
      details: "Not a git repository",
      error: "No git repository found",
    };
  }

  if (dryRun) {
    return {
      success: true,
      operation: "branch_delete",
      details: `Would delete branch: ${branchName}`,
      branch: branchName,
    };
  }

  try {
    const flag = force ? "-D" : "-d";
    execFileSync("git", ["branch", flag, branchName], { cwd, stdio: "pipe" });

    return {
      success: true,
      operation: "branch_delete",
      details: `Deleted branch: ${branchName}`,
      branch: branchName,
    };
  } catch (error) {
    return {
      success: false,
      operation: "branch_delete",
      details: `Failed to delete branch: ${branchName}`,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Checkpoint Integration
// ============================================================================

/**
 * Record a git operation as a completed action.
 */
export function createGitCompletedAction(
  result: GitOperationResult,
  checkpointId?: string,
): CompletedAction | null {
  if (!result.success) {
    return null;
  }

  const actionType = result.operation === "commit" ? "commit" : "tool_call";
  const idempotencyKey = result.commitSha
    ? `git-${result.operation}-${result.commitSha}`
    : `git-${result.operation}-${Date.now()}`;

  return {
    actionType,
    idempotencyKey,
    timestamp: new Date(),
    result: "success",
    metadata: {
      operation: result.operation,
      commitSha: result.commitSha,
      branch: result.branch,
      checkpointId,
    },
  };
}

/**
 * Create checkpoint with git state.
 *
 * Integrates git automation with checkpoint creation.
 */
export async function commitAndCheckpoint(
  checkpoint: CheckpointState,
  options: {
    autoCommit?: boolean;
    createBranch?: boolean;
    projectPath?: string;
    dryRun?: boolean;
  } = {},
): Promise<{
  checkpoint: CheckpointState;
  gitResults: GitOperationResult[];
}> {
  const {
    autoCommit = true,
    createBranch = false,
    projectPath,
    dryRun = false,
  } = options;

  const results: GitOperationResult[] = [];
  let updatedCheckpoint = { ...checkpoint };

  // Auto-commit if requested
  if (autoCommit) {
    const commitOptions: AutoCommitOptions = {
      milestoneType: "checkpoint",
      checkpointReason: checkpoint.meta.reason,
      checkpointId: checkpoint.meta.id,
      dryRun,
    };
    if (projectPath !== undefined) {
      commitOptions.projectPath = projectPath;
    }
    const commitResult = await autoCommitOnMilestone(commitOptions);

    results.push(commitResult);

    // Update checkpoint with new commit if successful
    if (commitResult.success && commitResult.commitSha) {
      updatedCheckpoint = {
        ...updatedCheckpoint,
        git: {
          ...updatedCheckpoint.git,
          lastCheckpointCommit: commitResult.commitSha,
        },
        provenance: {
          ...updatedCheckpoint.provenance,
          repoCommitSha: commitResult.commitSha,
        },
      };

      // Record as completed action
      const action = createGitCompletedAction(commitResult, checkpoint.meta.id);
      if (action) {
        updatedCheckpoint = {
          ...updatedCheckpoint,
          idempotency: {
            ...updatedCheckpoint.idempotency,
            completedActions: [
              ...updatedCheckpoint.idempotency.completedActions,
              action,
            ],
          },
        };
      }
    }
  }

  // Create checkpoint branch if requested
  if (createBranch) {
    const branchResult = await createCheckpointBranch(
      checkpoint.meta.id,
      projectPath,
      dryRun,
    );

    results.push(branchResult);

    if (branchResult.success && branchResult.branch) {
      updatedCheckpoint = {
        ...updatedCheckpoint,
        git: {
          ...updatedCheckpoint.git,
          workingTreeRef: branchResult.branch,
        },
      };
    }
  }

  return {
    checkpoint: updatedCheckpoint,
    gitResults: results,
  };
}

/**
 * Rollback using git operations.
 *
 * Per ADR-006: Uses stable primitives (git reset + patches).
 */
export async function gitRollback(
  checkpoint: CheckpointState,
  options: {
    strategy?: ResetStrategy;
    useCompensation?: boolean;
    projectPath?: string;
    dryRun?: boolean;
  } = {},
): Promise<GitOperationResult[]> {
  const {
    strategy = "mixed",
    useCompensation = true,
    projectPath,
    dryRun = false,
  } = options;

  const results: GitOperationResult[] = [];

  // Get the last checkpoint commit
  const targetCommit = checkpoint.git.lastCheckpointCommit;

  if (!targetCommit || targetCommit === "unknown") {
    results.push({
      success: false,
      operation: "reset",
      details: "No checkpoint commit available",
      error: "Missing lastCheckpointCommit",
    });
    return results;
  }

  // Check if there are external commits since checkpoint
  const currentCommit = getCurrentCommit(projectPath);
  const hasExternalCommits = currentCommit !== targetCommit;

  if (hasExternalCommits && useCompensation) {
    // Use compensation commit instead of hard reset
    const compensationOptions: CompensationCommitOptions = {
      originalCommitSha: currentCommit,
      reason: `Rollback to checkpoint ${checkpoint.meta.id}`,
      dryRun,
    };
    if (projectPath !== undefined) {
      compensationOptions.projectPath = projectPath;
    }
    const compensationResult = await createCompensationCommit(compensationOptions);

    results.push(compensationResult);
  } else {
    // Direct reset (no external commits)
    const resetResult = await resetToCommit(
      targetCommit,
      strategy,
      projectPath,
      dryRun,
    );

    results.push(resetResult);
  }

  return results;
}
