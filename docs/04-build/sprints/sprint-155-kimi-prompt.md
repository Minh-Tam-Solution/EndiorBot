# Sprint 155 — Kimi Execution Prompt

## Context

You are implementing Sprint 155 for EndiorBot — 4 accuracy fixes discovered by field-testing `endiorbot init/skills/audit-claude-md` against a Python + Docker + Next.js project (DeepTutor). Design approved in ADR-057.

**Project:** `/Users/dttai/Documents/Python/01.NQH/EndiorBot`
**Build:** `pnpm build` (must be 0 errors)
**Test:** `pnpm test` (all must pass)
**TypeScript rule:** `exactOptionalPropertyTypes` is ON — never assign `undefined` to optional properties. Use conditional assignment: build object first, then `if (value) obj.field = value`.

---

## Fix 1: Docker Ecosystem — Include Root Language Markers

**File:** `src/cli/commands/ecosystem-detector.ts`

### What to change

The `scanSubEcosystems()` function (line ~292-311) only scans hardcoded subdirs (`backend`, `frontend`, `web`, etc.). When Docker is detected, root-level language markers (pyproject.toml, Cargo.toml, go.mod, package.json) are ignored. This causes a Python project with Docker to report `language: "TypeScript"` if only `web/` has tsconfig.json.

### How to fix

1. Add a root marker check at the **beginning** of `scanSubEcosystems()`. Check root-level markers in priority order:
   - `pyproject.toml` or `requirements.txt` → `{ dir: ".", language: "Python", markerFile: "pyproject.toml" }`
   - `Cargo.toml` → `{ dir: ".", language: "Rust", markerFile: "Cargo.toml" }`
   - `go.mod` → `{ dir: ".", language: "Go", markerFile: "go.mod" }`
   - `package.json` → `{ dir: ".", language: hasTS ? "TypeScript" : "JavaScript", markerFile: "package.json" }`

2. When joining language labels in `detectEcosystem()` (line ~103), **deduplicate** languages. If root reports "Python" and `web/` reports "TypeScript", result is `"Python + TypeScript"`. If root reports "Python" and `backend/` also reports "Python", result is just `"Python"`.

Example dedup logic:
```typescript
const allLangs = subEcosystems.map(s => s.language);
const uniqueLangs = [...new Set(allLangs)];
const langLabel = uniqueLangs.length > 0 ? uniqueLangs.join(" + ") : "Multi-language";
```

### Tests to add/update

