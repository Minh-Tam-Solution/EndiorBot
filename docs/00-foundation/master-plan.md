# EndiorBot Master Plan

---
version: 3.2
status: APPROVED
updated: 2026-03-01
author: CEO + Expert Panel + CTO + @pm + @architect
---

## Changelog

```
v3.2: Vision v2.2 CONSOLIDATED - Autonomous SDLC Agent
      - 4 Autonomy Levels (L1-L4)
      - 6 P0 Fixes + 6 CTO P0 Additions = 12 Total Requirements
      - 4 Hard Guards
      - Roadmap: v1.0 → v1.5 → v1.8 → v2.0 (Sprint 61-72, ~154h)
      - ADR-006 to ADR-011
      - Golden Scenarios A/B/C defined
      - CTO Sign-off Checklist
v3.1: Sprint 55 Agent Orchestration complete, Claude Code Bridge
v3.0: Agent Orchestration Layer, 12 agent SOULs
v2.0: Identity locked as Solo Developer Power Tool, scope crisis resolved
v1.0: Initial master plan (G2 ready)
```

---

## 1. Identity (LOCKED)

> **EndiorBot is a Solo Developer Power Tool**
> Not a platform. Not an SDLC enforcer. Not an enterprise product.

**One Sentence**: Help developers get AI-assisted answers in <30s instead of 30-60 min.

**v2.0 Evolution**: Solo Developer Power Tool → Autonomous SDLC Agent (120+ min sessions) — shipped Sprint 72+

---

## 2. Two Loops

### Decision Loop (Architecture, Planning, Research)
```
Ask → Retrieve context → 3-model consult → Propose → CEO approve → Record
```
- Claude (Primary) + OpenAI (Critique) + Gemini (Critique)
- **Model Selection**: CEO can choose latest models (o3, gemini-2.5-pro, etc.)

### Delivery Loop (Implementation)
```
Task → Brain context → Execute (Claude) → Verify → Commit
```
- Claude Code is primary for coding/docs

**Rule**: Every feature must map to one of these loops. If not → defer.

---

## 3. Truth Layers

| Layer | Role | Authority |
|-------|------|-----------|
| **Brain** | Assist (memory, patterns) | Proposes only |
| **Control Plane** | Execute | Final authority |
| **active.json** | State | SSOT for all interfaces |

```
~/.endiorbot/active.json = Single Source of Truth
All interfaces (CLI, Extension, Claude Code) read/update this
```

---

## 4. Three Tiers (Scope-Locked)

### Tier 1 — MVP
```bash
endiorbot consult "<question>"  # 3 models, primary_with_notes
endiorbot gate status G2        # Read-only checklist
endiorbot switch <project>      # Minimal context
```

### Tier 2 — Pro
- Auto-generate ADR template (CEO approve)
- Gate evidence manifest
- History compaction + session resume
- OTT approvals via magic link

### Tier 3 — Productization
- Desktop shell
- Skills gateway
- Dynamic context overlay
- Junior hub

---

## 5. Architecture (Minimal)

```
┌─────────────────────────────────────────────────────────────────┐
│                    EndiorBot CLI                                │
│                                                                 │
│   Ask → Context → 3 Models → Consolidate → Propose → Approve   │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │   Claude    │  │   o3-mini   │  │   Gemini    │            │
│   │  (Primary)  │  │ (Critique)  │  │  Thinking   │            │
│   │  Coding &   │  │  Reasoning  │  │ (Critique)  │            │
│   │   Docs      │  │  & Debate   │  │  Reasoning  │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 Control Plane + Brain (L4)              │   │
│   │  propose → approve → execute → audit                    │   │
│   │  Brain injected at session start (max 2K tokens)        │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Brain (4-Layer Iceberg)

| Layer | Content | Inject When |
|-------|---------|-------------|
| L1 Events | Session logs, fix attempts | Never (too noisy) |
| L2 Patterns | Error signatures, fix hints | On similar errors |
| L3 Structures | Module maps, file trees | On project switch |
| L4 Mental Models | Decision heuristics | Session start |

**Token Budget**:
- Max 2K tokens/turn for context injection
- Max 3 blocks injected per turn
- Hard reset after 30 turns

---

## 7. Safety (ActionControlPlane)

```typescript
interface ActionProposal {
  action: string;
  risk: 'READ' | 'WRITE' | 'DESTRUCTIVE' | 'MONEY' | 'ADMIN';
  requiresApproval: boolean;
  idempotencyKey: string;
}

