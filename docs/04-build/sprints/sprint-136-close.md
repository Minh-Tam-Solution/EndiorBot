---
sprint: 136
status: CLOSED (implementation) — awaiting CEO post-close review
start_date: 2026-04-17 (kickoff overlapped with Sprint 135 P1 follow-up)
close_date: 2026-04-18
planned_duration: DRAFT — no binding duration (Part B deferred, see below)
actual_duration: ~1 day (governance Phase 1+2) + 1 session (UX Phase 3)
framework: "6.4.0"
previous_sprint: Sprint 135 — Surface Parity + P1 Workspace Awareness
next_sprint: TBD — CEO to confirm Desktop + Web dashboard scope (Part B) or new priority
---

# Sprint 136 — Close Report

## Scope Delivered (Part A + Part A' + B-series fixes)

### Part A — Governance carry-over from Sprint 135

| ID | Item | Status | Commit |
|----|------|--------|--------|
| A1 | L2 Handoff Completion in 4 executor SOULs (coder, pm, architect, tester) | ✅ | `109022d` |
| A2 | SOUL-pm v1.3.0 — Ground-Truth Rule 4 (versioned-artifact CTO sign-off) | ✅ | `109022d` |
| A3 | L1 @pm CRG polish (crg_architecture_overview + crg_graph_status) | ✅ | `109022d` |
| A4 | ADR-048 STUB → FULL expansion (rollback plan, quality gates, sibling comparison, test evidence) | ✅ | `109022d` |
| A5 | Sprint 135 formal close — test + build + push 5 commits | ✅ | Shipped during session (commits `9df591f`, `999c325`, `d10e288`, `8623a00`, `c9fb2d6`) |

### Part A' — UX + fallback hardening (added mid-sprint after CEO field test 2026-04-18)

| ID | Item | Status | Commit |
|----|------|--------|--------|
| A10 | `ENDIORBOT_DISABLE_ANTHROPIC_FALLBACK` config flag | ✅ | `60d92fb` |
| A11 | Rate-limit-only Gemini fallback — classifier + router policy | ✅ | `4d46c11` |
| B3 | Wire `ENDIORBOT_CLAUDE_TIMEOUT_MS` from env → ChannelRouter | ✅ | `dbb6e4c` |
| B4 | Telegram adapter surfaces router error text (sync path) | ✅ | `e14299f` |
| B4b | Bus consumer surfaces router error text (async bus path — real prod path) | ✅ | `1053026` |
| B5 | `--permission-mode=bypassPermissions` on bridge (root-cause fix for 10-min hangs) | ✅ | `e1e3064` |
| A6 | Gateway progress ticker — 30s heartbeats via BusConsumer while handleInbound in flight | ✅ | `ceea4e1` |
| A7 | Fallback status event — router announces "⚡ switching to Gemini" on RATE_LIMITED | ✅ | `ceea4e1` |
| A8 | Telegram editMessageText consumer (inline edit instead of append) | ⏸️ **DEFERRED** — needs message-id state map + editMessage wrapper (~60 min). Append pattern is sufficient for CEO's Telegram UX in the interim. |
| A9 | Zalo / WebUI / CLI / Desktop progress stubs | ⏸️ **DEFERRED** — WebSocket subscribers already see `bus.publishOutbound({isProgress: true})` events; native UX polish per channel is a P3 backlog item. |

### Small fixes rolled into this sprint

| Area | Fix | Commit |
|------|-----|--------|
| Scaffold template | `preToolUse` → `PreToolUse` (Claude CLI expects PascalCase hook names) | `bcc07de` |
| Docs SSOT | Stage 06-07 secrets file reference: `.env.local` → `.env` per CEO direction 2026-04-18 | `109022d` |

## Part B — Desktop + Web Dashboard (DEFERRED)

