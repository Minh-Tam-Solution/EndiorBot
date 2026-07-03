# ADR-011: Composio Tool Integration

**Date**: 2026-02-25
**Status**: DEFERRED (Sprint 121)
**Authority**: Sprint 49 Complete, Multi-Expert Review
**Pillar**: 2 - Sprint Governance
**Stage**: 04 - BUILD
**SDLC**: Framework 6.4.0
**Deferred Rationale**: Composio integration requires external API dependency (`@composio/core`) and CEO use case validation for specific tool orchestration scenarios (GitHub, Gmail, Calendar). EndiorBot's current architecture (30 OTT commands, 13 SOUL agents, tmux bridge) serves the Solo Developer Power Tool use case without external tool execution. Reopen when a specific tool orchestration need arises that cannot be met by the existing command handler pattern.
**Reopen Condition**: CEO requests real-world action execution (e.g., "create GitHub issue from chat", "send email from bot") that cannot be handled by existing `/send` command or MTClaw MCP bridge.

---

## Context

EndiorBot currently provides AI-powered advice but cannot execute real-world actions. To transform from "advisor" to "executor", we need external tool integration capabilities.

**Composio** (`/path/to/composio/`) provides:
- 500+ pre-built tool integrations (GitHub, Gmail, Slack, etc.)
- Multi-provider support (OpenAI, Anthropic, LangChain, etc.)
- OAuth and authentication management
- TypeScript SDK with full type safety

**Review Process**:
- Expert 8 (Security-First SDLC): ⚠️ Conditional - 5 P0 issues identified
- Expert 9 (System Architect): ✅ Approved with phased approach
- CTO: ✅ Conditionally approved - scope conflict + corrections required

---

## Decision

### Overall

**INTEGRATE Composio** with security-first architecture, phased rollout, and curated tool whitelist.

---

## 5 Locked Decisions

### D-011-01: Tool Calls are Control Plane Concern ⚡ CRITICAL

**Problem**: Original plan had Provider layer executing tools directly (mixed concerns).

**Decision**: **ToolControlPlane** enforces trust boundary between AI proposals and execution.

**Architecture**:
```
Provider.chat() → returns tool_calls (proposals only)
                        ↓
ToolControlPlane → policy check (allow/deny/need-approval)
                        ↓
ApprovalQueue → CEO approval via OTT (if needed)
                        ↓
ToolExecutor → execute via Composio (ONLY if approved)
```

**Rationale**:
- Provider = text generation, NOT action execution
- Tools need policy, approval, audit, rate-limit, replay protection
- Clear separation of concerns

**Authority**: Expert 8 (Security-First SDLC) P0-1

---

### D-011-02: EntityId = Stable Principal ID ⚡ CRITICAL

**Problem**: Original plan used `entityId = email` (insecure, changeable, multi-tenant issues).

**Decision**: Use **internal UUID** as principal ID, map to Composio entity ID.

**Implementation**:
```typescript
interface PrincipalMapping {
  principal_id: UUID;           // Internal stable ID
  tenant_id?: UUID;             // For future multi-tenant
  composio_entity_id: string;   // Mapped in DB, not derived
}

// Database table
CREATE TABLE composio_connections (
  principal_id UUID REFERENCES users(id),
  composio_entity_id VARCHAR(255) UNIQUE,
  connection_id VARCHAR(255),
  app_name VARCHAR(100),
  created_at TIMESTAMP
);
```

**Rationale**:
- Email changes over time
- Email collision possible
- UUID stable and unique
- Multi-tenant ready

**Authority**: Expert 8 (Security-First SDLC) P0-2

---

### D-011-03: No Secrets in Brain ⚡ CRITICAL

**Problem**: Original plan mentioned "store tokens in Brain" (security risk).

**Decision**: **Brain stores events/patterns ONLY**. OAuth tokens in Composio managed store or keytar.

**Brain Layer 1 (Events)**:
```typescript
interface ToolEvent {
  tool_name: string;
  input_hash: string;      // NOT full input (privacy)
  output_summary: string;  // Truncated, no secrets
  success: boolean;
  latency_ms: number;
  cost_usd?: number;
  connection_id: string;   // Reference only, not token
  principal_id: UUID;
  timestamp: Date;
}
```

