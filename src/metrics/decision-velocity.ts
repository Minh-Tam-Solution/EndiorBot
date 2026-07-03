/**
 * Decision Velocity Metric — Sprint 131
 *
 * Sau Sheong insight: "Engineering capacity is no longer the constraint.
 * Decision speed is." This module computes how long it takes CEO to go
 * from plan creation to first agent execution, as a single observable
 * number for the `endiorbot status` command.
 *
 * Definition (exact):
 *   For each `endiorbot plan` invocation in the last N days, measure time
 *   until the first `endiorbot agent` command references any task from
 *   that plan (matched by filename slug). Report median. Skip plans with
 *   no matching execution within the window.
 *
 * No new storage: reuses existing drafts/*.md files (mtime) + audit log.
 * Fail-soft: returns null on any error or insufficient data.
 *
 * @module metrics/decision-velocity
 * @version 1.0.0
 * @date 2026-04-10
 * @status ACTIVE - Sprint 131
 * @authority Sprint 131 plan (Sau Sheong cherry-pick)
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AuditEntry } from "../agents/safety/audit-logger.js";

// ============================================================================
// Types
// ============================================================================

export interface DecisionVelocityResult {
  /** Median minutes from plan creation to first matching agent invocation */
  medianMinutes: number;
  /** Number of plans that had a matching execution within the window */
  matchedPlans: number;
  /** Total plans found in the window (including unmatched) */
  totalPlans: number;
  /** Window size in days */
  windowDays: number;
}

// ============================================================================
// Computation
// ============================================================================

/**
 * Compute decision velocity metric for a project.
 *
 * @param projectPath - Absolute path to the project containing docs/04-build/sprints/drafts/
 * @param windowDays - Lookback window (default 7 days)
 * @returns Result or null if no data / all reads failed
 */
export function computeDecisionVelocity(
  projectPath: string,
  windowDays: number = 7,
): DecisionVelocityResult | null {
  try {
    const plans = listRecentPlans(projectPath, windowDays);
    if (plans.length === 0) return null;

    const auditEntries = readAuditLogWithinWindow(windowDays);
    if (auditEntries.length === 0) {
      return {
        medianMinutes: 0,
        matchedPlans: 0,
        totalPlans: plans.length,
        windowDays,
      };
    }

    const deltas: number[] = [];
    for (const plan of plans) {
      const firstMatch = findFirstMatchingAgentCall(plan, auditEntries);
      if (firstMatch) {
        const deltaMs = new Date(firstMatch.ts).getTime() - plan.createdAt.getTime();
        if (deltaMs > 0) {
          deltas.push(deltaMs / 60000); // minutes
        }
      }
    }

    if (deltas.length === 0) {
      return {
        medianMinutes: 0,
        matchedPlans: 0,
        totalPlans: plans.length,
        windowDays,
      };
    }

    return {
      medianMinutes: Math.round(median(deltas)),
      matchedPlans: deltas.length,
      totalPlans: plans.length,
      windowDays,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Private helpers
// ============================================================================

interface PlanFile {
  filename: string;
  slug: string;
  createdAt: Date;
}

function listRecentPlans(projectPath: string, windowDays: number): PlanFile[] {
  const draftsDir = join(projectPath, "docs", "04-build", "sprints", "drafts");
  if (!existsSync(draftsDir)) return [];

  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const entries = readdirSync(draftsDir);
  const plans: PlanFile[] = [];

  for (const filename of entries) {
    if (!filename.startsWith("plan-") || !filename.endsWith(".md")) continue;
    try {
      const fullPath = join(draftsDir, filename);
      const stat = statSync(fullPath);
      if (stat.mtimeMs < cutoff) continue;

      // filename format: plan-YYYY-MM-DD-slug-goes-here.md
      // slug is everything after the date prefix (4th dash group onwards)
      const base = filename.replace(/^plan-\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
      if (base.length === 0) continue;

      plans.push({
        filename,
        slug: base,
        createdAt: new Date(stat.mtimeMs),
      });
    } catch {
      // Skip unreadable files
    }
  }

  return plans;
}

function readAuditLogWithinWindow(windowDays: number): AuditEntry[] {
  const logPath = join(homedir(), ".endiorbot", "logs", "audit.jsonl");
  if (!existsSync(logPath)) return [];

  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const entries: AuditEntry[] = [];

  try {
    const content = readFileSync(logPath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as AuditEntry;
        if (entry && entry.ts && new Date(entry.ts).getTime() >= cutoff) {
          entries.push(entry);
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Log unreadable
  }

  return entries.sort((a, b) => a.ts.localeCompare(b.ts));
}

/**
 * Find the first audit entry where the task text contains enough of the plan's
 * slug keywords to be considered a "match". Simple scoring: if 3+ slug words
 * appear in the task description (case-insensitive), it counts.
 */
function findFirstMatchingAgentCall(
  plan: PlanFile,
  auditEntries: AuditEntry[],
): AuditEntry | null {
  const slugWords = plan.slug.split("-").filter(w => w.length >= 3);
  if (slugWords.length === 0) return null;

  const requiredMatches = Math.min(3, slugWords.length);

  for (const entry of auditEntries) {
    if (new Date(entry.ts).getTime() < plan.createdAt.getTime()) continue;
    const taskLower = (entry.task || "").toLowerCase();
    const hits = slugWords.filter(w => taskLower.includes(w)).length;
    if (hits >= requiredMatches) {
      return entry;
    }
  }

  return null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}
