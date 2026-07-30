# Changelog

All notable changes to EndiorBot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [v0.1.0-beta.6] - 2026-07-30

### Added — Model Upgrade + SE4A Spike (Sprint 160)
- **Claude 5 family** — `claude-opus-5` ($5/$25), `claude-sonnet-5` ($3/$15), `claude-fable-5` ($10/$50), all 1M context; Haiku unchanged. Legacy dated IDs retained for persisted checkpoints/sessions.
- **Kimi K3** — `kimi-k3` (1M ctx) + `kimi-k3-256k` now default for the Kimi provider; `kimi-k2-6`/`moonshot-v1-*` demoted to legacy compat.
- **SE4A coordinator spike** (`src/autonomy/se4a-coordinator.ts`) — federated-workflow pipeline DEFINE→DISPATCH→EXECUTE→REVIEW→GATE for the `feature-development` template. CLI: `endiorbot workflow se4a feature-development --feature "..."`.
- **Objective GATE** — runs the project test command and reads the exit code (exit-0 = pass; non-zero/unreadable = FAIL; never fake-green). Governance invariants (gate-authority, verify-not-producer, evidence-first) recorded with cited source version.

### Changed
- **True SSOT** — every model ID string centralized as named constants in `src/config/models.ts`; 12 consumer files import from there (was 11 hardcoded drift points).
- **Conservative pricing proxy** — unpriced models cost at the highest known tier ($10/$50) with a loud warning instead of a silent $0/Sonnet fallback (budget-guard no longer blind).
- `getModelTier` + `ModelUsageBreakdown` gain a `fable` tier.

### Fixed
- Anthropic provider healthcheck used an invalid `claude-haiku-4` model ID → now the real Haiku SSOT constant.

## [v0.1.0-beta.5] - 2026-07-04

### Added — ST/DT Content Gates (Sprint 157-158)
- **`contains:` content-checker primitive** (C-0) — new gate-engine checker: `contains:<glob>:<needle>`. Glob-matches files, verifies at least one contains the required string. Reusable for any content gate.
- **`g2-requirements-trace`** (C-1) — G2 requires at least one ADR to reference `docs/01-planning/requirements`. Enforced STANDARD+ tier.
- **`g2-iceberg` content gate** — G2 requires `## Iceberg Analysis` in at least one ADR (System Thinking enforcement). STANDARD+ tier.
- **`g2-alternatives` content gate** — G2 requires `## Alternatives Considered` in at least one ADR (Design Thinking enforcement). STANDARD+ tier.
- **SOUL-architect Pre-G2 block** (C-2) — behavioral mandate: Iceberg 4-layer + DT traceability before proposing G2.
- **Gate nomenclature mapping** (C-3) — `docs/02-design/README.md` maps EndiorBot gates ↔ Framework DT gates.
- **PREAMBLE MM#9** — Mental Models count 8→9, added Demand Before Surface.
- **AGENTS.md template** — scaffold includes 9 MMs + G2 content gates note.

### Changed
- G2 gate: 5→8 checklist items (3 new content checks)
- ADR-004 backfilled with `## Iceberg Analysis` (dogfood exemplar)
- PREAMBLE G2 enforcement note for agents

### Stats
- 8,228+ tests passing (7 new gate-engine tests across Sprint 157-158)
- G2 dogfood: all auto-checks green on EndiorBot repo
- Build: clean, 0 errors

## [v0.1.0-beta.4] - 2026-07-04

