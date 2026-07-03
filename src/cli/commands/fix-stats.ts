/**
 * Fix Stats Command
 *
 * Display self-correction success rates and analysis.
 *
 * Usage:
 *   endiorbot fix-stats                   - Show overall stats
 *   endiorbot fix-stats --category BUILD  - Show specific category
 *   endiorbot fix-stats --session         - Show current session only
 *   endiorbot fix-stats --export csv      - Export to CSV
 *
 * Per CTO Day 5-7 guidance:
 * - Show success rates by category vs. targets
 * - Show whether each category is 'above target / below target / insufficient data'
 * - Red/yellow/green terminal coloring
 *
 * @module cli/commands/fix-stats
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 37 Day 5-7
 * @authority ADR-007 Budget Control, Phase 3
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { Command } from "commander";
import {
  createFixLogger,
  getDefaultLogPath,
} from "../../self-correction/fix-logger.js";
import type { ErrorCategory } from "../../self-correction/types.js";

// ============================================================================
// Types
// ============================================================================

interface FixStatsOptions {
  category?: ErrorCategory;
  session?: boolean;
  export?: "csv" | "json";
  verbose?: boolean;
}

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
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function red(text: string): string {
  return `${colors.red}${text}${colors.reset}`;
}

function green(text: string): string {
  return `${colors.green}${text}${colors.reset}`;
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
// Status Helpers
// ============================================================================

/**
 * Minimum samples required for valid statistics.
 */
const MIN_SAMPLES = 5;

/**
 * Get status label and color for category.
 */
function getCategoryStatus(
  actual: number,
  target: number,
  sampleCount: number
): { label: string; color: (text: string) => string } {
  if (sampleCount < MIN_SAMPLES) {
    return { label: "INSUFFICIENT DATA", color: yellow };
  }

  if (actual >= target) {
    return { label: "ABOVE TARGET", color: green };
  }

  // Below target - use red for significantly below, yellow for close
  const ratio = actual / target;
  if (ratio >= 0.8) {
    return { label: "BELOW TARGET", color: yellow };
  }

  return { label: "BELOW TARGET", color: red };
}

/**
 * Format percentage with color.
 */
function formatPercentage(
  value: number,
  target: number,
  sampleCount: number
): string {
  const pct = (value * 100).toFixed(0);
  const targetPct = (target * 100).toFixed(0);

  if (sampleCount < MIN_SAMPLES) {
    return `${yellow(`${pct}%`)} ${dim(`(target: ${targetPct}%)`)}`;
  }

  if (value >= target) {
    return `${green(`${pct}%`)} ${dim(`(target: ${targetPct}%)`)}`;
  }

  const ratio = value / target;
  if (ratio >= 0.8) {
    return `${yellow(`${pct}%`)} ${dim(`(target: ${targetPct}%)`)}`;
  }

  return `${red(`${pct}%`)} ${dim(`(target: ${targetPct}%)`)}`;
}

/**
 * Create progress bar.
 */
function progressBar(value: number, target: number, width: number = 20): string {
  const filled = Math.min(Math.round(value * width), width);
  const targetPos = Math.round(target * width);

  let bar = "";
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      if (value >= target) {
        bar += green("█");
      } else if (i >= targetPos) {
        bar += yellow("░");
      } else {
        bar += cyan("█");
      }
    } else if (i === targetPos) {
      bar += "│";
    } else {
      bar += dim("░");
    }
  }

  return bar;
}

// ============================================================================
// Command Action
// ============================================================================

/**
 * Fix-stats command action.
 */
