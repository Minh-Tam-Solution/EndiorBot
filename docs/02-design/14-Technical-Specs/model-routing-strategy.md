# Model Routing Strategy for 12 Agents & 4 Teams

**Version**: 1.0.0
**Date**: 2026-02-26
**Status**: DRAFT - Sprint 44
**Authority**: ENTERPRISE Config + Sprint 44 Gateway Integration

---

## Overview

EndiorBot supports **12 agent roles** organized into **4 teams**, with intelligent model routing based on:
1. **Task complexity** (simple → Haiku, complex → Opus)
2. **Task type** (code → Claude, reasoning → GPT, research → Gemini)
3. **Cost optimization** (prefer Ollama for routine tasks)
4. **Agent role** (CEO/CTO → premium models, routine → local)

---

## 12 Agent Roles (ENTERPRISE Tier)

### Team 1: Planning (4 agents)
| Agent ID | Role | Description | Primary Model | Fallback |
|----------|------|-------------|---------------|----------|
| `researcher` | SE4A-00 | Discovery and user research | Claude Sonnet | Kimi API |
| `pm` | SE4A-00-01 | Requirements and user stories | Claude Sonnet | Kimi API |
| `pjm` | SE4A Sprint | Sprint coordination and task tracking | Claude Haiku | Kimi API |
| `architect` | SE4A-02 | System design and ADRs | Claude Opus | Kimi API |

**Routing Logic**:
```typescript
if (task.type === 'architecture') {
  return 'claude-opus-4';  // Deep reasoning
} else if (task.type === 'sprint-tracking') {
  return 'qwen3-coder:30b';  // Local, fast, cost-effective
} else {
  return 'claude-sonnet-4.5';  // Balanced
}
```

### Team 2: Dev (2 agents)
| Agent ID | Role | Description | Primary Model | Fallback |
|----------|------|-------------|---------------|----------|
| `coder` | SE4A-04 | Implementation and TDD | Claude Sonnet | Ollama |
| `reviewer` | SE4A-04-05 | Code review and standards | Claude Opus | GPT-4o |

**Routing Logic**:
```typescript
if (task.type === 'code-generation') {
  return 'claude-sonnet-4.5';  // Best code quality
} else if (task.type === 'code-review') {
  return 'claude-opus-4';  // Deep analysis
} else if (task.type === 'simple-fix') {
  return 'qwen3-coder:30b';  // Fast, local
}
```

### Team 3: QA (2 agents)
| Agent ID | Role | Description | Primary Model | Fallback |
|----------|------|-------------|---------------|----------|
| `tester` | SE4A-05 | Testing and quality assurance | Claude Sonnet | Ollama |
| `reviewer` | SE4A-04-05 | Code review and standards | Claude Opus | GPT-4o |

**Routing Logic**:
```typescript
if (task.type === 'test-generation') {
  return 'claude-sonnet-4.5';  // Comprehensive tests
} else if (task.type === 'test-review') {
  return 'claude-opus-4';  // Edge case detection
}
```

### Team 4: Executive (3 agents)
| Agent ID | Role | Description | Primary Model | Fallback |
|----------|------|-------------|---------------|----------|
| `ceo` | SE4H | Strategic advisor, approves G0.1 and G4 | Claude Opus | GPT-4o |
| `cpo` | SE4H | Product advisor, approves G0.1 and G1 | Claude Opus | GPT-4o |
| `cto` | SE4H | Technical advisor, approves G2 and G3 | Claude Opus | GPT-4o |

**Routing Logic**:
```typescript
if (role === 'ceo' || role === 'cpo' || role === 'cto') {
  return 'claude-opus-4';  // Premium for executive decisions
}
```

### Operations Agent (1)
| Agent ID | Role | Description | Primary Model | Fallback |
|----------|------|-------------|---------------|----------|
| `devops` | SE4A-06-07 | Deployment and operations | Claude Haiku | Ollama |

**Routing Logic**:
```typescript
if (task.type === 'deployment') {
  return 'claude-haiku-4.5';  // Fast, precise
}
```

---

## Available Models

### Anthropic (Claude)
| Model | ID | Context | Use Case |
|-------|------|---------|----------|
| Claude Opus 4 | `claude-opus-4` | 200K | Executive decisions, architecture |
| Claude Sonnet 4.5 | `claude-sonnet-4.5` | 200K | Code generation, analysis |
| Claude Haiku 4.5 | `claude-haiku-4.5` | 200K | Fast tasks, routine work |

### OpenAI (GPT)
| Model | ID | Context | Use Case |
|-------|------|---------|----------|
| GPT-4o | `gpt-4o` | 128K | Creative tasks, reasoning |
| GPT-4o-mini | `gpt-4o-mini` | 128K | Fast, cost-effective |

### Kimi (Moonshot)
| Model | ID | Context | Use Case |
|-------|------|---------|----------|
| Kimi K2.6 | `kimi-k2-6` | 256K | Research, coding, reasoning |

### Google (Gemini)
**Removed from fallback chain per CEO directive 2026-04-23.**

### Local (Ollama)
| Model | ID | Context | Use Case |
|-------|------|---------|----------|
| Qwen 3 Coder | `qwen3-coder:30b` | 32K | Code, local, free |

---

## Routing Decision Tree

