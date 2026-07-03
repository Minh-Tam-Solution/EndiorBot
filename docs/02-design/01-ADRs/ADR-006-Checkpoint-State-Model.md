---
status: ACCEPTED
authority:
  proposer: "@architect"
  countersigners:
    - actor: "@cto"
      date: "2026-02-22"
      grade: "9/10"
      reference: "sprint-35-autonomy-phase-1"
    - actor: "@cpo"
      date: "2026-02-22"
      grade: "A+"
      reference: "sprint-69-71-session-resilience"
  trigger: "Long-running AI sessions need deterministic recovery from failures without human intervention"
  notes: "Retroactive ADR. Original interface defined Sprint 35; state machine + scheduler + failure classifier shipped Sprint 69-72. Written from running implementation."
sdlc_framework: "6.4.0"
---

# ADR-006: Checkpoint State Model

## Status

ACCEPTED (retroactive — core interface approved Sprint 35; resilience engine shipped Sprint 69-72)

## Context

EndiorBot targets autonomous runs of 1-2+ hours across SDLC stages (planning → design → build → test). Without structured checkpointing, any failure — network hiccup, API rate limit, lint error, or process crash — forces a complete restart, wasting minutes to hours of prior work and accumulated context.

The system requires:

1. **Durable checkpoints** that capture the complete execution state at any point
2. **Deterministic resume** that replays the session from exactly where it stopped
3. **Structured failure classification** to decide whether to retry, fix, or escalate
4. **Automatic checkpoint scheduling** without requiring human trigger
5. **Safe rollback** using stable primitives (not ad-hoc shell commands)

A naive "save state to disk" approach fails because AI sessions involve side effects (git commits, file writes, API calls) that must not be replayed naively on resume. The system must track completed actions, detect file conflicts, and classify failures into actionable categories before deciding on a recovery path.

## Decision

### Three-Component Architecture

The checkpoint system ships as three coordinated components, each independently configurable and singleton-managed:

```
ResilienceStateMachine   — tracks WHERE in the SDLC the session is
CheckpointScheduler      — decides WHEN to create checkpoints
FailureClassifier        — determines WHY it failed and WHAT to do
RecoveryEngine           — coordinates HOW to recover
```

---

### 1. Resilience State Machine

**File**: `src/sessions/state-machine.ts`

A session has exactly one of nine SDLC-aligned states at any time:

```
INIT → PLANNING → DESIGN → INTEGRATE → BUILD → TEST → DONE
                                                 ↓
                                               ERROR → PAUSED
```

#### State Definitions

| State | Meaning |
|-------|---------|
| `INIT` | Session created, no work started |
| `PLANNING` | Requirements and task decomposition in progress |
| `DESIGN` | Architecture decisions and ADR writing |
| `INTEGRATE` | Dependency resolution and interface wiring |
| `BUILD` | Code generation and implementation |
| `TEST` | Test execution and coverage verification |
| `DONE` | All tasks complete, session succeeded |
| `ERROR` | Unrecoverable error; recovery or escalation pending |
| `PAUSED` | Voluntarily suspended (user pause, budget pause, gate check) |

#### Transitions (18 defined)

**Normal SDLC progression:**

| Trigger | From → To |
|---------|-----------|
| `start` | INIT → PLANNING |
| `plan_complete` | PLANNING → DESIGN |
| `design_complete` | DESIGN → INTEGRATE |
| `integration_ready` | INTEGRATE → BUILD |
| `build_complete` | BUILD → TEST |
| `tests_pass` | TEST → DONE |

**Skip paths (fast-forward for simple tasks):**

| Trigger | From → To |
|---------|-----------|
| `quick_start` | INIT → BUILD |
| `skip_design` | PLANNING → BUILD |
| `skip_test` | BUILD → DONE |

**Error and recovery paths:**

| Trigger | From → To |
|---------|-----------|
| `fatal_error` | `*` → ERROR |
| `escalate` | ERROR → PAUSED |
| `retry` | ERROR → BUILD |
| `retry_build` | BUILD → BUILD |
| `test_failure` | TEST → BUILD |
| `design_issue` | TEST → DESIGN |
| `replan_needed` | BUILD → PLANNING |

**Pause/resume:**

| Trigger | From → To |
|---------|-----------|
| `pause` | `*` → PAUSED |
| `resume` | PAUSED → `*` (previous state) |

Each transition may carry a **guard** (`() => Promise<boolean>`) that blocks the transition if the condition is not met, and an **action** (`() => Promise<void>`) executed atomically with the state change. Transition history is serialized and stored in checkpoint state for audit trail and restore.

---

### 2. Checkpoint Scheduler

**File**: `src/sessions/checkpoint/scheduler.ts`

The scheduler decides when to create a checkpoint using three orthogonal trigger types evaluated in priority order (lower number = higher priority):

#### Trigger Types

