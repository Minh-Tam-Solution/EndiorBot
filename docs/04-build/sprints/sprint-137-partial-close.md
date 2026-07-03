---
sprint: 137
status: PARTIAL CLOSE — P0 + P1 + P2 shipped; P2 spikes + P3 governance carry forward
close_date: 2026-04-19
planned_duration: ~5d (tiered P0/P1/P2)
actual_duration: 1 session (single day)
framework: "6.4.0"
previous_sprint: "Sprint 136 — Part A governance + Part A' UX hardening (CLOSED 2026-04-18)"
next_sprint: "Sprint 138 — pick up P2 spikes + P3 governance; CEO to confirm appetite"
authority: "CTO APPROVED 9.5/10, @pm partial-close authorized 2026-04-19"
---

# Sprint 137 — Partial Close Report

## Outcome

**11 of 21 planned backlog items shipped in one session (52%), 9 commits pushed to origin/main.** CTO approved each tier separately at 9.5/10. Full regression sweep clean (1822/1822 on focused sweep; 7974/7984 on last full run, 10 skipped, 0 regressions).

## Shipped

### P0 — Critical UX carry-over from Sprint 136 (3 items)

| ID | Item | Commit | Effort |
|----|------|--------|--------|
| B137-P0-01 | BusConsumer dual-emit fix (progressFn + emitTick) — single-owner delivery via originating channel | `27115d3` | 30 min |
| B137-P0-02 | Claude Code bridge post-output drain (env-tunable, drain-kill-with-output = success) | `27115d3` | 20 min |
| B137-P0-03 | `endiorbot gate confirm` cwd-awareness (3-tier project resolution: `--project` → cwd → active-project.json) | `27115d3` | 30 min |
| P0 test catch-up | @pjm/@devops haiku → sonnet assertion updates (Sprint 136 commits 1cbe357 + 9423ae7) | `d146246` | 10 min |

### P1 — Identity & Docs (4 items)

| ID | Item | Commit | Effort |
|----|------|--------|--------|
| B137-P1-01 | `CLAUDE.md` Identity: LOCAL-ONLY scope + handoff-boundary language | `b3fd048` | 10 min |
| B137-P1-02 | `AGENTS.md` "Handoff Boundary" section (scaffold-then-handoff + VoiceOfVietnam reference incident) | `b3fd048` | 15 min |
| B137-P1-03 | SOUL `PREAMBLE.md` — shared "Local-Only Scope (LOCKED 2026-04-19)" block | `5207083` | 15 min |
| B137-P1-04 | Stage 06-07 docs realigned to local-only scope (Docker = local sandbox, "remote control from channel" disambiguated) | `5207083` | 20 min |

### P1 — UX continuation from Sprint 136 (3 items)

| ID | Item | Commit | Effort |
|----|------|--------|--------|
| B137-P1-07 (B6) | Per-agent Claude Code timeout config — 3-class SSOT (executor 60s / advisory 180s / adr-writer 600s); env-tunable per-agent + per-class | `5b38fa2` | 30 min |
| B137-P1-05 (A8) | Telegram `editMessageText` for progress ticks — placeholder map owned by adapter, single-owner invariant preserved | `ede2253` | 60 min |
| B137-P1-06 (A9) | Zalo throttle (1 message per 60s window) + WebUI/CLI/Desktop stubs documented | `a6779f9` | 60 min |

### P2 — E2E API Testing (4 items)

| ID | Item | Commit | Effort |
|----|------|--------|--------|
| B137-P2-01 | OpenAPI 3.0 generator — 9 REST + 47 JSON-RPC methods → `docs/03-integrate/02-API-Specifications/openapi.json` | `ed46a81` | 40 min |
| B137-P2-02 | Contract tests — bidirectional spec↔source parity, ≥90% coverage gate (6 tests) + live smoke script | `ed46a81` | 40 min |
| B137-P2-03 | OWASP API1-6 triage doc + 11 control-presence tests; zero non-localhost findings | `ed46a81` | 30 min |
| B137-P2-04 | G3 evidence manifest — SHA256 integrity on 8 artifacts, Stage 03 ↔ Stage 05 cross-ref | `ed46a81` | 15 min |

## Test evidence

- **Before sprint:** 7921 tests.
- **After sprint:** 7974 tests (last full run) / 1822 tests (focused agents+bus+channels+e2e sweep).
- **Added:** +45 tests across B6 (11) + A8 (12) + A9 (5) + P2 E2E (17).
- **Regressions:** 0.
- **Skipped:** 10 (pre-existing; flake-prone suites marked).
- **`pnpm build`:** clean on every commit.

## CTO preconditions — all held

