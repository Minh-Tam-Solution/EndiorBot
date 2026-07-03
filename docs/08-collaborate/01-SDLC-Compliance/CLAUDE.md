# CLAUDE.md - Claude Code Integration Guide

## Identity (LOCAL-ONLY)

> **EndiorBot is a Solo Developer Power Tool** — not a platform, not an SDLC enforcer.
> Help developers get answers in <30s instead of 30-60 min.
>
> **Scope: local repos + general developer support only.** Product execution
> on remote infrastructure (GPU servers, production deployment, multi-user
> platforms) belongs to separate orchestration tools, not EndiorBot.
>
> **Handoff boundary:** EndiorBot scaffolds and ceremonies a project locally
> through G2/G3. When the project moves to a remote product-org repo,
> hand off to the target team's orchestrator — EndiorBot does not SSH or
> orchestrate remotely.

## Overview

EndiorBot integrates with Claude Code (VSCode extension) as the primary development interface.
This document defines how Claude should behave when working on EndiorBot projects.

## 🚨 4 Non-Negotiable Invariants

```
1. THIN CLIENT PATTERN
   Claude Code commands = wrappers that call ./endiorbot.mjs
   NO business logic in .md files
   Gate checks, vibecoding, multi-model → all in EndiorBot core

2. STDIN JSON FOR HOOKS
   Hooks receive JSON via stdin, NOT positional arguments
   Always parse with jq: cat /dev/stdin | jq -r '.tool_name'
   Test: echo '{"tool_name":"Edit","file_path":"test.ts"}' | ./hook.sh

3. ENDIORBOT SOUL = GOVERNANCE, CLAUDE CODE = EXECUTION
   EndiorBot SOUL decides WHAT to build (PM, requirements, gates)
   Claude Code executes HOW to build (Architect, Coder, Reviewer)
   No PM agent in Claude Code (prevents orchestration conflict)

4. DEFAULT MODEL = SONNET
   Opus only for explicit architecture decisions
   Commands use model: sonnet unless specified
   Budget guard: track /cost regularly
```

## Claude Code Integration Examples

### Thin Client Pattern
```bash
# Commands call EndiorBot core, no business logic in .md files
! ./endiorbot.mjs gate check G3
! ./endiorbot.mjs consult "Redis vs PostgreSQL for sessions?"
```

### Hook stdin JSON Format
```bash
# Hooks receive JSON via stdin
INPUT=$(cat /dev/stdin)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty')
```

### Custom Commands Available
- `/project:gate <gate-id>` - Check SDLC gate status
- `/project:consult <query>` - Multi-model consultation
- `/sprint-close` - Automated sprint closure (test, build, commit, docs); CLI: `./endiorbot.mjs sprint close`

## Feature Release Doc Checklist

When a new feature is shipped, update ALL of the following:

| # | File | What to update |
|---|------|----------------|
| 1 | `README.md` | Quick Start, Stats table, Highlights section, architecture diagram command count |
| 2 | `IDENTITY.md` | Capabilities section, version/sprint/test counts |
| 3 | `CLAUDE.md` | File organization, command count, sprint/test footer |
| 4 | `CHANGELOG.md` | Add entry under `[Unreleased]` or new version |
| 5 | `package.json` + `src/index.ts` | Bump `version` if releasing |
| 6 | `docs/00-foundation/product-vision.md` | "What's Built" table, version header |
| 7 | `docs/04-build/sprints/SPRINT-INDEX.md` | Move sprint to completed, update test counts, ADR map |
| 8 | `docs/07-operate/USAGE-GUIDE.md` | Add workflow if new user-facing feature |
| 9 | `docs/08-collaborate/` | Training guide if new concept |
| 10 | `docs/05-test/` | Execution report |

**Rule:** No sprint closes without this checklist passing.

## Project Context

- **Project:** EndiorBot
- **Type:** Solo developer tool for enterprise-scale projects
- **Framework:** SDLC Framework 6.4.0
- **Primary Language:** TypeScript (ES2022, NodeNext)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/anthropics/endiorbot.git
cd EndiorBot && pnpm install

