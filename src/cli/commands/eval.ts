/**
 * Eval Command
 *
 * CLI commands for the Evaluator-Optimizer Loop.
 *
 * Usage:
 *   endiorbot eval status              - Show evaluator status
 *   endiorbot eval history [--limit]   - Show recent evaluations
 *   endiorbot eval analyze <id>        - Deep analyze a response
 *   endiorbot eval compare <a> <b>     - Compare two responses
 *   endiorbot eval thresholds [--set]  - Show/set thresholds
 *
 * @module cli/commands/eval
 * @version 1.0.0
 * @date 2026-02-25
 * @status ACTIVE - Sprint 48 Day 9
 * @authority ADR-010 Evaluator-Optimizer Loop
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { Command } from "commander";
import { truncate } from "../../utils/text-helpers.js";
import { createEvaluatorLoop } from "../../evaluator/loop.js";
import {
  getRecentFeedback,
  getFeedbackByTask,
  getAverageScore,
  getImprovementRate,
  type FeedbackEntry,
} from "../../evaluator/brain-bridge.js";
import { getScoreLevel } from "../../evaluator/types.js";

// ============================================================================
// Terminal Colors
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function green(text: string): string {
  return `${colors.green}${text}${colors.reset}`;
}

function red(text: string): string {
  return `${colors.red}${text}${colors.reset}`;
}

function yellow(text: string): string {
  return `${colors.yellow}${text}${colors.reset}`;
}

function cyan(text: string): string {
  return `${colors.cyan}${text}${colors.reset}`;
}

function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

// ============================================================================
// Shared Loop Instance
// ============================================================================

// Create a shared loop instance for CLI commands
const loop = createEvaluatorLoop();

// ============================================================================
// Helper Functions
// ============================================================================

function colorScore(score: number): string {
  if (score >= 90) return green(score.toString());
  if (score >= 70) return cyan(score.toString());
  if (score >= 50) return yellow(score.toString());
  return red(score.toString());
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleString();
}

// ============================================================================
// Command Actions
// ============================================================================

/**
 * Show evaluator status.
 */
