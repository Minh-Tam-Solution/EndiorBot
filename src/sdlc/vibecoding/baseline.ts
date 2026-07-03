/**
 * Vibecoding Baseline Management
 *
 * Tracks vibecoding index over time to detect regressions.
 * Stores baseline data in ~/.endiorbot/vibecoding/baseline.json
 *
 * @module sdlc/vibecoding/baseline
 * @version 1.0.0
 * @date 2026-02-27
 * @status ACTIVE - Sprint 53
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { VibecodingResult } from "./vibecoding-index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Baseline entry for a specific path.
 */
export interface BaselineEntry {
  path: string;
  score: number;
  zone: string;
  timestamp: string;
  commitHash?: string;
  sprintId?: string;
}

/**
 * Full baseline data structure.
 */
export interface BaselineData {
  version: string;
  projectId: string;
  entries: BaselineEntry[];
  lastUpdated: string;
}

// ============================================================================
// Constants
// ============================================================================

const BASELINE_DIR = join(homedir(), ".endiorbot", "vibecoding");
const BASELINE_FILE = join(BASELINE_DIR, "baseline.json");
const VERSION = "0.1.0-beta.1";

// ============================================================================
// Baseline Manager Class
// ============================================================================

/**
 * Manages vibecoding baseline data for regression detection.
 */
export class BaselineManager {
  private data: BaselineData;
  private readonly filePath: string;

  constructor(projectId: string, filePath?: string) {
    this.filePath = filePath ?? BASELINE_FILE;
    this.data = this.load(projectId);
  }

  /**
   * Load baseline data from file.
   */
  private load(projectId: string): BaselineData {
    try {
      if (existsSync(this.filePath)) {
        const content = readFileSync(this.filePath, "utf-8");
        const data = JSON.parse(content) as BaselineData;

        // Check if same project
        if (data.projectId === projectId) {
          return data;
        }
      }
    } catch {
      // File doesn't exist or is invalid, create new
    }

    return {
      version: VERSION,
      projectId,
      entries: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Save baseline data to file.
   */
  save(): void {
    // Ensure directory exists
    if (!existsSync(BASELINE_DIR)) {
      mkdirSync(BASELINE_DIR, { recursive: true, mode: 0o700 });
    }

    this.data.lastUpdated = new Date().toISOString();
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), {
      mode: 0o600,
    });
  }

  /**
   * Record a new vibecoding result.
   */
  record(
    path: string,
    result: VibecodingResult,
    commitHash?: string,
    sprintId?: string
  ): BaselineEntry {
    const entry: BaselineEntry = {
      path,
      score: result.score,
      zone: result.zone,
      timestamp: result.calculatedAt,
      ...(commitHash !== undefined && { commitHash }),
      ...(sprintId !== undefined && { sprintId }),
    };

    // Add to entries
    this.data.entries.push(entry);

    // Keep only last 100 entries per path
    const pathEntries = this.data.entries.filter((e) => e.path === path);
    if (pathEntries.length > 100) {
      const toRemove = pathEntries.slice(0, pathEntries.length - 100);
      this.data.entries = this.data.entries.filter(
        (e) => !toRemove.includes(e)
      );
    }

    this.save();
    return entry;
  }

  /**
   * Get the most recent baseline entry for a path.
   */
  getBaseline(path: string): BaselineEntry | undefined {
    const entries = this.data.entries.filter((e) => e.path === path);
    return entries.length > 0 ? entries[entries.length - 1] : undefined;
  }

  /**
   * Get all entries for a path.
   */
  getHistory(path: string): BaselineEntry[] {
    return this.data.entries.filter((e) => e.path === path);
  }

  /**
   * Check if current result is a regression from baseline.
   */
  isRegression(path: string, currentScore: number): boolean {
    const baseline = this.getBaseline(path);
    if (!baseline) return false;

    // Score increased by more than 5 points = regression
    return currentScore > baseline.score + 5;
  }

  /**
   * Check if current result is an improvement from baseline.
   */
  isImprovement(path: string, currentScore: number): boolean {
    const baseline = this.getBaseline(path);
    if (!baseline) return false;

    // Score decreased by more than 5 points = improvement
    return currentScore < baseline.score - 5;
  }

  /**
   * Get trend analysis for a path.
   */
  getTrend(
    path: string
  ): "improving" | "stable" | "declining" | "insufficient_data" {
    const history = this.getHistory(path);
    if (history.length < 3) return "insufficient_data";

    // Get last 5 entries
    const recent = history.slice(-5);
    const scores = recent.map((e) => e.score);

    // Calculate trend
    let increasing = 0;
    let decreasing = 0;

    for (let i = 1; i < scores.length; i++) {
      const current = scores[i];
      const previous = scores[i - 1];
      if (current !== undefined && previous !== undefined) {
        if (current > previous) increasing++;
        else if (current < previous) decreasing++;
      }
    }

    if (increasing > decreasing + 1) return "declining"; // Score up = quality down
    if (decreasing > increasing + 1) return "improving"; // Score down = quality up
    return "stable";
  }

  /**
   * Clear all baseline data.
   */
  clear(): void {
    this.data.entries = [];
    this.save();
  }

  /**
   * Get statistics for the project.
   */
  getStats(): {
    totalEntries: number;
    uniquePaths: number;
    averageScore: number;
    lastUpdated: string;
  } {
    const uniquePaths = new Set(this.data.entries.map((e) => e.path)).size;
    const totalEntries = this.data.entries.length;
    const averageScore =
      totalEntries > 0
        ? this.data.entries.reduce((sum, e) => sum + e.score, 0) / totalEntries
        : 0;

    return {
      totalEntries,
      uniquePaths,
      averageScore: Math.round(averageScore * 10) / 10,
      lastUpdated: this.data.lastUpdated,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalBaseline: BaselineManager | undefined;

/**
 * Get the global baseline manager instance.
 */
export function getBaselineManager(projectId?: string): BaselineManager {
  if (!globalBaseline) {
    globalBaseline = new BaselineManager(projectId ?? "default");
  }
  return globalBaseline;
}

/**
 * Reset the global baseline manager.
 */
export function resetBaselineManager(): void {
  globalBaseline = undefined;
}
