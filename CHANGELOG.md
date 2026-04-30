# Changelog

All notable changes to EndiorBot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
