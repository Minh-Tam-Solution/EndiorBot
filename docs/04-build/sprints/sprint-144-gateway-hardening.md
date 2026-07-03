---
sprint: 144
status: COMPLETE
start_date: 2026-04-27
end_date: 2026-04-27
planned_duration: 2-3d
framework: "6.4.0"
authority:
  proposer: "@pm + @architect"
  countersigners: ["@cto G2 pre-cleared 2026-04-27"]
  trigger: "Gateway Architecture Review (Sprint 143 CEO testing session — 7 production issues in 2h)"
previous_sprint: "Sprint 143 — Gate Mark + Provider Resilience (7 hotfixes shipped)"
references:
  - docs/02-design/14-Technical-Specs/gateway-architecture-review-sprint-143.md
---

# Sprint 144 — Gateway Hardening (Operational Resilience)

## Context

Sprint 143 CEO testing exposed 7 production issues in a 2-hour Telegram session. All were hotfixed same-day, but 4 underlying architectural gaps remain that config alone can't prevent. This sprint closes those gaps.

**Identity guard:** All items are operational resilience — no new features, no platform creep. Solo Developer Power Tool stays the same; it just stops breaking under real-world usage patterns.

---

## P0 — Must Ship (blocks CEO daily usage)

### T1: PID Lockfile — Singleton Serve Enforcement (~1h)

**Gap 3 fix:** Multiple `endiorbot serve` processes cause Telegram 409 conflicts → duplicate messages.

**What:**
- On startup: write PID to `~/.endiorbot/serve.pid`
- If lockfile exists: read PID, check if process alive (`kill -0`)
  - Alive → print error "EndiorBot already running (PID N). Use --force to take over." → exit 1
  - Dead → overwrite lockfile, proceed
- `--force` flag: kill existing process, take lockfile
- On shutdown (SIGTERM/SIGINT): delete lockfile
- On crash: stale lockfile cleaned on next startup (dead PID check)

**Files:**
- `src/cli/commands/serve.ts` — lockfile acquire/release/force logic (~50 LoC)
- `src/gateway/web-server.ts` — register shutdown hook to delete lockfile

**Tests:**
- Lockfile created on serve start
- Second serve attempt without --force → exits with error
- --force kills existing + takes over
- Stale lockfile (dead PID) → cleaned automatically

**Success:** CEO cannot accidentally run 2 serve processes. Zero duplicate messages from process competition.

---

### T2: Provider Health Circuit Breaker (~3h)

**Gap 4 fix:** Dead providers waste 180s before fallback kicks in.

**What:** Reuse `CircuitBreaker` pattern from Active Memory (Sprint 133 S1):
- Track consecutive failures per provider (CC Bridge, Kimi, Ollama, OpenAI, Gemini)
- After **2 consecutive failures** → circuit OPEN → skip provider for 60s cooldown
- After cooldown → HALF-OPEN → try one request
  - Success → circuit CLOSED (provider recovered)
  - Failure → circuit OPEN again (extend cooldown to 120s)
- Provider-specific failure classification:
  - CC Bridge TIMEOUT → counts as failure
  - CC Bridge RATE_LIMITED → counts as failure
  - Kimi "Unexpected token" / connection refused → counts as failure
  - Transient network blip (single 5xx) → does NOT count (avoid flapping)

**Files:**
- `src/agents/router/provider-circuit-breaker.ts` (NEW, ~120 LoC — reuse AM circuit breaker pattern)
- `src/agents/router/providers.ts` — wrap each provider call with circuit check
- `src/agents/channel-router.ts` — skip circuit-open providers in callAI dispatch

**Tests:**
- 2 failures → circuit opens → provider skipped → fallback runs immediately
- Cooldown expires → half-open → success → closes
- Transient single failure → circuit stays closed
- Reset on serve restart (fresh state)

**Success:** After CC Bridge times out twice, subsequent @agent calls skip CC immediately → CEO gets Kimi/cloud response in <30s instead of waiting 180s.

---

## P1 — Should Ship (significant UX improvement)

### T3: OTT Timeout Reduction — 60s CC + Fast Fallback (~1h)

**CTO-endorsed observation #4:** OTT users expect chat-like responsiveness. 180s before fallback is too long for Telegram.

**What:** Channel-aware timeout:
- OTT path (Telegram/Zalo): CC Bridge timeout = **60s**, then immediate fallback
- CLI path: CC Bridge timeout = **180s** (user at terminal, more patient)
- Web API path: same as OTT (60s)

