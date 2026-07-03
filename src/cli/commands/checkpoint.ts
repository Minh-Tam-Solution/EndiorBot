/**
 * Checkpoint Command
 *
 * Create and manage session checkpoints, resume from saved states.
 *
 * Usage:
 *   endiorbot checkpoint                    - Create manual checkpoint
 *   endiorbot checkpoint list               - List available checkpoints
 *   endiorbot checkpoint show <id>          - Show checkpoint details
 *   endiorbot checkpoint cleanup [--keep=10] - Remove old checkpoints
 *   endiorbot resume [checkpointId]         - Resume from checkpoint
 *
 * @module cli/commands/checkpoint
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 9
 * @authority ADR-006 Checkpoint State Model
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { resolve } from "node:path";
import type { Command } from "commander";
import { getCommandLogger } from "../logger.js";
import {
  // Checkpoint management
  createCheckpoint,
  saveCheckpoint,
  loadCheckpoint,
  getLatestCheckpoint,
  listCheckpoints,
  cleanupCheckpoints,
  // Resume functionality
  resumeFromCheckpoint,
  canResume,
  getResumePreview,
  // Git integration
  isGitRepository,
  getCurrentBranch,
  getCurrentCommit,
  getUncommittedFiles,
  // Types
  type CheckpointState,
  type ResumeStep,
  type ResumeResult,
  type ResumeOptions,
} from "../../sessions/checkpoint/index.js";
import type { Session } from "../../sessions/types.js";

// ============================================================================
// Types
// ============================================================================

interface CheckpointCommandOptions {
  verbose?: boolean;
  reason?: string;
  description?: string;
  dryRun?: boolean;
}

interface ResumeCommandOptions {
  verbose?: boolean;
  dryRun?: boolean;
  skipConflicts?: boolean;
  force?: boolean;
}

interface ListCommandOptions {
  verbose?: boolean;
  limit?: number;
  json?: boolean;
}

interface CleanupCommandOptions {
  verbose?: boolean;
  keep?: number;
  dryRun?: boolean;
  force?: boolean;
}

// ============================================================================
// Progress Display
// ============================================================================

/**
 * Format step status with emoji.
 */
function formatStepStatus(
  step: string,
  status: "pending" | "running" | "success" | "failed" | "skipped",
): string {
  const icons: Record<string, string> = {
    pending: "  ",
    running: "  ",
    success: "  ",
    failed: "  ",
    skipped: "  ",
  };
  return `${icons[status]} ${step}`;
}

/**
 * Create progress callback for resume operation.
 */
function createProgressCallback(
  verbose: boolean,
): (step: ResumeStep, status: "started" | "completed" | "skipped") => void {
  const steps: ResumeStep[] = [];

  return (step: ResumeStep, status: "started" | "completed" | "skipped") => {
    // Track completed steps
    if (status === "started" && !steps.includes(step)) {
      steps.push(step);

      // Show step progress
      const stepNames: Record<ResumeStep, string> = {
        version_check: "Checking version",
        provenance_check: "Checking provenance",
        conflict_detection: "Detecting conflicts",
        idempotency_check: "Checking idempotency",
        brain_verification: "Verifying brain",
        state_machine_restore: "Restoring state machine",
        session_restore: "Restoring session",
        tool_call_resume: "Resuming tool calls",
        success: "Finalizing",
      };

      const stepName = stepNames[step] ?? step;
      console.log(formatStepStatus(stepName, "running"));

      if (verbose) {
        console.log(`   Step: ${step}`);
      }
    }
  };
}

// ============================================================================
// Checkpoint Command
// ============================================================================

/**
 * Create checkpoint action.
 */
