/**
 * Project Context Collector
 *
 * Scans a target project to build a ProjectSnapshot — comprehensive
 * context about code, tests, docs, and tech stack. This context is
 * injected into agent prompts for context-aware content generation.
 *
 * @module sdlc/compliance/project-context-collector
 * @version 1.0.0
 * @date 2026-03-03
 * @status ACTIVE - Sprint 75
 * @authority ADR-018 AI-Generated Compliance Content
 * @sprint 75
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { countPlaceholders } from "./content-checker.js";
import { countContentLines } from "./content-checker.js";
import type { ProjectTier } from "../scaffold/types.js";
import type {
  CodeModule,
  ExistingDocInfo,
  ProjectSnapshot,
  TechStackInfo,
  TestFileInfo,
} from "./fix-types.js";
import { detectEcosystem, detectTypeScript } from "../../cli/commands/ecosystem-detector.js";

// ============================================================================
// Public API
// ============================================================================

/**
 * Collect comprehensive project context for agent prompts.
 */
export async function collectProjectContext(
  projectPath: string,
  tier: ProjectTier,
): Promise<ProjectSnapshot> {
  const techStack = detectTechStack(projectPath);
  const codeModules = scanCodeModules(projectPath);
  const testFiles = scanTestFiles(projectPath);
  const existingDocs = scanExistingDocs(projectPath);

  const pkgInfo = readPackageJson(projectPath);

  return {
    name: pkgInfo.name || basename(projectPath),
    description: pkgInfo.description || "",
    tier,
    techStack,
    codeModules,
    testFiles,
    existingDocs,
    projectPath,
  };
}

// ============================================================================
// Tech Stack Detection
// ============================================================================

interface PackageJsonInfo {
  name: string;
  description: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

function readPackageJson(projectPath: string): PackageJsonInfo {
  const pkgPath = join(projectPath, "package.json");
  const result: PackageJsonInfo = {
    name: "",
    description: "",
    dependencies: {},
    devDependencies: {},
    scripts: {},
  };

  if (!existsSync(pkgPath)) return result;

  try {
    const raw = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
    result.name = (raw.name as string) || "";
    result.description = (raw.description as string) || "";
    result.dependencies = (raw.dependencies as Record<string, string>) || {};
    result.devDependencies = (raw.devDependencies as Record<string, string>) || {};
    result.scripts = (raw.scripts as Record<string, string>) || {};
  } catch {
    // Invalid package.json
  }

  return result;
}

function detectTechStack(projectPath: string): TechStackInfo {
  // Use shared ecosystem detection (CTO C1: SSOT)
  const eco = detectEcosystem(projectPath);
  const pkg = readPackageJson(projectPath);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const hasTypeScript = detectTypeScript(projectPath);

  // Detect Docker
  const hasDocker = existsSync(join(projectPath, "Dockerfile"))
    || existsSync(join(projectPath, "docker-compose.yml"))
    || existsSync(join(projectPath, "docker-compose.yaml"))
    || existsSync(join(projectPath, "compose.yml"));

  // Detect CI
  const hasCI = existsSync(join(projectPath, ".github", "workflows"))
    || existsSync(join(projectPath, ".gitlab-ci.yml"))
    || existsSync(join(projectPath, ".circleci"));

  const info: TechStackInfo = {
    language: eco.language,
    hasTypeScript,
    hasDocker,
    hasCI,
    dependencies: Object.keys(pkg.dependencies),
    devDependencies: Object.keys(pkg.devDependencies),
    scripts: pkg.scripts,
  };

  if (eco.packageManager) info.packageManager = eco.packageManager;
  if (eco.ecosystem) info.ecosystem = eco.ecosystem;

  // Node.js framework enrichment (only when ecosystem is node)
  if (eco.ecosystem === "node") {
    let framework: string | undefined;
    if (allDeps["next"]) framework = "Next.js";
    else if (allDeps["express"]) framework = "Express";
    else if (allDeps["fastify"]) framework = "Fastify";
    else if (allDeps["react"]) framework = "React";
    else if (allDeps["vue"]) {
      const parts = ["Vue"];
      if (allDeps["vite"] || allDeps["@vitejs/plugin-vue"]) parts.push("Vite");
      framework = parts.join("/");
    }
    if (framework) info.framework = framework;

    // Detect desktop runtime (Tauri)
    if (allDeps["@tauri-apps/api"] || allDeps["@tauri-apps/cli"]) {
      info.desktop = "Tauri 2";
    }
  }

  return info;
}

// ============================================================================
// Code Module Scanner
// ============================================================================

function scanCodeModules(projectPath: string): CodeModule[] {
  const srcPath = join(projectPath, "src");
  if (!existsSync(srcPath)) return [];

  const modules: CodeModule[] = [];

  try {
    const entries = readdirSync(srcPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const modulePath = join(srcPath, entry.name);
      const files = listSourceFiles(modulePath);

      modules.push({
        name: entry.name,
        path: `src/${entry.name}`,
        fileCount: files.length,
        keyFiles: files.slice(0, 5), // Top 5 files
      });
    }
  } catch {
    // Permission or access error
  }

  return modules;
}

function listSourceFiles(dirPath: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(ts|tsx|js|jsx)$/i.test(entry.name)) {
        // Skip test files and declaration files
        if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts")) continue;
        if (entry.name.endsWith(".d.ts")) continue;
        files.push(entry.name);
      }
    }
  } catch {
    // Permission error
  }

  return files;
}

