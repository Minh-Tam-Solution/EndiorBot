/**
 * Fixes Command
 *
 * Learning engine CLI - view fix logs, patterns, and analytics.
 *
 * Usage:
 *   endiorbot fixes --week               - Weekly summary
 *   endiorbot fixes --patterns           - Recurring patterns
 *   endiorbot fixes --export csv|json    - Export fix log
 *   endiorbot fixes patterns list        - List patterns
 *   endiorbot fixes patterns add         - Add pattern (interactive)
 *
 * @module cli/commands/fixes
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 41 Fix Logging
 * @authority ADR-011 Fix Logging Architecture
 * @pillar 4 - Quality Assurance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { Command } from "commander";
import {
  getFixLogger,
  getPatternManager,
  type ErrorCategory,
} from "../../agents/fix-logging/index.js";

// ============================================================================
// Types
// ============================================================================

interface FixesOptions {
  week?: boolean;
  patterns?: boolean;
  export?: "csv" | "json";
  days?: string;
  category?: ErrorCategory;
}

interface PatternsListOptions {
  category?: ErrorCategory;
  status?: "active" | "deprecated" | "experimental" | "disabled";
  sortBy?: "successRate" | "appliedCount" | "createdAt";
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

function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format success rate with color.
 */
function formatSuccessRate(rate: number): string {
  const pct = (rate * 100).toFixed(0);
  if (rate >= 0.8) {
    return green(`${pct}%`);
  } else if (rate >= 0.5) {
    return yellow(`${pct}%`);
  }
  return red(`${pct}%`);
}

/**
 * Create progress bar.
 */
function progressBar(value: number, width = 20): string {
  const filled = Math.min(Math.round(value * width), width);
  let bar = "";

  for (let i = 0; i < width; i++) {
    if (i < filled) {
      if (value >= 0.8) {
        bar += green("█");
      } else if (value >= 0.5) {
        bar += yellow("█");
      } else {
        bar += red("█");
      }
    } else {
      bar += dim("░");
    }
  }

  return bar;
}

// ============================================================================
// Command Actions
// ============================================================================

/**
 * Main fixes command action.
 */
async function fixesAction(options: FixesOptions): Promise<void> {
  const logger = await getFixLogger();

  // Handle export
  if (options.export === "csv") {
    console.log(await logger.exportCsv());
    return;
  }

  if (options.export === "json") {
    console.log(await logger.exportJson());
    return;
  }

  // Handle patterns view
  if (options.patterns) {
    await showRecurringPatterns(options.category);
    return;
  }

  // Default: weekly summary
  await showWeeklySummary(options.week ? 0 : undefined);
}

/**
 * Show weekly summary.
 */
