# 03-integrate — Integration

**SDLC stage:** 03-INTEGRATE (CONNECT)  
**Project:** EndiorBot  
**Identity:** Solo Developer Power Tool (LOCKED)

## Purpose

**Key question:** **HOW** do parts connect — contracts, channels, external systems — so **design (02)** and **build (04)** stay aligned?

Stage 03 is the **CTO bridge**: integration specs and runtime paths must match ADRs and remain testable in **05-test**. See the full stage ↔ command model in [`../00-foundation/stage-command-workflow-spine.md`](../00-foundation/stage-command-workflow-spine.md).

---

## Alignment

- **Upstream:** [`../02-design/`](../02-design/) (ADRs, APIs), [`../01-planning/`](../01-planning/) (scope for external touchpoints)  
- **Downstream:** [`../04-build/`](../04-build/) (implements contracts), [`../05-test/`](../05-test/) (contract & channel verification)  
- **Gates:** **G2** (contracts aligned with design); **G3** smoke across channels where applicable  
- **Spine:** [`../00-foundation/stage-command-workflow-spine.md`](../00-foundation/stage-command-workflow-spine.md)  
- **Stage index:** [`../README.md`](../README.md)

---

## Overview

This stage documents integration patterns between EndiorBot components and external systems (APIs, OTT channels, gateway, CLI parity).

### EndiorBot command hints (this stage)

| Type | Examples |
|------|----------|
| **Atomic** | `endiorbot serve` (unified ingress); `config`, `status`; OTT commands that hit the same handlers as CLI (thin client). |
| **Workflow** | Onboarding a repo end-to-end: `bootstrap` → `plan` → `sprint close` with integration checks per tier. |

Full catalog: [`../reference/templates/COMMANDS.md`](../reference/templates/COMMANDS.md).

### Gates

- **G2** outputs (contracts, security boundaries) feed integration docs here.  
- **G3** evidence often includes cross-channel or API smoke paths defined in this stage.

## Contents

- `sprint-139-integration-spec.md` — Sprint 139 integration specification (active)

> **Archived:** `autonomy-epic/` and `sprint-50-validation-plan.md` moved to [`../10-Archive/`](../10-Archive/) (Sprint 144 docs cleanup).

## MVP Integrations (Tier 1)

| Integration | Priority | Status |
|-------------|----------|--------|
| Kimi API (Moonshot) | P0 | Implemented |
| Kimi OAuth Proxy (claude-code-proxy) | P1 | Implemented |
| Anthropic API (Claude Opus) | P0 | Implemented |
| OpenAI API (Codex / GPT) | P0 | Implemented |
| CLI → Gateway | P0 | Implemented |
| Web Channel | P1 | Implemented |
| Telegram (bidirectional) | P0 | Implemented |
| Zalo OA (bidirectional) | P1 | Implemented |

**Note:** Gemini API removed from active fallback chain per CEO directive 2026-04-23. Provider module retained for backward compatibility.

## Channel Integration

```
Browser  → WebSocket → Gateway → ChatHandler → AI Router → Response
Telegram → OTT Adapter → Gateway → Ingress → AI Router → Response
Zalo     → OTT Adapter → Gateway → Ingress → AI Router → Response
CLI      → Commander → ChatHandler → AI Router → Response
```

## Documentation index

All stages (00–09): [`../README.md`](../README.md).

## Integration Points (Sprint 142-143)

### Provider Enrichment Pipeline

```
buildEnrichedPrompt() → 5 provider functions (pure transport)
    ├── callClaudeBridge (CC CLI + tmux)
    ├── callKimiProvider (kimi-proxy/kimi-api)
    ├── callCloudFallback (OpenAI)
    ├── callRemoteOllama (AI-Platform)
    └── [future provider] — register + done
```

### CC-First Routing (Sprint 143 — ADR-052 Amendment)

All Tier 2 agents now route through Claude Code bridge as primary provider:

```
@pm "check sprint readiness"
    → dispatchAgentPrimary("pm", task)
    → buildEnrichedPrompt()        ← workspace + SOUL + RL (universal)
    → callClaudeBridge(sonnet)     ← CC primary (native file access)
    → on 429 → callKimiProvider()  ← Kimi fallback (enriched prompt reused)
    → on 429 → callRemoteOllama()  ← Ollama last resort
```

**Kill switch:** `ENDIORBOT_DISABLE_WORKSPACE_CONTEXT=true` disables ALL workspace signals including `[Workspace: path]` prefix in prompts.

### Kimi Proxy Integration (Sprint 140-143)

- `ENDIORBOT_KIMI_PROXY_URL` → reuse external `claude-code-proxy` (singleton guard prevents dual-instance)
- SSRF allowlist extended for configured local providers (`getConfiguredLocalProviderOrigins()`)
- Rate-limit monitoring: 429 auto-fallback kimi-proxy → kimi-api → cloud fallback chain

### Brain L2 → Recovery Engine (Sprint 143)

```
error occurs → FailureClassifier.classify()
    → RecoveryEngine.findMatchingPattern(signature)  ← Brain L2 query (count ≥ 2)
    → patternHint stored in AutonomousSessionManager.pendingPatternHint
    → injected into executeTaskWork() task context
    → consumed + nulled after injection (no stale hints)
```

### Gate Mark Integration (Sprint 143 A3)

