/**
 * Ecosystem Detector — SSOT for all project type detection
 *
 * Single detection module imported by devops.ts, project-context-collector.ts,
 * and bootstrap-handler.ts. No parallel detection paths (CTO C1).
 *
 * Supports: Node.js, Rust, Python (full), Go, Java (detect-only)
 *
 * @module cli/commands/ecosystem-detector
 * @version 1.0.0
 * @date 2026-03-29
 * @status ACTIVE — Sprint 123
 * @authority ADR-037 Polyglot Bootstrap
 * @sdlc SDLC Framework 6.3.1
 */

import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";

// ============================================================================
// Types
// ============================================================================

export type Ecosystem = "docker" | "node" | "rust" | "python" | "go" | "java";
export type SupportLevel = "full" | "detect-only";

export interface EcosystemDetectResult {
  /** Detected ecosystem */
  ecosystem: Ecosystem;
  /** Human-readable language name */
  language: string;
  /** Package manager / build tool */
  packageManager: string;
  /** Whether build/run commands are supported in Sprint 123 */
  support: SupportLevel;
  /** File that triggered detection */
  markerFile: string;
}

export interface EcosystemCommands {
  /** Install deps command, null if not needed */
  install: string[] | null;
  /** Build command, null if no build step */
  build: string[] | null;
  /** Production run command */
  run: string[];
  /** Dev run command */
  dev: string[];
}

export interface ToolchainCheckResult {
  available: boolean;
  version?: string;
  command: string;
  installUrl: string;
}

export interface PythonVenvInfo {
  hasVenv: boolean;
  venvPath?: string;
  activateCmd?: string;
  pythonBin?: string;
  pipBin?: string;
}

// ============================================================================
// Toolchain Info
// ============================================================================

const TOOLCHAIN_INFO: Record<Ecosystem, { command: string; versionFlag: string; installUrl: string }> = {
  docker: { command: "docker",  versionFlag: "--version", installUrl: "https://docs.docker.com/get-docker/" },
  rust:   { command: "cargo",   versionFlag: "--version", installUrl: "https://rustup.rs" },
  python: { command: "python3", versionFlag: "--version", installUrl: "https://www.python.org/downloads/" },
  go:     { command: "go",      versionFlag: "version",   installUrl: "https://go.dev/dl/" },
  java:   { command: "java",    versionFlag: "-version",  installUrl: "https://adoptium.net" },
  node:   { command: "node",    versionFlag: "--version", installUrl: "https://nodejs.org" },
};

// ============================================================================
// Ecosystem Detection (CTO C1 — SSOT)
// ============================================================================

/**
 * Detect project ecosystem from marker files.
 * Priority order: most specific first (Cargo.toml > package.json).
 *
 * @param projectPath - Absolute path to project root
 * @param override - Force ecosystem (CPO: --ecosystem flag for monorepos)
 */
export function detectEcosystem(projectPath: string, override?: Ecosystem): EcosystemDetectResult {
  if (override) {
    return buildResult(override, projectPath);
  }

  // Priority-ordered detection

  // Docker: highest priority — monorepo/multi-service projects
  const composeFile = detectDockerCompose(projectPath);
  if (composeFile) {
    const subEcosystems = scanSubEcosystems(projectPath);
    const langLabel = formatLanguageLabel(subEcosystems);
    return { ecosystem: "docker", language: langLabel, packageManager: "docker", support: "full", markerFile: composeFile };
  }

  if (existsSync(join(projectPath, "Cargo.toml"))) {
    return { ecosystem: "rust", language: "Rust", packageManager: "cargo", support: "full", markerFile: "Cargo.toml" };
  }

  if (existsSync(join(projectPath, "go.mod"))) {
    return { ecosystem: "go", language: "Go", packageManager: "go", support: "detect-only", markerFile: "go.mod" };
  }

  // Python: poetry > pip
  const pyprojectPath = join(projectPath, "pyproject.toml");
  if (existsSync(pyprojectPath)) {
    const isPoetry = detectPoetry(pyprojectPath);
    return {
      ecosystem: "python",
      language: "Python",
      packageManager: isPoetry ? "poetry" : "pip",
      support: "full",
      markerFile: "pyproject.toml",
    };
  }

  if (existsSync(join(projectPath, "requirements.txt"))) {
    return { ecosystem: "python", language: "Python", packageManager: "pip", support: "full", markerFile: "requirements.txt" };
  }

  // Java: Maven > Gradle
  if (existsSync(join(projectPath, "pom.xml"))) {
    return { ecosystem: "java", language: "Java", packageManager: "maven", support: "detect-only", markerFile: "pom.xml" };
  }
  if (existsSync(join(projectPath, "build.gradle")) || existsSync(join(projectPath, "build.gradle.kts"))) {
    const marker = existsSync(join(projectPath, "build.gradle")) ? "build.gradle" : "build.gradle.kts";
    return { ecosystem: "java", language: "Java", packageManager: "gradle", support: "detect-only", markerFile: marker };
  }

  // Node.js: detect PM from lock files
  const pm = detectNodePackageManager(projectPath);
  const hasTypeScript = existsSync(join(projectPath, "tsconfig.json"));
  return {
    ecosystem: "node",
    language: hasTypeScript ? "TypeScript" : "JavaScript",
    packageManager: pm,
    support: "full",
    markerFile: pm === "npm" ? "package.json" : getLockFileName(pm),
  };
}