async function showWeeklySummary(weeksAgo = 0): Promise<void> {
  const logger = await getFixLogger();
  const summary = await logger.getWeeklySummary(weeksAgo);

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Fix Logging - Weekly Summary"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  // Date range
  const start = new Date(summary.weekStart).toLocaleDateString();
  const end = new Date(summary.weekEnd).toLocaleDateString();
  console.log(`  ${dim(`Period: ${start} - ${end}`)}`);
  console.log("");

  // Overview
  console.log(`  ${bold("Overview:")}`);
  console.log(`    Total attempts:    ${summary.totalAttempts}`);
  console.log(`    Successful:        ${green(String(summary.successfulFixes))}`);
  console.log(`    Failed:            ${summary.failedFixes > 0 ? red(String(summary.failedFixes)) : dim("0")}`);
  console.log(`    Escalated:         ${summary.escalatedFixes > 0 ? red(String(summary.escalatedFixes)) : dim("0")}`);
  console.log(`    Success rate:      ${formatSuccessRate(summary.successRate)}`);
  console.log("");

  // By category
  if (summary.totalAttempts > 0) {
    console.log(`  ${bold("By Category:")}`);
    console.log("");

    const categories: ErrorCategory[] = ["BUILD", "LINT", "TYPE", "TEST"];
    for (const category of categories) {
      const data = summary.byCategory[category];
      if (data.total === 0) continue;

      const bar = progressBar(data.successRate);
      const targetStatus = data.metTarget ? green("✓ Met") : yellow("⚠ Below");

      console.log(`    ${bold(category.padEnd(8))} ${bar} ${formatSuccessRate(data.successRate)}`);
      console.log(`             ${dim(`${data.fixed}/${data.total} fixed, target: ${(data.targetRate * 100).toFixed(0)}% ${targetStatus}`)}`);
    }
    console.log("");
  }

  // Top patterns
  if (summary.topPatterns.length > 0) {
    console.log(`  ${bold("Top Performing Patterns:")}`);
    for (const pattern of summary.topPatterns.slice(0, 3)) {
      console.log(`    ${green("●")} ${pattern.patternId} ${dim(`(${pattern.count}x, ${formatSuccessRate(pattern.successRate)})`)}`);
    }
    console.log("");
  }

  // Problematic patterns
  if (summary.problematicPatterns.length > 0) {
    console.log(`  ${bold("Patterns Needing Review:")}`);
    for (const pattern of summary.problematicPatterns.slice(0, 3)) {
      console.log(`    ${red("●")} ${pattern.patternId} ${dim(`(${pattern.count}x, ${formatSuccessRate(pattern.successRate)})`)}`);
      if (pattern.recommendation) {
        console.log(`      ${dim(`→ ${pattern.recommendation}`)}`);
      }
    }
    console.log("");
  }

  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * Show recurring patterns.
 */
async function showRecurringPatterns(category?: ErrorCategory): Promise<void> {
  const logger = await getFixLogger();
  const patterns = await logger.getRecurringPatterns(3);

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Fix Logging - Recurring Patterns"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  const filtered = category
    ? patterns.filter((p) => p.category === category)
    : patterns;

  if (filtered.length === 0) {
    console.log(yellow("  No recurring patterns found (min 3 occurrences)."));
    console.log(dim("  Run more fixes to accumulate pattern data."));
    console.log("");
    return;
  }

  for (const pattern of filtered) {
    const icon = pattern.successRate >= 0.7 ? green("●") : pattern.successRate >= 0.5 ? yellow("●") : red("●");

    console.log(`  ${icon} ${bold(`${pattern.category}:${pattern.errorCode}`)}`);
    console.log(`    ${dim("Occurrences:")} ${pattern.count}`);
    console.log(`    ${dim("Success rate:")} ${formatSuccessRate(pattern.successRate)}`);

    if (pattern.patterns.length > 0) {
      console.log(`    ${dim("Fix strategies:")}`);
      for (const fix of pattern.patterns.slice(0, 2)) {
        console.log(`      - ${fix.patternId.split(":")[2]} (${formatSuccessRate(fix.successRate)})`);
      }
    }
    console.log("");
  }

  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * List patterns action.
 */
async function patternsListAction(options: PatternsListOptions): Promise<void> {
  const manager = await getPatternManager();

  const patterns = await manager.query({
    ...(options.category !== undefined && { category: options.category }),
    ...(options.status !== undefined && { status: options.status }),
    sortBy: options.sortBy ?? "successRate",
    sortOrder: "desc",
  });

  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Pattern Library"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  if (patterns.length === 0) {
    console.log(yellow("  No patterns found."));
    console.log("");
    return;
  }

  console.log(
    `  ${"ID".padEnd(30)} ${"Success".padEnd(10)} ${"Count".padEnd(8)} ${"Status".padEnd(12)}`
  );
  console.log(dim("  " + "─".repeat(60)));

  for (const pattern of patterns) {
    const statusColor =
      pattern.status === "active"
        ? green
        : pattern.status === "deprecated"
        ? red
        : pattern.status === "experimental"
        ? yellow
        : dim;

    console.log(
      `  ${pattern.id.padEnd(30)} ${formatSuccessRate(pattern.metadata.successRate).padEnd(10)} ${String(pattern.metadata.appliedCount).padEnd(8)} ${statusColor(pattern.status.padEnd(12))}`
    );
  }

  console.log("");
  console.log(`  ${dim(`Total: ${patterns.length} patterns`)}`);
  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * Export patterns action.
 */
async function patternsExportAction(): Promise<void> {
  const manager = await getPatternManager();
  console.log(await manager.exportJson());
}

/**
 * Import patterns action.
 */
async function patternsImportAction(file: string, options: { merge?: boolean }): Promise<void> {
  const fs = await import("fs/promises");
  const manager = await getPatternManager();

  try {
    const content = await fs.readFile(file, "utf-8");
    const count = await manager.importJson(content, options.merge ?? true);

    console.log(green(`✓ Imported ${count} patterns from ${file}`));
    if (options.merge) {
      console.log(dim("  (merged with existing patterns)"));
    }
  } catch (error) {
    console.error(red(`✗ Failed to import: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Reset patterns action.
 */
async function patternsResetAction(): Promise<void> {
  const manager = await getPatternManager();
  await manager.resetToDefaults();
  console.log(green("✓ Patterns reset to defaults"));
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register fixes command.
 */
export function registerFixesCommand(program: Command): void {
  const fixes = program
    .command("fixes")
    .description("View fix logs, patterns, and analytics")
    .option("-w, --week", "Show weekly summary")
    .option("-p, --patterns", "Show recurring patterns")
    .option("-e, --export <format>", "Export fix log (csv, json)")
    .option("-d, --days <days>", "Days to include (default: 7)")
    .option("-c, --category <category>", "Filter by category (BUILD, LINT, TYPE, TEST)")
    .action(fixesAction);

  // Patterns subcommand
  const patterns = fixes
    .command("patterns")
    .description("Manage fix patterns");

  patterns
    .command("list")
    .description("List all patterns")
    .option("-c, --category <category>", "Filter by category")
    .option("-s, --status <status>", "Filter by status (active, deprecated, experimental, disabled)")
    .option("--sort-by <field>", "Sort by field (successRate, appliedCount, createdAt)")
    .action(patternsListAction);

  patterns
    .command("export")
    .description("Export patterns to JSON")
    .action(patternsExportAction);

  patterns
    .command("import <file>")
    .description("Import patterns from JSON file")
    .option("-m, --merge", "Merge with existing patterns (default: true)")
    .action(patternsImportAction);

  patterns
    .command("reset")
    .description("Reset patterns to defaults")
    .action(patternsResetAction);
}
