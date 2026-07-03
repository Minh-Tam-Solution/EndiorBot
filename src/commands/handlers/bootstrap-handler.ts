/**
 * Bootstrap Handler — Shared logic for clone → detect → init → build → run
 *
 * Returns structured BootstrapResult (CTO C5: no process.exit).
 * Used by CLI wrapper and OTT command dispatcher.
 *
 * @module commands/handlers/bootstrap-handler
 * @version 1.0.0
 * @date 2026-03-29
 * @status ACTIVE — Sprint 123
 * @authority ADR-037 Polyglot Bootstrap
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  detectEcosystem,
  getEcosystemCommands,
  checkToolchain,
  validateRepoUrl,
  extractRepoName,
  detectPythonVenv,
  type EcosystemDetectResult,
  type Ecosystem,
} from "../../cli/commands/ecosystem-detector.js";
import { executeInitCommand } from "./sdlc-commands.js";

// ============================================================================
// Types (A7: BootstrapResult)
// ============================================================================

export interface BootstrapPhase {
  name: "clone" | "detect" | "init" | "build" | "run";
  status: "pending" | "running" | "success" | "failed" | "skipped";
  message: string;
  durationMs?: number;
}

export interface PhaseError {
  phase: "clone" | "detect" | "init" | "build" | "run";
  summary: string;
  guidance: string;
  rawError?: string;
}

export interface BootstrapResult {
  success: boolean;
  phases: BootstrapPhase[];
  ecosystem?: EcosystemDetectResult;
  nextSteps: string[];
  error?: PhaseError;
  totalDurationMs: number;
  projectPath?: string;
}

export interface BootstrapOptions {
  url: string;
  dir?: string;
  tier?: string;
  build?: boolean;
  run?: boolean;
  branch?: string;
  depth?: number;
  skipInit?: boolean;
  force?: boolean;
  ecosystem?: Ecosystem;
  onPhaseUpdate?: (phase: BootstrapPhase) => void;
}

// ============================================================================
// Main Handler (CTO C5: no process.exit)
// ============================================================================

/**
 * Execute the full bootstrap workflow.
 * Returns structured result — caller (CLI/OTT) handles display + exit.
 */
