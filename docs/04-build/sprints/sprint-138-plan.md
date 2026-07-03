---
sprint: 138
status: DRAFT — consolidated from Sprint 137 carry-forward (P2 spikes + P3 governance)
start_date: 2026-04-19
planned_duration: ~1-2d (governance P3 first, then spikes as appetite allows)
framework: "6.4.0"
authority: "@pm 2026-04-19 per CTO sequencing (Sprint 137 partial-close authorized carry-forward of P2 spikes + P3 governance)"
previous_sprint: "Sprint 137 — Polish + Identity + E2E Quality (PARTIAL CLOSE 2026-04-19, CTO 9.5/10)"
references:
  - docs/04-build/sprints/sprint-137-partial-close.md
  - docs/04-build/sprints/sprint-137-plan.md
---

# Sprint 138 — Governance Debt + Architecture Spikes

## Context

Sprint 137 shipped 11 of 21 backlog items (52%) and earned CTO 9.5/10 + CPO approval across P0/P1/P2. The carry-forward consists of governance debt (P3) and research-mode architecture spikes (P2). Per CTO sequencing: finish concrete governance work first, then allow fresh focus for spikes.

The single HIGH-urgency item is the **12 leaked secrets rotation**. CTO flagged it 2026-04-19: "Not 'do later' if any are still valid. `git log -p` to identify revoked vs live, rotate live ones THIS WEEK." CEO action required on vendor consoles; EndiorBot's job is investigation + checklist.

## P3 — Governance debt (concrete work first)

| # | Item | Effort | Who | Status |
|---|------|--------|-----|--------|
| B138-P3-01 | **HIGH** — Investigate 12 leaked secrets. Walk `git log -p` to identify the commit(s) that exposed each key, determine revoked vs still-valid based on vendor console states. Produce a per-key rotation checklist (vendor link, console path, test command to verify rotation). CEO rotates; EndiorBot prepares and verifies. | 1-2h investigation + CEO rotation timing | @coder → @ceo | pending |
| B138-P3-02 | ADR-048 `authority:` field audit. SOUL-pm Rule 4 requires machine-readable countersign structure in ADR frontmatter. Audit current `authority:` syntax across ADRs, add lint tooling that enforces the shape, run CTO countersign retroactive expansion on ADR-048 itself. | 30-45 min | @coder → @cto countersign | pending |
| B138-P3-03 | `.sdlc-framework/` gitignore trailing-slash match. Minor pattern tweak so VoiceOfVietnam-style symlink+dir patterns ignore cleanly without leaving untracked `?? .sdlc-framework` lines. | 2-5 min | @coder | pending |

## P2 — Architecture spikes (research mode, after governance)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| B138-P2-05 | Interface × vendor × task-class limit matrix. Document observed envelope per channel (OTT Telegram/Zalo/WebUI/CLI + direct CLI) × task type (narrow read, Opus advisory, heavy write). Output: `docs/06-deploy/channel-task-matrix.md`. Session data from Sprints 135-137 already captured informally; this formalizes. | 2-3h | Outcome: published matrix + recommendation for task-class routing |
| B138-P2-06 | Streaming bridge invocation. ADR draft for forwarding Claude CLI stdout chunks to BusConsumer as `isProgress: true` events incrementally. Current A6 heartbeats show *time elapsed* but not *content progress* — streaming would show actual partial output. | 2-4h + ADR | Depends on Claude Code CLI supporting `--output-format stream-json` or equivalent. If unsupported, ADR records the limitation + alternative (log-tailing the CLI's internal stream). |
| B138-P2-07 | `cli-smoke.test.ts` flake investigation. 12/15 tests fail when run standalone (pre-existing, confirmed via `git stash` during Sprint 136). Likely env / cwd dependent. | 1-2h | Isolate in a fresh shell, `ENDIORBOT_STATE_DIR=$(mktemp -d)`, bisect the shared-state dependency. |

## Out of scope (explicit)

- **Remote orchestration** — MTClaw territory per locked identity (Sprint 137 P1).
- **Desktop + Web dashboard revival** — CEO scope questions still unanswered since Sprint 136 draft.
- **New user-facing features** — Sprint 138 is debt + research only.

## Success criteria

- **SC-1**: P3-01 produces a rotation checklist CEO can execute in one sitting. Every leaked key classified live/revoked.
- **SC-2**: P3-02 lands the ADR-048 countersign expansion + shape audit (pass/fail report for all ADRs).
- **SC-3**: P3-03 gitignore clean — `git status` in VoiceOfVietnam-style scaffold shows no `?? .sdlc-framework/`.
- **SC-4** (stretch): At least one spike (P2-05, P2-06, or P2-07) produces a committed artifact.

## Sequencing

1. **P3-03** (2-5 min) — warm-up, trivial pattern fix.
2. **P3-02** (30-45 min) — concrete tooling, enables CTO countersign.
3. **P3-01** (1-2h investigation + CEO timing) — produces checklist; rotation itself is CEO-timed.
4. **P2-07** (1-2h) — most concrete of the spikes; pre-existing flake has a bounded fix envelope.
5. **P2-05** (2-3h) — matrix is a write-up of existing data; medium variance.
6. **P2-06** (2-4h + ADR) — highest variance; last because it depends on CLI feature discovery.

Sprint budget: P3 core ~2h; P2-07 ~1-2h; P2-05 ~2-3h. P2-06 is optional-stretch.

## Handoff note to Sprint 139

If P3-01 surfaces a live leaked key that's been abused, escalate immediately — don't wait for Sprint close. Rotate first, document later.

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | Sprint 138 Draft — 2026-04-19*
