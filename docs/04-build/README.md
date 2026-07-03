# 04-build — Build

## Purpose

**Key question:** Are we **building right** — implementation matches design and requirements?

This stage is where **code** and **delivery artifacts** land. It must remain traceable to **02-design** and verifiable in **05-test**.

---

## Alignment

- **Upstream:** `docs/02-design/`, `docs/03-integrate/` (contracts)  
- **Downstream:** `docs/05-test/` (evidence, regression), `docs/06-deploy/` (release inputs after G4)  
- **Gates:** G-Sprint, **G3** (build/test readiness)  
- **Stage index:** [`../README.md`](../README.md)

---

## Build ↔ design ↔ test

| Link | Rule |
|------|------|
| Code → design | Significant behavior changes require ADR update or approved waiver. |
| Code → requirements | Features map to acceptance criteria from planning. |
| Build → test | CI / `pnpm test` (or project equivalent) green before claiming G3. |

Spine: [`../00-foundation/stage-command-workflow-spine.md`](../00-foundation/stage-command-workflow-spine.md).

---

## EndiorBot command hints (this stage)

| Type | Examples |
|------|----------|
| **Atomic** | `endiorbot ops build`, `endiorbot ops run` (polyglot); `fix --dry-run` / `compliance fix`; Bridge `launch` / `send` for Claude Code execution. |
| **Workflow** | `bootstrap` (new repo path); `endiorbot sprint close` (verify → docs → commit); future **workflow execute** (124b+) chains tasks with CEO checkpoints. |

Catalog: [`../reference/templates/COMMANDS.md`](../reference/templates/COMMANDS.md).

---

## Stage artifacts (living)

| Artifact | Location | Owner |
|----------|----------|-------|
| Sprint plans / drafts | `docs/04-build/sprints/` | @pjm |
| OTT / build notes | `docs/04-build/` | @coder |

---

## Development Commands

```bash
pnpm install        # Install dependencies
pnpm build          # Build TypeScript
pnpm dev            # Watch mode
pnpm test           # Run tests (8,124+ expected)
pnpm lint           # Check code style
```

## Recent Sprints

| Sprint | Commits | Key Deliverables |
|--------|---------|-----------------|
| 139 | 7 | OpenMythos evaluator: convergence guard, dynamic budget, frozen input, loop-index |
| 140 | 1 (53 files) | Kimi k2.6: ADR-051 proxy orchestrator, ADR-052 tier mapping |
| 141 | 7 | Cost telemetry, Ollama confidence, Kimi rate-limit monitoring |
| 142 | 4 | `buildEnrichedPrompt()`, kill switch fix, vision re-injection, expert routing Phase 2 |
| 143 | 3 | Brain L2 pattern activation, 17th mechanism docs, OGA handoff |
| 144 | — | OTT ack, circuit breaker, channel-aware timeouts, `/status` + `/clear` commands |
| **145** | **IN PROGRESS** | **ADR-003 + ADR-006 added; docs consistency pass; 51 ADRs total** |

Sprint plans: [`sprints/`](sprints/)

---

*EndiorBot | SDLC Framework **6.4.0** — Stage 04: Build — Updated Sprint 145 (2026-04-27)*
