# ADR-009: Brain Architecture

| Metadata | Value |
|----------|-------|
| **Status** | Approved |
| **Date** | 2026-02-24 |
| **Authors** | PM, Architect |
| **Reviewers** | CTO, CPO |
| **Sprint** | 45 |
| **Related ADRs** | ADR-006 (Checkpoint State), ADR-008 (Concurrency) |

## Context

### Problem Statement

EndiorBot currently operates with session-scoped context only:

- **No Cross-Session Memory**: Knowledge gained in one session is lost
- **No Pattern Persistence**: Recurring errors/fixes must be re-learned
- **No CEO Profile**: User coding preferences stored ad-hoc
- **No Checkpoint Provenance**: Cannot track which brain state a checkpoint was created with

Current state:
- Session ends → all context lost
- Same errors require same fix discovery
- No structured knowledge persistence
- Checkpoints have no brain reference

Goal: Implement persistent, LLM-agnostic knowledge storage following the "iceberg" layered model.

### Requirements (from Claude Cowork Research)

**Architecture Alignment Score**: 76% → Target 95%

**Gap Analysis**:
> "Working Memory / Structured Notes - Brain Architecture provides the storage foundation"

**Constraints**:
- No ML in storage layer (structured data only)
- File-based persistence (~/.endiorbot/brain/)
- Version tracking for checkpoint provenance
- CEO profile for personalization
- 4-layer iceberg model

## Decision

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Brain Architecture                            │
│                                                                  │
│   ~/.endiorbot/brain/                                           │
│   ├── version.json          # Brain version + metadata          │
│   ├── events.json           # Layer 1: Raw events               │
│   ├── patterns.json         # Layer 2: Recurring patterns       │
│   ├── structures.json       # Layer 3: Project architecture     │
│   ├── mental-models.json    # Layer 4: Decision heuristics      │
│   └── ceo-profile.json      # CEO preferences & style           │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Iceberg Model (4 Layers)                    │   │
│   │                                                          │   │
│   │  Layer 4: Mental Models (top - most abstract)           │   │
│   │  ├── Decision heuristics ("prefer X when Y")            │   │
│   │  └── Domain rules                                        │   │
│   │                                                          │   │
│   │  Layer 3: Structures                                     │   │
│   │  ├── Project architecture                                │   │
│   │  ├── Module maps                                         │   │
│   │  └── File trees                                          │   │
│   │                                                          │   │
│   │  Layer 2: Patterns                                       │   │
│   │  ├── Recurring errors                                    │   │
│   │  ├── Common fixes                                        │   │
│   │  └── Success/failure signatures                          │   │
│   │                                                          │   │
│   │  Layer 1: Events (bottom - most concrete)               │   │
│   │  ├── Session logs                                        │   │
│   │  ├── Fix attempts                                        │   │
│   │  └── Escalations                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              CEO Profile                                 │   │
│   │                                                          │   │
│   │  Style: { indent, quotes, semicolons }                  │   │
│   │  Preferences: { testing, documentation, reviews }       │   │
│   │  Conventions: { naming, structure, patterns }           │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Version & Digest                            │   │
│   │                                                          │   │
│   │  BrainVersion: "1.0.0" or timestamp                     │   │
│   │  BrainDigest: SHA-256 of layer manifests                │   │
│   │                                                          │   │
│   │  Checkpoint → stores brainVersion + brainDigest         │   │
│   │  Restore → loadBrainContext(version)                    │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Interfaces

