/**
 * Tier Recommender
 *
 * Scans project characteristics to recommend the appropriate SDLC tier.
 * Used by `endiorbot init` when --tier is not explicitly provided.
 *
 * Signals: source file count, tests, CI/CD, dependencies, monorepo,
 * team files, compliance indicators.
 *
 * @module sdlc/scaffold/tier-recommender
 * @version 1.0.0
 * @date 2026-05-20
 * @status ACTIVE - Sprint 149
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createLogger } from "../../logging/index.js";
import type { ProjectTier } from "./types.js";

const logger = createLogger("tier-recommender");

// ============================================================================
// Types
// ============================================================================

/** Signals collected from the project for tier scoring. */
export interface TierSignals {
  sourceFileCount: number;
  testFileCount: number;
  hasCiCd: boolean;
  dependencyCount: number;
  hasMonorepo: boolean;
  hasTeamFiles: boolean;
  hasComplianceFiles: boolean;
}

/** Tier recommendation result. */
export interface TierRecommendation {
  tier: ProjectTier;
  score: number;
  reason: string;
  signals: TierSignals;
}

// ============================================================================
// Source Extensions
// ============================================================================

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".pyw",
  ".go",
  ".rs",
  ".java", ".kt", ".scala",
  ".rb",
  ".php",
  ".cs",
  ".swift",
  ".dart",
  ".vue", ".svelte",
  ".c", ".cpp", ".h", ".hpp",
]);

const TEST_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /_test\.go$/,
  /test_.*\.py$/,
  /.*_test\.py$/,
  /\.test\.py$/,
  /Test\.java$/,
  /\.spec\.rb$/,
];

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__",
  ".venv", "venv", "env", ".tox", ".mypy_cache", ".pytest_cache",
  "vendor", "target", ".gradle", "coverage", ".turbo", ".cache",
]);

// ============================================================================
// Public API
// ============================================================================

/**
 * Scan project and recommend a tier.
 */
export function recommendTier(projectPath: string): TierRecommendation {
  const signals = collectSignals(projectPath);
  const score = computeScore(signals);
  const tier = scoreToTier(score);
  const reason = buildReason(tier, signals);

  logger.debug("Tier recommendation", { tier, score, signals });

  return { tier, score, reason, signals };
}

// ============================================================================
// Signal Collection
// ============================================================================

const TEST_DIRS = new Set(["tests", "test", "__tests__", "spec"]);

function collectSignals(projectPath: string): TierSignals {
  let sourceFileCount = 0;
  let testFileCount = 0;

  // Walk source tree — skip top-level test dirs (counted separately below)
  countFiles(projectPath, 0, 6, (_filePath, fileName) => {
    const ext = extname(fileName).toLowerCase();
    if (SOURCE_EXTENSIONS.has(ext)) {
      sourceFileCount++;
      // Count inline test files (e.g. src/utils/__tests__/foo.test.ts
      // already walked here) by name pattern only
      if (TEST_PATTERNS.some(p => p.test(fileName))) {
        testFileCount++;
      }
    }
  }, TEST_DIRS);

  // Count top-level test directories (excluded from walk above)
  for (const testDir of TEST_DIRS) {
    const testPath = join(projectPath, testDir);
    if (existsSync(testPath) && statSync(testPath).isDirectory()) {
      countFiles(testPath, 0, 4, (_fp, fileName) => {
        const ext = extname(fileName).toLowerCase();
        if (SOURCE_EXTENSIONS.has(ext)) {
          sourceFileCount++;
          testFileCount++;
        }
      });
    }
  }

  const hasCiCd = checkCiCd(projectPath);
  const dependencyCount = countDependencies(projectPath);
  const hasMonorepo = checkMonorepo(projectPath);
  const hasTeamFiles = checkTeamFiles(projectPath);
  const hasComplianceFiles = checkComplianceFiles(projectPath);

  return {
    sourceFileCount,
    testFileCount,
    hasCiCd,
    dependencyCount,
    hasMonorepo,
    hasTeamFiles,
    hasComplianceFiles,
  };
}

function countFiles(
  dir: string,
  depth: number,
  maxDepth: number,
  callback: (filePath: string, fileName: string) => void,
  skipAtRoot?: Set<string>,
): void {
  if (depth > maxDepth) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    // Skip specific dirs at depth 0 (e.g. test dirs counted separately)
    if (depth === 0 && skipAtRoot?.has(entry)) continue;

    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isFile()) {
        callback(fullPath, entry);
      } else if (stat.isDirectory()) {
        countFiles(fullPath, depth + 1, maxDepth, callback, skipAtRoot);
      }
    } catch {
      // Permission denied or broken symlink
    }
  }
}