async function fixStatsAction(options: FixStatsOptions): Promise<void> {
  const logPath = getDefaultLogPath();
  const logger = createFixLogger({ logPath, autoSave: false });

  // Get entries based on options
  const entries = options.session
    ? logger.getSessionEntries()
    : logger.getEntries();

  const analysis = logger.getSuccessRateAnalysis();

  // Handle export
  if (options.export === "csv") {
    console.log(logger.exportCsv());
    return;
  }

  if (options.export === "json") {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }

  // Display header
  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Self-Correction Statistics"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  // Check if we have data
  if (entries.length === 0) {
    console.log(yellow("  No fix data available."));
    console.log(dim("  Run 'endiorbot fix' to generate statistics."));
    console.log("");
    return;
  }

  // Overall summary
  const stats = logger.getStats();
  console.log(`  ${bold("Overview:")}`);
  console.log(`    Total errors processed:  ${stats.totalErrors}`);
  console.log(`    Successful fixes:        ${green(String(stats.successfulFixes))}`);
  console.log(`    Failed fixes:            ${stats.failedFixes > 0 ? red(String(stats.failedFixes)) : "0"}`);
  console.log(`    Escalated:               ${stats.escalatedCount > 0 ? red(String(stats.escalatedCount)) : "0"}`);
  console.log(`    Overall success rate:    ${formatPercentage(analysis.overall, 0.75, entries.length)}`);
  console.log("");

  // Category breakdown
  console.log(`  ${bold("By Category:")}`);
  console.log("");

  const categories: ErrorCategory[] = ["BUILD", "LINT", "TYPE", "TEST"];

  for (const category of categories) {
    // Skip if filtering by category and this isn't it
    if (options.category && options.category !== category) {
      continue;
    }

    const categoryEntries = logger.getEntriesByCategory(category);
    const sampleCount = categoryEntries.length;
    const data = analysis.vsTargets[category];
    const { label, color } = getCategoryStatus(data.actual, data.target, sampleCount);

    // Category header
    const categoryLabel = category === "TEST"
      ? `${category} ${dim("(EXPERIMENTAL)")}`
      : category;

    console.log(`    ${bold(categoryLabel.padEnd(20))} ${color(`[${label}]`)}`);

    // Progress bar
    const bar = progressBar(data.actual, data.target);
    console.log(`      ${bar} ${formatPercentage(data.actual, data.target, sampleCount)}`);

    // Sample count
    console.log(`      ${dim(`Samples: ${sampleCount}`)}`);

    // Verbose: show recent fixes
    if (options.verbose && categoryEntries.length > 0) {
      const recent = categoryEntries.slice(-3);
      console.log(`      ${dim("Recent:")}`);
      for (const entry of recent) {
        const icon = entry.result.status === "success" ? green("✓") : red("✗");
        console.log(`        ${icon} ${entry.error.filePath}:${entry.error.line}`);
      }
    }

    console.log("");
  }

  // Target summary
  console.log(`  ${bold("Target Summary:")}`);

  const met = categories.filter((c) => {
    const data = analysis.vsTargets[c];
    const entries = logger.getEntriesByCategory(c);
    return entries.length >= MIN_SAMPLES && data.actual >= data.target;
  });

  const notMet = categories.filter((c) => {
    const data = analysis.vsTargets[c];
    const entries = logger.getEntriesByCategory(c);
    return entries.length >= MIN_SAMPLES && data.actual < data.target;
  });

  const insufficient = categories.filter((c) => {
    const entries = logger.getEntriesByCategory(c);
    return entries.length < MIN_SAMPLES;
  });

  if (met.length > 0) {
    console.log(`    ${green("✓ Above target:")} ${met.join(", ")}`);
  }
  if (notMet.length > 0) {
    console.log(`    ${red("✗ Below target:")} ${notMet.join(", ")}`);
  }
  if (insufficient.length > 0) {
    console.log(`    ${yellow("? Insufficient data:")} ${insufficient.join(", ")}`);
  }

  console.log("");

  // Session info
  if (options.session) {
    console.log(`  ${dim(`Session: ${stats.sessionId}`)}`);
    console.log("");
  }

  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register fix-stats command.
 */
export function registerFixStatsCommand(program: Command): void {
  program
    .command("fix-stats")
    .description("Display self-correction success rates and analysis")
    .option(
      "-c, --category <category>",
      "Show specific category (BUILD, LINT, TYPE, TEST)"
    )
    .option("-s, --session", "Show current session only")
    .option(
      "-e, --export <format>",
      "Export data (csv, json)"
    )
    .option("-v, --verbose", "Show detailed output with recent fixes")
    .action(fixStatsAction);
}
