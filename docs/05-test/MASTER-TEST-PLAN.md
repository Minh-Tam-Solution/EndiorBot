# Master Test Plan - EndiorBot SDLC Framework

**Version:** 18.0
**Date:** 2026-04-27 (Updated for Sprint 145)
**Framework:** SDLC v6.4.0
**Coverage:** Unit + Integration + E2E + Manual + Performance
**Milestone:** v4.0 Brain L2 + Circuit Breaker + Expert Routing

---

## Overview

This master test plan covers all testing aspects of EndiorBot, organized by test type and sprint deliverables.

### Test Pyramid

```
        ┌─────────────────┐
        │  Manual (278+)  │  ← User acceptance, exploratory
        ├─────────────────┤
        │    E2E (74)     │  ← End-to-end workflows
        ├─────────────────┤
        │ Integration(197)│  ← Component integration ✅ Sprint 68-72
        ├─────────────────┤
        │  Unit (5896+)   │  ← Function-level tests
        └─────────────────┘
```

**Current Status (Post-Sprint 145): 2026-05-07**
- **Total Tests: 8,137+ (8,131 passing | 1 failing | 10 skipped)**
- **Pass Rate:** 99.9%
- **Sprint 145 Changes:** ADR-053 — Kimi Coding API Direct Integration + kimi-proxy removal
  - 7 new unit tests (`tests/providers/kimi-coding/`)
  - 2 test updates (`pricing-registry`, `cost-estimator` — flat-rate marker)
  - 1 infrastructure failure (`gateway/server.test.ts` — EADDRINUSE port collision, pre-existing)
- **New Tests (Sprint 68-106):** 2,134 tests added
  - Sprint 68 (SDLC Compliance): 102 tests
  - Sprint 69-71 (Session Resilience): 112 tests
  - Sprint 72 (Autonomous Agent): 184 tests (+ 44 golden scenarios type tests)
  - Sprint 73 (CLI Session Mode): 42 tests
  - Sprint 74 (Team Agent System): 99 tests
  - Sprint 75 (Compliance Fix Engine): 41 tests
  - Sprint 76 (OTT Channel Enhancement): 68 unit + 63 manual tests
  - Sprint 77 (Zalo Channel): 153 unit tests
  - Sprint 78 (Local Ollama Router + Conversation Persistence): 70 unit tests
  - Sprint 79 (Smart Init): 31 unit + 35 manual tests
  - Sprint 80 (SDLC Content Quality): 27 unit + 34 manual tests
  - Sprint 82 (Notification Bridge Core): 73 tests
  - Sprint 82.5 (Bridge Telegram Wiring): 27 tests
  - Sprint 83 (Remote Shell + Copilot CLI): 156 tests (+ CTO MF fixes)
  - Sprint 84 (SOUL Bridge): 21 tests (agent-installer + soul-loader + envelope)
  - Sprint 85 (Permission Approval): 41 tests (hook-verifier + handler + relay + installer)
  - Sprint 86 (/send Command + Turn Context): 32 tests (send-command + turn-context)
  - Sprint 87 (Brain L4 + Context Anchoring): 31 tests (brain-loader + context-builder + envelope-builder)
  - Sprint 88 (Evaluator + Vibecoding): 37 tests (output-evaluator + evaluation-store)
  - Sprint 89 (Agent Teams Files): 20 tests (team-installer)
  - Sprint 90 (Agent Teams Telegram): 23 tests (team-launch + team-display + complexity-gate)
  - Sprint 91 (Team Monitoring): 30 tests (team-monitor + team-monitoring commands)
  - Sprint 92 (Unified Launcher): 21 tests (lock-manager + process-monitor + unified-launcher)
  - Sprint 93 (Gateway-Centric Unified App): 37 tests (command-dispatcher + ingress + bridge-commands + telegram-ott-adapter + serve-command)
  - Sprint 94 (Canonical Types + Channel Policy): 48 tests (protocol-types + converters + channel-policy-engine + approve-reject + health-enhanced + canonical-flow)
  - Sprint 95 (Progressive Autonomy T2): 59 tests (goal-decomposer + multi-agent-dispatcher + response-aggregator + ingress-multiagent)
  - Sprint 96 (Cross-Session Context Transfer): 85 tests (context-selector + quality-gate + context-store + transfer-types)
  - Sprint 97 (Progressive Trust T3): 78 tests (context-injector + retention-tracker + context-lifecycle + t3-config + t3-integration)
  - Sprint 98 (Code-Design Gap Closure): 106 tests (model routing + conversation context + format passthrough + cross-reference)
  - Sprint 99 (Per-Chat Workspace + Unified Channel): 24 tests (workspace-resolver + ingress-metadata + command-workspace + launch-workspace + soul-version + e2e-workspace)
  - Sprint 100 (SASE 6.1.2 Full Alignment): 29 tests (tier-constants + agent-definitions + tier-model-map + getAgentModel + multi-agent-history)
  - Sprint 101 (Tier-Aware Routing + ClawVault Memory): 33 tests (workspace-tier-resolver + tier-routing-wiring + observation-scorer + fact-store + session-handoff + barrel-export)
  - Sprint 102 (Unified Command Architecture): +0 new, 5 tests updated (handleInitCommand signature + replyMarkup rename)
  - Sprint 106 (Event Bus Foundation): 24 new tests (message-bus ×12 + consumer ×9 + async-telegram ×3), +1 pre-existing fix (handleFixCommand @pm)
  - Sprint 107 (Bus Reliability): 22 new tests (debounce ×8 + dedup ×9 + consumer-dedup ×5)
- **Tech Debt:** 1 flaky test (checkpoint.test.ts:462 — pre-existing since Sprint 35-40)
- **Known Pre-existing Failures:** 16 gateway WebSocket test files (server response 400 — infrastructure, not code)

---

## 1. Unit Tests (5,000+)

### 1.1 Context Module (97 tests) - Sprint 65

**Location:** `src/context/__tests__/`

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| sprint-goals.test.ts | 14 | PASS | Sprint Goals persistence |
| checkpoint-manager.test.ts | 18 | PASS | Checkpoint create/restore |
| anchor-budget.test.ts | 23 | PASS | Token budget optimization |
| git-context.test.ts | 20 | PASS | Git time-travel queries |
| spec-snapshot-anchor.test.ts | 22 | PASS | Spec drift detection |

---

### 1.2 Search Module (176 tests) - Sprint 63-64

**Location:** `src/search/__tests__/`

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| types.test.ts | 22 | PASS | Types, constants, utils |
| rg-provider.test.ts | 20 | PASS | RgProvider search |
| ast-grep-provider.test.ts | 26 | 9 SKIP | AstGrepProvider (binary) |
| result-ranker.test.ts | 36 | PASS | Multi-factor ranking |
| spec-snapshot.test.ts | 31 | PASS | Spec file discovery |
| integration.test.ts | 25 | PASS | Provider integration |
| ceo-benchmark.test.ts | 16 | PASS | CEO scenarios |

---

### 1.3 SDLC Module Tests - Sprint 61-62, 68

**Location:** `src/sdlc/**/__tests__/`

| Module | Tests | Status | Sprint | Notes |
|--------|-------|--------|--------|-------|
| scaffold/ | 159 | PASS | 61-62 | Structure generation, migration |
| contracts/ | 28 | PASS | 68 | Stage contracts, glob matching |
| gates/ | 25 | PASS | 68, 80 | Gate engine integration + gate: checker + OTT fix |
| patches/ | 25 | PASS | 68 | Patch lifecycle, SHA256 audit |
| dashboard/ | 16 | PASS | 68 | Compliance scoring, reports |
| compliance-integration | 19 | PASS | 68 | Full E2E compliance flow |

**Total SDLC Tests:** 288

---

### 1.4 AER Metrics Module (32 tests) - Sprint 72 Week 1

**Location:** `src/metrics/__tests__/`

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| aer-calculator.test.ts | 32 | PASS | AER calculation, JSONL parsing, aggregation |

**Validated Features:**
- 5 primary metrics: Autonomy Time, TCR, RR, Tool Choice, Cost per Task
- Model pricing calculations
- Event log parsing (JSONL format)
- Division-by-zero protection
- DEFAULT_AER_TARGETS v2.0 benchmarks

---

### 1.5 Model Tiering Module (71 tests) - Sprint 72 Week 2

**Location:** `src/models/__tests__/`

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| model-selector.test.ts | 31 | PASS | Task-to-tier mapping, escalation, downgrade |
| session-budget.test.ts | 40 | PASS | Budget caps, Opus limits, event system |

**Validated Features:**
- 3-tier system: ELITE (Opus), STANDARD (Sonnet), EFFICIENCY (Haiku)
- Auto-escalation after 3 failures
- Budget-aware downgrade
- Opus caps: $3 max cost, 20min max time
- Stage-based allocation
- BudgetEventListener system

---

### 1.6 Session Resilience Module (112 tests) - Sprint 69-71

**Location:** `src/sessions/__tests__/`, `src/sessions/autonomous/__tests__/`

| Test Suite | Tests | Status | Sprint | Coverage |
|------------|-------|--------|--------|----------|
| state-machine.test.ts | 36 | PASS | 69-71 | 9 states, 18 transitions |
| failure-classifier.test.ts | 25 | PASS | 69-71 | TRANSIENT/FIXABLE/DESIGN_ISSUE |
| recovery-engine.test.ts | 19 | PASS | 69-71 | Retry, fix loop, escalation |
| manager.test.ts | 32 | PASS | 72 | Autonomous session orchestration |

**Validated Features:**
- ResilienceState enum (INIT -> DONE, 9 states)
- Failure classification with evidence types
- Exponential backoff retry (transient)
- Fix loop with max attempts (fixable)
- Context-aware escalation (design issues)
- Autonomy Gates A/B/C
- Task queue with priority sorting

---

### 1.7 Golden Scenarios (49 tests) - Sprint 72 Week 4

**Location:** `tests/golden-scenarios/__tests__/`

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| types.test.ts | 24 | PASS | Scenario types, YAML parsing |
| validator.test.ts | 16 | PASS | 10+ validation rules |
| runner.test.ts | 9 | PASS | Dry-run, parallel execution |