// Default behaviors
READ → auto-approve
WRITE → auto-approve (within project)
DESTRUCTIVE → require CEO approval
MONEY → require CEO approval
ADMIN → require CEO approval
```

**Blocked Commands**: `rm -rf`, `DROP TABLE`, `git push --force`, etc.

---

## 8. Success Metrics

| Metric | Target | Tier |
|--------|--------|------|
| Decision time | <30s (not 30-60 min) | MVP |
| Context switch | <2s | MVP |
| No copy/paste | 0 app switches | MVP |
| Gate status | At a glance | MVP |
| Session resume | No context loss | Pro |
| Context drift | <5% re-explanations | Pro |

---

## 9. Agent Orchestration

```
CEO: @pm "plan payment gateway"
  → PM executes via Claude Code
  → Handoff JSON to @architect
  → Architect executes
  → Handoff to @coder
  → Coder creates patch
  → CEO confirms apply
  → Handoff to @reviewer
  → Review complete
```

### Claude Code Bridge (3 Modes)

| Mode | Flag | Description |
|------|------|-------------|
| READ | (default) | No file changes, output text only |
| PATCH | --patch | Claude outputs diff, CEO confirms |
| INTERACTIVE | --interactive | Opens Claude Code for human takeover |

### Agent Transitions (SE4A)

```
researcher → pm
pm → architect, pjm
architect → coder, reviewer
coder → reviewer, tester
reviewer → coder, pm
tester → coder, devops
devops → tester
```

---

## 10. Autonomy Levels

| Level | Name | Version | Description |
|-------|------|---------|-------------|
| **L1** | Assisted | v1.0 | CEO confirms each step |
| **L2** | Supervised | v1.5 | Context anchoring, checkpoints |
| **L3** | Semi-Autonomous | v1.8 | Stage contracts, patch discipline |
| **L4** | Autonomous | v2.0 | Full 120min+ sessions |

---

## 11. Vision v2.0: Autonomous SDLC Agent

```
EndiorBot v2.0 transforms from a "Solo Developer Power Tool" to an "Autonomous SDLC Agent"
that can run 120+ minute sessions without human intervention while maintaining
full SDLC compliance and self-healing capabilities.
```

### Approval Status

| Stakeholder | Status |
|-------------|--------|
| CEO | ✅ Vision Approved |
| Expert #1 (Architecture) | ✅ A+++ Rating |
| Expert #2 (Pragmatic) | ✅ Approved with P0 fixes |
| CTO | ✅ Signed Off |

---

## 12. P0 Requirements (12 Total)

### Original 6 P0 Fixes (Expert-Approved)

**Fix 1: Gate A = Plan-Only Mode**
```yaml
gate_a:
  planPatch: ENABLED
  applyPatch: DISABLED
  verifyPatch: READ_ONLY_CHECKS
```

**Fix 2: WRITE_NEW Rate Limiting + Session Budget**
```yaml
limits:
  max_new_files_per_stage: 10
  max_new_files_per_session: 25
  max_modified_files_per_session: 30
  max_loc_per_file: 500
overflow: BATCH_CONFIRM
```

**Fix 3: Non-Blocking = Reversible Only**
```yaml
irreversibility_scores:
  variable_naming: 0.1      # Non-blocking OK
  function_signature: 0.3   # Batch confirm
  database_choice: 0.9      # MUST BLOCK
  auth_strategy: 0.95       # MUST BLOCK