```
CLI:      endiorbot gate mark G1 g1-stakeholder-signoff --pass --evidence "..."
Telegram: /gate mark G1 g1-stakeholder-signoff --pass    ← same CommandDispatcher
    → saveGateItemMark() → ~/.endiorbot/evidence/<projectId>/gate-marks.json
    → evaluateChecklist() reads marks for autoCheck:false items
    → gate confirm G1 --confirm → PASS (no --force needed)
```

5-channel parity: CLI, Web, Telegram, Zalo, Desktop all route through unified `CommandDispatcher`.

### E2E Channel Test Results (Sprint 144)

| Channel | Tests | Pass | Notes |
|---------|-------|------|-------|
| CLI | 10 | 10/10 | All commands, agent routing, gate flow |
| Web | 8 | 8/8 | WebSocket gateway, chat stream, budget |
| Telegram | 10 | 10/10 | /start, @agent, /gate, /config, /audit |
| Zalo | — | PASS | Manual smoke; no active OA token for automated suite |
| Desktop | 7 | 7/7 | Dashboard, Chat, Projects, Gates, Experts, Settings, Junior Hub |

Automated: 8,142/8,152 tests pass (10 skipped by design).

### Gateway Resilience Integration (Sprint 143-144)

Sprint 143 CEO testing revealed integration-layer gaps. Fixes shipped + Sprint 144 planned:

```
Request flow (post-Sprint 144):

@agent message on Telegram
    → OTT Adapter → Bus (originChannel tagged) → Consumer → Ingress
    → [SESSION LOCK CHECK]       ← Sprint 143: reject if agent already processing
    → ⚡ immediate ack sent       ← Sprint 144: OTT channels send "@agent acknowledged" before AI call
    → Channel Router.callAI()
        → [CIRCUIT BREAKER CHECK]  ← Sprint 144: skip CC if circuit OPEN (2 failures)
        → Provider dispatch (CC → Kimi → cloud)
            → CC Bridge (60s OTT / 180s CLI)  ← Sprint 144: channel-aware via originChannel
            → on TIMEOUT or OPEN circuit → Kimi fallback (stream:false, model resolved)
            → on Kimi fail → cloud fallback (OpenAI last resort)
        → Response
    → [SESSION LOCK RELEASE]
    → Telegram send (Markdown → plain-text retry on 400)  ← Sprint 143 R03
```

**Integration contracts updated by Sprint 143:**

| Contract | Change | Backward compat |
|----------|--------|-----------------|
| ChannelRouter.callAI() | Returns `{provider:"session-lock"}` when agent busy | New field value, consumers handle via content display |
| AnthropicProvider.doChat() | Sends `stream:false` explicitly | Additive field, Anthropic API accepts |
| TelegramChannel.sendMessage() | Retries without parse_mode on 400 | Transparent to callers (still returns boolean) |
| TIER_FALLBACK_CHAIN | Now includes cloud as last-resort | Chain extension, no contract break |
| KimiProxyProvider.chat() | resolveKimiModel() maps non-Kimi names | Internal, no external contract change |

**Sprint 144 integration additions (shipped):**

| Contract | Addition | Status |
|----------|----------|--------|
| PID lockfile | `~/.endiorbot/serve.pid` — startup checks before binding ports | 144 ✅ |
| Circuit breaker state | In-memory `Map<providerId, CircuitState>` — cleared on restart | 144 ✅ |
| Channel-aware timeout | `originChannel` threaded from bus consumer → router → provider | 144 ✅ |
| Kimi subprocess | `console.warn` deprecation; `ENDIORBOT_KIMI_PROXY_URL` is supported path | 144 ✅ |
| Immediate OTT ack | `⚡ @agent acknowledged` sent before AI call on all OTT channels | 144 ✅ |

### Command Parity (Sprint 144)

39 commands registered in unified `CommandDispatcher` (was 37). All commands accessible from CLI, Web, Telegram, Zalo, and Desktop channels.

| Addition | Detail |
|----------|--------|
| `/status` | Added to dispatcher (was missing) |
| `/clear` | Added to dispatcher (was missing) |
| Immediate ack | All OTT channels send `⚡ @agent` before long AI call |
| Desktop channel | Electron app — all 7 pages functional, gateway auto-starts |

## References

- [Stage & command spine](../00-foundation/stage-command-workflow-spine.md)
- [OTT Channels](../04-build/ott-channels.md)
- [ADR-029 Per-Chat Workspace](../02-design/01-ADRs/ADR-029-Per-Chat-Workspace.md)
- [ADR-052 Agent-Model Tier Mapping](../02-design/01-ADRs/ADR-052-agent-model-tier-mapping.md)
- [E2E Test Plan](../05-test/test-plan-e2e-channels.md)
- [Sprint 139 Integration Spec](sprint-139-integration-spec.md)
- [Gateway Architecture Review Sprint 143](../02-design/14-Technical-Specs/gateway-architecture-review-sprint-143.md)
- [Sprint 144 Plan](../04-build/sprints/sprint-144-gateway-hardening.md)
- [OpenAPI Spec](02-API-Specifications/openapi.json)

---

*Solo Developer Power Tool | SDLC Framework **6.4.0** — Stage 03: Integration — Updated Sprint 145 (2026-04-27)*