**Validated Features:**
- Gate A: Design only (no code writes)
- Gate B: Limited writes (max 10 files)
- Gate C: Full autonomy (2h sessions)
- YAML scenario parsing
- ScenarioRunner with dry-run mode

---

### 1.8 Core Module Tests

**Location:** `src/**/__tests__/`

| Module | Tests | Status | Notes |
|--------|-------|--------|-------|
| providers/ | ~3507 | MOSTLY PASS | Multi-model AI (+7 Sprint 145) |
| agents/ | ~150 | PASS | Agent framework |
| budget/ | 73 | PASS | Budget tracker (+2 updated Sprint 145) |
| account-manager | 65 | PASS | Multi-account switching |
| config/ | ~50 | PASS | Configuration |
| logging/ | ~30 | PASS | Logger |
| utils/ | ~40 | PASS | Utilities |

---

### 1.33 Provider Architecture Changes (13 tests) - Sprint 145

**Location:** `tests/providers/kimi-coding/`, `tests/budget/`, `tests/security/`
**Authority:** ADR-053 Kimi Coding API Direct Integration

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| `kimi-coding/index.test.ts` | 7 | PASS | Provider metadata, init, model normalization, delegation |
| `pricing-registry.test.ts` (updated) | 36 | PASS | Flat-rate marker `kimi-coding` acknowledged |
| `cost-estimator.test.ts` (updated) | 37 | PASS | Cheapest model includes flat-rate subscription |
| `http-validator.test.ts` (new) | 6 | PASS | SSRF defense: `api.kimi.com` + `api.moonshot.ai` allowed; private IPs blocked |

**Validated Features:**
- `KimiCodingProvider` composes `AnthropicProvider` (Anthropic-compatible endpoint)
- Default endpoint: `https://api.kimi.com/coding/v1`
- Model normalization: non-coding model names → `kimi-for-coding`
- Env var split: `KIMI_API_KEY` (coding) vs `MOONSHOT_API_KEY` (backup)
- Fallback chain: `kimi-coding` → `kimi-api` → `openai`
- Pricing registry flat-rate marker: `kimi-coding` entry with `$0` marginal cost

**Cleanup Verified:**
- `src/providers/kimi-proxy/` deleted (3 files, ~600 LOC)
- `tests/providers/kimi-proxy/` deleted
- Zero runtime references to `kimi-proxy`, `claude-code-proxy`, `KIMI_PROXY_*` in `src/`
- `http-validator.ts`: `ENDIORBOT_KIMI_PROXY_URL` refs removed

---

### 1.9 Team Agent System (99 tests) - Sprint 74

**Location:** `tests/agents/orchestrator/`
**Authority:** ADR-017 Team Agent System

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| team-registry.test.ts | 44 | PASS | Registry loading, lookup, resolution, tier switching, charter caching, type guards |
| mention-parser-teams.test.ts | 28 | PASS | Agent-first namespace, team detection, tier availability, backward compat, isTeam derivation |
| agent-router-teams.test.ts | 27 | PASS | Team routing, SOUL enrichment, setTier sync, classification, getTeamRegistry |

**Validated Features:**
- 7 teams: planning, dev, qa, design, ops, fullstack, executive
- Tier-dependent availability: LITE(1) → STANDARD(3) → PRO(5) → ENT(6)
- Agent-first namespace resolution (@pm→agent, @planning→team→pm)
- SOUL context injection: teammates, delegation, charter
- Team charter loading and caching
- Type guards: isValidTeamId, isValidTeamArchetype, isAllowedTeamTransition
- ALLOWED_TEAM_TRANSITIONS (SDLC-aware handoff rules)
- Backward compatibility: no registry → agents only

**Key Design Decisions Tested:**
- CTO B3: `isTeam` derived from `teamId` (never set independently)
- Agent-first: `@fullstack` routes as agent in LITE, not team
- Enrichment: `## Team Context` section appended to leader SOUL
- Tier sync: `setTier()` updates both AgentRouter and TeamRegistry

---

### 1.10 CLI Session Mode (42 tests) - Sprint 73

**Location:** `tests/cli/`, `tests/sessions/`

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| session-mode.test.ts | 22 | PASS | CLI session mode, L2 compliance |
| cli-session-integration.test.ts | 20 | PASS | BUG-011 fix, session resilience |

**Validated Features:**
- CLI session mode switching
- L2 Compliance checks
- BUG-011 fix verification

---

### 1.11 Compliance Fix Engine (41 tests) - Sprint 75

**Location:** `tests/sdlc/compliance-fix.test.ts`
**Authority:** ADR-018 AI-Generated Compliance Content

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| compliance-fix.test.ts | 41 | PASS | Fix engine, issue mapper, content generator, project context |

**Validated Features:**
- ComplianceFixEngine with dry-run and auto-confirm modes
- Issue mapper: compliance issues → fix operations
- AI content generator for missing SDLC artifacts
- Project context collector for AI-generated content
- CLI: `endiorbot compliance fix [--dry-run] [--stage]`
- Stage contracts: artifact dependency tracking

---

### 1.12 OTT Channel Enhancement (68 tests) - Sprint 76

**Location:** `tests/channels/ott/ott-enhancement.test.ts`
**Authority:** ADR-019 OTT Channel Enhancement

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| Telegram Commands (10 new) | 15 | PASS | /agents, /teams, /gate, /compliance, /fix, /consult, /config, /init, /mode, /webhook |
| Help Message | 3 | PASS | 14 commands, 4 categories, mention format |
| Agent Keyboard | 6 | PASS | 12 agents tier-aware, 3-per-row layout, icons |
| Team Keyboard | 5 | PASS | Tier-aware (LITE→ENT), 2-per-row, callbacks |
| Mode Confirm Keyboard | 2 | PASS | Confirm/cancel buttons, request ID |
| formatAgentNotFound | 2 | PASS | 12 agents + 7 teams dynamic list |
| Webhook (Telegram) | 8 | PASS | Secret token, body parsing, JSON validation |
| Webhook (Zalo) | 6 | PASS | HMAC-SHA256 MAC, replay protection, timestamp |
| Webhook (Rate Limit) | 1 | PASS | 100/min per IP sliding window |
| Webhook (Handler) | 5 | PASS | HTTP routing, 405, 404, body size limit |
| Agent Icons | 2 | PASS | All 12 + fallback, fullstack icon |
| i18n | 2 | PASS | 25 EN keys, 25 VI keys |
| Response Formatter | 3 | PASS | Processing, error, patch status |
| CTO Fixes | 4 | PASS | B3 64-byte, P0-2 NaN guard, P0-4 fullstack |
| **Total** | **68** | **PASS** | **All Sprint 76 features** |

**Validated Features:**
- Webhook handler: Telegram secret token + Zalo HMAC-SHA256 MAC verification
- Gateway integration: POST /webhook/telegram and /webhook/zalo routes
- Security: timingSafeEqual, rate limiting (100/min/IP), replay protection
- 10 new commands with edge case handling
- Agent keyboard: 12 agents tier-aware (SE4A + SE4H)
- Team keyboard: tier-aware (LITE→ENT)
- Mode escalation: PATCH detection with CEO 2-step confirmation
- i18n: 25 OTT keys (EN + VI)

---

### 1.13 Zalo Channel (153 tests) - Sprint 77

**Location:** `tests/channels/zalo/`
**Authority:** ADR-020 OTT Channel Completion

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| zalo-bot.test.ts | ~45 | PASS | ZaloBotChannel lifecycle, send, dispose |
| zalo-channel.test.ts | ~38 | PASS | Channel interface, bidirectional comms |
| zalo-agent-handler.test.ts | ~38 | PASS | Message dispatch, agent routing |
| zalo-commands.test.ts | ~32 | PASS | 10 Zalo slash commands, text responses |

**Validated Features:**
- ZaloBotChannel implements BidirectionalChannel interface
- Zalo API integration (getMe, sendMessage, getWebhookInfo, getUpdates)
- 10 Zalo commands: /help, /agents, /teams, /gate, /compliance, /fix, /consult, /config, /init, /approve
- Plain text responses (no Markdown — Zalo limitation)
- Agent dispatch via ZaloAgentHandler
- Platform limitations documented (zapps.me 502, no markdown)

---

### 1.14 Local Ollama Router + Conversation Persistence (70 tests) - Sprint 78

**Location:** `tests/agents/routing/local-router.test.ts`, `tests/channels/conversation/`
**Authority:** ADR-021 Local Ollama Router

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| local-router.test.ts | ~32 | PASS | LocalRouterAgent, cost optimizer, pattern analytics |
| conversation/store.test.ts | ~28 | PASS | ConversationStore persistence, TTL, CRUD |
| conversation/intents.test.ts | ~6 | PASS | Intent classification |
| conversation/message-handler.test.ts | ~4 | PASS | Message routing |

**Validated Features:**
- LocalRouterAgent routes cheap tasks to Ollama (local, free)
- Cost optimizer: Ollama for EFFICIENCY tier tasks, cloud for STANDARD+
- ConversationStore: SQLite-backed persistence with TTL
- Pattern analytics for routing decisions
- Adaptive gates: quality checks before accepting local responses
- Confidence scoring for local vs cloud routing

---

### 1.15 Smart Init — Codebase Analysis (31 tests) - Sprint 79

**Location:** `tests/sdlc/compliance/project-context-collector.test.ts` (NEW), `tests/sdlc/scaffold/templates.test.ts`, `tests/sdlc/scaffold/structure-generator.test.ts`
**Authority:** ADR-022 Smart Init Codebase Analysis

| Test Suite | Tests | Status | New | Coverage |
|------------|-------|--------|-----|----------|
| project-context-collector.test.ts | 13 | PASS | 13 (NEW) | bun.lock, Tauri, Vue/Vite, open-pencil scenario |
| templates.test.ts | +14 | PASS | 14 | identity-md/claude-md/sdlc-config with snapshot |
| structure-generator.test.ts | +4 | PASS | 4 | scaffoldProject with snapshot threading |

