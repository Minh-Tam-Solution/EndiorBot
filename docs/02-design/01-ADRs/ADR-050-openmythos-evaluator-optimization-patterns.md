---
adr: 050
status: "FULL — @cto approved 2026-04-20 with conditions; awaiting @cto countersign in frontmatter"
date: 2026-04-20
title: "OpenMythos Evaluator Optimization Patterns — Selective Architecture Adoption"
authority:
  proposer: "@pm"
  countersigners:
    - actor: "@cto"
      date: "2026-04-20"
      grade: "APPROVED with conditions"
      reference: "Session review — verified 15 files, approved P0+P1 items, conditions on Sprint 140-141"
  trigger: "CEO-directed research of kyegomez/OpenMythos (Recurrent-Depth Transformer). @devops/@architect/@cpo analysis identified 7 adoptable patterns; this ADR covers the Sprint 139 P0+P1 subset (4 items)."
  notes: "CTO waived separate STUB phase — this ADR ships FULL on first write because the adoption plan (.claude/plans/fuzzy-baking-pnueli.md) already went through multi-expert review."
sdlc_framework: "6.4.0"
supersedes: []
referenced_by: ["Sprint 139 plan", "sprint-139-requirements.md", "TS-050-Evaluator-OpenMythos-Integration.md", ".claude/plans/fuzzy-baking-pnueli.md"]
---

# ADR-050: OpenMythos Evaluator Optimization Patterns

**Status:** FULL — @cto approved 2026-04-20 with conditions.

## Binding Sentence (CTO Lock-in)

> **EndiorBot's evaluator loop adopts four OpenMythos-inspired patterns — convergence-detect, dynamic-budget, frozen-input, loop-index — to reduce API waste and improve per-request quality isolation. All patterns are guarded by CTO conditions (convergence uses `<=`, frozen context capped at 500 tokens, telemetry counters mandatory, rollback on >40% convergence misfire rate). Patterns that don't map to the agent domain (MLA/GQA attention, KV-cache, LoRA, multi-agent per request, full LTI math) are explicitly rejected.**

## Why This ADR Exists