The original Sprint 136 draft listed "Desktop + Web dashboard (5.5d)" as Part B, sourced from a verbal `@pm` claim. Ground-truth check in the session (2026-04-18) could not verify the scope — only `docs/07-operate/USAGE-GUIDE.md:746` mentioned "upcoming Desktop app (Sprint 136)" as aspirational text. Five acceptance-gate questions were filed in the draft plan for CEO input (tech stack, pages, wrap vs standalone, auth, view vs mutate).

**Status:** Part B remains unscoped. Next sprint should either (a) resolve the 5 acceptance-gate questions and commit to Part B, or (b) pick a different priority based on current CEO pain.

## Test Evidence

- Full suite post-Sprint-136: 7945/7956 pass, 10 skipped, 1 pre-existing flake (`tests/cli/cli-smoke.test.ts` — verified failing on clean `main` via `git stash`, not caused by Sprint 136).
- New tests: 14 (rate-limit classifier), 2 updated (bus consumer T12/T16 for progressFn invariant).
- `pnpm build`: clean.

## Trigger incident resolution

CEO's 2026-04-18 field test on BetterBox-TTS repo via Telegram showed `@tester` hanging for 7–10 minutes with generic "Internal error. Please try again." The stacked fixes A10 → A11 → B3 → B4b → B5 collapsed the loop end-to-end:

| Test (Telegram @tester) | Pre-fix behavior | Post-fix behavior |
|-----|-----|-----|
| Claude Code CLI hang (permission prompt) | 5-min silent → fallback through claude-code-retry → remote Ollama → "Internal error" (~10 min) | 20-60s normal response (B5 bypasses the prompt) |
| Claude Code Max rate limit | Same ~10-min silent loop | <1 min to error or Gemini fallback |
| Other Claude failure | Same ~10-min silent loop | Specific emoji-prefixed error within 60s |
| Long-running legitimate work | No progress signal | 30s heartbeats via A6 |

Verified live on 2026-04-18 18:27 — `⚡ @tester` reply with coherent smoke-test plan in 1 minute, Workspace Awareness correctly discovered the existing `docs/05-test/test-plans/smoke-test-plan-s1-s5.md`.

## Commits (chronological, origin/main)

```
109022d docs(sprint-136): Part A governance — ADR-048 full + 4 SOUL handoff + SOUL-pm Rule 4 + CRG polish + .env SSOT revert
bcc07de fix(scaffold): preToolUse → PreToolUse hook event case
ceea4e1 feat(bus,router): progress ticker + fallback status event — Sprint 136 A6+A7
e1e3064 fix(bridge): add --permission-mode=bypassPermissions — Sprint 136 B5
1053026 fix(bus): surface router's specific error via async bus path — Sprint 136 B4b
e14299f fix(telegram): surface router's specific error to CEO — Sprint 136 B4
dbb6e4c fix(router): wire ENDIORBOT_CLAUDE_TIMEOUT_MS to ChannelRouter — Sprint 136 B3
4d46c11 fix(router): rate-limit-only Gemini fallback — Sprint 136 A11
60d92fb feat(providers): ENDIORBOT_DISABLE_ANTHROPIC_FALLBACK flag — Sprint 136 A10
d8a4c6d docs(sprint-136): draft plan — Part A verified, Part B scope TBD pending CEO input
```

## Outstanding debt (carried into next sprint backlog)

1. **A8 Telegram editMessageText** — replace append-ticker with inline edit of the placeholder message. ~60 min when prioritized.
2. **A9 Zalo / WebUI / CLI / Desktop progress stubs** — each channel translates `bus.progress` to its native UX.
3. **12 leaked secrets rotation** — CEO to rotate at their timing (flagged in session log).
4. **ADR-048 quality gate cross-refs** — CTO countersign recorded in frontmatter; a machine-readable `authority:` field audit (Rule 4 follow-up) may be worth a small tooling sprint later.
5. **cli-smoke.test.ts flake** — 12/15 failing pre-existing, likely env/cwd dependent. Separate investigation needed.

---

*EndiorBot | Solo Developer Power Tool (LOCKED) | SDLC 6.4.0 | Sprint 136 Close — 2026-04-18*