export async function executeBootstrap(opts: BootstrapOptions): Promise<BootstrapResult> {
  const startTime = Date.now();
  const phases: BootstrapPhase[] = [];
  const notify = opts.onPhaseUpdate ?? (() => {});

  // URL validation (CTO C2)
  const urlCheck = validateRepoUrl(opts.url);
  if (!urlCheck.valid) {
    return {
      success: false,
      phases,
      nextSteps: [],
      error: { phase: "clone", summary: "Invalid repository URL", guidance: urlCheck.error ?? "Use HTTPS or SSH git@ format." },
      totalDurationMs: Date.now() - startTime,
    };
  }

  const repoName = extractRepoName(opts.url);
  const projectPath = resolve(opts.dir ?? repoName);

  // ── Phase 1: Clone ────────────────────────────────────────────────────
  const clonePhase: BootstrapPhase = { name: "clone", status: "running", message: `Cloning ${repoName}...` };
  phases.push(clonePhase);
  notify(clonePhase);

  // Directory check
  if (existsSync(projectPath)) {
    const entries = readdirSync(projectPath);
    if (entries.length > 0 && !opts.force) {
      clonePhase.status = "failed";
      clonePhase.message = "Directory already exists";
      return {
        success: false, phases, nextSteps: [],
        error: { phase: "clone", summary: "Directory already exists", guidance: "Use --force to overwrite, or choose a different --dir." },
        totalDurationMs: Date.now() - startTime, projectPath,
      };
    }
    // --force: remove existing directory before clone
    if (opts.force && entries.length > 0) {
      const { rmSync } = await import("node:fs");
      rmSync(projectPath, { recursive: true, force: true });
    }
  }

  const cloneResult = await gitClone(opts.url, projectPath, opts.branch, opts.depth);
  if (!cloneResult.success) {
    clonePhase.status = "failed";
    clonePhase.message = cloneResult.error ?? "Clone failed";
    return {
      success: false, phases, nextSteps: [],
      error: classifyCloneError(cloneResult.error ?? "Unknown error"),
      totalDurationMs: Date.now() - startTime, projectPath,
    };
  }
  clonePhase.status = "success";
  clonePhase.durationMs = Date.now() - startTime;
  clonePhase.message = `Cloned ${repoName}`;
  notify(clonePhase);

  // ── Phase 2: Detect ───────────────────────────────────────────────────
  const detectStart = Date.now();
  const detectPhase: BootstrapPhase = { name: "detect", status: "running", message: "Detecting ecosystem..." };
  phases.push(detectPhase);
  notify(detectPhase);

  const eco = detectEcosystem(projectPath, opts.ecosystem);
  detectPhase.status = "success";
  detectPhase.durationMs = Date.now() - detectStart;
  detectPhase.message = `${eco.language} (${eco.packageManager})`;
  notify(detectPhase);

  // ── Phase 3: Init (unless --skip-init) ────────────────────────────────
  if (!opts.skipInit) {
    const initStart = Date.now();
    const initPhase: BootstrapPhase = { name: "init", status: "running", message: "Initializing SDLC..." };
    phases.push(initPhase);
    notify(initPhase);

    const initResult = await executeInitCommand({
      projectName: repoName,
      tier: opts.tier ?? "STANDARD",
      targetPath: projectPath,
    });

    if (!initResult.success) {
      initPhase.status = "failed";
      initPhase.message = initResult.error ?? "Init failed";
      return {
        success: false, phases, ecosystem: eco, nextSteps: [],
        error: { phase: "init", summary: "SDLC initialization failed", guidance: initResult.error ?? "Check project permissions." },
        totalDurationMs: Date.now() - startTime, projectPath,
      };
    }

    const created = initResult.steps.filter(s => s.status === "created").length;
    initPhase.status = "success";
    initPhase.durationMs = Date.now() - initStart;
    initPhase.message = `SDLC ${opts.tier ?? "STANDARD"}, ${created} files created`;
    notify(initPhase);
  } else {
    phases.push({ name: "init", status: "skipped", message: "Skipped (--skip-init)" });
  }

  // ── Phase 4: Build (if --build or --run) ──────────────────────────────
  if (opts.build || opts.run) {
    if (eco.support === "detect-only") {
      phases.push({ name: "build", status: "failed", message: `${eco.language} not yet supported for build` });
      return {
        success: false, phases, ecosystem: eco, nextSteps: [`Use native tools: ${eco.packageManager}`],
        error: { phase: "build", summary: `${eco.language} detected but not yet supported`, guidance: `Use native tools: ${eco.packageManager}. Go/Java support coming soon.` },
        totalDurationMs: Date.now() - startTime, projectPath,
      };
    }

    // Toolchain pre-check (CTO C3)
    const toolcheck = await checkToolchain(eco.ecosystem);
    if (!toolcheck.available) {
      phases.push({ name: "build", status: "failed", message: `${toolcheck.command} not found` });
      return {
        success: false, phases, ecosystem: eco, nextSteps: [`Install ${toolcheck.command} from ${toolcheck.installUrl}`],
        error: { phase: "build", summary: `${toolcheck.command} not found`, guidance: `Install from ${toolcheck.installUrl}` },
        totalDurationMs: Date.now() - startTime, projectPath,
      };
    }

    // Python venv warning (CTO C4)
    if (eco.ecosystem === "python") {
      const venv = detectPythonVenv(projectPath);
      if (!venv.hasVenv) {
        const warnPhase: BootstrapPhase = { name: "build", status: "running", message: "⚠️ No virtual environment found. Consider: python3 -m venv .venv" };
        notify(warnPhase);
      }
    }

    const cmds = getEcosystemCommands(eco, projectPath);
    if (!cmds) {
      phases.push({ name: "build", status: "failed", message: "Could not determine build commands" });
      return {
        success: false, phases, ecosystem: eco, nextSteps: [],
        error: { phase: "build", summary: "Could not determine build commands", guidance: "Use --ecosystem <name> to specify manually." },
        totalDurationMs: Date.now() - startTime, projectPath,
      };
    }

    const buildStart = Date.now();
    const buildPhase: BootstrapPhase = { name: "build", status: "running", message: "Building..." };
    phases.push(buildPhase);
    notify(buildPhase);

    // Install
    if (cmds.install) {
      const installCode = await runCmd(cmds.install, projectPath);
      if (installCode !== 0) {
        buildPhase.status = "failed";
        buildPhase.message = "Dependency install failed";
        return {
          success: false, phases, ecosystem: eco, nextSteps: [],
          error: { phase: "build", summary: "Dependency installation failed", guidance: "Check output above for missing packages or permissions." },
          totalDurationMs: Date.now() - startTime, projectPath,
        };
      }
    }

    // Build
    if (cmds.build) {
      const buildCode = await runCmd(cmds.build, projectPath);
      if (buildCode !== 0) {
        buildPhase.status = "failed";
        buildPhase.message = "Build failed";
        return {
          success: false, phases, ecosystem: eco, nextSteps: [],
          error: { phase: "build", summary: `Build failed`, guidance: "Check build output above. Common: missing dependencies or wrong toolchain version." },
          totalDurationMs: Date.now() - startTime, projectPath,
        };
      }
    }

    buildPhase.status = "success";
    buildPhase.durationMs = Date.now() - buildStart;
    buildPhase.message = `Build complete (${Math.round(buildPhase.durationMs / 1000)}s)`;
    notify(buildPhase);
  }

  // ── Phase 5: Run (if --run) ───────────────────────────────────────────
  if (opts.run && eco.support === "full") {
    const cmds = getEcosystemCommands(eco, projectPath);
    if (cmds) {
      const runPhase: BootstrapPhase = { name: "run", status: "running", message: `Running: ${cmds.run.join(" ")}` };
      phases.push(runPhase);
      notify(runPhase);
      // Run is fire-and-forget with live output — handler returns, CLI takes over
    }
  }

  // ── Result ────────────────────────────────────────────────────────────
  const nextSteps: string[] = [];
  if (!opts.build) {
    nextSteps.push(`endiorbot ops build --path ${projectPath}`);
  }
  if (!opts.run) {
    nextSteps.push(`endiorbot ops run --path ${projectPath} --dev`);
  }
  nextSteps.push(`endiorbot compliance check --path ${projectPath}`);

  return {
    success: true,
    phases,
    ecosystem: eco,
    nextSteps,
    totalDurationMs: Date.now() - startTime,
    projectPath,
  };
}

