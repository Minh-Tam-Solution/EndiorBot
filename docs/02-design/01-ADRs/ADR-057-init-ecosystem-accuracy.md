---
status: ACCEPTED
authority:
  proposer: "@architect"
  countersigners:
    - actor: "@cto"
      date: "2026-04-19"
      grade: "8/10"
      reference: "Sprint 155"
  trigger: "endiorbot init on DeepTutor (Python+Docker+Next.js) produces wrong language, hardcoded pnpm commands, misses root SKILL.md, and references non-existent paths"
  notes: "4 accuracy bugs discovered by field-testing endiorbot against /Users/dttai/Documents/Research/DeepTutor/"
sdlc_framework: "6.4.0"
---

# ADR-057: Init Ecosystem Accuracy — 4 Detection & Template Fixes

## Context

Field-testing `endiorbot init` + `endiorbot audit-claude-md` + `endiorbot skills` against the DeepTutor repo (Python 288 files + Next.js 119 files + Docker) exposed 4 bugs:

| # | Symptom | Root Cause | Impact |
|---|---------|-----------|--------|
| F1 | `.sdlc-config.json` says `language: "TypeScript"` for a Python project | Docker ecosystem detected → `scanSubEcosystems()` finds `web/tsconfig.json` but ignores root `pyproject.toml` | Wrong language in config, wrong code patterns in subdir CLAUDE.md |
| F2 | CLAUDE.md shows `pnpm install/build/test` for a Python project | `getCommandsSection()` fallback is hardcoded pnpm; non-Node ecosystems always hit fallback | Misleading dev commands in generated CLAUDE.md |
| F3 | `endiorbot skills` returns "No skills found" despite root `SKILL.md` existing | `discoverSkills()` only scans `skills/` directory, not root | Anthropic-standard root SKILL.md invisible |
| F4 | `docs/CLAUDE.md` references `docs/02-design/01-ADRs/` (doesn't exist) | `getDocsSection()` emits all SDLC stage paths unconditionally + hardcoded sub-paths | 12 audit warnings on freshly-init'd project |

## Decision

### F1: Docker Ecosystem — Include Root Language in Detection

**Change:** `scanSubEcosystems()` in `ecosystem-detector.ts` also scans the **root** directory for language markers (pyproject.toml, Cargo.toml, go.mod, package.json) alongside subdirs.

**Before:** Docker → scans subdirs only → `language: "TypeScript"` (from web/)
**After:** Docker → scans root + subdirs → `language: "Python + TypeScript"` (root pyproject.toml + web/tsconfig.json)

The root scan uses the same marker priority as `detectEcosystem()` but reports language only (no ecosystem change — Docker remains the ecosystem).

### F2: Ecosystem-Aware Commands Section in CLAUDE.md

**Change:** `getCommandsSection()` in `claude-md.ts` generates ecosystem-appropriate commands based on `snapshot.techStack` ecosystem info, instead of falling back to hardcoded pnpm.

**Ecosystem command map:**
| Ecosystem | Install | Build | Test | Lint |
|-----------|---------|-------|------|------|
| node (pnpm) | `pnpm install` | `pnpm build` | `pnpm test` | `pnpm lint` |
| node (npm) | `npm install` | `npm run build` | `npm test` | `npm run lint` |
| python (pip) | `pip install -r requirements.txt` | — | `pytest` | `ruff check .` |
| python (poetry) | `poetry install` | — | `poetry run pytest` | `poetry run ruff check .` |
| rust | — | `cargo build` | `cargo test` | `cargo clippy` |
| docker | `docker compose build` | — | `docker compose run test` | — |

When snapshot is present, use its detected ecosystem. When absent, use generic fallback (existing behavior preserved).

### F3: Root SKILL.md Discovery

**Change:** `discoverSkills()` in `plugin-loader.ts` adds **Pass 0** — check for root-level `SKILL.md` before scanning `skills/` directory.

Discovery order:
1. **Pass 0:** Root `SKILL.md` (project-level skill, Anthropic standard)
2. **Pass 1:** `skills/<name>/SKILL.md` (folder-per-skill, priority)
3. **Pass 2:** `skills/*.md` (flat fallback)

Root SKILL.md gets `source: "root"` in `DiscoveredSkill`. Dedup rule: if `skills/` contains a skill with the same name as root, `skills/` wins (more specific).

### F4: Existence-Checked Path References in Subdir CLAUDE.md

**Change:** `getDocsSection()` in `claude-md.ts` checks `existsSync()` before emitting path references. Only lists paths that actually exist on disk.

**Before:** Unconditionally lists `docs/02-design/01-ADRs/`, all 10 stage dirs
**After:** Only lists dirs that exist; adds note "Run `endiorbot init` to scaffold missing stages" if any are missing

Additionally: remove hardcoded `docs/02-design/01-ADRs/` reference — only reference top-level stage dirs that init actually creates.

## Consequences

### Positive
- DeepTutor correctly identified as Python + TypeScript (Docker)
- Python projects get `pytest`/`pip` commands instead of `pnpm`
- Root SKILL.md discovered by `endiorbot skills`
- Zero false-positive audit warnings on freshly-init'd projects

### Negative
- `scanSubEcosystems()` doing root scan adds ~1ms overhead (negligible)
- Root SKILL.md discovery changes `DiscoveredSkill.source` union type (from `"folder" | "flat"` to `"root" | "folder" | "flat"`)

### Risk
- Existing tests for `scanSubEcosystems` need updating for root scan
- `getCommandsSection` ecosystem map may miss edge cases — fallback to generic preserves safety

## Files Changed

| File | Change |
|------|--------|
| `src/cli/commands/ecosystem-detector.ts` | F1: `scanSubEcosystems()` scans root markers |
| `src/sdlc/scaffold/templates/claude-md.ts` | F2: ecosystem-aware commands; F4: existence-checked paths |
| `src/sdlc/scaffold/plugin-loader.ts` | F3: Pass 0 root SKILL.md |
| `src/sdlc/compliance/project-context-collector.ts` | No change (consumes ecosystem-detector SSOT) |
| Tests | Update all 4 modules' tests |