# 2. Configure environment
cp .env.example .env
# Set ANTHROPIC_API_KEY, GOOGLE_API_KEY (minimum)

# 3. Build and verify
pnpm build && pnpm test

# 4. Run
./endiorbot.mjs serve  # Web + Telegram + Zalo channels
```

## Top 5 Architecture Decisions

1. **TypeScript monorepo** — Single codebase, unified types, no micro-service overhead for solo dev (ADR-005)
2. **4-channel OTT architecture** — Web, Telegram, Zalo, CLI share unified command handlers (ADR-030)
3. **Per-chat workspace resolution** — Each chat maps to a repo via `~/.endiorbot/repos.json` (ADR-029)
4. **Claude Code Bridge via tmux** — Session management without child processes, survives disconnects (ADR-006)
5. **SDLC Gate Engine as code** — Gates evaluated programmatically, not manually checked (ADR-004)

**Stage × command spine (CPO/CTO):** [`docs/00-foundation/stage-command-workflow-spine.md`](docs/00-foundation/stage-command-workflow-spine.md) — stages 00→05, design→build→test traceability, atomic CLI/OTT/Web vs workflows. **Vision:** [`docs/00-foundation/product-vision.md`](docs/00-foundation/product-vision.md).

## Constraints

- **Solo developer** — No team reviews; AI agents handle code review, testing, QA
- **Budget** — Default model is Sonnet; Opus reserved for architecture decisions only
- **Token budget** — 2K tokens/turn max, 3 blocks/turn, hard reset every 30 turns
- **Node.js >= 20** — Required for ES2022 features and NodeNext module resolution
- **Beta stability** — APIs may change between 0.x releases; no SLA guarantees

## Configuration Files

| File | Purpose |
|------|---------|
| `.sdlc-config.json` | SDLC framework configuration |
| `IDENTITY.md` | Project identity and capabilities |
| `AGENTS.md` | AI agent guidelines (this links here) |
| `CLAUDE.md` | Claude-specific integration (this file) |
| `package.json` | Node.js package configuration |
| `tsconfig.json` | TypeScript configuration |

## Working Directory

```
~/.endiorbot/              # State directory
  ├── projects/            # Project contexts
  ├── evidence/            # Gate evidence
  ├── backups/             # Daily/weekly backups
  ├── repos.json           # Registered repos (ADR-029)
  ├── chat-focus.json      # Per-chat workspace focus (ADR-029)
  ├── config.json          # Persisted config (exec-policy preset, Active Memory, auto-handoff)
  ├── exec-policy/         # Exec-policy store (Sprint 132, ADR-046)
  │   └── approvals.json   # Active preset + extra allow/deny patterns
  ├── audit-logs/          # Structured audit logs (JSONL, 10MB rotation, 0o600)
  │   ├── exec-policy.log  # Command allow/deny/prompt decisions (Sprint 132)
  │   ├── ssrf-blocks.log  # Outbound fetch blocks (Sprint 133)
  │   └── webhooks.log     # Webhook events (Sprint 134)
  ├── rl-training-data/    # RL feedback JSONL (ADR-033)
  └── sessions/            # Chat session persistence
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `ENDIORBOT_STATE_DIR` | State directory | `~/.endiorbot/` |
| `ENDIORBOT_CONFIG_PATH` | Config file path | `.sdlc-config.json` |
| `ENDIORBOT_PROFILE` | Active profile | `default` |
| `ENDIORBOT_DEBUG` | Debug mode | `false` |
| `ENDIORBOT_AUTO_HANDOFF` | Auto-route @mention handoffs (Sprint 131) | `false` |
| `ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED` | Per-query context refresh kill switch (Sprint 133) | `false` |
| `ENDIORBOT_WEBHOOK_SECRET` | Shared secret for webhook ingress (Sprint 134) | — |
| `ENDIORBOT_GATEWAY_TOKEN` | Auth token for Web API mutations (Sprint 135) | — |
| `ENDIORBOT_MODEL_TIMEOUT_MS` | Per-model API call timeout (Sprint 134) | `30000` |
| `ENDIORBOT_CHAT_TIMEOUT_MS` | Total chat handler timeout (Sprint 134) | `60000` |

