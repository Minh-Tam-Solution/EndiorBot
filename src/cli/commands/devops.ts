/**
 * DevOps Command
 *
 * Build, run, and deploy projects after G3 gate confirmation.
 * Auto-detects package manager and build system.
 *
 * Usage:
 *   endiorbot devops build         # Install deps + build
 *   endiorbot devops run           # Run the project
 *   endiorbot devops build-run     # Build then run
 *
 * @module cli/commands/devops
 * @version 1.0.0
 * @date 2026-03-03
 * @status ACTIVE
 * @authority SOUL-devops (SE4A Executor, Stage 06-07, Gate G4)
 * @stage 06 - DEPLOY
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { Command } from "commander";
import { loadActiveProject, resolveActiveProjectDir } from "../../config/paths.js";
import { isGateConfirmed, type GateId } from "../../sdlc/index.js";
import {
  detectEcosystem,
  getEcosystemCommands,
  checkToolchain,
  detectPythonVenv,
  type EcosystemDetectResult,
} from "./ecosystem-detector.js";

// ============================================================================
// Execution (A8: shell safety — spawn with argv, no shell: true)
// ============================================================================

interface RunResult {
  code: number;
  stderr: string;
}

/**
 * Run a command in the project directory with live output.
 * Uses spawn with argv array — NO shell: true (security: A8).
 * Captures stderr for error diagnosis (BUG-001).
 */
function runCommand(cmd: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    console.log(`  $ ${cmd} ${args.join(" ")}`);
    console.log("");

    const stderrChunks: string[] = [];
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["inherit", "inherit", "pipe"],
    });

    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      process.stderr.write(text);
      stderrChunks.push(text);
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stderr: stderrChunks.join("") });
    });

    child.on("error", () => {
      resolve({ code: 1, stderr: "" });
    });
  });
}

/**
 * Diagnose Python errors and provide actionable guidance (BUG-001).
 */
function diagnosePythonError(stderr: string, projectPath: string): string | null {
  // ModuleNotFoundError: No module named 'xxx'
  const moduleMatch = stderr.match(/ModuleNotFoundError: No module named '([^']+)'/);
  if (moduleMatch) {
    const mod = moduleMatch[1]!;
    const hasInstallPy = existsSync(join(projectPath, "install.py"));
    const hasSetupPy = existsSync(join(projectPath, "setup.py"));

    const lines = [
      `❌ Missing Python module: ${mod}`,
      "",
    ];

    if (hasInstallPy) {
      lines.push(`   This project has an install.py script that installs additional dependencies.`);
      lines.push(`   → Run: python install.py`);
      lines.push(`   → Then retry: endiorbot ops run --skip-gate-check`);
    } else if (hasSetupPy) {
      lines.push(`   → Run: pip install -e .`);
      lines.push(`   → Then retry: endiorbot ops run --skip-gate-check`);
    } else {
      lines.push(`   → Run: pip install ${mod}`);
      lines.push(`   → Then retry: endiorbot ops run --skip-gate-check`);
    }

    return lines.join("\n");
  }

  return null;
}

// ============================================================================
// Command Actions
// ============================================================================

