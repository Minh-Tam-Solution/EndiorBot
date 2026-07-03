/**
 * Structure Generator
 *
 * Generates project structure (docs/, .claude/, root files).
 *
 * @module sdlc/scaffold/structure-generator
 * @version 1.0.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 61
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, statSync, readdirSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { createLogger } from "../../logging/index.js";
import type {
  ScaffoldConfig,
  ScaffoldResult,
  StepResult,
  ProjectConfig,
  ProjectTier,
} from "./types.js";
import type { ProjectSnapshot } from "../compliance/fix-types.js";
import { TIER_STAGES, TIER_SUBDIR_CLAUDE_MD } from "./types.js";
import {
  generateSdlcConfig,
  serializeSdlcConfig,
  generateClaudeMd,
  generateSubdirClaudeMd,
  generatePluginManifest,
  generateCommandsReadme,
  generateSkillsReadme,
  generateIdentityMd,
  generateAgentsMd,
} from "./templates/index.js";
import { getStageQuestion, formatStageName } from "./tier-detector.js";
import {
  STAGE_GATE_MAP,
  STAGE_UPSTREAM,
  STAGE_QUESTIONS,
  getAgentForStage,
} from "../compliance/fix-types.js";
import { STAGE_CONTENT_REQUIREMENTS } from "../compliance/content-checker.js";

const logger = createLogger("structure-generator");

// ============================================================================
// Main Scaffold Function
// ============================================================================

/**
 * Scaffold a project with SDLC structure.
 */
