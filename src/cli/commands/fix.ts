/**
 * Fix Command
 *
 * Self-correction CLI for fixing build/lint/type/test errors.
 *
 * Usage:
 *   endiorbot fix < tsc-output.txt              - Fix errors from stdin
 *   endiorbot fix --run tsc                     - Run command and fix errors
 *   endiorbot fix --dry-run                     - Preview fixes (mandatory first step)
 *   endiorbot fix --category TYPE               - Fix specific category only
 *   endiorbot fix --allow-experimental          - Allow EXPERIMENTAL (AI) fixes
 *
 * Per CTO Day 5-7 guidance:
 * - Support stdin and --run modes
 * - --dry-run is mandatory for preview
 * - EXPERIMENTAL fixes require --allow-experimental flag
 * - Different output format for EXPERIMENTAL vs deterministic fixes
 *
 * @module cli/commands/fix
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 37 Day 5-7
 * @authority ADR-007 Budget Control, Phase 3
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { execSync } from "node:child_process";
import type { Command } from "commander";
import {
  createSelfCorrectionEngine,
  createAIAssistedFixer,
  type ErrorCategory,
  type CorrectionResult,
  type FixAttempt,
  AUTO_FIX_TARGETS,
} from "../../self-correction/index.js";
import { createBudgetTracker } from "../../budget/budget-tracker.js";

// ============================================================================
// Types
// ============================================================================

interface FixOptions {
  run?: string;
  dryRun?: boolean;
  category?: ErrorCategory;
  allowExperimental?: boolean;
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
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
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

function magenta(text: string): string {
  return `${colors.magenta}${text}${colors.reset}`;
}

function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

// ============================================================================
// Icons
// ============================================================================

const icons = {
  success: green("✓"),
  failed: red("✗"),
  experimental: magenta("⚗"),
  warning: yellow("⚠"),
  info: cyan("ℹ"),
  pending: yellow("○"),
  escalated: red("↑"),
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Read input from stdin.
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";

    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", reject);

    // Set timeout for non-piped stdin
    setTimeout(() => {
      resolve(data);
    }, 100);
  });
}

/**
 * Run a command and capture output.
 */
function runCommand(command: string, cwd: string): string {
  try {
    const result = execSync(command, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000, // 2 minutes
    });
    return result || "";
  } catch (error) {
    if (error && typeof error === "object" && "stdout" in error) {
      const execError = error as { stdout?: string; stderr?: string };
      return (execError.stdout || "") + (execError.stderr || "");
    }
    return String(error);
  }
}

/**
 * Get confidence icon and label.
 */
function formatConfidence(confidence: string): string {
  if (confidence === "experimental") {
    return `${icons.experimental} ${magenta("[EXPERIMENTAL]")}`;
  }
  if (confidence === "high") {
    return `${icons.success} ${green("[HIGH]")}`;
  }
  if (confidence === "medium") {
    return `${icons.info} ${cyan("[MEDIUM]")}`;
  }
  return `${icons.warning} ${yellow("[LOW]")}`;
}

/**
 * Format fix attempt for display.
 */
function formatAttempt(attempt: FixAttempt, verbose: boolean): string {
  const fix = attempt.fixResult.fix;
  const status = attempt.fixResult.status;
  const confidence = fix.confidence;

  let statusIcon: string;
  if (status === "success") {
    statusIcon = icons.success;
  } else if (status === "failed") {
    statusIcon = icons.failed;
  } else if (status === "skipped") {
    statusIcon = icons.pending;
  } else {
    statusIcon = icons.escalated;
  }

  const lines: string[] = [];

  // Main line
  const confLabel = formatConfidence(confidence);
  lines.push(
    `  ${statusIcon} ${fix.filePath}:${fix.line} ${confLabel}`
  );

  // Description
  lines.push(`    ${dim(fix.description)}`);

  // Verbose output
  if (verbose) {
    lines.push(`    ${dim("Type:")} ${fix.type}`);
    if (fix.originalCode && fix.fixedCode) {
      lines.push(`    ${dim("Original:")} ${fix.originalCode.slice(0, 50)}...`);
      lines.push(`    ${dim("Fixed:")} ${fix.fixedCode.slice(0, 50)}...`);
    }
  }

  return lines.join("\n");
}

/**
 * Display correction result.
 */