async function devopsBuildAction(options: { path?: string; skipGateCheck?: boolean; ecosystem?: string }): Promise<void> {
  const project = loadActiveProject();
  const projectPath = options.path ?? resolveActiveProjectDir();
  const projectId = project?.name ?? "unknown";

  if (!existsSync(projectPath)) {
    console.error(`❌ Project path not found: ${projectPath}`);
    process.exit(1);
  }

  // Gate check
  if (!options.skipGateCheck) {
    const g3Confirmed = isGateConfirmed(projectId, "G3" as GateId);
    if (!g3Confirmed) {
      console.log("");
      console.log("⚠️  G3 (Build Complete) gate not confirmed.");
      console.log("   Run 'endiorbot gate confirm G3 --confirm' first.");
      console.log("   Or use --skip-gate-check to bypass.");
      console.log("");
      process.exit(1);
    }
  }

  // Ecosystem detection (CTO C1: SSOT)
  const eco = detectEcosystem(projectPath, options.ecosystem as EcosystemDetectResult["ecosystem"] | undefined);

  if (eco.support === "detect-only") {
    console.error(`❌ ${eco.language} detected but not yet supported for build/run.`);
    console.error(`   → ${eco.language} support coming soon. Use native tools: ${eco.packageManager}`);
    process.exit(1);
  }

  // Toolchain pre-check (CTO C3)
  const toolchain = await checkToolchain(eco.ecosystem);
  if (!toolchain.available) {
    console.error(`❌ ${toolchain.command} not found.`);
    console.error(`   → Install from ${toolchain.installUrl}`);
    process.exit(1);
  }

  // Python venv warning (CTO C4)
  if (eco.ecosystem === "python") {
    const venv = detectPythonVenv(projectPath);
    if (!venv.hasVenv) {
      console.log("⚠️  No virtual environment found. Consider: python3 -m venv .venv");
      console.log("");
    }
  }

  const cmds = getEcosystemCommands(eco, projectPath);
  if (!cmds) {
    console.error("❌ Could not determine build commands.");
    process.exit(1);
  }

  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│  🔧 DevOps Build                                            │`);
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Project: ${projectPath.slice(-49).padEnd(49)}│`);
  console.log(`│  Ecosystem: ${`${eco.language} (${eco.packageManager})`.padEnd(47)}│`);
  console.log(`│  Toolchain: ${(toolchain.version ?? toolchain.command).slice(0, 47).padEnd(47)}│`);
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");

  // Step 1: Install dependencies
  if (cmds.install) {
    console.log("📦 Installing dependencies...");
    const installResult = await runCommand(cmds.install[0]!, cmds.install.slice(1), projectPath);
    if (installResult.code !== 0) {
      console.error("❌ Dependency installation failed.");
      console.error("   → Check the output above for missing packages or permissions.");
      process.exit(1);
    }
    console.log("✅ Dependencies installed.");
    console.log("");
  }

  // Step 1b: Python custom install scripts (BUG-001)
  if (eco.ecosystem === "python") {
    const installPy = join(projectPath, "install.py");
    const setupPy = join(projectPath, "setup.py");
    const venv = detectPythonVenv(projectPath);
    const pythonBin = venv.pythonBin ?? "python3";

    if (existsSync(installPy)) {
      console.log("📦 Running install.py (project-specific setup)...");
      const result = await runCommand(pythonBin, ["install.py"], projectPath);
      if (result.code !== 0) {
        console.log("⚠️  install.py exited with errors (some may be non-fatal).");
        console.log("   → Review the output above. GPU/CUDA errors are expected on machines without NVIDIA GPU.");
        console.log("");
      } else {
        console.log("✅ install.py complete.");
        console.log("");
      }
    } else if (existsSync(setupPy) && cmds.install) {
      // Only run setup.py if we also had requirements.txt (avoid double-install)
      console.log("📦 Running pip install -e . (editable mode)...");
      const pipBin = venv.pipBin ?? "pip3";
      const result = await runCommand(pipBin, ["install", "-e", "."], projectPath);
      if (result.code !== 0) {
        console.log("⚠️  setup.py install failed. See output above.");
        console.log("");
      }
    }
  }

  // Step 2: Build
  if (cmds.build) {
    console.log("🔨 Building project...");
    const buildResult = await runCommand(cmds.build[0]!, cmds.build.slice(1), projectPath);
    if (buildResult.code !== 0) {
      console.error("❌ Build failed.");
      console.error("   → Check build output above. Common: missing dependencies or wrong toolchain version.");
      process.exit(1);
    }
    console.log("");
    console.log("✅ Build complete.");
  } else {
    console.log("ℹ️  No build step for this ecosystem. Skipping.");
  }
  console.log("");
}