**Implementation:**
- `src/bus/consumer.ts` — pass `originChannel` metadata to ingress
- `src/gateway/ingress.ts` — pass channel to router
- `src/agents/channel-router.ts` — timeout selection: `channel === "cli" ? 180_000 : 60_000`

**Files:**
- `src/agents/channel-router.ts` — channel-aware timeout in callAI (~10 LoC)
- `src/bus/consumer.ts` — thread channel into metadata (~5 LoC)

**Success:** CEO on Telegram → CC fails → Kimi responds within 90s total (60s CC + 30s Kimi), not 210s (180s CC + 30s Kimi).

---

### T4: Deprecate Kimi Subprocess Spawner (~1h)

**Gap 6 fix:** Subprocess spawner is unreliable (health check races, stale processes, short-lived auth).

**What:**
- Mark `startKimiProxy()` as deprecated in code
- Add startup log: "⚠️ Kimi subprocess spawner deprecated. Set ENDIORBOT_KIMI_PROXY_URL for reliable fallback."
- Update `docs/06-deploy/README.md` with recommended external proxy setup
- If `ENDIORBOT_KIMI_PROXY_URL` is set → skip subprocess spawn entirely (already implemented)
- If neither URL nor binary → graceful skip (no error spam)

**Files:**
- `src/providers/kimi-proxy/subprocess-orchestrator.ts` — add deprecation notice + skip logic (~10 LoC)
- `docs/06-deploy/README.md` — add "Kimi Proxy Setup" section

**Success:** No more health check failures in startup logs. CEO manages proxy lifecycle independently.

---

## P2 — Backlog (Sprint 145 if capacity)

| Item | Effort | Notes |
|------|--------|-------|
| Unified ProviderDispatcher refactor | 4-6h | Gap 1 — consolidate 5 provider functions into 1 dispatch interface |
| Dead-letter queue for failed messages | 2h | Gap 2 — R03 plain-text fallback covers 80%; DLQ covers edge cases |
| Agent request queuing (beyond session lock) | 3h | CEO observation #1 — queue instead of reject duplicate requests |

---

## Sequencing

```
Day 1: T1 (PID lockfile, 1h) + T2 (circuit breaker, 3h)
Day 2: T3 (OTT timeout, 1h) + T4 (deprecate subprocess, 1h) + integration test
Day 3: Buffer / P2 if ahead of schedule
```

---

## Test Plan

| Component | Tests |
|-----------|-------|
| PID lockfile | create/detect/force/stale cleanup (4 tests) |
| Circuit breaker | open/close/half-open/transient-skip/reset (5 tests) |
| OTT timeout | channel-aware dispatch verifies 60s for telegram, 180s for cli (2 tests) |
| Subprocess deprecation | build clean + no startup error without proxy (1 test) |

Estimated: ~12 new tests. Full regression against 8,100+ existing.

---

## Success Criteria

- **SSC-1:** Cannot start 2 serve processes simultaneously (PID lock prevents)
- **SSC-2:** After 2 CC timeouts, 3rd @agent call skips CC → responds via Kimi in <30s
- **SSC-3:** OTT @agent call: total time-to-response ≤ 90s even when CC is down
- **SSC-4:** Startup logs show no "health check failed" spam when using external proxy URL
- **SSC-5:** All 8,100+ tests pass; build clean

---

## Verification (CEO can test)

```bash
# T1: Try double serve
endiorbot serve &
endiorbot serve       # Should fail: "Already running (PID N)"
endiorbot serve --force  # Should kill + take over

# T2: Circuit breaker
# After 2 @agent timeouts on Telegram, 3rd call should be fast (<30s)

# T3: OTT vs CLI
# Telegram: @pm plan sprint → response within 90s (60s CC attempt + 30s fallback)
# CLI: endiorbot @pm "plan sprint" → waits up to 180s before fallback

# T4: External proxy
ENDIORBOT_KIMI_PROXY_URL=http://127.0.0.1:18765 endiorbot serve
# Startup should NOT show "Starting claude-code-proxy..." or health check errors
```

---

## Dependencies

- T2 (circuit breaker) benefits from T3 (OTT timeout) — faster first-failure detection feeds circuit state faster
- T4 (deprecate subprocess) is independent — can ship in any order
- T1 (PID lockfile) is independent — ship first for immediate value

---

*EndiorBot | Solo Developer Power Tool | SDLC 6.4.0 | Sprint 144 Draft — 2026-04-27*
