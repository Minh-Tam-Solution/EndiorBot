---
sprint: 140
status: RETROACTIVE — Work executed without approved plan; plan drafted post-hoc for SDLC compliance
start_date: 2026-04-23
planned_duration: ~1-2d (actual)
framework: "6.4.0"
authority:
  proposer: "@pm"
  countersigners:
    - actor: "@cto"
      date: "2026-04-23"
      grade: "APPROVED with compliance note"
      reference: "CEO directive 2026-04-23 — Kimi2.6 quality validated, cost optimization required"
  trigger: "CEO requests Kimi2.6 as primary for most agents, reserving Claude Opus for critical tasks, leveraging free AI-Platform for non-coding work"
  notes: |
    VIOLATION ACKNOWLEDGED: Implementation of ADR-051 and ADR-052 began before sprint plan
    was drafted and approved. This plan is retroactive to satisfy SDLC G1→G2 gate requirements.
    Root cause: CEO direct execution during planning session without formal gate passage.
    Preventive action: All future CEO-directed work must halt at G1 until plan is countersigned.
previous_sprint: "Sprint 139 — OpenMythos Pattern Adoption"
references:
  - docs/02-design/01-ADRs/ADR-051-kimi-proxy-subprocess-orchestrator.md
  - docs/02-design/01-ADRs/ADR-052-agent-model-tier-mapping.md
  - docs/04-build/sprints/sprint-139-plan.md
---

# Sprint 140 — Kimi2.6 Integration + Agent-Model Tier Mapping (Retroactive)

## Context

Kimi k2.6 has demonstrated quality comparable to Claude Sonnet (and near-Opus for coding tasks) at significantly lower cost. CEO's AI-Platform (Ollama) provides free inference for non-critical workloads.

The work was executed in two tracks:
1. **ADR-051** (previously approved): Kimi Proxy Subprocess Orchestrator — auto-manage `claude-code-proxy` lifecycle.
2. **ADR-052** (new): Agent-Model Tier Mapping — assign each of 14 agents to a primary provider based on workload complexity.

Additionally, the `@consult` multi-model panel was expanded from 2-model (OpenAI + Gemini) to 3-model (OpenAI + Gemini + Kimi).

## Gate Status

| Gate | Requirement | Status | Evidence |
|------|-------------|--------|----------|
| G0.1 | Problem statement + business case | ✅ | CEO cost concern + Kimi quality validation |
| G1 | Requirements complete | ✅ | This document (retroactive) |
| G2 | ADR(s) created + technical spec | ✅ | ADR-051, ADR-052 |
| G3 | Code complete + tests passing | ✅ | 8,048 tests passing, 0 failures, 0 type errors |

**Compliance note:** G1 was not formally approved before execution began. This plan serves as retroactive G1 evidence. @pm takes accountability for the SDLC breach.

---

## P0: Kimi Proxy Subprocess Orchestrator (ADR-051)

**What:** EndiorBot auto-manages `claude-code-proxy` as a subprocess: auto-detect binary, dynamic port, health check, auth pre-check, SIGTERM cleanup.

**Why:** CEO previously ran `start-cc-kimi.sh` manually. Automating this removes a manual step and makes Kimi OAuth available as a seamless fallback.

**Files:**
- `src/providers/kimi-proxy/subprocess-orchestrator.ts` — binary detection, spawn, health, cleanup
- `src/providers/kimi-proxy/index.ts` — `KimiProxyProvider` wrapping proxy as Anthropic-compatible provider
- `src/providers/kimi-api/index.ts` — `KimiApiProvider` for direct Moonshot API (`KIMI_API_KEY`)
- `src/providers/init.ts` — registration order
- `src/agents/router/providers.ts` — fallback chain: `kimi-proxy → kimi-api → openai`
- `src/agents/channel-router.ts` — proxy cleanup on shutdown

**Test coverage:** `tests/architecture/fetch-boundary.test.ts` (SSRF compliance), `tests/providers/` (448 tests)

---

## P0: Agent-Model Tier Mapping (ADR-052)

**What:** Three-tier mapping where each agent has a designated primary provider:
- **Tier 1** (Claude Opus): `@architect`, `@cso`, `@ceo`
- **Tier 2** (Kimi k2.6): `@coder`, `@reviewer`, `@tester`, `@pm`, `@cpo`, `@cto`, `@fullstack`, `@pjm`, `@researcher`, `@devops`
- **Tier 3** (Ollama free): `@assistant`