```typescript
// Brain Version & Digest
interface BrainVersion {
  version: string;          // Semver "1.0.0" or timestamp
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
  layerVersions: {
    events: number;         // Increment on change
    patterns: number;
    structures: number;
    mentalModels: number;
  };
}

interface BrainDigest {
  hash: string;             // SHA-256 of layer contents
  computedAt: string;       // ISO 8601
  layerHashes: {
    events: string;
    patterns: string;
    structures: string;
    mentalModels: string;
    ceoProfile: string;
  };
}

// Layer 1: Events
interface EventEntry {
  id: string;               // UUID
  timestamp: string;        // ISO 8601
  type: EventType;          // session_start, fix_attempt, escalation, etc.
  sessionId?: string;       // Reference to session
  payload: Record<string, unknown>;
}

type EventType =
  | 'session_start'
  | 'session_end'
  | 'fix_attempt'
  | 'fix_success'
  | 'fix_failure'
  | 'escalation'
  | 'checkpoint_created'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied';

// Layer 2: Patterns
interface PatternEntry {
  id: string;               // UUID
  signature: string;        // Error fingerprint or pattern key
  type: PatternType;        // error, fix, success
  fixHint?: string;         // Suggested fix
  count: number;            // Occurrence count
  lastSeen: string;         // ISO 8601
  firstSeen: string;        // ISO 8601
  metadata?: Record<string, unknown>;
}

type PatternType = 'error' | 'fix' | 'success' | 'warning';

// Layer 3: Structures
interface StructureEntry {
  id: string;               // UUID
  projectId: string;        // Project identifier
  type: StructureType;      // module_map, file_tree, dependency_graph
  data: Record<string, unknown>;
  updatedAt: string;        // ISO 8601
}

type StructureType = 'module_map' | 'file_tree' | 'dependency_graph' | 'api_schema';

// Layer 4: Mental Models
interface MentalModelEntry {
  id: string;               // UUID
  domain: string;           // Domain area (e.g., "typescript", "testing")
  rule: string;             // Human-readable rule
  source: MentalModelSource;
  confidence: number;       // 0.0 - 1.0
  updatedAt: string;        // ISO 8601
}

type MentalModelSource = 'ceo_import' | 'derived' | 'manual';

// CEO Profile
interface CEOProfile {
  style: {
    indent: 'tabs' | 'spaces';
    indentSize: number;
    quotes: 'single' | 'double';
    semicolons: boolean;
    trailingComma: 'none' | 'es5' | 'all';
  };
  preferences: {
    testing: 'tdd' | 'bdd' | 'minimal';
    documentation: 'jsdoc' | 'tsdoc' | 'minimal';
    codeReviews: boolean;
    autoFormat: boolean;
  };
  conventions: {
    naming: 'camelCase' | 'snake_case' | 'PascalCase';
    fileNaming: 'kebab-case' | 'camelCase' | 'PascalCase';
    componentStructure: 'flat' | 'nested';
  };
  customRules?: string[];   // Additional CEO-specific rules
}

// Brain Facade
interface Brain {
  version: BrainVersion;
  digest: BrainDigest;

  // Layer access
  events: EventLayer;
  patterns: PatternLayer;
  structures: StructureLayer;
  mentalModels: MentalModelLayer;
  ceoProfile: CEOProfile;

  // Operations
  computeDigest(): BrainDigest;
  export(): BrainExport;
  getContext(version?: string): BrainContext;
}

// Layer Operations
interface EventLayer {
  append(entry: Omit<EventEntry, 'id' | 'timestamp'>): EventEntry;
  getAll(): EventEntry[];
  getSince(timestamp: string): EventEntry[];
  getBySession(sessionId: string): EventEntry[];
}

interface PatternLayer {
  add(entry: Omit<PatternEntry, 'id' | 'firstSeen' | 'lastSeen' | 'count'>): PatternEntry;
  get(signature: string): PatternEntry | undefined;
  getAll(): PatternEntry[];
  update(id: string, updates: Partial<PatternEntry>): PatternEntry;
  incrementCount(signature: string): PatternEntry;
}

interface StructureLayer {
  set(projectId: string, type: StructureType, data: Record<string, unknown>): StructureEntry;
  get(projectId: string, type: StructureType): StructureEntry | undefined;
  getAll(projectId?: string): StructureEntry[];
}

interface MentalModelLayer {
  set(entry: Omit<MentalModelEntry, 'id' | 'updatedAt'>): MentalModelEntry;
  get(domain: string): MentalModelEntry[];
  getAll(): MentalModelEntry[];
  remove(id: string): void;
}
```

### Storage Layout

```
~/.endiorbot/brain/
├── version.json           # BrainVersion
├── events.json            # EventEntry[]
├── patterns.json          # PatternEntry[]
├── structures.json        # StructureEntry[]
├── mental-models.json     # MentalModelEntry[]
├── ceo-profile.json       # CEOProfile
└── history/               # Version history (optional)
    ├── v1.0.0/
    └── v1.0.1/
```

### Checkpoint Integration (ADR-006)

```typescript
// CheckpointState (from ADR-006) includes brain reference
interface CheckpointState {
  id: string;
  timestamp: string;
  brainVersion: string;     // Reference to brain version
  brainDigest: string;      // Hash at checkpoint time
  // ... other checkpoint fields
}

// On checkpoint create
async function createCheckpoint(reason: string): Promise<CheckpointState> {
  const brain = await getBrain();
  const digest = brain.computeDigest();

  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    brainVersion: brain.version.version,
    brainDigest: digest.hash,
    // ... other fields
  };
}

// On checkpoint restore
async function restoreCheckpoint(checkpoint: CheckpointState): Promise<void> {
  // Load brain context at checkpoint time
  const brainContext = await loadBrainContext(checkpoint.brainVersion);
  // ... restore logic
}
```

### CLI Commands

```bash
# Show brain status
endiorbot brain status
# Output:
# Brain v1.0.0 (digest: abc123...)
# Events: 42 entries (last: 2h ago)
# Patterns: 15 entries
# Structures: 3 projects
# Mental Models: 8 rules
# CEO Profile: loaded

# Export brain
endiorbot brain export --output brain-backup.json

# Show layer contents
endiorbot brain layers events --limit 10
endiorbot brain layers patterns
```