function checkCiCd(projectPath: string): boolean {
  const indicators = [
    ".github/workflows",
    ".gitlab-ci.yml",
    ".circleci",
    "Jenkinsfile",
    ".travis.yml",
    "azure-pipelines.yml",
    "bitbucket-pipelines.yml",
  ];
  return indicators.some(p => existsSync(join(projectPath, p)));
}

function countDependencies(projectPath: string): number {
  // Node.js
  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
      const deps = Object.keys((pkg.dependencies as Record<string, string>) ?? {});
      const devDeps = Object.keys((pkg.devDependencies as Record<string, string>) ?? {});
      return deps.length + devDeps.length;
    } catch { /* ignore */ }
  }

  // Python
  const reqPath = join(projectPath, "requirements.txt");
  if (existsSync(reqPath)) {
    try {
      const lines = readFileSync(reqPath, "utf-8").split("\n");
      return lines.filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("-")).length;
    } catch { /* ignore */ }
  }

  // Go
  const goModPath = join(projectPath, "go.mod");
  if (existsSync(goModPath)) {
    try {
      const content = readFileSync(goModPath, "utf-8");
      return (content.match(/^\t[^\t]/gm) ?? []).length;
    } catch { /* ignore */ }
  }

  return 0;
}

function checkMonorepo(projectPath: string): boolean {
  // Check for workspace configs
  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
      if (pkg.workspaces) return true;
    } catch { /* ignore */ }
  }

  const indicators = [
    "lerna.json",
    "pnpm-workspace.yaml",
    "nx.json",
    "turbo.json",
    "rush.json",
  ];
  return indicators.some(p => existsSync(join(projectPath, p)));
}

function checkTeamFiles(projectPath: string): boolean {
  const indicators = [
    "CODEOWNERS",
    ".github/CODEOWNERS",
    "CONTRIBUTING.md",
    ".github/CONTRIBUTING.md",
  ];
  return indicators.some(p => existsSync(join(projectPath, p)));
}

function checkComplianceFiles(projectPath: string): boolean {
  const indicators = [
    "SECURITY.md",
    ".github/SECURITY.md",
    "LICENSE",
    "LICENSE.md",
    ".snyk",
    ".trivyignore",
    "sonar-project.properties",
    "audit.json",
  ];
  // Need at least 2 compliance indicators (LICENSE alone doesn't count)
  const found = indicators.filter(p => existsSync(join(projectPath, p)));
  return found.length >= 2;
}

// ============================================================================
// Scoring
// ============================================================================

function computeScore(signals: TierSignals): number {
  let score = 0;

  // Source files (0-3)
  if (signals.sourceFileCount > 100) score += 3;
  else if (signals.sourceFileCount > 30) score += 2;
  else if (signals.sourceFileCount > 10) score += 1;

  // Test files (0-2)
  if (signals.testFileCount > 10) score += 2;
  else if (signals.testFileCount > 0) score += 1;

  // CI/CD (0-1)
  if (signals.hasCiCd) score += 1;

  // Dependencies (0-2)
  if (signals.dependencyCount > 30) score += 2;
  else if (signals.dependencyCount > 10) score += 1;

  // Monorepo (0-2)
  if (signals.hasMonorepo) score += 2;

  // Team files (0-1)
  if (signals.hasTeamFiles) score += 1;

  // Compliance (0-1)
  if (signals.hasComplianceFiles) score += 1;

  return score;
}

function scoreToTier(score: number): ProjectTier {
  if (score >= 8) return "ENTERPRISE";
  if (score >= 5) return "PROFESSIONAL";
  if (score >= 2) return "STANDARD";
  return "LITE";
}

// ============================================================================
// Reason Generation
// ============================================================================

function buildReason(tier: ProjectTier, signals: TierSignals): string {
  const parts: string[] = [];

  parts.push(`${signals.sourceFileCount} source files`);

  if (signals.testFileCount > 0) {
    parts.push(`${signals.testFileCount} test files`);
  }

  if (signals.hasCiCd) parts.push("CI/CD detected");
  if (signals.hasMonorepo) parts.push("monorepo");
  if (signals.dependencyCount > 0) parts.push(`${signals.dependencyCount} deps`);
  if (signals.hasTeamFiles) parts.push("team collaboration files");
  if (signals.hasComplianceFiles) parts.push("compliance indicators");

  return `${tier} recommended: ${parts.join(", ")}`;
}