**Brain Layer 2 (Patterns)**:
```typescript
interface ToolPattern {
  pattern: string;  // "CEO uses Linear for bugs, not GitHub Issues"
  confidence: number;
  sample_count: number;
  last_seen: Date;
  // NO TOKENS, NO CREDENTIALS
}
```

**Rationale**:
- Brain = learning system, not secret vault
- Tokens exposed if Brain exported/backed up
- Composio manages OAuth lifecycle properly

**Authority**: Expert 8 P0-3 + CTO Correction

---

### D-011-04: Approval Required for WRITE/DESTRUCTIVE ⚡ CRITICAL

**Problem**: Original plan had `autoExecuteTools` without approval (dangerous).

**Decision**: **Policy-based approval system** with risk classification.

**Risk Classification**:
```typescript
type ToolRisk = 'READ' | 'WRITE' | 'DESTRUCTIVE' | 'MONEY' | 'ADMIN';

const TOOL_RISK_MATRIX: Record<string, ToolRisk> = {
  'github.get_issue': 'READ',           // Auto-allowed
  'github.create_issue': 'WRITE',       // Require approval
  'github.delete_repo': 'DESTRUCTIVE',  // Require approval
  'stripe.create_charge': 'MONEY',      // Require approval
  'github.add_collaborator': 'ADMIN',   // Require approval
};
```

**Default Policy**:
```typescript
const DEFAULT_POLICY: Record<ToolRisk, 'auto' | 'require_approval'> = {
  'READ': 'auto',              // Safe
  'WRITE': 'require_approval',
  'DESTRUCTIVE': 'require_approval',
  'MONEY': 'require_approval',
  'ADMIN': 'require_approval',
};
```

**Approval Token**:
- Expiry: 5 minutes
- One-time use
- Bound to: `(tool_name, args_hash, principal_id, connection_id)`
- Idempotency key required

**Rationale**:
- Safety > Speed for destructive operations
- CEO maintains control
- Audit trail for compliance

**Authority**: Expert 8 P0-4 + Expert 9 Permission Guard

---

### D-011-05: Tool Curation Required ⚡ CRITICAL

**Problem**: Original plan exposed 500+ tools to LLM (token bloat, confusion).

**Decision**: **Curated whitelist** - 10 tools in Phase 1, explicit opt-in for more.

**Sprint 50/51 Whitelist** (10 tools, 3 apps):
```typescript
const PHASE_1_TOOLS = [
  // GitHub (3 tools)
  'github.get_repo',          // READ
  'github.get_issue',         // READ
  'github.create_issue',      // WRITE (approval)

  // Gmail (2 tools)
  'gmail.list_messages',      // READ
  'gmail.send_message',       // WRITE (approval)

  // Google Calendar (2 tools)
  'google_calendar.list_events',   // READ
  'google_calendar.create_event',  // WRITE (approval)

  // Slack (2 tools)
  'slack.list_channels',      // READ
  'slack.send_message',       // WRITE (approval)

  // Shell (1 tool) - HIGH RISK
  'shell.execute_command',    // DESTRUCTIVE (approval + warning)
];
```

**Rationale**:
- LLM context efficiency
- CEO control over tools
- Gradual rollout
- 500+ tools = overwhelming

**Authority**: Expert 8 P1-1 + CTO "no 500+ tools by default"

---

## Implementation Details

### Module Structure

```
src/tools/
├── control-plane.ts         # ToolControlPlane (trust boundary)
├── policy-engine.ts         # Risk classification & rules
├── approval-queue.ts        # Approval token management
├── composio-client.ts       # Composio SDK wrapper
├── tool-registry.ts         # Tool discovery & caching
├── tool-executor.ts         # Execute after approval
├── auth-manager.ts          # Principal mapping (UUID)
├── audit-logger.ts          # Audit trail
├── types.ts                 # Tool-related types
└── index.ts                 # Exports
```

### Dependencies

```json
{
  "dependencies": {
    "@composio/core": "0.6.3"  // EXACT version (CTO)
  }
}
```

**Note**: `COMPOSIO_API_KEY` is OPTIONAL at startup (CTO). EndiorBot runs normally without Composio.

### Gateway Methods

```
tools.discover      // List available tools for principal
tools.execute       // Execute a tool call (with policy check)
tools.approve       // Approve a pending tool execution
tools.connections   // List connected accounts
tools.disconnect    // Remove connection
tools.dry-run       // Simulate execution without side effects (Expert 9)
```

### Brain Integration