## Alternatives Considered

### 1. SQLite Database
- **Pros**: SQL queries, indexes, transactions
- **Cons**: Adds dependency, overkill for simple data
- **Decision**: Rejected - JSON files are simpler and sufficient

### 2. Single JSON File
- **Pros**: Simpler, single read/write
- **Cons**: Large file, no layer isolation
- **Decision**: Rejected - layer separation is valuable

### 3. No Versioning
- **Pros**: Simpler
- **Cons**: Cannot track checkpoint provenance
- **Decision**: Rejected - versioning required for ADR-006

### 4. ML-Based Patterns
- **Pros**: Smarter pattern recognition
- **Cons**: Complexity, training data, inference cost
- **Decision**: Rejected - structured data only (no ML in storage)

## Consequences

### Positive
- **Cross-Session Learning**: Patterns persist between sessions
- **CEO Personalization**: Consistent coding style
- **Checkpoint Provenance**: Know which brain state created checkpoint
- **Simple Storage**: JSON files, no external dependencies
- **Layer Isolation**: Update layers independently

### Negative
- **Storage Growth**: Events accumulate over time
- **No ML**: Pattern recognition is rule-based only
- **File I/O**: Read/write on each operation

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Storage Growth** | Disk space | Event rotation (keep last N) |
| **Corruption** | Data loss | Atomic writes, backups |
| **Version Mismatch** | Restore errors | Migration scripts |
| **Performance** | Slow reads | Layer caching |

## Implementation Plan

### Sprint 45 Week 1: Brain Storage + Layers
- Day 1: ADR-009, types.ts, storage.ts
- Day 2: Layer 1 (Events)
- Day 3: Layer 2 (Patterns)
- Day 4: Layer 3 (Structures)
- Day 5: Layer 4 (Mental Models) + Digest

### Sprint 45 Week 2: CEO Profile + Evolution
- Day 6-7: CEO Profile
- Day 8: Evolution + Versioning
- Day 9: CLI commands
- Day 10: Integration + Gate

## Verification

### Unit Tests
```typescript
describe('BrainStorage', () => {
  it('should create brain directory');
  it('should read/write JSON files');
  it('should compute digest');
});

describe('EventLayer', () => {
  it('should append events');
  it('should filter by timestamp');
  it('should filter by session');
});

describe('PatternLayer', () => {
  it('should add patterns');
  it('should increment count');
  it('should update lastSeen');
});

describe('CEOProfile', () => {
  it('should load default profile');
  it('should save profile changes');
});
```

### Integration Tests
- Checkpoint creation includes brainVersion + brainDigest
- Brain digest changes when layers change
- loadBrainContext(version) returns correct snapshot

## Success Criteria (G-Sprint-45)

- [ ] Brain storage at ~/.endiorbot/brain/
- [ ] Four layers (events, patterns, structures, mental-models)
- [ ] CEO profile load/save
- [ ] Brain version and digest
- [ ] Checkpoint records brainVersion + brainDigest
- [ ] CLI: brain status, brain export
- [ ] Build and lint pass

## References

### Iceberg Model
- Inspired by data lakehouse architectures
- 4 layers: concrete (events) → abstract (mental models)

### Related Systems
- Git object model (content-addressed storage)
- SQLite virtual tables (layer abstraction)

### Amendment: 17th Anti-Drift Mechanism — SOUL Workspace Awareness (Sprint 143 A2)

**CTO correction (Sprint 142 review):** The runtime anti-drift inventory (16 systems) missed a 17th mechanism: **SOUL-level Workspace Awareness directives**.

5 executor SOULs (`SOUL-coder.md`, `SOUL-architect.md`, `SOUL-reviewer.md`, `SOUL-tester.md`, `SOUL-fullstack.md`) carry a `## Workspace Awareness (MANDATORY)` section (Sprint 135 P1) that instructs agents to discover workspace content before answering. This is the **documentation layer** complement to the runtime Layer 1.25 injection (`src/agents/context/workspace-awareness.ts`).

Without this SOUL-level directive, an agent launched via direct Claude Code CLI invocation (bypassing the context-injector pipeline) would not know to read CLAUDE.md/AGENTS.md. The SOUL section ensures workspace discovery is agent-intrinsic, not pipeline-dependent.

**Brain relationship:** This is not a Brain layer — it's a static SOUL template directive. But it serves the same anti-drift purpose as Brain L4 mental models: persist knowledge across sessions without runtime state.

---

*ADR-009 created for EndiorBot Brain Architecture*
*SDLC Framework v6.4.0 — amended Sprint 143*
