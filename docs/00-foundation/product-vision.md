# EndiorBot Product Vision

---
version: 4.1
status: APPROVED
updated: 2026-07-04
author: CEO + CTO + CPO
sprint: 156
---

## Vision Statement

> EndiorBot is a **Solo Developer Power Tool** — an AI agent orchestrator that helps developers
> get answers in <30 seconds instead of 30-60 minutes, with full SDLC governance.

EndiorBot is NOT a platform, NOT an SDLC enforcer. It is a personal tool that runs locally on
the developer's machine, orchestrating 14 AI agents across 5 channels with enterprise-grade
discipline but solo-developer simplicity.

### Operational spine

For **stage alignment (00→09)**, **design-build-test traceability**, and the split between
**atomic** CLI/OTT/Web commands and **seamless workflows**, see
[`stage-command-workflow-spine.md`](./stage-command-workflow-spine.md).
Full stage index: [`docs/README.md`](../README.md).

---

## Autonomy Levels — What's Implemented (Sprint 158)

| Level | Name | Status | How It Works |
|-------|------|--------|-------------|
| **L1** | Assisted | **SHIPPED** | CEO invokes @agent, reviews output, decides next step |
| **L2** | Supervised | **SHIPPED** | Context anchoring, checkpoints, session persistence, per-chat workspace |
| **L3** | Semi-Autonomous | **SHIPPED** | `ENDIORBOT_AUTO_HANDOFF=true` + exec-policy presets. PM→Architect→Coder→Reviewer→Tester chain. CEO approves at gate boundaries only |
| **L4** | Autonomous | **POLICY READY** | Honest-ceiling clause (anti-confabulation P0), HEARTBEAT beat-loop template, TEAM auto-handoff chain (planning→design→dev→qa→ops), progressive-trust G4-human boundary. AutonomousSessionManager exists (Sprint 72). Runtime wiring + soak pending |

---

## What's Built (Sprint 158 — verified against code)

### Plugin Architecture (Sprint 149-154, NEW)

| Feature | Status | Evidence |
|---------|--------|----------|
| Tier auto-recommendation (7 signals) | SHIPPED | ADR-054, `src/sdlc/scaffold/tier-recommender.ts` |
| Layered CLAUDE.md (root + subdir per tier) | SHIPPED | ADR-055, STANDARD: root + src/ + tests/ |
| Plugin format scaffold (Anthropic Base profile) | SHIPPED | ADR-056, `.claude-plugin/plugin.json` |
| Plugin loader (discover + parse skills/) | SHIPPED | `src/sdlc/scaffold/plugin-loader.ts`, `endiorbot skills` |
| CLAUDE.md staleness detection (5 checks) | SHIPPED | `endiorbot audit-claude-md`, baseline suppression |
| Self-improving hooks (PostToolUse + Stop) | SHIPPED | `.claude/hooks/post-tool-use-tracker.sh`, `stop-suggest.sh` |

### AI Agent Orchestration

| Feature | Status | Evidence |
|---------|--------|----------|
| 14 SOUL agents (9 executors + 4 advisors + 1 router) | SHIPPED | `src/agents/router/agent-constants.ts` — `VALID_AGENTS` |
| 2-tier model routing (Opus / Kimi Code) | SHIPPED | ADR-052 Sprint 156 amendment, `AGENT_PROVIDER_MODEL_MAP` |
| Tier 1: CC Opus (strategic), Tier 2: Kimi Code → CC Sonnet fallback | SHIPPED | `TIER_FALLBACK_CHAIN[1] = ["claude-code", "kimi", "ollama"]`, `[2] = ["kimi", "claude-code", "ollama"]` |
| Provider circuit breaker (Sprint 144) | SHIPPED | `src/agents/router/provider-circuit-breaker.ts` — 2 failures → skip → 60s cooldown |
| Multi-model consultation (@consult) | SHIPPED | `src/cli/commands/consult.ts` — OpenAI + Gemini + Kimi in parallel |
| Claude Code Bridge (tmux sessions) | SHIPPED | `src/agents/invoke/claude-code-bridge.ts` |
| Team agents (6 teams: dev, planning, design, qa, ops, executive) | SHIPPED | `src/agents/orchestrator/team-registry.ts` |
| Auto-handoff chain | SHIPPED | `ENDIORBOT_AUTO_HANDOFF=true`, `maxDepth: 3` |

### 5-Channel Unified Architecture

| Channel | Commands | Status | Evidence |
|---------|----------|--------|----------|
| CLI | 39 | SHIPPED | `endiorbot <cmd>`, `endiorbot chat` |
| Web UI | 39 | SHIPPED | `ws://localhost:18790/ws` → GatewayIngress |
| Telegram | 39 | SHIPPED | `@Endior_bot`, polling + OTT adapter |
| Zalo | 39 | SHIPPED | Bot Endior, OTT adapter |
| Desktop | 39 | SHIPPED | Electron app, gateway auto-start, 9 pages |

