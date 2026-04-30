/**
 * Session Handoff
 *
 * Creates, saves, and loads session handoff documents.
 * Captures agent intent (workingOn, blocked, nextSteps) for session continuity.
 *
 * Adapted from ClawVault's sleep command (src/commands/sleep.ts).
 *
 * @module memory/session-handoff
 * @version 1.0.0
 * @date 2026-03-11
 * @status ACTIVE - Sprint 101
 * @origin ClawVault v3.2.0 (src/commands/sleep.ts)
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { SessionHandoff } from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/** Base directory for handoff storage. */
const MEMORY_BASE_DIR = join(homedir(), ".endiorbot", "memory");

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a session handoff document.
 * Generates a timestamp automatically.
 *
 * @param data - Handoff data (sessionId, workingOn, blocked, etc.)
 * @returns Complete SessionHandoff with createdAt timestamp
 */
export function createHandoff(
  data: Omit<SessionHandoff, "createdAt">,
): SessionHandoff {
  return {
    ...data,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Save a handoff document to disk.
 * Storage: ~/.endiorbot/memory/{projectId}/handoffs/{sessionId}.json
 *
 * @param projectId - Project identifier for scoping
 * @param handoff - The handoff document to save
 */
export function saveHandoff(projectId: string, handoff: SessionHandoff): void {
  const handoffDir = getHandoffDir(projectId);

  if (!existsSync(handoffDir)) {
    mkdirSync(handoffDir, { recursive: true });
  }

  const filePath = join(handoffDir, `${handoff.sessionId}.json`);
  writeFileSync(filePath, JSON.stringify(handoff, null, 2), "utf-8");
}

/**
 * Load the most recent handoff document for a project.
 *
 * Uses mtime as a fast-path heuristic to identify a probable newest file,
 * then falls back to scanning all files by `createdAt` if there are mtime
 * ties (e.g., multiple writes in the same millisecond on fast filesystems).
 *
 * The mtime fast-path covers the common case (1 file or clear mtime ordering).
 * The createdAt scan handles the edge case (file mtimes equal — would
 * non-deterministically return the first iterated file otherwise).
 *
 * Aligned with `loadAllHandoffs` semantics (which sorts by `createdAt`).
 *
 * Refs: issue #8 — CI Docker writes occur within same millisecond, mtime
 * ties produce wrong result. Fixed by createdAt tiebreaker.
 *
 * @param projectId - Project identifier
 * @returns Latest SessionHandoff or null if none exists
 */
export function loadLatestHandoff(projectId: string): SessionHandoff | null {
  const handoffDir = getHandoffDir(projectId);

  if (!existsSync(handoffDir)) return null;

  const files = readdirSync(handoffDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) return null;

  // Fast path: 1 file → just read it
  if (files.length === 1) {
    try {
      const content = readFileSync(join(handoffDir, files[0]!), "utf-8");
      return JSON.parse(content) as SessionHandoff;
    } catch {
      return null;
    }
  }

  // Find newest file by mtime, tracking ties for fallback
  let newestFile = files[0]!;
  let newestMtime = -1;
  let mtimeTie = false;
  for (const file of files) {
    try {
      const mtime = statSync(join(handoffDir, file)).mtimeMs;
      if (mtime > newestMtime) {
        newestMtime = mtime;
        newestFile = file;
        mtimeTie = false;
      } else if (mtime === newestMtime && file !== newestFile) {
        mtimeTie = true;
      }
    } catch {
      // Skip files we can't stat
    }
  }

  // Fallback: if any mtime tie at the top, scan by createdAt to break it
  // deterministically (consistent with loadAllHandoffs semantics).
  if (mtimeTie) {
    let newestByCreatedAt: SessionHandoff | null = null;
    for (const file of files) {
      try {
        const content = readFileSync(join(handoffDir, file), "utf-8");
        const handoff = JSON.parse(content) as SessionHandoff;
        if (
          newestByCreatedAt === null ||
          handoff.createdAt.localeCompare(newestByCreatedAt.createdAt) > 0
        ) {
          newestByCreatedAt = handoff;
        }
      } catch {
        // Skip malformed
      }
    }
    return newestByCreatedAt;
  }

  // Common path: mtime winner is unambiguous
  try {
    const content = readFileSync(join(handoffDir, newestFile), "utf-8");
    return JSON.parse(content) as SessionHandoff;
  } catch {
    console.warn(`[SessionHandoff] Skipping malformed handoff: ${newestFile}`);
    return null;
  }
}

/**
 * Load all handoff documents for a project.
 * Sorted by createdAt ascending (oldest first).
 *
 * @param projectId - Project identifier
 * @returns Array of SessionHandoff documents
 */
export function loadAllHandoffs(projectId: string): SessionHandoff[] {
  const handoffDir = getHandoffDir(projectId);

  if (!existsSync(handoffDir)) return [];

  const files = readdirSync(handoffDir).filter((f) => f.endsWith(".json"));
  const handoffs: SessionHandoff[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(handoffDir, file), "utf-8");
      handoffs.push(JSON.parse(content) as SessionHandoff);
    } catch {
      console.warn(`[SessionHandoff] Skipping malformed handoff: ${file}`);
    }
  }

  handoffs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return handoffs;
}

// ============================================================================
// Internal
// ============================================================================

function getHandoffDir(projectId: string): string {
  return join(MEMORY_BASE_DIR, projectId, "handoffs");
}
