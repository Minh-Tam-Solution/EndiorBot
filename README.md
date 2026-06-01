# EndiorBot

[![CI](https://github.com/endior-net/EndiorBot/actions/workflows/ci.yml/badge.svg)](https://github.com/endior-net/EndiorBot/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/endiorbot)](https://www.npmjs.com/package/endiorbot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Beta:** APIs may change between releases. Not recommended for production use yet.

> **AI dev team in your terminal** — 14 SDLC agents, 5 channels, plugin-compatible, answers in 30 seconds

EndiorBot is a personal AI power tool for solo developers working on enterprise-scale projects.
It integrates with Claude Code as an Agent Orchestrator, enabling @agent invocations with SDLC governance across CLI, Web, Telegram, Zalo, and Desktop channels.

**Identity**: Solo Developer Power Tool — not a platform, not an SDLC enforcer.

> **Origin:** EndiorBot was ported from OpenClaw (Python, internal MTS codebase) to TypeScript in Sprint 54 (ADR-005). The OpenClaw backport (Sprint 131-132) brought exec-policy, Active Memory, and SSRF protection patterns into the current architecture. OpenClaw is owned by Minh Tam Solution; code transferred to EndiorBot is released under MIT for this project.

## Methodology

EndiorBot implements **[SDLC Framework 6.3.1](https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework)** — a 7-Pillar, 10-Stage AI+Human development methodology with 11 training modules (39h).

- **[sdlcframework.org](https://sdlcframework.org)** — Framework documentation
- **[endior.net](https://endior.net)** — EndiorBot documentation

## Documentation

- **[SDLC stage index (00→09)](docs/README.md)** — per-stage READMEs and extended lifecycle (06–09)
- **[Product vision](docs/00-foundation/product-vision.md)** — north star and autonomy levels (L1–L4)
- **[Stage × command spine](docs/00-foundation/stage-command-workflow-spine.md)** — stage alignment, atomic CLI/OTT/Web vs workflows, design→build→test traceability
- **[Usage Guide](docs/07-operate/USAGE-GUIDE.md)** — 22 workflows from setup to advanced
- **[Plugin Architecture Guide](docs/08-collaborate/plugin-architecture-guide.md)** — tier recommendation, layered CLAUDE.md, skills, audit, hooks

Application development documentation under `docs/` is written in **English** (SDLC 6.3.1); see the *Documentation language* note in [docs/README.md](docs/README.md).

## Prerequisites

- Node.js >= 20
- pnpm (via corepack: `corepack enable`)

> **Claude Code is recommended but not required.** Planning, methodology, and consultation agents work without it via Kimi (free OAuth), OpenAI, or any configured LLM. Claude Code is primary for coding workflow (@coder, @architect in PATCH mode).

## Install

> **Beta channel during pre-1.0**: Use the `@beta` tag explicitly. We don't push prerelease versions to npm's `latest` tag, so a bare `npx endiorbot` resolves to nothing until v1.0 ships.

```bash
# Via npx (no install needed) — beta channel
npx endiorbot@beta --help
npx endiorbot@beta init
npx endiorbot@beta serve

# Or install globally
npm install -g endiorbot@beta

# Or pin a specific beta version
npm install -g endiorbot@0.1.0-beta.3

# Or via Docker
docker run -p 18790:18790 endiorbot/endiorbot serve
```

After v1.0.0 ships, the `@beta` qualifier will become optional and the bare `npx endiorbot` form will work for stable installs.

## Quick Start

```bash
# Initialize SDLC structure
endiorbot init                              # Auto-recommend tier from project scan
endiorbot init --tier STANDARD              # Override with explicit tier
endiorbot skills                            # List discovered skills in project
endiorbot audit-claude-md                   # Check CLAUDE.md health (stale refs, size, age)
endiorbot compliance check                  # Verify SDLC compliance

# Unified Serve (Web + Telegram + Zalo + Desktop gateway)
endiorbot serve                             # Start all channels
endiorbot serve --no-zalo                   # Skip Zalo adapter

# Agent Orchestration (via CLI)
endiorbot @pm "plan payment gateway"        # PM agent
endiorbot @coder --patch "fix auth bug"     # Coder agent (PATCH mode)
endiorbot @consult "Redis vs PostgreSQL?"   # Multi-model consultation
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EndiorBot Unified Serve                           │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │   Web    │  │ Telegram │  │   Zalo   │  │   CLI    │  │Desktp │ │
│  │:18790/ws │  │  @bot    │  │ Bot API  │  │endiorbot │  │ App   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬───┘ │
│       └──────────────┼───────────┬─┘             │            │     │
│                ┌─────▼─────┐     │               │            │     │
│                │ MessageBus│◄────┴───────────────┘            │     │
│                │ (debounce │◄───────────────────────────────── ┘     │
│                │  + dedup) │                                         │
│                └─────┬─────┘                                         │
│                ┌─────▼──────────────────────┐                        │
│                │     GatewayIngress         │                        │
│                │  /commands → Dispatcher    │                        │
│                │  @agents  → ChannelRouter  │                        │
│                └─────┬─────────────┬────────┘                        │
│                      │             │                                 │
│          ┌───────────▼──┐   ┌──────▼──────┐                         │
│          │ CommandDisp. │   │ChannelRouter│                         │
│          │ (42 commands)│   │ Bridge+Cloud│                         │
│          └──────────────┘   └──────┬──────┘                         │
│                                    │                                 │
│  ┌─────────────┐  ┌───────────┐  ┌▼────────────┐                   │
│  │ Claude Code │  │   Kimi    │  │   Ollama    │                   │
│  │  Bridge     │  │ (Fallback)│  │ (local LLM) │                   │
│  │ (Primary)   │  │           │  │ (Router)    │                   │
│  └─────────────┘  └───────────┘  └─────────────┘                   │
│                                                                      │
│  Per-Chat Workspace: /repos + /focus + resolveWorkspace()           │
│  SOUL Templates: 14 agents × tier-aware model selection              │
│  PID Lockfile: single-instance guard (--force to takeover)           │
└─────────────────────────────────────────────────────────────────────┘
```

## Channels

| Channel | Access | Purpose |
|---------|--------|---------|
| Web UI | `http://localhost:18790` | Browser chat interface |
| Telegram | `@Endior_bot` | Mobile OTT |
| Zalo | `Bot Endior` (zapps.me) | Mobile OTT (Vietnam) |
| CLI | `endiorbot @agent "task"` | Terminal |
| Desktop | Electron app (auto-starts gateway) | Native desktop client |

### OTT Commands (Telegram / Zalo)

```
/link                           # Bind identity (required after restart)
/repos add myapp /path/to/repo  # Register a repo
/focus myapp                    # Set active repo for this chat
/where                          # Show current focus
@pm plan the next sprint        # Talk to PM agent
@coder fix the login bug        # Talk to Coder agent
/launch claude --as coder       # Launch Claude Code in tmux
/sessions                       # List active tmux sessions
/switch <sessionId>             # Switch active session
/help                           # Full command list (42 commands)
```

## Agent Orchestration

14 SOUL-based agents with tier-aware model selection:

| Agent | Category | Mode | Use Case |
|-------|----------|------|----------|
| `@pm` | executor | READ | Planning, requirements, sprints |
| `@architect` | executor | READ | Design decisions, ADRs |
| `@coder` | executor | PATCH | Code generation, bug fixes |
| `@reviewer` | executor | READ | Code review, quality audit |
| `@tester` | executor | READ | Test strategy, test writing |
| `@fullstack` | executor | PATCH | Full-stack implementation |
| `@devops` | executor | PATCH | CI/CD, infrastructure |
| `@pjm` | executor | READ | Project management |
| `@researcher` | executor | READ | Research, analysis |
| `@ceo` | advisor | READ | Strategic decisions |
| `@cto` | advisor | READ | Technical review |
| `@cpo` | advisor | READ | Product review |
| `@cso` | advisor | READ | Security review |
| `@assistant` | router | READ | General queries |

### Multi-Agent Routing

Messages with multiple @agents or complex tasks are automatically decomposed:
```
@pm @cto review the authentication module
→ GoalDecomposer splits task → MultiAgentDispatcher runs in parallel
```

## SDLC Framework

| Tier | Files | Stages | Agents |
|------|-------|--------|--------|
| LITE | 2 (CLAUDE.md, IDENTITY.md) | 4 | 3 |
| STANDARD | 3 (+AGENTS.md) | 7 | 6 |
| PROFESSIONAL | 4 (+USER.md) | 10 | 10 |
| ENTERPRISE | 6 (+TOOLS.md, HEARTBEAT.md) | 11 | 13 |

## Per-Chat Workspace

Different chats can focus on different repos simultaneously:
```
# Chat A (Telegram DM): focused on EndiorBot
/focus endiorbot
@pm check sprint status

# Chat B (Zalo): focused on a separate project
/focus myproject
@coder fix the video parser
```

## Sprint 154 Highlights (2026-05-27) — Plugin Architecture

- **Tier auto-recommendation**: `endiorbot init` scans 7 project signals to recommend LITE/STANDARD/PRO/ENT (ADR-054)
- **Layered CLAUDE.md**: root + per-directory context files, scoped by tier (ADR-055)
- **Plugin format**: Anthropic Base profile `.claude-plugin/plugin.json` for STANDARD+ (ADR-056)
- **Plugin loader**: `endiorbot skills` discovers and lists `skills/` directory at runtime
- **CLAUDE.md audit**: `endiorbot audit-claude-md` — 5 checks (stale refs, version, size, age) + baseline suppression
- **Self-improving hooks**: PostToolUse tracker + Stop suggest → `.endiorbot/audit-suggestions.md`
- **42 unified commands** across 5 channels
- **8,207+ tests** passing

## Docker

```bash
# Build
docker build -t endiorbot .

# Run
docker run -p 18790:18790 \
  -e ANTHROPIC_API_KEY=your-key \
  endiorbot

# With env file
docker run -p 18790:18790 --env-file .env endiorbot
```

## Development

```bash
pnpm install      # Install dependencies
pnpm dev          # Watch mode
pnpm build        # Build TypeScript
pnpm test         # Run tests (8,207+ passing)
pnpm lint         # Check style
pnpm lint:souls   # Validate 14 SOUL templates
```

## Stats

| Metric | Value |
|--------|-------|
| Tests passing | 8,207+ |
| CLI commands | 42 unified |
| Channels | 5 (CLI, Web, Telegram, Zalo, Desktop) |
| SOUL agents | 14 |
| AI providers | 6 (Anthropic, OpenAI, Gemini, Ollama, Kimi, Groq) |
| SDLC framework | v6.3.1 |
| Sprint | 154 (2026-05-27) |

## Invariants

```
1. THIN CLIENT PATTERN: Commands call ./endiorbot.mjs core
2. STDIN JSON FOR HOOKS: Hooks receive JSON via stdin
3. ENDIORBOT SOUL = GOVERNANCE: EndiorBot decides WHAT, Claude Code executes HOW
4. DEFAULT MODEL = SONNET: Opus only for explicit architecture decisions
```

## Documentation

- [IDENTITY.md](./IDENTITY.md) - Project identity
- [CLAUDE.md](./CLAUDE.md) - Claude Code integration
- [AGENTS.md](./AGENTS.md) - Agent guidelines
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Community contribution guide

## Known Limitations (beta)

- Composio tool integration not bundled (install separately if needed)
- API surface may change between beta releases
- No SLA or production support guarantee
- Single-developer tested — community feedback welcome

## Links

- **Website:** https://endior.net
- **Repository:** https://github.com/endior-net/EndiorBot
- **npm:** https://www.npmjs.com/package/endiorbot

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](./LICENSE)

---

*EndiorBot v0.1.0-beta.3 | Solo Developer Power Tool | SDLC Framework v6.3.1 | Sprint 154 (2026-05-27)*