reversible_definition:
  - rollback via "git reset --hard checkpoint"
  - does not break spec snapshot
```

**Fix 4: Spec Snapshot Bundle (ADR-011)**
```yaml
spec_snapshot:
  id: "sha256:..."
  sources:
    - docs/01-planning/requirements.md
    - docs/02-design/api-spec.yaml
    - docs/02-design/schema.sql
    - docs/02-design/architecture.md
    - docs/03-integrate/contracts.md
  hash_method: "sha256(concat(canonicalize(files)))"

drift_policy:
  on_spec_change: PAUSE_AND_ESCALATE

patch_metadata:
  implements_snapshot: "<id>"  # REQUIRED
```

**Fix 5: Risk Scoring + Action Mapping**
```yaml
risk_thresholds:
  AUTO: 0.3
  BATCH: 0.6
  CONFIRM: 0.8
  ESCALATE: 1.0

risk_action:
  confirm_payload: decision_packet
  timeout: 30m
  fallback_on_timeout: PAUSE
```

**Fix 6: Patch Decision Packet**
```typescript
interface PatchDecisionPacket {
  blastRadius: {
    filesCreated: number;
    filesModified: number;
    filesDeleted: number;
    totalLocDelta: number;
  };
  risk: RiskScore;
  irreversibility: number;
  rollback: {
    command: string;
    checkpoint: string;
    safetyLevel: "SAFE" | "PARTIAL" | "RISKY";
  };
  evidence: {
    specSnapshotId: string;
    testsPassed: boolean;
    lintPassed: boolean;
    coverage: number;
  };
}
```

### CTO 6 P0 Additions

**P0-1: Gate A Path Policy**
```yaml
gate_a_paths:
  allowed:
    - "docs/**"
    - ".endiorbot/sessions/**"
    - "SESSION-PROGRESS.md"
  forbidden:
    - "src/**"
    - "tests/**"
    - "package.json"
    - "*.lock"
```

**P0-2: Stage 03-Integrate Mandatory**
```yaml
stage_order:
  gate_c: [01, 02, 03, 04, 05]  # 03 CANNOT SKIP
  stage_03_required:
    - integration_plan
    - env_requirements
    - contracts
```

**P0-3: 2-Tier Verify Strategy**
```yaml
verify_strategy:
  patch_small:
    checks: [tsc, lint]

  patch_build:
    checks: [tsc, lint, targeted_tests]

  stage_end:
    checks: [full_test_suite]
```

**P0-4: Event-Based Anchoring**
```yaml
anchoring_schedule:
  triggers:
    - on_session_start
    - every_15_min
    - on_task_completion
    - on_stage_transition
    - on_escalation
    - on_rollback
```

**P0-5: Model Tiering Cap**
```yaml
model_tiering:
  complex:
    max_minutes_per_session: 20
    max_cost_per_session: $3
```

**P0-6: Failure Evidence Requirements**
```yaml
failure_classification:
  DESIGN_ISSUE:
    requires_evidence: 2
    evidence_types:
      - repeated_same_failure_after_2_attempts
      - contract_spec_mismatch_keyword
      - requires_breaking_change
      - cross_module_ripple_detected
```

---

## 13. Hard Guards

| Guard | Description | ADR |
|-------|-------------|-----|
| Spec Snapshot | SHA256 of specs, drift → PAUSE | ADR-011 |
| Risk Scoring | Heuristic formula, thresholds | - |
| Blast Radius | Decision packet per batch | - |
| Per-Stage Budget | $10 total, allocated per stage | - |

---

## 14. Golden Scenarios

### Gate A (v1.5): Planning + Design Only
```bash
endiorbot autopilot "Design auth" --gate A --duration 30m --budget 2

# ✅ Creates docs/** artifacts
# ✅ Updates SESSION-PROGRESS.md
# ❌ NO src/** or tests/** writes
```

### Gate B (v1.8): Limited Writes
```bash
endiorbot autopilot "Implement model" --gate B --duration 30m --max-files 10