**Validated Features:**
- `bun.lock` text format (Bun 1.2+) detected as Bun package manager
- Tauri 2 detection via `@tauri-apps/api` or `@tauri-apps/cli`
- Vue/Vite enrichment: vue + vite/`@vitejs/plugin-vue` → `"Vue/Vite"` string
- `generateIdentityMd(project, snapshot?)` — `## Tech Stack` section when snapshot present
- `generateClaudeMd(project, snapshot?)` — script-aware commands with detected PM
- `generateSdlcConfig(project, snapshot?)` — emits `techStack` + `analyzedAt`
- `scaffoldProject()` with snapshot threads to all 3 templates
- No snapshot → backward-compatible generic output (no regression)

---

### 1.16 SDLC Content Quality + Gate Fixes (27 tests) - Sprint 80

**Location:** `tests/sdlc/compliance/content-generator.test.ts` (+16), `tests/sdlc/gates/gate-engine.test.ts` (NEW, 11)
**Authority:** ADR-023 SDLC-Aligned Content Quality

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| content-generator.test.ts (+16) | 16 | PASS | Gate-driven prompts, quality validation, extractKeyContent, refinement loop |
| gate-engine.test.ts (NEW) | 11 | PASS | gate: checker, command: checker, coverage: stub, OTT /gate fix, G-Sprint path |

**Validated Features:**
- `GATE_ARTIFACT_REQUIREMENTS` — 7 gates, 30+ artifacts with tier-specific requirements
- `buildUserPrompt()` — gate-driven instructions with pass criteria, all modules, dependencies
- `validateContentQuality()` — 6 checks (YAML, BDD, References, minLines, specificity, placeholders)
- `extractKeyContent()` — smart context extraction (2000 chars, YAML/heading preservation)
- Refinement loop — max 2 invocations, retry on quality failure
- `gate:` checker — queries gate-store via `isGateConfirmed()`, not a stub
- `command:` checker — `commandRunner` injection via `--run-checks` flag
- `coverage:` checker — explicit stub with TODO (CTO C3)
- OTT `/gate` command — references `gate recommend` (not `gate check`)
- G-Sprint checker path — `docs/04-build/sprints/` (not `01-planning/`)
- CTO C1-C4 — all conditions satisfied and tested

---

### 1.17 Notification Bridge Core (73 tests) - Sprint 82

**Location:** `tests/bridge/`
**Authority:** ADR-024 Notification Bridge

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| tmux-bridge.test.ts | 16 | PASS | TmuxBridge create/sendKeys/capture/kill |
| session-registry.test.ts | 23 | PASS | Session CRUD, persistence, version+checksum |
| agent-launcher.test.ts | 12 | PASS | Agent launch with path validation |
| security/bridge-audit.test.ts | 33 | PASS | Audit logger, rotation, JSONL format |
| security/bridge-policy.test.ts | 25 | PASS | Policy CRUD, rate limits, actor allowlists |
| security/input-sanitizer.test.ts | 72 | PASS | Input sanitization, injection prevention |
| security/output-redactor.test.ts | 21 | PASS | Output redaction, ANSI stripping |

**Validated Features:**
- TmuxBridge: execFile-only tmux operations (no shell injection)
- SessionRegistry: file-backed with atomic writes, version+checksum
- AgentLauncher: 5 agent types, policy enforcement, path traversal guard
- 4-layer security: input sanitizer, output redactor, bridge audit, bridge policy

---

### 1.18 Bridge Telegram Wiring (27 tests) - Sprint 82.5

**Location:** `tests/channels/telegram/bridge-commands.test.ts`
**Authority:** ADR-024 D3, Sprint 82.5

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| bridge-commands.test.ts | 27 | PASS | /link, /launch, /sessions, /switch, /capture, /kill handlers |

**Validated Features:**
- Identity binding: /link with actorId generation
- Agent launch: /launch with type validation + policy check
- Session management: /sessions, /switch with identity guard
- Capture output: /capture with redaction + line limits
- Kill session: /kill with audit trail

---

### 1.19 Remote Shell + Copilot CLI (156 tests) - Sprint 83

**Location:** `tests/bridge/repo/`, `tests/bridge/copilot/`, `tests/bridge/shell/`, `tests/channels/telegram/remote-commands.test.ts`
**Authority:** ADR-024 D4/D5, Sprint 83

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| repo/repo-registry.test.ts | 17 | PASS | Repo CRUD, path validation (CA4), atomic writes (MF-3) |
| repo/chat-focus.test.ts | 10 | PASS | Focus get/set/clear, multi-chat, atomic writes (MF-3) |
| copilot/copilot-bridge.test.ts | 17 | PASS | Runtime detect, suggest, explain, ANSI strip, status |
| shell/shell-allowlist.test.ts | 68 | PASS | 25 allowed + 32 blocked + 11 metacharacter (MF-1) |
| shell/shell-session-manager.test.ts | 13 | PASS | UUID marker, timeout, capture, queue, redaction (MF-2) |
| telegram/remote-commands.test.ts | 30 | PASS | 9 handlers + executeApprovedRun (MF-5) |

**Validated Features:**
- Repo Context: /repos add/remove/list, /focus, /where with no-focus messaging (CA6)
- Copilot CLI: detect() with priority (copilot-cli > gh-copilot > none), suggest/explain with ANSI strip
- Shell Allowlist (CRITICAL SECURITY):
  - Metacharacter guard: `$()`, backticks, `;`, `&&`, `||`, `>`, `<` all blocked (MF-1)
  - Pipe segment validation: all segments checked against allowlist (W-4)
  - Read-only positive allowlist: git read, ls, cat, head, tail, wc, file, find (no -exec), rg, grep
  - Blocked: sudo, rm, mv, cp, curl, wget, python -c, bash, git push/commit/reset
  - Path protection: /etc/, ~/.ssh/, ~/.aws/, ~/.kube/
- Shell Session Manager: UUID marker protocol, poll-based capture, redactBridgeOutput (MF-2)
- /run Approval Gate: commandDigest binding, full command display (CTO W-3), buildCleanEnv (CA5)
- executeApprovedRun: execFile only (CTO C3/A7), audit trail, redaction, envAllowlist passthrough
- Atomic writes: write-to-tmp + renameSync in both registries (MF-3)
- /approve wired to executeApprovedRun in telegram-poll.mjs (MF-4)

---

### 1.20 SOUL Bridge + Agent Installer (21 tests) - Sprint 84

**Location:** `tests/bridge/agent-launcher.soul.test.ts`, `tests/agents/channel-router.soul-loader.test.ts`, `tests/bridge/intelligence/agent-installer.test.ts`
**Authority:** ADR-025 Session Intelligence Envelope

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| agent-launcher.soul.test.ts | 13 | PASS | SOUL injection strategies (native-agent, append-system-prompt-file), audit |
| channel-router.soul-loader.test.ts | 8 | PASS | Channel router SoulLoader integration |

**Validated Features:**
- Strategy A: `--agent <role>` (native agent file)
- Strategy B: `--append-system-prompt-file` (SOUL temp file with 0o600 perms)
- Agent installer: 13 agent `.md` files with frontmatter per role
- Audit event: `soul_strategy_selected` with strategy + source details
- SOUL temp file lifecycle: create on launch, clean on kill (CTO W-2)

---

### 1.21 Permission Approval (41 tests) - Sprint 85

**Location:** `tests/bridge/hooks/`
**Authority:** ADR-024 §8.4

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| hook-verifier.test.ts | 12 | PASS | HMAC-SHA256 verification, nonce format, replay detection |
| hook-handler.test.ts | 8 | PASS | Hook event parsing, session lookup, audit |
| permission-relay.test.ts | 12 | PASS | Permission request forwarding, TTL, decision relay |
| hook-installer.test.ts | 9 | PASS | Hook script generation, file permissions, idempotency |

**Validated Features:**
- HMAC-SHA256 verification with timing-safe comparison
- Nonce format: `sessionId:randomHex`, replay protection window
- Permission forwarding to Telegram with 5-min TTL
- Hook installer: generates `.claude/hooks/` scripts
- Decision relay: approve/deny → sendKeys back to tmux pane

---

### 1.22 /send Command + Turn Context (32 tests) - Sprint 86

**Location:** `tests/channels/telegram/send-command.test.ts`, `tests/bridge/intelligence/turn-context.test.ts`
**Authority:** ADR-024 §8.5

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| send-command.test.ts | 12 | PASS | /send handler, input sanitization, session lookup, audit |
| turn-context.test.ts | 20 | PASS | Context building, active project loading, prefix cap |

**Validated Features:**
- `/send <message>` command: relay text input to active session's tmux pane
- Turn-time context: active project injection on each /send
- Input sanitization before sendKeys relay
- Audit event: `send_command` with content hash

---

### 1.23 Brain L4 + Context Anchoring (31 tests) - Sprint 87

**Location:** `tests/bridge/intelligence/brain-loader.test.ts`, `tests/bridge/intelligence/context-builder.test.ts`, `tests/bridge/intelligence/envelope-builder.test.ts`
**Authority:** ADR-025 Session Intelligence Envelope

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| brain-loader.test.ts | 11 | PASS | Mental model loading, formatting, token budget, hashing |
| context-builder.test.ts | 10 | PASS | Active project context, formatting, hashing |
| envelope-builder.test.ts | 10 | PASS | Full envelope assembly, missing layers, serialization |

**Validated Features:**
- Brain L4: Mental models loaded + formatted + SHA256 hashed
- Context: Active project context injected at session start
- Envelope builder: assembles persona + brain + context into single injection
- Token budget: brain 1K + context 1K caps
- Graceful degradation: missing layers → partial envelope (non-fatal)

---

### 1.24 Evaluator + Vibecoding (37 tests) - Sprint 88

**Location:** `tests/bridge/intelligence/output-evaluator.test.ts`, `tests/bridge/intelligence/evaluation-store.test.ts`
**Authority:** ADR-025

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| output-evaluator.test.ts | 26 | PASS | 5-signal scoring, weighted average, summary, null returns |
| evaluation-store.test.ts | 11 | PASS | JSONL append, load with per-line resilience, path format |

**Validated Features:**
- 5 quality signals: code-test ratio, comment density, error patterns, complexity, lint compliance
- Weighted vibecoding index (0-100 scale)
- Summary generation with actionable feedback
- JSONL evaluation store with per-line corruption resilience
- `MIN_TEXT_LENGTH` guard for short outputs