Three triggers would have paused the session for review; none fired:

1. **P2-01 undocumented API surface** — generator enumeration produced 9 REST + 47 JSON-RPC methods, all accounted for. No scope creep into undocumented territory.
2. **P2-03 OWASP non-localhost findings** — zero non-localhost findings. All residual risks gated by LOCAL-ONLY identity lock.
3. **Test count regression below 7974** — suite grew; no regression.

## Commits (chronological, origin/main)

```
ed46a81 feat(e2e): P2-01..04 E2E API testing — OpenAPI spec + contract tests + OWASP + G3 evidence
a6779f9 feat(zalo,web): A9 — per-channel progress UX (Zalo throttle + WebUI/CLI/Desktop docs)
ede2253 feat(telegram): A8 — editMessageText for progress ticks (single-owner preserved)
5b38fa2 feat(router): per-agent Claude Code timeout config — Sprint 137 B6
b3fd048 docs(sprint-137-p1): identity docs add LOCAL-ONLY scope + Handoff Boundary
5207083 docs(sprint-137-p1): reinforce local-only scope across SOUL preamble + stage 06-07
d146246 test(sprint-137-p0): align model assertions with @pjm/@devops sonnet promotion
27115d3 fix(sprint-137-p0): consumer dual-emit + bridge post-output drain + gate cwd resolution
0478f2c docs(sprint-137): DRAFT plan — backlog consolidated from Sprint 136 session
```

## Carried forward to next sprint

### P2 — Spikes (3 items, 1-2 days, research mode)

- **B137-P2-05** — interface × vendor × task-class limit matrix (document observed envelope per channel × task type).
- **B137-P2-06** — streaming bridge invocation (forward CLI stdout chunks as `isProgress: true` incrementally). Architecture ADR required.
- **B137-P2-07** — `cli-smoke.test.ts` flake investigation (12/15 fail standalone, pre-existing).

Per CTO recommendation: spikes need fresh focus, not end-of-session bandwidth.

### P3 — Governance debt (3 items)

| ID | Item | Urgency | Notes |
|----|------|---------|-------|
| B137-P3-01 | **12 leaked secrets rotation** — ANTHROPIC, OPENAI, GOOGLE/GEMINI, GITHUB_TOKEN, MTCLAW, AI_PLATFORM, TELEGRAM_BOT, ZALO_BOT, GATEWAY_TOKEN, OLLAMA_REMOTE | **HIGH** (per CTO 2026-04-19) | CEO should `git log -p` the leaked keys, identify revoked vs live, rotate live ones **THIS WEEK** via each vendor's console. Not "do later" if any keys still valid. |
| B137-P3-02 | ADR-048 `authority:` field audit (machine-readable countersign structure) | Standard | ~15-30 min standalone tooling task; CTO countersign retroactive expansion owed. |
| B137-P3-03 | `.sdlc-framework/` gitignore trailing-slash tweak | Trivial | Batch with next docs commit. |

### P1 (deferred originally, remains deferred)

- CLAUDE.md `CURRENT-SPRINT.md` pointer update (done as part of this close).

## Outstanding CTO obligation

**ADR-048 countersign expansion** — carry to Sprint 137b or 138, per CTO note. Tracked as P3-02 above.

## Notable architectural wins from the session

1. **Single-owner discipline for progress UX.** P0-01 (removed dual-emit) + A8 (edit-in-place) + A9 (channel-native stubs) compose into one consistent story: `replyFn` is the single owner; `isProgress: boolean` is the only bus contract; Telegram/Zalo/Web each own their adapter-local state and translate to native UX. No Telegram-specific message-id ever crosses the bus boundary.

2. **Contract tests as drift detectors.** P2-01 + P2-02 together mean the OpenAPI spec and the gateway source cannot silently diverge — any `registerMethod` addition or removal fails the contract test until the spec is regenerated. Same pattern would have caught the Sprint 135 `SENSITIVE_COMMANDS` gap.

3. **LOCAL-ONLY identity lock enforced in new artifacts.** OWASP triage, OpenAPI description, AGENTS.md, CLAUDE.md, PREAMBLE.md all cite the handoff boundary consistently. Remote hardening suggestions get triaged as "informational, MTClaw territory" without needing per-request judgement.

## Session stats

- Duration: 1 working day.
- Items shipped: 11 of 21 (52%).
- Commits: 9 (8 net-new on top of the DRAFT plan commit).
- Tests added: +45.
- Lines added (by batch): P0 ~158, P1 ~100 docs, P1 UX ~520 + 12 tests, P2 ~1918.

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | Sprint 137 Partial Close — 2026-04-19*
