/**
 * Bootstrap Command — Clone → Detect → Init → Build → Run
 *
 * One command to try any OSS repo with SDLC compliance.
 *
 * @module cli/commands/bootstrap
 * @version 1.0.0
 * @date 2026-03-29
 * @status ACTIVE — Sprint 123
 * @authority ADR-037 Polyglot Bootstrap
 * @sdlc SDLC Framework 6.4.0
 */

import type { Command } from "commander";
import { executeBootstrap, type BootstrapPhase } from "../../commands/handlers/bootstrap-handler.js";

// ============================================================================
// CLI Action
// ============================================================================

async function bootstrapAction(
  url: string,
  options: {
    dir?: string;
    tier?: string;
    build?: boolean;
    run?: boolean;
    branch?: string;
    depth?: string;
    skipInit?: boolean;
    force?: boolean;
    ecosystem?: string;
  },
): Promise<void> {
  // A9: Git trust warning
  console.log("");
  console.log("⚠️  Note: Cloning runs git hooks from the repo. Only clone repos you trust.");
  console.log("");

  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│  🚀 EndiorBot Bootstrap                                     │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");

  const bootstrapOpts: Parameters<typeof executeBootstrap>[0] = {
    url,
    onPhaseUpdate: displayPhase,
  };
  if (options.dir) bootstrapOpts.dir = options.dir;
  if (options.tier) bootstrapOpts.tier = options.tier;
  if (options.build) bootstrapOpts.build = options.build;
  if (options.run) bootstrapOpts.run = options.run;
  if (options.branch) bootstrapOpts.branch = options.branch;
  if (options.depth) bootstrapOpts.depth = parseInt(options.depth, 10);
  if (options.skipInit) bootstrapOpts.skipInit = options.skipInit;
  if (options.force) bootstrapOpts.force = options.force;
  if (options.ecosystem) bootstrapOpts.ecosystem = options.ecosystem as "node" | "rust" | "python";

  const result = await executeBootstrap(bootstrapOpts);

  // Final summary
  console.log("");
  if (result.success) {
    console.log("┌─────────────────────────────────────────────────────────────┐");
    console.log("│  ✅ Bootstrap Complete                                       │");
    console.log("├─────────────────────────────────────────────────────────────┤");
    if (result.ecosystem) {
      console.log(`│  Ecosystem: ${`${result.ecosystem.language} (${result.ecosystem.packageManager})`.padEnd(47)}│`);
    }
    if (result.projectPath) {
      console.log(`│  Path: ${result.projectPath.slice(-53).padEnd(53)}│`);
    }
    console.log(`│  Duration: ${`${(result.totalDurationMs / 1000).toFixed(1)}s`.padEnd(48)}│`);
    console.log("└─────────────────────────────────────────────────────────────┘");

    // A6: Post-bootstrap guidance
    if (result.nextSteps.length > 0) {
      console.log("");
      console.log("📋 Next Steps:");
      for (const step of result.nextSteps) {
        console.log(`   ${step}`);
      }
    }
    console.log("");
  } else {
    // A5: Failure UX — one-line summary + guidance
    console.log("┌─────────────────────────────────────────────────────────────┐");
    console.log("│  ❌ Bootstrap Failed                                         │");
    console.log("└─────────────────────────────────────────────────────────────┘");
    if (result.error) {
      console.log("");
      console.log(`   ${result.error.summary}`);
      console.log(`   → ${result.error.guidance}`);
    }
    console.log("");
    process.exit(1);
  }
}

function displayPhase(phase: BootstrapPhase): void {
  const icon = phase.status === "success" ? "✅" :
               phase.status === "failed" ? "❌" :
               phase.status === "skipped" ? "⏭️" : "⏳";
  const duration = phase.durationMs ? ` (${(phase.durationMs / 1000).toFixed(1)}s)` : "";
  console.log(`  ${icon} ${phase.name.padEnd(10)} ${phase.message}${duration}`);
}

// ============================================================================
// Command Registration
// ============================================================================

export function registerBootstrapCommand(program: Command): void {
  program
    .command("bootstrap")
    .description("Clone an OSS repo → detect ecosystem → init SDLC → build → run")
    .argument("<url>", "Git repo URL (HTTPS or SSH)")
    .option("--dir <path>", "Clone destination directory")
    .option("--tier <tier>", "SDLC tier (LITE, STANDARD, PROFESSIONAL, ENTERPRISE)", "STANDARD")
    .option("--build", "Run build after init")
    .option("--run", "Run after build")
    .option("--branch <branch>", "Clone specific branch")
    .option("--depth <n>", "Shallow clone depth")
    .option("--skip-init", "Skip SDLC initialization")
    .option("--force", "Overwrite existing directory")
    .option("--ecosystem <name>", "Override ecosystem detection (node, rust, python)")
    .action(bootstrapAction);
}