---

### 1.25 Agent Teams Files (20 tests) - Sprint 89

**Location:** `tests/bridge/intelligence/team-installer.test.ts`
**Authority:** ADR-026 Agent Teams

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| team-installer.test.ts | 20 | PASS | Feature flag gating, team file generation, fullstack exclusion (C3), agent tool isolation (C7) |

**Validated Features:**
- Feature flag gating: `AGENT_TEAMS` required to generate team files
- Team file generation: `<teamId>-team.md` in `.claude/agents/`
- Fullstack exclusion (CTO C3): no team file for single-agent teams
- Zero-member skip: teams with no members don't get files
- Agent tool isolation (CTO C7): correct tool restrictions per role
- Charter content: frontmatter, teammates, delegation rules
- Force/skip behavior + path traversal guard

---

### 1.26 Agent Teams Telegram (23 tests) - Sprint 90

**Location:** `tests/channels/telegram/team-launch.test.ts`, `tests/channels/telegram/team-display.test.ts`, `tests/bridge/intelligence/complexity-gate.test.ts`
**Authority:** ADR-026 Agent Teams

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| team-launch.test.ts | ~7 | PASS | /launch --as-team, complexity gate, team leader SOUL |
| team-display.test.ts | ~6 | PASS | /team-status, team session listing, display formatting |
| complexity-gate.test.ts | 10 | PASS | Task length, keyword detection, case-insensitive |

**Validated Features:**
- `/launch --as-team <teamId>`: launch team leader with team file
- Complexity gate: min task length + keyword detection before team launch
- Team leader SOUL injection via native `--agent` with team file
- `/team-status`: display team sessions with role + status
- `assessComplexity()`: `MIN_TASK_LENGTH` + `COMPLEXITY_KEYWORDS` matching

---

### 1.27 Team Monitoring (30 tests) - Sprint 91

**Location:** `tests/bridge/teams/team-monitor.test.ts`, `tests/channels/telegram/team-monitoring.test.ts`
**Authority:** ADR-026, CTO A4

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| team-monitor.test.ts | 16 | PASS | Health checks, cost tracking, stuck detection, threshold callbacks |
| team-monitoring.test.ts | 14 | PASS | /team-health, /kill-team, cost callback handlers |

**Validated Features:**
- Team health checks: per-member status (healthy, stuck, crashed, idle)
- Cost tracking: simulated cost aggregation with USD threshold
- Stuck detection: idle > `teamStuckIdleThresholdSec` → marked stuck
- `/team-health`: display per-member health with status icons
- `/kill-team <teamId>`: kill all team sessions + audit `team_killed`
- Cost threshold callback: notify CEO when cost exceeds limit
- Cost extend/stop actions via inline keyboard

---

### 1.28 Unified Launcher (21 tests) - Sprint 92

**Location:** `tests/bridge/launcher/`
**Authority:** ADR-024 (Sprint 92)

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| lock-manager.test.ts | 6 | PASS | Acquire, stale lock removal, duplicate prevention, release, isRunning |
| process-monitor.test.ts | 7 | PASS | PID alive, crash detect, auto-restart, team crash, crash-loop cap (MF-1) |
| unified-launcher.test.ts | 8 | PASS | Start/stop lifecycle, lock, recovery, zombie pane (F2), multiple sessions |

**Validated Features:**
- Lock file singleton: `~/.endiorbot/launcher.lock` with PID + stale detection
- Process monitor: 15s poll, PID liveness check, auto-restart with same SOUL/team context
- Restart cap (CTO MF-1): max 3 restarts per 5 min window → exhaust notification
- Zombie pane detection (CTO F2): pane alive + PID dead → kill zombie + markError
- Session recovery: active sessions → check pane + PID → recovered vs lost
- Audit symmetry: `launcher_started` + `launcher_stopped` (CTO F1)
- CLI: `endiorbot bridge launcher start/stop/status`

---

### 1.29 Gateway-Centric Unified App (37 tests) - Sprint 93

**Location:** `tests/commands/`, `tests/gateway/`, `tests/channels/telegram/`, `tests/cli/`
**Authority:** ADR-024 + ADR-002 (Sprint 93)

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| command-dispatcher.test.ts | 11 | PASS | Register, dispatch, has, isSensitive, requiresLink, factory, requireLinkedActor |
| ingress.test.ts | 8 | PASS | Command routing, AI chat, unknown cmd error, @botname strip, metadata |
| bridge-commands.test.ts | 4 | PASS | cmd.* registration, sensitive auth check, count |
| telegram-ott-adapter.test.ts | 10 | PASS | Truncation (under/over/exact), interface, factory, Zalo helpers |
| serve-command.test.ts | 4 | PASS | Registration, --no-telegram/--no-zalo, --port, B1 collision |

