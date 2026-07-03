# 00-foundation — Foundation

## Purpose

**Key question:** **WHY** should EndiorBot exist, for whom, and under what constraints?

This stage anchors vision, problem statement, and business case before any **WHAT** (planning) or **HOW** (design).

---

## Alignment

- **Downstream:** [`../01-planning/`](../01-planning/) (requirements, user stories, roadmap)
- **Gates:** G0 (discovery), G0.1 (problem validation)
- **Stage index:** [`../README.md`](../README.md)

---

## Canonical documents

| Document | Role |
|----------|------|
| [`product-vision.md`](./product-vision.md) | North star: autonomous SDLC, solo dev → enterprise discipline, L1–L4 autonomy. |
| [`stage-command-workflow-spine.md`](./stage-command-workflow-spine.md) | **CPO/CTO spine:** stages 00–05 ↔ gates ↔ **atomic commands** vs **workflows** ↔ CLI/OTT/Web parity. |
| [`problem-statement.md`](./problem-statement.md) | Problem validation (G0.1 input). |
| [`business-case.md`](./business-case.md) | Value and constraints. |
| [`master-plan.md`](./master-plan.md) | Long-horizon technical/program plan. |

---

## EndiorBot command hints (this stage)

| Type | Examples |
|------|----------|
| **Atomic** | `endiorbot consult "…"` — clarify vision tradeoffs; `init --analyze` — SDLC posture of repo. |
| **Workflow** | `endiorbot bootstrap <url>` — onboard external repo into SDLC-shaped tree (see spine §4). |

Full catalog: [`../reference/templates/COMMANDS.md`](../reference/templates/COMMANDS.md).

---

## Stage artifacts (living)

| Artifact | Status | Owner |
|----------|--------|-------|
| Product vision | See `product-vision.md` | CEO + CPO |
| Spine | See `stage-command-workflow-spine.md` | CPO + CTO |

---

## Documentation index

All stages (00–09): [`../README.md`](../README.md).

---

## Identity (LOCKED 2026-04-19)

> **EndiorBot is a Solo Developer Power Tool** — not a platform, not an SDLC enforcer.
> Help developers get answers in <30s instead of 30-60 min.
>
> **Scope:** local repos + general developer support only.
> Remote product-org infrastructure belongs to the target team's orchestrator.

## Key Architecture Decisions (as of Sprint 145)

| ADR | Decision | Sprint |
|-----|----------|--------|
| ADR-050 | OpenMythos evaluator patterns (convergence, dynamic budget, frozen input, loop-index, phase behavior, stability, expert routing) | 139 |
| ADR-051 | Kimi proxy subprocess orchestrator | 140 |
| ADR-052 | Agent-model tier mapping (3 Opus, 10 Kimi, 1 Ollama) + vendor-agnostic enrichment | 140+142 |

## Anti-Drift Architecture (17 mechanisms, Sprint 142-143)

All triggers wired and operational:

| Trigger | Wired | Sprint |
|---------|-------|--------|
| Session start: SOUL + L1.25 + Brain L4 | ✅ | 55 |
| Every turn: buildEnrichedPrompt (workspace + RL) | ✅ | 142 |
| Every 10 turns: sprint goals summary | ✅ | 142 |
| Every 20 turns: full vision | ✅ | 142 |
| Every 30 turns: hard reset (token budget) | ✅ | 54 |
| Every 30 min: context refresh | ✅ | 97 |
| Every 5 patches: checkpoint | ✅ | 69 |
| Per-query: Active Memory (FF-gated, CEO decides) | ✅ | 133 |
| Brain L2: error pattern → retry hint | ✅ | 143 |

---

*EndiorBot | SDLC Framework **6.4.0** — Stage 00: Foundation — Updated Sprint 145 (2026-04-27)*