### Added — SDLC 6.4.0 Alignment + Agent Upgrades (Sprint 156)
- **SDLC Framework 6.4.0 alignment** — 257 files bumped from 6.3.1 → 6.4.0 (Amendment C, Drift-Lessons Absorb). Convention A applied: historical test artifacts kept at original version (honest staleness > inflated freshness).
- **Agent PATCH mode default** — SDLC agents now default to PATCH mode (was READ). Agents can write files via Edit tool without explicit `--patch` flag. New `--read` flag for read-only mode.
- **Auto-approve flag** (`--yes` / `-y`) — PATCH mode auto-approves without diff/confirm cycle when `--yes` or non-TTY. Enables background agent pipelines (SE4A workflow).
- **PM fallback for unavailable package managers** — `isPmAvailable()` checks if detected PM (e.g. bun) exists on PATH; falls back to npm if not. Prevents bootstrap failures on machines without exotic PMs.
- **pnpm non-TTY fix** — `confirmModulesPurge: false` in `pnpm-workspace.yaml` prevents interactive prompt in CI/background contexts.

### Added — CEO Directive: Federated-SDLC Autonomous Agent-Team (Sprint 156 cont.)
- **Honest-ceiling clause (P0 safety valve)** — Anti-confabulation rule in PREAMBLE: agents MUST NOT claim gates pass without running programmatic checks. Code-level enforcement: `Evidence.source` field in gate-engine, SE4H-only override guard (SE4A agents blocked with HONEST-CEILING error). 3 new gate-engine tests.
- **2-tier model strategy** — Tier 1 (CC Opus): architect, cso, ceo, pm, cpo, cto. Tier 2 (Kimi Code primary, CC Sonnet fallback): coder, reviewer, tester, fullstack, pjm, researcher, devops, assistant. ADR-052 amended with tier-specific fallback chains.
- **HEARTBEAT autonomous work-driver** — Beat-loop template: pick-next-unblocked-task → classify → execute via TEAM chain → gate-check → cite-path → next beat. Dormant-by-default (safe default). Constrained to sprint-plan tasks (Design-First Gate).
- **TEAM auto-handoff chain** — 4 TEAM handoffs updated to agent-to-agent auto-handoff (planning→design→dev→qa→ops) with honest-ceiling coupling at each gate transition. G4 = human-only boundary.
- **Progressive-trust auto-gate** — G-Sprint/G0.1/G1/G2/G3 auto-approve with programmatic evidence. G4 + external = SE4H-human only (ADR-028 T3).

### Changed
- SDLC Framework version 6.3.1 → 6.4.0 across entire codebase (src/, docs/, tests/, templates, config)
- 14 SOUL Model Fallback Policy sections rewritten (Tier 1: CC Opus, Tier 2: Kimi Code primary)
- 14 SOUL templates frontmatter bumped to `sdlc_framework: "6.4.0"`
- 7 TEAM charters updated: agent-to-agent semantics, honest-ceiling coupling, G4 boundary
- Agent CLI default mode: READ → PATCH
- ADR-052 amended: 3-tier → 2-tier, PM/CPO/CTO promoted to Tier 1, removed openai from fallback chains
- Sprint-99 integration test: version regex relaxed to `6.x` for resilience across future bumps

### Stats
- 8,221+ tests passing (3 new honest-ceiling tests, 2 pre-existing unrelated failures)
- 42 unified commands
- 32 files changed in governance upgrade
- Build: clean, 0 errors

## [v0.1.0-beta.3] - 2026-05-27

### Added — Plugin Architecture (Sprint 149-154)
- **Tier auto-recommendation** (ADR-054) — `endiorbot init` scans 7 project signals (source files, tests, CI/CD, deps, monorepo, team, compliance) and recommends LITE/STANDARD/PRO/ENT. `--tier` is now optional.
- **Layered CLAUDE.md** (ADR-055) — hierarchical generation per directory: LITE root-only, STANDARD root+src/+tests/, PRO +docs/, ENT +per-service. Subdir files <100 lines each.
- **Plugin format scaffold** (ADR-056) — STANDARD+ projects get Anthropic-compatible `.claude-plugin/plugin.json` (Base profile) + seed `commands/` + `skills/` directories.
- **Plugin loader** — `endiorbot skills` discovers and lists `skills/` at runtime. Folder-per-skill (`skills/<name>/SKILL.md`) with flat fallback.
- **CLAUDE.md audit** — `endiorbot audit-claude-md` with 5 checks: stale file references, outdated framework version, root/subdir size, age. Baseline suppression via `--accept`.
- **Self-improving hooks** — `endiorbot init` generates PostToolUse tracker (Write/Edit/NotebookEdit → session temp) and Stop suggest (→ `.endiorbot/audit-suggestions.md`).
- 3 new CLI commands: `skills`, `audit-claude-md`, `plugin migrate-manifest`

