---
sprint: 143
status: COMPLETE
start_date: 2026-04-26
end_date: 2026-04-26
planned_duration: 2-3d
framework: "6.4.0"
authority:
  proposer: "@pm"
  countersigners: []
  trigger: "Sprint 142 carry-forward + OGA Sprint 1 kickoff"
previous_sprint: "Sprint 142 — Anti-Drift Improvements (7/9 shipped)"
references:
  - docs/04-build/sprints/sprint-142-plan.md
---

# Sprint 143 — Sprint 142 Carry-Forward + OGA Sprint 1 Kickoff

## Context

Sprint 142 shipped 7/9 items. 2 deferred items + Ollama FF decision carry forward. Additionally, OGA (NQH Creative Studio) Sprint 1 needs kickoff — separate project with its own sprint numbering, but coordinated via EndiorBot.

---

## Track A: EndiorBot Carry-Forward (~5h)

### A1: Brain L2 Pattern Activation (~4h)

Wire error-pattern matching into FailureClassifier. When a failure matches a known Brain L2 pattern, inject the pattern context into the next retry prompt.

**What:** On `FailureClassifier.classify()` → check Brain L2 for matching error signatures → if match → inject L2 context into RecoveryEngine retry prompt.

**Files:**
- `src/sessions/failure/classifier.ts` — add L2 pattern lookup after classification
- `src/brain/layers/patterns.ts` — add `findMatchingPattern(errorSignature)` query
- `src/sessions/recovery/engine.ts` — accept L2 context in retry prompt

**Success:** Error retry includes relevant prior error pattern → more targeted fix attempt.

### A2: 17th Mechanism Documentation (~30min)

Add SOUL-level Workspace Awareness to architecture docs (CTO correction from Sprint 142).

**Files:**
- `docs/02-design/` — add note about 5 executor SOULs carrying `Workspace Awareness (MANDATORY)` section

### A3: Gate Mark Subcommand — Team-Level Manual Item Completion (~3h)

**Bug report:** OGA team (`feedback_endiorbot_gate_force.md`). CEO quote: *"đã confirm mà phải dùng force luôn luôn là không đúng, CEO chỉ override khi cần thiết, còn team đủ điều kiện thì sẽ pass chứ"*.

**Root cause:** 10 gate checklist items have `autoCheck: false` (G0 CEO approval, G0.1 CEO scope approval, G1 acceptance criteria, G1 stakeholder sign-off, G2 ADR documented, G2 API contracts, G3 security scan, G4 deployment verified, G4 rollback tested, G-Sprint retrospective). These items can only pass via `--force` CEO override — no team-level mechanism exists to mark them as complete with evidence.

**Fix:** New `gate mark` subcommand:

```bash
# Team marks a manual item as done (with evidence trail)
endiorbot gate mark G1 g1-acceptance-criteria --pass --evidence "ACs in requirements.md v1.1, reviewed by @cpo"
endiorbot gate mark G1 g1-stakeholder-signoff --pass --evidence "CEO approved via Telegram 2026-04-26"

# Then confirm works WITHOUT --force
endiorbot gate confirm G1 --confirm   # succeeds — all items now pass
```

**Files:**

| File | Change | LoC |
|------|--------|-----|
| `src/cli/commands/gate.ts` | Add `gate mark <gateId> <itemId> --pass [--evidence <text>]` subcommand | ~60 |
| `src/sdlc/gates/gate-engine.ts` | Add `loadManualMarks()` + `markItem()` — read/write `~/.endiorbot/evidence/<projectId>/gate-marks.json` | ~50 |
| `src/sdlc/gates/gate-checklist.ts` | Modify `evaluateChecklist()` — for `autoCheck: false` items, check persisted marks before returning `manual` status | ~20 |
| `tests/sdlc/gates/gate-mark.test.ts` | NEW — mark item → evaluate gate → confirm without force | ~80 |

**Design decisions:**
- **Persistence:** `~/.endiorbot/evidence/<projectId>/gate-marks.json` — per-project, persists across sessions
- **Evidence required:** `--evidence` flag mandatory for audit trail (CEO sees WHY it was marked)
- **Reset on re-evaluate:** marks persist until explicitly cleared via `gate mark <gateId> <itemId> --reset`
- **--force unchanged:** CEO-only override still works for genuinely failing gates; `gate mark` is the team-level path
- **OTT surface:** `/gate mark G1 g1-stakeholder-signoff --pass` via Telegram (same CommandDispatcher pattern)