async function devopsRunAction(options: { path?: string; skipGateCheck?: boolean; dev?: boolean; ecosystem?: string }): Promise<void> {
  const project = loadActiveProject();
  const projectPath = options.path ?? resolveActiveProjectDir();
  const projectId = project?.name ?? "unknown";

  if (!existsSync(projectPath)) {
    console.error(`❌ Project path not found: ${projectPath}`);
    process.exit(1);
  }

  // Gate check
  if (!options.skipGateCheck) {
    const g3Confirmed = isGateConfirmed(projectId, "G3" as GateId);
    if (!g3Confirmed) {
      console.log("");
      console.log("⚠️  G3 (Build Complete) gate not confirmed.");
      console.log("   Run 'endiorbot gate confirm G3 --confirm' first.");
      console.log("   Or use --skip-gate-check to bypass.");
      console.log("");
      process.exit(1);
    }
  }

  // Ecosystem detection (CTO C1: SSOT)
  const eco = detectEcosystem(projectPath, options.ecosystem as EcosystemDetectResult["ecosystem"] | undefined);

  if (eco.support === "detect-only") {
    console.error(`❌ ${eco.language} detected but not yet supported for run.`);
    console.error(`   → Use native tools: ${eco.packageManager}`);
    process.exit(1);
  }

  const cmds = getEcosystemCommands(eco, projectPath);
  if (!cmds) {
    console.error("❌ Could not determine run commands.");
    process.exit(1);
  }

  const runArgs = options.dev ? cmds.dev : cmds.run;
  const cmdDisplay = runArgs.join(" ");

  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│  🚀 DevOps Run                                              │`);
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Project: ${projectPath.slice(-49).padEnd(49)}│`);
  console.log(`│  Command: ${cmdDisplay.slice(0, 49).padEnd(49)}│`);
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");

  // Install if needed
  if (cmds.install) {
    console.log("📦 Installing dependencies first...");
    const installResult = await runCommand(cmds.install[0]!, cmds.install.slice(1), projectPath);
    if (installResult.code !== 0) {
      console.error("❌ Dependency installation failed.");
      process.exit(1);
    }
    console.log("");
  }

  // Run
  console.log(`🚀 Running: ${cmdDisplay}`);
  console.log("");
  const result = await runCommand(runArgs[0]!, runArgs.slice(1), projectPath);

  // BUG-001: Diagnose Python errors with actionable guidance
  if (result.code !== 0 && eco.ecosystem === "python") {
    const diagnosis = diagnosePythonError(result.stderr, projectPath);
    if (diagnosis) {
      console.log("");
      console.log(diagnosis);
      console.log("");
      process.exit(result.code);
    }
  }

  process.exit(result.code);
}

async function devopsBuildRunAction(options: { path?: string; skipGateCheck?: boolean; dev?: boolean }): Promise<void> {
  await devopsBuildAction(options);
  await devopsRunAction(options);
}

// ============================================================================
// Graph Commands — CRG tools for target repos (ADR-045)
// ============================================================================

