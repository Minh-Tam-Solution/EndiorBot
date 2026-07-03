---
document_type: "Strategic Decision Memo"
stage: "02 - DESIGN"
status: "ACCEPTED"
owner: "PM"
authors: ["@pm"]
reviewers: ["@cto (9/10 Approved for sprint execution)", "@cpo (Approved with 5 refinements, applied)"]
created: "2026-04-10"
source: "Sau Sheong (GovTech Singapore) — From Vibe Coding to Agentic Engineering (Abridged), Apr 2026"
sdlc_framework: "6.4.0"
---

# EndiorBot Strategic Positioning — Post Sau Sheong Article

## Context

CEO read Sau Sheong's article on agentic engineering at GovTech Singapore (Apr 2026) and asked PM to re-examine EndiorBot's product direction before planning Sprint 131+. Both CTO and CPO reviewed the PM analysis. This memo consolidates the findings into a decision-ready format.

**Key CEO observation:** The article validates the approach CEO took building SDLC Framework from the start. GovTech faced identical gaps (governance-as-checklist, knowledge erosion, vendor disruption) and their solutions (Agent Prime Directives, Prelude, embedded compliance pipeline) mirror patterns EndiorBot implemented since Sprint 72+. The article is validation, not a pivot signal.

---

## Level Mapping — EndiorBot in Sau Sheong's 5-Level Framework

| Level | Article Definition | EndiorBot Status | Evidence |
|-------|-------------------|------------------|----------|
| **L1** Spicy autocomplete | IDE completion | N/A | Not target use case |
| **L2** AI coding assistants | Claude Code multi-step | **SHIPPED** | Bridge (Sprint 82+), chat mode (Sprint 127), tool reads (Sprint 130) |
| **L3** Autonomous agents | Ticket → deploy independently | **WIRED, NOT VALIDATED** | `executeTaskWork()` in `src/sessions/autonomous/manager.ts` (Sprint 124b) |
| **L4** Agent networks | Specialised agents collaborating | **PARTIAL** | 14 SOULs + team templates; handoff is advisory, not autonomous |
| **L5** Software factory | Describe outcome → system emerges | **NOT YET** | Not targeted |

**Current position:** **L2+ with L3 capabilities but no coherent L3 workflow.** The execution engine exists but is never exercised end-to-end in production.

---

## 1. Decision Matrix — Option A/B/C (5 Criteria)

| Criterion | Option A: Command Center | Option B: Pipeline Platform | Option C: Minimal Advisor |
|-----------|-------------------------|----------------------------|--------------------------|
| **Strategic fit** (vs ADR-044) | HIGH — stays advisor | **REJECTED** — contradicts ADVISOR boundary | HIGH — current direction |
| **Time-to-value** | Incremental: 1 metric Sprint 131 → full dashboard ~Sprint 137 (only if milestones pass) | N/A | 0 sprints (already shipping) |
| **Implementation risk** | MEDIUM (new UI surface, metric definitions) | N/A | LOW |
| **Operating complexity** | MEDIUM (dashboard maintenance) | N/A | LOW |
| **Defensibility (moat)** | governance-by-default + decision velocity viz | N/A | multi-channel supervisory flow + CRG + auditability |

**Verdict:** Option B eliminated by ADR-044 (EndiorBot = ADVISOR per NQH Federated AI OS v3). Real choice is **A (metrics expansion) vs C (continue + polish)**.

---

## 2. North-Star Metric per Option

| Option | Metric | Exact Definition | Baseline | Target (6mo) |
|--------|--------|------------------|----------|--------------|
| A — Command Center | Decision latency | Median time from `endiorbot plan` creation → first `endiorbot agent` execution targeting any task from that plan (matched by slug). 7-day rolling window. | Unknown (not measured) | TBD |
| C — Minimal Advisor | Supervisory quality | % of agent outputs where CEO responded to the post-turn knowledge prompt with explicit `y` / `diff` / `explain` before next chat turn. 7-day rolling window. | Unknown (not measured) | > 80% |

**Why these definitions matter:** Without exact windows and event boundaries, the numbers become arguable. Both metrics can be computed from existing event logs without new instrumentation.

---

## 3. Target Operating Model — "Checklist → Pipeline" (NEEDS ADR-046)

The single best insight from Sau Sheong's article:

> *"If you make compliance a manual checklist, teams will skip it under deadline pressure. If you embed compliance into the deployment pipeline, teams comply by default."*

**Current state:** EndiorBot has all the pieces — SDLC gates, vibecoding index, compliance check, audit logs, permission audit, CRG blast radius. But they are **passively invoked** — CEO must remember to run them.

**Required for enforced pipeline:**
- **State machine as source of truth** — which gate is active, what blocks progression, what events trigger state transitions
- **Hard-block gates vs soft-advisory gates** — clear distinction, documented in config
- **Approval checkpoints** — where CEO decision is mandatory (not advisory)
- **Rollback mechanism** — what happens when gate fails after the fact (PatchManager rollback exists since Sprint 68)
- **Progressive autonomy** — L0 manual gates → L1 automated soft gates → L2 automated hard gates → L3 self-healing