| Type | Mechanism | Default Configuration |
|------|-----------|----------------------|
| `event` | Specific lifecycle events | Multiple events, priority 0-2 |
| `time` | Wall-clock interval | Every 15 minutes, priority 3 |
| `patch_count` | File patches written | Every 5 patches, priority 2 |

#### Default Event Triggers

| Event | Priority | Checkpoint Reason |
|-------|----------|------------------|
| `escalation` | 0 | `escalation` |
| `rollback` | 0 | `before_rollback` |
| `before_risky_action` | 0 | `before_risky_action` |
| `stage_complete` | 1 | `milestone` |
| `error` | 1 | `error_recovery` |
| `task_complete` | 2 | `milestone` |
| `gate_pass` | 2 | `milestone` |
| `gate_fail` | 2 | `error_recovery` |

#### Minimum Interval Guard

A configurable `minInterval` (default: 5 seconds) prevents checkpoint storms. Even if multiple triggers fire simultaneously, only one checkpoint is created per interval.

#### Usage Pattern

```typescript
const scheduler = new CheckpointScheduler({ enabled: true });

// On lifecycle event
const result = scheduler.shouldCheckpoint({ type: 'stage_complete', payload: { stage: '04-BUILD' } });
if (result) {
  await createCheckpoint(result.reason, result.description);
  scheduler.recordCheckpoint();
}

// On file patch
scheduler.onPatchCreated();  // increments internal counter
```

---

### 3. Failure Classifier

**File**: `src/sessions/failure/classifier.ts`

Every error is classified into exactly one of three failure types, each mapping to a distinct recovery action:

#### Failure Type Taxonomy

| Type | Recovery Action | Criteria |
|------|----------------|---------|
| `TRANSIENT` | Retry with exponential backoff | Network errors, rate limits, timeouts |
| `FIXABLE` | Automated fix loop | Lint errors, type errors, test failures |
| `DESIGN_ISSUE` | Escalate to human | Spec mismatches, breaking changes, repeated failures across types |

Classification is **ordered**: TRANSIENT is checked first, then FIXABLE, then DESIGN_ISSUE as default. This ensures a network error is never treated as a design flaw.

#### Transient Patterns (representative)

`ECONNREFUSED`, `ETIMEDOUT`, `429 Too Many Requests`, `503 Service Unavailable`, `rate limit`, `socket hang up`, `fetch failed`

#### Fixable Patterns (representative)

`TS\d{4}:` (TypeScript errors), `eslint`, `test failed`, `assertion failed`, `cannot find module`, `syntax error`, `build error`

#### Design Issue Evidence Types

DESIGN_ISSUE escalation requires **at least 2 distinct evidence types** (CTO P0-6 rule). Evidence types:

| Evidence Type | Detection Condition |
|---------------|-------------------|
| `repeated_failure` | `attempts >= 3` for the same task |
| `spec_mismatch` | Error message matches `/spec.*mismatch/i` |
| `breaking_change` | Error message matches `/breaking.*change/i` |
| `cross_module_ripple` | `/cross.*module/i` or `relatedFiles.length >= 3` |
| `type_system_conflict` | `/type.*system|incompatible.*types/i` |
| `integration_failure` | `/integration.*fail/i` |
| `performance_regression` | `/performance.*regression|too.*slow/i` |

If fewer than 2 evidence types are present, the failure is downgraded to FIXABLE rather than escalated.

---

### 4. Recovery Engine

**File**: `src/sessions/recovery/engine.ts`

The recovery engine orchestrates the three recovery strategies:

#### Strategy: RETRY (Transient)

Exponential backoff: `delay = min(baseDelay × 2^attempt, maxDelay)`. Default: `baseDelay=1000ms`, `maxDelay=30000ms`, `maxRetries=3`. After max retries, triggers rollback if `autoRollback=true`, otherwise escalates as `MAX_RETRIES`.

#### Strategy: FIX (Fixable)

Up to `maxFixAttempts=3` attempts (configurable). After max attempts, checks design issue evidence. If evidence threshold is met, escalates as `DESIGN_ISSUE`; otherwise escalates as `MAX_FIX_ATTEMPTS`.

#### Strategy: ESCALATE (Design Issue / Limits)

Collects all `FailureEvidence` for the task, generates contextual suggestions, and returns an `EscalationDetails` object with:
- Escalation type: `DESIGN_ISSUE | MAX_RETRIES | MAX_FIX_ATTEMPTS | CRITICAL_ERROR`
- All failure evidence
- Suggested human actions (type-specific)
- Affected file list from evidence

#### Brain L2 Pattern Matching (Sprint 143)

Before returning RETRY or FIX results, the engine queries Brain L2 for error patterns matching the current error (substring match, `count >= 2` threshold to avoid one-off injection). When a match is found, `patternHint` is included in the `RecoveryResult` for the agent to inject into its next attempt context:

