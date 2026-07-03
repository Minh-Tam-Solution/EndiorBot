/**
 * Conflict Detector
 *
 * Detects file conflicts between checkpoint state and current filesystem.
 * Compares file hashes to identify external modifications.
 *
 * @module sessions/checkpoint/conflict-detector
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 4
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync } from "node:fs";
import type { CheckpointState, FileConflict, ConflictSeverity } from "./types.js";
import { hashFile } from "./checkpoint.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Conflict type for raw detected conflicts (before classification).
 */
export type ConflictType = "modified" | "deleted" | "created";

/**
 * Raw conflict before classification.
 */
export interface RawConflict {
  /** File path */
  path: string;
  /** Hash at checkpoint time */
  checkpointHash: string;
  /** Current file hash (empty if deleted) */
  currentHash: string;
  /** Type of conflict */
  type: ConflictType;
}

/**
 * Conflict detection result.
 */
export interface ConflictDetectionResult {
  /** Whether any conflicts were detected */
  hasConflicts: boolean;
  /** List of raw conflicts */
  conflicts: RawConflict[];
  /** Number of files checked */
  filesChecked: number;
  /** Files that no longer exist */
  deletedFiles: string[];
  /** New files not in checkpoint */
  newFiles: string[];
  /** Modified files */
  modifiedFiles: string[];
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect file conflicts between checkpoint and current filesystem.
 *
 * @param checkpoint - Checkpoint state to compare against
 * @returns Conflict detection result
 */
export async function detectConflicts(checkpoint: CheckpointState): Promise<ConflictDetectionResult> {
  const conflicts: RawConflict[] = [];
  const deletedFiles: string[] = [];
  const newFiles: string[] = [];
  const modifiedFiles: string[] = [];

  const fileHashes = checkpoint.filesystem.fileHashes;
  const paths = Object.keys(fileHashes);

  for (const path of paths) {
    const checkpointHash = fileHashes[path] ?? "";

    // Check if file still exists
    if (!existsSync(path)) {
      deletedFiles.push(path);
      conflicts.push({
        path,
        checkpointHash,
        currentHash: "",
        type: "deleted",
      });
      continue;
    }

    // Compute current hash
    const currentHash = await hashFile(path);

    // Compare hashes
    if (currentHash !== checkpointHash) {
      modifiedFiles.push(path);
      conflicts.push({
        path,
        checkpointHash,
        currentHash,
        type: "modified",
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    filesChecked: paths.length,
    deletedFiles,
    newFiles,
    modifiedFiles,
  };
}

/**
 * Detect conflicts for specific files only.
 *
 * @param fileHashes - File hashes from checkpoint
 * @param paths - Specific paths to check
 * @returns Conflict detection result
 */
export async function detectConflictsForPaths(
  fileHashes: Record<string, string>,
  paths: string[],
): Promise<ConflictDetectionResult> {
  const conflicts: RawConflict[] = [];
  const deletedFiles: string[] = [];
  const newFiles: string[] = [];
  const modifiedFiles: string[] = [];

  for (const path of paths) {
    const checkpointHash = fileHashes[path];

    // File wasn't in checkpoint - it's new
    if (!checkpointHash) {
      if (existsSync(path)) {
        const currentHash = await hashFile(path);
        newFiles.push(path);
        conflicts.push({
          path,
          checkpointHash: "",
          currentHash,
          type: "created",
        });
      }
      continue;
    }

    // Check if file still exists
    if (!existsSync(path)) {
      deletedFiles.push(path);
      conflicts.push({
        path,
        checkpointHash,
        currentHash: "",
        type: "deleted",
      });
      continue;
    }

    // Compute current hash
    const currentHash = await hashFile(path);

    // Compare hashes
    if (currentHash !== checkpointHash) {
      modifiedFiles.push(path);
      conflicts.push({
        path,
        checkpointHash,
        currentHash,
        type: "modified",
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    filesChecked: paths.length,
    deletedFiles,
    newFiles,
    modifiedFiles,
  };
}

/**
 * Check if a single file has conflicts.
 *
 * @param path - File path
 * @param checkpointHash - Hash at checkpoint time
 * @returns True if file has changed
 */
export async function hasFileConflict(path: string, checkpointHash: string): Promise<boolean> {
  if (!existsSync(path)) {
    return true; // File deleted
  }

  const currentHash = await hashFile(path);
  return currentHash !== checkpointHash;
}

/**
 * Get all modified paths from checkpoint that have conflicts.
 *
 * @param checkpoint - Checkpoint state
 * @returns List of conflicting paths
 */
export async function getConflictingPaths(checkpoint: CheckpointState): Promise<string[]> {
  const result = await detectConflicts(checkpoint);
  return result.conflicts.map((c) => c.path);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Filter conflicts by type.
 *
 * @param conflicts - List of conflicts
 * @param type - Conflict type to filter
 * @returns Filtered conflicts
 */
export function filterConflictsByType(conflicts: RawConflict[], type: ConflictType): RawConflict[] {
  return conflicts.filter((c) => c.type === type);
}

/**
 * Check if any conflicts are of a specific type.
 *
 * @param conflicts - List of conflicts
 * @param type - Conflict type to check
 * @returns True if any conflicts match the type
 */
export function hasConflictType(conflicts: RawConflict[], type: ConflictType): boolean {
  return conflicts.some((c) => c.type === type);
}

/**
 * Convert raw conflicts to FileConflict format (with default severity).
 *
 * @param rawConflicts - Raw conflicts to convert
 * @param defaultSeverity - Default severity for converted conflicts
 * @returns File conflicts with severity
 */
export function toFileConflicts(
  rawConflicts: RawConflict[],
  defaultSeverity: ConflictSeverity = "unknown",
): FileConflict[] {
  return rawConflicts.map((raw) => ({
    path: raw.path,
    checkpointHash: raw.checkpointHash,
    currentHash: raw.currentHash,
    severity: defaultSeverity,
  }));
}
