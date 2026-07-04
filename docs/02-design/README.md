# 02-design — Design

## Purpose

**Key question:** **HOW** will the system behave — architecture, ADRs, APIs, security design?

Design artifacts **constrain build (04)** and **inform integration (03)**. **Tests (05)** validate behavior against design and requirements.

---

## Alignment

- **Upstream:** `docs/01-planning/` (requirements)  
- **Peer:** `docs/03-integrate/` (contracts must match design)  
- **Downstream:** `docs/04-build/` (implementation), `docs/05-test/` (verification design)  
- **Gates:** **G2** (design approved) — often with **@architect** + **@cso** (security) per tier  
- **Stage index:** [`../README.md`](../README.md)

---

## Design ↔ build ↔ test consistency

| Link | Rule |
|------|------|
| Requirements → design | Every ADR/spec references scope from planning or explicit change record. |
| Design → code | No new public surface without ADR or documented extension point. |
| Design → test | Non-functional reqs (security, perf) appear in test strategy or gate evidence. |

Spine: [`../00-foundation/stage-command-workflow-spine.md`](../00-foundation/stage-command-workflow-spine.md).

### Gate nomenclature — EndiorBot vs SDLC Framework 6.4.0

EndiorBot adapts framework Design Thinking gates for **solo-local** use. Same gate IDs, different evidence in some cases:

| EndiorBot gate | Framework DT gate (Pillar 0) | Solo-dev adaptation |
|----------------|------------------------------|---------------------|
| **G0** | Idea validation | `problem-statement.md` + business case; CEO approval |
| **G0.1** | Framework G0.1 (Problem Definition — 5+ interviews) | **Scope Lock** — `scope.md`; CEO = primary user; formal interviews optional |
| **G0.2** (charter only) | Framework G0.2 (Solution Validation — 50+ ideas) | Captured in TEAM-fullstack / `@pm` ideation; not a separate engine gate |
| **G1** | DEFINE + IDEATE → requirements | `requirements.md` + acceptance criteria |
| **G2** | IDEATE + PROTOTYPE → design approved | ADR + TS; **`g2-requirements-trace`** enforces ADR → `docs/01-planning/requirements.md`; prototype optional for internal/meta ADRs |
| **G3** | BUILD + TEST | Tests, coverage, build pass |
| **G4** | Pre-launch / SHIP | **Human-only** (CEO); progressive-trust boundary (ADR-028 T3) |

Framework reference: [`.sdlc-framework/02-Core-Methodology/SDLC-Design-Thinking-Principles.md`](../../.sdlc-framework/02-Core-Methodology/SDLC-Design-Thinking-Principles.md) (symlink to SDLC Enterprise Framework).

**G2 programmatic checks (Sprint 157 — honest scope):**

| Checker | Type | What it proves | What it does NOT prove |
|---------|------|----------------|------------------------|
| `g2-adr-exists` | `glob:` | ADR file on disk | Depth of thinking inside ADR |
| `g2-requirements-trace` | `contains:` | ≥1 ADR references `docs/01-planning/requirements` | Full DT loop; user empathy |
| `g2-technical-spec` | `glob:` | TS file on disk | Spec quality |
| `g2-design-review` | manual | @cto review | — |

**Condition-0 primitive:** `contains:<glob>:<needle>[|<needle2>]` in `gate-engine.ts` — reusable for future ST/DT content gates (e.g. `## Iceberg Analysis`, `## Alternatives Considered`). Not yet wired for Iceberg/DT at G2 — **behavioral only** via `@architect` SOUL until greenfield template ships.

**Export boundary (CEO/CPO ratified):** EndiorBot **solo-internal** = GO with file + minimal content trace. **Customer greenfield scaffold** = HOLD until Iceberg + Alternatives content gates ship — otherwise templates teach agents to skip System/Design Thinking.

---

## EndiorBot command hints (this stage)

| Type | Examples |
|------|----------|
| **Atomic** | `endiorbot gate check G2`, `compliance check`; `consult` for architecture options. |
| **Workflow** | `plan` output → human-reviewed → formal ADRs; long autonomous design sessions per `product-vision.md` (when enabled). |

Catalog: [`../reference/templates/COMMANDS.md`](../reference/templates/COMMANDS.md).

---

## Stage artifacts (living)

| Artifact | Location | Owner |
|----------|----------|-------|
| ADRs | `docs/02-design/01-ADRs/` | @architect |
| API / TS specs | `docs/02-design/` | @architect |

---

## Key ADRs (Recent)

| ADR | Title | Sprint | Status |
|-----|-------|--------|--------|
| ADR-009 | Brain Architecture (Iceberg 4-layer) | 45 | Approved + Sprint 143 amendment (17th mechanism: Workspace Awareness) |
| ADR-046 | Autonomous Execution Policy | 131-132 | Approved |
| ADR-050 | OpenMythos Evaluator Optimization Patterns | 139 | Approved |
| ADR-051 | Kimi Proxy Subprocess Orchestrator | 140 | Approved |
| ADR-052 | Agent-Model Tier Mapping | 140 | Approved + **Sprint 143 amendment** (CC-first routing) |

