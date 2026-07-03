---
status: ACCEPTED
authority:
  proposer: "@architect"
  countersigners:
    - actor: "@ceo"
      date: "2026-05-20"
      grade: "retroactive"
      reference: "Sprint 149"
  trigger: "endiorbot init defaults to STANDARD tier for all projects, causing over/under-scaffolding"
  notes: "Tier recommender scans 7 project signals and recommends LITE/STANDARD/PROFESSIONAL/ENTERPRISE before scaffolding."
sdlc_framework: "6.4.0"
---

# ADR-054: Init Tier Auto-Recommendation

## Context

`endiorbot init` always defaults to STANDARD tier when `--tier` is not provided.
This causes over-scaffolding for small projects (e.g., VatDownload — a 5-file Python
app getting 7 SDLC stages, 3 governance files, and 6 agents) and under-scaffolding
for large monorepos.

The init command already runs `collectProjectContext()` for tech-stack detection
(Sprint 79), but this happens *after* tier is determined. No signal-based tier
recommendation exists.

## Decision

Add a **Tier Recommender** module (`src/sdlc/scaffold/tier-recommender.ts`) that
scans lightweight project signals and recommends a tier *before* scaffolding.

### Signal Model (7 signals → weighted score → tier)

| Signal              | Weight | LITE (0) | STANDARD (1) | PROFESSIONAL (2) | ENTERPRISE (3) |
| ------------------- | ------ | -------- | ------------- | ----------------- | --------------- |
| Source files         | 0-3   | <10      | 10-30         | 30-100            | >100            |
| Test files           | 0-2   | 0        | 1-5+          | 10+               | —               |
| CI/CD present        | 0-1   | no       | yes           | —                 | —               |
| Dependency count     | 0-2   | <5       | 5-20+         | 30+               | —               |
| Monorepo             | 0-2   | no       | —             | —                 | yes             |
| Team files           | 0-1   | no       | —             | —                 | yes             |
| Compliance files     | 0-1   | no       | —             | —                 | yes             |

**Score → Tier mapping:** 0-1 LITE, 2-4 STANDARD, 5-7 PROFESSIONAL, 8+ ENTERPRISE.

### Integration Flow

```
endiorbot init [--tier TIER]
  │
  ├─ --tier provided?
  │   YES → use explicit tier (existing behavior)
  │   NO  → run recommendTier(projectPath)
  │         → display recommendation with reason
  │         → use recommended tier
  │
  └─ continue existing init flow...
```

### Priority Order (updated)

```
explicit --tier  >  detected (config/docs)  >  recommended (scan)  >  fallback LITE
```

Fallback changes from STANDARD → LITE (safe default — users can always upgrade tier).

### CLI Output Example

```
   Tier recommendation: LITE (5 source files, 6 deps, no CI/CD)
   Selected tier: LITE (auto-recommended)
```

## Consequences

### Positive
- Small projects like VatDownload get LITE (2 files, 4 stages) instead of STANDARD (3 files, 7 stages)
- Large projects automatically get appropriate tier without manual `--tier` flag
- Scan is fast (depth-limited FS walk, no AST parsing)

### Negative
- Recommendation may be wrong for unusual projects → explicit `--tier` always overrides
- Additional ~50-200ms scan time during init (acceptable, init is not latency-sensitive)

### Unchanged
- Explicit `--tier` behavior is preserved
- Existing config/docs detection still takes priority over recommendation
- `collectProjectContext()` still runs after tier is determined

## Files Changed

| File | Change |
| ---- | ------ |
| `src/sdlc/scaffold/tier-recommender.ts` | **NEW** — signal collection, scoring, recommendation |
| `src/sdlc/scaffold/index.ts` | Export `recommendTier` |
| `src/cli/commands/init.ts` | Remove `"STANDARD"` default from `--tier` option |
| `src/commands/handlers/sdlc-commands.ts` | Integrate recommendation into tier determination |
| `tests/sdlc/scaffold/tier-recommender.test.ts` | **NEW** — unit tests |
