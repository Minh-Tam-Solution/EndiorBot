# ADR-002: Project Context Switching

| Metadata | Value |
|----------|-------|
| **Status** | Proposed |
| **Date** | 2026-02-22 |
| **Authors** | PM, Architect |
| **Reviewers** | CTO |
| **Sprint** | 29 |

## Context

### Problem Statement

CEO works on multiple enterprise-scale projects:
- **Bflow**: ~1M LOC, ENTERPRISE tier
- **NQH-Bot**: ~200K LOC, STANDARD tier
- **MTEP**: ~500K LOC, ENTERPRISE tier

Currently, switching context requires:
- Closing/opening IDE windows
- Remembering SDLC state per project
- Losing conversation history
- ~5 minutes per switch

### Goal

Reduce context switch time to ~10 seconds with full state preservation.

## Decision

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Project Context Manager                       │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  Context Registry                        │   │
│   │  Projects: [Bflow, NQH-Bot, MTEP, ...]                  │   │
│   │  Active: Bflow                                          │   │
│   │  Max Loaded: 5                                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│         ┌──────────────────┴──────────────────┐                │
│         ▼                                      ▼                │
│   ┌──────────────┐                    ┌──────────────┐         │
│   │   Active     │                    │   Inactive   │         │
│   │   Context    │                    │   Contexts   │         │
│   │  (in memory) │                    │  (on disk)   │         │
│   └──────────────┘                    └──────────────┘         │
│                                                                 │
│   Storage: ~/.endiorbot/projects/{projectId}/context.json      │
└─────────────────────────────────────────────────────────────────┘
```

### Core Interfaces

```typescript
interface ProjectContext {
  id: string;                    // UUID
  name: string;                  // "Bflow"
  path: string;                  // "/Users/dttai/.../Bflow"
  tier: ProjectTier;
  
  // SDLC State
  sdlcConfig: SDLCConfig;
  
  // Session State
  session: SessionState;
  
  // Git State (snapshot)
  git: GitState;
  
  // Metadata
  createdAt: Date;
  lastActive: Date;
}

type ProjectTier = 'LITE' | 'STANDARD' | 'PROFESSIONAL' | 'ENTERPRISE';

interface SDLCConfig {
  frameworkVersion: string;      // "6.1.1"
  docsRoot: string;              // "docs"
  strict: boolean;
  currentStage: SDLCStage;       // "04-BUILD"
  currentSprint?: number;        // 45
  pendingGates: GateId[];        // ["G2-AR-457"]
}

interface SessionState {
  conversationId: string;
  tokenCount: number;
  maxTokens: number;
  messages: Message[];
  compactedHistory?: string;     // Summarized if large
  activeTask?: string;
}

interface GitState {
  branch: string;
  uncommittedFiles: number;
  lastCommit: string;
  isDirty: boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}
```

### Memory Budget by Tier

| Tier | Max Context Size | History Tokens | Concurrent |
|------|-----------------|----------------|------------|
| LITE | 50MB | 10K | 1 |
| STANDARD | 100MB | 50K | 3 |
| PROFESSIONAL | 200MB | 100K | 5 |
| ENTERPRISE | 500MB | 200K | 5 |

### State Preservation

#### Preserved on Switch
- Full conversation history (compacted if over limit)
- SDLC stage and gate status
- Uncommitted work warnings
- Active task/todo state
- Model preferences
- Custom prompts/context

#### Reset on Switch
- Streaming connections
- Temporary file references
- Active tool executions
- Real-time subscriptions

### Context Switch Flow

```
endiorbot switch nqh-bot
        │
        ▼
┌───────────────────┐
│ 1. Save Current   │
│    Context        │
│    (Bflow)        │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 2. Serialize to   │
│    Disk           │
│    context.json   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 3. Load Target    │
│    Context        │
│    (NQH-Bot)      │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 4. Apply SDLC     │
│    Config         │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 5. Display        │
│    Status         │
└───────────────────┘
```

### Storage Format

```
~/.endiorbot/
├── projects/
│   ├── bflow-001/
│   │   ├── context.json      # Full context state
│   │   ├── history.jsonl     # Conversation history
│   │   └── cache/            # Temporary data
│   ├── nqh-bot-001/
│   │   ├── context.json
│   │   └── history.jsonl
│   └── mtep-001/
│       ├── context.json
│       └── history.jsonl
├── active.json               # Currently active project ID
└── registry.json             # All registered projects
```

### CLI Interface

```bash
# Switch to a project
$ endiorbot switch bflow
  💾 Saved NQH-Bot session (12 messages, 45K tokens)
  📂 Loading Bflow (~1M LOC, ENTERPRISE tier)
  
  📊 Bflow Project Status
  ────────────────────────
  Sprint 45: Day 3 of 10
  Branch: feature/ar-457
  Pending Gates: G2 for AR-457
  
  🎯 Last Task: Design payment gateway (paused)

