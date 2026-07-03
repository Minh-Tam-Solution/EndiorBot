---
status: PROPOSED
authority:
  proposer: "@architect"
  countersigners:
    - actor: "@pm"
      date: "2026-05-06"
      grade: ""
      reference: "ceo-directive-2026-05-06"
  trigger: "CEO directive 2026-05-06: switch from unstable Kimi OAuth to API-key-based access via CEO subscription (5 keys); claude-code-proxy already removed from environment"
  notes: "Anthropic-compatible schema confirmed. Single key per instance (Option A). Endpoint serves kimi-for-coding model only."
---

# ADR-053: Kimi Coding API Direct Integration & Removal of kimi-proxy

## Status
Proposed (awaiting G2 approval)

## Context

Two architectural pressures converged on 2026-05-06:

1. **CEO discovered API-key access** to Kimi 2.6 via the CEO's coding subscription, with up to 5 API keys provisionable. This eliminates the OAuth instability that motivated ADR-051 (subprocess orchestrator pattern).
2. **`claude-code-proxy` binary has been removed** from the development environment entirely. The subprocess orchestrator built per ADR-051 is therefore non-functional and represents pure dead code/tech debt.

The new endpoint is `https://api.kimi.com/coding/v1`, exposing the **`kimi-for-coding`** model via an **Anthropic-compatible** schema.

The existing `kimi-api` provider (Moonshot at `api.moonshot.cn/v1`) remains operational, but:
- Endpoint host is being **corrected** from `.cn` to `.ai` (`https://api.moonshot.ai/v1`).
- Role demoted from "primary kimi" to "**backup kimi**" because Moonshot is pay-per-use while CEO subscription covers `kimi-coding` flat-rate.

## Decision

### 1. New Provider: `kimi-coding`

Create a new provider in `src/providers/kimi-coding/` that:
- Targets `https://api.kimi.com/coding/v1` (configurable via `KIMI_API_BASE_URL`).
- Authenticates with a single API key from `KIMI_API_KEY` (Option A — single key per instance).
- Speaks **Anthropic-compatible** API → composes `AnthropicProvider` internally (same pattern as the deleted `kimi-proxy`).
- Exposes only the `kimi-for-coding` model (256K context, 16K output).
- Becomes the **primary "kimi" backend** in the fallback chain.

### 2. Re-target & Demote `kimi-api` (Moonshot)

- Update endpoint default from `https://api.moonshot.cn/v1` → `https://api.moonshot.ai/v1` in:
  - `src/providers/kimi-api/index.ts` (3 sites)
  - `docs/02-design/14-Technical-Specs/TS-001-Provider-Architecture.md`
  - `.env.example`
- Documentation re-classifies it as "backup kimi" — used only when `kimi-coding` is unavailable or rate-limited.

### 3. Remove `kimi-proxy` Entirely

Delete:
- `src/providers/kimi-proxy/index.ts`
- `src/providers/kimi-proxy/subprocess-orchestrator.ts`
- `src/providers/kimi-proxy/rate-limit-monitor.ts`
- All associated tests under `tests/providers/kimi-proxy/`
- All env variables prefixed with `KIMI_PROXY_*` and `ENDIORBOT_KIMI_PROXY_*`
- All references in `src/agents/channel-router.ts` (subprocess lifecycle hooks)
- All exports from `src/providers/index.ts` and registrations in `src/providers/init.ts`

### 4. Updated Fallback Chain (Amends ADR-052)

```
Tier 1 (Opus reasoning):
  claude-code → kimi-coding → kimi-api → ollama

Tier 2 (Sonnet workhorse):
  claude-code → kimi-coding → kimi-api → ollama

Tier 3 (Free routing):
  ollama → kimi-coding → kimi-api → claude-code
```

The aggregate "kimi" provider in the tier chain resolves at runtime as:
```
kimi := kimi-coding (if KIMI_API_KEY set) || kimi-api (if MOONSHOT key set) || skip
```

## Consequences

### Positive
- **Zero subprocess management**: no spawn, no port allocation, no health-check loop, no SIGTERM cleanup.
- **No external binary dependency**: removes `claude-code-proxy` from prerequisites.
- **Stable auth**: API key vs. OAuth device flow that frequently expired.
- **Cost predictable**: CEO subscription is flat-rate; Moonshot acts as overflow backup.
- **Net code reduction**: ~−400 LOC after deleting kimi-proxy and adding kimi-coding.
- **Simpler mental model**: 2 Kimi providers in a clear primary/backup relationship.

