---
summary: "Autonomous work-driver template — beat-loop picks next unblocked task"
read_when:
  - Bootstrapping a workspace manually
  - ENTERPRISE tier init
  - Autonomous agent session start
sdlc_framework: "6.4.0"
version: 1.0.0
authority: "ADR-038 (workflow-integration) + ADR-027 (cross-session) + ADR-028 (progressive-trust)"
---
# HEARTBEAT.md — Autonomous Work Driver

## Purpose

HEARTBEAT is the **autonomous work-driver** for EndiorBot's SE4A agent team. Each "beat" picks the next unblocked task from the sprint plan, runs it through the appropriate TEAM chain (planning → design → dev → qa → ops), and cites deliverables for the next beat or session.

**When this file is empty (no tasks below the `## Tasks` heading), the heartbeat is dormant — no autonomous work happens.** Add tasks to activate.

## Beat-Loop Semantics

```
HEARTBEAT LOOP (constrained by sprint-plan-tasks + Design-First-Gate):

1. READ sprint plan → find next task with status: pending | unblocked
2. CLASSIFY task → determine TEAM chain entry point
   - New feature → @planning (Stage 00-01)
   - Design needed → @design (Stage 02-03)
   - Implementation → @dev (Stage 04)
   - Testing → @qa (Stage 05)
   - Deployment → @ops (Stage 06)
3. EXECUTE task via TEAM leader agent
4. GATE CHECK → run programmatic gate evaluation (endiorbot gate check)
   - PASS with evidence → auto-handoff to next TEAM
   - FAIL → BLOCK and cite missing evidence (honest-ceiling)
5. CITE deliverable path in sprint plan (cite-path handoff invariant)
6. UPDATE task status: pending → in_progress → done | blocked
7. NEXT BEAT → go to step 1

HALT CONDITIONS (beat-loop stops):
- No more unblocked tasks in sprint plan
- Gate FAIL with no remediation path → escalate to SE4H
- Budget/cost limit reached (ADR-007 circuit-breaker)
- Genuine ambiguity → escalate to SE4H with "blocked because X"
```

## Constraints

### Design-First Gate
The heartbeat MUST NOT start implementation (Stage 04) without a design document in `docs/02-design/`. This is the existing Design-First Gate from SOUL-coder — the heartbeat inherits it.

### Sprint-Plan Scope
The heartbeat ONLY works on tasks listed in the current sprint plan (`docs/04-build/sprints/SPRINT-*.md`). It cannot invent work, add scope, or reprioritize. Scope changes require SE4H approval.

### Honest-Ceiling (P0 Safety Valve)
The heartbeat MUST NOT:
- Claim a gate passed without running `endiorbot gate check` and observing PASS
- Skip a gate because "it's obvious" or "I already know it passes"
- Auto-approve its own output (self-review diversity rule applies)
- Proceed past a genuine block — instead: cite the block, suggest remediation, halt

### Progressive-Trust Boundary (ADR-028 T3)
- **Auto-approve:** G-Sprint, G0.1, G1, G2, G3 (with programmatic evidence)
- **Human-only:** G4 (Release), external gates, genuine ambiguity
- **Escalation:** When the heartbeat hits a human-only gate, it halts and notifies SE4H

### Cost Guard (ADR-007)
Each beat tracks token spend. If cumulative cost exceeds the session budget:
- Log current progress and cite-path
- Checkpoint state (ADR-027 cross-session transfer)
- Halt gracefully — next session resumes from checkpoint

## Cross-Session Continuity (ADR-027)

When a heartbeat session ends (context limit, cost cap, or explicit stop):

1. Write checkpoint to `~/.endiorbot/sessions/<session-id>/checkpoint.json`
2. Update sprint plan with current task statuses
3. Cite all deliverable paths in the sprint doc
4. Next session reads checkpoint → resumes from last completed beat

## Tasks

<!-- Add sprint tasks below to activate the heartbeat. Format:
- [ ] TASK-ID: Description (entry-point: @team, gate: G#)
- [x] TASK-ID: Description (done, cite: path/to/deliverable)
- [!] TASK-ID: Description (blocked: reason)
-->

<!-- Keep empty to keep heartbeat dormant -->
