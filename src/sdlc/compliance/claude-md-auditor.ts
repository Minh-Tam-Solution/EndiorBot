/**
 * CLAUDE.md Auditor — Detects stale references, size bloat, and outdated patterns.
 *
 * Sprint 153, Plan U4.
 *
 * @module sdlc/compliance/claude-md-auditor
 * @sdlc SDLC Framework 6.4.0
 */

import {
  existsSync,
  readFileSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createLogger } from "../../logging/index.js";
import { FRAMEWORK_VERSION } from "../../index.js";

const logger = createLogger("claude-md-auditor");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void logger;

// ============================================================================
// Types
// ============================================================================

export type AuditSeverity = "error" | "warning" | "info";

export interface AuditWarning {
  /** Unique warning ID for --accept suppression */
  id: string;
  /** Severity level */
  severity: AuditSeverity;
  /** File path (relative to project root) */
  file: string;
  /** Line number (1-based, 0 if not line-specific) */
  line: number;
  /** Human-readable message */
  message: string;
}

export interface AuditFileInfo {
  /** Relative path from project root */
  path: string;
  /** Line count */
  lines: number;
  /** Last modified date */
  lastModified: Date;
  /** Days since last modified */
  daysSinceModified: number;
}

export interface AuditBaseline {
  /** When audit was last run */
  last_audited_at: string;
  /** Warning IDs that are suppressed */
  accepted_debt: string[];
}

export interface AuditResult {
  /** Project path audited */
  projectPath: string;
  /** CLAUDE.md files found */
  files: AuditFileInfo[];
  /** Warnings (before suppression) */
  warnings: AuditWarning[];
  /** Suppressed warning IDs */
  suppressed: string[];
  /** Warnings after suppression */
  activeWarnings: AuditWarning[];
}

// ============================================================================
// Constants
// ============================================================================

const ROOT_SIZE_LIMIT = 300;
const SUBDIR_SIZE_LIMIT = 100;
const AGE_THRESHOLD_DAYS = 90;
const BASELINE_FILE = ".endiorbot/audit-baseline.json";

// ============================================================================
// Public API
// ============================================================================

/**
 * Audit all CLAUDE.md files in a project.
 */
export function auditClaudeMd(projectPath: string): AuditResult {
  const resolvedPath = resolve(projectPath);
  const files: AuditFileInfo[] = [];
  const warnings: AuditWarning[] = [];

  // Find all CLAUDE.md files
  const claudeFiles = findClaudeMdFiles(resolvedPath);

  for (const filePath of claudeFiles) {
    const relativePath = filePath.replace(resolvedPath + "/", "");
    const stat = statSync(filePath);
    const content = readFileSync(filePath, "utf-8");
    const lineCount = content.split("\n").length;
    const lastModified = stat.mtime;
    const daysSinceModified = Math.floor(
      (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24)
    );

    files.push({
      path: relativePath,
      lines: lineCount,
      lastModified,
      daysSinceModified,
    });

    // Check 1: File references
    checkFileReferences(content, relativePath, resolvedPath, warnings);

    // Check 2: Framework version
    checkFrameworkVersion(content, relativePath, warnings);

    // Check 3 & 4: Size
    const isRoot = relativePath === "CLAUDE.md";
    const limit = isRoot ? ROOT_SIZE_LIMIT : SUBDIR_SIZE_LIMIT;
    if (lineCount > limit) {
      warnings.push({
        id: `SIZE-${relativePath}`,
        severity: isRoot ? "warning" : "info",
        file: relativePath,
        line: 0,
        message: `${lineCount} lines (limit: ${limit})`,
      });
    }

    // Check 5: Age
    if (daysSinceModified > AGE_THRESHOLD_DAYS) {
      warnings.push({
        id: `AGE-${relativePath}`,
        severity: "info",
        file: relativePath,
        line: 0,
        message: `Last modified ${daysSinceModified} days ago (>${AGE_THRESHOLD_DAYS} days — consider reviewing)`,
      });
    }
  }

  // Load baseline for suppression
  const baseline = loadBaseline(resolvedPath);
  const suppressed = baseline?.accepted_debt ?? [];
  const activeWarnings = warnings.filter((w) => !suppressed.includes(w.id));

  return {
    projectPath: resolvedPath,
    files,
    warnings,
    suppressed,
    activeWarnings,
  };
}

/**
 * Accept (suppress) a warning by ID. Persists to baseline file.
 */