**Decision required:** **ADR-046** before any implementation. Not a sprint task. Should reference:
- ADR-044 (Federated OS) for boundaries
- ADR-045 (CRG client) for input signals
- Sprint 68 PatchManager for rollback primitives
- Sprint 72 Autonomy Gates A/B/C for existing progression model

---

## 4. Actionable Insights (Sprint 131-132 Small Scope)

Two small wins from the article that do not require strategic pivot. Both documented in this memo and included in Sprint 131 plan.

### A. Knowledge Erosion Safeguard (Chat Mode)

**Problem (article):** *"Active knowledge decays without practice. With AI as the pair, that forcing function disappears."* CEO watches agent do work, understands nothing, breaks a week later.

**Solution:** After agent completes a task in chat mode, add a one-line review prompt:

```
Agent completed: modified config.yaml (3 lines changed).
Brief summary: Updated api.model to translategemma:12b for AI-Platform.
Understood? [y / show diff / explain more]
```

**Constraints (CTO C1):** Opt-out via `ENDIORBOT_SKIP_REVIEW_PROMPT=true`. If CEO finds it annoying after 10 sessions, disable without code change.

**Risk accepted:** This is a **prototype** without persistence. Scaling may need storage + analytics in a later sprint. Documented explicitly so future sprints don't treat it as production-grade.

### B. Decision Velocity Metric (/status Command)

**Problem (article):** *"Engineering capacity is no longer the constraint. Decision speed is."* EndiorBot has AER metrics since Sprint 72 but no surface exposes them.

**Solution:** Add ONE metric line to `endiorbot status`:

```
Decision velocity: 12 min (median plan → first execution, last 7 days)
```

**Computation:** For each `plan` command invocation in last 7 days, measure time until first `agent` command targets any task from that plan (match by slug). Report median. Skip plans with no matching execution.

**Risk accepted:** If CEO doesn't find the number useful after 2 weeks, revert. Proves concept before committing to Astrolabe-scale dashboard.

---

## 5. Open Questions Requiring CEO/CPO Decision

| # | Question | Options | Impact |
|---|----------|---------|--------|
| Q1 | Solo Developer Power Tool scope | Supervisory cockpit ONLY vs orchestration platform | ADR-044 says cockpit. Confirm or amend? |
| Q2 | 6-month optimization target | Decision speed vs autonomous throughput | Shapes Sprint 132-140 priorities |
| Q3 | Hard-gate tolerance | Speed > compliance vs compliance > speed | Shapes ADR-046 |
| Q4 | Citizen dev surface (SDLC 6.3.0 Mental Model #8) | Product priority vs channel expansion | Affects Web UI investment |

**Recommendation:** These belong in a CPO/CEO decision review session, not a sprint plan. This memo is the input document for that session.

---

## 6. 90-Day Plan (ONLY If CEO Chooses Option A)

**Not recommended unless Option A is explicitly chosen.** Included for completeness.

| Milestone | Sprint | Success Criteria | Kill Criteria |
|-----------|--------|------------------|---------------|
| M1: One metric in /status | 131 | `decision velocity` displayed in status output | CEO doesn't check it → remove in Sprint 132 |
| M2: 3 metrics + terminal table | 134 | Terminal table of 3 AER metrics | < 2 views/week → revert |
| M3: Web UI mini-dashboard | 137 | Single-page dashboard on `/` route | Not usable on mobile → revert |

Each milestone has an explicit kill criterion. No commitment to full Astrolabe-scale dashboard until M1 and M2 pass.

---

## 7. Explicitly Accepted Risks

1. **Strategic option A vs C stays open** until CEO chooses. Sprint 131 experiments (knowledge prompt + velocity metric) inform the choice without committing.
2. **Knowledge erosion prompt without persistence** is a prototype. Scaling needs storage + analytics in a later sprint.
3. **CRG evaluation** may fail kill criteria (< 3x token reduction) — in which case graphContext injection is removed, CLI commands retained for manual use.

---

## 8. Dependencies and Cross-References

- **ADR-044** — Agentic OS Alignment (federated ecosystem, EndiorBot = ADVISOR boundary)
- **ADR-045** — Code Knowledge Graph Client (CRG kill criteria: < 3x reduction → remove)
- **ADR-043-A1** — Claude Code as Primary Chat Provider (shipped Sprint 130)
- **ADR-046** — (PENDING) Checklist → Pipeline enforcement model
- **Sprint 72** — AER Metrics (calculator exists, surface missing)
- **Sprint 124b** — Execution Engine (wired, not validated end-to-end)
- **Sprint 130** — Chat Phase 3 (tool reads shipped, needs usage tracking)

---

## 9. Recommended Next Actions

1. **CEO/CPO decision review meeting** — answer Q1-Q4 above
2. **If Option A chosen:** Start 90-day plan with M1 in Sprint 131
3. **If Option C confirmed:** Continue current roadmap, no changes needed
4. **Either way:** Proceed with Sprint 131 execution (CRG wiring, knowledge prompt, velocity metric) — these are small enough to serve both options
5. **Separately:** Draft ADR-046 when current sprint backlog is cleared

---

*EndiorBot | SDLC Framework 6.3.0 — Strategic Decision Memo | 2026-04-10*