**Why:** Cost optimization. Kimi coding strength ≈ Sonnet at ~60–80% lower cost. Ollama is free for routing. Only ADR writing, security, and CEO strategy require Opus.

**Files:**
- `src/agents/router/agent-constants.ts` — `AGENT_PROVIDER_MODEL_MAP`, `TIER_FALLBACK_CHAIN`, `getAgentProviderModel()`
- `src/agents/router/providers.ts` — `callKimiProvider()`, `dispatchAgentPrimary()`, `dispatchAgentFallback()`
- `src/agents/channel-router.ts` — `callAI()` uses agent-aware dispatch
- `src/agents/orchestrator/task-classifier.ts` — provider-aware `recommendModel()`
- `src/agents/types.ts` — `ModelRecommendation` adds `provider` field
- `src/budget/pricing-registry.ts` — Kimi + Ollama pricing entries
- `docs/reference/templates/souls/SOUL-*.md` — all 14 SOULs updated

**Test coverage:** New `tests/agents/router/agent-provider-model.test.ts` (12 tests); updated classifier + integration tests

---

## P1: @consult 3-Model Panel Expansion

**What:** Extend `endiorbot consult` from 2-model (OpenAI + Gemini) to 3-model (OpenAI + Gemini + Kimi).

**Why:** CEO requested Kimi as an expert perspective in strategic consultations.

**Files:**
- `src/cli/commands/consult.ts` — `--kimi` flag, model list, help text
- `src/gateway/chat-handler.ts` — `kimiModel`, `kimi` provider routing, consolidation logic
- `src/agents/orchestrator/multi-model-orchestrator.ts` — `ProviderId` includes `"kimi"`, defaults updated
- `docs/reference/templates/COMMANDS.md` — updated description

---

## Sequencing (Actual)

1. **ADR-051** — Kimi proxy + API providers (foundation)
2. **@consult expansion** — 3-model panel (independent, user-facing)
3. **ADR-052** — Agent-Model Tier Mapping (depends on ADR-051 providers)

---

## Test Plan

| Component | Tests | Status |
|-----------|-------|--------|
| Agent provider model map | `tests/agents/router/agent-provider-model.test.ts` (12 tests) | ✅ PASS |
| Task classifier | `tests/agents/routing/task-classifier.test.ts` (32 tests) | ✅ PASS |
| All agent routing | `tests/agents/` (1,018 tests) | ✅ PASS |
| All providers | `tests/providers/` (448 tests) | ✅ PASS |
| Integration (SASE alignment) | `tests/integration/sprint-100-sase-alignment.test.ts` (29 tests) | ✅ PASS |
| Integration (tier routing) | `tests/integration/sprint-101-tier-routing-clawvault.test.ts` (33 tests) | ✅ PASS |
| Full regression | All 359 test suites | ✅ 8,048 PASS, 10 skipped |
| Type check | `npx tsc --noEmit` | ✅ 0 errors |

### Evidence (Command Output)

```bash
$ npx vitest run --reporter=dot
Test Files  359 passed (359)
Tests  8048 passed | 10 skipped (8058)
Duration  48.16s

$ npx tsc --noEmit
# (no output = 0 errors)
```

---

## Success Criteria

- **SC-1:** All 14 agents have a defined primary provider in `AGENT_PROVIDER_MODEL_MAP` (verified by test)
- **SC-2:** Tier fallback chains cover all 3 tiers without gaps (verified by test)
- **SC-3:** `dispatchAgentPrimary()` routes `@coder` → Kimi, `@architect` → Claude (verified by code review)
- **SC-4:** `endiorbot consult --kimi kimi-k2-6` works (CLI smoke test)
- **SC-5:** Full test suite passes with no regressions
- **SC-6:** Estimated cost reduction 45–60% (to be validated in Sprint 141 telemetry)

---

## Carry-Forward to Sprint 141

| Item | Reason |
|------|--------|
| Cost telemetry validation | Measure actual savings vs. estimate after 1 week of usage |
| Ollama quality confidence | Monitor `@assistant` output quality; auto-escalate threshold tuning |
| Kimi proxy rate-limit mitigation | If proxy rate-limits affect Tier-2 agents, promote `kimi-api` to co-primary |
| @consult full Kimi integration | `ChatHandler` currently resolves `"kimi"` → `kimi-api`/`kimi-proxy`; may need direct provider wiring |

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | Sprint 140 Retroactive Plan — 2026-04-23*
