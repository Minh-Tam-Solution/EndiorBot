# Sprint 153 — CLAUDE.md Staleness Detection

| Field | Value |
|-------|-------|
| **Date** | 2026-05-27 |
| **Goal** | `endiorbot audit claude-md` automated health check |
| **Status** | PLANNED |
| **Dependency** | None (independent) |

## Problem

CLAUDE.md files accumulate stale references, grow too large, and rules written for old models may hurt new models. Solo devs have no automated reviewer. Anthropic blog recommends review every 3-6 months.

## Deliverables

### D1: claude-md-auditor.ts
- File reference check: verify referenced paths still exist
- Framework version check: flag if outdated
- Size warnings: root >300 lines, subdir >100 lines
- Age check: >90 days since last modified → suggest review
- Deprecated pattern detection

### D2: Audit baseline with accepted_debt
- `.endiorbot/audit-baseline.json` tracks `last_audited_at` + suppressed warnings
- `--accept <warning-id>` suppresses known-OK issues
- Re-alerts only when file content changes after acceptance

### D3: CLI command `endiorbot audit claude-md`

## Acceptance Criteria

- [ ] Detects stale file references in CLAUDE.md
- [ ] Flags outdated framework version (e.g., 6.3.0 when current is 6.4.0)
- [ ] Warns when root CLAUDE.md exceeds 300 lines
- [ ] `--accept W001` suppresses warning, persists in baseline
- [ ] Clean project (VatDownload) shows minimal/no issues
- [ ] All existing tests pass