**Success:** `endiorbot gate confirm G1 --confirm` passes after team marks manual items — no `--force` needed for routine gate progression.

### A4: Ollama FF Enable Decision (CEO)

After 1-week Active Memory latency soak (P0-3 data collection started Sprint 142), CEO reviews latency report and decides:
- Enable `FF_OLLAMA_AUTO_ESCALATE` → Ollama low-confidence auto-escalates to Kimi
- Keep disabled → @assistant stays on Ollama without quality gate

**Depends on:** 1 week of P0-3 dry-run latency data.

---

## Track B: OGA Sprint 1 Kickoff (separate project)

OGA (NQH Creative Studio) is a separate project at `~/Documents/Research/Open-Generative-AI` with its own Sprint 1. EndiorBot manages development via CLI/Telegram/tmux bridge.

### B1: Register OGA in EndiorBot workspace

```bash
endiorbot repos add oga /Users/dttai/Documents/Research/Open-Generative-AI
```

### B2: OGA Sprint 1 Execution (3-4 days)

Per approved plan at `Open-Generative-AI/docs/04-build/sprints/sprint-1-plan.md`:

| Task | Description | Effort |
|------|-------------|--------|
| 1.1 | Fork → github.com/Minh-Tam-Solution/OGA, rebrand package.json | 30min |
| 1.2 | Rebrand UI → "NQH Creative Studio" | 1h |
| 1.3 | Create `providerConfig.js` + patch 6+ hardcoded URLs | 2h |
| 1.4 | Image Studio local mode (skip auth, filter models) | 3h |
| 1.5 | Tab visibility (Coming Soon badges) | 1h |
| 1.6 | Integration test (local server → generate image) | 1h |
| 1.7 | Docs + .env.example | 30min |

**SDLC compliance:** OGA already has G0→G2 docs (created by `endiorbot compliance fix`). Sprint 1 = G-Sprint execution.

---

## Sequencing

```
Day 1: A1 (Brain L2 activation) + A2 (docs) + A3 (gate mark — design + impl)
Day 2: A3 (gate mark — tests + OTT surface) + B1 (register OGA) + B2 tasks 1.1-1.3
Day 3: B2 tasks 1.4-1.7 (Image Studio + tabs + test + docs)
```

---

## Success Criteria

- **SSC-1:** Brain L2 pattern found → injected into retry prompt (unit test)
- **SSC-2:** 17th mechanism documented in architecture docs
- **SSC-6:** `endiorbot gate mark G1 g1-stakeholder-signoff --pass --evidence "..."` + `endiorbot gate confirm G1 --confirm` succeeds without `--force`
- **SSC-3:** OGA repo at github.com/Minh-Tam-Solution/OGA with "NQH Creative Studio" branding
- **SSC-4:** OGA Image Studio generates image via local mflux server
- **SSC-5:** EndiorBot `pnpm build` clean, all tests pass

---

---

## Remediation Log (E2E Test Failures)

Failures discovered during E2E channel testing. Each fixed within Sprint 143 scope.

| # | Test | Channel | Failure | Root Cause | Fix | Status |
|---|------|---------|---------|-----------|-----|--------|
| R01 | T01: `/start` | Telegram | "Unknown command" | `/start` not registered in command dispatcher | Add `/start` handler returning welcome message | FIXED |
| R02 | T05: `@pm` agent | Telegram | Kimi unavailable + fallback "Internal error" | ADR-052 Tier 2 = kimi primary; CEO directive: CC must be primary | All Tier 2 agents → claude-code primary, model "sonnet". Kimi = fallback on rate-limit only | FIXED |
| R03 | T05: `@pm` agent | Telegram | "claude-sonnet-4 model not found" | Wrong model ID for CC CLI. CC uses "sonnet" not "claude-sonnet-4" | Fixed model ID in agent-constants.ts | FIXED |
| R04 | — build | Build | TS2305: removeGateItemMark not exported | CEO A3 gate-mark code added but barrel export missing from sdlc/index.ts | Added re-exports to sdlc/index.ts | FIXED |

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | Sprint 143 — 2026-04-26*