async function graphStatusAction(options: { repo: string }): Promise<void> {
  const { getCRGClient } = await import("../../graph/client.js");
  const client = getCRGClient();

  if (!client.isAvailable()) {
    console.error("❌ CRG not configured. Set AI_PLATFORM_API_KEY or MTCLAW_API_KEY in .env");
    process.exit(1);
  }

  try {
    const status = await client.graphStatus(options.repo);
    console.log("");
    console.log(`📊 Graph Status: ${options.repo}`);
    console.log(`   Status: ${status.status ?? "unknown"}`);
    if (status.node_count) console.log(`   Nodes: ${status.node_count.toLocaleString()}`);
    if (status.edge_count) console.log(`   Edges: ${status.edge_count.toLocaleString()}`);
    if (status.last_build_at) console.log(`   Last build: ${status.last_build_at}`);
    console.log("");
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function graphImpactAction(files: string[], options: { repo: string }): Promise<void> {
  const { getCRGClient } = await import("../../graph/client.js");
  const client = getCRGClient();

  if (!client.isAvailable()) {
    console.error("❌ CRG not configured. Set AI_PLATFORM_API_KEY or MTCLAW_API_KEY in .env");
    process.exit(1);
  }

  try {
    const impact = await client.impactRadius(options.repo, files);
    console.log("");
    console.log(`💥 Blast Radius: ${impact.blast_radius} affected files`);
    console.log("");
    console.log("Changed:");
    for (const f of impact.changed_files) console.log(`  📝 ${f}`);
    console.log("");
    console.log("Affected:");
    for (const f of impact.affected_files) console.log(`  📎 ${f}`);
    console.log("");
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function graphFindAction(query: string, options: { repo: string }): Promise<void> {
  const { getCRGClient } = await import("../../graph/client.js");
  const client = getCRGClient();

  if (!client.isAvailable()) {
    console.error("❌ CRG not configured. Set AI_PLATFORM_API_KEY or MTCLAW_API_KEY in .env");
    process.exit(1);
  }

  try {
    const result = await client.findSymbol(options.repo, query);
    console.log("");
    if (!result.results || result.results.length === 0) {
      console.log(`🔍 No matches for "${query}" in ${options.repo}`);
    } else {
      console.log(`🔍 Found ${result.results.length} match(es) for "${query}":`);
      for (const m of result.results.slice(0, 20)) {
        const loc = m.line_start ? `:${m.line_start}` : "";
        console.log(`  ${m.kind.padEnd(10)} ${m.name} → ${m.file_path}${loc}`);
      }
      if (result.results.length > 20) {
        console.log(`  ... and ${result.results.length - 20} more`);
      }
    }
    console.log("");
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function graphOverviewAction(options: { repo: string }): Promise<void> {
  const { getCRGClient } = await import("../../graph/client.js");
  const client = getCRGClient();

  if (!client.isAvailable()) {
    console.error("❌ CRG not configured. Set AI_PLATFORM_API_KEY or MTCLAW_API_KEY in .env");
    process.exit(1);
  }

  try {
    const arch = await client.architectureOverview(options.repo);
    console.log("");
    console.log(`🏗️  Architecture: ${options.repo}`);
    console.log(`   Nodes: ${arch.total_nodes.toLocaleString()} | Edges: ${arch.total_edges.toLocaleString()}`);
    console.log("");
    console.log("   Node types:");
    for (const [kind, count] of Object.entries(arch.node_types)) {
      console.log(`     ${kind.padEnd(12)} ${count.toLocaleString()}`);
    }
    if (arch.top_directories.length > 0) {
      console.log("");
      console.log("   Top directories:");
      for (const dir of arch.top_directories.slice(0, 10)) {
        console.log(`     📁 ${dir}`);
      }
    }
    console.log("");
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// ============================================================================
// Command Registration
// ============================================================================

export function registerDevopsCommand(program: Command): void {
  const devops = program
    .command("ops")
    .description("DevOps operations: build, run, deploy (Stage 06-07)");

  devops
    .command("build")
    .description("Install dependencies and build project")
    .option("--path <path>", "Project directory")
    .option("--skip-gate-check", "Skip G3 gate verification")
    .option("--ecosystem <name>", "Override ecosystem detection (node, rust, python)")
    .action(devopsBuildAction);

  devops
    .command("run")
    .description("Run the project (start or dev script)")
    .option("--path <path>", "Project directory")
    .option("--skip-gate-check", "Skip G3 gate verification")
    .option("--dev", "Use dev script instead of start")
    .option("--ecosystem <name>", "Override ecosystem detection (node, rust, python)")
    .action(devopsRunAction);

  devops
    .command("build-run")
    .description("Build then run the project")
    .option("--path <path>", "Project directory")
    .option("--skip-gate-check", "Skip G3 gate verification")
    .option("--dev", "Use dev script instead of start")
    .option("--ecosystem <name>", "Override ecosystem detection (node, rust, python)")
    .action(devopsBuildRunAction);

  // Graph subcommands (CRG tools for target repos — ADR-045)
  const graph = devops
    .command("graph")
    .description("Code knowledge graph tools (CRG) for target repos");

  graph
    .command("status")
    .description("Show graph build status for a repo")
    .requiredOption("--repo <id>", "Repo ID (e.g., bflow-platform, mtclaw, endiorbot)")
    .action(graphStatusAction);

  graph
    .command("impact <files...>")
    .description("Show blast radius for changed files")
    .requiredOption("--repo <id>", "Repo ID")
    .action(graphImpactAction);

  graph
    .command("find <query>")
    .description("Find a symbol (class, function, type) by name")
    .requiredOption("--repo <id>", "Repo ID")
    .action(graphFindAction);

  graph
    .command("overview")
    .description("Show architecture overview (node types, top directories)")
    .requiredOption("--repo <id>", "Repo ID")
    .action(graphOverviewAction);
}
