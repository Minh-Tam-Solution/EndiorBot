<!-- From: /path/to/endiorbot/AGENTS.md -->
# AGENTS.md - EndiorBot AI Agent Guidelines

## Overview

EndiorBot is a personal AI power tool for solo developers working on enterprise-scale projects.
It is a TypeScript/Node.js application that integrates with Claude Code as an Agent Orchestrator,
enabling `@agent` invocations with SDLC governance across CLI, Web, Telegram, and Zalo channels.

This document defines how AI agents should behave when working within the EndiorBot ecosystem.

## Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Runtime | Node.js >= 20 | ES2022, NodeNext module resolution |
| Language | TypeScript 5.6 | Strict mode, explicit types, no `any` |
| Package Manager | pnpm 9 | Workspace monorepo (`packages: [".", "apps/*"]`) |
| Build | `tsc` | Outputs to `dist/`, declarations + source maps |
| Test Framework | Vitest 2.x | Unit + integration + e2e, v8 coverage, 70% threshold |
| Lint | ESLint 9 + `@typescript-eslint` | Explicit function return types, consistent type imports |
| AI SDKs | `@anthropic-ai/sdk`, OpenAI, Gemini, Ollama | Multi-model orchestration |
| Config Validation | Zod | Runtime schema validation with typed inference |
| Gateway | WebSocket + HTTP hybrid | JSON-RPC 2.0, port 18790 default |
| Desktop App | Electron 40 + React 19 + Vite | In `apps/desktop/` |
| Container | Docker multi-stage (node:20-alpine) | ~150MB production image |

## Project Structure

```
├── src/                    # Main TypeScript source (~40 modules)
│   ├── cli/                # Commander.js entry point
│   ├── commands/           # 35+ unified command handlers (CLI + OTT + Web)
│   ├── agents/             # Agent orchestration, SOUL templates, team registry
│   ├── bridge/             # Claude Code Bridge (tmux, sessions, launcher)
│   ├── bus/                # In-process MessageBus (EventEmitter, debounce, dedup)
│   ├── channels/           # Telegram + Zalo OTT adapters
│   ├── gateway/            # HTTP/WS server, Ingress, Web API, webhooks
│   ├── providers/          # AI model providers + multi-model orchestrator
│   ├── brain/              # 4-layer knowledge storage (Iceberg model)
│   ├── memory/             # ClawVault memory module
│   ├── sessions/           # Session lifecycle, checkpoints, resilience
│   ├── context/            # Context anchoring, sprint goals, spec snapshots
│   ├── sdlc/               # Gate engine, compliance, Vibecoding Index, scaffold
│   ├── security/           # Input sanitizer, output scrubber, SSRF guard, shell guard
│   ├── budget/             # Cost tracking, circuit breakers, escalation, approval queue
│   ├── evaluator/          # Evaluator-Optimizer feedback loop
│   ├── self-correction/    # Error classification + deterministic/AI fixes
│   ├── tools/              # Policy engine, Composio client, tool registry/executor
│   ├── mtclaw/             # MCP cross-system bridge to MTClaw agent platform
│   ├── search/             # ripgrep/ast-grep code search infrastructure
│   ├── errors/             # Unified error hierarchy + formatters
│   ├── logging/            # Structured logging with redaction
│   ├── config/             # Zod-based config, feature flags, timeout SSOT
│   └── utils/              # Type-safe utility library
├── tests/                  # Test suite mirroring src/ structure
│   ├── integration/        # 11 integration test files
│   ├── e2e/                # 2 end-to-end test files
│   ├── golden-scenarios/   # YAML-driven scenario runner
│   ├── security/           # Dedicated security test suite
│   └── performance/        # Performance tests
├── apps/desktop/           # Electron + React desktop application
├── scripts/                # Build helpers, linters, smoke tests
├── docs/                   # SDLC stage-shaped documentation (~328 .md files)
│   ├── 00-foundation/      # WHY — vision, business case
│   ├── 01-planning/        # WHAT — requirements, PRDs
│   ├── 02-design/          # HOW — ADRs, technical specs (50 ADRs)
│   ├── 04-build/           # Coding standards, sprint plans, CLI ref
│   ├── 05-test/            # Test plans, E2E reports
│   ├── 06-deploy/          # Deployment guides, env vars
│   ├── 07-operate/         # Usage guides, monitoring
│   └── 08-collaborate/     # Compliance, handover
├── endiorbot.mjs           # CLI bootstrapper (production vs dev mode detection)
├── package.json            # Root package @dttai/endiorbot
├── tsconfig.json           # TypeScript strict config with path aliases
├── vitest.config.ts        # Unit test config (70% coverage threshold)
├── vitest.e2e.config.ts    # E2E test config
├── eslint.config.js        # Lint rules
├── Dockerfile              # Multi-stage container build
└── .sdlc-config.json       # SDLC framework configuration (tier: STANDARD, current gate: G3)
```

