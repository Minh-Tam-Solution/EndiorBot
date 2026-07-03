---
project: EndiorBot
version: "1.0.0"
date: 2026-04-20
sdlc_stage: "01-PLANNING"
identity: "Solo Developer Power Tool (LOCKED, LOCAL-ONLY)"
sprint: 139
gate: G1
status: COMPLETE
closed: 2026-04-20
authority:
  proposer: "@pm"
  countersigners:
    - actor: "@cto"
      date: "2026-04-20"
      reference: "Session review — approved P0+P1 items with conditions"
  trigger: "CEO-directed OpenMythos research → selective pattern adoption"
---

# Sprint 139 — Requirements Specification ✅ COMPLETE

## Executive Summary

EndiorBot's evaluator loop (`src/evaluator/loop.ts`) runs a fixed-depth optimization cycle for every agent response — regardless of task complexity. Simple CEO questions (the majority) pay the same API cost and latency as critical architecture decisions. OpenMythos's Recurrent-Depth Transformer architecture demonstrates four patterns that translate to EndiorBot's agent domain: convergence-based halting, variable-depth iteration, frozen context anchoring, and iteration-aware prompting.

**Adoption plan:** [`.claude/plans/fuzzy-baking-pnueli.md`](../../.claude/plans/fuzzy-baking-pnueli.md)
**Sprint plan:** [`docs/04-build/sprints/sprint-139-plan.md`](../04-build/sprints/sprint-139-plan.md)

---

## Functional Requirements

### FR-139-1: Convergence-Based Early Stop (ACT analog)

**Source:** OpenMythos ACT halting (main.py:707-737)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-139-1.1 | Evaluator loop detects monotonic score decline over 2+ consecutive iterations and halts, returning best-scored response | P0 | Test: mock declining scores → loop exits after 2 declines, NOT after `maxRetries` |
| FR-139-1.2 | Flat score after a decline counts as non-convergence (uses `<=` comparison per CTO) | P0 | Test: score sequence [70, 65, 65] → halts at iteration 3; [70, 65, 66] → does NOT halt (uptick resets counter) |
| FR-139-1.3 | Convergence halt event emits a telemetry counter (`convergence_halts`) | P0 | Test: counter increments when guard triggers; does NOT increment on normal PASS or maxRetries exhaustion |
| FR-139-1.4 | Convergence signal feeds into `FailureClassifier` to prevent autonomous session over-fixing (CPO: anti-churn) | P0 | Test: after convergence halt, recovery engine does not retry the same task |

**Rollback criterion:** if convergence guard triggers on >40% of evaluator runs, the threshold is too aggressive → revert.

---

### FR-139-2: Dynamic Iteration Budget (Variable-depth analog)

**Source:** OpenMythos variable loop count (`max_loop_iters: 1-64`)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-139-2.1 | Evaluator `processResponse()` accepts optional `complexity?: TaskComplexity` and overrides `maxRetries` + `passThreshold` per complexity class | P0 | Test: `simple` → 0 iterations (skip eval); `critical` → 5 max iterations |
| FR-139-2.2 | Complexity-to-loop mapping: `simple=0/0`, `moderate=1/50`, `complex=3/65`, `critical=5/75` | P0 | Test: each complexity level produces the correct iteration count |
| FR-139-2.3 | Simple tasks bypass the evaluator entirely (zero API calls to evaluator model) | P0 | Test: simple-complexity request completes with 0 evaluator invocations |
| FR-139-2.4 | `TaskComplexity` signal flows from `context-injector.ts` through the call chain to evaluator | P0 | Integration test: inject complexity at ingress, verify it reaches `processResponse()` |
| FR-139-2.5 | Telemetry counter tracks iteration-budget-savings (how many iterations were saved vs. static `maxRetries`) | P0 | Test: counter emits savings = `staticMaxRetries - actualIterations` per request |

**Rollback criterion:** if simple-task latency doesn't improve (still >5s), the skip-eval path isn't wired correctly → investigate.

---

### FR-139-3: Frozen Input Injection (Context anchoring in eval loop)

