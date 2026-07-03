---
project: EndiorBot
sprint: 139
sdlc_stage: "03-INTEGRATE"
gate: G2-G3
date: 2026-04-20
related_adr: ADR-050
related_ts: TS-050
---

# Sprint 139 — Integration Specification

## Purpose

Documents how the 4 OpenMythos-inspired evaluator loop patterns (ADR-050) integrate with EndiorBot's existing runtime components. Defines data flow contracts, component boundaries, and the telemetry wiring that enables the 30-session benchmark (CPO requirement).

**Upstream:** [ADR-050](../02-design/01-ADRs/ADR-050-openmythos-evaluator-optimization-patterns.md) + [TS-050](../02-design/14-Technical-Specs/TS-050-Evaluator-OpenMythos-Integration.md)
**Downstream:** Implementation (Stage 04, Sprint 139 plan) → Tests (Stage 05, `tests/evaluator/`)

---

## Design ↔ Build ↔ Test Traceability

| Stage 01 Requirement | Stage 02 ADR/TS | Stage 04 File(s) | Stage 05 Test(s) |
|---------------------|-----------------|-------------------|-------------------|
| FR-139-1 (Convergence) | ADR-050 §1, TS-050 P0-1 | `src/evaluator/loop.ts` | `tests/evaluator/convergence-guard.test.ts` |
| FR-139-2 (Dynamic budget) | ADR-050 §2, TS-050 P0-2 | `src/evaluator/loop.ts`, `src/evaluator/types.ts` | `tests/evaluator/adaptive-budget.test.ts` |
| FR-139-3 (Frozen input) | ADR-050 §3, TS-050 P1-3 | `src/evaluator/optimizer.ts`, `src/evaluator/loop.ts` | `tests/evaluator/frozen-context.test.ts` |
| FR-139-4 (Loop-index) | ADR-050 §4, TS-050 P1-4 | `src/evaluator/optimizer.ts`, `src/evaluator/strategies/index.ts` | `tests/evaluator/loop-index.test.ts` |

---

## Integration Points

### 1. TaskComplexity flow (P0-2 wiring)

```
context-injector.ts          ingress.ts              channel-router.ts        loop.ts
      │                           │                        │                    │
      │ classify(request)         │                        │                    │
      │ → TaskComplexity          │                        │                    │
      ├───────────────────────────▶ inject complexity      │                    │
      │                           │ into metadata          │                    │
      │                           ├────────────────────────▶ callAI(agent,     │
      │                           │                        │ task, complexity)  │
      │                           │                        ├────────────────────▶
      │                           │                        │                    │ processResponse(
      │                           │                        │                    │   response,
      │                           │                        │                    │   threshold,
      │                           │                        │                    │   complexity)
```

**Contract:** `TaskComplexity` is a string union (`"simple" | "moderate" | "complex" | "critical"`) defined at `src/agents/types.ts:31`. It must be threaded as an optional parameter — never required — so existing callers that don't pass complexity continue to work with static defaults.

**Integration change needed:** `GatewayIngress.handleInbound()` → `ChannelRouter.routeMessage()` must accept and forward the complexity from the `InjectionRequest.classification` result. This is a parameter-threading exercise, not a new abstraction.

### 2. Convergence signal → failure classifier (P0-1 integration with CPO anti-churn)

```
loop.ts                    failure/classifier.ts       recovery/engine.ts
   │                              │                          │
   │ emitEvent(                   │                          │
   │   'convergence_halted')      │                          │
   ├──────────────────────────────▶ onConvergenceHalt()      │
   │                              │ → classify as            │
   │                              │   CONVERGED (new type)   │
   │                              ├──────────────────────────▶
   │                              │                          │ if (type === CONVERGED)
   │                              │                          │   → do NOT retry
   │                              │                          │   → return bestResponse
```

**Contract:** The convergence signal is an event (`type: 'convergence_halted'`), NOT a direct function call. The failure classifier subscribes to this event and classifies the failure as `CONVERGED` (a new failure type alongside `TRANSIENT | FIXABLE | DESIGN_ISSUE`).

**Integration change needed:**
- `src/sessions/failure/classifier.ts` — add `CONVERGED` to `FailureType` enum
- `src/sessions/recovery/engine.ts` — `CONVERGED` → action `ACCEPT_BEST` (return bestResponse, do not retry)

**Boundary:** This integration is OPTIONAL for Sprint 139. The convergence guard works independently inside `loop.ts` without the failure classifier integration. The classifier integration enhances the autonomous session's anti-churn behavior (CPO requirement) but is not required for the evaluator loop to function correctly.

### 3. Frozen context construction (P1-3 wiring)

```
loop.ts                                optimizer.ts
   │                                        │
   │ frozenContext = {                       │
   │   originalTask: response.task,          │
   │   soulIdentity: response.soul?.slice(   │
   │     0, 200),                            │
   │   constraints: "LOCAL-ONLY"             │
   │ }                                       │
   │                                         │
   │ for each iteration:                     │
   │   optimize(response, strategy,          │
   │     scoreCard, frozenContext,            │
   │     iterationIndex, totalIterations)     │
   ├─────────────────────────────────────────▶│
   │                                         │ prompt = frozenBlock
   │                                         │   + iterationGuidance
   │                                         │   + strategyInstruction
   │                                         │   + currentResponse
```

**Contract:** `FrozenContext` is constructed ONCE in `processResponse()` from the original response metadata. It is NOT re-computed per iteration — the same object reference is passed to every `optimize()` call. The `originalTask` field is capped at 500 tokens (CTO condition) using a simple character-based truncation (`Math.ceil(chars / 4)` as token estimate).

