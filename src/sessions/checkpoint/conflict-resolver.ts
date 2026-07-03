/**
 * Conflict Resolver
 *
 * Resolution strategies for file conflicts during checkpoint resume.
 * Supports auto-resolution for trivial conflicts and manual intervention for semantic conflicts.
 *
 * @module sessions/checkpoint/conflict-resolver
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 4
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { ConflictResolution } from "./types.js";
import type { ClassifiedConflict, ClassificationResult } from "./conflict-classifier.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Resolution result for a single conflict.
 */
export interface ResolvedConflict {
  /** Original conflict */
  conflict: ClassifiedConflict;
  /** Resolution applied */
  resolution: ConflictResolution | "auto_merged";
  /** Whether resolution was successful */
  success: boolean;
  /** Resolution details */
  details: string;
  /** Backup path if created */
  backupPath?: string;
}

/**
 * Batch resolution result.
 */
export interface ResolutionResult {
  /** All resolved conflicts */
  resolved: ResolvedConflict[];
  /** Conflicts that could not be resolved */
  unresolved: ClassifiedConflict[];
  /** Summary */
  summary: {
    total: number;
    autoMerged: number;
    manualRequired: number;
    aborted: number;
    succeeded: number;
    failed: number;
  };
  /** Whether all conflicts were resolved successfully */
  allResolved: boolean;
}

/**
 * Resolution options.
 */
export interface ResolutionOptions {
  /** Backup directory for overwritten files */
  backupDir?: string;
  /** Whether to create backups before overwriting */
  createBackups?: boolean;
  /** Custom content getter for checkpoint files */
  getCheckpointContent?: (path: string) => Promise<string | undefined>;
  /** Dry run mode (don't actually modify files) */
  dryRun?: boolean;
}

// ============================================================================
// Resolution Functions
// ============================================================================

/**
 * Resolve all auto-resolvable conflicts.
 *
 * @param result - Classification result
 * @param options - Resolution options
 * @returns Resolution result
 */
export async function autoResolveConflicts(
  result: ClassificationResult,
  options: ResolutionOptions = {},
): Promise<ResolutionResult> {
  const resolved: ResolvedConflict[] = [];
  const unresolved: ClassifiedConflict[] = [];

  for (const conflict of result.conflicts) {
    if (conflict.autoResolvable) {
      const resolution = await autoResolve(conflict, options);
      resolved.push(resolution);
    } else {
      unresolved.push(conflict);
    }
  }

  const summary = {
    total: result.conflicts.length,
    autoMerged: resolved.filter((r) => r.resolution === "auto_merged").length,
    manualRequired: unresolved.length,
    aborted: 0,
    succeeded: resolved.filter((r) => r.success).length,
    failed: resolved.filter((r) => !r.success).length,
  };

  return {
    resolved,
    unresolved,
    summary,
    allResolved: unresolved.length === 0 && summary.failed === 0,
  };
}

/**
 * Auto-resolve a single conflict (for trivial/additive).
 */
async function autoResolve(
  conflict: ClassifiedConflict,
  _options: ResolutionOptions,
): Promise<ResolvedConflict> {
  // Trivial conflicts: keep current version (whitespace changes only)
  if (conflict.severity === "trivial") {
    return {
      conflict,
      resolution: "auto_merged",
      success: true,
      details: "Trivial whitespace change accepted",
    };
  }

  // Additive conflicts: keep current version (only new content added)
  if (conflict.severity === "additive") {
    return {
      conflict,
      resolution: "auto_merged",
      success: true,
      details: "Additive change accepted (new content preserved)",
    };
  }

  // Should not reach here for non-auto-resolvable conflicts
  return {
    conflict,
    resolution: "auto_merged",
    success: false,
    details: `Cannot auto-resolve ${conflict.severity} conflict`,
  };
}

/**
 * Force restore from checkpoint (overwrite external changes).
 *
 * @param conflict - Conflict to resolve
 * @param checkpointContent - Content from checkpoint
 * @param options - Resolution options
 * @returns Resolution result
 */
