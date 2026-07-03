---
title: "OpenMythos Adoption — Close Report"
date: 2026-04-24
status: CLOSED
authority:
  proposer: "@pm"
  countersigners:
    - actor: "@cto"
      date: "2026-04-20"
      grade: "9.5/10 (Sprint 139 P0+P1)"
      reference: "Sprint 139 CTO review"
    - actor: "@cpo"
      date: "2026-04-24"
      grade: "APPROVED"
      reference: "OpenMythos backlog closure CPO review"
  trigger: "CEO directive — research kyegomez/OpenMythos for EndiorBot adoption"
sprints: [139, "backlog"]
adoption_plan: ".claude/plans/fuzzy-baking-pnueli.md"
---

# OpenMythos Adoption — Close Report

## Summary

CEO requested research of [OpenMythos](https://github.com/kyegomez/OpenMythos) (Recurrent-Depth Transformer architecture). The adoption assessment identified 7 conceptual patterns that translate to EndiorBot's agent orchestration domain. All 7 items are now shipped.

**Duration:** 2 sessions (Sprint 139 + backlog batch)
**Tests added:** +64 new tests
**Suite:** 8,111 pass, 10 skipped, 0 failures at close

## Delivered Items

| # | Item | OpenMythos source | Sprint | Commit(s) | Tests |
|---|------|-------------------|--------|-----------|-------|
| 1 | Convergence Guard | ACT halting (main.py:707-737) | 139 | `b28a129` + `bff6402` (CTO fixes) | 10 |
| 2 | Dynamic Iteration Budget | Variable loop depth (max_loop_iters) | 139 | `2e8b959` | 9 |
| 3 | Frozen Input Injection | Frozen `e` re-injection (main.py:870-880) | 139 | `28391d3` + `bff6402` (B3/B4/BG1 fixes) | 9 |
| 4 | Loop-Index Optimization | Loop-index embedding (main.py:506-535) | 139 | `7e911d8` | 9 |
| 5 | Phase-Specific Behavior | Prelude/Recurrent/Coda pipeline | backlog | `427352f` (refactor) + `1c04b89` (events) | 0 (refactor) |
| 6 | Stability Guard | LTI-stable injection (main.py:641-699) | backlog | `6d03562` | 16 |
| 7 | Expert Routing | MoE router (main.py:425-498) | backlog | `c4ff6e5` + `59f0983` (model-attribution fix) | 11 |

## Architecture impact

### Evaluator loop (`src/evaluator/loop.ts`)
- Convergence guard: monotonic-decline detection with patience + minDelta + warmup
- Dynamic budget: `TaskComplexity` controls iteration depth (simple=0, critical=5)
- Frozen context: CEO's original task re-injected at every optimizer iteration
- Loop-index: iteration-aware prompting shifts strategy (early=safe, late=aggressive)

### Autonomous session (`src/sessions/autonomous/manager.ts`)
- Phase-Specific Behavior: `runLoop()` → `prelude()` → `recurrentLoop()` → `coda()` with 6 phase events
- Stability Guard: composite invariants (escalation cap, risky-ops window, checkpoint cadence) checked atomically before each task

### Provider routing (`src/providers/expert-routing.ts`)
- Historical performance scoring: records success rate per agent × provider × task-type
- Phase 1 (current): read-only — logs recommendations, doesn't change routing
- Phase 2 (future): active routing influence when `FF_EXPERT_ROUTING_ENABLED=true`

## Explicitly rejected patterns

| Pattern | Reason |
|---------|--------|
| MLA / GQA attention | Tensor-level neural mechanics — no agent mapping |
| KV-cache optimization | Agent memory is conversation-based |
| Per-loop LoRA adaptation | Weight fine-tuning per iteration has no agent equivalent |
| Multi-agent per request | Violates <30s target; sequential handoffs already work |
| Full LTI mathematical guarantee | Discrete state doesn't need continuous spectral bounds |

## CTO conditions met

| Condition | Status |
|-----------|--------|
| Convergence uses `<=` (flat-after-decline counts) | ✅ `meetsConvergenceCriteria` |
| Frozen context capped at 500 tokens | ✅ `FROZEN_CONTEXT_CHAR_CAP = 2000 chars` |
| Rollback criterion per adoption (>40% convergence misfire) | ✅ documented in Sprint 139 requirements |
| Telemetry counters for convergence + budget + frozen | ✅ loop events emitted |
| Phase-Specific: 2-commit strategy (refactor-first) | ✅ `427352f` + `1c04b89` |
| Stability Guard as simple interface, not framework | ✅ `checkStability()` pure function |
| Expert Routing behind FF, read-only first | ✅ `FF_EXPERT_ROUTING_ENABLED`, Phase 1 |

## CPO conditions met

| Condition | Status |
|-----------|--------|
| Business success metrics (cost/quality) | ✅ Sprint 141 BSC-1/2/3 |
| Decision owner for mid-sprint gates | ✅ PM proposes, CTO/CPO approves |
| Model-attribution accuracy in expert routing | ✅ `59f0983` — uses actual runtime provider |

## SDLC artifacts

| Stage | Artifact |
|-------|---------|
| 01-Planning | [`sprint-139-requirements.md`](../../01-planning/sprint-139-requirements.md) |
| 02-Design | [`ADR-050`](../../02-design/01-ADRs/ADR-050-openmythos-evaluator-optimization-patterns.md), [`TS-050`](../../02-design/14-Technical-Specs/TS-050-Evaluator-OpenMythos-Integration.md) |
| 03-Integrate | [`sprint-139-integration-spec.md`](../../03-integrate/sprint-139-integration-spec.md) |
| Adoption plan | [`.claude/plans/fuzzy-baking-pnueli.md`](.claude/plans/fuzzy-baking-pnueli.md) |

## Carry-forward to future sprints

| Item | Trigger |
|------|---------|
| Expert Routing Phase 2 (active influence) | Enable `FF_EXPERT_ROUTING_ENABLED` after 50+ routing records accumulated |
| Vietnamese uncertainty keywords for Ollama confidence | Sprint 142+ when CEO uses Vietnamese with `@assistant` |
| Stability Guard tuning | After first >60-min autonomous session produces telemetry |

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | OpenMythos Adoption CLOSED — 2026-04-24*