**No upstream integration needed:** the `response.task` field (CEO's original question) is already available in `AgentResponse` — the frozen context is constructed locally from existing data.

### 4. Strategy selection with iteration index (P1-4 wiring)

```
loop.ts                    strategies/index.ts
   │                              │
   │ selectStrategy(              │
   │   scores,                    │
   │   iterationIndex)   ────────▶│
   │                              │ if (iterationIndex <= 0):
   │                              │   prioritize('rephrase', 'add-context')
   │                              │ elif (iterationIndex >= 2):
   │                              │   prioritize('escalate-model', 'decompose')
   │                              │ else:
   │                              │   default priority
   │  ◀──────────────────────────── return strategy
```

**Contract:** `selectStrategy()` gains an optional `iterationIndex?: number` parameter. When omitted (backward compat), default priority ordering applies. When present, strategy weights shift as documented in TS-050.

---

## Budget Integration

### Per-complexity budget (CPO requirement)

The `src/models/model-selector.ts` `selectModel()` method already accepts `failureCount` for tier escalation. For Sprint 139 P0-2, the complexity signal additionally informs tier selection:

| Complexity | Starting tier | Escalation policy |
|-----------|--------------|-------------------|
| `simple` | EFFICIENCY (Haiku) | No escalation — keep cheap |
| `moderate` | STANDARD (Sonnet) | Escalate after 1 failure |
| `complex` | STANDARD (Sonnet) | Escalate after 2 failures |
| `critical` | ELITE (Opus) | Start at top — no ramp-up |

**Integration change needed:** `ModelSelector.selectModel()` gains optional `complexity?: TaskComplexity`. When `critical`, skip the EFFICIENCY→STANDARD ramp and start at ELITE directly.

**Budget guard:** `SessionBudget.isOpusCapReached()` in `src/models/session-budget.ts` still applies — even critical tasks can't exceed the $3 Opus cap per session.

---

## Telemetry Contract

### Counters emitted by the evaluator loop

| Counter name | Emission point | Value | Consumer |
|-------------|----------------|-------|----------|
| `convergence_halts` | When convergence guard triggers in `loop.ts` | 1 (increment) | `LoopMetrics.totalFailed` tracking + benchmark script |
| `iteration_budget_savings` | After loop exits in `loop.ts` | `staticMaxRetries - actualIterations` | Benchmark: average savings per complexity class |
| `frozen_context_tokens` | When frozen context is prepended in `optimizer.ts` | Token count (int) | Monitoring: track prompt bloat |
| `iteration_budget_applied` | When complexity overrides limits in `loop.ts` | `{ complexity, staticMax, effectiveMax }` | Debug: verify wiring |

### Emission mechanism

All counters emit through the existing `this.emitEvent()` mechanism in `EvaluatorLoop`. Events are consumed by `LoopMetrics` (in-memory counters) and can be polled via `loop.getMetrics()`. No new event infrastructure needed.

### Benchmark script integration

The 30-session benchmark (CPO test plan) should read `loop.getMetrics()` after each session and compare:
- `convergence_halts / totalEvaluated` → target >10% (SC-1)
- `iteration_budget_savings` by complexity class → target: simple=3, moderate=2, complex=0, critical=-2
- `frozen_context_tokens` average → target <500 (CTO cap)

---

## Test Integration Boundaries

### Unit tests (isolated, mocked dependencies)

| Test | Scope | Mocked |
|------|-------|--------|
| Convergence guard | `loop.ts` for-loop logic | `Evaluator`, `Optimizer` |
| Dynamic budget | `processResponse()` limit resolution | `Evaluator`, `Optimizer` |
| Frozen context | `optimizer.ts` prompt construction | AI provider |
| Loop-index | `selectStrategy()` + `optimize()` prompt | AI provider |

### Integration tests (wired, real components)

| Test | Scope | Real components |
|------|-------|-----------------|
| TaskComplexity flow | ingress → router → evaluator | `ContextInjector`, `ChannelRouter`, `EvaluatorLoop` |
| Convergence → failure-classifier | loop event → classifier → recovery | `EvaluatorLoop`, `FailureClassifier`, `RecoveryEngine` |

### What is NOT tested in Sprint 139

- Budget integration (ModelSelector complexity wiring) — deferred to Sprint 140 with Phase-Specific Behavior
- Full 30-session benchmark — requires all 4 items shipped + telemetry collection infrastructure

---

## OpenAPI Impact

Sprint 139 changes are **internal to the evaluator loop** — no new gateway routes, no new JSON-RPC methods, no REST endpoints. **OpenAPI spec regeneration is NOT needed.**

If future sprints expose telemetry counters via the gateway (e.g., `GET /api/evaluator/metrics`), regenerate at that point.

---

## Gate Evidence

### G2 (Design approved — Stage 02)

- [x] ADR-050 authored: FULL status, @cto approved with conditions
- [x] TS-050 authored: implementation detail for all 4 patterns
- [x] No conflicts with existing ADRs (checked ADR-010, ADR-046, ADR-044)

### G3 (Contracts aligned — Stage 03)

- [x] All integration points documented with data flow diagrams
- [x] Budget integration contract defined (complexity → tier mapping)
- [x] Telemetry contract defined (4 counters + emission mechanism)
- [x] Test boundaries delineated (unit vs integration)
- [x] OpenAPI impact assessed (none for Sprint 139)

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | Sprint 139 Integration Spec — 2026-04-20*
