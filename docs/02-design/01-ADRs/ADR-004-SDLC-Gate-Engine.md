# ADR-004: SDLC Gate Engine

**Status:** Accepted (Updated after E2E testing 2026-03-03)
**Date:** 2026-02-22
**Author:** Architect
**SDLC Stage:** 02-DESIGN

---

## Context

EndiorBot requires automated gate evaluation to reduce manual SDLC compliance tracking. The gate engine must support all gates defined in SDLC Framework v6.1.1:
- G0: Idea Validation
- G0.1: Scope Lock
- G1: Requirements Sign-off
- G2: Design Approval
- G3: Build Complete
- G4: Release Ready
- G-Sprint: Sprint Close

---

## Decision

Implement a rule-based gate evaluation engine with:
1. Tier-specific checklists (LITE, STANDARD, PROFESSIONAL, ENTERPRISE)
2. Auto-checkable items (file existence, test coverage, etc.)
3. Manual-check items (CEO approval required)
4. Evidence collection and storage
5. Vibecoding Index integration

---

## Design

### Gate Evaluation Algorithm

```typescript
interface GateEvaluation {
  gateId: 'G0' | 'G0.1' | 'G1' | 'G2' | 'G3' | 'G4' | 'G-Sprint';
  featureId: string;
  projectId: string;
  tier: 'LITE' | 'STANDARD' | 'PROFESSIONAL' | 'ENTERPRISE';

  checklist: ChecklistItem[];
  evidence: Evidence[];
  vibecodingIndex: VibecodingResult;

  result: 'PASS' | 'FAIL' | 'PENDING';
  evaluatedAt: Date;
  evaluatedBy: 'auto' | 'ceo';

  manualOverride?: {
    reason: string;
    approvedBy: string;
    timestamp: Date;
  };
}

interface ChecklistItem {
  id: string;
  description: string;
  required: boolean;
  autoCheck: boolean;
  status: 'pass' | 'fail' | 'manual' | 'pending';
  evidence?: string;
}

interface Evidence {
  type: 'file' | 'commit' | 'test_result' | 'screenshot' | 'document';
  path: string;
  hash: string;  // SHA256 for integrity
  description: string;
  collectedAt: Date;
}
```

### Checklist by Gate (Updated after E2E Testing)

| Gate | Auto-Check Items | Manual Items |
|------|------------------|--------------|
| G0 | problem-statement.md, business-case.md (STANDARD+) | CEO approves idea |
| G0.1 | scope.md, out-of-scope.md (PROFESSIONAL+) | CEO approves scope |
| G1 | requirements.md, user-stories.md | Acceptance criteria, stakeholder sign-off |
| G2 | ADR-*.md (glob), TS-*.md (STANDARD+) | Design review passed |
| G3 | `pnpm build`, `pnpm lint`, `pnpm test`, coverage > 80%, vibecoding < 30 | Code review complete |
| G4 | G3 passed, CHANGELOG.md, version bumped, dist/ (STANDARD+) | CEO release approval |
| G-Sprint | sprint-*-plan.md (glob) | Stories done, retrospective, CEO sign-off |

### Vibecoding Index Integration

```typescript
interface VibecodingResult {
  score: number;  // 0-100
  zone: 'green' | 'yellow' | 'orange' | 'red';
  signals: {
    name: string;
    value: number;
    weight: number;
    threshold: number;
    passed: boolean;
  }[];
}

// Zone definitions
// Green:  0-30  - Ship with confidence
// Yellow: 31-60 - Review recommended
// Orange: 61-80 - Significant review required
// Red:    81-100 - Block until fixed
```

### Gate Status Display (BUG-009 Fix)

The `gate status` command uses progress-aware display with real auto-check evaluation
instead of showing all gates with empty checkboxes.

**Display Logic:**

```
1. Create GateEngine (no commandRunner → fast file/glob/dir checks only)
2. Evaluate each gate sequentially
3. If gate auto-checks ALL pass → ⏳ AUTO-READY (pending CEO confirm)
4. First gate NOT auto-ready → 🔄 CURRENT (expanded checklist shown)
5. All gates after current → 🔒 LOCKED
```

**Example: Fresh project (no SDLC docs created yet)**