File: `tests/cli/ecosystem-detector.test.ts` (or create if doesn't exist)

```
- "Docker project with root Python + sub TypeScript → language: Python + TypeScript"
- "Docker project with root Python + sub Python → language: Python (no duplicate)"
- "Docker project with no sub-ecosystems → language: Multi-language (unchanged)"
- "Non-Docker project → scanSubEcosystems not called (unchanged behavior)"
```

---

## Fix 2: Ecosystem-Aware Commands in CLAUDE.md Template

**Files:**
- `src/sdlc/compliance/project-context-collector.ts` — add `ecosystem` field
- `src/sdlc/scaffold/templates/claude-md.ts` — ecosystem-aware commands

### Step 2a: Add `ecosystem` to TechStackInfo

In `src/sdlc/compliance/fix-types.ts` (or wherever `TechStackInfo` is defined), add:
```typescript
ecosystem?: string;  // "node" | "python" | "rust" | "docker" | "go" | "java"
```

In `src/sdlc/compliance/project-context-collector.ts`, around line 117-127, add:
```typescript
const info: TechStackInfo = {
  language: eco.language,
  hasTypeScript,
  hasDocker,
  hasCI,
  dependencies: Object.keys(pkg.dependencies),
  devDependencies: Object.keys(pkg.devDependencies),
  scripts: pkg.scripts,
};
// NEW: pass ecosystem through
if (eco.ecosystem) info.ecosystem = eco.ecosystem;
if (eco.packageManager) info.packageManager = eco.packageManager;
```

### Step 2b: Ecosystem-aware commands

In `src/sdlc/scaffold/templates/claude-md.ts`, replace the `getCommandsSection()` function:

1. When `snapshot` is present, check `snapshot.techStack.ecosystem`:
   - If ecosystem is `"python"`: generate pip/pytest commands
   - If ecosystem is `"rust"`: generate cargo commands  
   - If ecosystem is `"docker"`: generate docker compose commands
   - If ecosystem is `"node"` (or undefined for backward compat): use existing script-detection logic
   - If ecosystem is `"go"` or `"java"`: generate basic known commands

2. The ecosystem command map:

```typescript
function getEcosystemFallbackCommands(ecosystem: string, pm?: string): string[] {
  switch (ecosystem) {
    case "python":
      if (pm === "poetry") {
        return [
          "poetry install      # Install dependencies",
          "poetry run pytest    # Run tests",
          "poetry run ruff check .  # Lint",
        ];
      }
      return [
        "pip install -r requirements.txt  # Install dependencies",
        "pytest               # Run tests",
        "ruff check .         # Lint (if configured)",
      ];
    case "rust":
      return [
        "cargo build          # Build project",
        "cargo test           # Run tests",
        "cargo clippy          # Lint",
      ];
    case "docker":
      return [
        "docker compose build  # Build containers",
        "docker compose up     # Start services",
        "docker compose down   # Stop services",
      ];
    case "go":
      return [
        "go build ./...       # Build",
        "go test ./...        # Run tests",
        "go vet ./...         # Lint",
      ];
    default:
      return [];  // fall through to GENERIC_COMMANDS_SECTION
  }
}
```

3. In `getCommandsSection()`, after checking for Node.js scripts, add ecosystem fallback:

```typescript
function getCommandsSection(snapshot?: ProjectSnapshot): string {
  if (!snapshot) return GENERIC_COMMANDS_SECTION;

  const pm = snapshot.techStack.packageManager ?? "pnpm";
  const ecosystem = snapshot.techStack.ecosystem;
  const scripts = snapshot.techStack.scripts ?? {};

  // For non-Node ecosystems, use ecosystem-specific commands
  if (ecosystem && ecosystem !== "node") {
    const ecoLines = getEcosystemFallbackCommands(ecosystem, pm);
    if (ecoLines.length > 0) {
      return `## Commands

### Development
\`\`\`bash
${ecoLines.join("\n")}
\`\`\`

### EndiorBot CLI
\`\`\`bash
endiorbot gate status      # Show gate status
endiorbot consult <query>  # Multi-model query
endiorbot compliance check # SDLC compliance
\`\`\``;
    }
  }

  // Node.js: use detected scripts (existing logic)
  // ... rest of existing code unchanged
}
```

**IMPORTANT:** Also update the EndiorBot CLI block — replace `./endiorbot.mjs` with `endiorbot` (user has alias configured).

### Tests

File: `tests/sdlc/scaffold/templates.test.ts` (update existing)

```
- "Python project → CLAUDE.md shows pip/pytest commands"
- "Docker project → CLAUDE.md shows docker compose commands"
- "Rust project → CLAUDE.md shows cargo commands"
- "Node.js project → existing pnpm/npm behavior preserved"
- "No snapshot → generic fallback (backward compat)"
```

---

## Fix 3: Root SKILL.md Discovery

**File:** `src/sdlc/scaffold/plugin-loader.ts`

### What to change

1. Update `DiscoveredSkill.source` type from `"folder" | "flat"` to `"root" | "folder" | "flat"`.

2. Add **Pass 0** at the beginning of `discoverSkills()`, before the existing Pass 1:

```typescript
export function discoverSkills(projectPath: string): DiscoveredSkill[] {
  const skills: DiscoveredSkill[] = [];
  const seen = new Set<string>();

  // Pass 0: Root SKILL.md (project-level skill, Anthropic standard)
  const rootSkillFile = join(projectPath, "SKILL.md");
  if (existsSync(rootSkillFile)) {
    const skill = loadSkill(rootSkillFile, "root");
    if (skill && !seen.has(skill.name)) {
      skills.push(skill);
      seen.add(skill.name);
    }
  }

  // Pass 1: folder-per-skill (existing code — unchanged)
  const skillsDir = join(projectPath, "skills");
  if (existsSync(skillsDir) && statSync(skillsDir).isDirectory()) {
    // ... existing Pass 1 code ...
    // ... existing Pass 2 code ...
  }

  // IMPORTANT: If skills/ folder has a skill with the same name as root,
  // skills/ wins (more specific). So we need to restructure:
  // Actually, since Pass 1/2 run AFTER Pass 0 and seen.has() blocks duplicates,
  // root would win. We need the OPPOSITE: skills/ should win.
  // 
  // Solution: Run Pass 1+2 first into a separate array, then merge with root at end.
  // Root only added if name not already in skills/ results.
```

**IMPORTANT dedup direction:** The ADR says "if `skills/<name>` conflicts with root name, skills/ wins." So restructure:

```typescript
export function discoverSkills(projectPath: string): DiscoveredSkill[] {
  const skills: DiscoveredSkill[] = [];
  const seen = new Set<string>();

  // Pass 1+2: skills/ directory (PRIORITY over root)
  const skillsDir = join(projectPath, "skills");
  if (existsSync(skillsDir) && statSync(skillsDir).isDirectory()) {
    // ... existing Pass 1 (folder-per-skill) code ...
    // ... existing Pass 2 (flat fallback) code ...
  }

  // Pass 0: Root SKILL.md (lowest priority — only if name not in skills/)
  const rootSkillFile = join(projectPath, "SKILL.md");
  if (existsSync(rootSkillFile)) {
    const skill = loadSkill(rootSkillFile, "root");
    if (skill && !seen.has(skill.name)) {
      skills.push(skill);
      seen.add(skill.name);
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  // ... rest unchanged
}
```

3. Update `src/cli/commands/skills.ts` display — add `📋` indicator for root source:

```typescript
const indicator = skill.source === "folder" ? "📁" : skill.source === "root" ? "📋" : "📄";
```

### Tests

File: `tests/sdlc/scaffold/plugin-loader.test.ts` (update existing)

```
- "Root SKILL.md discovered with source: root"
- "Root SKILL.md + skills/same-name → skills/ wins"
- "Root SKILL.md + skills/different-name → both discovered"
- "No root SKILL.md, no skills/ → empty array (unchanged)"
- "No root SKILL.md, skills/ exists → existing behavior preserved"
```

---

## Fix 4: Existence-Checked Path References in Subdir CLAUDE.md

**File:** `src/sdlc/scaffold/templates/claude-md.ts`

### What to change

1. Add `projectPath` parameter to `getDocsSection()`:

```typescript
function getDocsSection(_project: ProjectConfig, projectPath: string): string[] {
```

2. Add `projectPath` parameter to `generateSubdirClaudeMd()` signature:

```typescript
export function generateSubdirClaudeMd(
  subdir: string,
  project: ProjectConfig,
  projectPath: string,
  snapshot?: ProjectSnapshot
): string {
```

And pass it to `getDocsSection()`:
```typescript
case "docs": {
  lines.push(...getDocsSection(project, projectPath));
  break;
}
```

3. In `getDocsSection()`, replace unconditional stage list with existence check:

```typescript
function getDocsSection(_project: ProjectConfig, projectPath: string): string[] {
  const lines: string[] = [
    "## Documentation Standards",
    "",
    "### Structure",
    "- Use numbered stage folders (`00-foundation`, `01-planning`, ...).",
    "- Each stage README explains purpose, entry criteria, and exit gates.",
    "",
    "### ADRs",
    "- One ADR per major architectural decision.",
    "- Include YAML frontmatter with `authority` block.",
  ];

  // Only reference ADR path if it exists
  const adrPath = join(projectPath, "docs", "02-design", "01-ADRs");
  if (existsSync(adrPath)) {
    lines.push("- Reference: `docs/02-design/01-ADRs/`");
  }

  lines.push(
    "",
    "### Markdown Style",
    "- Use ATX-style headings (`#`).",
    "- Prefer tables for structured comparisons.",
    "- Link related docs with relative paths.",
    "",
    "### SDLC Stages (this project)",
  );

  // Only list stages that actually exist on disk
  const stageList = getTierStageList(_project.tier);
  const docsDir = join(projectPath, "docs");
  for (const stageLine of stageList) {
    // Extract folder name from "- `00-foundation/`" format
    const match = stageLine.match(/`([^`]+)\/?`/);
    if (match) {
      const stageDir = join(docsDir, match[1]);
      if (existsSync(stageDir)) {
        lines.push(stageLine);
      }
    }
  }

  return lines;
}
```

4. **IMPORTANT:** Update callers of `generateSubdirClaudeMd()` in `structure-generator.ts` to pass `projectPath`.

Search for all calls to `generateSubdirClaudeMd` and add the `projectPath` argument:
```typescript
// Before:
generateSubdirClaudeMd(subdir, projectConfig, snapshot)
// After:
generateSubdirClaudeMd(subdir, projectConfig, projectPath, snapshot)
```

5. Add import for `existsSync` and `join` at the top of `claude-md.ts`:
```typescript
import { existsSync } from "node:fs";
import { join } from "node:path";
```

### Tests

File: `tests/sdlc/scaffold/templates.test.ts` (update existing)

```
- "docs/CLAUDE.md only references existing stage dirs"
- "docs/CLAUDE.md with all stages present → all listed"
- "docs/CLAUDE.md with no stages → empty stage list, no warnings"
- "ADR path exists → referenced; ADR path missing → not referenced"
```

---

## Execution Order

1. **F1 first** — ecosystem-detector.ts (no dependencies)
2. **F2 second** — depends on TechStackInfo having `ecosystem` field
3. **F3 third** — plugin-loader.ts (independent)
4. **F4 fourth** — claude-md.ts (shares file with F2, do after)

## Build & Test Sequence

```bash
# After each fix:
pnpm build   # Must be 0 TypeScript errors
pnpm test    # All tests must pass

# After all fixes:
pnpm build && pnpm test

# Smoke test:
endiorbot skills --path /Users/dttai/Documents/Research/DeepTutor
endiorbot audit-claude-md --path /tmp/deeptutor-test
```

## Commit

```bash
git add src/cli/commands/ecosystem-detector.ts \
        src/sdlc/scaffold/templates/claude-md.ts \
        src/sdlc/scaffold/plugin-loader.ts \
        src/sdlc/compliance/project-context-collector.ts \
        src/sdlc/compliance/fix-types.ts \
        src/sdlc/scaffold/structure-generator.ts \
        src/cli/commands/skills.ts \
        tests/

git commit -m "fix(sdlc): improve init ecosystem accuracy — 4 detection & template fixes (Sprint 155, ADR-057)

- F1: Docker ecosystem includes root language markers (Python+TypeScript)
- F2: Ecosystem-aware commands in CLAUDE.md (pip/pytest not pnpm)
- F3: Root SKILL.md discovery (Pass 0, Anthropic standard)
- F4: Existence-checked path refs in subdir CLAUDE.md (0 false warnings)"
```

---

## Execution Summary

**Status:** ✅ COMPLETE (2026-06-23)
**Build:** `pnpm build` — 0 TypeScript errors
**Tests:** `pnpm test` — 8,223 passed, 10 skipped, 0 failed

### Files Changed
- `src/cli/commands/ecosystem-detector.ts` — F1 root markers + language dedup
- `src/sdlc/scaffold/templates/claude-md.ts` — F2 ecosystem commands + F4 existence-checked docs
- `src/sdlc/scaffold/structure-generator.ts` — F4 pass `projectPath` to subdir generator
- `src/sdlc/compliance/fix-types.ts` — F2 add `ecosystem` to `TechStackInfo`
- `src/sdlc/compliance/project-context-collector.ts` — F2 propagate `ecosystem` from detector
- `src/sdlc/scaffold/plugin-loader.ts` — F3 root SKILL.md discovery (skills/ wins on name conflict)
- `src/cli/commands/skills.ts` — F3 add 📋 indicator for root skills
- `docs/02-design/01-ADRs/ADR-057-init-ecosystem-accuracy.md` — design-doc sync (structured authority + ACCEPTED)
- `tests/cli/commands/ecosystem-detector.test.ts` — F1 coverage
- `tests/sdlc/scaffold/templates.test.ts` — F2 + F4 coverage
- `tests/sdlc/scaffold/plugin-loader.test.ts` — F3 coverage
