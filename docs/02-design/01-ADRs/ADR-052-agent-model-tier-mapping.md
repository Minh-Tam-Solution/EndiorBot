---
status: ACCEPTED
authority:
  proposer: "@pm"
  countersigners:
    - actor: "@architect"
      date: "2026-04-23"
      grade: ""
      reference: "ceo-directive-2026-04-23"
  trigger: "CEO requires Kimi2.6 as primary for most agents, reserving Claude Opus for critical tasks, and leveraging free AI-Platform for non-coding work"
  notes: "Agent-centric tier mapping selected for maintainability and clear cost accountability per agent."
---

# ADR-052: Agent-Model Tier Mapping Strategy

## Status
ACCEPTED (2026-04-23, CTO G2). Amended 2026-05-06 by ADR-053 (kimi-coding primary / kimi-api backup). Amended 2026-07-03 Sprint 156: 3-tier → 2-tier; Tier 1 = CC Opus (strategic), Tier 2 = Kimi Code primary (executor, CC Sonnet fallback).

## Context

Kimi Code (latest) has demonstrated quality comparable to Claude Sonnet (and near-Opus for coding tasks) at significantly lower cost. CEO's AI-Platform (Ollama) provides free inference for non-critical workloads.

The current architecture assigns **Claude Code Bridge** as the primary provider for **all 14 agents**, with a uniform fallback chain. This is cost-inefficient because:
- `@coder`, `@reviewer`, `@tester` spend most tokens on coding tasks where Kimi Code (latest) is equally capable.
- `@assistant` only routes messages — Ollama is sufficient.
- Only `@architect`, `@cso`, and `@ceo` truly require Opus-level reasoning.

## Decision

We will implement a **two-tier agent-model mapping**:
- **Tier 1** (strategic agents): CC Opus primary, Kimi fallback, AI-Platform last resort.
- **Tier 2** (executor agents): Kimi Code primary, CC Sonnet fallback on rate-limit, AI-Platform last resort.

> **Sprint 156 Amendment (2026-07-03)**: CEO directive — CC Opus for complex tasks, Kimi Code for routine execution, CC Sonnet when Kimi rate-limited. AI-Platform only when both CC and Kimi unavailable. 3-tier collapsed to 2-tier. PM/CPO/CTO promoted to Tier 1 (Opus). Tier 3 (Ollama-primary) eliminated.

### Tier 1 — Claude Opus (Strategic + Critical Reasoning)
Reserved for agents where reasoning depth and strategic quality cannot be compromised.

| Agent | Primary | Rationale |
|-------|---------|-----------|
| `@architect` | Claude Opus | ADR writing, system design, G2 gate |
| `@cso` | Claude Opus | Security review, threat modeling, ASVS L2 |
| `@ceo` | Claude Opus | Strategic decisions, Go/No-Go |
| `@pm` | Claude Opus | PRDs, requirements, G0 gate — high-quality output |
| `@cpo` | Claude Opus | Product-market fit, validation — strategic advisory |
| `@cto` | Claude Opus | Architecture oversight, framework decisions |

### Tier 2 — Kimi Code (Executor Agents)
The default for execution-focused agents. Kimi Code (latest) as primary workhorse; CC Sonnet fallback on rate-limit.

| Agent | Primary | Rationale |
|-------|---------|-----------|
| `@coder` | Kimi Code | Code generation, TDD, implementation |
| `@reviewer` | Kimi Code | Code review, blast-radius analysis |
| `@tester` | Kimi Code | Test plans, E2E, coverage |
| `@fullstack` | Kimi Code | Solo loop, all stages |
| `@pjm` | Kimi Code | Sprint planning, velocity |
| `@researcher` | Kimi Code | Evidence gathering, analysis |
| `@devops` | Kimi Code | Deploy scripts, runbooks |
| `@assistant` | Kimi Code | Routing, delegation tracking |

### Fallback Chain per Tier

> **Amended by [ADR-053](./ADR-053-kimi-coding-api-direct.md) (2026-05-06)**: the abstract `kimi` slot resolves at runtime as `kimi-coding` (primary) → `kimi-api` (backup). Legacy `kimi-proxy` removed.

```
Tier 1 (CC Opus):   claude-code → kimi → ai-platform (last resort)
Tier 2 (Kimi Code): kimi → claude-code (sonnet) → ai-platform (last resort)
```

## Consequences

### Positive
- **Estimated 45–60% cost reduction**: Majority of agents move from Claude subscription to Kimi/Ollama.
- **Clear accountability**: Each agent's cost is tied to its tier — easy to audit.
- **CEO preference preserved**: CEO still uses Claude Code as primary interface.
- **Scalable**: New agents slot into the tier system without architecture changes.

### Negative
- **Provider heterogeneity**: Debugging spans 3 provider backends instead of 1.
- **Ollama quality gap**: Tier-3 agents may produce lower-quality output; fallback to Kimi mitigates this.
- **Kimi rate limits**: Tier-2 agents may hit proxy rate limits; `kimi-api` (API key) is immediate fallback.

## Implementation

| Component | Change |
|-----------|--------|
| `src/agents/router/agent-constants.ts` | `AGENT_PROVIDER_MODEL_MAP` + `TIER_FALLBACK_CHAIN` |
| `src/agents/router/providers.ts` | `dispatchAgentPrimary()` + `dispatchAgentFallback()` + `callKimiProvider()` |
| `src/agents/channel-router.ts` | `callAI()` uses agent-aware dispatch |
| `src/agents/orchestrator/task-classifier.ts` | `recommendModel()` returns provider-aware recommendations |
| `src/budget/pricing-registry.ts` | Kimi + Ollama pricing entries |
| `docs/reference/templates/souls/SOUL-*.md` | Update `## Model Fallback Policy` per tier |