export function acceptWarning(projectPath: string, warningId: string): void {
  const resolvedPath = resolve(projectPath);
  const baselinePath = join(resolvedPath, BASELINE_FILE);
  const baseline = loadBaseline(resolvedPath) ?? {
    last_audited_at: new Date().toISOString(),
    accepted_debt: [],
  };

  if (!baseline.accepted_debt.includes(warningId)) {
    baseline.accepted_debt.push(warningId);
  }
  baseline.last_audited_at = new Date().toISOString();

  // Ensure .endiorbot/ directory exists
  const dir = dirname(baselinePath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
}

// ============================================================================
// Check implementations
// ============================================================================

/**
 * Check 1: Find file/directory references in CLAUDE.md and verify they exist.
 * Matches patterns like `src/path/to/file.ts`, `docs/01-planning/`, etc.
 */
function checkFileReferences(
  content: string,
  claudeMdPath: string,
  projectRoot: string,
  warnings: AuditWarning[]
): void {
  const lines = content.split("\n");
  // Match backtick-wrapped or markdown-link paths that look like file references
  const pathPattern =
    /(?:`([^`]+\.[a-z]{1,5})`|`([^`]+\/)`|\[.*?\]\(([^)]+)\))/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    let match: RegExpExecArray | null;
    pathPattern.lastIndex = 0;
    while ((match = pathPattern.exec(line)) !== null) {
      const ref = match[1] ?? match[2] ?? match[3];
      if (typeof ref !== "string") continue;

      // Skip URLs, anchors, and known non-file patterns
      if (
        ref.startsWith("http") ||
        ref.startsWith("#") ||
        ref.startsWith("mailto:")
      )
        continue;
      // Skip shell commands and variable-like patterns
      if (ref.includes("$") || ref.includes("&&") || ref.includes("|"))
        continue;
      // Skip patterns that are clearly not files
      if (ref.includes("*") || ref.startsWith("-")) continue;
      // Skip relative parent refs
      if (ref.startsWith("..")) continue;
      // Skip bare filenames without path separators — convention examples, not file refs
      if (!ref.includes("/") && !ref.startsWith(".")) continue;

      // Resolve relative to both project root AND the file's own directory
      const fromRoot = join(projectRoot, ref);
      const fromFileDir = join(projectRoot, dirname(claudeMdPath), ref);
      if (!existsSync(fromRoot) && !existsSync(fromFileDir)) {
        warnings.push({
          id: `REF-${claudeMdPath}:${i + 1}`,
          severity: "warning",
          file: claudeMdPath,
          line: i + 1,
          message: `References \`${ref}\` (not found on disk)`,
        });
      }
    }
  }
}

/**
 * Check 2: Find outdated framework version references.
 */
function checkFrameworkVersion(
  content: string,
  claudeMdPath: string,
  warnings: AuditWarning[]
): void {
  const lines = content.split("\n");
  // Match version patterns like 6.3.0, 6.2.0, etc. (but not the current version)
  const versionPattern = /\b(\d+\.\d+\.\d+)\b/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    let match: RegExpExecArray | null;
    versionPattern.lastIndex = 0;
    while ((match = versionPattern.exec(line)) !== null) {
      const version = match[1];
      if (typeof version !== "string") continue;
      // Only flag framework-like versions (6.x.x) that are older than current
      if (
        version.startsWith("6.") &&
        version !== FRAMEWORK_VERSION &&
        version < FRAMEWORK_VERSION
      ) {
        warnings.push({
          id: `VER-${claudeMdPath}:${i + 1}`,
          severity: "warning",
          file: claudeMdPath,
          line: i + 1,
          message: `References framework ${version} (current: ${FRAMEWORK_VERSION})`,
        });
      }
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Find all CLAUDE.md files in project (root + subdirs, max depth 3).
 */
function findClaudeMdFiles(projectPath: string): string[] {
  const results: string[] = [];
  const rootFile = join(projectPath, "CLAUDE.md");
  if (existsSync(rootFile)) results.push(rootFile);

  // Scan common subdirs for CLAUDE.md (same dirs as layered generation)
  const subdirs = [
    "src",
    "docs",
    "tests",
    "test",
    "lib",
    "packages",
    "apps",
    "services",
  ];
  for (const subdir of subdirs) {
    const subdirFile = join(projectPath, subdir, "CLAUDE.md");
    if (existsSync(subdirFile)) results.push(subdirFile);
  }

  // Also check .claude/ directory
  const dotClaudeFile = join(projectPath, ".claude", "CLAUDE.md");
  if (existsSync(dotClaudeFile)) results.push(dotClaudeFile);

  return results;
}

/**
 * Load audit baseline from .endiorbot/audit-baseline.json.
 */
function loadBaseline(projectPath: string): AuditBaseline | null {
  const baselinePath = join(projectPath, BASELINE_FILE);
  if (!existsSync(baselinePath)) return null;

  try {
    return JSON.parse(readFileSync(baselinePath, "utf-8")) as AuditBaseline;
  } catch {
    return null;
  }
}