```
┌─────────────────────────────────────────────────────────────────┐
│                    Task Incoming                                │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
                    ┌───────────────┐
                    │ Classify Task │
                    │ Type & Role   │
                    └───────┬───────┘
                            ▼
            ┌───────────────┴───────────────┐
            ▼                               ▼
    ┌───────────────┐               ┌───────────────┐
    │ Executive?    │               │ Other Role    │
    │ (CEO/CPO/CTO) │               │               │
    └───────┬───────┘               └───────┬───────┘
            │ YES                           │
            ▼                               ▼
    ┌───────────────┐       ┌───────────────────────────────┐
    │ Claude Opus 4 │       │ Task Type Classification      │
    │ (Premium)     │       │                               │
    └───────────────┘       └───────┬───────────────────────┘
                                    ▼
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │ Research?     │               │ Architecture? │
            │               │               │               │
            └───────┬───────┘               └───────┬───────┘
                    │ YES                           │ YES
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │ Gemini 2 Pro  │               │ Claude Opus 4 │
            │               │               │               │
            └───────────────┘               └───────────────┘
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │ Code Gen?     │               │ Simple Task?  │
            │               │               │               │
            └───────┬───────┘               └───────┬───────┘
                    │ YES                           │ YES
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │ Claude Sonnet │               │ Ollama Local  │
            │               │               │ (Free)        │
            └───────────────┘               └───────────────┘
```

---

## Cost Optimization Rules

### Priority 1: Use Ollama (Free, Local)
**When**:
- Simple code fixes
- Routine tasks
- Non-critical decisions
- Sprint tracking (pjm agent)

### Priority 2: Use Haiku (Fast, Cheap)
**When**:
- Quick responses needed
- Deployment tasks
- Simple queries

### Priority 3: Use Sonnet (Balanced)
**When**:
- Code generation
- Code review
- Test generation
- Requirements analysis

### Priority 4: Use Opus (Premium, Expensive)
**When**:
- Executive decisions (CEO, CPO, CTO)
- Architecture design
- Deep code analysis
- Security reviews

---

## Multi-Model Consultation (Expert Panel)

For critical decisions, consult **multiple models in parallel**:

### When to Consult Multiple Models
1. **Architecture decisions** → Claude Opus + GPT-4o + Gemini 2
2. **Security reviews** → Claude Opus + GPT-4o
3. **Gate approvals (G2, G3)** → Claude Opus + GPT-4o
4. **Breaking changes** → Claude Opus + GPT-4o

### Example Expert Panel
```typescript
const expertPanel = {
  primary: 'claude-opus-4',
  experts: ['gpt-4o', 'kimi-k2-6'],
  taskType: 'architecture',
  query: 'Design payment gateway integration for Bflow AR module',
};

const result = await multiModelConsult(expertPanel);
// result.consensus: Common recommendations
// result.disagreements: Differing opinions
// result.recommendation: Consolidated advice
```

---

## Configuration

```typescript
// src/config/model-routing.ts
export const MODEL_ROUTING: Record<AgentRole, ModelRoutingConfig> = {
  // Executive Team (Premium)
  ceo: {
    primary: 'claude-opus-4',
    fallback: 'gpt-4o',
    consultation: true,  // Always consult multiple models
  },
  cpo: {
    primary: 'claude-opus-4',
    fallback: 'gpt-4o',
    consultation: true,
  },
  cto: {
    primary: 'claude-opus-4',
    fallback: 'gpt-4o',
    consultation: true,
  },

  // Planning Team (Balanced)
  researcher: {
    primary: 'claude-sonnet-4.5',
    fallback: 'kimi-k2-6',
    consultation: false,
  },
  pm: {
    primary: 'claude-sonnet-4.5',
    fallback: 'gpt-4o',
    consultation: false,
  },
  pjm: {
    primary: 'qwen3-coder:30b',  // Local for sprint tracking
    fallback: 'claude-haiku-4.5',
    consultation: false,
  },
  architect: {
    primary: 'claude-opus-4',
    fallback: 'gpt-4o',
    consultation: true,  // Architecture needs expert panel
  },

  // Dev Team (Code-focused)
  coder: {
    primary: 'claude-sonnet-4.5',
    fallback: 'qwen3-coder:30b',
    consultation: false,
  },
  reviewer: {
    primary: 'claude-opus-4',
    fallback: 'gpt-4o',
    consultation: false,
  },

  // QA Team (Quality-focused)
  tester: {
    primary: 'claude-sonnet-4.5',
    fallback: 'qwen3-coder:30b',
    consultation: false,
  },

  // Operations
  devops: {
    primary: 'claude-haiku-4.5',
    fallback: 'qwen3-coder:30b',
    consultation: false,
  },
};
```

---

## Implementation Plan

### Sprint 44 (Current) - Gateway + Multi-Provider
- [x] Setup Anthropic provider (Claude)
- [x] Setup OpenAI provider (GPT)
- [x] Setup Ollama provider (local)
- [x] Add Kimi API provider (Moonshot)
- [x] Add Kimi OAuth proxy provider
- [ ] Implement model routing logic
- [ ] Test multi-model consultation

### Sprint 45 - Model Routing Strategy
- [ ] Implement routing decision tree
- [ ] Add cost tracking per model
- [ ] Add confidence scoring
- [ ] Add HITL escalation for low confidence

### Sprint 46 - Multi-Model Consultation
- [ ] Implement expert panel parallel queries
- [ ] Implement response consolidation
- [ ] Add consensus detection
- [ ] Add disagreement highlighting

---

## Metrics & Monitoring

### Track
1. **Model usage by role**
2. **Cost per agent**
3. **Response quality by model**
4. **Fallback frequency**
5. **Multi-model consultation rate**

### Alerts
1. **High cost** (>$50/day)
2. **Fallback spike** (>20% fallback usage)
3. **Low quality** (user rejections >10%)

---

## TODO

- [x] Add Moonshot Kimi API key
- [ ] Add GitHub PAT (for GitHub Copilot integration)
- [ ] Implement routing logic in Gateway
- [ ] Add model selection UI in Desktop
- [ ] Test end-to-end with all models

---

*Model Routing Strategy for EndiorBot ENTERPRISE tier*
*SDLC Framework v6.4.0 compliant*