### Negative
- **Single point of failure** within the Kimi tier: if `kimi-coding` is down AND no `MOONSHOT_API_KEY` is set, the agent skips Kimi entirely and falls back to `claude-code` or `ollama`. Mitigation: documented in `.env.example` recommending users set both keys.
- **Model surface narrows**: `kimi-coding` only exposes `kimi-for-coding`; users wanting a non-coding-tuned Kimi must configure Moonshot. Tier-2 agents (PM, researcher) on `kimi-for-coding` may show slight degradation on non-code tasks — to be measured.
- **Subscription seat limit**: 5 keys total. If >5 EndiorBot instances run concurrently, key reuse is required. Out of scope for this ADR; tracked as future enhancement (key pool service).

## Conditions (CTO G2 Requirements)

| # | Condition | Severity | Verification |
|---|-----------|----------|--------------|
| 0 | **Env var split**: `KIMI_API_KEY` → `kimi-coding` only; Moonshot backup → `MOONSHOT_API_KEY`. Update `src/providers/init.ts`, `.env.example`, FR-013. | **BLOCKING** | Code review + grep |
| 1 | **Anthropic-compat verified**: contract test confirms request/response shape against `kimi-for-coding`. | P0 | Integration test: 1 round-trip call with key |
| 2 | **Graceful degrade**: if `KIMI_API_KEY` missing → provider not registered, no warning spam. Fallback chain continues. | P0 | Unit test: missing-env behavior |
| 3 | **Backup activation**: when `kimi-coding` returns 5xx or auth error → automatic fallback to `kimi-api` (Moonshot). | P0 | Integration test: simulated 503 |
| 4 | **No legacy refs**: grep for `kimi-proxy`, `claude-code-proxy`, `KIMI_PROXY_`, `ENDIORBOT_KIMI_PROXY_` returns zero hits in `src/`. | P0 | CI grep check |
| 5 | **HTTP allowlist**: `src/security/http-validator.ts` allowlists `api.kimi.com` AND `api.moonshot.ai`; removes `ENDIORBOT_KIMI_PROXY_URL` refs. | P0 | Unit test: SSRF guard |
| 6 | **Secret hygiene**: API key never logged, masked in stack traces; gitleaks rule covers `kimi-` prefix. | P0 | Unit test + gitleaks scan |
| 7 | **Pricing registry**: `src/budget/pricing-registry.ts` has entries for `kimi-coding` (flat-rate marker) and `kimi-api/kimi-k2-6` (pay-per-token). | P1 | Unit test: cost calc |

## Post-Rollout KPIs — Non-Coding Agent Quality (@cpo requirement)

Because `kimi-for-coding` is tuned for code generation, Tier-2 agents with non-coding workloads (`@pm`, `@cpo`, `@researcher`) may experience quality degradation. We will measure:

| Metric | Tool | Threshold | Action if breached |
|---|---|---|---|
| **Fallback rate to `claude-code`** | `analytics/metrics-collector.ts` | < 15% | If > 15% for 3 consecutive days → triage; consider reverting non-coding agents to `claude-code` primary. |
| **Latency p95** | `analytics/metrics-collector.ts` | < 8s | If > 8s → investigate rate-limit or network path to `api.kimi.com`. |
| **Output quality score** | Rubric: 1–5 (clarity, completeness, hallucination) sampled via `@reviewer` audit | ≥ 4.0 avg | If < 4.0 on non-coding tasks → escalate to ADR-052 amendment (revert `@pm`/`@researcher` to `claude-code` primary). |

**Measurement window**: 7 days post-deployment (Sprint 145 retrospective).  
**Owner**: @cpo tracks; @architect instruments; @reviewer audits sample.

## Alternatives Considered

### Alternative A: Keep kimi-proxy as opt-in fallback
**Rejected**: `claude-code-proxy` binary has been removed from the environment. The subprocess code cannot run; keeping it represents pure dead code. CEO confirmed the environment cleanup is permanent.

### Alternative B: Use only kimi-coding, remove Moonshot too
**Rejected**: Moonshot provides a useful safety net at near-zero ongoing cost (only billed on use). Keeping it preserves resilience without incurring fixed cost.

### Alternative C: 5-key pool with round-robin
**Deferred**: Single-key Option A is sufficient for solo-developer (current EndiorBot identity). Pool service introduces state and concurrency complexity. Re-evaluate when concurrent-instance count exceeds 3.

## Implementation Notes

### New Module
```
src/providers/kimi-coding/
  index.ts                # KimiCodingProvider (composes AnthropicProvider)
  __fixtures__/           # Contract test fixtures
```