# List all projects
$ endiorbot projects list
  ┌────────────┬─────────────┬────────────┬────────────┐
  │ Name       │ Tier        │ Last Active│ Status     │
  ├────────────┼─────────────┼────────────┼────────────┤
  │ Bflow      │ ENTERPRISE  │ 2 min ago  │ Active     │
  │ NQH-Bot    │ STANDARD    │ 1 hour ago │ Saved      │
  │ MTEP       │ ENTERPRISE  │ Yesterday  │ Saved      │
  └────────────┴─────────────┴────────────┴────────────┘

# Register a new project
$ endiorbot projects register /path/to/project
  📋 Reading .sdlc-config.json...
  ✅ Registered: MyProject (STANDARD tier)

# Show current context
$ endiorbot context
  📊 Current Context: Bflow
  ────────────────────────
  Path: /Users/dttai/.../Bflow
  Tier: ENTERPRISE
  Tokens: 45,234 / 200,000
  Messages: 12
  Sprint: 45
  Stage: 04-BUILD
```

### History Compaction

When token count exceeds 80% of tier limit:

```typescript
async function compactHistory(context: ProjectContext): Promise<void> {
  const threshold = context.tier.maxTokens * 0.8;
  
  if (context.session.tokenCount < threshold) {
    return;
  }
  
  // Keep recent messages
  const recentMessages = context.session.messages.slice(-10);
  const olderMessages = context.session.messages.slice(0, -10);
  
  // Summarize older messages
  const summary = await summarizeMessages(olderMessages);
  
  // Update session
  context.session.compactedHistory = summary;
  context.session.messages = recentMessages;
  context.session.tokenCount = countTokens(recentMessages) + countTokens(summary);
}
```

## Alternatives Considered

### 1. Single Project Only
- **Pros**: Simpler, no context switching needed
- **Cons**: Doesn't match CEO workflow (multi-project)
- **Decision**: Rejected - CEO needs multi-project support

### 2. Full Context in Memory
- **Pros**: Faster switching
- **Cons**: High memory usage (~2GB for 5 ENTERPRISE projects)
- **Decision**: Rejected - prefer disk-based with caching

### 3. Cloud-Based Context Storage
- **Pros**: Cross-device sync
- **Cons**: Latency, security concerns, complexity
- **Decision**: Deferred - local-first for now, cloud later

## Consequences

### Positive
- 97% reduction in context switch time (5 min → 10 sec)
- Full state preservation
- Consistent SDLC tracking across projects
- Clear project boundaries

### Negative
- Disk I/O on every switch
- Storage growth over time
- History compaction may lose detail

### Risks
- **Context Corruption**: Mitigated by atomic writes
- **Large Context Files**: Mitigated by compaction
- **Stale State**: Mitigated by git state refresh on switch

## Implementation Plan

### Phase 1: Core Infrastructure (Sprint 29-30)
- [ ] Define TypeScript interfaces
- [ ] Implement ProjectContext serialization
- [ ] Create storage layer (read/write)
- [ ] Basic CLI commands

### Phase 2: Switch Logic (Sprint 30)
- [ ] Implement context save/load
- [ ] Git state capture
- [ ] SDLC config integration
- [ ] History compaction

### Phase 3: Polish (Sprint 31)
- [ ] Performance optimization
- [ ] Error recovery
- [ ] Migration from MTS-OpenClaw

## Verification

### Unit Tests
```typescript
describe('ProjectContextManager', () => {
  it('should save context to disk');
  it('should load context from disk');
  it('should switch contexts correctly');
  it('should preserve conversation history');
  it('should compact history when over limit');
  it('should handle corrupted context files');
});
```

### Integration Tests
- Full switch cycle between 3 projects
- Verify state preservation
- Test compaction threshold

### Performance Tests
- [ ] Switch latency < 2 seconds
- [ ] Memory usage < 200MB per ENTERPRISE project
- [ ] Disk usage monitoring

---

*ADR-002 created for EndiorBot Project Context Switching*
*SDLC Framework v6.4.0*
