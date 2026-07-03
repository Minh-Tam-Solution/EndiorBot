---
sprint: 142
status: G1 APPROVED — CTO conditions C1+C2 resolved
start_date: TBD
planned_duration: 3-5d
framework: "6.4.0"
authority:
  proposer: "@pm"
  countersigners: []
  trigger: "@architect anti-drift improvements + Sprint 141 carry-forward + provider refactor follow-ups"
previous_sprint: "Sprint 141 — Cost Telemetry + Ollama Confidence + Kimi Resilience"
references:
  - docs/02-design/01-ADRs/ADR-052-agent-model-tier-mapping.md
  - docs/04-build/sprints/sprint-141-plan.md
---

# Sprint 142 — Anti-Drift Improvements + Carry-Forward

## Context

Sprint 142 consolidates @architect anti-drift proposals (CTO + CPO reviewed), Sprint 141 carry-forward items, and provider refactor follow-ups from Sprint 142 hotfix (`ab17eca`, `1029e9a`).

**Key findings driving this sprint:**
- CTO: "every 10 turns inject vision" is aspirational, NOT implemented
- CPO: kill switch semantics inconsistent (fixed in `1029e9a`)
- CEO: cloud providers (Kimi/OpenAI) need codebase content, not just git state
- Sprint 141: 6 carry-forward items pending

---

## P0: Anti-Drift Architecture Improvements

### P0-1: Turn-Based Vision Re-Injection (~2h)

Implement the aspirational "every 10/20 turns" from CLAUDE.md.

**What:** Wire `turnBasedReInjection()` into `context-lifecycle.ts`. Every 10 turns: inject sprint goals summary. Every 20 turns: inject full sprint goals + project vision.

**CTO C2 — Dedup guard required:** `lastVisionInjectionTurn` field prevents double-injection when turn-based trigger overlaps with 30-min time-based refresh. Test: turn 10 + simultaneous 30-min refresh → ONE vision injection, not two.

**Files:**
- `src/context/transfer/context-lifecycle.ts` — add turn-based triggers in `incrementTurn()` + dedup guard
- `src/agents/context/context-injector.ts` — consume sprint goals from `sprint-goals.ts`

**Success:** After 10 turns in autonomous session, sprint goals appear in agent context. Dedup test passes.

### P0-2: Cloud Provider Content Enrichment (~3h)

Cloud providers only get git metadata. Need file content injection.

**CTO C1 — Resolved:** `formatWorkspaceContext()` = metadata only (branch, commits, diff). Layer 1.25 `WORKSPACE_AWARENESS_SECTION` = instruction only, bridge-only (does NOT flow to cloud). `ContextInjector` 7-layer pipeline = bridge-only. **Cloud providers get ZERO file content today. P0-2 justified.**

**What (rescoped):** Reuse existing `WORKSPACE_AWARENESS_SECTION` constant + read IDENTITY.md content. Inject into `buildEnrichedPrompt()` for all providers. No new file reader module — use `fs.readFileSync` with 500-token truncation.

**Files:**
- `src/agents/router/providers.ts` — extend `buildEnrichedPrompt()` to include workspace awareness + IDENTITY.md
- Import `WORKSPACE_AWARENESS_SECTION` from `../context/workspace-awareness.js`

**Success:** `@pm check sprint readiness` via Kimi → response references project identity and constraints.

### P0-3: Active Memory Latency Logging (~1h)

Log cache-hit/miss latency even when FF off. CEO needs data to decide enable.

**What:** Add latency telemetry to `active-memory.ts` that fires regardless of FF state. After 1 week, present report to CEO.

**Files:**
- `src/agents/intelligence/active-memory.ts` — add timing logs even in FF-off path

**Success:** `endiorbot cost report` shows Active Memory latency stats.

---

## P1: Sprint 141 Carry-Forward

### P1-1: Expert Routing Phase 2 — Active Influence

When `FF_EXPERT_ROUTING_ENABLED=true` + 50+ records accumulated, historical performance scoring influences routing decisions.

**Files:**
- `src/providers/expert-routing.ts` — add active routing mode
- `src/config/feature-flags.ts` — register `EXPERT_ROUTING_ENABLED`

### P1-2: FF_OLLAMA_AUTO_ESCALATE Enable Decision

After 3-day data collection, decide whether to enable. Depends on P0-3 latency data.

### P1-3: Stability Guard Write-Side Instrumentation

CTO blocker from Sprint 141: 3/4 guards inert (`riskyOpTimestamps`, `tasksSinceLastCheckpoint`, `lastCheckpointAt` never written).

**Files:**
- `src/sessions/autonomous/manager.ts` — wire write-side in `executeTask()`

---

## P2: Architecture Docs + Future

### P2-1: Context Transfer Threshold Tuning (~30min)

Make swap threshold configurable: `ENDIORBOT_CONTEXT_TRANSFER_THRESHOLD` env var (default 0.1).

### P2-2: Brain L2 Pattern Matching Activation (~4h)

Wire error-pattern matching into `FailureClassifier` → check Brain L2 → inject matching patterns into retry prompt.

### P2-3: 17th Mechanism Documentation (~30min)

Add SOUL-level Workspace Awareness to architecture docs (CTO correction).

---

## Sequencing

```
Day 1: P0-1 (turn-based re-injection) + P0-3 (Active Memory logging)
Day 2: P0-2 (cloud provider content enrichment)
Day 3: P1-3 (stability guard instrumentation)
Day 4: P1-1 (expert routing Phase 2) + P2-1/P2-3 (docs + threshold)
Day 5: Integration testing + P1-2 decision
```

---

## Test Plan

| Component | Tests |
|-----------|-------|
| Turn-based re-injection | Mock turn counter → verify vision injected at turn 10, 20 |
| Cloud content enrichment | Mock file reader → verify IDENTITY.md content in enriched prompt |
| Active Memory logging | Verify latency logged even with FF off |
| Stability guard writes | Integration: run task → verify counters increment |
| Expert routing Phase 2 | Mock 50+ records → verify routing recommendation applied |

Estimated: ~12-15 new tests. Full regression against 8,100+ tests.

---

## Success Criteria

- **SSC-1:** Turn-based vision re-injection fires at turn 10 and 20 (verified by test)
- **SSC-2:** `@pm check sprint readiness` via Kimi includes project identity in response
- **SSC-3:** Active Memory latency data collected for 1 week
- **SSC-4:** Stability guard 4/4 guards functional (not 1/4)
- **SSC-5:** Full test suite passes; `pnpm build` clean

---

## Evidence Matrix — Anti-Drift Triggers (Post-Sprint 142)

| Trigger | Wired | Function | Sprint |
|---------|-------|----------|--------|
| Session start: SOUL + L1.25 + Brain L4 | ✅ | context-injector.ts:178 | 55 |
| Every turn: buildEnrichedPrompt | ✅ | providers.ts:76 | 142 |
| **Every 10 turns: vision re-inject** | **✅ (P0-1)** | context-lifecycle.ts | **142** |
| **Every 20 turns: sprint goals** | **✅ (P0-1)** | context-lifecycle.ts | **142** |
| Every 30 turns: hard reset | ✅ | context-budget.ts:281 | 54 |
| Every 30 min: context refresh | ✅ | context-lifecycle.ts:194 | 97 |
| Every 5 patches: checkpoint | ✅ | checkpoint/scheduler.ts | 69 |
| Per-query: Active Memory | ✅ (FF-off, CEO decides) | active-memory.ts | 133 |

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | Sprint 142 Draft — 2026-04-26*