**Layer 1 (Events)**: `src/brain/layers/events.ts` (CTO correction)
```typescript
brain.recordEvent({
  type: 'tool_execution',
  tool_name: 'github_create_issue',
  input_hash: sha256(JSON.stringify(input)),  // Privacy
  output_summary: truncate(result, 256),      // No secrets
  success: true,
  latency_ms: 1250,
  cost_usd: 0,
  connection_id: 'conn-123',
  principal_id: 'uuid-456',
  timestamp: new Date()
})
```

**Layer 2 (Patterns)**: `src/brain/layers/patterns.ts` (CTO correction)
```typescript
{
  pattern: "CEO uses Linear for bugs, not GitHub Issues",
  confidence: 0.85,
  sample_count: 15,
  last_seen: new Date()
}
```

### Evaluator Integration (Phase 2)

**New Dimension**: `toolEffectiveness` (5% weight)

**Weight Renormalization** (CTO requirement):
```typescript
interface DimensionWeights {
  correctness: 0.25,      // Was 0.30
  efficiency: 0.20,       // Same
  clarity: 0.15,          // Same
  safety: 0.20,           // Same
  ceoAlignment: 0.15,     // Same
  toolEffectiveness: 0.05 // NEW
}
```

**Scoring**:
- Tool selection accuracy
- Tool execution success
- Tool result relevance

**Implementation**: Async/optional scoring to avoid regressions (CTO).

### Provider Integration (Phase 2)

**Use ToolAwareOrchestrator, NOT BaseProvider extension** (CTO correction):

```typescript
// WRONG (original plan)
class BaseProvider {
  async chat() {
    // inject tools, execute tools... (mixed concerns)
  }
}

// CORRECT (CTO recommendation)
class ToolAwareOrchestrator {
  constructor(
    private provider: BaseProvider,
    private composioClient: ComposioClient,
    private controlPlane: ToolControlPlane
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // 1. Get response with tool_calls from provider
    const response = await this.provider.chat(request)

    // 2. If tool_calls, pass to ToolControlPlane
    if (response.toolCalls) {
      const decisions = await this.controlPlane.evaluate(response.toolCalls)
      // ... handle approve/deny/pending
    }

    return response
  }
}
```

**Rationale**: Keeps providers focused on chat, avoids touching all provider implementations.

---

## Security Constraints

### Prompt Injection Defense

```typescript
const TOOL_SYSTEM_PROMPT = `
You have access to the following tools: ${ALLOWED_TOOLS.join(', ')}.
NEVER use tools not in this list.
NEVER execute commands that:
- Access files outside the project directory
- Send data to external URLs not in the whitelist
- Modify system configuration
`;
```

### Connection Scoping

```typescript
async function executeWithScope(request: ToolExecutionRequest): Promise<ToolResult> {
  // Verify connection belongs to principal
  const connection = await getConnection(request.connection_id)
  if (connection.principal_id !== request.principal_id) {
    throw new SecurityError('Connection not owned by principal')
  }
  // Execute
}
```

### Audit Trail

```typescript
interface ToolAuditLog {
  principal_id: UUID;
  tool: string;
  args_hash: string;         // NOT full args (privacy)
  connection_id: string;
  result_summary: string;    // Truncated
  duration_ms: number;
  status: 'success' | 'failure' | 'denied' | 'pending_approval';
  timestamp: Date;
}
```

### Rate Limiting

```typescript
const RATE_LIMITS = {
  per_tool_per_minute: 10,
  per_principal_per_minute: 30,
  destructive_per_hour: 5,
}
```

### Replay Protection

```typescript
interface ApprovalToken {
  token: string;
  tool_name: string;
  args_hash: string;
  principal_id: UUID;
  connection_id: string;
  expires_at: Date;
  used: boolean;  // One-time use
}
```

---

## Phasing

### Phase 1 (Sprint TBD): Security-First Foundation

**Scope**:
- ToolControlPlane with policy engine
- ComposioClient wrapper
- Tool registry (10 curated tools)
- Tool executor with schema validation
- Approval queue
- Gateway methods
- OAuth via Device Code Flow (Expert 9)
- Principal mapping (UUID)
- Audit logging
- Brain Layer 1 event tracking
- Dry-run mode (Expert 9)

**NOT in Phase 1**:
- Provider integration
- Evaluator scoring
- Mental models

### Phase 2 (Sprint TBD+1): Integration

