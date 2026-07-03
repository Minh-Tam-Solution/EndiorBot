# Requirements Specification

**Project:** EndiorBot
**Version:** 2.0.0
**Date:** 2026-02-28
**SDLC Stage:** 01-PLANNING
**Identity:** Solo Developer Power Tool (LOCKED)

---

## MVP Scope (Tier 1)

> Per Master Plan v2.0, MVP features are scope-locked.

```bash
endiorbot consult "<question>"  # 2 models, primary_with_notes
endiorbot gate status G2        # Read-only checklist
endiorbot switch <project>      # Minimal context
```

---

## Functional Requirements

### FR-001: 2-Model Consultation (MVP)

| ID | Requirement | Priority | Tier |
|----|-------------|----------|------|
| FR-001.1 | Query 2 models: Claude Code (primary) + Kimi (fallback) | P0 | MVP |
| FR-001.2 | Consolidate with primary_with_notes algorithm | P0 | MVP |
| FR-001.3 | Fallback to single model on timeout | P0 | MVP |
| FR-001.4 | Full 4+ model orchestration (5 providers: CC, Kimi proxy, Kimi API, OpenAI, Ollama) | P2 | Tier 3 |

### FR-002: Project Context Switching (MVP)

| ID | Requirement | Priority | Tier |
|----|-------------|----------|------|
| FR-002.1 | Quick switch between projects | P0 | MVP |
| FR-002.2 | Context switch < 2s | P0 | MVP |
| FR-002.3 | Warn about uncommitted changes | P1 | Pro |
| FR-002.4 | Full session resume with Brain | P1 | Pro |

### FR-003: Gate Status Read-Only (MVP)

| ID | Requirement | Priority | Tier |
|----|-------------|----------|------|
| FR-003.1 | Show gate checklist (read-only) | P0 | MVP |
| FR-003.2 | Gate status at a glance | P0 | MVP |
| FR-003.3 | Auto-evaluate gate criteria | P1 | Pro |
| FR-003.4 | Evidence collection | P1 | Pro |
| FR-003.5 | Full SDLC enforcement | P2 | Tier 3 |

### FR-004: ActionControlPlane (MVP Stub)

| ID | Requirement | Priority | Tier |
|----|-------------|----------|------|
| FR-004.1 | Propose → Approve → Execute pattern | P0 | MVP |
| FR-004.2 | Auto-approve READ/WRITE actions | P0 | MVP |
| FR-004.3 | Require CEO approval for DESTRUCTIVE | P0 | MVP |
| FR-004.4 | Block dangerous commands | P0 | MVP |
| FR-004.5 | Full audit logging | P1 | Pro |

### FR-005: Context Budget Governance (MVP)

| ID | Requirement | Priority | Tier |
|----|-------------|----------|------|
| FR-005.1 | Max 2K tokens per turn | P0 | MVP |
| FR-005.2 | Max 3 blocks per turn | P0 | MVP |
| FR-005.3 | Hard reset every 30 turns | P0 | MVP |
| FR-005.4 | Brain L4 injection at session start | P0 | MVP |

### FR-006: Brain Integration (MVP)

| ID | Requirement | Priority | Tier |
|----|-------------|----------|------|
| FR-006.1 | L4 Mental Models injection | P0 | MVP |
| FR-006.2 | L3 Structures on project switch | P1 | Pro |
| FR-006.3 | L2 Patterns on similar errors | P1 | Pro |
| FR-006.4 | Full Brain provenance | P1 | Pro |

### FR-007: CLI Interface (MVP)

| ID | Requirement | Priority | Tier |
|----|-------------|----------|------|
| FR-007.1 | `endiorbot consult "<question>"` | P0 | MVP |
| FR-007.2 | `endiorbot gate status G2` | P0 | MVP |
| FR-007.3 | `endiorbot switch <project>` | P0 | MVP |
| FR-007.4 | Full CLI with all commands | P1 | Pro |

---

## Non-Functional Requirements

### NFR-001: Performance (MVP Targets)

| ID | Requirement | Target | Priority |
|----|-------------|--------|----------|
| NFR-001.1 | Decision time | <30s (not 30-60 min) | P0 |
| NFR-001.2 | Context switch | <2s | P0 |
| NFR-001.3 | CLI startup | <1s | P0 |

### NFR-002: Context Drift Prevention

| ID | Requirement | Target | Priority |
|----|-------------|--------|----------|
| NFR-002.1 | Token budget per turn | 2K max | P0 |
| NFR-002.2 | Blocks per turn | 3 max | P0 |
| NFR-002.3 | Context drift rate | <5% re-explanations | P1 |

### NFR-003: Security

| ID | Requirement | Target | Priority |
|----|-------------|--------|----------|
| NFR-003.1 | API keys in OS keychain | Required | P0 |
| NFR-003.2 | Never log sensitive data | Required | P0 |
| NFR-003.3 | Block dangerous commands | Required | P0 |