```
[Brain L2] Prior pattern "TS2322: Type" (seen 4×): Cast intermediate value through `unknown` first
```

#### Rollback

When the engine cannot recover, it fetches the latest checkpoint via `getLatestCheckpoint()` and returns a `ROLLBACK` action with the checkpoint ID. The actual restore is handled by the caller (typically `AutonomousSessionManager`).

---

### CheckpointState Interface

The checkpoint captures the complete session snapshot needed for deterministic resume. Key groupings (full interface in `src/sessions/checkpoint/types.ts`):

| Group | Purpose |
|-------|---------|
| `meta` | Schema version, creation timestamp, reason, execution trace digest, runtime fingerprint |
| `session` | Session ID, messages, token count, SDLC stage, active gates |
| `execution` | Current SDLC phase, task queue, step stack, pending tool calls |
| `provenance` | Git commit SHA, lockfile hash, Node version, model config, env fingerprint (no secrets) |
| `idempotency` | Completed actions (must-not-retry), idempotency keys map, tool call output cache |
| `filesystem` | Modified files, created files, SHA256 file hashes for conflict detection |
| `git` | Current branch, uncommitted changes, last stable checkpoint ref |
| `cost` | Session cost, token usage per model, remaining time budget |
| `statemachine` | Gate status map, evidence bindings, pending approvals |
| `brain` | Brain version + digest (reference only, not embedded) |

#### Restore Flow (9 Steps)

1. **Version check** — migrate schema if needed
2. **Provenance check** — warn if repo commit or Node version has changed; abort if lockfile hash changed
3. **File conflict detection** — classify conflicts as trivial/additive/semantic/structural; auto-resolve trivial; prompt for semantic/structural
4. **Idempotency filter** — exclude completed actions from retry list
5. **Brain verification** — warn if brain digest has changed (non-blocking)
6. **State machine restore** — reload gate status and approval queue
7. **Session restore** — reload session, active soul, task queue
8. **Tool call resume** — resume partial tool calls from `partialOutput`, retry others
9. **Success** — log resumed task count

#### Rollback Strategy

Rollback uses stable primitives only (no shell commands):

- `git reset --hard {lastStableCommit}` via the git module
- Apply reverse patches from `filePatchesBeforeChange` for uncommitted file changes
- External side effects (`push`, `approve`) are compensated forward, never reversed

---

### Checkpoint Storage

Checkpoints are stored per-project at:

```
~/.endiorbot/projects/{projectId}/checkpoints/{id}.json
```

Rotation: keep last 10 checkpoints. JSON compression applied when checkpoint exceeds 50KB.

Schema versioning: `schema_version` field (semver). Migrations are pure functions keyed on `"1.0.0→1.1.0"` paths.

---

## Consequences

### Positive

- **Hour-scale autonomy**: Session failures are recovered automatically without human restarts. TRANSIENT and FIXABLE failures are handled fully autonomously
- **No duplicate side effects**: `completedActions` + idempotency keys prevent double commits, double approvals on resume
- **Evidence-gated escalation**: CTO P0-6 rule (≥2 evidence types) prevents premature escalation on single-occurrence errors
- **Conflict-aware restore**: File hash comparison catches external changes between checkpoint and restore
- **Brain L2 acceleration**: Matching prior error patterns injects proven fix hints into retry context, reducing fix attempt count

### Negative

- **Checkpoint size**: Full state capture is ~100KB per checkpoint. Compressed at >50KB threshold
- **Classification false negatives**: Pattern matching on error messages can miss novel error formats. Confidence scoring is heuristic-based
- **Partial resume complexity**: Resuming streaming tool calls from `partialOutput` requires caller cooperation

### Mitigations

- Checkpoint rotation (keep last 10) bounds disk growth
- `minDesignIssueEvidence: 2` is configurable; can be raised or lowered per project
- Partial output resume is opt-in; tool calls without `partialOutput` are retried from the beginning

## Related ADRs

- **ADR-001**: Multi-Model Orchestrator — provides `SessionManager` and `SessionState` stored in checkpoints
- **ADR-003**: CLI-Desktop Protocol — `checkpoints:list` and `checkpoints:restore` IPC channels surface this module in the desktop UI
- **ADR-007**: Autonomous Execution Budget — `cost` group in `CheckpointState` feeds budget pause decisions
- **ADR-008**: Concurrency Model — `fileHashes` in checkpoint state is the conflict detection primitive
- **ADR-009**: Brain Architecture — `brainVersion` + `brainDigest` reference Brain L2 patterns used by Recovery Engine
- **ADR-042**: Autonomous Execution Engine — `AutonomousSessionManager` drives state machine transitions and invokes recovery engine

---

*ADR-006 v1.1.0 — ACCEPTED (retroactive)*
*EndiorBot Autonomy Epic — Sprint 35 interface + Sprint 69-72 implementation*
*SDLC Framework 6.4.0*