**Validated Features:**
- CommandDispatcher: central registry for 23+ commands, `SENSITIVE_COMMANDS` + `LINKED_COMMANDS` sets
- `requireLinkedActor()` helper (Fix #4): unified identity check across handlers
- GatewayIngress: single entry point (`handleInbound()`), Fix #1 unknown cmd → error, Fix #2 unified auth
- Bridge Commands: `cmd.*` Gateway methods, R3 sensitive command auth
- Router Chat: `router.chat` thin passthrough with agent/model/latencyMs metadata
- Telegram OTT adapter: truncation to 4096 chars, `OttAdapter` interface
- Zalo OTT adapter: 2000 char limit, `stripMarkdown()`, plain text only
- `endiorbot serve`: unified startup, `--port`, `--no-telegram`, `--no-zalo`, B1 name collision avoidance
- Graceful shutdown: reverse order, 5s per component, 20s max

---

### 1.30 Canonical Types + Channel Policy Engine (48 tests) - Sprint 94

**Location:** `tests/protocol/`, `tests/policy/`, `tests/commands/`, `tests/monitoring/`, `tests/integration/`
**Authority:** ADR-002 + ADR-024 (Sprint 94)

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| protocol/types.test.ts | 13 | PASS | EndiorMessage creation, optional fields, isValidEndiorMessage, isValidChannelSource, validateMessageContent, generateMessageId |
| protocol/converters.test.ts | 10 | PASS | fromInboundMessage, toInboundMessage, round-trip, fromOTTMessage, fromIncomingMessage, toInboundResponse |
| policy/channel-policy-engine.test.ts | 10 | PASS | Under/over limit, Telegram/Zalo/Web policies, overridePolicy, resetLimits, getStats, content length |
| commands/approve-reject.test.ts | 6 | PASS | /approve valid/not-found/already-resolved/no-arg, /reject valid/no-arg |
| monitoring/health-enhanced.test.ts | 7 | PASS | OTT adapter metrics, channel router metrics, enhanced collectHealthReport |
| integration/canonical-flow.test.ts | 2 | PASS | OTTMessage → EndiorMessage → policy allowed, content length denial |

**Validated Features:**
- Canonical types: EndiorMessage, EndiorRequest, EndiorResponse, ChannelSource (ADR-002 portable)
- CTO F1: ISO 8601 string timestamps; CTO F4: `${channel}-${vendorId}` message IDs
- Converters: 5 bidirectional converters (InboundMessage, OTTMessage, IncomingMessage), round-trip preservation
- Channel Policy Engine: per-channel sliding-window rate limits (30/20/60/120 msgs/min)
- Policy overrides and reset; per-channel statistics tracking
- /approve with executeApprovedRun integration (CTO F2); /reject with status update
- Health report: OTT adapter status (running/stopped), channel router readiness
- Integration: full canonical flow from OTT raw message through policy check

---

### 1.31 Previously Known Failures (RESOLVED)

| File | Was Failing | Fix Applied | Sprint Fixed |
|------|-------------|-------------|--------------|
| tests/integration/workflow.test.ts | 40 | Rewritten to match multi-workflow ID-based API | 72 |
| tests/integration/agent-loop.test.ts | 20 | Rewritten to match ParseResult/HandoffGuards API | 72 |
| tests/cli/cli-smoke.test.ts | 1 | Fixed test ordering assertion | 72 |

- **Total Tech Debt:** 0 failing tests (all resolved)
- **Resolution:** All 61 legacy tests rewritten to match current API implementations

---

## 2. Integration Tests

### 2.1 SDLC Compliance Integration (19 tests) - Sprint 68

**File:** `tests/sdlc/compliance-integration.test.ts`

**Scenarios:**
1. Init -> Scaffold -> Compliance full flow
2. Multi-tier validation (LITE/STANDARD/PROFESSIONAL)
3. PatchManager lifecycle (start -> commit -> rollback)
4. Dashboard scoring with report generation
5. Stage contract enforcement

**Status:** 19 tests passing | Performance: < 50ms full scan

---

### 2.2 Search Integration (25 tests) - Sprint 63-64

**File:** `src/search/__tests__/integration.test.ts`

**Status:** 19 passing | 6 skipped (binaries)

---

### 2.3 Multi-Model Consultation (TBD)

**Status:** PLANNED

---

## 3. End-to-End Tests (74 tests)

### 3.1 Context Anchoring E2E (17 tests) - Sprint 65

**File:** `tests/e2e/context-anchoring.e2e.test.ts`
**Status:** 17 tests passing

### 3.2 Code Search E2E (20 tests) - Sprint 65

**File:** `tests/e2e/code-search.e2e.test.ts`
**Status:** 20 tests passing

### 3.3 Chat Flow E2E (37 tests) - Sprint 65

**Files:** `tests/e2e/*.e2e.test.ts` (5 files)
**Status:** 37 tests passing

---

## 4. Sprint E2E Reports

### 4.1 Sprint 79 Test Summary (Smart Init)

| Module | Tests | Time | Coverage |
|--------|-------|------|----------|
| project-context-collector (NEW) | 13 | <100ms | bun.lock, Tauri 2, Vue/Vite, open-pencil scenario |
| templates.test.ts (+14 new) | 14 | <50ms | identity-md, claude-md, sdlc-config with snapshot |
| structure-generator.test.ts (+4 new) | 4 | <50ms | scaffoldProject snapshot threading |
| **Manual mt-79-smart-init.mjs** | **35** | ~30s | **35/35 PASS** (6 phases, open-pencil live) |
| **Total** | **66** | <1s | **Full Smart Init pipeline** |

### 4.2 Sprint 82-83 Test Summary (Notification Bridge + Remote Shell)

| Module | Tests | Time | Coverage |
|--------|-------|------|----------|
| bridge/tmux-bridge.test.ts | 16 | <10ms | TmuxBridge operations |
| bridge/session-registry.test.ts | 23 | <15ms | Session persistence |
| bridge/agent-launcher.test.ts | 12 | <10ms | Agent launch |
| bridge/security/ (4 suites) | 151 | <50ms | Audit, policy, input, output |
| bridge-commands.test.ts | 27 | <10ms | 6 Telegram bridge handlers |
| repo/repo-registry.test.ts | 17 | <20ms | Repo CRUD + atomic writes |
| repo/chat-focus.test.ts | 10 | <15ms | Focus tracking + atomic writes |
| copilot/copilot-bridge.test.ts | 17 | <5ms | Runtime detect, suggest, explain |
| shell/shell-allowlist.test.ts | 68 | <5ms | 25 allowed + 32 blocked + 11 metacharacter |
| shell/shell-session-manager.test.ts | 13 | ~33s | UUID marker, timeout (30s), queue |
| remote-commands.test.ts | 30 | <10ms | 9 handlers + executeApprovedRun |
| **Total** | **384** | **~34s** | **Full bridge + remote shell pipeline** |

### 4.3 Sprint 84-92 Test Summary (Bridge Intelligence + Teams + Launcher)

| Module | Tests | Sprint | Coverage |
|--------|-------|--------|----------|
| agent-launcher.soul.test.ts | 13 | 84 | SOUL injection strategies |
| channel-router.soul-loader.test.ts | 8 | 84 | Channel router + SoulLoader |
| hook-verifier.test.ts | 12 | 85 | HMAC verification |
| hook-handler.test.ts | 8 | 85 | Hook event parsing |
| permission-relay.test.ts | 12 | 85 | Permission forwarding |
| hook-installer.test.ts | 9 | 85 | Hook script generation |
| send-command.test.ts | 12 | 86 | /send handler |
| turn-context.test.ts | 20 | 86 | Turn-time context |
| brain-loader.test.ts | 11 | 87 | Brain L4 loading |
| context-builder.test.ts | 10 | 87 | Context envelope |
| envelope-builder.test.ts | 10 | 87 | Full envelope assembly |
| output-evaluator.test.ts | 26 | 88 | 5-signal vibecoding |
| evaluation-store.test.ts | 11 | 88 | JSONL evaluation store |
| team-installer.test.ts | 20 | 89 | Team file generation |
| complexity-gate.test.ts | 10 | 90 | Task complexity assessment |
| team-launch.test.ts | ~7 | 90 | Team launch commands |
| team-display.test.ts | ~6 | 90 | Team status display |
| team-monitor.test.ts | 16 | 91 | Health checks, cost tracking |
| team-monitoring.test.ts | 14 | 91 | /team-health, /kill-team |
| lock-manager.test.ts | 6 | 92 | Lock file singleton |
| process-monitor.test.ts | 7 | 92 | PID poll + crash recovery |
| unified-launcher.test.ts | 8 | 92 | Orchestrator + zombie detect |
| **Total** | **256** | **84-92** | **Full intelligence + teams + launcher** |

### 4.4 Sprint 80 Test Summary (SDLC Content Quality + Gate Fixes)

| Module | Tests | Time | Coverage |
|--------|-------|------|----------|
| content-generator.test.ts (+16 new) | 16 | <50ms | Gate-driven prompts, quality validation, extraction |
| gate-engine.test.ts (NEW) | 11 | <10ms | gate: checker, command: checker, OTT fix, G-Sprint path |
| **Manual mt-80-content-quality.mjs** | **34** | ~5s | **34/34 PASS** (9 phases, open-pencil quality audit) |
| **Total** | **61** | <6s | **Full Sprint 80 pipeline** |

### 4.3 Sprint 77 Test Summary (Zalo Channel)

| Module | Tests | Time | Coverage |
|--------|-------|------|----------|
| zalo-bot.test.ts | ~45 | <100ms | ZaloBotChannel lifecycle, API |
| zalo-channel.test.ts | ~38 | <100ms | BidirectionalChannel interface |
| zalo-agent-handler.test.ts | ~38 | <100ms | Message dispatch, routing |
| zalo-commands.test.ts | ~32 | <100ms | 10 slash commands, plain text |
| **Total** | **153** | <1s | **Full Zalo channel** |

### 4.3 Sprint 78 Test Summary (Local Ollama Router + Conversation Persistence)

| Module | Tests | Time | Coverage |
|--------|-------|------|----------|
| local-router.test.ts | ~32 | <200ms | LocalRouterAgent, cost optimizer |
| conversation/store.test.ts | ~28 | <100ms | ConversationStore persistence |
| conversation/intents.test.ts | ~6 | <50ms | Intent classification |
| conversation/message-handler.test.ts | ~4 | <50ms | Message routing |
| **Total** | **70** | <500ms | **Full local routing pipeline** |

### 4.5 Sprint 74 Test Summary (Team Agent System)

| Module | Tests | Time | Coverage |
|--------|-------|------|----------|
| Team Registry | 44 | 12ms | Loading, lookup, resolution, charter |
| Mention Parser Teams | 28 | 4ms | Agent-first, team detect, tier avail |
| Agent Router Teams | 27 | 19ms | Routing, SOUL enrichment, tier sync |
| **Total** | **99** | **35ms** | **Full team routing pipeline** |

### 4.6 Sprint 76 Test Summary (OTT Channel Enhancement)

| Module | Tests | Time | Coverage |
|--------|-------|------|----------|
| Telegram Commands | 15 | <5ms | 10 new commands + edge cases |
| Keyboards (Agent/Team/Mode) | 13 | <5ms | Tier-aware, callback parsing |
| Webhook Handler | 20 | <10ms | Telegram + Zalo + rate limit |
| Response Formatter | 5 | <5ms | Icons, formatting, agent not found |
| i18n | 2 | <5ms | 25 EN + 25 VI keys |
| CTO Fixes | 4 | <5ms | B3, P0-2, P0-4 |
| Help + formatAgentNotFound | 5 | <5ms | 14 commands, 12 agents + 7 teams |
| Mode Escalation | 4 | <5ms | PATCH detection, confirm/cancel |
| **Total** | **68** | **269ms** | **Full OTT parity** |

### 4.7 Sprint 72 Test Summary

**Full Report:** [E2E-SPRINT-72-REPORT-2026-03-02.md](./07-E2E-Testing/reports/E2E-SPRINT-72-REPORT-2026-03-02.md)

| Week | Module | Tests | Time |
|------|--------|-------|------|
| 1 | AER Metrics | 32 | 254ms |
| 2 | Model Tiering | 71 | 60ms |
| 3 | Autonomous Session Manager | 32 | 10.5s |
| 4 | Golden Scenarios | 49 | 29ms |
| **Total** | | **184** | **10.8s** |

---

## 5. Manual Tests (143 tests)

**File:** [manual-test-plan.md](./manual-test-plan.md)

| Suite | Tests | Passed | Pending |
|-------|-------|--------|---------|
| Context Search | 6 | 6 | 0 |
| Multi-Model Consultation | 5 | 2 | 3 |
| Compliance | 2 | 2 | 0 |
| Init Command | 2 | 2 | 0 |
| Core Commands | 3 | 1 | 2 |
| Error Handling | 3 | 3 | 0 |
| Performance | 2 | 0 | 2 |
| Integration | 2 | 0 | 2 |
| Team Agent Routing (Sprint 74) | 8 | 8 | 0 |
| Dyad Repo Manual (Sprint 74) | 12 | 12 | 0 |
| OTT Enhancement (Sprint 76) | 63 | 63 | 0 |
| Zalo Bot Live (Sprint 77) | 7 | 0 | 7 (requires live Zalo API) |
| Zalo Commands Live (Sprint 77) | 10 | 0 | 10 (requires live Zalo API) |
| Smart Init — open-pencil (Sprint 79) | 35 | 35 | 0 |
| Content Quality — open-pencil (Sprint 80) | 34 | 34 | 0 |
| Bridge Telegram (Sprint 82) | 42 | 42 | 0 |
| Remote Shell + Copilot CLI (Sprint 83) | 42 | 0 | 42 |
| **TOTAL** | **278** | **210** | **68** |

### 5.1 Team Agent Routing Manual Tests (Sprint 74)

| ID | Test Case | Tier | Expected | Status |
|----|-----------|------|----------|--------|
| MT-74-01 | `@planning "plan auth"` routes to PM with team context | STANDARD | PM SOUL + Team Context section | PASS |
| MT-74-02 | `@dev "implement login"` routes to Coder with team context | STANDARD | Coder SOUL + teammates | PASS |
| MT-74-03 | `@qa "review PR"` routes to Reviewer (sole member) | STANDARD | Reviewer SOUL + sole member msg | PASS |
| MT-74-04 | `@pm "plan"` routes directly (agent-first, no team) | STANDARD | PM SOUL, isTeam=false | PASS |
| MT-74-05 | `@design "wireframes"` routes to Architect | PRO | Architect SOUL + pm,coder teammates | PASS |
| MT-74-06 | `@ops "deploy"` fails in STANDARD, works in ENT | STD→ENT | Error → DevOps SOUL | PASS |
| MT-74-07 | `@executive "review"` → CTO(PRO) vs CEO(ENT) | PRO/ENT | Tier-dependent leader | PASS |
| MT-74-08 | setTier LITE→STANDARD enables @planning | LITE→STD | Fail → Success | PASS |

**Executed:** 2026-03-03 | **Script:** `tests/manual/mt-74-team-routing.mjs` | **Result:** 8/8 PASS

### 5.2 Dyad Repo Manual Tests (STANDARD tier)

| ID | Test Case | Expected | Status |
|----|-----------|----------|--------|
| MT-D01 | `@planning "plan payment"` → PM with Planning Team context | PM SOUL + ## Team Context | PASS |
| MT-D02 | `@dev "implement auth"` → Coder with teammates + delegation | Coder SOUL + ### Teammates | PASS |
| MT-D03 | `@qa "review PR"` → Reviewer (sole member) | Reviewer SOUL + sole member msg | PASS |
| MT-D04 | `@pm "plan sprint"` → PM direct (agent-first, no team) | PM SOUL, isTeam=false | PASS |
| MT-D05 | `@coder "fix bug"` → Coder direct (agent-first) | Coder SOUL, isTeam=false | PASS |
| MT-D06 | `@ops "deploy"` fails in STANDARD | INVALID_MENTION error | PASS |
| MT-D07 | `@design "wireframes"` fails in STANDARD | INVALID_MENTION error | PASS |
| MT-D08 | `@architect "design schema"` → Architect direct | Architect SOUL, isTeam=false | PASS |
| MT-D09 | SOUL enrichment: charter + leader + delegation present | All 3 sections in SOUL | PASS |
| MT-D10 | Task classification works for team routes | taskType, complexity, model set | PASS |
| MT-D11 | STANDARD tier has exactly 3 teams (planning, dev, qa) | 3 teams | PASS |
| MT-D12 | Warnings propagated for unknown agents in combo | Warning includes agent name | PASS |

**Executed:** 2026-03-03 | **Script:** `tests/manual/mt-74-dyad-manual.mjs` | **Result:** 12/12 PASS

### 5.3 OTT Channel Enhancement Manual Tests (Sprint 76)

**Authority:** ADR-019 OTT Channel Enhancement

| Phase | Tests | Description |
|-------|-------|-------------|
| Commands (18) | MT-76-01..18 | 10 new commands: /agents, /teams, /gate, /compliance, /fix, /consult, /config, /init, /mode, /webhook |
| Help (3) | MT-76-19..21 | 14 commands listed, 4 categories, agent/team format |
| Agent Keyboard (6) | MT-76-22..27 | 12 agents (STANDARD), 9 (LITE), 3/row, icons, 64-byte limit |
| Team Keyboard (6) | MT-76-28..33 | LITE(1), STANDARD(3), PRO(5), ENT(6), 2/row, callbacks |
| Mode Confirm (2) | MT-76-34..35 | Confirm/cancel buttons, request ID |
| Handoff 64-byte (2) | MT-76-36..37 | Short + long intent within 64 bytes (CTO B3) |
| Callback Parsing (4) | MT-76-38..41 | agent_select, team_select, mode confirm/cancel |
| Team via OTT (6) | MT-76-42..47 | hasMention + parseMention with registry, tier check |
| Response Formatter (2) | MT-76-48..49 | formatAgentNotFound (12+7), formatProcessing |
| Webhook Handler (4) | MT-76-50..53 | Constructor, dispose, cleanup, missing secret warning |
| Zalo MAC (2) | MT-76-54..55 | HMAC-SHA256 deterministic, mac= prefix normalization |
| i18n (2) | MT-76-56..57 | 25 EN keys, 25 VI matching keys |
| PATCH Mode (3) | MT-76-58..60 | Detection, case-insensitive, non-match |
| Timeout Config (3) | MT-76-61..63 | Default 300s, NaN fallback, valid override |
| **Total** | **63** | **All Sprint 76 acceptance criteria** |

**Executed:** 2026-03-04 | **Script:** `tests/manual/mt-76-ott-enhancement.mjs` | **Result:** 63/63 PASS

### 5.4 Zalo Bot Live Tests (Sprint 77)

| Phase | Tests | Description |
|-------|-------|-------------|
| Zalo API (7) | MT-76-Z01..07 | getMe, sendMessage, long msg, unicode, getWebhookInfo, channel interface, getUpdates |
| Zalo Commands (10) | MT-77-T1..10 | /help, /agents, /gate, /teams, /compliance, /fix, /consult, /config, /init, /approve |
| **Total** | **17** | **Require live Zalo API + ZALO_BOT_TOKEN env** |

**Status:** PENDING — requires live Zalo OA bot token (`.env.local` with `ZALO_BOT_TOKEN`, `ZALO_BOT_CHAT_ID`)
**Scripts:** `tests/manual/mt-76-zalo-bot.mjs` | `tests/manual/mt-77-zalo-commands.mjs`

### 5.5 Smart Init Manual Tests (Sprint 79)

**Authority:** ADR-022 Smart Init Codebase Analysis

| Phase | Tests | Description |
|-------|-------|-------------|
| Phase 1: open-pencil full analysis (17) | MT-79-01..17 | Init STANDARD tier on real repo, spinner, IDENTITY.md/CLAUDE.md/.sdlc-config.json validation |
| Phase 2: --skip-analysis (6) | MT-79-18..23 | Generic fallback, no Tech Stack section, pnpm commands |
| Phase 3: bun.lock text format (3) | MT-79-24..26 | Bun 1.2+ `bun.lock` detected as bun |
| Phase 4: Tauri 2 detection (3) | MT-79-27..29 | @tauri-apps/api → desktop: "Tauri 2" |
| Phase 5: Vue/Vite enrichment (3) | MT-79-30..32 | Vue + Vite → "Vue/Vite" not just "Vue" |
| Phase 6: Empty project graceful failure (3) | MT-79-33..35 | No crash, IDENTITY.md created, generic output |
| **Total** | **35** | **All Sprint 79 acceptance criteria** |

**Executed:** 2026-03-05 | **Script:** `tests/manual/mt-79-smart-init.mjs` | **Result:** 35/35 PASS

### 5.6 SDLC Content Quality Manual Tests (Sprint 80)

**Authority:** ADR-023 SDLC-Aligned Content Quality

| Phase | Tests | Description |
|-------|-------|-------------|
| Phase 1: Gate-Artifact-Tier Matrix (7) | MT-80-01..07 | GATE_ARTIFACT_REQUIREMENTS, 7 gates, findGateRequirement, findArtifactSpec, TIER_COVERAGE_TARGETS, CTO C4 |
| Phase 2: Quality Validation (4) | MT-80-08..11 | validateContentQuality: missing YAML, missing BDD, below minLines, passes |
| Phase 3: extractKeyContent (3) | MT-80-12..14 | YAML preservation, heading preservation, maxChars limit |
| Phase 4: OTT /gate Fix (3) | MT-80-15..17 | gate recommend reference, no gate check, sanitizeForEcho |
| Phase 5: Gate Engine (3) | MT-80-18..20 | G-Sprint path, gate:G3 checker, command: checkers |
| Phase 6: open-pencil Audit (8) | MT-80-21..28 | requirements.md/architecture.md existence, YAML, gate refs, line count, quality scores |
| Phase 7: compliance score (2) | MT-80-29..30 | CLI exits clean, score percentage in output |
| Phase 8: compliance fix --dry-run (3) | MT-80-31..33 | CLI exits clean, DRY-RUN mode, issue summary |
| Phase 9: gate status (1) | MT-80-34 | CLI gate status runs |
| **Total** | **34** | **All Sprint 80 acceptance criteria** |

**Quality Audit Results (open-pencil, Phase 1 docs):**

| Document | Lines | Score | Key Issues |
|----------|-------|-------|------------|
| requirements.md | 62 | 40/100 | Missing BDD, missing References, below 120 min lines |
| architecture.md | 30 | 40/100 | Missing YAML frontmatter, missing References, below 120 min lines |

> These scores reflect Phase 1 (Sprint 80 Steps 1-5) generated docs. Phase 2 gate-driven prompts + refinement loop will improve quality on next `compliance fix` re-run.

**Executed:** 2026-03-06 | **Script:** `tests/manual/mt-80-content-quality.mjs` | **Result:** 34/34 PASS

### 5.7 Remote Shell + Copilot CLI Manual Tests (Sprint 83)

**Authority:** ADR-024 D4/D5 Managed Shell Sessions

| Phase | Tests | Description |
|-------|-------|-------------|
| Phase 1: Repo Context (8) | MT-83-01..08 | /repos add/list/remove, /focus, /where, no-focus message, path validation |
| Phase 2: Shell Allowlist Security (10) | MT-83-09..18 | Allowed commands, metacharacter bypass (MF-1), pipe validation, path blocks |
| Phase 3: /sh Read-Only Shell (6) | MT-83-19..24 | git status, ls, grep, blocked cmd redirect to /run, redacted output |
| Phase 4: /attach Capture (3) | MT-83-25..27 | Capture output, no-session error, line count param |
| Phase 5: /run Approval Gate (8) | MT-83-28..35 | Approval request, full command display (W-3), /approve exec, /reject, audit |
| Phase 6: Copilot CLI (4) | MT-83-36..39 | /cp status, /cp suggest (no-focus), detect() runtime, ANSI stripping |
| Phase 7: Security Invariants (3) | MT-83-40..42 | buildCleanEnv, actor identity guard, audit trail completeness |
| **Total** | **42** | **All Sprint 83 acceptance criteria** |

**Status:** PENDING — requires `pnpm build` + manual execution
**Script:** `tests/manual/mt-83-remote-shell.mjs`

---

## 6. Performance Tests

### 6.1 Measured Performance (Sprint 68-72)

| Module | Target | Actual | Status |
|--------|--------|--------|--------|
| SDLC Compliance full scan | < 3s | < 50ms | PASS |
| AER Calculator (32 tests) | < 1s | 254ms | PASS |
| ModelSelector (31 tests) | < 100ms | 22ms | PASS |
| SessionBudget (40 tests) | < 100ms | 38ms | PASS |
| Golden Scenarios (49 tests) | < 1s | 29ms | PASS |
| AutonomousManager (32 tests) | < 30s | 10.5s | PASS |
| State Machine (36 tests) | < 500ms | 113ms | PASS |
| Team Registry (44 tests) | < 500ms | 12ms | PASS |
| Mention Parser Teams (28 tests) | < 100ms | 4ms | PASS |
| Agent Router Teams (27 tests) | < 500ms | 19ms | PASS |
| All Orchestrator (119 tests) | < 1s | 38ms | PASS |

---

## 7. Compliance Tests

### 7.1 SDLC Compliance - Sprint 68

- File compliance (CLAUDE.md, IDENTITY.md, AGENTS.md)
- Stage compliance (7 stages for STANDARD tier)
- Tier detection (LITE, STANDARD, PROFESSIONAL, ENTERPRISE)
- Stage contracts (10 default contracts with glob matching)
- Compliance dashboard (scoring 0-100, multi-format reports)

**Status:** 100% compliance verified

### 7.2 Code Quality

- TypeScript strict mode with exactOptionalPropertyTypes
- ESLint configured
- Zero Mock Policy compliance
- Factory pattern with reset functions

---

## 8. Regression Tests

### 8.1 Automated Regression Suite

**Baseline:** 6,349 tests passing (Sprint 102)

**Regression Gate:**
- BLOCK if > 5% tests fail
- WARN if > 1% tests fail
- PASS if <= 1% tests fail

**Current:** 0/6,349 = 0% (0 failing, 10 skipped)

### 8.2 Sprint-Specific Regression

| Sprint | New Tests | Regression | Status |
|--------|-----------|------------|--------|
| 68 | 102 | 0 regressions | PASS |
| 69-71 | 112 | 0 regressions | PASS |
| 72 | 184 | 0 regressions | PASS |
| 73 | 42 | 0 regressions | PASS |
| 74 | 99 | 0 regressions | PASS |
| 75 | 41 | 0 regressions | PASS |
| 76 | 68 | 0 regressions | PASS |
| 77 | 153 | 0 regressions | PASS |
| 78 | 70 | 0 regressions | PASS |
| 79 | 31 | 0 regressions | PASS |
| 80 | 27 | 0 regressions | PASS |
| 82 | 73 | 0 regressions | PASS |
| 82.5 | 27 | 0 regressions | PASS |
| 83 | 156 | 0 regressions | PASS |
| 84 | 21 | 0 regressions | PASS |
| 85 | 41 | 0 regressions | PASS |
| 86 | 32 | 0 regressions | PASS |
| 87 | 31 | 0 regressions | PASS |
| 88 | 37 | 0 regressions | PASS |
| 89 | 20 | 0 regressions | PASS |
| 90 | 23 | 0 regressions | PASS |
| 91 | 30 | 0 regressions | PASS |
| 92 | 21 | 0 regressions | PASS |
| 93 | 37 | 0 regressions | PASS |
| 94 | 48 | 0 regressions | PASS |
| 95 | 59 | 0 regressions | PASS |
| 96 | 85 | 0 regressions | PASS |
| 97 | 78 | 0 regressions | PASS |
| 98 | 106 | 0 regressions | PASS |
| 99 | 24 | 0 regressions | PASS |
| 100 | 29 | 0 regressions | PASS |
| 101 | 33 | 0 regressions | PASS |
| 102 | 0 (+5 updated) | 0 regressions | PASS |
| 145 | 7 new, 2 updated | 0 regressions | PASS |

---

## 9. Test Metrics & KPIs

### 9.1 Current Metrics (Post-Sprint 145)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total tests | 8,137+ | - | - |
| Pass rate | 99.9% | > 99% | ON TARGET |
| Tech debt tests | 1 failing (infra) | < 20 | EXCELLENT |
| Flaky tests | 0 | 0 | RESOLVED |
| New tests (Sprint 68-145) | 3,788+ | - | +87% growth |
| Manual tests | 278 (210 passing, 68 pending) | - | +42 Sprint 82, +42 Sprint 83 |

### 9.2 Coverage by Module

| Module | Tests | Coverage |
|--------|-------|----------|
| Providers | ~3,507 | ~95% |
| Security | 6 | ~95% | SSRF defense (Sprint 145) |
| SDLC | 360 | ~98% |
| Sessions | 154 | ~95% |
| Metrics | 32 | ~98% |
| Models | 71 | ~98% |
| Golden Scenarios | 49 | ~90% |
| Search | 176 | ~95% |
| Context | 97 | ~98% |
| Orchestrator (Teams) | 119 | ~98% |
| OTT Channels | 68 | ~95% |
| Zalo Channel | 153 | ~95% |
| Local Router + Conversation | 70 | ~90% |
| Smart Init (Compliance) | 31 | ~98% |
| Bridge Core (Sprint 82-83) | 256 | ~95% |
| Bridge Intelligence (Sprint 84-89) | 163 | ~95% |
| Bridge Hooks (Sprint 85) | 41 | ~95% |
| Bridge Teams (Sprint 90-91) | 53 | ~95% |
| Bridge Launcher (Sprint 92) | 21 | ~95% |
| Shared Commands (Sprint 86-91, 102) | 68 | ~95% |
| Other (budget, config, etc.) | ~200 | ~85% |

---

## 10. Bug Tracking

### 10.1 Current Known Issues

| ID | Description | Severity | Sprint | Status |
|----|-------------|----------|--------|--------|
| BUG-002 | ripgrep binary not found | P2 | 63 | WORKAROUND |
| BUG-012 | checkpoint.test.ts:462 flaky (resume from checkpoint) | P3 | 35-40 | KNOWN FLAKY |
| BUG-013 | OTT detection `includes(":]")` should be `includes("]")` | P2 | 74 | FIXED |
| BUG-014 | 16 gateway WebSocket test files fail (server response 400) | P3 | 93+ | KNOWN (infra) |
| BUG-015 | `gateway/server.test.ts` EADDRINUSE on port 18797 (intermittent port collision) | P3 | 145 | KNOWN (infra) |

### 10.2 Resolved Issues

| ID | Description | Sprint Fixed |
|----|-------------|-------------|
| BUG-001 | workflow.test.ts failures | Sprint 72 (tests rewritten to match multi-workflow API) |
| BUG-003 | active.json not persisted | Sprint 65 |
| BUG-004 | RgProvider file type error | Sprint 65 |
| BUG-005 | agent-loop.test.ts stale tests | Sprint 72 (tests rewritten to match ParseResult API) |
| BUG-006 | cli-smoke status command | Sprint 72 (fixed test ordering assertion) |
| BUG-007 | init treats path argument as project-name | E2E Dyad (path redirected to --path in action) |
| BUG-008 | compliance ignores active project | E2E Dyad (loadActiveProject() fallback added) |
| BUG-009 | gate status shows all gates empty for fresh project | E2E Dyad (progress-aware display with GateEngine eval) |
| BUG-011 | CLI session mode issue | Sprint 73 (L2 Compliance fix) |
| BUG-013 | OTT parser `includes(":]")` misses valid OTT tags | Sprint 74 (fixed to `includes("]")`) |

---

## 11. Test Documentation

### 11.1 Test Plans

- [Master Test Plan](./MASTER-TEST-PLAN.md) (this file)
- [Manual Test Plan](./manual-test-plan.md)
- [Dogfooding Test Plan](./DOGFOODING-TEST-PLAN.md)
- [TP-061 Init Command](./test-plans/TP-061-Init-Command.md)
- [TP-062 Restructure Compliance](./test-plans/TP-062-Restructure-Compliance.md)
- ADR-017 Team Agent System (Sprint 74 design authority)
- ADR-018 AI-Generated Compliance Content (Sprint 75 design authority)
- ADR-019 OTT Channel Enhancement (Sprint 76 design authority)
- ADR-020 OTT Channel Completion / Zalo (Sprint 77 design authority)
- ADR-021 Local Ollama Router (Sprint 78 design authority)
- ADR-022 Smart Init Codebase Analysis (Sprint 79 design authority)
- ADR-023 SDLC-Aligned Content Quality (Sprint 80 design authority)
- ADR-024 Notification Bridge (Sprint 82-86, 92 design authority)
- ADR-025 Session Intelligence Envelope (Sprint 84, 87-88 design authority)
- ADR-026 Agent Teams (Sprint 89-91 design authority)
- ADR-027 Cross-Session Context Transfer (Sprint 96 design authority)
- ADR-028 Progressive Trust T3 (Sprint 97 design authority)
- ADR-029 Per-Chat Workspace + Unified Channel (Sprint 99 design authority)
- ADR-030 Unified Command Architecture (Sprint 102 design authority)
- ADR-053 Kimi Coding API Direct Integration (Sprint 145 design authority)

### 11.2 Test Reports

- [E2E API Report 2026-02-27](./07-E2E-Testing/reports/E2E-API-REPORT-2026-02-27.md)
- [E2E Sprint 72 Report 2026-03-02](./07-E2E-Testing/reports/E2E-SPRINT-72-REPORT-2026-03-02.md)
- [Test Report 2026-03-01](./test-reports/test-report-2026-03-01.md)

---

## 12. Next Steps

### Completed Actions (Post-Sprint 92)

1. ~~Fix BUG-006: cli-smoke status command~~ DONE
2. ~~Fix tech debt tests (BUG-001, BUG-005)~~ DONE (61 tests rewritten)
3. ~~Implement Team Agent System tests (Sprint 74)~~ DONE (99 tests)
4. ~~Execute MT-74-01 through MT-74-08 manual tests~~ DONE (20/20 PASS)
5. ~~Sprint 75: Compliance Fix Engine tests~~ DONE (41 tests)
6. ~~Sprint 76: OTT Channel Enhancement tests~~ DONE (68 unit + 63 manual)
7. ~~Sprint 76: CTO review fixes (B1-B3, P0-1 through P0-4)~~ DONE
8. ~~Sprint 77: Zalo Channel 153 unit tests~~ DONE
9. ~~Sprint 78: Local Ollama Router + ConversationStore 70 tests~~ DONE
10. ~~Sprint 79: Smart Init 31 unit + 35 manual tests (35/35 PASS)~~ DONE
11. ~~Sprint 80: SDLC Content Quality 27 unit + 34 manual tests (34/34 PASS)~~ DONE
12. ~~Sprint 82: Notification Bridge Core 73 unit tests~~ DONE
13. ~~Sprint 82.5: Bridge Telegram Wiring 27 unit tests~~ DONE
14. ~~Sprint 82: Manual Tests 42/42 PASS~~ DONE
15. ~~Sprint 83: Remote Shell + Copilot CLI 156 unit tests + CTO MF fixes~~ DONE
16. ~~Sprint 84: SOUL Bridge — 21 tests (agent installer + soul loader + envelope)~~ DONE
17. ~~Sprint 85: Permission Approval — 41 tests (hook verifier/handler/relay/installer)~~ DONE
18. ~~Sprint 86: /send Command + Turn Context — 32 tests~~ DONE
19. ~~Sprint 87: Brain L4 + Context Anchoring — 31 tests~~ DONE
20. ~~Sprint 88: Evaluator + Vibecoding — 37 tests~~ DONE
21. ~~Sprint 89: Agent Teams Files — 20 tests (team-installer)~~ DONE
22. ~~Sprint 90: Agent Teams Telegram — 23 tests (complexity-gate + team commands)~~ DONE
23. ~~Sprint 91: Team Monitoring — 30 tests (team-monitor + monitoring commands)~~ DONE
24. ~~Sprint 92: Unified Launcher — 21 tests (lock-manager + process-monitor + unified-launcher)~~ DONE
25. ~~Sprint 93: Gateway-Centric Unified App — 37 tests~~ DONE
26. ~~Sprint 94: Canonical Types + Channel Policy — 48 tests~~ DONE
27. ~~Sprint 95: Progressive Autonomy T2 — 59 tests~~ DONE
28. ~~Sprint 96: Cross-Session Context Transfer — 85 tests~~ DONE
29. ~~Sprint 97: Progressive Trust T3 — 78 tests~~ DONE
30. ~~Sprint 98: Code-Design Gap Closure — 106 tests~~ DONE
31. ~~Sprint 99: Per-Chat Workspace + Unified Channel — 24 tests~~ DONE
32. ~~Sprint 100: SASE 6.1.2 Full Alignment — 29 tests~~ DONE
33. ~~Sprint 101: Tier-Aware Routing + ClawVault Memory — 33 tests~~ DONE
34. ~~Sprint 102: Unified Command Architecture — 5 tests updated (ADR-030)~~ DONE
35. ~~Sprint 145: Kimi Coding API Direct Integration — 7 new + 2 updated + 6 SSRF tests~~ DONE

### Short-term (Sprint 145+)

1. **Kimi Coding live integration test** — 1 round-trip call to `https://api.kimi.com/coding/v1` with real `KIMI_API_KEY` (G2 evidence)
2. **Kimi Coding fallback chain E2E** — verify `kimi-coding` → `kimi-api` → `claude-code` fallback under simulated failures
3. Zalo webhook live E2E test (requires Zalo OA sandbox — 17 tests pending)
4. Investigate BUG-012 (checkpoint.test.ts flaky)
5. Bridge live E2E: `/sh git status` on running server with real tmux
6. Bridge live E2E: `/run npm test` approval flow end-to-end
7. Launcher live E2E: `endiorbot bridge launcher start` with real tmux sessions
8. Team live E2E: full team launch + health monitoring + cost tracking flow

### Long-term

1. Mutation testing for critical paths (bridge security modules)
2. CI/CD pipeline integration
3. Load testing with large codebases
4. External user acceptance testing
5. Webhook stress testing (rate limit + concurrent connections)
6. Bridge stress testing: concurrent shell sessions + queue overflow
7. Launcher stress testing: concurrent crash recovery + restart cap validation

---

## Appendix A: Test Commands

```bash
# Run all tests
pnpm test

# Run Sprint 92 Unified Launcher
pnpm vitest run tests/bridge/launcher/

# Run Sprint 91 Team Monitoring
pnpm vitest run tests/bridge/teams/ tests/channels/telegram/team-monitoring.test.ts

# Run Sprint 90 Agent Teams Telegram
pnpm vitest run tests/channels/telegram/team-launch.test.ts tests/channels/telegram/team-display.test.ts tests/bridge/intelligence/complexity-gate.test.ts

# Run Sprint 89 Agent Teams Files
pnpm vitest run tests/bridge/intelligence/team-installer.test.ts

# Run Sprint 88 Evaluator + Vibecoding
pnpm vitest run tests/bridge/intelligence/output-evaluator.test.ts tests/bridge/intelligence/evaluation-store.test.ts

# Run Sprint 87 Brain L4 + Context
pnpm vitest run tests/bridge/intelligence/brain-loader.test.ts tests/bridge/intelligence/context-builder.test.ts tests/bridge/intelligence/envelope-builder.test.ts

# Run Sprint 86 /send Command + Turn Context
pnpm vitest run tests/channels/telegram/send-command.test.ts tests/bridge/intelligence/turn-context.test.ts

# Run Sprint 85 Permission Approval
pnpm vitest run tests/bridge/hooks/

# Run Sprint 84 SOUL Bridge
pnpm vitest run tests/bridge/agent-launcher.soul.test.ts tests/agents/channel-router.soul-loader.test.ts

# Run Sprint 83 Remote Shell + Copilot CLI
pnpm vitest run tests/bridge/repo/ tests/bridge/copilot/ tests/bridge/shell/ tests/channels/telegram/remote-commands.test.ts

# Run Sprint 83 Manual Tests (42 tests)
node tests/manual/mt-83-remote-shell.mjs

# Run Sprint 145 Kimi Coding Provider
pnpm vitest run tests/providers/kimi-coding/ tests/budget/pricing-registry.test.ts tests/budget/cost-estimator.test.ts

# Run Sprint 102 Unified Command Architecture (affected tests)
pnpm vitest run tests/commands/command-dispatcher.test.ts tests/channels/ott/ott-enhancement.test.ts tests/channels/zalo/zalo-commands.test.ts tests/integration/telegram-ott-complete-flow.test.ts tests/channels/telegram/team-launch.test.ts tests/channels/telegram/team-monitoring.test.ts

# Run Sprint 82 Bridge Core
pnpm vitest run tests/bridge/

# Run Sprint 82 Manual Tests (42 tests)
node tests/manual/mt-82-bridge-telegram.mjs

# Run Sprint 80 SDLC Content Quality
pnpm vitest run tests/sdlc/compliance/content-generator.test.ts tests/sdlc/gates/gate-engine.test.ts

# Run Sprint 80 Manual Tests (34 tests)
node tests/manual/mt-80-content-quality.mjs

# Run Sprint 79 Smart Init
pnpm vitest run tests/sdlc/compliance/project-context-collector.test.ts tests/sdlc/scaffold/templates.test.ts tests/sdlc/scaffold/structure-generator.test.ts

# Run Sprint 79 Manual Tests (35 tests)
node tests/manual/mt-79-smart-init.mjs

# Run Sprint 77 Zalo Channel
pnpm vitest run tests/channels/zalo/

# Run Sprint 78 Local Router + Conversation
pnpm vitest run tests/agents/routing/local-router.test.ts tests/channels/conversation/

# Run Sprint 94 Canonical Types + Channel Policy Engine
pnpm vitest run tests/protocol/ tests/policy/ tests/commands/approve-reject.test.ts tests/monitoring/health-enhanced.test.ts tests/integration/canonical-flow.test.ts

# Run Sprint 93 Gateway-Centric Unified App
pnpm vitest run tests/commands/command-dispatcher.test.ts tests/gateway/ingress.test.ts tests/gateway/methods/bridge-commands.test.ts tests/channels/telegram/telegram-ott-adapter.test.ts tests/cli/serve-command.test.ts

# Run Sprint 76 OTT Channel Enhancement
pnpm vitest run tests/channels/ott/ott-enhancement.test.ts

# Run Sprint 76 Manual Tests (63 tests)
node tests/manual/mt-76-ott-enhancement.mjs

# Run Sprint 75 Compliance Fix
pnpm vitest run tests/sdlc/compliance-fix.test.ts

# Run Sprint 74 Team Agent System
pnpm vitest run tests/agents/orchestrator/

# Run Sprint 74 Manual Tests
node tests/manual/mt-74-team-routing.mjs
node tests/manual/mt-74-dyad-manual.mjs

# Run Sprint 72 modules
pnpm test src/metrics/__tests__ src/models/__tests__ tests/golden-scenarios/__tests__

# Run SDLC Compliance
pnpm test tests/sdlc/ src/sdlc/__tests__

# Run with coverage
pnpm test --coverage
```

---

## Appendix B: Sprint Test History

| Sprint | New Tests | Cumulative | Pass Rate |
|--------|-----------|------------|-----------|
| 61-62 | 172 | ~4,000 | 98.5% |
| 63-64 | 176 | ~4,078 | 98.5% |
| 65 | 171 | ~4,112 | 98.5% |
| 66-67 | 0 (SKIPPED) | ~4,112 | 98.5% |
| 68 | 102 | ~4,214 | 98.5% |
| 69-71 | 112 | ~4,326 | 98.6% |
| 72 | 184 | ~4,530 | 98.7% |
| 72-fix | +61 fixed | 4,602 | 99.8% |
| 73 | 42 | 4,644 | 99.8% |
| 74 | 99 | 4,754 | 99.8% |
| 75 | 41 | 4,795 | 99.8% |
| 76 | 68 | 4,863 | 99.8% |
| 77 | 153 | 5,016 | 99.8% |
| 78 | 70 | 5,086 | 99.8% |
| 79 | 31 | 5,117 | 99.8% |
| 80 | 27 | 5,155 | 99.8% |
| 82 | 73 | 5,228 | 99.8% |
| 82.5 | 27 | 5,255 | 99.8% |
| 83 | 156 | 5,411 | 99.8% |
| 83-MF | +128 (fixes) | 5,539 | 99.8% |
| 84 | 21 | 5,560 | 99.8% |
| 85 | 41 | 5,601 | 99.8% |
| 86 | 32 | 5,633 | 99.8% |
| 87 | 31 | 5,664 | 99.8% |
| 88 | 37 | 5,701 | 99.8% |
| 89 | 20 | 5,721 | 99.8% |
| 90 | 23 | 5,744 | 99.8% |
| 91 | 30 | 5,774 | 99.8% |
| 92 | 21 | 5,795 | 99.8% |
| 93 | 37 | 5,887 | 99.8% |
| 94 | 48 | 5,935 | 100% |
| 95 | 59 | 5,994 | 100% |
| 96 | 85 | 6,079 | 100% |
| 97 | 78 | 6,157 | 100% |
| 98 | 106 | 6,263 | 100% |
| 145 | 13 new + 2 updated | 6,270 | 99.9% |

---

*Master Test Plan v18.1 | SDLC Framework v6.4.0 | Sprint 145*
