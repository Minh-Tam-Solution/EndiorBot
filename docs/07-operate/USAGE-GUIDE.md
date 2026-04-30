# EndiorBot Usage Guide

> **Solo Developer Power Tool** — AI assistant that answers in <30s instead of 30-60 min

EndiorBot is a personal AI tool for solo developers. It integrates with Claude Code (and Codex) as an Agent Orchestrator, supporting CLI, Web, Telegram, and Zalo channels.

**Last Updated:** Sprint 144 (2026-04-27) · SDLC 6.3.1

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Channels Overview](#channels-overview)
4. [Workflow 1: Setup & First Run](#workflow-1-setup--first-run)
5. [Workflow 2: SDLC Operations](#workflow-2-sdlc-operations)
6. [Workflow 3: Agent Orchestration](#workflow-3-agent-orchestration)
7. [Workflow 4: Claude Code Bridge](#workflow-4-claude-code-bridge)
8. [Workflow 5: Multi-Model Consultation](#workflow-5-multi-model-consultation)
9. [Workflow 6: Per-Chat Workspace](#workflow-6-per-chat-workspace)
10. [Workflow 7: Team Agents](#workflow-7-team-agents)
11. [Workflow 8: Interactive Chat Mode](#workflow-8-interactive-chat-mode-sprint-127)
12. [Workflow 9: Bootstrap a Project](#workflow-9-bootstrap-a-project-sprint-123)
13. [Workflow 10: Plan Command](#workflow-10-plan-command-sprint-124)
14. [Workflow 11: Autonomous Development](#workflow-11-autonomous-development-sprint-131-133)
15. [Workflow 12: Command Discovery](#workflow-12-command-discovery-sprint-132)
16. [Workflow 13: Security & Governance](#workflow-13-security--governance-sprint-132-133)
17. [Workflow 14: OTT Surface Control](#workflow-14-ott-surface-control-sprint-135)
18. [Workflow 15: Web API](#workflow-15-web-api-sprint-135)
19. [Workflow 16: Webhooks Ingress](#workflow-16-webhooks-ingress-sprint-134-135)
20. [Workflow 17: Agent-Model Routing & Fallback](#workflow-17-agent-model-routing--fallback-sprint-140-141)
21. [Workflow 18: Cost Monitoring](#workflow-18-cost-monitoring-sprint-141)
22. [Workflow 19: Desktop App](#workflow-19-desktop-app-sprint-144)
23. [Workflow 20: Gateway Resilience](#workflow-20-gateway-resilience-sprint-144)
24. [Command Reference](#command-reference)
25. [Troubleshooting](#troubleshooting)

---

## Installation

> Beta channel during pre-1.0: use `@beta` qualifier. After v1.0 ships, the bare `npx endiorbot` form will work for stable installs.

### Via npx (recommended)

```bash
npx endiorbot@beta --help
npx endiorbot@beta init
npx endiorbot@beta serve
```

### Global install

```bash
npm install -g endiorbot@beta
endiorbot --help
```

### From source

```bash
git clone https://github.com/Minh-Tam-Solution/EndiorBot.git
cd EndiorBot
pnpm install && pnpm build
./endiorbot.mjs --help
```

### Prerequisites

- Node.js >= 20
- pnpm (via corepack: `corepack enable`)
- Claude Code subscription (OAuth — primary provider, no API key needed)

### AI Provider Routing (Sprint 143+)

EndiorBot uses a **CC-first, Kimi-fallback** routing strategy:

```
@agent message → Claude Code (Sonnet, primary)
                    ↓ on timeout/rate-limit
                 Kimi (k2.6, fallback — free via OAuth proxy)
                    ↓ on failure
                 OpenAI / Ollama (last resort)
```

| Provider | Role | Cost | Setup |
|----------|------|------|-------|
| **Claude Code** | Primary (Tier 1 Opus + Tier 2 Sonnet) | Subscription | Claude Code Max or Pro subscription |
| **Kimi** | Fallback (Tier 2) | Free via OAuth proxy | `claude-code-proxy serve` + `ENDIORBOT_KIMI_PROXY_URL` |
| **OpenAI** | Cloud fallback + `/consult` | API key | `OPENAI_API_KEY` in `.env` |
| **Ollama** | Local/free tier (Tier 3 router) | Free | Local `ollama serve` or remote URL |
| **Gemini** | `/consult` only (removed from fallback chain) | API key | `GOOGLE_API_KEY` in `.env` |

**Minimum setup:** Claude Code subscription only. Kimi + OpenAI are optional fallbacks.

---

## Quick Start

```bash
# 1. Initialize SDLC structure in your project
cd /path/to/your-project
endiorbot init --tier STANDARD

# 2. Check compliance
endiorbot compliance check

# 3. Start all channels (Web + Telegram + Zalo)
endiorbot serve

# 4. Open Web UI
open http://localhost:18790
```

---

## Channels Overview

| Channel | Access | Commands | AI Chat | Best For |
|---------|--------|----------|---------|----------|
| **CLI** | `endiorbot <cmd>` | 39 commands | Via `@agent` | Automation, scripting |
| **Web UI** | `http://localhost:18790` | 39 commands | Yes (`@agent`) | Browser chat interface |
| **Telegram** | `@Endior_bot` | 39 commands | Yes (`@agent`) | Mobile, full features |
| **Zalo** | Bot Endior | 39 commands | Yes (`@agent`) | Vietnam market |
| **Desktop** | Electron app | 39 commands | Yes (`@agent`) | Visual dashboard, settings |

### Channel Feature Comparison

```
CLI ........... 39 commands + agent shortcuts + interactive chat mode
Web UI ........ 39 commands + @agent chat via WebSocket gateway
Telegram ...... 39 commands + agent mentions + inline keyboards
Zalo .......... 39 commands + agent mentions via unified dispatcher
Desktop ....... 39 commands + visual dashboard + settings UI (auto-starts gateway)

All 5 channels route through the same GatewayIngress → CommandDispatcher (39 commands).
Desktop is an Electron wrapper around the Web UI with native OS integration.
```

---

## Workflow 1: Setup & First Run

### Step 1: Initialize SDLC Structure

```bash
cd /path/to/your-project
endiorbot init --tier STANDARD
```

This creates:
- `.sdlc-config.json` — Project configuration
- `IDENTITY.md` — Project identity
- `docs/` — 10-stage SDLC documentation structure
- `.claude/` — Claude Code commands and settings

**Tier options:**
| Tier | Files Created | Stages | Agents | Best For |
|------|--------------|--------|--------|----------|
| LITE | 2 | 4 | 3 | Side projects |
| STANDARD | 3 | 7 | 6 | Solo dev projects |
| PROFESSIONAL | 4 | 10 | 10 | Team projects |
| ENTERPRISE | 6 | 11 | 13 | Enterprise apps |

### Step 2: Verify Compliance

```bash
endiorbot compliance check
# L1 Structure: 100%
# L2 Content: XX%

endiorbot compliance score
# Summary with warnings
```

### Step 3: Start the Server

```bash
endiorbot serve                    # All channels
endiorbot serve --no-telegram      # Skip Telegram
endiorbot serve --no-zalo          # Skip Zalo
endiorbot serve -p 3000            # Custom port
```

**Environment variables** (file: `.env`, git-ignored):

Primary provider is **Claude Code via OAuth subscription** — no API key needed. Kimi fallback is also free via OAuth proxy. API keys are only needed for optional providers.

| Variable | Required? | Purpose |
|----------|-----------|---------|
| (none — Claude Code OAuth) | **Primary** | Claude Code subscription handles Tier 1+2 |
| `ENDIORBOT_KIMI_PROXY_URL` | Recommended | Kimi fallback via `claude-code-proxy` (free OAuth) |
| `OPENAI_API_KEY` | Optional | OpenAI cloud fallback + `/consult` |
| `GOOGLE_API_KEY` | Optional | Gemini for `/consult` only |
| `KIMI_API_KEY` | Optional | Direct Kimi API (paid, Moonshot) — alternative to proxy |
| `ENDIORBOT_TELEGRAM_BOT_TOKEN` | For Telegram | Telegram bot token from @BotFather |
| `ENDIORBOT_ZALO_ACCESS_TOKEN` | For Zalo | Zalo OA access token |
| `ENDIORBOT_ZALO_USER_ID` | For Zalo | Zalo user ID (recipient) |
| `ENDIORBOT_ZALO_OA_ID` | For Zalo | Zalo OA ID |

### Step 4: Connect from Telegram

1. Open Telegram, find `@Endior_bot`
2. Send `/link` to bind your identity
3. Send `/help` to see available commands

---

## Workflow 2: SDLC Operations

### Check Gate Status

```bash
# CLI
endiorbot gate status

# Telegram
/gate status
```

### Check Compliance

```bash
# CLI
endiorbot compliance check
endiorbot compliance score

# Telegram
/compliance check
/compliance score
```

### Auto-Fix Compliance Issues

```bash
# CLI
endiorbot compliance fix
endiorbot compliance fix --dry-run    # Preview only
endiorbot compliance fix --stage 04   # Fix specific stage

# Telegram
/fix
/fix --dry-run
/fix --stage 04
```

### View Available Agents

```bash
# CLI
endiorbot @pm "list sprint tasks"

# Telegram
/agents                # List all agents
@pm list sprint tasks  # Talk to PM agent
```

---

## Workflow 3: Agent Orchestration

EndiorBot provides 14 SOUL-based AI agents:

### Executor Agents (do work)

| Agent | Mode | Use Case | Example |
|-------|------|----------|---------|
| `@pm` | READ | Planning, sprints | `@pm plan next sprint` |
| `@architect` | READ | Design, ADRs | `@architect review auth design` |
| `@coder` | PATCH | Code generation | `@coder fix the login bug` |
| `@reviewer` | READ | Code review | `@reviewer check PR quality` |
| `@tester` | READ | Test strategy | `@tester write test plan` |
| `@fullstack` | PATCH | Full-stack work | `@fullstack add user profile page` |
| `@devops` | PATCH | CI/CD, infra | `@devops setup Docker` |
| `@pjm` | READ | Project management | `@pjm show project status` |
| `@researcher` | READ | Research | `@researcher compare Redis vs Postgres` |

### Advisor Agents (give opinions)

| Agent | Use Case | Example |
|-------|----------|---------|
| `@ceo` | Strategic decisions | `@ceo should we pivot?` |
| `@cto` | Technical review | `@cto review architecture` |
| `@cpo` | Product review | `@cpo review feature roadmap` |
| `@cso` | Security audit, OWASP, threat modeling | `@cso review our auth implementation` |

### Router Agent

| Agent | Use Case |
|-------|----------|
| `@assistant` | General queries (default if no agent specified) |

### Multi-Agent Routing

Send to multiple agents at once:

```
# Telegram
@pm @cto review the authentication module

# The system decomposes the task and routes to each agent
```

### Using Agents from CLI

```bash
# Direct agent invocation
endiorbot @pm "plan payment gateway"
endiorbot @coder --patch "fix auth bug"
endiorbot @researcher "compare Redis vs PostgreSQL"
```

---

## Workflow 4: Claude Code Bridge

The bridge launches Claude Code CLI in tmux sessions on the CEO's local MacBook, allowing channel-driven control (Telegram / Zalo / Web UI / CLI) of agent runs that all execute locally. "Remote" here means "remote channel" (e.g. Telegram from CEO's phone), not "remote host" — EndiorBot does not SSH or orchestrate on other machines (see `AGENTS.md` → "Handoff Boundary").

### Launch an Agent Session

```
/launch claude --as coder --risk patch
```

**Parameters:**

| Parameter | Values | Description |
|-----------|--------|-------------|
| Agent | `claude`, `cursor`, `codex`, `gemini` | Which CLI to launch |
| `--as` | `pm`, `architect`, `coder`, `reviewer`, etc. | SOUL role |
| `--as-team` | `dev`, `planning`, `design`, `qa`, `ops` | Team mode |
| `--risk` | `read` (default), `patch` | File modification permission |

**Examples:**

```
# Read-only architect review
/launch claude --as architect

# Coder with file modification rights
/launch claude --as coder --risk patch

# Launch on a specific project
/launch claude /path/to/project --as coder --risk patch

# Launch a dev team
/launch claude --as-team dev "Implement user auth"
```

> **Note:** `--mode` is accepted as a deprecated alias for `--risk`. Prefer `--risk`.

### Manage Sessions

```
/sessions              # List active tmux sessions
/switch <sessionId>    # Switch to a session
/capture               # Capture current session output
/send <message>        # Send message to active session
/kill                  # Kill active session
```

### Full Bridge Workflow

```
# 1. Register your project
/repos add myapp /path/to/myapp

# 2. Focus on it
/focus myapp

# 3. Launch a coder session
/launch claude --as coder --risk patch

# 4. The agent works in your project...

# 5. Check output
/capture

# 6. Send follow-up instructions
/send "also add input validation"

# 7. When done, kill the session
/kill
```

---

## Workflow 5: Multi-Model Consultation

Query multiple AI models simultaneously for architecture decisions:

```bash
# CLI — quick consultation
endiorbot consult "Redis vs PostgreSQL for sessions?"

# CLI — full multi-model (3 models)
endiorbot consult --full "What architecture for payment gateway?"

# CLI — override primary model
endiorbot consult --primary openai "Explain microservices vs monolith"

# Telegram
/consult Redis vs PostgreSQL for sessions?
```

The consultation:
1. Sends your query to 3 AI models in parallel (OpenAI + Gemini + Kimi)
2. Collects responses
3. Shows consensus and disagreements
4. Provides a merged recommendation

### Kimi Model Selection (Sprint 140)

```bash
# Use Kimi as primary consultation model
endiorbot consult --primary kimi "Compare caching strategies"

# Specify Kimi model explicitly
endiorbot consult --kimi kimi-k2-6 "Design payment gateway"
```

---

## Workflow 6: Per-Chat Workspace

Different Telegram/Zalo chats can focus on different projects:

### Register Repositories

```
/repos add endiorbot /path/to/EndiorBot
/repos add myapp /path/to/my-app
/repos add website /path/to/website
/repos                    # List all repos
```

### Set Focus

```
# Chat A: focus on EndiorBot
/focus endiorbot
@pm check sprint status

# Chat B: focus on myapp
/focus myapp
@coder fix the login bug
```

### Check Current Focus

```
/where                   # Shows current chat's focused repo
```

### How It Works

- Each chat has independent workspace focus
- Agent commands run in the focused repo's context
- `/launch` uses the focused repo as default path
- State stored in `~/.endiorbot/repos.json` and `~/.endiorbot/chat-focus.json`

---

## Workflow 7: Team Agents

Launch a team of agents for complex tasks:

### Available Teams

| Team | Leader | Members | Use Case |
|------|--------|---------|----------|
| `dev` | Coder | Architect, Reviewer, Tester | Feature development |
| `planning` | PM | Architect, PJM | Sprint planning |
| `design` | Architect | PM, Reviewer | Architecture design |
| `qa` | Tester | Reviewer, Coder | Quality assurance |
| `ops` | DevOps | Coder, Tester | Deployment, infra |
| `executive` | CEO | CTO, CPO | Strategic review |

### Launch a Team

```
/launch claude --as-team dev "Implement user authentication"
```

### Monitor Team

```
/team-status            # Show team progress
/kill-team              # Kill entire team session
```

> **Note:** `--as` and `--as-team` are mutually exclusive. You cannot use both.

---

## Workflow 8: Interactive Chat Mode (Sprint 127)

Start a continuous AI conversation with project context, multi-provider switching, and session persistence.

### Start a Chat

```bash
endiorbot chat                    # Default: Claude Code (Sonnet)
endiorbot chat --model kimi       # Use Kimi (free via OAuth proxy)
endiorbot chat --model openai     # Use OpenAI GPT
endiorbot chat --model gemini     # Use Gemini
endiorbot chat --model ollama     # Use local Ollama (free, private)
```

### Chat Commands

| Command | Description |
|---------|-------------|
| `/model <provider>` | Switch provider mid-session (kimi, openai, gemini, ollama) |
| `/clear` | Clear conversation history |
| `/status` | Show session info (turns, tokens, cost) |
| `/resume` | List saved sessions |
| `/exit` | Save session and quit |

### Session Features

- **40-turn history cap** — auto-compaction summarizes old turns instead of dropping
- **Auto-save** — session saved every 5 turns to `~/.endiorbot/sessions/`
- **Resume** — continue previous conversations: `endiorbot chat --resume chat-abc123`
- **SDLC commands in chat** — `/gate`, `/plan`, `/audit`, `/compliance` work inside chat
- **Cost tracking** — per-session cost shown via `/status` (Ollama = free)

### Example Session

```
You: What's the current sprint status?
🤖 Based on the project context, Sprint 129 is focused on...

You: /model gemini
Switched to gemini (gemini-2.5-pro)

You: Compare this approach with a microservice architecture
🤖 Here's the comparison...

You: /status
Session: chat-a1b2c3d4
Provider: gemini (gemini-2.5-pro)
Turns: 3/40
Cost: $0.0045
```

---

## Workflow 9: Bootstrap a Project (Sprint 123)

Clone, detect, init, build, and run any GitHub repo in one command.

```bash
# Clone + auto-detect ecosystem + init SDLC
endiorbot bootstrap https://github.com/user/repo.git

# Clone + build + run
endiorbot bootstrap https://github.com/user/repo.git --build --run

# Force re-clone (overwrite existing)
endiorbot bootstrap https://github.com/user/repo.git --force

# Specify tier
endiorbot bootstrap https://github.com/user/repo.git --tier PROFESSIONAL
```

### Supported Ecosystems

| Ecosystem | Detected By | Install | Build | Run |
|-----------|-------------|---------|-------|-----|
| Docker | `docker-compose.yml` | — | `docker compose build` | `docker compose up` |
| Node.js | lock files / `package.json` | `pnpm/npm install` | `pnpm run build` | `pnpm run start` |
| Rust | `Cargo.toml` | — | `cargo build --release` | `cargo run` |
| Python | `pyproject.toml` / `requirements.txt` | `pip install -r ...` | — | `python main.py` |
| Go | `go.mod` | detect-only | — | — |
| Java | `pom.xml` / `build.gradle` | detect-only | — | — |

### Monorepo Support

When `docker-compose.yml` is present with multiple ecosystem markers in subdirs, EndiorBot detects it as a Docker monorepo and reports sub-ecosystems.

---

## Workflow 10: Plan Command (Sprint 124)

Generate structured development plans with agent task decomposition.

```bash
# Generate a plan
endiorbot plan "add payment gateway with Stripe integration"

# Save plan as JSON
endiorbot plan "refactor auth module" --json

# Specify tier
endiorbot plan "add user dashboard" --tier PROFESSIONAL
```

**Output:** Structured task list with agent assignments, saved to `docs/04-build/sprints/drafts/`.

```
📋 Development Plan
Goal: Add payment gateway with Stripe integration
Tasks: 4 | Agents: @architect @coder @tester @reviewer

1. [@architect] Design payment API + write ADR
2. [@coder] Implement Stripe SDK integration
3. [@tester] Write payment flow tests
4. [@reviewer] Security review (PCI compliance)
```

> **Note:** Plan is display-only (advisory). Execution engine is available for future sprints.

---

## Workflow 11: Autonomous Development (Sprint 131-133)

Enable agents to chain automatically — PM → Architect → Coder → Reviewer → Tester — with you approving only at key boundaries.

### Enable Auto-Handoff

```bash
# Agents auto-route @mention handoffs (default: false)
export ENDIORBOT_AUTO_HANDOFF=true

# Safety cap: MAX_HANDOFF_DEPTH=3 (default; overridable via HandoffGuardsConfig)
# Destructive actions (merge, deploy, PATCH) still require CEO approval
```

### Configure Exec-Policy

Control what commands autonomous agents can execute:

```bash
endiorbot exec-policy preset balanced   # Recommended for daily dev
endiorbot exec-policy preset strict     # Max safety — prompts every command
endiorbot exec-policy preset open       # Prototype/hackathon mode

endiorbot exec-policy show              # View current state
endiorbot exec-policy allow "pnpm *"    # Custom allowlist
endiorbot exec-policy deny "rm -rf *"   # Custom hard-deny
endiorbot exec-policy audit             # View recent decisions
```

**Presets:**

| Preset | Behavior | Khi nao dung |
|--------|----------|-------------|
| `strict` | Every command prompts CEO | Production data, security-critical |
| `balanced` | Safe commands silent, risky prompts | **Daily development** |
| `open` | Most allowed, hard-deny still blocks | Prototype, trusted workflows |

**Hard-deny list** (always blocked): `rm -rf /`, `git push --force` on protected branches, fork bombs, `mkfs.*`, shell metacharacters (`;`, `|`, `&&`, backticks, `$()`).

### Full Autonomous Workflow

```bash
# 1. Configure
export ENDIORBOT_AUTO_HANDOFF=true
endiorbot exec-policy preset balanced

# 2. Start a task — agents chain automatically
endiorbot @pm "plan and implement OAuth2 login"
# PM creates plan → hands to Architect → hands to Coder → hands to Reviewer → Tester
# You approve only at key gates

# 3. Monitor from Telegram (while away from desk)
# Telegram: /gate status → approve pending gates
# Telegram: @coder status → check what coder is doing

# 4. Review what happened
endiorbot exec-policy audit   # Full command audit trail
```

### Exec-Policy + Auto-Handoff Composition Matrix

Per [ADR-046](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md):

| | `AUTO_HANDOFF=false` | `AUTO_HANDOFF=true` |
|---|---|---|
| **strict** | 2 prompts (handoff + command) | Silent route, per-command prompts |
| **balanced** | Handoff prompt + selective | **Recommended `serve` sweet spot** |
| **open** | 1 prompt then silent | Near L3 autonomy (Gate B/C bounded) |

---

## Workflow 12: Command Discovery (Sprint 132)

Find all available commands across all 4 channels:

```bash
# CLI
endiorbot commands                    # Human-readable table
endiorbot commands --json             # JSON envelope
endiorbot commands --category sdlc    # Filter by category

# Telegram / Zalo
/commands                             # Same list, automatically routed
```

**Five-equal-numbers invariant:** CLI, Web RPC (`cmd.list`), Telegram, Zalo, and dispatcher registry always return the same count.

---

## Workflow 13: Security & Governance (Sprint 132-133)

### Audit Logs

```bash
# Exec-policy decisions (who ran what, allowed/denied/prompted)
endiorbot exec-policy audit
tail -20 ~/.endiorbot/audit-logs/exec-policy.log | jq .

# SSRF blocks (outbound fetch to private IPs blocked)
tail -20 ~/.endiorbot/audit-logs/ssrf-blocks.log | jq .
```

### Active Memory (Sprint 133)

Per-query context refresh — AI remembers recent context automatically.

```bash
# Kill switch (CEO only — if latency regresses)
export ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED=false  # Immediate effect

# Hard bounds:
# ≤500 tokens injected, ≤50ms cache-hit, ≤300ms cache-miss
# Circuit breaker: fail-open after 3 failures (30s cooldown)
# Cache TTL: 15s default (configurable 1-120s)
```

### SSRF Protection (Sprint 133)

All outbound HTTP calls go through `safeFetch` — blocks private IPs, cloud metadata endpoints, `file://` protocol. Legitimate API calls (GitHub, OpenAI, Anthropic, Gemini) are allowed.

---

## Workflow 14: OTT Surface Control (Sprint 135)

Control all Sprint 131-134 features directly from Telegram or Zalo — no CLI required.

### Exec-Policy from Phone

```
# Check current state
/exec-policy show

# Change preset (2-step confirm for safety)
/exec-policy preset balanced
→ ⚠️ Change exec-policy preset to "balanced"? Reply /exec-policy preset yes within 30s.
/exec-policy preset yes
→ ✅ Preset changed: strict → balanced

# View recent decisions
/exec-policy audit
```

### Config Toggle from Phone

```
# View all configuration
/config
→ Shows: preset, Active Memory on/off, auto-handoff, timeouts

# Toggle Active Memory (2-step confirm)
/config active-memory off
→ ⚠️ Disable Active Memory? Reply /config active-memory yes within 30s.
/config active-memory yes
→ ✅ Active Memory disabled (persisted to config.json)

# Toggle auto-handoff
/config auto-handoff on
→ same confirm flow
```

### Audit Logs from Phone

```
/audit exec-policy          # Last 10 exec-policy decisions
/audit ssrf                 # Last 10 SSRF blocks
/audit webhooks             # Last 10 webhook events
/audit permissions          # Permission audit trail
/audit exec-policy --limit 20
```

### Security Notes

- **Mutations** (`/exec-policy preset`, `/config ... on|off`) require OTT identity via `/link` + 2-step confirmation (30s TTL)
- **Read commands** (`show`, `audit`, `/config` view) are un-gated
- All mutations persist to `~/.endiorbot/config.json` and survive restarts
- Audit trail records both the request and the confirm step

---

## Workflow 15: Web API (Sprint 135)

HTTP endpoints for external tools, scripts, and the upcoming Desktop app (Sprint 136).

### Read Endpoints (no auth on localhost)

```bash
# Full system config
curl http://localhost:18790/api/config | jq .

# Audit logs by type
curl "http://localhost:18790/api/audit/exec-policy?limit=5" | jq .
curl "http://localhost:18790/api/audit/ssrf?limit=10" | jq .
curl "http://localhost:18790/api/audit/webhooks?limit=10" | jq .

# System status (includes Active Memory state)
curl http://localhost:18790/api/status | jq .
```

### Mutation Endpoints (GATEWAY_TOKEN required)

```bash
# Change exec-policy preset
curl -X POST http://localhost:18790/api/config/exec-policy/preset \
  -H "Authorization: Bearer $ENDIORBOT_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"preset":"balanced"}'

# Toggle Active Memory
curl -X POST http://localhost:18790/api/config/active-memory \
  -H "Authorization: Bearer $ENDIORBOT_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'
```

### Security Model

- Gateway binds to `127.0.0.1` by default — GET endpoints are auth-free on localhost
- If you set `ENDIORBOT_GATEWAY_HOST=0.0.0.0`, you accept network exposure risk — add `ENDIORBOT_GATEWAY_TOKEN` and pass it as Bearer token on all API calls
- POST mutations always require `ENDIORBOT_GATEWAY_TOKEN`

---

## Workflow 16: Webhooks Ingress (Sprint 134-135)

Accept inbound webhooks from Zapier, email forwards, or custom integrations.

### Setup

```bash
# 1. Set shared secret (required — fail-closed without it)
export ENDIORBOT_WEBHOOK_SECRET="your-secret-here"

# 2. Start the server
endiorbot serve
```

### Send a Webhook

```bash
curl -X POST http://localhost:18790/api/webhooks/my-trigger \
  -H "x-webhook-secret: $ENDIORBOT_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"from":"zapier","event":"new_email","subject":"Review Q2 report"}'
```

### OTT Commands

```
/webhooks list    → show registered triggers (runtime-only in v1)
/webhooks test    → instructions for testing triggers via curl
```

### Limits

- Rate: 10 requests/min per trigger (configurable via `ENDIORBOT_WEBHOOK_RATE_LIMIT`)
- Auth headers (`x-webhook-secret`, `authorization`) stripped before forwarding to handler
- Audit: `~/.endiorbot/audit-logs/webhooks.log` (JSONL, 10 MB rotation)

---

## Workflow 17: Agent-Model Routing & Fallback (Sprint 140-141)

EndiorBot uses a 3-tier model routing strategy (ADR-052) to optimize cost while maintaining quality. Each agent has a designated primary provider with automatic fallback.

### Agent-Model Mapping

| Tier | Provider | Model | Agents | Rationale |
|------|----------|-------|--------|-----------|
| 1 | claude-code | claude-opus-4 | `@architect`, `@cso`, `@ceo` (3 agents) | Critical reasoning — ADR, security, CEO strategy |
| 2 | claude-code | sonnet | `@coder`, `@reviewer`, `@tester`, `@pm`, `@cpo`, `@cto`, `@fullstack`, `@pjm`, `@researcher`, `@devops` (10 agents) | CC first for codebase access; Kimi fallback on rate-limit |
| 3 | ollama | qwen3.5:9b | `@assistant` (1 agent) | Free tier — routing, delegation, lightweight tasks |

### Kimi Access Paths

| Provider ID | Access Method | Cost |
|-------------|---------------|------|
| `kimi-proxy` | Local `claude-code-proxy` → Kimi OAuth (macOS Keychain) | Free (OAuth) |
| `kimi-api` | Via AI-Platform (centralized Moonshot API key) | Paid (Moonshot) |

**Setup:** If `claude-code-proxy` is already running (e.g. via `claude-kimi` alias), set `ENDIORBOT_KIMI_PROXY_URL` in `.env` to reuse it:

```bash
# Reuse existing proxy — avoids dual-instance conflict
ENDIORBOT_KIMI_PROXY_URL=http://127.0.0.1:18765
```

Without this env var, EndiorBot auto-spawns a proxy subprocess (ADR-051).

### Fallback Chains

**Per-Tier Fallback (ADR-052, Sprint 143 amendment):**

```
Tier 1 (Opus primary):    claude-code → kimi → ollama
Tier 2 (CC-Sonnet primary): claude-code → kimi → ollama
Tier 3 (Ollama primary):  ollama → kimi → claude-code
```

> **Sprint 144:** Tier 2 now uses a circuit breaker. After 2 consecutive CC failures, the circuit opens and Tier 2 routes directly to Kimi for 60s cooldown. See [Workflow 20](#workflow-20-gateway-resilience-sprint-144).

**Cloud Fallback (rate-limit only):**

```
kimi-proxy (OAuth, free) → kimi-api (Moonshot via AI-Platform) → openai
```

**Kimi 429 Recovery (Sprint 141 P0-3):**

```
kimi-proxy 429 → immediate retry via kimi-api → if both fail → claude-code fallback
                 (monitored: >30% 429 rate → promote kimi-api to co-primary)
```

**Ollama Confidence Escalation (Sprint 141 P0-2):**

```
ollama response → confidence scorer → if score < 0.5 AND FF enabled → escalate to kimi
                                       (ENDIORBOT_FF_OLLAMA_AUTO_ESCALATE = false currently, 3-day data)
```

### Source Files

| File | What |
|------|------|
| `src/agents/router/agent-constants.ts` | `AGENT_PROVIDER_MODEL_MAP` + `TIER_FALLBACK_CHAIN` |
| `src/agents/router/providers.ts` | Cloud fallback order, `callKimiProvider()`, `dispatchAgentPrimary()`, `dispatchAgentFallback()` |
| `src/agents/router/ollama-confidence.ts` | Confidence scorer (FF-gated) |
| `src/providers/kimi-proxy/rate-limit-monitor.ts` | Kimi proxy health tracking |

---

## Workflow 18: Cost Monitoring (Sprint 141)

Track per-agent, per-provider costs to validate ADR-052's estimated 45-60% savings.

### CLI Commands

```bash
# Full cost breakdown (agent × provider matrix)
endiorbot cost report

# Today's costs
endiorbot cost report --today

# Filter by agent
endiorbot cost report --agent coder

# Filter by provider
endiorbot cost report --provider kimi

# Weekly summary
endiorbot cost report --week
```

### OTT Commands

```
/cost                    # Current session token usage
```

### What to Monitor

| Metric | Target | Action if Exceeded |
|--------|--------|--------------------|
| `@coder` cost (Kimi) | < 40% of pre-ADR-052 cost | Verify Kimi routing is active |
| Kimi proxy 429 rate | < 30% of Tier-2 calls | Promote `kimi-api` to co-primary |
| Ollama escalation rate | < 20% of `@assistant` calls | Demote `@assistant` from Ollama |
| Total daily cost | Trending down vs. pre-Sprint 140 | Validate ADR-052 ROI |

### Cost Data Location

Persisted to `~/.endiorbot/metrics/YYYY-MM-DD.json`. Each entry records agent, provider, model, tokens (input/output), and estimated cost.

---

## Workflow 19: Desktop App (Sprint 144)

Native desktop application for visual management.

### Launch

```bash
cd apps/desktop && pnpm dev     # Development mode
cd apps/desktop && pnpm build   # Production build (DMG/NSIS/AppImage)
```

### Pages

| Page | Data Source | Description |
|------|------------|-------------|
| Dashboard | Gateway WebSocket | System overview |
| Chat | Gateway WebSocket | AI chat (auto-connects to gateway) |
| Projects | `~/.endiorbot/repos.json` | Registered workspaces |
| Gates | `.sdlc-config.json` | 7 SDLC gate status |
| Experts | Environment variables | Provider status (5 providers) |
| Settings | `.env` file | API key management, theme, gateway port |
| Junior Hub | — | Coming soon |
| Checkpoints | Session state | Session checkpoint browser |
| Fix Stats | Cross-session data | Cross-session fix history |

### Gateway Auto-Start

Desktop app automatically starts the Gateway server as a subprocess when launched. No need to run `endiorbot serve` separately.

- Default port: 18790 (configurable in Settings)
- Auto-fallback to port 18800 if 18790 is occupied
- Gateway process killed cleanly on app quit

### API Key Management

Settings page lets you set/update API keys directly in the UI:
- Anthropic, OpenAI, Gemini, Kimi, Ollama Remote, MCP Gateway, Telegram Bot, GitHub PAT
- Keys saved to `.env` file (never exposed in full — masked display)

---

## Workflow 20: Gateway Resilience (Sprint 144)

### PID Lockfile — Singleton Serve

```bash
endiorbot serve              # Writes PID to ~/.endiorbot/serve.pid
endiorbot serve              # Error: "Already running (PID N). Use --force"
endiorbot serve --force      # Kill existing + take over
```

### Provider Circuit Breaker

After 2 consecutive failures, a provider is temporarily skipped:

```
CC Bridge fails twice → circuit OPEN → skip CC → instant Kimi fallback
  → 60s cooldown → try CC once (half-open)
  → success → circuit CLOSED (recovered)
  → failure → re-open (120s cooldown, max 5min)
```

### OTT vs CLI Timeout

| Channel | CC Timeout | Rationale |
|---------|-----------|-----------|
| Telegram / Zalo / Web / Desktop | 60s | Chat-like responsiveness |
| CLI | 180s | User at terminal, more patient |

### Immediate Acknowledgement

All OTT channels now send `⚡ @agent` immediately when routing, before the AI call starts. No more silent waiting.

---

## Command Reference

### Information Commands (no auth required)

| Command | Description | Channels |
|---------|-------------|----------|
| `/help` | Show all commands | All |
| `/agents` | List available agents | All |
| `/teams` | List tier teams | All |
| `/config` | Show system config (exec-policy, Active Memory, timeouts) | All |
| `/config active-memory on\|off` | Toggle Active Memory (2-step confirm) | All |
| `/config auto-handoff on\|off` | Toggle auto-handoff (2-step confirm) | All |
| `/cost` | Show token usage & cost | All |

### Exec-Policy Commands (Sprint 135)

| Command | Description | Channels |
|---------|-------------|----------|
| `/exec-policy show` | Current preset + effective rules | All |
| `/exec-policy preset <name>` | Change preset (2-step confirm on OTT) | All |
| `/exec-policy audit` | Last 5 exec-policy decisions | All |

### Audit Commands (Sprint 135)

| Command | Description | Channels |
|---------|-------------|----------|
| `/audit exec-policy` | Last 10 exec-policy decisions | All |
| `/audit ssrf` | Last 10 SSRF blocks | All |
| `/audit webhooks` | Last 10 webhook events | All |
| `/audit permissions` | Permission audit trail | All |

### Webhook Commands (Sprint 135)

| Command | Description | Channels |
|---------|-------------|----------|
| `/webhooks list` | Show registered triggers | All |
| `/webhooks test` | How to test a trigger | All |

### SDLC Commands (no auth required)

| Command | Description | Channels |
|---------|-------------|----------|
| `/gate status` | Quality gate status | All |
| `/compliance check` | Check SDLC compliance | All |
| `/compliance score` | Show compliance score | All |
| `/compliance fix` | Auto-fix compliance issues | All |
| `/fix [--dry-run] [--stage N]` | Compliance auto-fix | All |
| `/consult <query>` | Multi-model consultation | All |
| `/init` | Project initialization status | All |

### Bridge Commands (auth required, Telegram only)

| Command | Description |
|---------|-------------|
| `/link` | Bind channel identity (required first) |
| `/launch <agent> [--as role] [--risk mode]` | Launch agent in tmux |
| `/sessions` | List active tmux sessions |
| `/switch <id>` | Switch active session |
| `/capture` | Capture session output |
| `/send <message>` | Send to active session |
| `/kill` | Kill active session |
| `/eval <code>` | Evaluate code in session |
| `/mode <read\|patch>` | Set session risk mode |

**Note:** Bridge commands are registered in the unified CommandDispatcher and work on any channel where the user has run `/link`. The 'Telegram only' label reflects the most common usage pattern, not a technical restriction.

### Remote Commands (auth required, Telegram only)

| Command | Description |
|---------|-------------|
| `/repos [add\|remove name path]` | Manage repositories |
| `/focus <name>` | Set workspace focus |
| `/where` | Show current focus |
| `/cp <src> <dst>` | Copy files in repo |
| `/sh <command>` | Shell command (needs approval) |
| `/attach` | Attach to shell session |
| `/run <command>` | Run with approval queue |

### Team Commands (auth required, Telegram only)

| Command | Description |
|---------|-------------|
| `/team-status` | Show team monitoring |
| `/kill-team` | Kill team session |

### Approval Commands (auth required)

| Command | Description | Channels |
|---------|-------------|----------|
| `/approve` | Approve pending request | All (requires /link) |
| `/reject` | Reject pending request | All (requires /link) |

---

## Troubleshooting

### "Unknown skill" when typing commands in Web UI

**Cause:** Web UI is an AI chat interface. It does NOT support slash commands.
**Solution:** Use Telegram or CLI for commands. Web UI only supports `@agent` mentions for AI chat.

### `/launch` says "Warning: --mode is deprecated"

**Cause:** `--mode` is accepted but deprecated. Use `--risk` instead.
**Solution:** Replace `--mode` with `--risk`:
```
/launch claude --as coder --risk patch
```

### "No active project"

**Cause:** Some CLI commands require an active project via `endiorbot start`.
**Solution:**
```bash
endiorbot start myproject    # Activate a project
endiorbot gate status        # Now works
```

### "EndiorBot already running (PID N)"

**Cause:** PID lockfile at `~/.endiorbot/serve.pid` detected another instance.
**Solution:**
```bash
endiorbot serve --force      # Kill existing + take over
# Or manually:
cat ~/.endiorbot/serve.pid   # Check PID
kill <PID>                   # Kill it
endiorbot serve              # Restart
```

### Agent responses slow after provider failure

**Cause:** Circuit breaker may be open for your primary provider.
**Solution:** Wait 60s for cooldown, or restart `endiorbot serve` to reset all circuits.

### Agent says "no Bash tool available"

**Cause:** Agent launched in READ mode (default). READ mode cannot modify files or run commands.
**Solution:** Relaunch with PATCH mode:
```
/launch claude --as coder --risk patch
```

### Telegram bot not responding

**Cause:** Bot token not set, server not running, or startup stuck on Kimi proxy health check.
**Solution:**
1. Verify `ENDIORBOT_TELEGRAM_BOT_TOKEN` is set in `.env`
2. Ensure `endiorbot serve` is running (not `--no-telegram`)
3. Send `/link` to bind your identity
4. Check logs for "Telegram adapter started" — if missing, startup may be stuck on Kimi proxy health check (10s timeout). Set `ENDIORBOT_KIMI_PROXY_URL` or `ENDIORBOT_DISABLE_KIMI_PROXY=true`

### Server stuck at "Initializing ChannelRouter" or slow startup (~20s)

**Cause:** `claude-code-proxy` is already running externally (e.g. via `claude-kimi` alias). EndiorBot's orchestrator (ADR-051) tries to spawn a new instance, which fails the health check.
**Solution:**
```bash
# Find your existing proxy port
lsof -i -P | grep claude-code-proxy | grep LISTEN

# Set in .env to reuse it (no subprocess spawn)
echo "ENDIORBOT_KIMI_PROXY_URL=http://127.0.0.1:18765" >> .env
```

### Kimi agents returning errors or falling back to OpenAI

**Cause:** Kimi proxy rate-limited (429) or proxy not running.
**Solution:**
```bash
# Check proxy health
curl -s ${ENDIORBOT_KIMI_PROXY_URL}/healthz

# Check rate-limit stats
endiorbot cost report --provider kimi

# If 429 rate > 30%, consider adding KIMI_API_KEY for direct API fallback
```

### Zalo command not responding

**Cause:** Zalo OA access token may be expired (tokens have limited TTL).
**Solution:**
1. Refresh token at Zalo Developer portal
2. Update `ENDIORBOT_ZALO_ACCESS_TOKEN` in `.env`
3. Restart `endiorbot serve`

---

## Environment Variables

Stored in `.env` (git-ignored; `.env.example` is the template). **Primary AI path is Claude Code CLI via OAuth** — no API key required for default chat. Provider priority per [src/providers/init.ts](../../src/providers/init.ts): `claude-code` (OAuth) → `kimi-api` → `kimi-proxy` → `openai` → `ollama` (last resort).

| Variable | Required | Default | Purpose | Since |
|----------|----------|---------|---------|-------|
| `KIMI_API_KEY` | Optional (fallback) | — | Moonshot Kimi API — primary fallback | Sprint 140 |
| `GOOGLE_API_KEY` | Optional | — | Gemini provider + `/consult` | — |
| `OPENAI_API_KEY` | Optional | — | OpenAI provider + `/consult` | — |
| `ENDIORBOT_TELEGRAM_BOT_TOKEN` | For Telegram | — | Telegram bot token | — |
| `ENDIORBOT_TELEGRAM_CHAT_ID` | Optional | — | CEO's private chat id | — |
| `ENDIORBOT_ZALO_ACCESS_TOKEN` | For Zalo | — | Zalo OA access token | — |
| `ENDIORBOT_ZALO_USER_ID` | For Zalo | — | Zalo user ID (recipient) | — |
| `ENDIORBOT_ZALO_OA_ID` | For Zalo | — | Zalo OA ID | — |
| `ENDIORBOT_STATE_DIR` | No | `~/.endiorbot/` | State directory | — |
| `ENDIORBOT_DEBUG` | No | `false` | Debug mode (allows localhost fetch) | — |
| `ENDIORBOT_AUTO_HANDOFF` | No | `false` | Auto-route @mention handoffs | Sprint 131 |
| `ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED` | No | `false` | Per-query context refresh kill switch | Sprint 133 |
| `ENDIORBOT_GATEWAY_PORT` | No | `18790` | Gateway WebSocket port | Sprint 134 |
| `ENDIORBOT_GATEWAY_TOKEN` | For non-localhost Web API mutations | — | Auth token | Sprint 135 |
| `ENDIORBOT_WEBHOOK_SECRET` | For webhook ingress | — | Shared secret (fail-closed) | Sprint 134 |
| `ENDIORBOT_KIMI_PROXY_URL` | No | — | Reuse external `claude-code-proxy` (skip subprocess spawn) | Sprint 141 |
| `ENDIORBOT_DISABLE_KIMI_PROXY` | No | `false` | Skip kimi-proxy entirely | Sprint 140 |
| `ENDIORBOT_FF_OLLAMA_AUTO_ESCALATE` | No | `false` | Auto-escalate low-confidence Ollama responses to Kimi | Sprint 141 |

---

## Architecture Quick Reference

```
User Input → Channel Adapter → GatewayIngress
  ├── /command → CommandDispatcher (39 commands) → Handler → Response
  └── @agent  → ChannelRouter → AI Provider → Response

AI Routing (ADR-052, Sprint 143 CC-first amendment):
  @agent → AGENT_PROVIDER_MODEL_MAP → Primary Provider
    ├── Tier 1: Claude Code (Opus)   — @architect, @cso, @ceo
    ├── Tier 2: Claude Code (Sonnet) — @coder, @reviewer, @tester + 7 more
    └── Tier 3: Ollama (Qwen)        — @assistant

  Fallback chain (all tiers): Claude Code → Kimi → OpenAI → Ollama
    ├── Circuit breaker: 2 CC failures → skip CC → instant Kimi (60s cooldown)
    ├── Kimi access: OAuth proxy (free) → Kimi API (paid) → cloud fallback
    └── OTT timeout: 60s CC then Kimi; CLI: 180s CC then Kimi
```

### State Files

```
~/.endiorbot/
  ├── repos.json          # Registered repositories
  ├── chat-focus.json     # Per-chat workspace focus
  ├── config.json         # Persisted config (exec-policy preset, Active Memory, auto-handoff)
  ├── serve.pid           # PID lockfile (singleton serve)
  ├── exec-policy/        # Exec-policy preset + custom rules (Sprint 132)
  │   └── approvals.json  # Active preset + extra allow/deny patterns
  ├── audit-logs/
  │   ├── exec-policy.log # Command allow/deny/prompt decisions (JSONL, 10MB rotation)
  │   ├── ssrf-blocks.log # Outbound fetch blocks (Sprint 133)
  │   └── webhooks.log    # Webhook events (Sprint 134)
  └── sessions/           # Chat session persistence
```

---

## Related Documentation

- [AI Development Workflows](workflows-ai-development.md) — Use cases mapped to Sau Sheong's "From vibe coding to agentic engineering" + SDLC 6.3.1
- [CLI Reference](../04-build/cli-reference.md) — Full command reference
- [Deploy Guide](../06-deploy/README.md) — Deployment options + exec-policy config
- [ADR-046](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md) — Binding policy for exec-policy + auto-handoff

---

*EndiorBot v0.1.0-beta.1 | Solo Developer Power Tool | SDLC Framework v6.3.1 | Updated Sprint 144 (2026-04-27)*