**Scope**:
- ToolAwareOrchestrator (wraps provider + Composio)
- CEO approval via OTT (Telegram/Zalo)
- Evaluator toolEffectiveness dimension
- Brain Layer 2 pattern recognition
- Mental models for tool preferences

---

## Success Metrics

### Phase 1

- **Safety**: 0 unauthorized tool executions
- **Reliability**: 0 duplicate executions under retry (idempotency)
- **Latency**: `tools.discover` < 300ms (cached)
- **Coverage**: 10 curated tools end-to-end tested
- **Audit**: 100% tool calls logged with required fields
- **Tests**: All 3,171+ existing tests pass + 30+ new tool tests

### Phase 2

- **Approval**: CEO approval flow working for 3+ OTT channels
- **Automation**: Mental models auto-approve 80%+ READ tools
- **Routing**: Multi-model routing improves success by 15%+
- **Patterns**: 5+ common tool workflows identified

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Composio API changes | Medium | High | Pin exact version (0.6.3) |
| OAuth flow complexity | Low | Medium | Use Composio Device Code Flow |
| Rate limit conflicts | Low | Medium | Composio respects provider limits |
| Tool execution failures | Medium | Medium | Proper error handling, retry logic, dry-run |
| Brain storage growth | Low | Low | Prune old events, compress patterns |
| Evaluation overhead | Low | Low | Async/optional scoring (CTO) |
| Version incompatibility | Medium | High | Lock exact 0.6.3, test before upgrade |

---

## Alternatives Considered

### Alternative 1: Build Custom Tool System
- **Pros**: Full control, no external dependency
- **Cons**: 6+ months dev time, fewer integrations, manual OAuth
- **Verdict**: ❌ Not recommended - reinventing wheel

### Alternative 2: Use LangChain Tools
- **Pros**: More mature, Python-first
- **Cons**: Heavy dependency, less TypeScript-friendly, no MCP
- **Verdict**: ⚠️ Possible but Composio better fit

### Alternative 3: Use MTS-OpenClaw's Tool System
- **Pros**: Already tested with EndiorBot's predecessor
- **Cons**: MTS-OpenClaw deprecated, limited integrations
- **Verdict**: ❌ Not viable - migration away from MTS-OpenClaw

---

## Consequences

### Positive

- ✅ Transform EndiorBot from advisor to executor
- ✅ 500+ tool integrations available (opt-in)
- ✅ OAuth managed by Composio (less complexity)
- ✅ Brain learns tool usage patterns
- ✅ Evaluator scores tool effectiveness
- ✅ CEO retains control via approval system

### Negative

- ⚠️ External dependency on Composio SDK
- ⚠️ OAuth flow complexity for CLI users
- ⚠️ Rate limiting coordination required
- ⚠️ Brain storage growth over time

### Neutral

- 📊 ToolControlPlane adds architectural layer
- 📊 Curated tools require maintenance
- 📊 Approval flow adds latency for WRITE tools

---

## CEO/PM Decisions Required

### 1. Scope Conflict Resolution ⚡ BLOCKING

Sprint 50 was committed to **Context Engineering** (deferred from Sprint 47).

**Options**:
- **A - Swap**: Sprint 50 = Composio Phase 1, Sprint 51 = Context Engineering
- **B - Defer Composio**: Sprint 50 = Context Engineering, Sprint 51 = Composio Phase 1
- **C - Parallel**: Sprint 50 = Both (5d each) — NOT RECOMMENDED

**Required**: PM/CEO must choose and update roadmap.

### 2. Principal Model

- **Single-user**: One principal per EndiorBot instance
- **Multi-tenant**: Multiple principals per instance (future-proof)

**Required**: Document in this ADR before implementation.

### 3. Approval Actor

- **CEO only**: All approvals go to CEO OTT channels
- **Role-based**: Different roles (dev, ops, admin) can approve different tools

**Required**: Document approval policy.

---

## References

- Expert 8 (Security-First SDLC) Review: 5 P0 issues
- Expert 9 (System Architect) Review: Approved with phased approach
- CTO Review: Conditional approval with corrections
- Composio SDK: `/path/to/composio/`
- ADR-001 to ADR-007: EndiorBot architecture decisions
- Sprint 49: Production Hardening (complete)

---

**Status**: DEFERRED (Sprint 121) — See header for rationale and reopen condition.