/**
 * Get build/run commands for an ecosystem.
 * Only for "full" support ecosystems (CTO C-CPO-2).
 */
export function getEcosystemCommands(result: EcosystemDetectResult, projectPath: string): EcosystemCommands | null {
  if (result.support === "detect-only") return null;

  switch (result.ecosystem) {
    case "docker":
      return getDockerCommands();
    case "node":
      return getNodeCommands(result.packageManager, projectPath);
    case "rust":
      return getRustCommands();
    case "python":
      return getPythonCommands(result.packageManager, projectPath);
    default:
      return null;
  }
}

/**
 * Check if a toolchain is available (CTO C3).
 */
export function checkToolchain(ecosystem: Ecosystem): Promise<ToolchainCheckResult> {
  const info = TOOLCHAIN_INFO[ecosystem];
  return new Promise((resolve) => {
    execFile(info.command, [info.versionFlag], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ available: false, command: info.command, installUrl: info.installUrl });
      } else {
        resolve({ available: true, version: stdout.trim(), command: info.command, installUrl: info.installUrl });
      }
    });
  });
}

/**
 * Detect Python virtual environment (CTO C4).
 */
export function detectPythonVenv(projectPath: string): PythonVenvInfo {
  // .env excluded — too ambiguous (could be dotenv file)
  const candidates = [".venv", "venv"];
  for (const dir of candidates) {
    const venvPath = join(projectPath, dir);
    const activatePath = join(venvPath, "bin", "activate");
    if (existsSync(activatePath)) {
      return {
        hasVenv: true,
        venvPath,
        activateCmd: `source ${dir}/bin/activate`,
        pythonBin: join(venvPath, "bin", "python"),
        pipBin: join(venvPath, "bin", "pip"),
      };
    }
  }
  return { hasVenv: false };
}

// ============================================================================
// Node.js Detection (existing logic extracted)
// ============================================================================

/**
 * Detect Node.js package manager from lock files.
 */
