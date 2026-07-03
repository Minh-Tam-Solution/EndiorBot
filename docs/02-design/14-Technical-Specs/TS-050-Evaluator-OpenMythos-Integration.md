# Technical Specification: Evaluator OpenMythos Integration

**ID:** TS-050
**Status:** Proposed
**Date:** 2026-04-20
**Related ADR:** [ADR-050](../01-ADRs/ADR-050-openmythos-evaluator-optimization-patterns.md)
**SDLC Stage:** 02-DESIGN
**Sprint:** 139

---

## Overview

Integrates four OpenMythos-inspired optimization patterns into EndiorBot's evaluator loop (`src/evaluator/loop.ts`). All changes are additive — no existing APIs break, no callers change unless they opt into the new `complexity` parameter.

## Architecture

```
                    ┌───────────────────────────────────────────────┐
                    │          processResponse(response, complexity) │
                    └───────────────┬───────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────────────────────┐
                    │  [NEW] Resolve iteration budget from          │
                    │        ADAPTIVE_LOOP_PARAMS[complexity]       │
                    │        (maxRetries, passThreshold)            │
                    └───────────────┬───────────────────────────────┘
                                    │
           ┌────────────────────────▼──────────────────────────┐
           │                  for iter = 0..maxRetries          │
           │  ┌─────────────────────────────────────────────┐  │
           │  │  evaluate(currentResponse) → score          │  │
           │  └─────────────────┬───────────────────────────┘  │
           │                    │                              │
           │  ┌─────────────────▼───────────────────────────┐  │
           │  │  [NEW] Convergence check:                   │  │
           │  │    if score <= previousScore:                │  │
           │  │      consecutiveDeclines++                   │  │
           │  │      if consecutiveDeclines >= 2: BREAK      │  │
           │  │    else: consecutiveDeclines = 0             │  │
           │  └─────────────────┬───────────────────────────┘  │
           │                    │                              │
           │  ┌─────────────────▼───────────────────────────┐  │
           │  │  score >= threshold? → PASS, BREAK           │  │
           │  └─────────────────┬───────────────────────────┘  │
           │                    │ (below threshold)            │
           │  ┌─────────────────▼───────────────────────────┐  │
           │  │  selectStrategy(scores, iterationIndex)     │  │
           │  │  [NEW] iteration-aware selection:            │  │
           │  │    early  → rephrase, add-context            │  │
           │  │    middle → reduce-scope, decompose          │  │
           │  │    late   → escalate-model, decompose        │  │
           │  └─────────────────┬───────────────────────────┘  │
           │                    │                              │
           │  ┌─────────────────▼───────────────────────────┐  │
           │  │  optimize(response, strategy, scoreCard,    │  │
           │  │    [NEW] frozenContext, iterationIndex,      │  │
           │  │    totalIterations)                          │  │
           │  └─────────────────┬───────────────────────────┘  │
           │                    │                              │
           └────────────────────┴──────────────────────────────┘
                                │
                    ┌───────────▼───────────────────────────────┐
                    │  Return bestResponse + telemetry counters  │
                    └───────────────────────────────────────────┘
```

## Core Interfaces

### New types (`src/evaluator/types.ts`)

```typescript
import type { TaskComplexity } from "../agents/types.js";

/**
 * Sprint 139 P0-2: Complexity → loop config mapping.
 * OpenMythos analog: variable max_loop_iters per task difficulty.
 */
export const ADAPTIVE_LOOP_PARAMS: Record<TaskComplexity, {
  maxRetries: number;
  passThreshold: number;
}> = {
  simple:   { maxRetries: 0, passThreshold: 0 },
  moderate: { maxRetries: 1, passThreshold: 50 },
  complex:  { maxRetries: 3, passThreshold: 65 },
  critical: { maxRetries: 5, passThreshold: 75 },
};

/**
 * Sprint 139 P1-3: Frozen context re-injected at every optimizer iteration.
 * OpenMythos analog: frozen input `e` from Prelude, prevents drift.
 */
export interface FrozenContext {
  /** CEO's original question — immutable across iterations */
  originalTask: string;
  /** Agent SOUL identity string (optional — omit if agent is unknown) */
  soulIdentity?: string;
  /** Non-negotiable constraints (e.g. "LOCAL-ONLY", "no SSH") */
  constraints?: string;
}

/** Max token count for frozen context (CTO condition: 500) */
export const FROZEN_CONTEXT_TOKEN_CAP = 500;

/**
 * Sprint 139: Telemetry event emitted by the evaluator loop.
 */
export interface EvaluatorTelemetry {
  convergenceHalted: boolean;
  iterationBudgetSavings: number;
  frozenContextTokens: number;
  actualIterations: number;
  maxConfiguredIterations: number;
  complexity?: TaskComplexity;
}
```

### Modified signatures

**`EvaluatorLoop.processResponse()`** — add optional `complexity`:
```typescript
async processResponse(
  response: AgentResponse,
  passThreshold?: number,
  complexity?: TaskComplexity,  // NEW — Sprint 139
): Promise<ProcessedResponse>
```

**`Optimizer.optimize()`** — add frozen context + iteration metadata:
```typescript
async optimize(
  response: AgentResponse,
  strategy: OptimizationStrategy,
  scoreCard: ScoreCard,
  frozenContext?: FrozenContext,    // NEW — Sprint 139 P1-3
  iterationIndex?: number,         // NEW — Sprint 139 P1-4
  totalIterations?: number,        // NEW — Sprint 139 P1-4
): Promise<AgentResponse>
```