```
  🔄 G0 - Problem Validation  [0/3]
     ❌ Problem statement documented [auto]
     ❌ Business case documented [auto]
     ⬜ CEO approves idea

  🔒 G0.1 - Opportunity Assessment
  🔒 G1 - Requirements Lock
  🔒 G2 - Design Approval
  🔒 G3 - Build Complete
  🔒 G4 - Release Ready
  🔒 G-Sprint - Sprint Close
```

**Example: G0 auto-checks pass, G0.1 in progress**

```
  ⏳ G0 - Problem Validation  [2/3 — pending CEO confirm]
  🔄 G0.1 - Opportunity Assessment  [0/2]
     ❌ Scope document exists [auto]
     ⬜ CEO approves scope

  🔒 G1 - Requirements Lock
  ...
```

**Key Design Decision:** Auto-check items (file/glob/dir) run without `commandRunner`,
so `command:*` checks (build, lint, test) stay "pending" — keeping `gate status` fast.
Use `gate recommend <gateId>` for full evaluation with command execution.

### Gate Confirmation Persistence (BUG-010 Fix)

Gate confirmations are persisted to disk so they survive across CLI invocations.

**Problem:** Each CLI invocation creates a fresh `GateEngine` with an in-memory `Map`.
Confirmations via `gate confirm` were lost when the process exited.

**Solution:** File-based confirmation store at `~/.endiorbot/gate-confirmations/{projectId}.json`.

```typescript
// gate-store.ts
interface GateConfirmation {
  gateId: GateId;
  featureId: string;
  confirmedAt: string;
  confirmedBy: string;
  force: boolean;
  reason?: string;
}

// Persistence: ~/.endiorbot/gate-confirmations/{projectId}.json
interface GateConfirmationFile {
  projectId: string;
  confirmations: GateConfirmation[];
}
```

**Updated Display Logic (with persistence):**

```
1. For each gate in order:
2.   Check persisted confirmations → ✅ CONFIRMED
3.   Else evaluate auto-checks:
4.     All auto-checks pass → ⏳ AUTO-READY
5.     First non-ready → 🔄 CURRENT (expanded)
6.     After current → 🔒 LOCKED
```

**Example: G0-G1 confirmed, G2 in progress**

```
  ✅ G0 - Problem Validation  [2/3 — CONFIRMED]
  ✅ G0.1 - Opportunity Assessment  [0/2 — CONFIRMED]
  ✅ G1 - Requirements Lock  [0/4 — CONFIRMED]
  🔄 G2 - Design Approval  [0/3]
     ❌ Architecture Decision Record exists [auto]
     ❌ Technical specification exists [auto]
     ⬜ Design review passed

  🔒 G3 - Build Complete
  ...
```

**Files:** `src/sdlc/gates/gate-store.ts`, `src/cli/commands/gate.ts`

### Evidence Storage

```
~/.endiorbot/evidence/
├── {projectId}/
│   ├── G0/
│   │   ├── manifest.json
│   │   └── {evidence files}
│   ├── G2/
│   │   ├── manifest.json
│   │   ├── ADR-001.md.sha256
│   │   └── api-spec.md.sha256
│   └── G3/
│       ├── manifest.json
│       ├── build-log.txt
│       └── test-results.json
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Manual tracking | No implementation | Time-consuming, error-prone | ❌ Reject |
| External tool (Jira) | Rich features | Overkill, requires sync | ❌ Reject |
| Database-backed | Flexible queries | Heavy infrastructure | ❌ Reject |
| File-based engine | Lightweight, portable | Limited querying | ✅ Selected |

---

## Consequences

### Positive
- Automated gate compliance checking
- Evidence audit trail
- Reduced manual tracking effort
- Consistent evaluation across projects

### Negative
- File-based storage limits complex queries
- Manual items still require CEO action
- Evidence storage grows over time (mitigated by retention policy)

### Risks
- Checklist drift from framework updates (mitigate: version check)
- Evidence corruption (mitigate: hash verification)

---

## Implementation Plan

| Sprint | Task |
|--------|------|
| 31 | Core gate engine, G0-G2 support |
| 32 | G3-G4 support, evidence collection |
| 32 | Vibecoding integration |

---

## References

- [SDLC Framework v6.1.1](/.sdlc-framework)
- [Requirements: FR-003](../../../01-planning/requirements.md)

---

*SDLC Framework v6.4.0 - Stage 02: Design*
