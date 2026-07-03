# ADR-001: 3-Model Consultation (MVP)

| Metadata | Value |
|----------|-------|
| **Status** | Approved |
| **Date** | 2026-02-28 |
| **Authors** | PM, Architect |
| **Reviewers** | CTO, 4-Expert Panel |
| **Sprint** | 54 |
| **Identity** | Solo Developer Power Tool (LOCKED) |

---

## Context

### Problem Statement

CEO spends 30-60 min per decision copying/pasting between AI apps. EndiorBot reduces this to <30s with automated 3-model consultation.

### CEO Workflow Reality

| Task | Provider | Model (Configurable) |
|------|----------|----------------------|
| Coding & Documentation | Claude Code | Claude (Primary) |
| Research & Critique | OpenAI | o3, o3-mini, o1, gpt-4o (CEO's choice) |
| Research & Critique | Google | gemini-2.5-pro, gemini-2.0-flash-thinking (CEO's choice) |

**Note**: CEO can always select the **latest model** from each provider - same experience as chatgpt.com and gemini.google.com.

---

## Decision

### MVP Architecture (3 Models)

```
┌─────────────────────────────────────────────────────────────────┐
│                   3-Model Consultation (MVP)                     │
│                                                                 │
│   CEO: endiorbot consult "design payment gateway"               │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   Chat Handler                           │   │
│   │   1. Detect task type (coding vs research)              │   │
│   │   2. Inject Brain L4 context (max 2K tokens)            │   │
│   │   3. Route to appropriate models                         │   │
│   │   4. Consolidate with primary_with_notes                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   AI Router (3 Models)                   │   │
│   │                                                          │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│   │   │   Claude    │  │   OpenAI    │  │   Gemini    │     │   │
│   │   │  (Primary)  │  │  (Critique) │  │  (Critique) │     │   │
│   │   │             │  │             │  │             │     │   │
│   │   │  Coding &   │  │  Research   │  │  Research   │     │   │
│   │   │   Docs      │  │  & Debate   │  │  & Debate   │     │   │
│   │   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │   │
│   │          │                │                │             │   │
│   │          └────────────────┼────────────────┘             │   │
│   │                           ▼                              │   │
│   │           primary_with_notes consolidation               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Provider Roles (2 Loops)

**Development Loop** (execution — Claude Code Bridge, OAuth, NO API key):

| Provider | Access | Role | Use Case |
|----------|--------|------|----------|
| **Claude** | Claude Code Bridge (OAuth) | Executor | Coding, documentation, SDLC gates |

**Consultation Loop** (expert panel — API keys required):

| Provider | Default Model | Role | Use Case |
|----------|---------------|------|----------|
| **OpenAI** | gpt-4o (configurable) | Expert / Primary | Deep reasoning, design critique, SE4H advisory |
| **Google** | gemini-2.0-flash-thinking (configurable) | Expert / Critic | Reasoning, latest trends, research |

**Provider Priority Chain** (CEO directive — check key availability before calling):

```
1. Claude Code Bridge (OAuth subscription) — development, always available
2. OpenAI API (OPENAI_API_KEY in .env) — consultation primary expert
3. Gemini API (GOOGLE_API_KEY in .env) — consultation critic / research
4. Anthropic API (ANTHROPIC_API_KEY in .env) — optional backup, future use
5. AI-Platform (ENDIORBOT_AI_PLATFORM_URL in .env) — last fallback (company internal)
```

**Key principles:**
- Claude Code uses OAuth (subscription) — NO API key needed
- `consult` uses OpenAI + Gemini (API keys) for expert opinions
- Anthropic API key is optional backup, not primary
- AI-Platform is last fallback (company internal, always available)
- All fallback endpoints configurable via `.env` — community users set their own
- System MUST check key existence before attempting provider call

**Model Selection**: CEO can select latest models via config or CLI flag:
```bash
# Use specific models
endiorbot consult --openai-model o3 --gemini-model gemini-2.5-pro "design question"

# Or configure defaults in ~/.endiorbot/config.json
{
  "models": {
    "openai": "o3-mini",      // or "o3", "o1", "gpt-4o"
    "gemini": "gemini-2.0-flash-thinking"  // or "gemini-2.5-pro", "gemini-1.5-pro"
  }
}
```

**Why reasoning models for critique:**
- **o3-mini/o3/o1**: OpenAI's reasoning models - excel at multi-step analysis, finding edge cases, and challenging assumptions
- **gemini-2.0-flash-thinking/gemini-2.5-pro**: Google's reasoning models - combine speed with deep thinking for architecture critique

### Task Routing (`consult` command — uses API providers only)

| Task Type | Primary | Critics | Rationale |
|-----------|---------|---------|-----------|
| **Architecture** | OpenAI | Gemini | Need diverse perspectives for design |
| **Research** | Gemini | OpenAI | Gemini has latest data |
| **Security Review** | OpenAI | Gemini | Cross-validation critical |
| **General consultation** | OpenAI | Gemini | Default expert panel |

**Note:** Coding, documentation, SDLC gates are handled by Claude Code Bridge (development loop), NOT by the `consult` command.

### Core Interfaces (MVP)

```typescript
// Consultation Config (2-Model Expert Panel)
interface ConsultationConfig {
  primary: {
    provider: 'openai';
    model: string;  // CEO selects: gpt-4o, o3, o3-mini, o1
    role: 'expert_primary';
  };
  critics: [
    {
      provider: 'google';
      model: string;  // CEO selects: gemini-2.0-flash-thinking, gemini-2.5-pro
      role: 'expert_critic';
    }
  ];

  // Merging
  mergingAlgorithm: 'primary_with_notes';

  // Timeouts
  perModelTimeout: 30000;  // 30s
  totalTimeout: 60000;     // 60s
}

// Available models (updated as providers release new versions)
const AVAILABLE_MODELS = {
  openai: ['o3', 'o3-mini', 'o1', 'o1-mini', 'gpt-4o', 'gpt-4o-mini'],
  gemini: ['gemini-2.0-flash-thinking', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  anthropic: ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-4'],
};

// Task Type Detection
type TaskType =
  | 'coding'         // → Claude only
  | 'documentation'  // → Claude only
  | 'architecture'   // → Claude + critics
  | 'research'       // → All 3
  | 'security'       // → Claude + OpenAI
  | 'sdlc_gate';     // → Claude only

// Consolidated Response
interface ConsolidatedResponse {
  primary: string;           // Claude response
  critiques?: {
    openai?: string;         // OpenAI critique
    gemini?: string;         // Gemini critique
  };
  agreement: 'full' | 'partial' | 'divergent';
  recommendation: string;
}
```

### Routing Algorithm

```typescript
function routeTask(query: string): ModelSelection {
  const taskType = classifyTask(query);

  switch (taskType) {
    case 'coding':
    case 'documentation':
    case 'sdlc_gate':
      // Claude only (fast path)
      return { primary: 'claude', critics: [] };

    case 'architecture':
    case 'research':
      // All 3 models (full consultation)
      return {
        primary: 'claude',
        critics: ['openai', 'gemini']
      };

    case 'security':
      // Claude + OpenAI (security critical)
      return {
        primary: 'claude',
        critics: ['openai']
      };

    default:
      return { primary: 'claude', critics: [] };
  }
}

function classifyTask(query: string): TaskType {
  const patterns = {
    coding: /\b(implement|code|fix|bug|function|class)\b/i,
    documentation: /\b(document|write|readme|comment)\b/i,
    architecture: /\b(design|architect|pattern|scale)\b/i,
    research: /\b(research|compare|evaluate|trend)\b/i,
    security: /\b(security|auth|vulnerability|encrypt)\b/i,
    sdlc_gate: /\b(gate|g[0-4]|sdlc|checklist)\b/i,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(query)) return type as TaskType;
  }

  return 'coding';  // Default to Claude only
}
```

### Merging Algorithm: primary_with_notes

```typescript
function consolidate(
  claudeResponse: string,
  critiques: { openai?: string; gemini?: string }
): ConsolidatedResponse {
  // If no critiques, return Claude only
  if (!critiques.openai && !critiques.gemini) {
    return {
      primary: claudeResponse,
      agreement: 'full',
      recommendation: claudeResponse,
    };
  }

  // Calculate agreement level
  const allResponses = [claudeResponse, critiques.openai, critiques.gemini]
    .filter(Boolean);
  const similarity = calculateConsensus(allResponses);

  if (similarity > 0.85) {
    return {
      primary: claudeResponse,
      agreement: 'full',
      recommendation: claudeResponse,
    };
  } else if (similarity > 0.6) {
    const notes = extractDifferentPoints(critiques, claudeResponse);
    return {
      primary: claudeResponse,
      critiques,
      agreement: 'partial',
      recommendation: `${claudeResponse}\n\n📝 Alternative views:\n${notes}`,
    };
  } else {
    return {
      primary: claudeResponse,
      critiques,
      agreement: 'divergent',
      recommendation: formatDivergentViews(claudeResponse, critiques),
    };
  }
}
```

### CLI Interface (MVP)

```bash
# Full consultation (architecture/research)
$ endiorbot consult "design payment gateway integration"
# → Claude + OpenAI + Gemini
# → Returns consolidated response with critiques

# Coding task (Claude only, fast)
$ endiorbot consult "implement PaymentAdapter class"
# → Claude only
# → Fast response

# Explicit single model
$ endiorbot consult --model claude "quick fix"
# → Uses Claude only

# Force full consultation
$ endiorbot consult --full "should we use Redis or PostgreSQL?"
# → All 3 models regardless of task type

# Select specific models (same as chatgpt.com/gemini.com)
$ endiorbot consult --openai o3 --gemini gemini-2.5-pro "complex design"
# → Uses CEO-selected latest models

# List available models
$ endiorbot models list
# OpenAI: o3, o3-mini, o1, o1-mini, gpt-4o, gpt-4o-mini
# Gemini: gemini-2.5-pro, gemini-2.0-flash-thinking, gemini-1.5-pro
# Claude: claude-opus-4, claude-sonnet-4, claude-haiku-4
```

### Fallback Scenarios (MVP)

| Scenario | Response |
|----------|----------|
| Claude timeout | Error (primary required) |
| OpenAI timeout | Use Claude + Gemini |
| Gemini timeout | Use Claude + OpenAI |
| Both critics timeout | Use Claude only, note in response |
| All timeout | Error with retry suggestion |

---

## Alternatives Considered

### 1. 2-Model Only (Gemini + Opus)
- **Pros**: Simpler
- **Cons**: Doesn't match CEO's actual workflow
- **Decision**: Rejected - CEO uses Claude Code as primary

### 2. 4+ Models
- **Pros**: More diverse
- **Cons**: Higher cost, diminishing returns
- **Decision**: Deferred to Tier 3

---

## Consequences

### Positive
- 98% reduction in decision time
- Matches CEO's actual workflow
- Claude remains primary for coding/docs
- OpenAI + Gemini provide research/critique

### Negative
- ~2-3x API cost for full consultation
- More complex routing logic

### Risks
| Risk | Mitigation |
|------|------------|
| API cost | Coding tasks use Claude only |
| Latency | Parallel queries, 30s timeout |
| Disagreement | primary_with_notes shows all |

---

## Implementation Plan

### Sprint 54 Tasks

| Task | Hours | Status |
|------|-------|--------|
| ChatHandler (3-model) | 2h | PENDING |
| AIRouter (Claude + OpenAI + Gemini) | 2h | PENDING |
| Task type classifier | 1h | PENDING |
| primary_with_notes consolidation | 1h | PENDING |
| CLI `consult` command | 1h | PENDING |

---

## References

- [Master Plan v2.0](../../00-foundation/master-plan.md)
- [Sprint 54 Plan](../../04-build/sprints/sprint-54-ai-chat-integration.md)

---

*ADR-001 | Solo Developer Power Tool MVP | 3-Model Consultation*
*Claude (Coding) + OpenAI + Gemini (Research/Critique)*
*Identity: LOCKED (2026-02-28)*
*SDLC Framework v6.4.0*