## Path Aliases

TypeScript and Vitest resolve these aliases:

| Alias | Maps to |
|-------|---------|
| `@/*` | `./src/*` |
| `@config/*` | `./src/config/*` |
| `@utils/*` | `./src/utils/*` |
| `@agents/*` | `./src/agents/*` |
| `@security/*` | `./src/security/*` |
| `@sdlc/*` | `./src/sdlc/*` |
| `@providers/*` | `./src/providers/*` |

## Build and Test Commands

```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode development
pnpm dev

# Run unit + integration tests (6,500+ tests)
pnpm test

# Watch mode tests
pnpm test:watch

# Coverage report (v8, 70% threshold)
pnpm test:coverage

# End-to-end tests
pnpm test:e2e

# Security-focused tests
pnpm test:security

# Quality layer tests
pnpm test:quality

# Type check without emit
pnpm typecheck

# Lint
pnpm lint

# Lint with auto-fix
pnpm lint:fix

# Validate SOUL agent templates
pnpm lint:souls

# Clean build artifacts
pnpm clean
```

## Code Style Guidelines

The project enforces strict TypeScript and follows these conventions:

- **TypeScript strict mode** enabled (`strict`, `noImplicitAny`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- **No `any`**: `@typescript-eslint/no-explicit-any` is `error` everywhere except test files.
- **Explicit return types**: `@typescript-eslint/explicit-function-return-type` is `warn`.
- **Consistent type imports**: `@typescript-eslint/consistent-type-imports` is `error`.
- **No floating promises**: `@typescript-eslint/no-floating-promises` is `error`.
- **Prefer `const`**: `prefer-const` and `no-var` are enforced.
- **Strict equality**: `eqeqeq` is `error` (always use `===` / `!==`).
- **Console usage**: `no-console` is `warn` in source files (allow `console.warn` / `console.error`). CLI modules under `src/cli/` are exempt. Non-CLI modules must use the structured `Logger`.
- **File naming**: Use kebab-case for files (e.g., `input-sanitizer.ts`).
- **Barrel exports**: Every `src/` subdirectory has an `index.ts` that carefully selects and often renames exports to avoid symbol collisions.
- **JSDoc**: Public APIs must be documented with JSDoc.
- **Conventional commits**: Use `feat(scope):`, `fix(scope):`, `docs(scope):`, `test(scope):`, `refactor(scope):`.
- **DCO**: Sign commits with `git commit -s`.

### ESLint Overrides

- Test files (`**/*.test.ts`): `no-explicit-any` and `no-console` are off.
- CLI files (`src/cli/**/*.ts`): `no-console` is off (intentional user-facing output).

## Testing Instructions

### Framework: Vitest

- **Unit tests**: `src/**/*.test.ts` and `tests/**/*.test.ts`.
- **Integration tests**: `tests/integration/**/*.test.ts`.
- **E2E tests**: `tests/**/*.e2e.test.ts` and `tests/integration/**/*.test.ts` (via `vitest.e2e.config.ts`).
- **Golden scenarios**: YAML-driven acceptance tests in `tests/golden-scenarios/`.

### Patterns

- Use `vi.fn()` for mocking external dependencies.
- Reset singleton state in `beforeEach` (many modules export `resetXxx()` helpers).
- Group tests with nested `describe` blocks: feature → behavior → edge cases.
- Test error paths explicitly (malformed JSON, empty inputs, boundary conditions).
- Security tests enumerate injection patterns individually.
- E2E tests use temp directories and conditional skips via health checks.

### Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Lines | 70% |
| Functions | 70% |
| Branches | 70% |
| Statements | 70% |

## Development Conventions

### Singleton Pattern
Nearly every module uses module-level singletons (`getXxx()`, `resetXxx()`) for stateful services.

### Error Handling
Use structured `EndiorBotError` with `code`, `message`, `details`, and `suggestion`:

```typescript
throw new EndiorBotError({
  code: 'GATE_NOT_READY',
  message: 'G2 gate requirements not met',
  details: { missing: ['ADR', 'API spec'] },
  suggestion: 'Create ADR-001 before proceeding',
});
```

### Logging
Standard fields required: `correlationId`, `sessionId`, `projectId`. Secrets are auto-redacted (`sk-*`, `pk-*`, `eyJ*`, auth headers, passwords).

### Zod Validation
Runtime config and external inputs are validated with Zod schemas. See `src/config/` for examples.

## Security Considerations

### Input Sanitization
Agents must sanitize all external inputs for:
- SQL injection patterns
- XSS vectors
- Command injection
- Path traversal
- Shell metacharacters

Use `src/security/input-sanitizer.ts` — do not reimplement sanitization logic.

### Output Scrubbing
Agents must never output:
- API keys
- Passwords
- Tokens
- AWS credentials
- Private keys

Use `src/security/output-scrubber.ts` for programmatic redaction.

### SSRF Defense
Outbound fetch calls must use `safeFetch` / `validateFetchUrl` from `src/security/http-validator.ts`.

### Shell Guard
Shell command execution goes through `src/security/shell-guard.ts` with allowlist/denylist policies.

### Exec-Policy
Autonomous execution is governed by a 3-layer policy (ADR-046):
1. Exec-policy preset (`strict` / `balanced` / `open`)
2. Gate A/B/C classification
3. PATCH/risk gate

Destructive actions (PATCH mode) always pass through existing gates regardless of preset.

### Secrets in Commits
The pre-commit hook runs `gitleaks protect --staged --no-banner --redact`. Allowlist lives in `.gitleaks.toml`. Bypass with `git commit --no-verify` (documented as dangerous).

## Deployment and Runtime

### Local Development
```bash
pnpm install
pnpm build
pnpm test
./endiorbot.mjs serve    # Starts Web + Telegram + Zalo gateway on :18790
```

### Docker
```bash
docker build -t endiorbot .
docker run -p 18790:18790 --env-file .env endiorbot
```

### Environment Variables
Copy `.env.example` to `.env` and configure at minimum:
- `OPENAI_API_KEY` — for programmatic automation
- `GEMINI_API_KEY` — for automation
- `TELEGRAM_BOT_TOKEN` — for Telegram channel
- `ENDIORBOT_WEBHOOK_SECRET` — for webhook ingress
- `ENDIORBOT_GATEWAY_TOKEN` — for Web API mutations

Full reference is in `.env.example` and `docs/06-deploy/README.md`.

### State Directory
All runtime state is stored in `~/.endiorbot/` (override with `ENDIORBOT_STATE_DIR`):
```
~/.endiorbot/
├── projects/            # Project contexts
├── evidence/            # Gate evidence
├── backups/             # Daily/weekly backups
├── repos.json           # Registered repos
├── chat-focus.json      # Per-chat workspace focus
├── config.json          # Persisted config
├── exec-policy/         # Exec-policy store
├── audit-logs/          # Structured audit logs (JSONL, 10MB rotation, 0o600)
├── rl-training-data/    # RL feedback JSONL
└── sessions/            # Chat session persistence
```

### CI/CD Pipeline
- **CI**: `.github/workflows/ci.yml` — runs on push/PR to `main`, matrix Node 20 + 22, steps: install → build → test → typecheck.
- **Publish**: `.github/workflows/publish.yml` — triggers on release, publishes to npm with provenance.

## Core Principles

1. **SDLC Compliance First** - All development follows SDLC Framework 6.4.0
2. **Quality Gates** - Never bypass gate requirements (G0 → G4)
3. **Evidence-Based** - Every decision requires documented evidence
4. **Security-Aware** - Apply input sanitization and output scrubbing
5. **Context-Preserving** - Maintain project context across sessions
6. **English development docs** - Under `docs/`, application development documentation (ADRs, specs, sprint plans, stage READMEs, test plans) is written in **English** per SDLC 6.4.0; policy: [`docs/README.md`](docs/README.md)
7. **Local-only scope** - EndiorBot agents work on **CEO's local MacBook repos** only. Remote orchestration, GPU servers, and product execution are out of scope (see Handoff Boundary below).

## Handoff Boundary (LOCKED 2026-04-19)

EndiorBot follows a **scaffold-then-handoff** pattern. Agent responsibilities split cleanly between EndiorBot (local kickstart) and product-team agent platforms (remote execution).

### EndiorBot is in-scope when

- The repo lives on the CEO's MacBook (or any host CEO is working on directly through their local Claude Code / CLI / OTT surface).
- The work is SDLC scaffolding, gate ceremony, ADR drafts, sprint planning, advisory reviews, or general CEO support (research, doc writing, ideation).
- Agents needed are EndiorBot's `@pm/@cpo/@cto/@architect/@coder/@reviewer/@tester/@devops/@pjm/@researcher/@assistant/@ceo/@cso`.

### EndiorBot is out-of-scope when

- The work requires execution on remote GPU servers or production infrastructure (e.g. SSH targets, k8s, on-call rotations).
- The project has moved to a product-org repo and a product team owns lifecycle (build, test, deploy, on-call).
- Multi-user platform features, server-side runtime (Python venv setup, model weight downloads, hardware-bound test runs).

### Handoff trigger

When a project graduates from **CEO scaffold** → **product execution** (typically post G2 / G3 once architecture and build plan are agreed), hand off to **MTClaw's @pm** running directly on the target server via the Claude Code VSC extension. EndiorBot does **not** SSH or orchestrate on the remote host.

If CEO asks EndiorBot to do remote work, the right reply is to suggest the MTClaw handoff (or a one-off direct CLI from CEO's terminal) — not to extend EndiorBot's reach.

**Reference incident:** VoiceOfVietnam (formerly BetterBox-TTS) was scaffolded locally with EndiorBot through Sprint 2 / G2-G3, then handed off to MTClaw's @pm on the GPU server for product execution. EndiorBot retained historical state only.

## Commands: Atomic vs Workflows

EndiorBot exposes **atomic** commands (one outcome per call — CLI, OTT, Web via shared handlers) and **workflows** (chained steps: bootstrap, plan drafts, sprint close, compliance loop). Stage alignment, gates, and design→build→test traceability are documented in [`docs/00-foundation/stage-command-workflow-spine.md`](docs/00-foundation/stage-command-workflow-spine.md). Command catalog for templates: [`docs/reference/templates/COMMANDS.md`](docs/reference/templates/COMMANDS.md).

## Agent Personas

### Development Agents

| Agent | SOUL File | Role | Triggers |
|-------|-----------|------|----------|
| @pm | SOUL-pm.md | Product planning | "requirements", "backlog", "prioritize" |
| @architect | SOUL-architect.md | Technical design | "design", "ADR", "architecture" |
| @coder | SOUL-coder.md | Implementation | "implement", "code", "build" |
| @reviewer | SOUL-reviewer.md | Quality assurance | "review", "check", "validate" |
| @tester | SOUL-tester.md | Testing | "test", "qa", "coverage" |
| @devops | SOUL-devops.md | Infrastructure | "deploy", "ci/cd", "infra" |
| @fullstack | SOUL-fullstack.md | End-to-end features | "fullstack", "feature" |
| @pjm | SOUL-pjm.md | Project management | "sprint", "task", "velocity" |
| @researcher | SOUL-researcher.md | Research | "research", "analyze", "compare" |

### Advisory Agents

| Agent | SOUL File | Role | Triggers |
|-------|-----------|------|----------|
| @ceo | SOUL-ceo.md | Strategic direction | "strategy", "executive" |
| @cto | SOUL-cto.md | Technical standards | "tech review", "standards" |
| @cpo | SOUL-cpo.md | Product vision | "product", "vision", "roadmap" |
| @cso | SOUL-cso.md | Security review | "security", "audit", "threat" |
| @assistant | SOUL-assistant.md | General help | Default fallback |

## SDLC Stage Awareness

Agents must be aware of current SDLC stage and apply appropriate behaviors:

| Stage | Description | Agent Focus |
|-------|-------------|-------------|
| 00-FOUNDATION | Problem validation | @pm: WHY questions |
| 01-PLANNING | Requirements | @pm: WHAT specifications |
| 02-DESIGN | Architecture | @architect: HOW designs |
| 03-INTEGRATE | Integration planning | @architect: Integration patterns |
| 04-BUILD | Implementation | @coder: Code generation |
| 05-TEST | Testing | @reviewer: Test coverage |
| 06-DEPLOY | Deployment | @coder: Deploy scripts |
| 07-OPERATE | Operations | @assistant: Monitoring |

## Gate Requirements

Before proposing gate passage, agents must verify:

### G0 (Ideation → Planning)
- [ ] Problem statement documented
- [ ] Business case exists
- [ ] Stakeholder approval

### G1 (Planning → Design)
- [ ] Requirements complete
- [ ] User stories defined
- [ ] Acceptance criteria clear

### G2 (Design → Build)
- [ ] ADR(s) created
- [ ] Technical spec complete
- [ ] API contracts defined
- [ ] Security review done

### G3 (Build → Test)
- [ ] Code complete
- [ ] Unit tests passing
- [ ] Vibecoding Index < 60 (Green/Yellow)
- [ ] No critical security issues

### G4 (Test → Deploy)
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Change log updated
- [ ] Deployment plan ready

## Multi-Model Orchestration

When consulting multiple models:

1. **Primary Model**: Claude Opus (SDLC knowledge, detailed design)
2. **Expert Panel**: GPT-5, Gemini, Mistral (diverse perspectives)
3. **Consensus Threshold**: 50% agreement
4. **Timeout**: 30s per model, 60s total

### Consultation Triggers
- Architecture decisions
- Security-critical code
- Breaking changes
- Uncertain requirements

## Quality Metrics

### Vibecoding Index (0-100)
| Zone | Score | Action |
|------|-------|--------|
| Green | 0-40 | Proceed |
| Yellow | 41-60 | Review recommended |
| Orange | 61-80 | Review required |
| Red | 81-100 | Block, refactor needed |

### Code Review Signals
1. Complexity score
2. Test coverage
3. Documentation ratio
4. Security scan result
5. Type safety

## Context Switching

When switching projects:

```bash
endiorbot switch <project-name>
```

Agents must:
1. Save current session state
2. Load target project context
3. Apply project-specific SDLC config
4. Resume from last active point

## Evidence Collection

All gate-related activities must be evidenced:

```
~/.endiorbot/evidence/{projectId}/{gateId}/
├── manifest.json       # Evidence index
├── documents/          # Specs, ADRs
├── test-results/       # Test outputs
├── screenshots/        # Visual evidence
└── approvals/          # CEO decisions
```

## Error Handling

Agents should:
1. Never crash silently
2. Log errors with context
3. Suggest recovery actions
4. Preserve session state on failure

## Communication Style

- Professional, concise
- Use SDLC terminology
- Reference framework sections
- Provide evidence for claims
- Ask clarifying questions when uncertain

---

*EndiorBot - Solo developer tool for enterprise-scale projects*
*SDLC Framework v6.4.0 compliant*
