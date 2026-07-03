---
status: ACCEPTED
authority:
  proposer: "@architect"
  countersigners:
    - actor: "@ceo"
      date: "2026-05-27"
      grade: "retroactive"
      reference: "Sprint 150"
  trigger: "Single root CLAUDE.md causes context bloat in large codebases"
  notes: "Anthropic blog: 'scope context hierarchically rather than loading everything globally'"
sdlc_framework: "6.4.0"
---

# ADR-055: Layered CLAUDE.md Generation

## Context

`endiorbot init` generates a single root `CLAUDE.md`. As codebases grow, this becomes a context bloat problem — all conventions, test commands, import patterns, and documentation standards compete for space in one file.

Anthropic's *Claude Code in Large Codebases* blog (2026-05) recommends hierarchical CLAUDE.md: root file for big picture, subdirectory files for local conventions. Claude Code auto-loads parent files as it traverses directories — subdir context is additive, not exclusive.

## Decision

`endiorbot init` generates tier-appropriate CLAUDE.md hierarchy:

| Tier | Files generated |
|------|----------------|
| LITE | Root `CLAUDE.md` only |
| STANDARD | Root + `src/CLAUDE.md` + `tests/CLAUDE.md` |
| PROFESSIONAL | Root + `src/` + `docs/` + `tests/` CLAUDE.md |
| ENTERPRISE | Root + `src/` + `docs/` + `tests/` + per-service subdirs |

### Content allocation

- **Root CLAUDE.md**: project identity, architecture overview, critical gotchas, pointers to subdirs
- **src/CLAUDE.md**: code conventions, import patterns, module map (populated from `collectProjectContext()` tech stack detection)
- **docs/CLAUDE.md**: documentation standards, SDLC stage structure
- **tests/CLAUDE.md**: testing conventions, scoped test commands (e.g., `pnpm vitest run tests/` not full suite)

### ENTERPRISE per-service detection

Convention scan: `packages/*/`, `apps/*/`, `services/*/` directories. Fallback: `package.json` workspaces field. Config override: `.sdlc-config.json` `subdir_claude_md_paths` array.

## Consequences

### Positive
- Large codebases get scoped context — subagents starting from `src/providers/` only load relevant conventions
- Root file stays lean (<200 lines) — pointers, not encyclopedias
- LITE tier unchanged — no over-scaffolding for small projects

### Negative
- More files to maintain — mitigated by U4 staleness detection (Sprint 153)
- Existing projects upgrading tier need manual migration or `--force` re-init

## Files Changed

| File | Change |
|------|--------|
| `src/sdlc/scaffold/templates/claude-md.ts` | Split `generateClaudeMd()` → `generateRootClaudeMd()` + `generateSubdirClaudeMd()` |
| `src/sdlc/scaffold/structure-generator.ts` | Add subdir CLAUDE.md steps |
| `src/sdlc/scaffold/types.ts` | Extend `TIER_ROOT_FILES` with subdir paths |
| `tests/sdlc/scaffold/structure-generator.test.ts` | New assertions for subdir generation |
| `tests/sdlc/scaffold/templates.test.ts` | New assertions for subdir content |
