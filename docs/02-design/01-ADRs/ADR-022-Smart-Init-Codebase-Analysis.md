# ADR-022: Smart Init — Codebase Analysis for `endiorbot init`

**Date:** 2026-03-05
**Status:** ACCEPTED
**Authority:** PM + Architect + CTO (9/10 Approved)
**Sprint:** 79

---

## Context

`endiorbot init /path` previously only created folder scaffolds with **generic placeholders**:
- `IDENTITY.md`: contained `[Framework]`, `[Primary language]`
- `CLAUDE.md`: hardcoded `pnpm install / pnpm build / pnpm dev / pnpm test`
- Stage READMEs: only TODO items

`collectProjectContext()` was implemented in Sprint 75 (ADR-018) and fully tested, but was only called during `compliance fix` — **never during `init`**.

**Test case:** `endiorbot init /path/to/open-pencil/ --tier STANDARD`
- open-pencil: TypeScript + Vue 3 + Vite + Tauri 2, Bun, Playwright E2E + Bun unit tests

**Comparison with SDLC Orchestrator** (Python, `/01.NQH/SDLC-Orchestrator`):
- Orchestrator does NOT analyze codebase tech stack
- Orchestrator does NOT generate CLAUDE.md/IDENTITY.md/AGENTS.md
- EndiorBot has architectural advantage — needed only a wiring step

---

## Decision

**Wire `collectProjectContext()` into `endiorbot init` before scaffold.**

### Design Principles

1. **Backward compatible**: All templates work without snapshot (fallback to current generic behavior)
2. **Failure-safe**: Analysis failure → `spinner.warn()` + continue with generic (no crash)
3. **Separation of concerns**: `snapshot` is NOT merged into `ProjectConfig` — passed as optional second param to templates
4. **`--skip-analysis` flag**: Users can bypass analysis to reproduce old behavior

### Template Signature Extension

```typescript
// Before (Sprint 61):
generateIdentityMd(project: ProjectConfig): string
generateClaudeMd(project: ProjectConfig): string
generateSdlcConfig(project: ProjectConfig): SdlcConfig

// After (Sprint 79):
generateIdentityMd(project: ProjectConfig, snapshot?: ProjectSnapshot): string
generateClaudeMd(project: ProjectConfig, snapshot?: ProjectSnapshot): string
generateSdlcConfig(project: ProjectConfig, snapshot?: ProjectSnapshot): SdlcConfig
```

### TechStackInfo Extension

Added `desktop?: string` to `TechStackInfo` for desktop runtime detection (Tauri 2).

### Pre-existing Gaps Fixed (Sprint 0)

1. **bun.lock text format**: Bun 1.2+ uses `bun.lock` (text) not `bun.lockb` (binary)
2. **Vue/Vite enrichment**: Vue + Vite/`@vitejs/plugin-vue` → `"Vue/Vite"` not just `"Vue"`
3. **Tauri detection**: `@tauri-apps/api` or `@tauri-apps/cli` → `desktop: "Tauri 2"`

---

## Consequences

### Positive

- `IDENTITY.md` after init now contains actual tech stack (TypeScript, Vue/Vite, Bun, Tauri 2)
- `CLAUDE.md` Commands section uses the project's actual package manager and scripts
- `.sdlc-config.json` stores `techStack` + `analyzedAt` for downstream tooling
- `docs/05-test/README.md` (STANDARD+) mentions detected test infrastructure
- Zero breaking changes — all templates still work without snapshot

### Neutral

- ~200ms additional startup time for analysis (acceptable — told to user via spinner)
- `--skip-analysis` available for users who want pure generic scaffolding

### Negative

- `collectProjectContext()` reads filesystem synchronously — adds I/O in init flow
  - Mitigated: wrapped in try/catch, failure gracefully degrades

---

## Rejected Alternatives

### A: Merge TechStackInfo into ProjectConfig

Rejected — `ProjectConfig` is a pure scaffold concern. Mixing analysis results pollutes the type.

### B: Post-init refresh step

Rejected — requires two commands (`init` + `refresh`). User expects one step.

### C: AI-powered analysis

Deferred — deterministic file scanning is faster, cheaper, offline-capable.

---

## Implementation

| File | Change |
|------|--------|
| `src/sdlc/compliance/fix-types.ts` | Add `desktop?: string` to `TechStackInfo` |
| `src/sdlc/compliance/project-context-collector.ts` | Fix bun.lock, Vue/Vite, Tauri |
| `src/sdlc/scaffold/types.ts` | Add `snapshot?` to `ScaffoldConfig` + `InitOptions`; `techStack?`/`analyzedAt?` to `SdlcConfig` |
| `src/sdlc/scaffold/templates/identity-md.ts` | `snapshot?` param + `## Tech Stack` section |
| `src/sdlc/scaffold/templates/claude-md.ts` | `snapshot?` param + script-aware commands |
| `src/sdlc/scaffold/templates/sdlc-config.ts` | `snapshot?` param + emit `techStack`/`analyzedAt` |
| `src/sdlc/scaffold/structure-generator.ts` | Thread snapshot + `generateStageReadme()` test infra section |
| `src/cli/commands/init.ts` | `--skip-analysis` + `collectProjectContext()` + thread snapshot |

---

## Test Coverage

- `tests/sdlc/compliance/project-context-collector.test.ts` (NEW) — 13 tests
- `tests/sdlc/scaffold/templates.test.ts` — 14 new snapshot-aware tests
- `tests/sdlc/scaffold/structure-generator.test.ts` — 4 new snapshot threading tests

**Total new tests: ~31**

---

*ADR-022 — Smart Init Codebase Analysis*
*SDLC Framework v6.4.0 | Sprint 79*