export async function forceRestore(
  conflict: ClassifiedConflict,
  checkpointContent: string,
  options: ResolutionOptions = {},
): Promise<ResolvedConflict> {
  const { backupDir, createBackups = true, dryRun = false } = options;

  try {
    let backupPath: string | undefined;

    // Create backup if requested and file exists
    if (createBackups && existsSync(conflict.path) && backupDir) {
      backupPath = await createBackup(conflict.path, backupDir);
    }

    // Write checkpoint content
    if (!dryRun) {
      await writeFile(conflict.path, checkpointContent, "utf8");
    }

    const result: ResolvedConflict = {
      conflict,
      resolution: "force_restore",
      success: true,
      details: dryRun ? "Would overwrite with checkpoint content" : "Restored from checkpoint",
    };
    if (backupPath !== undefined) {
      result.backupPath = backupPath;
    }
    return result;
  } catch (error) {
    return {
      conflict,
      resolution: "force_restore",
      success: false,
      details: `Failed to restore: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Accept current changes as new baseline.
 *
 * @param conflict - Conflict to resolve
 * @param options - Resolution options
 * @returns Resolution result
 */
export async function acceptNewBaseline(
  conflict: ClassifiedConflict,
  options: ResolutionOptions = {},
): Promise<ResolvedConflict> {
  // For "new_baseline", we just accept the current state
  // No file operations needed - the current content becomes the new baseline
  return {
    conflict,
    resolution: "new_baseline",
    success: true,
    details: options.dryRun
      ? "Would accept current content as new baseline"
      : "Accepted current content as new baseline",
  };
}

/**
 * Abort resolution (leave conflict unresolved).
 *
 * @param conflict - Conflict to abort
 * @returns Resolution result
 */
export function abortResolution(conflict: ClassifiedConflict): ResolvedConflict {
  return {
    conflict,
    resolution: "abort",
    success: true,
    details: "Resolution aborted by user",
  };
}

// ============================================================================
// Batch Resolution
// ============================================================================

/**
 * Resolve conflicts with a specific resolution strategy.
 *
 * @param conflicts - Conflicts to resolve
 * @param resolution - Resolution strategy
 * @param options - Resolution options
 * @returns Resolution result
 */
export async function resolveConflicts(
  conflicts: ClassifiedConflict[],
  resolution: ConflictResolution,
  options: ResolutionOptions = {},
): Promise<ResolutionResult> {
  const resolved: ResolvedConflict[] = [];
  const unresolved: ClassifiedConflict[] = [];

  for (const conflict of conflicts) {
    let result: ResolvedConflict;

    switch (resolution) {
      case "force_restore":
        if (options.getCheckpointContent) {
          const content = await options.getCheckpointContent(conflict.path);
          if (content !== undefined) {
            result = await forceRestore(conflict, content, options);
          } else {
            result = {
              conflict,
              resolution: "force_restore",
              success: false,
              details: "Checkpoint content not available",
            };
          }
        } else {
          result = {
            conflict,
            resolution: "force_restore",
            success: false,
            details: "No content getter provided",
          };
        }
        break;

      case "new_baseline":
        result = await acceptNewBaseline(conflict, options);
        break;

      case "abort":
        result = abortResolution(conflict);
        break;

      case "merge_manual":
        // Cannot auto-resolve manual merge
        unresolved.push(conflict);
        continue;

      default:
        unresolved.push(conflict);
        continue;
    }

    resolved.push(result);
  }

  const summary = {
    total: conflicts.length,
    autoMerged: 0,
    manualRequired: unresolved.length,
    aborted: resolved.filter((r) => r.resolution === "abort").length,
    succeeded: resolved.filter((r) => r.success).length,
    failed: resolved.filter((r) => !r.success).length,
  };

  return {
    resolved,
    unresolved,
    summary,
    allResolved: unresolved.length === 0 && summary.failed === 0,
  };
}

// ============================================================================
// Backup Functions
// ============================================================================

/**
 * Create a backup of a file.
 *
 * @param filePath - File to backup
 * @param backupDir - Backup directory
 * @returns Backup file path
 */
async function createBackup(filePath: string, backupDir: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = filePath.replace(/\//g, "_");
  const backupPath = join(backupDir, `${fileName}.${timestamp}.bak`);

  // Ensure backup directory exists
  await mkdir(dirname(backupPath), { recursive: true });

  // Copy file
  await copyFile(filePath, backupPath);

  return backupPath;
}

/**
 * List backup files for a path.
 *
 * @param filePath - Original file path
 * @param backupDir - Backup directory
 * @returns List of backup paths (newest first)
 */
export async function listBackups(filePath: string, backupDir: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");

  if (!existsSync(backupDir)) {
    return [];
  }

  const fileName = filePath.replace(/\//g, "_");
  const files = await readdir(backupDir);

  return files
    .filter((f) => f.startsWith(fileName) && f.endsWith(".bak"))
    .map((f) => join(backupDir, f))
    .sort()
    .reverse();
}

/**
 * Restore from a backup file.
 *
 * @param backupPath - Backup file path
 * @param targetPath - Target file path to restore to
 */
export async function restoreFromBackup(backupPath: string, targetPath: string): Promise<void> {
  if (!existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  await copyFile(backupPath, targetPath);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get available resolution options for a conflict.
 */
export function getAvailableResolutions(conflict: ClassifiedConflict): ConflictResolution[] {
  const resolutions: ConflictResolution[] = [];

  // All conflicts can be aborted
  resolutions.push("abort");

  // Non-structural can be force restored
  if (conflict.severity !== "structural") {
    resolutions.push("force_restore");
  }

  // All can accept new baseline
  resolutions.push("new_baseline");

  // Semantic and structural need manual merge
  if (conflict.severity === "semantic" || conflict.severity === "structural") {
    resolutions.push("merge_manual");
  }

  return resolutions;
}

/**
 * Get recommended resolution for a conflict.
 */
export function getRecommendedResolution(conflict: ClassifiedConflict): ConflictResolution {
  switch (conflict.severity) {
    case "trivial":
      return "new_baseline"; // Accept trivial changes
    case "additive":
      return "new_baseline"; // Accept additive changes
    case "semantic":
      return "merge_manual"; // Need human review
    case "structural":
      return "abort"; // Too risky to proceed
    default:
      return "merge_manual"; // Default to manual review
  }
}