## Implementation Details

### P0-1: Convergence Guard (`src/evaluator/loop.ts`)

Insert between line 257 (after `optimizationStart`) and line 260 (the for-loop):

```typescript
let consecutiveDeclines = 0;
let previousIterScore = -1;
```

Inside the for-loop, after line 298 (`bestEvaluation = currentEvaluation`):

```typescript
// Sprint 139 P0-1: Convergence guard (OpenMythos ACT analog)
if (previousIterScore >= 0 && currentEvaluation.scores.overall <= previousIterScore) {
  consecutiveDeclines++;
  if (consecutiveDeclines >= 2) {
    logger.info('Convergence guard: score declined/plateaued for 2 consecutive iterations', {
      responseId: response.id,
      iterations,
      bestScore,
      previousScore: previousIterScore,
      currentScore: currentEvaluation.scores.overall,
    });
    this.emitEvent({
      type: 'convergence_halted',
      responseId: response.id,
      score: bestScore,
      timestamp: new Date().toISOString(),
    });
    break;
  }
} else {
  consecutiveDeclines = 0;
}
previousIterScore = currentEvaluation.scores.overall;
```

### P0-2: Dynamic Iteration Budget (`src/evaluator/loop.ts` + `types.ts`)

At the top of `processResponse()`, resolve effective limits:

```typescript
const effectiveLimits = complexity
  ? ADAPTIVE_LOOP_PARAMS[complexity]
  : { maxRetries: this.config.limits.maxRetries, passThreshold: undefined };

const effectiveMaxRetries = effectiveLimits.maxRetries;
const threshold = effectiveLimits.passThreshold ?? passThreshold
  ?? this.config.thresholds.minOverall;

// Simple tasks: skip the loop entirely
if (effectiveMaxRetries === 0) {
  logger.info('Skipping evaluator loop for simple task', {
    responseId: response.id,
    complexity,
  });
  return {
    response,
    evaluation: /* minimal evaluation */ ,
    finalScore: 100, // accepted without eval
    iterations: 0,
    durationMs: Date.now() - startTime,
  };
}
```

Replace `this.config.limits.maxRetries` in the for-loop condition with `effectiveMaxRetries`.

### P1-3: Frozen Input Injection (`src/evaluator/optimizer.ts`)

In `optimize()`, prepend frozen context to the prompt:

```typescript
const frozenBlock = frozenContext
  ? [
      '## FROZEN CONTEXT (do not deviate from this)',
      `Original Task: ${truncateToTokenCap(frozenContext.originalTask, FROZEN_CONTEXT_TOKEN_CAP)}`,
      frozenContext.soulIdentity
        ? `Agent Identity: ${frozenContext.soulIdentity.slice(0, 200)}`
        : '',
      frozenContext.constraints
        ? `Constraints: ${frozenContext.constraints}`
        : '',
      '---',
    ].filter(Boolean).join('\n')
  : '';
```

### P1-4: Loop-Index Prompting (`src/evaluator/optimizer.ts`)

Add iteration guidance to the optimization prompt:

```typescript
function iterationGuidance(index: number, total: number): string {
  if (index === 0) {
    return 'This is the first refinement attempt. Focus on the lowest-scoring dimension. Make targeted improvements.';
  }
  if (index === 1) {
    return 'Previous refinement did not reach threshold. Try a different approach from the first attempt.';
  }
  return `This is attempt ${index + 1} of ${total}. Multiple refinements attempted. Consider restructuring the response entirely.`;
}
```

In `selectStrategy()`, adjust priority weights based on iteration:

```typescript
// Early iterations: prefer low-risk strategies
if (iterationIndex <= 0) {
  prioritize('rephrase', 'add-context');
}
// Late iterations: prefer high-impact strategies
else if (iterationIndex >= 2) {
  prioritize('escalate-model', 'decompose');
}
```

## Testing Strategy

| Test file | Tests | Covers |
|-----------|-------|--------|
| `tests/evaluator/convergence-guard.test.ts` | ~8 | Declining, plateauing, recovering, edge cases |
| `tests/evaluator/adaptive-budget.test.ts` | ~8 | 4 complexity levels + skip path + override behavior |
| `tests/evaluator/frozen-context.test.ts` | ~6 | Injection presence, 500-token cap, truncation, immutability |
| `tests/evaluator/loop-index.test.ts` | ~6 | Prompt variation, strategy shift, 3-tier coverage |

**Estimated total: ~28 new tests.**

## Telemetry Integration

All counters emitted via `this.emitEvent()` (existing event system in `loop.ts`). No new infrastructure needed — events are already consumed by `LoopMetrics` tracking.

New event types:

| Event type | Emission point | Fields |
|-----------|----------------|--------|
| `convergence_halted` | When convergence guard fires | `responseId`, `score`, `iterations` |
| `iteration_budget_applied` | When complexity overrides limits | `complexity`, `staticMax`, `effectiveMax` |
| `frozen_context_injected` | When frozen context is prepended | `tokenCount`, `truncated` |

## Related Specifications

- [TS-001 Provider Architecture](TS-001-Provider-Architecture.md) — model selection feeds into tier escalation (CPO: critical → ELITE directly)
- [TS-003 Agent Orchestration](TS-003-Agent-Orchestration.md) — ChannelRouter → EvaluatorLoop call chain
- [ADR-010 Evaluator-Optimizer Loop](../01-ADRs/ADR-010-Evaluator-Optimizer.md) — original loop architecture

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | TS-050 — 2026-04-20*