CEO requested research of [OpenMythos](https://github.com/kyegomez/OpenMythos) (a Recurrent-Depth Transformer architecture implementing Prelude→RecurrentBlock→Coda with ACT halting, MoE routing, and LTI-stable injection). The analysis team (@devops research, @architect design, @cpo ROI prioritization, @cto review) identified that while OpenMythos is a language model architecture (not an agent framework), four of its conceptual patterns translate directly to EndiorBot's evaluator loop — the module responsible for iteratively improving agent responses.

The current evaluator loop (Sprint 72, ADR-010) uses fixed `maxRetries: 3` and fixed `passThreshold: 50` for all requests, regardless of task complexity. This means:
- Simple CEO questions (>60% of usage) pay 3 evaluator iterations of API cost
- Critical architecture decisions get the same shallow evaluation depth
- Declining loops waste iterations without convergence detection
- The optimizer can drift from the original task across iterations

## Context

### OpenMythos patterns and their agent-domain translations

| OpenMythos pattern | Neural network role | EndiorBot translation |
|---|---|---|
| **ACT halting** (main.py:707-737) | Per-position convergence → early stop | Per-iteration score decline → early loop exit |
| **Variable loop depth** (max_loop_iters) | Train on N loops, infer on N±k | `TaskComplexity` maps to iteration budget |
| **Frozen input injection** (main.py:870-880) | Re-inject encoded input `e` at every loop | Re-inject CEO's original task at every optimizer iteration |
| **Loop-index embedding** (main.py:506-535) | Sinusoidal signal → same weights behave differently per depth | Iteration number → different prompt strategy per attempt |

### EndiorBot existing infrastructure

| Component | File | Lines | Relevance |
|---|---|---|---|
| Evaluator loop orchestrator | `src/evaluator/loop.ts` | ~490 | Central modification target |
| Response re-generation | `src/evaluator/optimizer.ts` | ~300 | Frozen context + loop-index injection |
| Task complexity taxonomy | `src/agents/types.ts:31` | — | `"simple" \| "moderate" \| "complex" \| "critical"` already exported |
| Complexity-gated context injection | `src/agents/context/context-injector.ts` | ~370 | Already classifies complexity; needs to pass downstream |
| Strategy selection | `src/evaluator/strategies/index.ts` | ~200 | 5 built-in strategies (rephrase, decompose, escalate-model, add-context, reduce-scope) |
| Context anchoring (Sprint 65) | `src/context/context-anchor.ts` | 814 | Frozen injection is the eval-loop extension of this pattern |
| Failure classifier | `src/sessions/failure/classifier.ts` | 519 | Convergence signal feeds anti-churn (CPO) |
| Recovery engine | `src/sessions/recovery/engine.ts` | 557 | Stops retrying when convergence detected |

## Decision

Adopt the four patterns as additive changes to the evaluator loop. All changes are gated behind the existing `autoOptimize` config flag — if `autoOptimize: false`, no new behavior activates.

### 1. Convergence-Based Early Stop (P0)

**Change:** Add a `consecutiveDeclines` counter in the evaluator for-loop. After each evaluation, compare the current score to the previous iteration's score. If the score has declined or plateaued (using `<=` per CTO) for 2 consecutive iterations, break out of the loop and return `bestResponse`.

**CTO condition:** use `<=` not `<` — a flat score after a decline is still a signal that the loop isn't converging.

**Telemetry:** emit `convergence_halts` counter on every guard trigger.

**Rollback:** if convergence guard triggers on >40% of evaluator runs, the threshold is too aggressive — revert to unconditional loop.

### 2. Dynamic Iteration Budget (P0)

**Change:** `processResponse()` accepts an optional `complexity?: TaskComplexity` parameter. When provided, overrides `maxRetries` and `passThreshold` from the static config with complexity-aware values:

| Complexity | maxRetries | passThreshold | Rationale |
|-----------|-----------|---------------|-----------|
| `simple` | 0 | 0 | Skip eval entirely — fast path for trivial CEO questions |
| `moderate` | 1 | 50 | One evaluation shot with the existing threshold |
| `complex` | 3 | 65 | Current default behavior (full loop) |
| `critical` | 5 | 75 | Extended loop with higher quality bar |

**Flow:** `TaskComplexity` is already classified in `context-injector.ts` → needs to be threaded through `GatewayIngress` → `ChannelRouter` → `EvaluatorLoop.processResponse()`.

**Telemetry:** emit `iteration_budget_savings` = `staticMaxRetries - actualIterations` per request.

**Rollback:** if simple-task latency doesn't improve (still >5s), the skip-eval path isn't wired correctly — investigate wiring, don't revert the feature.

### 3. Frozen Input Injection (P1)

**Change:** Add a `FrozenContext` interface and pass it to `Optimizer.optimize()`:

```typescript
interface FrozenContext {
  originalTask: string;     // CEO's actual question (immutable across iterations)
  soulIdentity?: string;    // Agent SOUL content
  constraints?: string;     // Non-negotiable boundaries (e.g., "LOCAL-ONLY")
}
```

The frozen context is prepended to the optimization prompt at every iteration, ensuring the optimizer never loses sight of what the CEO actually asked. Analogous to OpenMythos's frozen `e` that prevents hidden state drift.

**CTO condition:** cap at 500 tokens. CEO questions are typically <100 tokens; the cap prevents prompt bloat from unusually long tasks.

**Existing pattern:** Sprint 65 Context Anchoring (`src/context/context-anchor.ts`) re-injects project vision every 10 turns. Sprint 135 workspace-awareness `as const` pattern is conceptually identical. This extends the same principle into the eval loop.

**Telemetry:** emit `frozen_context_token_usage` per request.

### 4. Loop-Index Aware Optimization (P1)

**Change:** `Optimizer.optimize()` receives `iterationIndex` and `totalIterations`. The optimization prompt and strategy selection vary by iteration tier:

- **Early (iteration 1):** "Focus on the lowest-scoring dimension. Make targeted improvements." Strategies: rephrase, add-context (low-risk).
- **Middle (iteration 2):** "Previous refinement insufficient. Try a different approach." Strategies: reduce-scope, decompose (medium-risk).
- **Late (iteration 3+):** "Multiple attempts failed. Consider restructuring entirely." Strategies: escalate-model, decompose (high-impact).

**Existing infrastructure:** The 5 strategies in `strategies/index.ts` can be iteration-indexed without new abstractions — just adjust priority weights.

## Consequences

### Accepted

- **API cost reduction:** simple tasks skip eval (0 calls); declining loops halt early. Expected savings: 30-50% fewer evaluator API calls per session.
- **Latency improvement:** simple CEO questions should drop from current ~10-15s (with eval) to <5s (skip eval).
- **Quality improvement for critical tasks:** 5 iterations with 75 threshold vs. current 3 iterations with 50 threshold.

### Trade-offs

- **Frozen context adds ~100-500 tokens** to every optimization prompt — small overhead given 4K+ model context windows.
- **Convergence guard may be too aggressive** if the evaluator's scoring is noisy — the 40% rollback threshold catches this.
- **Iteration-aware prompting is heuristic** — the 3-tier prompt wording (early/middle/late) is a starting point, not a mathematically optimal policy.

### Explicitly rejected (from full adoption plan)

| Pattern | Reason for rejection |
|---------|---------------------|
| MLA / GQA attention | Tensor-level neural network mechanics; no agent-domain mapping |
| KV-cache optimization | Agent memory is conversation-based, not autoregressive KV-cache |
| Per-loop LoRA adaptation | Weight fine-tuning per iteration has no agent equivalent |
| Multi-agent per request (MoE) | Violates <30s target; sequential handoffs already work |
| Full LTI mathematical guarantee | Discrete state (string + score) doesn't need continuous spectral bounds; monotonic decline detection is the practical equivalent |
| Config variant factory functions | EndiorBot already has this (tier system + envInt SSOT) |

## Rollback Plan

Each adoption has an independent rollback condition documented in the Requirements spec (`docs/01-planning/sprint-139-requirements.md`):

| Adoption | Trigger | Rollback action |
|----------|---------|----------------|
| Convergence guard | >40% of evaluator runs halted | Remove `consecutiveDeclines` counter; restore unconditional loop |
| Dynamic budget | Simple tasks still >5s | Investigate wiring; if unfixable, remove `complexity` parameter |
| Frozen input | Prompt consistently exceeds context window | Reduce cap below 500 tokens or remove `frozenContext` param |
| Loop-index | Later-iteration strategies produce worse results | Remove iteration-aware prompt text; keep static strategy selection |

All rollback actions are localized to `src/evaluator/loop.ts` and `src/evaluator/optimizer.ts` — no cascading effects to other modules.

## References

- [OpenMythos repository](https://github.com/kyegomez/OpenMythos) — source architecture
- [Full adoption plan](../../.claude/plans/fuzzy-baking-pnueli.md) — 7-pattern assessment, all expert reviews
- [Sprint 139 plan](../04-build/sprints/sprint-139-plan.md) — implementation sequencing
- [Sprint 139 requirements](../01-planning/sprint-139-requirements.md) — functional + non-functional requirements
- [TS-050 Technical Spec](../02-design/14-Technical-Specs/TS-050-Evaluator-OpenMythos-Integration.md) — implementation detail
- [ADR-010 Evaluator-Optimizer Loop](ADR-010-Evaluator-Optimizer.md) — original evaluator architecture (Sprint 51)

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | ADR-050 FULL — 2026-04-20*