// ============================================================================
// Test File Scanner
// ============================================================================

function scanTestFiles(projectPath: string): TestFileInfo[] {
  const testFiles: TestFileInfo[] = [];

  // Scan tests/ directory
  const testsDir = join(projectPath, "tests");
  if (existsSync(testsDir)) {
    scanTestDir(testsDir, "tests", testFiles);
  }

  // Scan src/**/__tests__/ directories
  const srcDir = join(projectPath, "src");
  if (existsSync(srcDir)) {
    scanTestsInSrc(srcDir, "src", testFiles);
  }

  return testFiles;
}

function scanTestDir(dirPath: string, relativePath: string, results: TestFileInfo[]): void {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relPath = `${relativePath}/${entry.name}`;

      if (entry.isFile() && /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(entry.name)) {
        results.push({
          path: relPath,
          name: entry.name,
          type: classifyTestType(relPath, entry.name),
        });
      } else if (entry.isDirectory() && results.length < 100) {
        // Limit recursion to prevent scanning huge test suites
        scanTestDir(fullPath, relPath, results);
      }
    }
  } catch {
    // Permission error
  }
}

function scanTestsInSrc(dirPath: string, relativePath: string, results: TestFileInfo[]): void {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(dirPath, entry.name);
      const relPath = `${relativePath}/${entry.name}`;

      if (entry.name === "__tests__") {
        scanTestDir(fullPath, relPath, results);
      } else if (results.length < 100) {
        scanTestsInSrc(fullPath, relPath, results);
      }
    }
  } catch {
    // Permission error
  }
}

function classifyTestType(
  filePath: string,
  fileName: string,
): "unit" | "integration" | "e2e" | "manual" | "unknown" {
  const lower = filePath.toLowerCase();
  const nameLower = fileName.toLowerCase();

  if (lower.includes("e2e") || nameLower.includes("e2e")) return "e2e";
  if (lower.includes("integration") || nameLower.includes("integration")) return "integration";
  if (lower.includes("manual") || nameLower.includes("manual")) return "manual";
  if (nameLower.endsWith(".test.ts") || nameLower.endsWith(".spec.ts")) return "unit";

  return "unknown";
}

// ============================================================================
// Existing Docs Scanner
// ============================================================================

function scanExistingDocs(projectPath: string): ExistingDocInfo[] {
  const docsPath = join(projectPath, "docs");
  if (!existsSync(docsPath)) return [];

  const docs: ExistingDocInfo[] = [];

  try {
    const entries = readdirSync(docsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const stagePath = join(docsPath, entry.name);
      scanStageDocDir(stagePath, entry.name, docs);
    }
  } catch {
    // Permission error
  }

  return docs;
}

function scanStageDocDir(dirPath: string, stage: string, results: ExistingDocInfo[]): void {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isFile() && /\.(md|yaml|yml)$/i.test(entry.name)) {
        try {
          const stat = statSync(fullPath);
          if (!stat.isFile()) continue;

          const content = readFileSync(fullPath, "utf-8");
          const contentLines = countContentLines(content);
          const placeholders = countPlaceholders(content);

          results.push({
            stage,
            path: entry.name,
            contentLines,
            placeholderCount: placeholders.length,
            hasRealContent: contentLines > 10 && placeholders.length === 0,
          });
        } catch {
          // Unreadable file
        }
      } else if (entry.isDirectory()) {
        // One level deeper
        scanSubdirDocs(fullPath, stage, entry.name, results);
      }
    }
  } catch {
    // Permission error
  }
}

function scanSubdirDocs(
  dirPath: string,
  stage: string,
  subdir: string,
  results: ExistingDocInfo[],
): void {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(md|yaml|yml)$/i.test(entry.name)) continue;

      const fullPath = join(dirPath, entry.name);
      try {
        const content = readFileSync(fullPath, "utf-8");
        const contentLines = countContentLines(content);
        const placeholders = countPlaceholders(content);

        results.push({
          stage,
          path: `${subdir}/${entry.name}`,
          contentLines,
          placeholderCount: placeholders.length,
          hasRealContent: contentLines > 10 && placeholders.length === 0,
        });
      } catch {
        // Unreadable file
      }
    }
  } catch {
    // Permission error
  }
}