function statusAction(): void {
  const status = loop.getStatus();
  const metrics = loop.getMetrics();

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Evaluator Status"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  // Loop state
  const stateColor = status.state === "running" ? green : status.state === "paused" ? yellow : dim;
  console.log(`  Loop:           ${stateColor(status.state)}`);
  console.log(`  Auto-Optimize:  ${status.autoOptimize ? green("enabled") : dim("disabled")}`);
  console.log("");

  // Thresholds
  console.log(`  ${bold("Thresholds:")}`);
  console.log(`    Overall:      ${status.thresholds.minOverall}`);
  console.log(`    Per-Dim:      ${status.thresholds.minPerDimension}`);
  console.log(`    Max Retries:  ${status.limits.maxRetries}`);
  console.log("");

  // Recent metrics
  console.log(`  ${bold("Metrics:")}`);
  console.log(`    Evaluated:    ${metrics.totalEvaluated}`);
  console.log(`    Optimized:    ${metrics.totalOptimized}`);
  console.log(`    Failed:       ${metrics.totalFailed}`);
  console.log(`    Skipped:      ${metrics.totalSkipped}`);
  console.log("");

  // Score stats
  const avgScore = getAverageScore() ?? 0;
  const improvementRate = getImprovementRate();
  console.log(`  ${bold("Performance:")}`);
  console.log(`    Avg Score:    ${colorScore(avgScore)}`);
  console.log(`    Improvement:  ${improvementRate}%`);
  console.log(`    Success Rate: ${Math.round(metrics.optimizationSuccessRate * 100)}%`);
  console.log("");

  // Timestamps
  if (status.startedAt) {
    console.log(`  ${bold("Timing:")}`);
    console.log(`    Started:      ${formatTimestamp(status.startedAt)}`);
    if (status.pausedAt) {
      console.log(`    Paused:       ${formatTimestamp(status.pausedAt)}`);
    }
    console.log("");
  }

  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * Show evaluation history.
 */
interface HistoryOptions {
  limit?: string;
  task?: string;
}

function historyAction(options: HistoryOptions): void {
  const limit = options.limit ? parseInt(options.limit, 10) : 20;
  let entries: FeedbackEntry[];

  if (options.task) {
    entries = getFeedbackByTask(options.task);
  } else {
    entries = getRecentFeedback(limit);
  }

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Evaluation History"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  if (entries.length === 0) {
    console.log(dim("  No evaluations found."));
    console.log("");
    console.log(bold("═══════════════════════════════════════════════════════════════"));
    console.log("");
    return;
  }

  // Table header
  console.log(
    `  ${dim("Timestamp".padEnd(20))}  ${dim("Score".padEnd(7))}  ${dim("Level".padEnd(18))}  ${dim("Task")}`
  );
  console.log(dim("  " + "─".repeat(75)));

  // Table rows
  for (const entry of entries.slice(0, limit)) {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const score = colorScore(entry.score);
    const level = getScoreLevel(entry.score);
    const levelColor = level === "excellent" ? green :
                       level === "good" ? cyan :
                       level === "needs_improvement" ? yellow : red;
    const task = truncate(entry.prompt, 30);

    console.log(
      `  ${time.padEnd(20)}  ${score.padEnd(7 + colors.reset.length + colors.green.length)}  ${levelColor(level.padEnd(18))}  ${task}`
    );
  }

  console.log("");
  console.log(dim(`  Showing ${Math.min(entries.length, limit)} of ${entries.length} entries`));
  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * Deep analyze a response by ID.
 */
function analyzeAction(responseId: string): void {
  const entries = getRecentFeedback(1000);
  const entry = entries.find(e => e.prompt.includes(responseId) || e.timestamp.includes(responseId));

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Response Analysis"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  if (!entry) {
    console.log(red(`  ✗ Response "${responseId}" not found in history`));
    console.log("");
    console.log(dim("  Use 'endiorbot eval history' to see available entries."));
    console.log("");
    console.log(bold("═══════════════════════════════════════════════════════════════"));
    console.log("");
    return;
  }

  // Basic info
  console.log(`  ${bold("Task:")}`);
  console.log(`    ${entry.prompt}`);
  console.log("");

  // Score
  console.log(`  ${bold("Score:")}`);
  console.log(`    Overall:      ${colorScore(entry.score)}`);
  console.log(`    Level:        ${getScoreLevel(entry.score)}`);
  console.log("");

  // Strategy
  if (entry.strategyApplied) {
    console.log(`  ${bold("Optimization:")}`);
    console.log(`    Strategy:     ${cyan(entry.strategyApplied)}`);
    console.log(`    Improved:     ${entry.improved ? green("yes") : red("no")}`);
    console.log("");
  }

  // Timestamp
  console.log(`  ${bold("Timing:")}`);
  console.log(`    Evaluated:    ${formatTimestamp(entry.timestamp)}`);
  console.log("");

  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * Compare two responses.
 */
function compareAction(responseA: string, responseB: string): void {
  const entries = getRecentFeedback(1000);
  const entryA = entries.find(e => e.prompt.includes(responseA) || e.timestamp.includes(responseA));
  const entryB = entries.find(e => e.prompt.includes(responseB) || e.timestamp.includes(responseB));

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Response Comparison"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  if (!entryA) {
    console.log(red(`  ✗ Response A "${responseA}" not found`));
  }
  if (!entryB) {
    console.log(red(`  ✗ Response B "${responseB}" not found`));
  }

  if (!entryA || !entryB) {
    console.log("");
    console.log(dim("  Use 'endiorbot eval history' to see available entries."));
    console.log("");
    console.log(bold("═══════════════════════════════════════════════════════════════"));
    console.log("");
    return;
  }

  // Side-by-side comparison
  console.log(`  ${dim("".padEnd(20))}  ${bold("Response A".padEnd(15))}  ${bold("Response B".padEnd(15))}  ${bold("Delta")}`);
  console.log(dim("  " + "─".repeat(60)));

  const delta = entryA.score - entryB.score;
  const deltaStr = delta > 0 ? green(`+${delta}`) : delta < 0 ? red(delta.toString()) : dim("0");

  console.log(`  ${"Score".padEnd(20)}  ${colorScore(entryA.score).padEnd(15 + colors.reset.length + colors.green.length)}  ${colorScore(entryB.score).padEnd(15 + colors.reset.length + colors.green.length)}  ${deltaStr}`);
  console.log(`  ${"Level".padEnd(20)}  ${getScoreLevel(entryA.score).padEnd(15)}  ${getScoreLevel(entryB.score).padEnd(15)}`);
  console.log("");

  // Winner
  const winner = delta > 0 ? "A" : delta < 0 ? "B" : "equal";
  const winnerColor = winner === "A" ? green : winner === "B" ? cyan : dim;
  console.log(`  ${bold("Winner:")}      ${winnerColor(winner === "equal" ? "Equal" : `Response ${winner}`)}`);
  console.log("");

  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * Show or set thresholds.
 */
interface ThresholdOptions {
  overall?: string;
  perDimension?: string;
  maxRetries?: string;
}

function thresholdsAction(options: ThresholdOptions): void {
  const hasOptions = options.overall || options.perDimension || options.maxRetries;

  if (hasOptions) {
    // Set thresholds
    if (options.overall) {
      const val = parseInt(options.overall, 10);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        loop.setThresholds({ minOverall: val });
        console.log(green(`✓ Set overall threshold to ${val}`));
      } else {
        console.log(red("✗ Invalid overall threshold (must be 0-100)"));
      }
    }

    if (options.perDimension) {
      const val = parseInt(options.perDimension, 10);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        loop.setThresholds({ minPerDimension: val });
        console.log(green(`✓ Set per-dimension threshold to ${val}`));
      } else {
        console.log(red("✗ Invalid per-dimension threshold (must be 0-100)"));
      }
    }

    if (options.maxRetries) {
      const val = parseInt(options.maxRetries, 10);
      if (!isNaN(val) && val >= 1 && val <= 10) {
        loop.setMaxRetries(val);
        console.log(green(`✓ Set max retries to ${val}`));
      } else {
        console.log(red("✗ Invalid max retries (must be 1-10)"));
      }
    }

    console.log("");
  }

  // Show current thresholds
  const status = loop.getStatus();

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Evaluator Thresholds"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  console.log(`  ${bold("Pass Thresholds:")}`);
  console.log(`    Overall:        ${cyan(status.thresholds.minOverall.toString())}  ${dim("(score needed to pass)")}`);
  console.log(`    Per-Dimension:  ${cyan(status.thresholds.minPerDimension.toString())}  ${dim("(minimum per dimension)")}`);
  console.log("");

  console.log(`  ${bold("Optimization Limits:")}`);
  console.log(`    Max Retries:    ${cyan(status.limits.maxRetries.toString())}  ${dim("(optimization attempts)")}`);
  console.log(`    Max Time:       ${cyan(formatDuration(status.limits.maxOptimizationTime))}  ${dim("(timeout)")}`);
  console.log("");

  console.log(`  ${bold("Score Levels:")}`);
  console.log(`    ${green("Excellent")}:      90-100`);
  console.log(`    ${cyan("Good")}:           70-89`);
  console.log(`    ${yellow("Needs Work")}:     50-69`);
  console.log(`    ${red("Poor")}:           0-49`);
  console.log("");

  console.log(dim("  Use --overall, --per-dimension, --max-retries to change thresholds"));
  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register eval command.
 */
export function registerEvalCommand(program: Command): void {
  const evalCmd = program
    .command("eval")
    .description("Manage the Evaluator-Optimizer Loop");

  evalCmd
    .command("status")
    .description("Show evaluator status and metrics")
    .action(statusAction);

  evalCmd
    .command("history")
    .description("Show recent evaluation history")
    .option("-l, --limit <n>", "Maximum entries to show (default: 20)")
    .option("-t, --task <text>", "Filter by task (partial match)")
    .action(historyAction);

  evalCmd
    .command("analyze <id>")
    .description("Deep analyze a response by ID or task keyword")
    .action(analyzeAction);

  evalCmd
    .command("compare <a> <b>")
    .description("Compare two responses by ID or task keyword")
    .action(compareAction);

  evalCmd
    .command("thresholds")
    .description("Show or set evaluation thresholds")
    .option("-o, --overall <n>", "Set overall pass threshold (0-100)")
    .option("-d, --per-dimension <n>", "Set per-dimension threshold (0-100)")
    .option("-r, --max-retries <n>", "Set max optimization retries (1-10)")
    .action(thresholdsAction);
}