export function detectNodePackageManager(projectPath: string): string {
  if (existsSync(join(projectPath, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(projectPath, "yarn.lock"))) return "yarn";
  if (existsSync(join(projectPath, "bun.lockb")) || existsSync(join(projectPath, "bun.lock"))) return "bun";
  return "npm";
}

// ============================================================================
// URL Validation (CTO C2)
// ============================================================================

const ALLOWED_URL_PATTERNS = [
  /^https:\/\/.+/,
  /^http:\/\/localhost[:/].+/,
  /^git@[\w.-]+:.+/,
];

const BLOCKED_URL_PATTERNS = [
  /^file:\/\//,
  /^\//,
  /^\.\./,
];

/**
 * Validate a git repo URL (CTO C2).
 */
export function validateRepoUrl(url: string): { valid: boolean; error?: string } {
  for (const blocked of BLOCKED_URL_PATTERNS) {
    if (blocked.test(url)) {
      return { valid: false, error: `Blocked URL pattern. Use HTTPS or SSH git@ format.` };
    }
  }
  for (const allowed of ALLOWED_URL_PATTERNS) {
    if (allowed.test(url)) return { valid: true };
  }
  return { valid: false, error: `Invalid repo URL. Use https://github.com/... or git@github.com:...` };
}

/**
 * Extract repo name from URL.
 */
export function extractRepoName(url: string): string {
  // git@github.com:org/repo.git → repo
  // https://github.com/org/repo.git → repo
  // https://github.com/org/repo → repo
  const cleaned = url.replace(/\.git$/, "");
  const parts = cleaned.split(/[/:]/).filter(Boolean);
  return parts[parts.length - 1] ?? "project";
}

// ============================================================================
// Private Helpers
// ============================================================================

function detectDockerCompose(projectPath: string): string | null {
  if (existsSync(join(projectPath, "docker-compose.yml"))) return "docker-compose.yml";
  if (existsSync(join(projectPath, "docker-compose.yaml"))) return "docker-compose.yaml";
  if (existsSync(join(projectPath, "compose.yml"))) return "compose.yml";
  if (existsSync(join(projectPath, "compose.yaml"))) return "compose.yaml";
  return null;
}

/** Sub-ecosystem info for monorepo reporting */
interface SubEcosystem {
  dir: string;
  language: string;
  markerFile: string;
}

/**
 * Format a list of sub-ecosystems into a deduplicated language label.
 */
function formatLanguageLabel(subEcosystems: SubEcosystem[]): string {
  if (subEcosystems.length === 0) return "Multi-language";
  const uniqueLangs = [...new Set(subEcosystems.map((s) => s.language))];
  return uniqueLangs.join(" + ");
}

/**
 * Scan project root and common monorepo subdirs for ecosystem markers.
 */
function scanSubEcosystems(projectPath: string): SubEcosystem[] {
  const results: SubEcosystem[] = [];

  // Pass 0: root-level language markers (Docker projects often hide these)
  if (existsSync(join(projectPath, "pyproject.toml"))) {
    results.push({ dir: ".", language: "Python", markerFile: "pyproject.toml" });
  } else if (existsSync(join(projectPath, "requirements.txt"))) {
    results.push({ dir: ".", language: "Python", markerFile: "requirements.txt" });
  }
  if (existsSync(join(projectPath, "Cargo.toml"))) {
    results.push({ dir: ".", language: "Rust", markerFile: "Cargo.toml" });
  }
  if (existsSync(join(projectPath, "go.mod"))) {
    results.push({ dir: ".", language: "Go", markerFile: "go.mod" });
  }
  if (existsSync(join(projectPath, "package.json"))) {
    const hasTS = existsSync(join(projectPath, "tsconfig.json"));
    results.push({ dir: ".", language: hasTS ? "TypeScript" : "JavaScript", markerFile: "package.json" });
  }

  const subdirs = ["backend", "frontend", "server", "client", "app", "api", "web", "service"];

  for (const dir of subdirs) {
    const subPath = join(projectPath, dir);
    if (!existsSync(subPath)) continue;

    if (existsSync(join(subPath, "go.mod")))          results.push({ dir, language: "Go", markerFile: "go.mod" });
    else if (existsSync(join(subPath, "Cargo.toml")))  results.push({ dir, language: "Rust", markerFile: "Cargo.toml" });
    else if (existsSync(join(subPath, "pyproject.toml"))) results.push({ dir, language: "Python", markerFile: "pyproject.toml" });
    else if (existsSync(join(subPath, "requirements.txt"))) results.push({ dir, language: "Python", markerFile: "requirements.txt" });
    else if (existsSync(join(subPath, "package.json"))) {
      const hasTS = existsSync(join(subPath, "tsconfig.json"));
      results.push({ dir, language: hasTS ? "TypeScript" : "JavaScript", markerFile: "package.json" });
    }
  }

  return results;
}

function getDockerCommands(): EcosystemCommands {
  return {
    install: null,
    build: ["docker", "compose", "build"],
    run: ["docker", "compose", "up"],
    dev: ["docker", "compose", "up"],
  };
}

function detectPoetry(pyprojectPath: string): boolean {
  try {
    const content = readFileSync(pyprojectPath, "utf-8");
    return content.includes("[tool.poetry]");
  } catch {
    return false;
  }
}

function buildResult(ecosystem: Ecosystem, projectPath: string): EcosystemDetectResult {
  const map: Record<Ecosystem, () => EcosystemDetectResult> = {
    docker: () => {
      const subs = scanSubEcosystems(projectPath);
      return { ecosystem: "docker", language: formatLanguageLabel(subs), packageManager: "docker", support: "full", markerFile: "docker-compose.yml" };
    },
    rust:   () => ({ ecosystem: "rust", language: "Rust", packageManager: "cargo", support: "full", markerFile: "Cargo.toml" }),
    python: () => {
      const pyprojectPath = join(projectPath, "pyproject.toml");
      const isPoetry = existsSync(pyprojectPath) && detectPoetry(pyprojectPath);
      return { ecosystem: "python", language: "Python", packageManager: isPoetry ? "poetry" : "pip", support: "full", markerFile: "pyproject.toml" };
    },
    go:     () => ({ ecosystem: "go", language: "Go", packageManager: "go", support: "detect-only", markerFile: "go.mod" }),
    java:   () => ({ ecosystem: "java", language: "Java", packageManager: "maven", support: "detect-only", markerFile: "pom.xml" }),
    node:   () => {
      const pm = detectNodePackageManager(projectPath);
      const hasTS = existsSync(join(projectPath, "tsconfig.json"));
      return { ecosystem: "node", language: hasTS ? "TypeScript" : "JavaScript", packageManager: pm, support: "full", markerFile: "package.json" };
    },
  };
  return map[ecosystem]();
}

function getLockFileName(pm: string): string {
  switch (pm) {
    case "pnpm": return "pnpm-lock.yaml";
    case "yarn": return "yarn.lock";
    case "bun":  return "bun.lockb";
    default:     return "package-lock.json";
  }
}

function getNodeCommands(pm: string, projectPath: string): EcosystemCommands {
  const scripts = readNodeScripts(projectPath);
  return {
    install: [pm, "install"],
    build: scripts.build ? [pm, "run", "build"] : null,
    run: scripts.start ? [pm, "run", "start"] : [pm, "run", "dev"],
    dev: scripts.dev ? [pm, "run", "dev"] : (scripts.start ? [pm, "run", "start"] : [pm, "run", "dev"]),
  };
}

function getRustCommands(): EcosystemCommands {
  return {
    install: null, // cargo handles deps automatically
    build: ["cargo", "build", "--release"],
    run: ["cargo", "run", "--release"],
    dev: ["cargo", "run"],
  };
}

function getPythonCommands(pm: string, projectPath: string): EcosystemCommands {
  const venv = detectPythonVenv(projectPath);
  const pythonBin = venv.pythonBin ?? "python3";
  const pipBin = venv.pipBin ?? "pip3";

  const installCmd: string[] | null =
    pm === "poetry" ? ["poetry", "install"] :
    existsSync(join(projectPath, "requirements.txt")) ? [pipBin, "install", "-r", "requirements.txt"] :
    null;

  const entry = detectPythonEntry(projectPath);

  return {
    install: installCmd,
    build: null, // Python typically doesn't have a build step
    run: [pythonBin, entry],
    dev: [pythonBin, entry],
  };
}

function detectPythonEntry(projectPath: string): string {
  // 1. manage.py (Django)
  if (existsSync(join(projectPath, "manage.py"))) return "manage.py";
  // 2. app.py (Flask, FastAPI)
  if (existsSync(join(projectPath, "app.py"))) return "app.py";
  // 3. main.py
  if (existsSync(join(projectPath, "main.py"))) return "main.py";
  // 4. launch.py (Streamlit apps, custom launchers)
  if (existsSync(join(projectPath, "launch.py"))) return "launch.py";
  // 5. run.py
  if (existsSync(join(projectPath, "run.py"))) return "run.py";
  // 6. src/__main__.py
  if (existsSync(join(projectPath, "src", "__main__.py"))) return "-m src";
  // Fallback
  return "main.py";
}

function readNodeScripts(projectPath: string): Record<string, string> {
  try {
    const raw = readFileSync(join(projectPath, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}