### Changes to Existing Code
| File | Change |
|------|--------|
| `src/providers/init.ts` | Register `kimi-coding` first, then `kimi-api` (backup). Remove `kimi-proxy` registration. |
| `src/providers/index.ts` | Export `KimiCodingProvider`; remove `KimiProxyProvider` and orchestrator exports. |
| `src/providers/kimi-api/index.ts` | Default URL → `https://api.moonshot.ai/v1`. Update JSDoc + comments. |
| `src/agents/router/providers.ts` | `callKimiProvider()` tries `kimi-coding` then `kimi-api`. |
| `src/agents/channel-router.ts` | Remove all SubprocessOrchestrator imports and lifecycle hooks. |
| `src/security/http-validator.ts` | Allowlist `api.kimi.com`, `api.moonshot.ai`. |
| `src/budget/pricing-registry.ts` | Add `kimi-coding` entry (flat-rate); ensure `kimi-api/kimi-k2-6` entry intact. |
| `.env.example` | Add `KIMI_API_KEY` (CEO subscription), `KIMI_API_BASE_URL=https://api.kimi.com/coding/v1`, `MOONSHOT_API_KEY` (optional backup), `MOONSHOT_API_BASE_URL=https://api.moonshot.ai/v1`. Remove all `KIMI_PROXY_*` and `ENDIORBOT_KIMI_PROXY_*`. **Note**: `KIMI_API_KEY` is now reserved for `kimi-coding`; Moonshot uses `MOONSHOT_API_KEY`. |

### Deletions
| Path | Reason |
|------|--------|
| `src/providers/kimi-proxy/` | All 3 files — superseded |
| `tests/providers/kimi-proxy/` | All tests — superseded |
| ENV vars `KIMI_PROXY_*`, `ENDIORBOT_KIMI_PROXY_*` | No longer referenced |

### SOUL File Updates
All `docs/reference/templates/souls/SOUL-*.md` files: replace `kimi-proxy` references with `kimi-coding (primary) → kimi-api (backup)` in `## Model Fallback Policy` sections.

## Supersession & Amendment Chain

- **Supersedes**: ADR-051 (Kimi Proxy Subprocess Orchestrator) — completely.
- **Amends**: ADR-052 (Agent-Model Tier Mapping) — fallback chain entries for "kimi" provider.

## G2 Sign-off Checklist

Per SDLC Framework v6.4.0 — lightweight sign-off for provider-layer architectural change.

| Gate | Reviewer | Decision | Date |
|------|----------|----------|------|
| **G1** (Problem fit) | @pm | ✅ Go — FR-013 replaces FR-012 cleanly | 2026-05-06 |
| **G2** (Tech + Risk) | @cto | ✅ **APPROVED** — Condition 0 satisfied, 13 unit tests pass, 0 regressions (infra flake pre-existing) | 2026-05-07 |
| **G2** (PMF + Governance) | @cpo | ✅ Go — with KPI tracking requirement | 2026-05-07 |
| **G3** (Quality bar) | @cto | ⬜ **OPEN** — entering validation phase | |

**G2 Evidence Delivered**:
- [x] PR showing `KIMI_API_KEY` / `MOONSHOT_API_KEY` split in `src/providers/init.ts` + `.env.example`
- [x] CI grep proving zero `kimi-proxy` / `claude-code-proxy` refs in `src/`
- [x] SSRF unit test proving `api.kimi.com` + `api.moonshot.ai` pass; private IPs/metadata/file blocked
- [x] 13 new/updated unit tests pass (7 kimi-coding + 6 SSRF + 2 budget registry)

**G3 Validation Required** (before closing):
- [ ] **TC-145.3** live contract test: 1 round-trip to `https://api.kimi.com/coding/v1` with real `KIMI_API_KEY`
- [ ] **KPI non-coding agents** (@pm, @researcher, @cpo): fallback rate < 15%, quality ≥ 4.0/5 over 7-day window
- [ ] Full regression suite pass with `kimi-coding` registered in production environment

---

## References

- ADR-051 (now SUPERSEDED): `docs/02-design/01-ADRs/ADR-051-kimi-proxy-subprocess-orchestrator.md`
- ADR-052 (amended): `docs/02-design/01-ADRs/ADR-052-agent-model-tier-mapping.md`
- TS-001 Provider Architecture: `docs/02-design/14-Technical-Specs/TS-001-Provider-Architecture.md`
- Kimi Coding API endpoint: `https://api.kimi.com/coding/v1` (Anthropic-compatible)
- Moonshot backup endpoint: `https://api.moonshot.ai/v1` (OpenAI-compatible)
- CEO directive: 2026-05-06 (post `claude-code-proxy` removal)