# ✅ Max 10 new files
# ✅ Patch discipline enforced
# ✅ Decision packets generated
```

### Gate C (v2.0): Full Autonomy
```bash
endiorbot autopilot "Build auth system" --gate C --duration 2h --budget 10

# ✅ Full SDLC loop (01→02→03→04→05)
# ✅ 120+ min session
# ✅ < 3 escalations
# ✅ Opus ≤20min/$3
```

---

## 15. Roadmap

```
┌─────────────────────────────────────────────────────────────────────────┐
│  v1.0 (Sprint 61-62) ✅ COMPLETE (34h)                                 │
│  └── Init, Compliance, Solo Developer Power Tool                       │
│                                                                         │
│  v1.5 (Sprint 65) ✅ COMPLETE (34h)                                   │
│  └── Context Anchoring, Git Time-Travel, Checkpoints                  │
│  └── ADRs: 006, 007, 011                                              │
│                                                                         │
│  v1.8 (Sprint 68) ✅ COMPLETE (40h)                                   │
│  └── Stage Contracts, Patch Discipline, Risk Scoring                  │
│  └── ADRs: 008, 009                                                   │
│                                                                         │
│  v2.0 (Sprint 72) ✅ COMPLETE (80h)                                   │
│  └── 2h autopilot, full SDLC loop                                     │
│  └── ADR: 010                                                         │
│                                                                         │
│  Total Post-v1.0: ~154h                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 16. CTO Sign-off Checklist

### Sprint 65 (v1.5) – Gate A ✅ COMPLETE
- [x] Spec snapshot bundle defined + hashing canonicalization done
- [x] Gate A allow/deny paths enforced
- [x] SESSION-PROGRESS.md generator runs on time/event triggers
- [x] Git branching: `auto/session-{id}` + checkpoint commits
- [x] `autopilot --gate A` passes 3 times on 3 sample repos

### Sprint 68 (v1.8) – Gate B ✅ COMPLETE
- [x] PatchManager enforced (no raw writes)
- [x] 2-tier verify strategy working (fast checks vs full)
- [x] Decision packet includes blast radius + rollback command
- [x] Stage contract engine blocks transitions correctly (02→03→04)
- [x] Event-log has ESCALATION_CREATED, ESCALATION_RESOLVED

### Sprint 72 (v2.0) – Gate C ✅ COMPLETE
- [x] Operation-based autonomy policy enforced (not just config)
- [x] Non-blocking escalation queue + conservative choice rules
- [x] Task compiler spec→DAG works on sample OpenAPI
- [x] Test/fix loop stops at attempt limits and rollbacks correctly
- [x] Model tiering cap: Opus ≤20 min / $3 per session

---

## 17. Success Metrics

| Metric | v1.0 | v1.5 | v1.8 | v2.0 |
|--------|------|------|------|------|
| Session duration | 30m | 60m | 60m | 120m+ |
| Context retention | 50% | 85% | 90% | 95% |
| Recovery success | 0% | 90% | 95% | 98% |
| SDLC compliance | Reactive | Reactive | Proactive | Proactive |
| Human interventions | Frequent | Moderate | Minimal | Rare |
| Cost efficiency | Baseline | -10% | -25% | -40% |
| AER* | N/A | 10 min | 15 min | 30 min |
| Opus cap | N/A | N/A | N/A | ≤20min/$3 |
| Session file budget | N/A | N/A | 25 new | 25 new |

*AER (Autonomy Efficiency Ratio): calculated from event-log

---

## 18. ADR List

| ADR | Title | Sprint | Gate |
|-----|-------|--------|------|
| ADR-006 | Checkpoint Architecture | 65 | A |
| ADR-007 | Patch Discipline | 65 | A |
| ADR-008 | Concurrency Model | 68 | B |
| ADR-009 | Model Tiering Strategy | 72 | C |
| ADR-010 | Escalation Queue | 72 | C |
| ADR-011 | Spec Snapshot & Drift Policy | 65 | A |

---