export async function scaffoldProject(
  config: ScaffoldConfig
): Promise<ScaffoldResult> {
  const startTime = Date.now();
  const steps: StepResult[] = [];

  logger.info("Starting project scaffold", {
    project: config.projectName,
    tier: config.tier,
    dryRun: config.dryRun,
  });

  const projectConfig: ProjectConfig = {
    id: slugify(config.projectName),
    name: config.projectName,
    description: config.projectDescription ?? "",
    tier: config.tier,
    frameworkVersion: "6.4.0",
  };

  try {
    // Step 1: Create .sdlc-config.json
    steps.push(
      await executeStep(
        "Create .sdlc-config.json",
        join(config.targetPath, ".sdlc-config.json"),
        () => serializeSdlcConfig(generateSdlcConfig(projectConfig, config.snapshot)),
        config
      )
    );

    // Step 2: Create CLAUDE.md
    steps.push(
      await executeStep(
        "Generate CLAUDE.md",
        join(config.targetPath, "CLAUDE.md"),
        () => generateClaudeMd(projectConfig, config.snapshot),
        config
      )
    );

    // Step 2b: Create subdirectory CLAUDE.md files (Sprint 150, ADR-055)
    const subdirs = TIER_SUBDIR_CLAUDE_MD[config.tier] ?? [];
    for (const subdir of subdirs) {
      const subdirPath = join(config.targetPath, subdir);
      steps.push(
        await executeStep(
          `Generate ${subdir}/CLAUDE.md`,
          join(subdirPath, "CLAUDE.md"),
          () => generateSubdirClaudeMd(subdir, projectConfig, config.targetPath, config.snapshot),
          config
        )
      );
    }

    // Step 2c: ENTERPRISE — per-service CLAUDE.md files
    if (config.tier === "ENTERPRISE") {
      const serviceDirs = detectServiceDirs(config.targetPath);
      for (const serviceDir of serviceDirs) {
        steps.push(
          await executeStep(
            `Generate ${serviceDir}/CLAUDE.md`,
            join(config.targetPath, serviceDir, "CLAUDE.md"),
            () => generateSubdirClaudeMd(serviceDir, projectConfig, config.targetPath, config.snapshot),
            config
          )
        );
      }
    }

    // Step 3: Plugin scaffold (STANDARD+ only, Sprint 151, ADR-056)
    if (shouldCreateForTier(config.tier, "STANDARD")) {
      steps.push(
        await executeStep(
          "Generate .claude-plugin/plugin.json",
          join(config.targetPath, ".claude-plugin", "plugin.json"),
          () => generatePluginManifest(projectConfig, config.snapshot),
          config
        )
      );

      steps.push(
        await executeStep(
          "Generate commands/README.md",
          join(config.targetPath, "commands", "README.md"),
          () => generateCommandsReadme(projectConfig),
          config
        )
      );

      steps.push(
        await executeStep(
          "Generate skills/README.md",
          join(config.targetPath, "skills", "README.md"),
          () => generateSkillsReadme(projectConfig),
          config
        )
      );
    }

    // Step 4: Create IDENTITY.md
    steps.push(
      await executeStep(
        "Generate IDENTITY.md",
        join(config.targetPath, "IDENTITY.md"),
        () => generateIdentityMd(projectConfig, config.snapshot),
        config
      )
    );

    // Step 4: Create AGENTS.md (STANDARD+)
    if (shouldCreateForTier(config.tier, "STANDARD")) {
      steps.push(
        await executeStep(
          "Generate AGENTS.md",
          join(config.targetPath, "AGENTS.md"),
          () => generateAgentsMd(projectConfig),
          config
        )
      );
    }

    // Step 5: Create docs/ structure
    const docsSteps = await createDocsStructure(config, projectConfig, config.snapshot);
    steps.push(...docsSteps);

    // Step 6: Create .claude/ structure
    const claudeSteps = await createClaudeStructure(config);
    steps.push(...claudeSteps);

    // Step 7: Update .gitignore
    const gitignoreStep = await updateGitignore(config.targetPath, config);
    steps.push(gitignoreStep);

    const success = steps.every(
      (s) => s.status !== "error"
    );

    logger.info("Scaffold complete", {
      success,
      steps: steps.length,
      created: steps.filter((s) => s.status === "created").length,
      skipped: steps.filter((s) => s.status === "skipped").length,
    });

    return {
      steps,
      success,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error("Scaffold failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      steps,
      success: false,
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Step Execution
// ============================================================================

/**
 * Execute a single scaffold step.
 */
async function executeStep(
  name: string,
  filePath: string,
  contentFn: () => string,
  config: ScaffoldConfig
): Promise<StepResult> {
  const exists = existsSync(filePath);

  // Dry run mode
  if (config.dryRun) {
    return {
      name,
      path: filePath,
      status: exists ? "would-update" : "would-create",
    };
  }

  // Skip if exists and not forcing
  if (exists && !config.force) {
    // Check if content is same (skip update)
    const existingContent = readFileSync(filePath, "utf-8");
    const newContent = contentFn();

    if (hashContent(existingContent) === hashContent(newContent)) {
      return {
        name,
        path: filePath,
        status: "skipped",
      };
    }

    // Content differs - preserve existing
    return {
      name,
      path: filePath,
      status: "preserved",
    };
  }

  // Create or update
  try {
    const content = contentFn();
    ensureDir(dirname(filePath));
    writeFileSync(filePath, content, "utf-8");

    return {
      name,
      path: filePath,
      status: exists ? "updated" : "created",
    };
  } catch (error) {
    return {
      name,
      path: filePath,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Docs Structure
// ============================================================================

/**
 * Create docs/ structure for tier.
 */
async function createDocsStructure(
  config: ScaffoldConfig,
  projectConfig: ProjectConfig,
  snapshot?: ProjectSnapshot,
): Promise<StepResult[]> {
  const steps: StepResult[] = [];
  const docsPath = join(config.targetPath, "docs");
  const stages = TIER_STAGES[config.tier];

  for (const stage of stages) {
    const stagePath = join(docsPath, stage);

    // Create stage directory
    steps.push(
      await executeStep(
        `Create ${stage}/`,
        join(stagePath, "README.md"),
        () => generateStageReadme(stage, projectConfig, snapshot),
        config
      )
    );
  }

  return steps;
}

/**
 * Generate README for a stage directory.
 */
function generateStageReadme(
  stage: string,
  project: ProjectConfig,
  snapshot?: ProjectSnapshot,
): string {
  const name = formatStageName(stage);
  const question = STAGE_QUESTIONS[stage] ?? getStageQuestion(stage);

  const lines: string[] = [];

  lines.push(`# ${stage} - ${name}`);
  lines.push("");
  lines.push("## Purpose");
  lines.push("");
  if (question) lines.push(`**Key Question:** ${question}`);
  lines.push("");
  lines.push(`This stage contains documentation for the ${name.toLowerCase()} phase of ${project.name}.`);
  lines.push("");
  lines.push("---");

  // Test infrastructure section (Sprint 79 — snapshot-enriched)
  if (stage === "05-test" && snapshot) {
    const testInfra = buildTestInfraSection(snapshot);
    if (testInfra) lines.push(testInfra);
  }

  // Gate requirements checklist
  const gates = STAGE_GATE_MAP[stage] ?? [];
  if (gates.length > 0) {
    lines.push("");
    lines.push("## Quality Gate Requirements");
    lines.push("");
    lines.push(`This stage feeds gate(s): **${gates.join(", ")}**`);
    lines.push("");
    for (const gate of gates) {
      lines.push(`- [ ] **${gate}**: Document required evidence for this gate`);
    }
    lines.push("");
    lines.push("---");
  }

  // Upstream dependencies table
  const upstream = STAGE_UPSTREAM[stage] ?? [];
  if (upstream.length > 0) {
    lines.push("");
    lines.push("## Dependencies");
    lines.push("");
    lines.push("| Upstream Stage | What to Consume |");
    lines.push("|---------------|-----------------|");
    for (const up of upstream) {
      lines.push(`| [${up}](../${up}/) | Cite specific artifacts from this stage |`);
    }
    lines.push("");
    lines.push("---");
  }

  // Artifact checklist from STAGE_CONTENT_REQUIREMENTS
  const requirements = STAGE_CONTENT_REQUIREMENTS[stage];
  if (requirements) {
    const owner = getAgentForStage(stage, project.tier);
    lines.push("");
    lines.push("## Artifact Checklist");
    lines.push("");
    lines.push("| Artifact | Required | Status | Owner |");
    lines.push("|----------|----------|--------|-------|");
    for (const artifact of requirements.requiredArtifacts) {
      lines.push(`| \`${artifact}\` | ✅ Required | [ ] Pending | @${owner} |`);
    }
    for (const artifact of (requirements.optionalArtifacts ?? []).slice(0, 4)) {
      lines.push(`| \`${artifact}\` | ⬜ Optional | [ ] — | — |`);
    }
    lines.push("");
    lines.push("---");
  }

  lines.push("");
  lines.push(`*Generated by EndiorBot - SDLC Framework v${project.frameworkVersion}*`);

  return lines.join("\n") + "\n";
}

/**
 * Build test infrastructure section for 05-test stage README.
 */
function buildTestInfraSection(snapshot: ProjectSnapshot): string {
  const scripts = snapshot.techStack.scripts ?? {};
  const pm = snapshot.techStack.packageManager ?? "pnpm";

  const testCmd = scripts["test"] ?? scripts["test:unit"] ?? null;
  const e2eFiles = snapshot.testFiles.filter((f) => f.type === "e2e");
  const unitFiles = snapshot.testFiles.filter((f) => f.type === "unit" || f.type === "unknown");

  const infra: string[] = [];
  if (testCmd) infra.push(`- Test command: \`${pm} run test\``);

  const deps = [...snapshot.techStack.dependencies, ...snapshot.techStack.devDependencies];
  if (deps.includes("playwright") || deps.includes("@playwright/test")) {
    infra.push(`- **Playwright** (e2e): ${e2eFiles.length} test file(s) detected`);
  }
  if (deps.includes("vitest") || deps.includes("jest")) {
    const fw = deps.includes("vitest") ? "Vitest" : "Jest";
    infra.push(`- **${fw}** (unit): ${unitFiles.length} test file(s) detected`);
  } else if (unitFiles.length > 0) {
    infra.push(`- Unit tests: ${unitFiles.length} test file(s) detected`);
  }

  if (infra.length === 0) return "";

  return `\n## Detected Test Infrastructure\n\n${infra.join("\n")}\n\n---\n`;
}

// ============================================================================
// Claude Structure
// ============================================================================

/**
 * Create .claude/ structure.
 */
async function createClaudeStructure(
  config: ScaffoldConfig
): Promise<StepResult[]> {
  const steps: StepResult[] = [];
  const claudePath = join(config.targetPath, ".claude");

  // Create commands/
  steps.push(
    await executeStep(
      "Create .claude/commands/gate.md",
      join(claudePath, "commands", "gate.md"),
      () => generateGateCommand(),
      config
    )
  );

  steps.push(
    await executeStep(
      "Create .claude/commands/consult.md",
      join(claudePath, "commands", "consult.md"),
      () => generateConsultCommand(),
      config
    )
  );

  // Create hooks/
  const preToolStep = await executeStep(
    "Create .claude/hooks/pre-tool-use.sh",
    join(claudePath, "hooks", "pre-tool-use.sh"),
    () => generatePreToolUseHook(),
    config
  );
  steps.push(preToolStep);
  if (preToolStep.status === "created" || preToolStep.status === "updated") {
    chmodSync(join(claudePath, "hooks", "pre-tool-use.sh"), 0o755);
  }

  // PostToolUse tracker hook (Sprint 154)
  const postToolStep = await executeStep(
    "Create .claude/hooks/post-tool-use-tracker.sh",
    join(claudePath, "hooks", "post-tool-use-tracker.sh"),
    () => generatePostToolUseTracker(),
    config
  );
  steps.push(postToolStep);
  if (postToolStep.status === "created" || postToolStep.status === "updated") {
    chmodSync(join(claudePath, "hooks", "post-tool-use-tracker.sh"), 0o755);
  }

  // Stop suggest hook (Sprint 154)
  const stopStep = await executeStep(
    "Create .claude/hooks/stop-suggest.sh",
    join(claudePath, "hooks", "stop-suggest.sh"),
    () => generateStopSuggestHook(),
    config
  );
  steps.push(stopStep);
  if (stopStep.status === "created" || stopStep.status === "updated") {
    chmodSync(join(claudePath, "hooks", "stop-suggest.sh"), 0o755);
  }

  // Create settings.json
  steps.push(
    await executeStep(
      "Create .claude/settings.json",
      join(claudePath, "settings.json"),
      () => generateClaudeSettings(),
      config
    )
  );

  return steps;
}

/**
 * Generate gate command.
 */
function generateGateCommand(): string {
  return `---
description: Check SDLC gate status
model: sonnet
---

# Gate Command

Check SDLC gate status using EndiorBot.

## Usage

\`\`\`
/project:gate status
/project:gate check G2
/project:gate recommend G3
\`\`\`

## Implementation

\`\`\`bash
# Thin client pattern - call EndiorBot core
./endiorbot.mjs gate "$@"
\`\`\`
`;
}

/**
 * Generate consult command.
 */
function generateConsultCommand(): string {
  return `---
description: Multi-model consultation
model: sonnet
---

# Consult Command

Query multiple AI models for consensus on decisions.

## Usage

\`\`\`
/project:consult "Should we use PostgreSQL or MongoDB?"
\`\`\`

## Implementation

\`\`\`bash
# Thin client pattern - call EndiorBot core
./endiorbot.mjs consult "$@"
\`\`\`
`;
}

/**
 * Generate pre-tool-use hook.
 */
function generatePreToolUseHook(): string {
  return `#!/bin/bash
# Pre-Tool-Use Hook - Secret Guard
#
# Blocks access to sensitive files
# INVARIANT: Hooks receive JSON via stdin

INPUT=$(cat /dev/stdin)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty')

# Block sensitive files
BLOCKED_PATTERNS=(
  ".env"
  ".env.*"
  "*.pem"
  "*.key"
  "*credentials*"
  "*secret*"
)

for pattern in "\${BLOCKED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == $pattern ]]; then
    echo "BLOCKED: Access to sensitive file pattern: $pattern"
    exit 1
  fi
done

exit 0
`;
}

/**
 * Generate PostToolUse tracker hook (Sprint 154, Plan U5).
 * Tracks files changed by Write/Edit/NotebookEdit tools.
 * Accumulates paths in session temp file for stop-suggest to read.
 */
function generatePostToolUseTracker(): string {
  return `#!/bin/bash
# Post-Tool-Use Tracker — Accumulate changed file paths
#
# Tracks Write, Edit, NotebookEdit tools to build a session change log.
# Output consumed by stop-suggest.sh at session end.
# Sprint 154 — Hook Self-Improvement (Plan U5)

INPUT=$(cat /dev/stdin)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only track file-modifying tools
case "$TOOL_NAME" in
  Write|Edit|NotebookEdit)
    if [ -n "$FILE_PATH" ]; then
      SESSION_FILE="/tmp/.endiorbot-session-\$\$"
      echo "$FILE_PATH" >> "$SESSION_FILE"
    fi
    ;;
esac

exit 0
`;
}

/**
 * Generate Stop suggest hook (Sprint 154, Plan U5).
 * Reads accumulated file changes and generates CLAUDE.md update suggestions.
 * Falls back to git diff if session tracker file is missing.
 */
function generateStopSuggestHook(): string {
  return `#!/bin/bash
# Stop Suggest — Propose CLAUDE.md updates based on session changes
#
# Reads files changed during session, suggests CLAUDE.md updates.
# Falls back to git diff when session tracker file is missing.
# Output: .endiorbot/audit-suggestions.md
# Sprint 154 — Hook Self-Improvement (Plan U5)

SESSION_FILE="/tmp/.endiorbot-session-\$\$"
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
SUGGESTIONS_DIR="$PROJECT_ROOT/.endiorbot"
SUGGESTIONS_FILE="$SUGGESTIONS_DIR/audit-suggestions.md"

# Collect changed files
CHANGED_FILES=""
if [ -f "$SESSION_FILE" ]; then
  CHANGED_FILES=$(sort -u "$SESSION_FILE")
  rm -f "$SESSION_FILE"
else
  # Fallback: git diff
  CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || true)
fi

# Exit early if no changes
if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# Analyze changes and generate suggestions
mkdir -p "$SUGGESTIONS_DIR"
{
  echo "# CLAUDE.md Update Suggestions"
  echo ""
  echo "> Auto-generated by EndiorBot stop hook — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""

  # Check for new directories that might need CLAUDE.md
  echo "$CHANGED_FILES" | while IFS= read -r file; do
    dir=$(dirname "$file")
    # Check if it's a new top-level source directory
    case "$dir" in
      src/*|lib/*|packages/*|apps/*|services/*)
        # Get first-level subdir under src/
        top_dir=$(echo "$dir" | cut -d/ -f1-2)
        if [ ! -f "$PROJECT_ROOT/$top_dir/CLAUDE.md" ] && [ -d "$PROJECT_ROOT/$top_dir" ]; then
          echo "- **New directory** \`$top_dir/\` — consider adding \`$top_dir/CLAUDE.md\` with local conventions"
        fi
        ;;
    esac
  done | sort -u

  # Check if many test files changed
  TEST_COUNT=$(echo "$CHANGED_FILES" | grep -cE '(test|spec)\.' || true)
  if [ "$TEST_COUNT" -gt 3 ]; then
    echo "- **Test patterns changed** ($TEST_COUNT files) — review \`tests/CLAUDE.md\` test conventions"
  fi

  # Check if package deps changed
  if echo "$CHANGED_FILES" | grep -qE '(package\.json|requirements\.txt|go\.mod|Cargo\.toml)'; then
    echo "- **Dependencies changed** — review root \`CLAUDE.md\` dependency notes"
  fi

  echo ""
  echo "Run \`endiorbot audit-claude-md\` for a full health check."
} > "$SUGGESTIONS_FILE"

exit 0
`;
}

/**
 * Generate Claude settings.
 */
function generateClaudeSettings(): string {
  // Sprint 136 hook-case fix (2026-04-18): Claude Code CLI expects PascalCase
  // hook event names (PreToolUse, PostToolUse, etc.). The earlier camelCase
  // (preToolUse) was silently ignored, causing scaffolded projects to report
  // "Invalid Settings" on `claude doctor`. See BetterBox-TTS field report.
  return JSON.stringify(
    {
      hooks: {
        PreToolUse: ".claude/hooks/pre-tool-use.sh",
        PostToolUse: ".claude/hooks/post-tool-use-tracker.sh",
        Stop: ".claude/hooks/stop-suggest.sh",
      },
      commands: {
        gate: ".claude/commands/gate.md",
        consult: ".claude/commands/consult.md",
      },
    },
    null,
    2
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert string to slug format.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Ensure directory exists.
 */
function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Hash content for comparison.
 */
function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Check if feature should be created for tier.
 */
function shouldCreateForTier(
  actualTier: ProjectTier,
  requiredTier: ProjectTier
): boolean {
  const order: Record<ProjectTier, number> = {
    LITE: 0,
    STANDARD: 1,
    PROFESSIONAL: 2,
    ENTERPRISE: 3,
  };
  return order[actualTier] >= order[requiredTier];
}

// ============================================================================
// Service Directory Detection (ENTERPRISE tier, Sprint 150)
// ============================================================================

/**
 * Detect per-service directories for ENTERPRISE tier subdir CLAUDE.md.
 * Checks packages/, apps/, services/ and package.json workspaces.
 */
function detectServiceDirs(targetPath: string): string[] {
  const patterns = ["packages", "apps", "services"];
  const results: string[] = [];

  for (const pattern of patterns) {
    const dir = join(targetPath, pattern);
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        try {
          if (statSync(full).isDirectory()) {
            results.push(join(pattern, entry));
          }
        } catch {
          // Skip unreadable entries
        }
      }
    }
  }

  // Also check package.json workspaces
  const pkgPath = join(targetPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
        workspaces?: string[] | { packages?: string[] };
      };
      const ws = pkg.workspaces;
      if (Array.isArray(ws)) {
        for (const pattern of ws) {
          const base = pattern.replace("/*", "").replace("/**", "");
          const dir = join(targetPath, base);
          if (existsSync(dir) && statSync(dir).isDirectory()) {
            for (const entry of readdirSync(dir)) {
              const full = join(dir, entry);
              try {
                if (statSync(full).isDirectory()) {
                  results.push(join(base, entry));
                }
              } catch {
                // Skip unreadable entries
              }
            }
          }
        }
      } else if (ws?.packages) {
        for (const pattern of ws.packages) {
          const base = pattern.replace("/*", "").replace("/**", "");
          const dir = join(targetPath, base);
          if (existsSync(dir) && statSync(dir).isDirectory()) {
            for (const entry of readdirSync(dir)) {
              const full = join(dir, entry);
              try {
                if (statSync(full).isDirectory()) {
                  results.push(join(base, entry));
                }
              } catch {
                // Skip unreadable entries
              }
            }
          }
        }
      }
    } catch {
      // Ignore malformed package.json
    }
  }

  return [...new Set(results)];
}

// ============================================================================
// Backup Functions
// ============================================================================

/**
 * Create backup of existing files before force overwrite.
 */
export async function createBackup(
  projectPath: string,
  files: string[]
): Promise<string> {
  const backupDir = join(projectPath, ".endiorbot", "backups", String(Date.now()));
  ensureDir(backupDir);

  for (const file of files) {
    const srcPath = join(projectPath, file);
    // Skip directories - only copy files
    if (existsSync(srcPath) && !statSync(srcPath).isDirectory()) {
      const destPath = join(backupDir, file);
      ensureDir(dirname(destPath));
      copyFileSync(srcPath, destPath);
    }
  }

  logger.info("Backup created", { path: backupDir, files: files.length });
  return backupDir;
}

// ============================================================================
// Gitignore Update
// ============================================================================

/** Lines to add to .gitignore */
const GITIGNORE_ENTRIES = [
  "# Claude Code / EndiorBot",
  ".claude/",
  ".endiorbot/",
  // Sprint 138 P3-03: no trailing slash so the pattern matches both
  // symlinks (e.g. .sdlc-framework → shared-framework-repo) and plain
  // directories produced by `endiorbot init`.
  ".sdlc-framework",
  "",
];

/**
 * Update .gitignore with Claude/EndiorBot entries.
 */
export async function updateGitignore(
  projectPath: string,
  config: ScaffoldConfig
): Promise<StepResult> {
  const gitignorePath = join(projectPath, ".gitignore");

  // Dry-run mode
  if (config.dryRun) {
    const exists = existsSync(gitignorePath);
    return {
      name: "Update .gitignore",
      path: gitignorePath,
      status: exists ? "would-update" : "would-create",
    };
  }

  try {
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, "utf-8");

      // Check if already has our entries
      if (content.includes(".claude/") && content.includes(".endiorbot/")) {
        return {
          name: "Update .gitignore",
          path: gitignorePath,
          status: "skipped",
        };
      }

      // Append missing entries
      const linesToAdd = GITIGNORE_ENTRIES.filter(
        (line) => line.trim() === "" || !content.includes(line)
      );

      if (linesToAdd.length > 0) {
        const appendContent = "\n" + linesToAdd.join("\n");
        writeFileSync(gitignorePath, content + appendContent, "utf-8");
        return {
          name: "Update .gitignore",
          path: gitignorePath,
          status: "updated",
        };
      }

      return {
        name: "Update .gitignore",
        path: gitignorePath,
        status: "skipped",
      };
    } else {
      // Create new .gitignore
      writeFileSync(gitignorePath, GITIGNORE_ENTRIES.join("\n") + "\n", "utf-8");
      return {
        name: "Create .gitignore",
        path: gitignorePath,
        status: "created",
      };
    }
  } catch (error) {
    return {
      name: "Update .gitignore",
      path: gitignorePath,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