## Architecture Highlights (Sprint 142-143)

### Vendor-Agnostic Enrichment Layer

```
buildEnrichedPrompt(agent, task, history, workspace)  ← UNIVERSAL
    ├── SOUL identity
    ├── Workspace context (ALWAYS — not PATCH-only)  ← BUG FIX Sprint 143
    ├── IDENTITY.md content (500 token cap)
    ├── Workspace Awareness directive (L1.25)
    ├── RL enrichment
    └── History context
    │
    ▼
Provider function  ← JUST API transport
    ├── claude-code: invokeRead/invokePatch
    ├── kimi: provider.chat()
    ├── openai: provider.chat()
    ├── ollama: fetch()
    └── [new-model]: register + ~20 LoC
```

Adding a new LLM provider = register endpoint + zero context code.

### ADR-052 Amendment — CC-First Routing (Sprint 143)

CEO directive: *"CC luôn là primary với SDLC agents, Kimi chỉ khi rate-limited"*.

| Before (Sprint 140-142) | After (Sprint 143) |
|---|---|
| Tier 2 agents → `provider: "kimi", model: "kimi-k2-6"` | Tier 2 agents → `provider: "claude-code", model: "sonnet"` |
| Fallback: kimi → claude-code → ollama | Fallback: claude-code → kimi → ollama |
| Workspace context gated behind PATCH intent | Workspace context injected for ALL intents |

**Rationale:** Every SDLC agent must read the codebase. CC bridge has native file access; Kimi/cloud providers receive IDENTITY.md + Workspace Awareness directive. No vendor lock — provider swap = transport change, zero context code.

### Brain L2 → Recovery Engine Wiring (Sprint 143)

```
FailureClassifier.classify(error)
    → findMatchingPattern(errorSignature)   ← queries Brain L2 (count ≥ 2)
    → patternHint injected into retry prompt
    → AutonomousSessionManager.executeTaskWork() consumes + nulls hint
```

17th anti-drift mechanism: **SOUL-level Workspace Awareness** — 5 executor SOULs carry mandatory `[Workspace Awareness]` section. Documented as ADR-009 Sprint 143 amendment.

### Gate Mark Design (Sprint 143 A3)

```
endiorbot gate mark <gateId> <itemId> --pass --evidence "..."
    → ~/.endiorbot/evidence/<projectId>/gate-marks.json   (persistence)
    → evaluateChecklist() checks marks for autoCheck:false items
    → gate confirm succeeds without --force
```

Design decisions: evidence mandatory, reset via `--reset`, CEO `--force` unchanged (orthogonal path).

### Gateway Architecture Review (Sprint 143 → 144)

**Full review:** [`14-Technical-Specs/gateway-architecture-review-sprint-143.md`](14-Technical-Specs/gateway-architecture-review-sprint-143.md)

CEO real-world testing exposed 6 structural gaps. Sprint 144 addresses P0+P1:

| Gap | Design decision | Sprint |
|-----|-----------------|--------|
| No singleton process | PID lockfile at `~/.endiorbot/serve.pid` | 144 ✅ |
| No provider circuit breaker | Reuse Active Memory pattern: 2 failures → open → 60s cooldown → half-open | 144 ✅ |
| No OTT-aware timeout | Channel-aware: OTT=60s CC then Kimi; CLI=180s | 144 ✅ |
| Kimi subprocess fragile | Deprecate; document `ENDIORBOT_KIMI_PROXY_URL` external pattern | 144 ✅ |
| No per-agent session lock | `agentLocks` Map in channel-router, released in finally{} | 143 ✅ |
| No message delivery guarantee | Plain-text retry on Telegram Markdown 400 | 143 ✅ |

**Key architectural principle:** The gateway stays stateless — locks/circuits are in-memory (cleared on restart). This is correct for a single-user tool where restart = full reset.

### Circuit Breaker Pattern (Sprint 144)

```
CLOSED  →  (2 consecutive CC failures)  →  OPEN
OPEN    →  (60s cooldown elapsed)        →  HALF_OPEN
HALF_OPEN → (probe succeeds)             →  CLOSED
HALF_OPEN → (probe fails)                →  OPEN (backoff doubles, max 5min)
```

State is held in `Map<providerId, CircuitState>` inside ChannelRouter. Cleared on process restart. When circuit is OPEN, CC is skipped instantly — no timeout wait — and the router falls through to Kimi, then cloud fallback.

### Community Publish Renames (Sprint 144)

| Before | After | Notes |
|--------|-------|-------|
| `src/mtclaw/` | `src/mcp-gateway/` | `McpGatewayBridge`; backward-compat aliases in place |
| provider `"nqh"` | provider `"self-hosted"` | Budget system, telemetry, logs |
| "CEO Power Tool" | "Solo Developer Power Tool" | 337 files updated |
| `@dttai/endiorbot` | `endiorbot` | npm package name |
| nqh-internal.example / nhatquangholding.com | endior.net / example.com | All doc URLs |

---

*EndiorBot | SDLC Framework **6.4.0** — Stage 02: Design — Updated Sprint 145 (2026-04-27)*
