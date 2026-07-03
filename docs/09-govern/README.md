# 09-govern — Govern & improve

## Purpose

**Key question:** **IMPROVE** the system and the process — RFCs, retrospectives, lessons learned, and framework updates without losing CEO vision or gate discipline?

Governance **informs the next cycle** starting at [`../00-foundation/`](../00-foundation/) (vision/problem) and [`../01-planning/`](../01-planning/) (backlog).

---

## Alignment

- **Upstream:** Outcomes from [`../04-build/`](../04-build/) (sprints), [`../05-test/`](../05-test/), [`../07-operate/`](../07-operate/) (incidents), [`../08-collaborate/`](../08-collaborate/) (handover)  
- **Downstream:** [`../01-planning/`](../01-planning/) (prioritized change), [`../02-design/01-ADRs/`](../02-design/01-ADRs/) (decision records)  
- **Spine:** [`../00-foundation/stage-command-workflow-spine.md`](../00-foundation/stage-command-workflow-spine.md)  
- **Stage index:** [`../README.md`](../README.md)

---

## EndiorBot command hints (this stage)

| Type | Examples |
|------|----------|
| **Atomic** | `compliance check` — posture drift; `gate status` — framework alignment; `analytics` — trend input for retros. |
| **Workflow** | Sprint retro → RFC draft → ADR when behavior changes; keep `product-vision.md` and spine updated in the same PR when strategy shifts. |

Catalog: [`../reference/templates/COMMANDS.md`](../reference/templates/COMMANDS.md).

---

## Stage artifacts (living)

| Artifact | Location | Owner |
|----------|----------|-------|
| RFCs / retros | Populate under `docs/09-govern/` | @cpo + @ceo |
| Process improvements | Link to ADRs in `docs/02-design/01-ADRs/` | @cto |

## Process Improvements (Sprint 139-143)

| Sprint | Improvement | Impact |
|--------|------------|--------|
| 139 | OpenMythos pattern adoption — CTO review process with per-item blockers/warnings | Raised code quality bar |
| 140 | SDLC breach acknowledgment — retroactive plans for CEO-directed fast execution | Compliance honesty |
| 142 | Vendor-agnostic enrichment — `buildEnrichedPrompt()` eliminates 50+ duplicate lines | Future providers = 0 context code |
| 142 | Kill switch consistency — CPO finding → immediate fix | Cross-role review catches real bugs |
| 143 | Brain L2 wiring — CPO "produce data ≠ activate behavior" finding → E2E fix | Behavioral completeness standard |
| 144 | Circuit breaker + OTT ack — CEO UX gap identified → channel-aware timeouts + immediate feedback | Resilience pattern codified |
| 145 | ADR-003 + ADR-006 added; docs consistency pass → 51 ADRs, 5-channel parity confirmed | Documentation accuracy standard |

## Governance Principles

1. **Docs before code** — Sprint plan + G1 approval before implementation
2. **CTO review every sprint** — Code review with specific blockers, not rubber stamps
3. **CPO behavioral verification** — "Does it actually DO what we claim?"
4. **CEO identity lock** — EndiorBot = Solo Developer Power Tool, scope doesn't drift
5. **Evidence matrix** — Every claimed trigger must be wired in code, not just documented

---

*EndiorBot | SDLC Framework **6.4.0** — Stage 09: Govern & improve — Updated Sprint 145 (2026-04-27)*
