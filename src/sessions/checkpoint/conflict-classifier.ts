/**
 * Conflict Classifier
 *
 * Classifies file conflicts by severity level.
 * Determines whether conflicts can be auto-resolved or require manual intervention.
 *
 * @module sessions/checkpoint/conflict-classifier
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 4
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { FileConflict, ConflictSeverity } from "./types.js";
import type { RawConflict } from "./conflict-detector.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Classified conflict with severity and metadata.
 */
export interface ClassifiedConflict extends FileConflict {
  /** Original conflict type */
  conflictType: "modified" | "deleted" | "created";
  /** Whether this conflict can be auto-resolved */
  autoResolvable: boolean;
  /** Lines added */
  linesAdded: number;
  /** Lines removed */
  linesRemoved: number;
  /** Detailed reason for classification */
  reason: string;
}

/**
 * Classification result for a set of conflicts.
 */
export interface ClassificationResult {
  /** All classified conflicts */
  conflicts: ClassifiedConflict[];
  /** Conflicts grouped by severity */
  bySeverity: Record<ConflictSeverity, ClassifiedConflict[]>;
  /** Summary counts */
  summary: {
    total: number;
    trivial: number;
    additive: number;
    semantic: number;
    structural: number;
    unknown: number;
    autoResolvable: number;
    requiresReview: number;
  };
  /** Overall recommendation */
  recommendation: "proceed" | "warn" | "review" | "abort";
}

// ============================================================================
// Classification Logic
// ============================================================================

/**
 * Classify a single conflict by severity.
 *
 * @param raw - Raw conflict to classify
 * @param checkpointContent - File content at checkpoint time (optional)
 * @param currentContent - Current file content (optional)
 * @returns Classified conflict
 */
export async function classifyConflict(
  raw: RawConflict,
  checkpointContent?: string,
  currentContent?: string,
): Promise<ClassifiedConflict> {
  // Handle deleted files (structural)
  if (raw.type === "deleted") {
    return {
      path: raw.path,
      checkpointHash: raw.checkpointHash,
      currentHash: raw.currentHash,
      severity: "structural",
      conflictType: "deleted",
      autoResolvable: false,
      linesAdded: 0,
      linesRemoved: checkpointContent ? checkpointContent.split("\n").length : 0,
      reason: "File was deleted externally",
    };
  }

  // Handle new files (structural if conflicts with checkpoint tracked files)
  if (raw.type === "created") {
    return {
      path: raw.path,
      checkpointHash: raw.checkpointHash,
      currentHash: raw.currentHash,
      severity: "structural",
      conflictType: "created",
      autoResolvable: false,
      linesAdded: currentContent ? currentContent.split("\n").length : 0,
      linesRemoved: 0,
      reason: "New file created externally",
    };
  }

  // For modified files, analyze the diff
  if (!checkpointContent || !currentContent) {
    return {
      path: raw.path,
      checkpointHash: raw.checkpointHash,
      currentHash: raw.currentHash,
      severity: "unknown",
      conflictType: "modified",
      autoResolvable: false,
      linesAdded: 0,
      linesRemoved: 0,
      reason: "Unable to read file contents for analysis",
    };
  }

  // Analyze diff
  const analysis = analyzeDiff(checkpointContent, currentContent);

  return {
    path: raw.path,
    checkpointHash: raw.checkpointHash,
    currentHash: raw.currentHash,
    severity: analysis.severity,
    conflictType: "modified",
    autoResolvable: analysis.autoResolvable,
    linesAdded: analysis.linesAdded,
    linesRemoved: analysis.linesRemoved,
    reason: analysis.reason,
  };
}

/**
 * Classify multiple conflicts.
 *
 * @param rawConflicts - List of raw conflicts
 * @param getContent - Optional function to get file content
 * @returns Classification result
 */
export async function classifyConflicts(
  rawConflicts: RawConflict[],
  getContent?: (path: string, hash: string) => Promise<string | undefined>,
): Promise<ClassificationResult> {
  const conflicts: ClassifiedConflict[] = [];
  const bySeverity: Record<ConflictSeverity, ClassifiedConflict[]> = {
    trivial: [],
    additive: [],
    semantic: [],
    structural: [],
    unknown: [],
  };

  for (const raw of rawConflicts) {
    let checkpointContent: string | undefined;
    let currentContent: string | undefined;

    // Try to read current content
    if (raw.currentHash && existsSync(raw.path)) {
      try {
        currentContent = await readFile(raw.path, "utf8");
      } catch {
        // Ignore read errors
      }
    }

    // Try to get checkpoint content if getter provided
    if (getContent && raw.checkpointHash) {
      checkpointContent = await getContent(raw.path, raw.checkpointHash);
    }

    const classified = await classifyConflict(raw, checkpointContent, currentContent);
    conflicts.push(classified);
    bySeverity[classified.severity].push(classified);
  }

  // Calculate summary
  const summary = {
    total: conflicts.length,
    trivial: bySeverity.trivial.length,
    additive: bySeverity.additive.length,
    semantic: bySeverity.semantic.length,
    structural: bySeverity.structural.length,
    unknown: bySeverity.unknown.length,
    autoResolvable: conflicts.filter((c) => c.autoResolvable).length,
    requiresReview: conflicts.filter((c) => !c.autoResolvable).length,
  };

  // Determine recommendation
  const recommendation = determineRecommendation(summary);

  return {
    conflicts,
    bySeverity,
    summary,
    recommendation,
  };
}

// ============================================================================
// Diff Analysis
// ============================================================================

interface DiffAnalysis {
  severity: ConflictSeverity;
  autoResolvable: boolean;
  linesAdded: number;
  linesRemoved: number;
  reason: string;
}

/**
 * Analyze diff between checkpoint and current content.
 */