## Code Style

### TypeScript
- Use strict mode
- Explicit types (no `any`)
- Prefer `const` over `let`
- Use template literals
- Document public APIs with JSDoc

### File Organization
```
src/
├── agents/        # Agent orchestration (ChannelRouter, SOUL, teams)
│   ├── intelligence/  # Brain L4, context anchoring
│   ├── orchestrator/  # Team registry, goal decomposer
│   └── types/         # Handoff, team types
├── bridge/        # Claude Code Bridge (tmux, sessions, security)
│   ├── launcher/      # Unified agent launcher
│   ├── repo/          # RepoRegistry, ChatFocus, WorkspaceResolver
│   └── security/      # Audit, redactor, output scrub
├── bus/           # MessageBus (EventEmitter, debounce, dedup)
├── channels/      # OTT adapters (Telegram, Zalo)
├── cli/           # CLI commands (init, serve, sprint close, …)
├── commands/      # Unified command handlers (35+ commands, Sprint 135 OTT surface)
├── config/        # Configuration management, feature flags, timeouts SSOT
├── gateway/       # HTTP/WS server, Ingress, Web API, Webhooks
├── memory/        # ClawVault memory module
├── providers/     # AI model providers (Anthropic, OpenAI, Gemini, Ollama)
├── rl/            # RL feedback capture (JSONL, data store)
├── sdlc/          # Gate engine, compliance, scaffold
│   ├── gates/     # Gate evaluation
│   ├── scaffold/  # Init templates, tier-recommender, plugin-loader, plugin-manifest
│   ├── compliance/ # Content checker, claude-md-auditor
│   └── vibecoding/ # Quality index
├── security/      # Sanitizer, scrubber, guard, exec-approvals cluster, http-validator
└── sessions/      # Session state machine, resilience, checkpoints, autonomous
```

## Commands

### Development
```bash
pnpm install        # Install dependencies
pnpm build          # Build TypeScript
pnpm dev            # Watch mode
pnpm test           # Run tests
pnpm lint           # Check code style
```

### CLI
```bash
./endiorbot.mjs --help              # Show help
./endiorbot.mjs serve               # Unified serve (Web + Telegram + Zalo)
./endiorbot.mjs init                # Initialize SDLC structure
./endiorbot.mjs gate status         # Show gate status
./endiorbot.mjs consult <query>     # Multi-model query
./endiorbot.mjs compliance check    # Verify SDLC compliance
./endiorbot.mjs commands            # List all commands across 4 channels (Sprint 132)
./endiorbot.mjs exec-policy show    # Current exec-policy preset + rules (Sprint 132)
./endiorbot.mjs exec-policy preset balanced  # Change preset (Sprint 132)
```

### OTT Commands (Sprint 135 — Telegram + Zalo)
```
/exec-policy show|preset|audit      # Exec-policy management from phone
/config                             # View system config
/config active-memory on|off        # Toggle Active Memory
/config auto-handoff on|off         # Toggle auto-handoff
/audit exec-policy|ssrf|webhooks    # Audit log viewer
/webhooks list|test                 # Webhook management
```

### Web API (Sprint 135)
```bash
GET  /api/config                    # System config JSON
GET  /api/audit/:type?limit=N       # Audit logs (exec-policy, ssrf, webhooks)
GET  /api/status                    # System status + Active Memory
POST /api/config/exec-policy/preset # Change preset (GATEWAY_TOKEN required)
POST /api/config/active-memory      # Toggle Active Memory (GATEWAY_TOKEN required)
POST /api/webhooks/:triggerId       # Webhook ingress (WEBHOOK_SECRET required)
```

## SDLC Integration