async function createCheckpointAction(
  options: CheckpointCommandOptions,
): Promise<void> {
  const log = getCommandLogger("checkpoint");
  const projectPath = process.cwd();

  log.debug("Creating checkpoint", { projectPath });

  console.log("");
  console.log("  Creating Checkpoint...");
  console.log("");

  try {
    // Gather git state if available
    let gitInfo: { branch: string; commit: string; uncommitted: string[] } | undefined;
    if (isGitRepository(projectPath)) {
      const branch = getCurrentBranch(projectPath);
      const commit = getCurrentCommit(projectPath);
      const uncommitted = getUncommittedFiles(projectPath);

      gitInfo = { branch, commit, uncommitted };
    }

    // Create a minimal session for manual checkpoint
    const now = new Date();
    const session: Session = {
      id: `cli-${Date.now()}`,
      projectId: "cli-project",
      createdAt: now,
      lastActiveAt: now,
      messages: [],
      tokenCount: 0,
      maxTokens: 50000,
      sdlcStage: "04-BUILD",
      activeGates: [],
      compactionCount: 0,
    };

    // Create checkpoint options
    const checkpointOptions: Parameters<typeof createCheckpoint>[0] = {
      reason: (options.reason as "manual") ?? "manual",
      session,
      activeSoul: "assistant",
      currentPhase: "implement",
      sessionCostSoFar: 0,
      tokenUsage: [],
    };
    if (options.description !== undefined) {
      checkpointOptions.description = options.description;
    }

    // Create checkpoint
    const checkpoint = await createCheckpoint(checkpointOptions);

    // Save checkpoint
    await saveCheckpoint(checkpoint);

    // Display result
    console.log("  Checkpoint created successfully!");
    console.log("");
    console.log(`  ID:          ${checkpoint.meta.id}`);
    console.log(`  Reason:      ${checkpoint.meta.reason}`);
    console.log(`  Created:     ${checkpoint.meta.createdAt.toLocaleString()}`);

    if (gitInfo) {
      console.log(`  Git Branch:  ${gitInfo.branch}`);
      console.log(`  Git Commit:  ${gitInfo.commit.slice(0, 7)}`);
      if (gitInfo.uncommitted.length > 0) {
        console.log(`  Uncommitted: ${gitInfo.uncommitted.length} files`);
      }
    }

    console.log("");
    console.log("  To resume from this checkpoint:");
    console.log(`    endiorbot resume ${checkpoint.meta.id.slice(0, 8)}`);
    console.log("");

    log.info("Checkpoint created", {
      id: checkpoint.meta.id,
      reason: checkpoint.meta.reason,
    });
  } catch (error) {
    log.error("Failed to create checkpoint", { error });
    console.error(`  Failed to create checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ============================================================================
// Resume Command
// ============================================================================

/**
 * Resume from checkpoint action.
 */
async function resumeAction(
  checkpointId: string | undefined,
  options: ResumeCommandOptions,
): Promise<void> {
  const log = getCommandLogger("resume");
  const projectPath = resolve(process.cwd());

  log.debug("Resuming from checkpoint", { checkpointId, projectPath });

  console.log("");
  console.log("  Resuming Session...");
  console.log("");

  try {
    // Get checkpoint to resume from
    let checkpoint: CheckpointState | null;

    if (checkpointId) {
      // Try to find by partial ID
      const checkpoints = await listCheckpoints();
      const match = checkpoints.find(
        (cp) =>
          cp.id.startsWith(checkpointId) ||
          cp.id === checkpointId,
      );

      if (!match) {
        console.error(`  Checkpoint not found: ${checkpointId}`);
        console.error("  Run 'endiorbot checkpoint list' to see available checkpoints.");
        process.exit(1);
      }

      checkpoint = await loadCheckpoint(match.id);
    } else {
      // Get latest checkpoint
      checkpoint = await getLatestCheckpoint();
    }

    if (!checkpoint) {
      console.error("  No checkpoint found to resume from.");
      console.error("  Create a checkpoint first: endiorbot checkpoint");
      process.exit(1);
    }

    // Show checkpoint info
    console.log(`  Checkpoint: ${checkpoint.meta.id.slice(0, 8)}...`);
    const metaCreatedAt = checkpoint.meta.createdAt instanceof Date ? checkpoint.meta.createdAt : new Date(checkpoint.meta.createdAt);
    console.log(`  Created:    ${metaCreatedAt.toLocaleString()}`);
    console.log(`  Reason:     ${checkpoint.meta.reason}`);

    if (checkpoint.meta.description) {
      console.log(`  Description: ${checkpoint.meta.description}`);
    }
    console.log("");

    // Check if resume is possible
    const canResumeResult = await canResume(projectPath, undefined, checkpoint.meta.id);
    if (!canResumeResult.canResume) {
      console.error(`  Cannot resume: ${canResumeResult.reason}`);

      if (!options.force) {
        console.error("");
        console.error("  Use --force to override.");
        process.exit(1);
      } else {
        console.log("");
        console.log("  --force specified, proceeding anyway...");
      }
    }

    // Dry run preview
    if (options.dryRun) {
      console.log("  [DRY RUN] Would perform the following steps:");
      console.log("");

      const preview = await getResumePreview(projectPath, undefined, checkpoint.meta.id);
      console.log(`    - Needs migration: ${preview.needsMigration ? "Yes" : "No"}`);
      console.log(`    - Tools to retry: ${preview.toolsToRetry}`);
      console.log(`    - Tasks to resume: ${preview.tasksToResume}`);

      if (preview.conflicts?.hasConflicts) {
        console.log(`    - Conflicts detected: ${preview.conflicts.conflicts.length}`);
      }

      console.log("");
      console.log("  No changes made (dry run).");
      return;
    }

    // Execute resume
    console.log("  Executing resume...");
    console.log("");

    const resumeOptions: ResumeOptions = {
      checkpointId: checkpoint.meta.id,
      projectPath,
      autoResolve: !options.skipConflicts,
      onProgress: createProgressCallback(options.verbose ?? false),
    };
    if (options.force !== undefined) {
      resumeOptions.force = options.force;
    }
    const result: ResumeResult = await resumeFromCheckpoint(resumeOptions);

    console.log("");

    // Show result
    if (result.success) {
      console.log("  Session resumed successfully!");
      console.log("");

      if (result.toolsToRetry.length > 0) {
        console.log(`  Tools to retry: ${result.toolsToRetry.length}`);
      }
      if (result.tasksToResume > 0) {
        console.log(`  Tasks to resume: ${result.tasksToResume}`);
      }
      if (result.warnings.length > 0) {
        console.log("");
        console.log("  Warnings:");
        for (const warning of result.warnings) {
          console.log(`    - ${warning}`);
        }
      }
    } else {
      console.error("  Resume failed!");
      console.error("");

      if (result.error) {
        console.error(`  Error: ${result.error}`);
      }

      if (result.failedStep) {
        console.error(`  Failed at step: ${result.failedStep}`);
      }

      process.exit(1);
    }

    console.log("");
    log.info("Session resumed", {
      checkpointId: checkpoint.meta.id,
      toolsToRetry: result.toolsToRetry.length,
    });
  } catch (error) {
    log.error("Failed to resume session", { error });
    console.error(`  Resume failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ============================================================================
// List Command
// ============================================================================

/**
 * List checkpoints action.
 */
async function listAction(options: ListCommandOptions): Promise<void> {
  const log = getCommandLogger("checkpoint-list");

  log.debug("Listing checkpoints");

  try {
    const checkpoints = await listCheckpoints();

    if (options.json) {
      console.log(JSON.stringify(checkpoints, null, 2));
      return;
    }

    console.log("");
    console.log("  Available Checkpoints");
    console.log("  " + "=".repeat(58));

    if (checkpoints.length === 0) {
      console.log("");
      console.log("  No checkpoints found.");
      console.log("  Create one with: endiorbot checkpoint");
      console.log("");
      return;
    }

    const limit = options.limit ?? 10;
    const displayedCheckpoints = checkpoints.slice(0, limit);

    for (const cp of displayedCheckpoints) {
      console.log("");
      console.log(`  ID: ${cp.id.slice(0, 8)}...`);
      const createdDate = cp.createdAt instanceof Date ? cp.createdAt : new Date(cp.createdAt);
      console.log(`  Created: ${createdDate.toLocaleString()}`);
      console.log(`  Reason:  ${cp.reason}`);

      if (options.verbose) {
        console.log(`  Phase: ${cp.currentPhase}`);
        console.log(`  Cost: $${cp.sessionCost.toFixed(4)}`);
        console.log(`  Files: ${cp.filesModified}`);
        if (cp.description) {
          console.log(`  Description: ${cp.description}`);
        }
      }
    }

    if (checkpoints.length > limit) {
      console.log("");
      console.log(`  ... and ${checkpoints.length - limit} more (use --limit to show more)`);
    }

    console.log("");
    console.log("  " + "=".repeat(58));
    console.log(`  Total: ${checkpoints.length} checkpoint(s)`);
    console.log("");

    log.info("Listed checkpoints", { count: checkpoints.length });
  } catch (error) {
    log.error("Failed to list checkpoints", { error });
    console.error(`  Failed to list checkpoints: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ============================================================================
// Show Command
// ============================================================================

/**
 * Show checkpoint details action.
 */
async function showAction(
  checkpointId: string,
  options: { verbose?: boolean; json?: boolean },
): Promise<void> {
  const log = getCommandLogger("checkpoint-show");

  log.debug("Showing checkpoint", { checkpointId });

  try {
    // Find checkpoint by partial ID
    const checkpoints = await listCheckpoints();
    const match = checkpoints.find(
      (cp) =>
        cp.id.startsWith(checkpointId) ||
        cp.id === checkpointId,
    );

    if (!match) {
      console.error(`  Checkpoint not found: ${checkpointId}`);
      process.exit(1);
    }

    const checkpoint = await loadCheckpoint(match.id);

    if (!checkpoint) {
      console.error(`  Failed to load checkpoint: ${checkpointId}`);
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify(checkpoint, null, 2));
      return;
    }

    console.log("");
    console.log("  Checkpoint Details");
    console.log("  " + "=".repeat(58));
    console.log("");
    console.log(`  ID:            ${checkpoint.meta.id}`);
    console.log(`  Schema Version: ${checkpoint.meta.schemaVersion}`);
    const showCreatedAt = checkpoint.meta.createdAt instanceof Date ? checkpoint.meta.createdAt : new Date(checkpoint.meta.createdAt);
    console.log(`  Created:       ${showCreatedAt.toLocaleString()}`);
    console.log(`  Reason:        ${checkpoint.meta.reason}`);

    if (checkpoint.meta.description) {
      console.log(`  Description:   ${checkpoint.meta.description}`);
    }

    console.log("");
    console.log("  Session:");
    console.log(`    Session ID:  ${checkpoint.session.session.id}`);
    console.log(`    Soul Type:   ${checkpoint.session.activeSoul ?? "none"}`);

    if (checkpoint.cost.tokenUsage.length > 0) {
      const totalTokens = checkpoint.cost.tokenUsage.reduce(
        (sum, t) => sum + t.input + t.output,
        0,
      );
      console.log(`    Token Usage: ${totalTokens} tokens`);
    }

    console.log("");
    console.log("  Git State:");
    console.log(`    Branch:      ${checkpoint.git.branch}`);
    console.log(`    Commit:      ${checkpoint.git.lastCheckpointCommit.slice(0, 7)}`);
    console.log(`    Uncommitted: ${checkpoint.git.uncommittedChanges.length > 0 ? "Yes" : "No"}`);

    if (checkpoint.git.uncommittedChanges.length > 0 && options.verbose) {
      for (const file of checkpoint.git.uncommittedChanges.slice(0, 5)) {
        console.log(`      - ${file}`);
      }
      if (checkpoint.git.uncommittedChanges.length > 5) {
        console.log(`      ... and ${checkpoint.git.uncommittedChanges.length - 5} more`);
      }
    }

    if (options.verbose) {
      console.log("");
      console.log("  Filesystem Delta:");
      console.log(`    Created:  ${checkpoint.filesystem.createdFiles.length} files`);
      console.log(`    Modified: ${checkpoint.filesystem.modifiedFiles.length} files`);
    }

    console.log("");
    console.log("  " + "=".repeat(58));
    console.log("");

    log.info("Showed checkpoint", { checkpointId: checkpoint.meta.id });
  } catch (error) {
    log.error("Failed to show checkpoint", { error });
    console.error(`  Failed to show checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ============================================================================
// Cleanup Command
// ============================================================================

/**
 * Cleanup old checkpoints action.
 */
async function cleanupAction(options: CleanupCommandOptions): Promise<void> {
  const log = getCommandLogger("checkpoint-cleanup");
  const keepCount = options.keep ?? 10;

  log.debug("Cleaning up checkpoints", { keepCount });

  try {
    const checkpoints = await listCheckpoints();

    if (options.dryRun) {
      console.log("");
      console.log(`  [DRY RUN] Would keep ${keepCount} most recent checkpoints`);

      if (checkpoints.length <= keepCount) {
        console.log(`  No checkpoints would be removed (only ${checkpoints.length} exist).`);
      } else {
        const toRemove = checkpoints.slice(keepCount);
        console.log(`  Would remove ${toRemove.length} checkpoint(s):`);
        for (const cp of toRemove) {
          console.log(`    - ${cp.id.slice(0, 8)}... (${cp.createdAt.toLocaleDateString()})`);
        }
      }
      console.log("");
      return;
    }

    if (!options.force && checkpoints.length > keepCount) {
      console.log("");
      console.log(`  This will keep ${keepCount} most recent checkpoints and remove ${checkpoints.length - keepCount}.`);
      console.log("  Use --force to confirm, or --dry-run to preview.");
      console.log("");
      return;
    }

    console.log("");
    console.log(`  Cleaning up checkpoints (keeping ${keepCount} most recent)...`);

    const removed = await cleanupCheckpoints(keepCount);

    console.log("");
    console.log(`  Removed ${removed} checkpoint(s)`);
    console.log(`  Remaining: ${checkpoints.length - removed} checkpoint(s)`);
    console.log("");

    log.info("Cleaned up checkpoints", {
      removed,
      remaining: checkpoints.length - removed,
    });
  } catch (error) {
    log.error("Failed to cleanup checkpoints", { error });
    console.error(`  Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register checkpoint command with subcommands.
 */
export function registerCheckpointCommand(program: Command): void {
  const checkpoint = program
    .command("checkpoint")
    .description("Manage session checkpoints")
    .option("-v, --verbose", "Show detailed output")
    .option("-r, --reason <reason>", "Checkpoint reason", "manual")
    .option("-d, --description <desc>", "Checkpoint description")
    .option("--dry-run", "Preview without making changes")
    .action(createCheckpointAction);

  // Subcommand: list
  checkpoint
    .command("list")
    .description("List available checkpoints")
    .option("-v, --verbose", "Show detailed output")
    .option("-l, --limit <n>", "Maximum number to display", "10")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      await listAction({
        verbose: opts.verbose,
        limit: parseInt(opts.limit, 10),
        json: opts.json,
      });
    });

  // Subcommand: show
  checkpoint
    .command("show <checkpointId>")
    .description("Show checkpoint details")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output as JSON")
    .action(showAction);

  // Subcommand: cleanup
  checkpoint
    .command("cleanup")
    .description("Remove old checkpoints")
    .option("-v, --verbose", "Show detailed output")
    .option("--keep <n>", "Number of checkpoints to keep", "10")
    .option("--dry-run", "Preview without removing")
    .option("-f, --force", "Skip confirmation")
    .action(async (opts) => {
      await cleanupAction({
        verbose: opts.verbose,
        keep: parseInt(opts.keep, 10),
        dryRun: opts.dryRun,
        force: opts.force,
      });
    });
}

/**
 * Register resume command (top-level).
 */
export function registerResumeCommand(program: Command): void {
  program
    .command("resume [checkpointId]")
    .description("Resume session from checkpoint")
    .option("-v, --verbose", "Show detailed output")
    .option("--dry-run", "Preview without making changes")
    .option("--skip-conflicts", "Skip conflicting files")
    .option("-f, --force", "Force resume despite conflicts")
    .action(resumeAction);
}