All channels route through `GatewayIngress → CommandDispatcher` (39 commands).

### SDLC Governance

| Feature | Status | Evidence |
|---------|--------|----------|
| 10-stage docs structure (00-09) | SHIPPED | `docs/` — all 10 stages with READMEs |
| Gate Engine (G0-G4 + G-Sprint) | SHIPPED | `src/sdlc/gates/gate-engine.ts` |
| Gate Mark (manual item completion) | SHIPPED | `endiorbot gate mark <id> <item> --pass --evidence "..."` |
| Compliance check/fix/score | SHIPPED | `endiorbot compliance check` |
| Vibecoding Index | SHIPPED | `src/sdlc/vibecoding/vibecoding-index.ts` |
| 4-tier classification (LITE→ENTERPRISE) | SHIPPED | `endiorbot init --tier STANDARD` |
| Tier auto-recommendation | SHIPPED | ADR-054, 7 signals → weighted score → tier |
| Layered CLAUDE.md generation | SHIPPED | ADR-055, root + subdir per tier |
| Plugin format (Anthropic Base profile) | SHIPPED | ADR-056, `.claude-plugin/plugin.json` |
| Plugin loader (skills/ discovery) | SHIPPED | `endiorbot skills` — folder-per-skill + flat fallback |
| CLAUDE.md staleness detection | SHIPPED | `endiorbot audit-claude-md` — 5 checks + baseline |
| Self-improving hooks | SHIPPED | PostToolUse tracker + Stop suggest |
| Smart init (codebase analysis) | SHIPPED | ADR-022, `collectProjectContext()` |
| Exec-policy (3 presets: strict/balanced/open) | SHIPPED | ADR-046, 9-module security cluster |
| SSRF protection | SHIPPED | `src/security/http-validator.ts` |
| Audit trail (JSONL, 10MB rotation) | SHIPPED | `~/.endiorbot/audit-logs/` |
| `contains:` content-checker (Sprint 157) | SHIPPED | `gate-engine.ts` — `checkFileContains()`, reusable primitive |
| G2 ST/DT content gates (Sprint 158) | SHIPPED | `g2-iceberg` + `g2-alternatives`, STANDARD+ tier |
| G2 requirements traceability (Sprint 157) | SHIPPED | `g2-requirements-trace` — ADR→requirements link |

### Session & Context

| Feature | Status | Evidence |
|---------|--------|----------|
| Context anchoring (Brain L4 injection) | SHIPPED | `src/agents/context/context-injector.ts` |
| Per-chat workspace (/repos + /focus) | SHIPPED | ADR-029, `src/bridge/repo/` |
| Session persistence (chat mode) | SHIPPED | `~/.endiorbot/sessions/`, auto-save every 5 turns |
| Checkpoint system | SHIPPED | `src/sessions/checkpoint/` |
| Brain L2 pattern matching | SHIPPED | `src/sessions/recovery/engine.ts` — `findMatchingPattern()` |
| Active Memory (FF-gated) | SHIPPED | `src/agents/intelligence/active-memory.ts` |
| Workspace Awareness (17th mechanism) | SHIPPED | `src/agents/context/workspace-awareness.ts` |

### Gateway Resilience (Sprint 144)

| Feature | Status | Evidence |
|---------|--------|----------|
| PID lockfile (singleton serve) | SHIPPED | `~/.endiorbot/serve.pid`, `--force` flag |
| Provider circuit breaker | SHIPPED | 2 failures → OPEN → 60s cooldown → HALF_OPEN |
| OTT-aware timeout (60s OTT, 180s CLI) | SHIPPED | `originChannel` threaded bus→ingress→router |
| Immediate OTT acknowledgement | SHIPPED | `⚡ @agent` sent before AI call |
| Kimi subprocess deprecation notice | SHIPPED | `ENDIORBOT_KIMI_PROXY_URL` recommended |

### Cost & Monitoring

| Feature | Status | Evidence |
|---------|--------|----------|
| Budget tracker | SHIPPED | `src/budget/budget-tracker.ts` |
| Cost reporting (per agent, per provider) | SHIPPED | `endiorbot cost report` |
| Pricing registry (5 providers) | SHIPPED | `src/budget/pricing-registry.ts` |

---

## What's NOT Built Yet

