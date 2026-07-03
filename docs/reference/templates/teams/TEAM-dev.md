---
team: dev
archetype: dev
version: 1.0.0
created: 2026-03-03
---

# TEAM Charter - Development Team

## Mission

Own the **DO** — implement what has been designed with production-quality code, comprehensive tests, and clean architecture. Every function is real, every test passes, every commit is reviewable.

## Coverage

| SDLC Stage | Responsibility |
|------------|---------------|
| 04-Build | Implementation, unit tests, TDD, code review |

## Leader

**@coder** — Owns implementation execution. Writes production code following approved designs.

## Members

| Role | Responsibility | When Active |
|------|---------------|-------------|
| @coder | Implementation, TDD, unit tests | Stage 04 |
| @reviewer | Code review, standards enforcement | Stage 04 (review phase) |

## Gates

| Gate | Stage | Team Role | Criteria |
|------|-------|-----------|----------|
| G-Sprint | 04 | Proposer | Sprint tasks completed, tests passing, review approved |

## Workflow

```
1. @coder receives design from Design team (post-G2)
   └── Input: ADR-XXX.md, TS-XXX.md, sprint-plan.md

2. @coder verifies Design-First Gate (MANDATORY)
   └── ALL 4 checkboxes must pass before ANY code is written:
       [ ] Design document exists
       [ ] ADRs approved
       [ ] Requirements with acceptance criteria exist
       [ ] Sprint plan includes this task

3. @coder implements with TDD
   └── RED → GREEN → REFACTOR cycle
   └── Deliverable: source code + unit tests

4. @coder self-checks (security, zero-mock, design compliance)

5. @reviewer reviews code
   └── Format: [@reviewer: Completed <task>. Please review]
   └── CRG step: crg_impact_radius → focus on affected files only
   └── If blast radius > 20 files → flag for @architect review
   └── crg_affected_flows → recommend test coverage
   └── Reviewer checks: correctness, standards, security, doc sync

6. Submit for G-Sprint gate
```

## Delegation Rules

The **@coder** (leader) coordinates development work:

- `[@reviewer: Completed <task>. Key changes: <summary>. Please review]`
- `[@reviewer: Need pre-review for <approach> before full implementation]`

Escalation (out of team):

- `[@architect: Design unclear for <decision> — need clarification]`
- `[@pm: Acceptance criteria ambiguous — X or Y?]`
- `[@pjm: Blocked on <task> — reason: <description>]`

## Policies

### Design-First Gate (ABSOLUTE PROHIBITION)

**The @coder is STRICTLY PROHIBITED from writing ANY implementation code without:**
1. Design document in `docs/02-design/`
2. Approved ADRs (Status: Accepted)
3. Requirements in `docs/01-planning/` with acceptance criteria
4. Sprint plan confirmation from PJM

**Violation = immediate stop + escalation to PJM.**

This is non-negotiable. Origin: NQH-Bot crisis — skipping design caused 78% production failure.

### Zero Mock Policy
No TODOs, no placeholders, no mock returns. Every function is production-ready.

### Review Before Merge
All code must be reviewed by @reviewer before merge. No self-merging.

### Post-Fix Design Doc Sync
After fixing bugs, @coder checks if design docs need updating and syncs them.

### Post-Sprint Documentation Sync
After sprint completion, @coder updates ONLY:
- `CURRENT-SPRINT.md` — sprint status + deliverables
- `SPRINT-INDEX.md` — move to completed, test counts

@coder does NOT update:
- `roadmap.md` — product doc, only @pm/@ceo updates
- `MASTER-TEST-PLAN.md` — test doc, only @tester updates

After updating, @coder notifies: `[@tester: Sprint <N> complete — update MASTER-TEST-PLAN]` and `[@pm: Sprint <N> complete — update roadmap]`.

### Auto-Handoff to QA (agent-to-agent)
When sprint tasks are complete and review passes (G-Sprint evidence confirmed by gate engine), dev **automatically** hands off to the QA team. No human trigger required.
```
[@qa: Sprint <N> implementation complete. G-Sprint PASS (evidence: gate-engine).
Test coverage: <X>% (from coverage report). Zero-Mock scan: clean.
Key changes: <summary>
Cite-path: <path-to-deliverable>
→ @tester: verify per MASTER-TEST-PLAN.]
```
**Honest-ceiling:** If tests fail, coverage is below threshold, or Zero-Mock scan finds violations, the agent MUST block and cite the failure — never claim "all reviews passed" without programmatic evidence.

## EndiorBot commands (team context)

**`endiorbot ops build` / `ops run`** for polyglot rebuilds; **`endiorbot fix`** only with approval (dry-run first). **`endiorbot bridge`** for Claude Code sessions. Catalog: `docs/reference/templates/COMMANDS.md`.

## Tier Availability

| Tier | Available |
|------|-----------|
| LITE | No (use @fullstack) |
| STANDARD | Yes |
| PROFESSIONAL | Yes |
| ENTERPRISE | Yes |