**Source:** OpenMythos frozen input `e` re-injection (main.py:870-880)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-139-3.1 | `Optimizer.optimize()` accepts a `frozenContext: FrozenContext` parameter containing the original CEO task + SOUL identity | P1 | Test: mock optimizer → verify `frozenContext.originalTask` appears in every optimization prompt across 3 iterations |
| FR-139-3.2 | Frozen context is capped at 500 tokens (per CTO condition); truncated with `[...truncated]` marker if exceeded | P1 | Test: inject a 1000-token task → verify truncation to 500 tokens in the prompt |
| FR-139-3.3 | Frozen context is constructed once in `processResponse()` and reused across all iterations (not re-computed per iteration) | P1 | Test: `frozenContext` object identity is the same across iterations |
| FR-139-3.4 | Telemetry counter tracks frozen-context-token-usage per request | P1 | Test: counter emits token count of the frozen context |

**Rollback criterion:** if frozen context consistently pushes prompt above model's context window → reduce cap or remove.

---

### FR-139-4: Loop-Index Aware Optimization

**Source:** OpenMythos loop-index embedding (main.py:506-535)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-139-4.1 | `Optimizer.optimize()` accepts `iterationIndex: number` and `totalIterations: number` | P1 | Test: signature accepts the parameters; values are correct at each iteration |
| FR-139-4.2 | Optimization prompt text varies by iteration tier: early (1), middle (2), late (3+) | P1 | Test: extract prompt text at iterations 1, 2, 3 → all three are distinct |
| FR-139-4.3 | Strategy selection considers iteration number: early → low-risk (rephrase, add-context); late → aggressive (decompose, escalate-model) | P1 | Test: strategy `selectStrategy()` returns different priority ordering at iteration 1 vs 3 |

**Rollback criterion:** if later-iteration strategies produce worse results than early ones → remove iteration-aware prompting.

---

## Non-Functional Requirements

| ID | Requirement | Target | Priority |
|---|---|---|---|
| NFR-139-1 | Simple-task end-to-end latency (with eval skip) | <5 seconds | P0 |
| NFR-139-2 | Convergence guard hit rate (percentage of loops halted early) | >10% of evaluator runs | P0 |
| NFR-139-3 | Test suite regression | 0 regressions in 8K+ existing tests | P0 |
| NFR-139-4 | New test coverage | 20-30 new tests for all 4 adoptions | P0 |
| NFR-139-5 | Build health | `pnpm build` clean on every commit | P0 |
| NFR-139-6 | Frozen context token overhead | <500 tokens per request (CTO cap) | P1 |
| NFR-139-7 | TypeScript type safety | `exactOptionalPropertyTypes` compliance on all new interfaces | P1 |

---

## Success Criteria Mapping

| SC | Description | Validates | Measured by | Result |
|----|-------------|-----------|-------------|--------|
| SC-1 | Convergence guard halts ≥10% of loops | FR-139-1, NFR-139-2 | Telemetry counter `convergence_halts` / total evaluator runs | ✅ PASS |
| SC-2 | Simple-task evaluator path skips all iterations | FR-139-2.3, NFR-139-1 | Telemetry counter `iteration_budget_savings` | ✅ PASS |
| SC-3 | Frozen context in 100% of optimization prompts | FR-139-3.1 | Test assertion | ✅ PASS |
| SC-4 | Loop-index prompt varies by iteration | FR-139-4.2 | Test assertion | ✅ PASS |
| SC-5 | Full test suite green | NFR-139-3, NFR-139-5 | `pnpm test` exit code 0 | ✅ PASS (8,124+ tests) |

---

## Traceability

| Requirement | Sprint Plan Item | ADR | Test |
|-------------|-----------------|-----|------|
| FR-139-1 | P0-1 (Convergence Early Stop) | ADR-050 §1 | `tests/evaluator/convergence-guard.test.ts` |
| FR-139-2 | P0-2 (Dynamic Iteration Budget) | ADR-050 §2 | `tests/evaluator/adaptive-budget.test.ts` |
| FR-139-3 | P1-3 (Frozen Input Injection) | ADR-050 §3 | `tests/evaluator/frozen-context.test.ts` |
| FR-139-4 | P1-4 (Loop-Index Optimization) | ADR-050 §4 | `tests/evaluator/loop-index.test.ts` |

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | Sprint 139 Requirements — 2026-04-20 | Status: COMPLETE*
