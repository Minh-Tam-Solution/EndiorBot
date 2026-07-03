---
sprint: 137
status: DRAFT — backlog consolidated from Sprint 136 session (2026-04-18/19)
start_date: TBD — CEO kickoff after Sprint 136 soak
planned_duration: ~5d (tiered: P0 critical + P1 polish + P2 spikes)
framework: "6.4.0"
authority: "@pm consolidated 2026-04-19 from Sprint 136 close + session findings + CEO identity refinement + E2E API testing scope decision"
previous_sprint: "Sprint 136 — Part A governance + Part A' UX hardening (CLOSED 2026-04-18)"
references:
  - docs/04-build/sprints/sprint-136-close.md
  - docs/04-build/sprints/sprint-136-desktop-web-dashboard.md (Part A' gateway events)
  - ~/.claude/projects/-Users-dttai-Documents-Python-01-NQH-EndiorBot/memory/feedback_endiorbot_identity_scope.md
---

# Sprint 137 — Polish + Identity Refinement + E2E Quality

## Context

Sprint 136 shipped 10 commits closing CEO's 10-min silent-wait loop and proved the SDLC OTT workflow on BetterBox-TTS (now VoiceOfVietnam, handed off to MTClaw). Sprint 137 consolidates the polish items, the identity refinement CEO delivered post-handoff ("EndiorBot focuses on local MacBook repos + CEO support"), and the E2E API testing scope that surfaced during skill invocation.

**Identity reminder (locked 2026-04-19):** EndiorBot = CEO's local-only tool. Product-team execution (GPU servers, production deployment) belongs to MTClaw / SDLC Orchestrator. Sprint 137 items respect that boundary.

## P0 — Critical carry-over from Sprint 136

| # | Item | Effort | File(s) |
|---|------|--------|---------|
| B137-P0-01 | Duplicate Telegram ticks — BusConsumer emits both `replyFn` and `publishOutbound` per tick; Telegram subscribes to both paths → 2× delivery. Suppress outbound-bus publish for OTT-originated messages OR make adapter skip own-channel outbound. | 30 min | `src/bus/consumer.ts`, `src/channels/telegram/` |
| B137-P0-02 | Post-output 300s timeout cosmetic — Claude CLI holds process open after output complete; bridge timer fires anyway. Cancel timer on first successful response, not on process close. | 20 min | `src/agents/invoke/claude-code-bridge.ts` |
| B137-P0-03 | `endiorbot gate confirm` cwd-awareness — command uses `~/.endiorbot/active-project.json`, not cwd. Add `--project <path>` flag OR auto-detect from `.sdlc-config.json` in cwd with explicit override message. | 30 min | `src/cli/commands/gate.ts` |

## P1 — Identity & Docs (CEO direction 2026-04-19)

| # | Item | Effort | File(s) |
|---|------|--------|---------|
| B137-P1-01 | CLAUDE.md Identity — add explicit "local MacBook repos only" scope + handoff boundary to MTClaw/product-team agent platforms | 10 min | `CLAUDE.md` |
| B137-P1-02 | AGENTS.md — add "Handoff Boundary" section documenting scaffold-then-handoff pattern (EndiorBot kickstarts, product-team agents take over when project moves to product org repo) | 15 min | `AGENTS.md` |
| B137-P1-03 | SOUL templates — remove SSH/remote orchestration language (if any). Reinforce "if CEO asks remote, suggest direct CLI or MTClaw handoff" | 15 min | `docs/reference/templates/souls/SOUL-*.md` |
| B137-P1-04 | Docs stage 06-07 — ensure guidance matches local-only scope (Docker section may imply remote; clarify for CEO's MacBook use) | 20 min | `docs/06-deploy/README.md`, `docs/07-operate/USAGE-GUIDE.md` |

## P1 — UX / A8-A9 continuation

| # | Item | Effort | File(s) |
|---|------|--------|---------|
| B137-P1-05 | A8 Telegram editMessageText — replace append-ticker with inline edit of placeholder message. Needs: message-id state map per correlationId + editMessage wrapper on TelegramChannel + subscribe handler. | 60 min | `src/channels/telegram/telegram-channel.ts`, `src/channels/telegram/telegram-ott-adapter.ts` |
| B137-P1-06 | A9 Zalo / WebUI / CLI / Desktop progress stubs — subscribe to `bus.progress` events, translate to each channel's native UX (Zalo edit/resend, WS push, spinner, progress bar) | 60-90 min | Respective adapters |
| B137-P1-07 | B6 per-agent timeout config — executor=60s, advisory=180s, ADR-writer=600s. Reads from SOUL frontmatter or tier map. | 30 min | `src/config/timeouts.ts`, `src/agents/router/agent-constants.ts`, `src/agents/invoke/claude-code-bridge.ts` |

## P2 — E2E API Testing (from skill invocation 2026-04-19)

| # | Item | Effort | File(s) |
|---|------|--------|---------|
| B137-P2-01 | Generate OpenAPI 3.0 spec from gateway code — scan Express routes + WebSocket JSON-RPC methods → `docs/03-integrate/02-API-Specifications/openapi.json` (SSOT canonical location per skill spec) | 30-45 min | `src/gateway/`, new generator script |
| B137-P2-02 | Full E2E test suite — STANDARD tier target 90%+ endpoints, auto-generated from OpenAPI spec, stored at `docs/05-test/07-E2E-Testing/scripts/test_all_endpoints.py` | 60 min | Test scripts + reports |
| B137-P2-03 | OWASP API1-6 security mode — IDOR, auth bypass, BOLA, resource consumption, function-level auth, business flow abuse | 30 min | Test scripts |
| B137-P2-04 | G3 evidence package — cross-references Stage 03 ↔ Stage 05, SHA256 evidence integrity, report in test-runs/ | 15 min | Docs + tooling |

## P2 — Architecture spikes

| # | Item | Effort | Notes |
|---|------|--------|-------|
| B137-P2-05 | Research spike — interface × vendor × task-class limit matrix. Document each channel's observed envelope (OTT Telegram/Zalo/WebUI/CLI + direct CLI) vs task type (narrow read, Opus advisory, heavy write). Output: `docs/06-deploy/channel-task-matrix.md` | 1d | Session data mostly captured in Sprint 136 close; formalize |
| B137-P2-06 | Streaming bridge invocation — forward CLI stdout chunks to BusConsumer as `isProgress: true` events incrementally. Fixes the "write task always hits 300s envelope" root cause. Architecture ADR required. | 2-4h + ADR | Depends on Claude Code CLI supporting `--output-format stream-json` or similar |
| B137-P2-07 | cli-smoke.test.ts flake — 12/15 tests fail when run standalone (pre-existing, confirmed via git stash during Sprint 136). Likely env/cwd dependent. | 1-2h investigation | Run tests in isolated env, identify shared state leakage |

## P3 — Governance debt

| # | Item | Effort | Notes |
|---|------|--------|-------|
| B137-P3-01 | 12 leaked secrets rotation — ANTHROPIC, OPENAI, GOOGLE/GEMINI, GITHUB_TOKEN, MTCLAW, AI_PLATFORM, TELEGRAM_BOT, ZALO_BOT, GATEWAY_TOKEN, OLLAMA_REMOTE. Leaked during Sprint 136 diagnostic commands. | CEO timing | CEO must rotate via each vendor's console |
| B137-P3-02 | ADR-048 audit — machine-readable `authority:` field audit. SOUL-pm Rule 4 tooling follow-up. | 30 min | `docs/02-design/01-ADRs/ADR-048-*.md` |
| B137-P3-03 | `.sdlc-framework/` gitignore trailing-slash match — minor tweak so VoiceOfVietnam-style symlink+dir patterns ignore cleanly | 2 min | `.gitignore` patterns across scaffold |

## Already shipped (not in scope — historical reference)

- ~~A10 `ENDIORBOT_DISABLE_ANTHROPIC_FALLBACK`~~ — `60d92fb`
- ~~A11 rate-limit-only fallback~~ — `4d46c11`
- ~~B3 timeout env wiring~~ — `dbb6e4c`
- ~~B4/B4b error surfacing~~ — `e14299f`, `1053026`
- ~~B5 `--permission-mode=bypassPermissions`~~ — `e1e3064` (root-cause fix for 10-min hangs)
- ~~A6/A7 progress + fallback status events~~ — `ceea4e1`
- ~~`preToolUse` → `PreToolUse` hook case~~ — `bcc07de`
- ~~@devops/@pjm haiku → sonnet~~ — `1cbe357`, `9423ae7`

## Out of scope (explicit)

- **Remote GPU orchestration** — MTClaw handles product execution. Per 2026-04-19 identity lock.
- **Desktop + Web dashboard (original Sprint 136 Part B)** — deferred indefinitely; CEO scope questions unanswered; no evidence CEO actively wants this.
- **VoiceOfVietnam follow-on work** — handed off to MTClaw's @pm on GPU server; EndiorBot records preserved as historical only.

## Success criteria

- **SC-1**: All P0 items shipped (duplicate ticks, post-output timeout, gate-confirm cwd).
- **SC-2**: CLAUDE.md + AGENTS.md identity refinement merged; SOUL templates aligned.
- **SC-3**: B137-P2-01 + B137-P2-02 shipped (OpenAPI spec + E2E smoke suite) OR explicitly deferred with reason.
- **SC-4** (stretch): B137-P2-06 streaming bridge shipped — fundamental write-task envelope fix.

## Sequencing

1. P0 first (3 items, ~80min) — unblock UX polish trust.
2. P1 identity docs (4 items, ~60min) — reinforce boundary before further feature work.
3. P1 UX A8/A9/B6 (3 items, ~2.5h) — complete Sprint 136 deferred items.
4. P2 E2E testing (4 items, ~2.5h) — skill-invocation demand + G3 Stage 03/05 compliance.
5. P2 spikes (3 items, 1-2 days) — depends on CEO's appetite for deeper architecture work.
6. P3 governance — CEO-timed, async.

Sprint budget: core items (P0+P1+P2-01..04) ~7h. Spikes add 1-2 days if prioritized.

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | Sprint 137 Draft — consolidated 2026-04-19*