### Changed
- `endiorbot init --tier` default removed — auto-recommends from project scan
- SDLC Framework version references bumped 6.3.0 → 6.3.1 (141 files)
- `.claude/settings.json` now registers 3 hooks: PreToolUse + PostToolUse + Stop
- Kimi Proxy replaced with Kimi Coding direct API (Sprint 148, ADR-053)

### Fixed
- Framework version 6.3.0 → 6.3.1 consistency across entire codebase (Sprint 148)
- Report dates corrected for audit trail (Sprint 149-154)

### Stats
- 80 new tests (Sprint 149-154): 8,206+ total
- 42 unified commands (was 39)
- Build: clean, 0 errors

## [v0.1.0-beta.2] - 2026-04-30

### Fixed
- **CI test flake (issue #8)** — `loadLatestHandoff` mtime-tie bug: on fast CI filesystems, sequential writes within the same millisecond produced wrong "newest" file. Fix: keep mtime fast-path, fall back to `createdAt` scan on tie. Aligns with `loadAllHandoffs` semantics.
- **fix-e2e test helper** — `runCli` previously masked signal-killed processes as `exitCode=1`, indistinguishable from real CLI exit-1. Now distinguishes via `signal` + `error` fields. spawnSync timeout 30s → 60s for CI cold-start.
- **CI workflow flag forwarding** — `pnpm test --pool=forks --retry=2` was being intercepted by pnpm. Fixed with `--` separator.
- **CI keytar native module** — added `libsecret-1-dev` system install step (mirrors publish.yml).

### Notes
- Beta channel: `npx endiorbot@beta` or `npx endiorbot@0.1.0-beta.2`
- All v0.1.0-beta.1 features unchanged — this is a CI/test stabilization release.

## [Sprint 145] - 2026-04-27

### Added
- CI/CD pipeline with GitHub Actions (build, test, publish)
- endior.net landing page scaffolded
- SDLC 6.3.1 compliance audit: score raised from 92% to 94%

### Changed
- Dual-launch preparation: SDLC Framework + EndiorBot published as separate artifacts
- Community publish cleanup: `mtclaw` → `mcp-gateway`, `nqh` → `self-hosted`, "CEO Power Tool" → "Solo Developer Power Tool"
- Stage 00-02 docs updated to match actual implementation
- Usage Guide revised with 11 accuracy fixes
- Product Vision rewritten to v3.0

### Security
- Key rotation performed pre-publish (historical credential exposure remediation)

### Fixed
- Desktop IPC handlers, gateway method signatures, Dashboard stats — SDLC gap analysis corrections

## [Sprint 144] - 2026-04-27

### Added
- Gateway PID lockfile (prevents duplicate server processes)
- Circuit breaker for gateway fault isolation
- OTT 60-second timeout guard
- Desktop app: 9 pages, gateway auto-start on launch, API key management UI
- 39 unified commands across 5 channels (Web, Telegram, Zalo, CLI, Desktop)
- HSTS header added to all HTTP responses

### Changed
- Kimi subprocess integration marked deprecated; migration path documented
- Dead code removed (CSO audit)

### Fixed
- Gateway hardening: startup race conditions, stale PID cleanup

## [Sprint 143] - 2026-04-26

### Added
- `gate mark` subcommand for manual gate state transitions
- Brain L2 pattern matching wired into recovery engine
- ADR-052 amendment: CC-first routing policy

### Fixed
- 7 gateway hotfixes from CEO testing session (OTT response formatting, session state, error propagation)

## [Sprint 142] - 2026-04-26

### Added
- Anti-drift improvements: 17 mechanisms across session anchoring and context refresh
- `buildEnrichedPrompt()`: vendor-agnostic enrichment layer for all model providers
- Expert routing Phase 2: domain-aware dispatcher with confidence scoring

## [Sprint 141] - 2026-04-24

### Added
- Cost telemetry: per-request token cost tracking across all providers
- Budget tracker with configurable thresholds and alerts
- Ollama confidence scoring (feature-flag gated, `FF_OLLAMA_CONFIDENCE`)

### Fixed
- Kimi proxy resilience: 429 rate-limit recovery with exponential backoff

## [Sprint 140] - 2026-04-23

### Added
- Kimi k2.6 model integration via proxy
- ADR-052: agent-to-model tier mapping specification
- 3-tier model routing: Opus (architecture) / Sonnet (standard) / Ollama (local/efficiency)

## [Sprint 139] - 2026-04-20

### Added
- ADR-050: OpenMythos evaluator optimization patterns
- Evaluator loop with configurable scoring thresholds and low-score notification hook

## [0.1.0-beta.1] - 2026-03-23

### Added
- GitHub Actions CI pipeline (build + test on Node 20/22)
- GitHub Actions npm publish workflow (on release)
- Dockerfile with multi-stage Alpine build (~150MB)
- Security headers on all HTTP responses (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- HTTP rate limiting (100 req/min per IP, health endpoint exempt)
- MIT LICENSE file
- CONTRIBUTING.md with DCO policy
- SECURITY.md with vulnerability disclosure policy
- EXEC_ALLOWLIST.md documenting all shell execution calls
- GitHub PR template and issue templates (bug report, feature request)
- vitest.e2e.config.ts for integration tests
- npm publishing configuration (files, publishConfig)

### Changed
- FRAMEWORK_VERSION updated from 6.1.1 to 6.2.0
- License changed from UNLICENSED to MIT
- Node.js engine requirement relaxed from >=22 to >=20
- Version bumped from 1.0.0 to 0.1.0-beta.1 (semver-correct for beta)

### Security
- **CRITICAL**: Fixed 14 command injection sites in git-automation.ts — replaced `execSync` template strings with `execFileSync` argument arrays (Sprint 116)
- **CRITICAL**: Fixed 13 additional command injection sites across 6 files — all interpolated `execSync` converted to `execFileSync` with argument arrays (Sprint 118)
- Removed `simulateConsultation()` fake production endpoint — returns 501 (Sprint 116)
- Replaced wildcard CORS (`*`) with configurable origins (Sprint 116)
- Added input sanitization on gateway ingress paths (Sprint 116)
- Extracted RateLimiter from gateway to shared security module — fixed 5 layer violations (Sprint 116)
- Added Zod env validation at serve startup (Sprint 116)

### Fixed
- Gateway WebSocket tests: fixed missing `/ws` path in URLs (Sprint 116)
- Split 2088-line handlers.ts into 8 domain-specific files (Sprint 116)
- Updated .sdlc-config.json gates to reflect actual compliance (G0.1, G1, G2 passed)
- Fixed `sanitizeForEcho` URL stripping — handles markdown links, http(s) and www. URLs (Sprint 118)
- Fixed SOUL version test expectation: 6.1.2 → 6.2.0 (Sprint 118)
- Fixed code-search e2e glob API mismatch: `globs` array → `glob` string (Sprint 118)

## [1.0.0] - 2026-03-22

### Added
- Initial release
- 4-channel support: Web, Telegram, Zalo, CLI
- 13 SOUL-based agents with tier-aware model selection
- 30 unified OTT commands
- SDLC Framework 6.2.0 integration (LITE/STANDARD/PROFESSIONAL/ENTERPRISE)
- Per-chat workspace resolution (ADR-029)
- Claude Code Bridge with tmux session management
- MessageBus with debounce and dedup
- Multi-agent dispatcher with goal decomposition
- 6,500+ tests passing