### Current Stage Detection
Claude should detect SDLC stage from:
1. Active branch name (feature/*, bugfix/*, etc.)
2. Recent file changes
3. `.sdlc-config.json` current_stage

### Gate Awareness
Before major changes, check gate requirements:
```typescript
// In code review or implementation
const gateStatus = await sdlc.evaluateGate('G2', featureId);
if (gateStatus.result !== 'PASS') {
  // Warn about missing requirements
}
```

## Security

### Input Handling
Always sanitize external input:
```typescript
import { sanitize } from '@security/input-sanitizer';

const safeInput = sanitize(userInput);
```

### Output Handling
Never expose sensitive data:
```typescript
import { scrub } from '@security/output-scrubber';

const safeOutput = scrub(response);
```

## Multi-Model Consultation

When uncertain or for architecture decisions:
```typescript
import { consult } from '@agents/multi-model';

const result = await consult({
  query: 'Design payment gateway integration',
  taskType: 'architecture',
  models: ['claude', 'gpt', 'gemini'],
});

// result.consensus contains merged recommendations
// result.disagreements contains differing opinions
```

## Error Messages

Use structured error format:
```typescript
throw new EndiorBotError({
  code: 'GATE_NOT_READY',
  message: 'G2 gate requirements not met',
  details: { missing: ['ADR', 'API spec'] },
  suggestion: 'Create ADR-001 before proceeding',
});
```

## Testing

### Unit Tests
```typescript
// src/security/__tests__/input-sanitizer.test.ts
import { describe, it, expect } from 'vitest';
import { sanitize } from '../input-sanitizer';

describe('InputSanitizer', () => {
  it('should block SQL injection', () => {
    expect(sanitize("'; DROP TABLE users;--")).not.toContain('DROP');
  });
});
```

### Integration Tests
```bash
pnpm test:e2e       # End-to-end tests
pnpm test:security  # Security pattern tests
pnpm test:quality   # Quality layer tests
```

## Commit Messages

Follow conventional commits:
```
feat(sdlc): add G2 gate evaluation
fix(security): patch input sanitizer XSS pattern
docs(agents): update SDLC stage awareness
refactor(cli): simplify project switching
test(gates): add G3 checklist tests
```

## Pull Requests

Include:
1. Description of changes
2. SDLC stage affected
3. Gate requirements checked
4. Test coverage
5. Vibecoding Index score

## Context Drift Prevention

EndiorBot prevents context drift through these mechanisms:

### 1. Session Anchoring
- Brain L4 (Mental Models) injected at session start
- Max 2K tokens for context injection
- CEO profile preferences included

### 2. Single Source of Truth
```
~/.endiorbot/active.json = SSOT for all interfaces
All interfaces (CLI, Extension, Claude Code) must:
- Read active.json before executing
- Update timestamp after executing
```

### 3. Token Budget Governance
| Budget | Limit |
|--------|-------|
| Tokens per turn | 2K max |
| Blocks per turn | 3 max |
| Hard reset | Every 30 turns |

### 4. Injection Rules
| Block | When |
|-------|------|
| Anchor | Session start + every 10 turns |
| Refresh | On gate change |
| Dynamic | On architecture decision |
| Pattern | From Brain L2 on similar errors |

### 5. Big Picture Checkpoints
- Every 10 turns: Inject project vision summary
- Every 20 turns: Inject sprint goals
- On task completion: Inject next priorities

## Brain Integration

Brain has 4 layers (Iceberg model):

| Layer | Content | Inject When |
|-------|---------|-------------|
| L4 Mental Models | Decision heuristics | Session start |
| L3 Structures | Module maps | Project switch |
| L2 Patterns | Error signatures | On similar errors |
| L1 Events | Session logs | Never (too noisy) |

```typescript
// Access Brain context
import { getBrain } from '@brain';

const mentalModels = await getBrain().getMentalModels();
// Inject at session start
```

---

*Claude Code integration for EndiorBot v0.1.0-beta.4*
*Identity: Solo Developer Power Tool*
*SDLC Framework v6.4.0*
*Sprint 156 | 8,221+ tests | 42 commands | 42 unified commands | 14 SOUL agents (2-tier) | 7 TEAM charters | 6 providers*
*Plugin Architecture: layered CLAUDE.md + Anthropic Base profile + skill loader + audit + self-improving hooks*

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