| Feature | Original Version | Status | Notes |
|---------|-----------------|--------|-------|
| `endiorbot autopilot` command | v2.0 | NOT IMPLEMENTED | AutonomousSessionManager exists but no CLI command wraps it |
| 120min+ unattended sessions | v2.0 | SCAFFOLDED | Gate A/B/C exist in tests but not production-validated |
| Operation-based autonomy (YAML policies) | v2.0 | NOT IMPLEMENTED | exec-policy presets cover 80% of use cases |
| Dynamic model tiering (cost-based) | v2.0 | PARTIAL | `ModelSelector` exists (Sprint 72) but not wired to live routing |
| Non-blocking escalation queue | v2.0 | PARTIAL | `src/autonomy/` exists but not connected to serve pipeline |
| Ollama auto-escalation | Sprint 141 | FF-GATED OFF | `ENDIORBOT_FF_OLLAMA_AUTO_ESCALATE=false`, awaiting data soak |
| Plugin/extension system | Future | NOT STARTED | Community can't add custom SOUL agents yet |

---

## Safety Guards (implemented)

| Guard | Status | Evidence |
|-------|--------|----------|
| Exec-policy (strict/balanced/open) | SHIPPED | 9-module cluster, hard-deny list |
| SSRF protection (safeFetch) | SHIPPED | Blocks private IPs, cloud metadata |
| Gate Engine (programmatic G0-G4) | SHIPPED | `evaluateGate()` with evidence check |
| Rate limiting (100 req/min) | SHIPPED | Gateway middleware |
| Security headers (CSP, HSTS, etc.) | SHIPPED | `setSecurityHeaders()` |
| Input sanitization | SHIPPED | `src/security/input-sanitizer.ts` |
| Output scrubbing (key redaction) | SHIPPED | `src/bridge/security/output-redactor.ts` |
| PID lockfile (no duplicate serve) | SHIPPED | Sprint 144 |
| gitleaks pre-commit hook | SHIPPED | `.gitleaks.toml` + `.githooks/` |
| Handoff depth limit (default 3) | SHIPPED | `HandoffGuardsConfig.maxDepth` |
| Honest-ceiling clause (anti-confabulation P0) | SHIPPED | PREAMBLE.md, `gate-engine.ts` SE4H-only override guard |
| Evidence.source tagging (programmatic vs assertion) | SHIPPED | `gate-engine.ts` — auto-check evidence marked `programmatic` |
| HEARTBEAT autonomous work-driver (template) | SHIPPED | `HEARTBEAT.md` — beat-loop semantics, dormant-by-default |
| TEAM auto-handoff chain (agent-to-agent) | SHIPPED | 7 TEAM-*.md — planning→design→dev→qa→ops with cite-path |
| Progressive-trust G4-human boundary | SHIPPED | TEAM-executive, TEAM-ops, TEAM-qa — G4=SE4H-only |
| G2 Iceberg content gate (ST enforcement) | SHIPPED | `contains:…:## Iceberg Analysis`, STANDARD+ |
| G2 Alternatives content gate (DT enforcement) | SHIPPED | `contains:…:## Alternatives Considered`, STANDARD+ |

---

## Current Stats (Sprint 158, 2026-07-04)

| Metric | Value |
|--------|-------|
| Tests | 8,228+ passing |
| Commands | 42 unified (all 5 channels) |
| SOUL agents | 14 (2-tier: 6 Opus + 8 Kimi Code) |
| TEAM charters | 7 (planning, design, dev, qa, ops, fullstack, executive) |
| Channels | 5 (CLI, Web, Telegram, Zalo, Desktop) |
| Active providers | 5 (Claude Code, Kimi, OpenAI, Ollama, MCP Gateway) |
| ADRs | 57 |
| Sprint plans | 100+ (Sprint 56-158) |
| Framework | SDLC 6.4.0 |
| License | MIT |
| Domain | endior.net |

---

## Roadmap (Sprint 145+)

| Sprint | Focus | Status |
|--------|-------|--------|
| 145 | Dual-launch: SDLC Framework + EndiorBot OSS | DRAFT |
| 146 | Post-launch: community growth + tech debt (god classes, circular dep) | DRAFT |
| 147 | Docs site (endior.net Docusaurus), Desktop release builds | PLANNED |
| 148 | Plugin system for custom SOUL agents, semantic versioning | PLANNED |
| Future | `endiorbot autopilot` — production-grade 120min+ sessions | BACKLOG |

---

## Approval

| Stakeholder | Status | Date |
|-------------|--------|------|
| CEO | APPROVED | 2026-04-27 |
| CTO | APPROVED (G2 9/10) | 2026-04-27 |
| CPO | APPROVED (GO) | 2026-04-27 |

---

*EndiorBot Product Vision v3.0 | SDLC Framework 6.4.0 | Sprint 144 (2026-04-27)*