function analyzeDiff(checkpointContent: string, currentContent: string): DiffAnalysis {
  const checkpointLines = checkpointContent.split("\n");
  const currentLines = currentContent.split("\n");

  // Simple diff: compare line by line
  const addedLines: string[] = [];
  const removedLines: string[] = [];
  const changedIndices: number[] = [];

  // Find differences
  const maxLines = Math.max(checkpointLines.length, currentLines.length);
  for (let i = 0; i < maxLines; i++) {
    const checkpointLine = checkpointLines[i];
    const currentLine = currentLines[i];

    if (checkpointLine !== currentLine) {
      changedIndices.push(i);
      if (checkpointLine !== undefined && currentLine === undefined) {
        removedLines.push(checkpointLine);
      } else if (checkpointLine === undefined && currentLine !== undefined) {
        addedLines.push(currentLine);
      } else if (checkpointLine !== undefined && currentLine !== undefined) {
        removedLines.push(checkpointLine);
        addedLines.push(currentLine);
      }
    }
  }

  const linesAdded = addedLines.length;
  const linesRemoved = removedLines.length;

  // Check for whitespace-only changes (trivial)
  if (isWhitespaceOnly(checkpointContent, currentContent)) {
    return {
      severity: "trivial",
      autoResolvable: true,
      linesAdded,
      linesRemoved,
      reason: "Only whitespace/formatting changes",
    };
  }

  // Check for purely additive changes
  if (isPurelyAdditive(checkpointContent, currentContent)) {
    return {
      severity: "additive",
      autoResolvable: true,
      linesAdded,
      linesRemoved,
      reason: "Only new content added, no existing content modified",
    };
  }

  // Check for semantic changes (same lines modified)
  if (hasSemanticOverlap(changedIndices, checkpointLines.length)) {
    return {
      severity: "semantic",
      autoResolvable: false,
      linesAdded,
      linesRemoved,
      reason: `${changedIndices.length} lines modified with potential conflicts`,
    };
  }

  // Default to unknown for complex changes
  return {
    severity: "unknown",
    autoResolvable: false,
    linesAdded,
    linesRemoved,
    reason: "Complex changes requiring manual review",
  };
}

/**
 * Check if changes are whitespace-only.
 */
function isWhitespaceOnly(before: string, after: string): boolean {
  // Normalize whitespace and compare
  const normalizeBefore = before.replace(/\s+/g, " ").trim();
  const normalizeAfter = after.replace(/\s+/g, " ").trim();
  return normalizeBefore === normalizeAfter;
}

/**
 * Check if changes are purely additive (no removal/modification).
 */
function isPurelyAdditive(before: string, after: string): boolean {
  // Check if the original content is fully contained in the new content
  const beforeLines = before.split("\n").map((l) => l.trim());
  const afterLines = after.split("\n").map((l) => l.trim());

  let beforeIndex = 0;
  for (const afterLine of afterLines) {
    if (beforeIndex < beforeLines.length && afterLine === beforeLines[beforeIndex]) {
      beforeIndex++;
    }
  }

  // All original lines found in order = purely additive
  return beforeIndex === beforeLines.length;
}

/**
 * Check if changes have semantic overlap (modifying existing content).
 */
function hasSemanticOverlap(changedIndices: number[], totalLines: number): boolean {
  // Any line modification is semantic if not trivial/additive
  // Use a threshold of at least 1 changed line
  if (changedIndices.length === 0) {
    return false;
  }

  // If any lines were actually modified (not just added/removed), it's semantic
  const changeRatio = changedIndices.length / totalLines;

  // Consider semantic if: more than 5% changed OR at least 2 lines changed
  return changeRatio > 0.05 || changedIndices.length >= 2;
}

// ============================================================================
// Recommendation Logic
// ============================================================================

/**
 * Determine overall recommendation based on conflict summary.
 */
function determineRecommendation(
  summary: ClassificationResult["summary"],
): ClassificationResult["recommendation"] {
  // No conflicts or all trivial = proceed
  if (summary.total === 0 || summary.total === summary.trivial) {
    return "proceed";
  }

  // Only additive changes = warn but can proceed
  if (summary.total === summary.trivial + summary.additive) {
    return "warn";
  }

  // Any structural conflicts = abort
  if (summary.structural > 0) {
    return "abort";
  }

  // Semantic conflicts = require review
  if (summary.semantic > 0) {
    return "review";
  }

  // Default to review for unknown
  return "review";
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if all conflicts are auto-resolvable.
 */
export function allAutoResolvable(result: ClassificationResult): boolean {
  return result.summary.autoResolvable === result.summary.total;
}

/**
 * Get conflicts that require manual review.
 */
export function getReviewRequired(result: ClassificationResult): ClassifiedConflict[] {
  return result.conflicts.filter((c) => !c.autoResolvable);
}

/**
 * Get a human-readable summary of conflicts.
 */
export function getConflictSummary(result: ClassificationResult): string {
  const lines: string[] = [];

  lines.push(`Total conflicts: ${result.summary.total}`);

  if (result.summary.trivial > 0) {
    lines.push(`  - Trivial (auto-resolve): ${result.summary.trivial}`);
  }
  if (result.summary.additive > 0) {
    lines.push(`  - Additive (auto-merge): ${result.summary.additive}`);
  }
  if (result.summary.semantic > 0) {
    lines.push(`  - Semantic (review needed): ${result.summary.semantic}`);
  }
  if (result.summary.structural > 0) {
    lines.push(`  - Structural (blocking): ${result.summary.structural}`);
  }
  if (result.summary.unknown > 0) {
    lines.push(`  - Unknown: ${result.summary.unknown}`);
  }

  lines.push(`Recommendation: ${result.recommendation.toUpperCase()}`);

  return lines.join("\n");
}