## 19. Configuration Files

| File | Description | Gate |
|------|-------------|------|
| stage_contracts.yaml | SDLC stage transition rules | A |
| spec_snapshot.yaml | SHA256 + drift policy | A |
| risk_scoring.yaml | Heuristic formula | B |
| model_tiering.yaml | Dynamic model selection | C |
| autonomy_policy.yaml | Operation permissions | C |

---

## 20. What's NOT in v1.0

| Feature | Target | Reason |
|---------|--------|--------|
| Enterprise team features | Post v1.0 | Solo developer focus |
| Complex RBAC | Post v1.0 | Just CEO + Junior roles |
| Heavy infrastructure | Never | No DB, Redis, MinIO |
| Usage billing | Post v1.0 | Not needed |
| VS Code Extension | Post v1.0 | CLI-first |
| Slack Integration | Post v1.0 | Telegram/Zalo first |

---

## 21. Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-07 | Bridge & Intelligence roadmap (Sprint 84-92) | ADR-024/025/026 + CTO 10/10 final sign-off |
| 2026-03-07 | Claude Code Agent Teams (ADR-026) | Sprint 89-91, CTO 9/10→10/10, feature flag gating |
| 2026-03-07 | Sprint 84 SOUL Bridge Foundation complete | 66 tests, Strategy A/B, PJM 7.5/10 all resolved |
| 2026-03-01 | Master Plan v3.2 FINAL approved | Vision v2.2 + 12 P0 + CTO sign-off |
| 2026-03-01 | 6 CTO P0 additions | Gate A paths, Stage 03, 2-tier verify, etc. |
| 2026-03-01 | v1.0 target: Sprint 61-62 | Init + Compliance focus |
| 2026-02-28 | Agent Orchestration complete | 3 modes: read/patch/interactive |
| 2026-02-28 | Identity = Solo Developer Power Tool | 4-expert panel: scope crisis resolution |

---

## 22. Bridge & Intelligence System (Sprint 82-92)

**Added:** 2026-03-07 — CTO APPROVED 10/10 Final Sign-Off

EndiorBot's Bridge system enables remote multi-agent management from Telegram. The Intelligence system progressively injects persona, brain, context, and evaluator layers into Bridge sessions.

```
Sprint 82-84  ✅ COMPLETE   Bridge Foundation + SOUL Persona (ADR-024, ADR-025)
Sprint 85-86  ✅ COMPLETE   Permission Approval + /send Command (ADR-024 complete)
Sprint 87-88  ✅ COMPLETE   Brain L4 + Evaluator + Vibecoding (Intelligence parity)
Sprint 89-91  ✅ COMPLETE   Claude Code Agent Teams (ADR-026)
Sprint 92     ✅ COMPLETE   Unified App Launcher
```

### ADRs

| ADR | Title | Sprint | CTO Score |
|-----|-------|--------|-----------|
| ADR-024 | Notification Bridge + Multi-Agent Session Management | 82-86 | 10/10 |
| ADR-025 | Session Intelligence Envelope + 3-Layer Context Model | 84-88 | 8/10 |
| ADR-026 | Claude Code Agent Teams | 89-91 | 9/10→10/10 |

### 3-Layer Context Model (ADR-025)

| Layer | When | Content | Sprint |
|-------|------|---------|--------|
| Launch-time (immutable) | Session creation | SOUL persona, Brain L4, Team charter | 84, 87, 89 |
| Turn-time (mutable) | Each /send | Sprint goals, blockers, permissions | 85, 86 |
| Post-turn (derived) | After agent output | Evaluator score, vibecoding | 88 |

**Total effort:** ~288h across 8 sprints (all completed), 8,124 tests as of Sprint 144

See [Roadmap](../01-planning/roadmap.md) Tier 4 for full sprint breakdown.

---

*EndiorBot Master Plan*
*Identity: Solo Developer Power Tool (LOCKED)*
*SDLC Framework v6.4.0 compliant — Updated Sprint 144 (2026-04-27)*