---

### FR-010: Team Agent Routing (Sprint 74)

| ID | Requirement | Priority | Tier |
|----|-------------|----------|------|
| FR-010.1 | Route team mentions (@planning, @dev, @qa, etc.) to leader agent | P0 | STANDARD+ |
| FR-010.2 | Inject team context (charter, teammates, delegation rules) into leader's SOUL | P0 | STANDARD+ |
| FR-010.3 | Agent-first namespace resolution: @pm always routes directly, not via team | P0 | ALL |
| FR-010.4 | Tier-dependent team availability (LITE: @fullstack only) | P0 | ALL |
| FR-010.5 | Team charter loading from TEAM-{id}.md templates | P1 | STANDARD+ |
| FR-010.6 | Shell @mention dispatch for interactive team routing | P1 | ALL |
| FR-010.7 | TeamRegistry with load, lookup, resolve operations | P0 | ALL |

**Acceptance Criteria:**
- `@planning "design auth"` → routes to PM with team context (STANDARD+)
- `@pm "task"` → routes to PM directly without team context (all tiers)
- `@planning "task"` on LITE tier → error: team not available
- `@fullstack "task"` on LITE tier → routes to fullstack agent
- Shell `@dev "implement X"` → displays routing result with team info

**Design Doc:** [ADR-017](../02-design/01-ADRs/ADR-017-Team-Agent-System.md)
**Sprint Plan:** [Sprint 74](../04-build/sprints/sprint-74-team-agent-system.md)

---

### FR-011: Gateway Operational Resilience (Sprint 143-144) ✅ COMPLETE

**Trigger:** CEO real-world testing exposed 7 production issues in a single 2-hour Telegram session. Architecture review: [`docs/02-design/14-Technical-Specs/gateway-architecture-review-sprint-143.md`](../02-design/14-Technical-Specs/gateway-architecture-review-sprint-143.md)

| ID | Requirement | Priority | Sprint |
|----|-------------|----------|--------|
| FR-011.1 | Singleton serve enforcement (PID lockfile) — prevent duplicate processes | P0 | 144 ✅ |
| FR-011.2 | Provider health circuit breaker — skip dead providers immediately after 2 failures | P0 | 144 ✅ |
| FR-011.3 | Per-agent session lock — prevent duplicate concurrent calls for same agent | P0 | 143 ✅ |
| FR-011.4 | CC timeout → automatic fallback to Kimi/cloud (not error) | P0 | 143 ✅ |
| FR-011.5 | OTT channel timeout 60s (not 180s) with immediate Kimi fallback | P1 | 144 ✅ |
| FR-011.6 | Telegram message delivery guarantee (retry as plain text on parse failure) | P1 | 143 ✅ |
| FR-011.7 | Kimi model name resolution (non-Kimi model → default kimi-k2.6) | P1 | 143 ✅ |
| FR-011.8 | Deprecate Kimi subprocess spawner, document external proxy pattern | P1 | 144 ✅ |

**Acceptance Criteria:**
- Cannot start 2 serve processes simultaneously (T1) ✅
- After 2 CC timeouts, 3rd @agent call skips CC → responds via Kimi in <30s (T2) ✅
- OTT @agent: total time-to-response ≤ 90s even when CC is down (T3) ✅
- CEO taps @coder 3x → only first processes, rest get "already processing" (FR-011.3 ✅)
- Telegram table-formatted response → plain text fallback, not silent loss (FR-011.6 ✅)

### NFR-004: Gateway Reliability (Sprint 143-144)

| ID | Requirement | Target | Priority |
|----|-------------|--------|----------|
| NFR-004.1 | OTT time-to-first-response | ≤ 90s (60s CC attempt + 30s fallback) | P0 |
| NFR-004.2 | Message delivery rate | 100% (retry plain text on Markdown failure) | P0 |
| NFR-004.3 | Provider failover time | ≤ 5s after circuit opens (skip immediately) | P0 |
| NFR-004.4 | Zero duplicate messages from serve process competition | P0 | ✅ Sprint 144 |

---

## What's NOT in MVP

| Feature | Status | Reason |
|---------|--------|--------|
| Skills gateway | Tier 3 | Complexity |
| Full multi-model (4+) | ✅ SHIPPED (Sprint 140+) | 5 providers active |
| SDLC enforcement | Tier 3 | Checklist first |
| Dynamic overlay | Tier 2 | Session anchor first |
| Desktop shell | ✅ SHIPPED (Sprint 144) | 9 pages, gateway auto-start |
| Junior hub | ✅ SHIPPED (Sprint 144) | Desktop page functional |

---

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | 22+ | Runtime |
| TypeScript | 5.8+ | Language |
| Anthropic SDK | Latest | Claude API (CC-first primary) |
| OpenAI SDK | Latest | Kimi API + OpenAI providers |
| Electron | Latest | Desktop channel |

---

## References