// ============================================================================
// Git Clone (A8: spawn with argv, A9: trust warning)
// ============================================================================

function gitClone(url: string, dir: string, branch?: string, depth?: number): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const args = ["clone"];
    if (depth) args.push("--depth", String(depth));
    if (branch) args.push("--branch", branch);
    args.push(url, dir);

    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: stderr.trim() });
    });
    child.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

// ============================================================================
// Command Runner (A8: no shell: true)
// ============================================================================

function runCmd(args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(args[0]!, args.slice(1), { cwd, stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

// ============================================================================
// Error Classification (A5: failure UX)
// ============================================================================

function classifyCloneError(errorMsg: string): PhaseError {
  const lower = errorMsg.toLowerCase();

  if (lower.includes("not found") || lower.includes("does not exist") || lower.includes("404")) {
    return { phase: "clone", summary: "Repository not found", guidance: "Check URL spelling. Ensure the repo is public or you have SSH access.", rawError: errorMsg };
  }
  if (lower.includes("authentication") || lower.includes("permission denied") || lower.includes("could not read")) {
    return { phase: "clone", summary: "Authentication failed", guidance: "For private repos, use SSH URL (git@github.com:...) with configured SSH key.", rawError: errorMsg };
  }
  if (lower.includes("network") || lower.includes("unable to access") || lower.includes("could not resolve")) {
    return { phase: "clone", summary: "Network error during clone", guidance: "Check internet connection. Try again.", rawError: errorMsg };
  }
  return { phase: "clone", summary: "Clone failed", guidance: "Check the URL and try again.", rawError: errorMsg };
}
