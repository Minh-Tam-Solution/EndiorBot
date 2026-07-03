---
sprint: 139
status: DRAFT — OpenMythos selective architecture adoption (Sprint A from adoption plan)
start_date: 2026-04-20
planned_duration: ~1-2d
framework: "6.4.0"
authority:
  proposer: "@pm"
  countersigners:
    - actor: "@cto"
      date: "2026-04-20"
      grade: "APPROVED with conditions"
      reference: "Session review — verified 15 files, approved P0+P1 items, conditions on Sprint 140-141"
  trigger: "CEO-directed research of kyegomez/OpenMythos → selective pattern adoption per @architect/@cpo/@cto analysis"
  notes: "Sprint A of the 3-sprint adoption roadmap (139→141). P0 items are low-risk, high-value; P1 items are low-risk additive."
previous_sprint: "Sprint 138 — Governance Debt + Security Incident Remediation"
references:
  - docs/04-build/sprints/sprint-138-plan.md
  - .claude/plans/fuzzy-baking-pnueli.md (full adoption assessment)
---

# Sprint 139 — OpenMythos Pattern Adoption (Sprint A)

## Context

CEO requested a research assessment of [OpenMythos](https://github.com/kyegomez/OpenMythos) (Recurrent-Depth Transformer architecture). @devops researched the codebase, @architect designed the pattern mapping, @cpo provided ROI-prioritized adoption proposals, @cto reviewed and approved with conditions. The full adoption plan lives at `.claude/plans/fuzzy-baking-pnueli.md`.

Sprint 139 implements the **4 highest-ROI items** (Sprint A from the roadmap):

| # | Item | OpenMythos source | Effort | Priority |
|---|------|-------------------|--------|----------|
| 1 | Convergence-Based Early Stop | ACT halting (main.py:707-737) | ~30 min | P0 |
| 2 | Dynamic Iteration Budget | Variable loop depth (max_loop_iters) | ~2-4h | P0 |
| 3 | Frozen Input Injection | Frozen `e` re-injection (main.py:870-880) | ~1-2h | P1 |
| 4 | Loop-Index Aware Optimization | Loop-index embedding (main.py:506-535) | ~1-2h | P1 |

## CTO conditions (binding)

1. **Convergence check uses `<=` not `<`** — flat score after decline counts as non-convergence (prevents plateau waste).
2. **Frozen context capped at 500 tokens** — CEO questions are typically <100 tokens; prevents prompt bloat.
3. **Rollback criteria per adoption** — if convergence guard triggers on >40% of requests, threshold is too aggressive.
4. **Telemetry counters** — add metrics for: convergence-halts, iteration-budget-savings, frozen-context-token-usage.

## P0-1: Convergence-Based Early Stop

**What:** Add monotonic-decline detection to the evaluator loop. If score declines or plateaus for 2 consecutive iterations, halt and return best response.

**Why:** Currently the loop runs all `maxRetries` even when scores are declining — wastes API calls and latency on oscillating/declining optimization attempts.

**Files:**
- `src/evaluator/loop.ts` (lines 260-320) — `consecutiveDeclines` counter in the main for-loop (~10 lines)
- `src/sessions/failure/classifier.ts` — convergence signal feeds failure classifier (CPO: prevents autonomous session over-fixing)
- `src/sessions/recovery/engine.ts` — recovery engine respects convergence (CPO: anti-churn)

**Rollback criterion:** if convergence guard triggers on >40% of evaluator runs, revert.

## P0-2: Dynamic Iteration Budget

**What:** Wire the existing `TaskComplexity` signal into the evaluator loop so iteration depth adapts per request.

| Complexity | maxRetries | passThreshold | Effect |
|-----------|-----------|---------------|--------|
| `simple` | 0 | 0 | Skip eval entirely — fast path |
| `moderate` | 1 | 50 | One shot, low bar |
| `complex` | 3 | 65 | Full loop |
| `critical` | 5 | 75 | Extended loop, high bar |

**Why:** Simple CEO questions (the majority) don't need evaluator overhead. Critical architecture decisions need deeper quality assurance. Currently all requests get the same `maxRetries: 3`.

**Files:**
- `src/evaluator/types.ts` — `ADAPTIVE_LOOP_PARAMS` map
- `src/evaluator/loop.ts` — `processResponse()` accepts optional `complexity`
- `src/agents/context/context-injector.ts` — already has complexity; pass downstream
- `src/models/model-selector.ts` — tier escalation keyed by complexity (CPO: critical → ELITE directly)
- `src/budget/budget-tracker.ts` — per-phase budget constraints

**Rollback criterion:** if simple-task latency doesn't improve (still >5s), the skip-eval path isn't wired correctly.

## P1-3: Frozen Input Injection

**What:** Add a `frozenContext` parameter to `Optimizer.optimize()` so the original CEO task + SOUL identity are re-injected at every optimization iteration. Prevents quality drift in multi-iteration loops.

**Files:**
- `src/evaluator/optimizer.ts` — `optimize()` accepts + prepends `frozenContext`
- `src/evaluator/loop.ts` — construct `frozenContext`, pass to every `optimizer.optimize()` call

**Token cap:** 500 tokens (per CTO condition). Truncate if needed.

**Rollback criterion:** if frozen context pushes prompt above token budget consistently, reduce the cap or remove.

## P1-4: Loop-Index Aware Optimization

**What:** Include iteration number in optimization prompts so each retry is qualitatively different (not redundant).

**Prompt tiers:**
- Iteration 1: "Focus on the lowest-scoring dimension"
- Iteration 2: "Previous refinement insufficient — try a different approach"
- Iteration 3+: "Multiple attempts failed — consider restructuring entirely"

**Files:**
- `src/evaluator/optimizer.ts` — add `iterationIndex` + `totalIterations` to `optimize()` signature
- `src/evaluator/strategies/index.ts` — strategy selection considers iteration number

**Rollback criterion:** if later-iteration strategies produce worse results than early ones, remove iteration-aware prompting.

## Sequencing

1. **P0-1 first** (convergence guard) — smallest change, highest immediate value
2. **P0-2 second** (iteration budget) — biggest feature, builds on P0-1
3. **P1-3 third** (frozen input) — touches optimizer, independent of P0 work
4. **P1-4 last** (loop-index) — touches same files as P1-3, natural follow-on

## Test plan

| Adoption | Tests |
|----------|-------|
| P0-1 | Mock declining scores → verify loop exits at 2 consecutive declines; verify flat-after-decline also halts (CTO `<=` condition) |
| P0-2 | simple → 0 iterations; moderate → 1; complex → 3; critical → 5. Verify skip-eval fast path for simple tasks |
| P1-3 | Mock optimizer → verify original task text in every prompt across 3 iterations. Verify 500-token cap |
| P1-4 | Verify prompt text changes between iteration 1, 2, and 3. Verify strategy selection shifts |

Estimated: ~20-30 new tests. Full regression sweep against existing 8K+ tests.

## Success criteria

- **SC-1:** Convergence guard halts at least 10% of loops that would have continued (measured via telemetry counter)
- **SC-2:** Simple-task evaluator path skips all iterations (0 API calls to evaluator)
- **SC-3:** Frozen context appears in 100% of optimization prompts (verified by test assertion)
- **SC-4:** Loop-index prompt varies by iteration (verified by test assertion)
- **SC-5:** Full test suite passes with no regressions; `pnpm build` clean

## Carry-forward to Sprint 140-141

| Sprint | Items | CTO conditions |
|--------|-------|---------------|
| 140 | Phase-Specific Behavior (Prelude/Recurrent/Coda) | 2-commit strategy: refactor-first (no behavior change), then feature |
| 141 | Stability Guard + Expert Routing | StabilityPolicy as simple interface, not framework. Expert routing behind FF_EXPERT_ROUTING_ENABLED, read-only first |

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | Sprint 139 Draft — 2026-04-20*