- [Master Plan v2.0](../00-foundation/master-plan.md)
- [Sprint 54 Plan](../04-build/sprints/sprint-54-ai-chat-integration.md)

### FR-012: Kimi Proxy Integration (Sprint 140) ❌ REMOVED (Sprint 145, 2026-05-06)

> **REMOVED 2026-05-06 per CEO directive and [ADR-053](../02-design/01-ADRs/ADR-053-kimi-coding-api-direct.md).**
> `claude-code-proxy` binary deleted from environment. Subprocess orchestrator non-functional. All `kimi-proxy` provider code, tests, and env variables (`KIMI_PROXY_*`, `ENDIORBOT_KIMI_PROXY_*`) scheduled for deletion. Replaced by FR-013 (direct API-key access).

| ID | Requirement | Priority | Tier | Status |
|----|-------------|----------|------|--------|
| FR-012.1 | External `claude-code-proxy` wired as `kimi-proxy` provider | P0 | ALL | ❌ REMOVED |
| FR-012.2 | Dynamic port via `ENDIORBOT_KIMI_PROXY_URL` env | P0 | ALL | ❌ REMOVED |
| FR-012.3 | `kimi-proxy` as fallback for all SDLC agents (CC-first per ADR-052) | P0 | ALL | ❌ REMOVED |
| FR-012.4 | Graceful degrade if proxy unavailable | P0 | ALL | ❌ REMOVED |
| FR-012.5 | Kimi subprocess spawner deprecated with `console.warn` (Sprint 144) | P0 | ALL | ❌ REMOVED |

**Design Doc:** [ADR-051](../02-design/01-ADRs/ADR-051-kimi-proxy-subprocess-orchestrator.md) (SUPERSEDED by ADR-053)

---

### FR-013: Kimi Coding API Direct Integration (Sprint 145) 🆕 PROPOSED

> Replaces FR-011.8 / FR-012 entirely. CEO subscription provides up to 5 API keys (Option A: single key per instance, MVP). Endpoint `https://api.kimi.com/coding/v1` is **Anthropic-compatible** and serves the **`kimi-for-coding`** model only. Moonshot (`https://api.moonshot.ai/v1`) re-roled as backup, endpoint host corrected from `.cn` to `.ai`.

| ID | Requirement | Priority | Tier | Status |
|----|-------------|----------|------|--------|
| FR-013.1 | New `kimi-coding` provider targeting `https://api.kimi.com/coding/v1` (Anthropic-compat) | P0 | ALL | 🆕 |
| FR-013.2a | Authenticate `kimi-coding` via `KIMI_API_KEY` (CEO subscription, single key per instance) | P0 | ALL | 🆕 |
| FR-013.2b | Authenticate `kimi-api` (Moonshot backup) via `MOONSHOT_API_KEY`; `KIMI_API_KEY` no longer shared | P0 | ALL | 🆕 |
| FR-013.3 | `kimi-coding` becomes primary "kimi" backend in fallback chains (ADR-052 amended) | P0 | ALL | 🆕 |
| FR-013.4 | `kimi-api` (Moonshot) re-roled as backup; URL corrected to `https://api.moonshot.ai/v1` | P0 | ALL | 🆕 |
| FR-013.5 | Auto-fallback `kimi-coding` → `kimi-api` on 5xx/auth errors | P0 | ALL | 🆕 |
| FR-013.6 | Graceful skip if both `KIMI_API_KEY` and Moonshot key absent (no errors, chain continues) | P0 | ALL | 🆕 |
| FR-013.7 | HTTP allowlist: `api.kimi.com` + `api.moonshot.ai` (SSRF guard) | P0 | ALL | 🆕 |
| FR-013.8 | Pricing registry: `kimi-coding` flat-rate marker, `kimi-api` pay-per-token | P1 | ALL | 🆕 |
| FR-013.9 | Cleanup: delete `src/providers/kimi-proxy/`, all related tests, env vars, channel-router hooks | P0 | ALL | 🆕 |
| FR-013.10 | SOUL files updated: replace `kimi-proxy` refs with `kimi-coding (primary) → kimi-api (backup)` | P1 | ALL | 🆕 |

**Design Doc:** [ADR-053](../02-design/01-ADRs/ADR-053-kimi-coding-api-direct.md)

---

## Feature PRDs

Feature-scoped PRDs that extend this MVP requirements spec:

- **[openclaw Backport (Sprint 132-133)](./openclaw-backport/PRD.md)** ✅ COMPLETE — M0 `commands.list` RPC, M1 `exec-policy` cluster, S1 Active Memory, S2 SSRF audit all shipped. C2 Webhooks delivered Sprint 134. See also [scope.md](./openclaw-backport/scope.md).

---

*Solo Developer Power Tool | SDLC Framework v6.4.0 - Stage 01: Planning*
*Identity: LOCKED (2026-02-28) | Updated Sprint 144 (2026-04-27)*