function displayResult(
  result: CorrectionResult,
  options: FixOptions,
  hasExperimentalFixes: boolean
): void {
  console.log("");
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log(bold("  Self-Correction Report"));
  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  // Summary
  const successRate = (result.successRate * 100).toFixed(0);
  const targetRate = (result.targetRate * 100).toFixed(0);
  const metTarget = result.metTarget;

  console.log(`  ${bold("Summary:")}`);
  console.log(`    Total errors:     ${result.totalErrors}`);
  console.log(`    Fixed:            ${green(String(result.fixedErrors))}`);
  console.log(`    Remaining:        ${result.remainingErrors > 0 ? red(String(result.remainingErrors)) : "0"}`);
  console.log(`    Escalated:        ${result.escalated ? red("Yes") : "No"}`);
  console.log("");
  console.log(
    `    Success rate:     ${metTarget ? green(`${successRate}%`) : yellow(`${successRate}%`)} ` +
      `(target: ${targetRate}%)`
  );
  console.log(`    Duration:         ${result.duration}ms`);
  console.log("");

  // By category
  console.log(`  ${bold("By Category:")}`);
  for (const [category, stats] of Object.entries(result.byCategory)) {
    if (stats.total === 0) continue;

    const target = AUTO_FIX_TARGETS[category as ErrorCategory] * 100;
    const actual = stats.total > 0 ? (stats.fixed / stats.total) * 100 : 0;
    const met = actual >= target;

    console.log(
      `    ${category.padEnd(6)} ${stats.fixed}/${stats.total} ` +
        `(${met ? green(`${actual.toFixed(0)}%`) : yellow(`${actual.toFixed(0)}%`)} / target: ${target}%)`
    );
  }
  console.log("");

  // Fix attempts
  if (result.attempts.length > 0) {
    console.log(`  ${bold("Fix Attempts:")}`);
    for (const attempt of result.attempts) {
      console.log(formatAttempt(attempt, options.verbose ?? false));
    }
    console.log("");
  }

  // Dry run warning
  if (options.dryRun) {
    console.log(yellow("  ⚠ DRY RUN - No files were modified"));
    console.log(dim("    Run without --dry-run to apply fixes"));
    console.log("");
  }

  // Experimental warning
  if (hasExperimentalFixes && !options.allowExperimental) {
    console.log(magenta("  ⚗ EXPERIMENTAL fixes were skipped"));
    console.log(dim("    Use --allow-experimental to apply AI-assisted fixes"));
    console.log("");
  }

  console.log(bold("═══════════════════════════════════════════════════════════════"));
  console.log("");
}

/**
 * Check for experimental fixes in result.
 */
function hasExperimentalFixes(result: CorrectionResult): boolean {
  return result.attempts.some(
    (attempt) => attempt.fixResult.fix.confidence === "experimental"
  );
}

// ============================================================================
// Command Action
// ============================================================================

/**
 * Fix command action.
 */
async function fixAction(options: FixOptions): Promise<void> {
  const cwd = process.cwd();

  // Step 1: Get error output
  let errorOutput = "";

  if (options.run) {
    // Run command and capture output
    console.log(dim(`Running: ${options.run}`));
    errorOutput = runCommand(options.run, cwd);

    if (!errorOutput.trim()) {
      console.log(green("\n  ✓ No errors detected\n"));
      return;
    }
  } else {
    // Read from stdin
    errorOutput = await readStdin();

    if (!errorOutput.trim()) {
      console.log("");
      console.log(yellow("  No input provided"));
      console.log("");
      console.log("  Usage:");
      console.log("    endiorbot fix < tsc-output.txt");
      console.log("    endiorbot fix --run 'pnpm build'");
      console.log("    endiorbot fix --run 'pnpm lint'");
      console.log("");
      console.log("  Options:");
      console.log("    --dry-run            Preview fixes without applying");
      console.log("    --category TYPE      Fix specific category (BUILD/LINT/TYPE/TEST)");
      console.log("    --allow-experimental Allow AI-assisted fixes");
      console.log("    --verbose            Show detailed output");
      console.log("");
      return;
    }
  }

  // Step 2: Create engine
  const engine = createSelfCorrectionEngine({
    workingDirectory: cwd,
    dryRun: options.dryRun ?? false,
  });

  // Step 3: Set up AI fixer if allowed
  if (options.allowExperimental) {
    const aiFixer = createAIAssistedFixer({
      workingDirectory: cwd,
      dryRun: options.dryRun ?? false,
    });

    // Set up budget tracker for AI fixer
    const budgetTracker = createBudgetTracker();
    engine.setBudgetTracker(budgetTracker);
    engine.setAIAssistedFixer(aiFixer);
  }

  // Step 4: Run correction
  console.log(dim("\nAnalyzing errors..."));

  const result = await engine.correct(errorOutput, options.category);

  // Step 5: Check for experimental fixes that were skipped
  const hasExpFixes = hasExperimentalFixes(result);

  // Step 6: Display result
  displayResult(result, options, hasExpFixes);

  // Step 7: Exit with appropriate code
  if (result.success) {
    process.exit(0);
  } else if (result.remainingErrors > 0) {
    process.exit(1);
  }
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register fix command.
 */
export function registerFixCommand(program: Command): void {
  program
    .command("fix")
    .description("Auto-fix build, lint, type, and test errors")
    .option("-r, --run <command>", "Run command and fix its errors")
    .option("-d, --dry-run", "Preview fixes without applying (recommended first)")
    .option(
      "-c, --category <category>",
      "Fix specific category (BUILD, LINT, TYPE, TEST)"
    )
    .option(
      "-e, --allow-experimental",
      "Allow AI-assisted EXPERIMENTAL fixes"
    )
    .option("-v, --verbose", "Show detailed output")
    .action(fixAction);
}
