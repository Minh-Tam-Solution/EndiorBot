# 06-deploy — Deploy

## Purpose

**How to RUN EndiorBot on the developer's local MacBook.**

EndiorBot is a **Solo Developer Power Tool** with a **local-only scope** (locked 2026-04-19, see [`AGENTS.md`](../../AGENTS.md) → "Handoff Boundary"). The deployment options below are all single-host, single-user setups. EndiorBot does **not** target remote production infrastructure, multi-user platforms, or GPU servers. The Docker option exists to sandbox EndiorBot locally, not as a path to remote/cluster deployment.

---

## Quick Start

```bash
# 1. Build the project
pnpm build

# 2. Run locally (all channels)
endiorbot serve

# 3. Or run specific channels
endiorbot serve --no-zalo           # Skip Zalo adapter
endiorbot serve --port 3000         # Custom port

# 4. Docker deployment
docker build -t endiorbot .
docker run -p 18790:18790 --env-file .env endiorbot serve
```

## Deployment Options

### Option A: Local / Development

```bash
endiorbot serve                     # Web + Telegram + Zalo on port 18790
```

Access:
- Web UI: `http://localhost:18790`
- Telegram: message your bot
- Zalo: message your bot

### Option B: npm Global Install

> Beta channel during pre-1.0: use `@beta` qualifier.

```bash
npm install -g endiorbot@beta
endiorbot init --tier STANDARD
endiorbot serve
```

### Option C: npx (No Install)

```bash
npx endiorbot@beta serve
npx endiorbot@beta init
```

### Option E: Desktop App (Electron)

Built with Electron — ships as a native desktop application alongside the CLI/Web channels.

```bash
# Development
cd apps/desktop && pnpm dev

# Production build
pnpm build:desktop

# Distributable packages (via electron-builder)
pnpm dist:mac      # Mac DMG (universal)
pnpm dist:win      # Windows NSIS installer
pnpm dist:linux    # Linux AppImage
```

The Desktop app auto-starts the gateway as a subprocess when Electron launches. No separate `endiorbot serve` needed. Settings IPC uses `nodeIntegration: true` (no preload bridge required). All 7 pages are functional: Dashboard, Chat, Projects, Gates, Experts, Settings, Junior Hub.

### Option D: Docker

```bash
docker build -t endiorbot .
docker run -d \
  -p 18790:18790 \
  --env-file .env \
  --name endiorbot \
  endiorbot serve
```

## Environment Variables

### Auth Model

**Default primary provider: Claude Code CLI via OAuth** (e.g. Claude Max 200 subscription). EndiorBot invokes the `claude` CLI process; no API key is extracted or required for the default chat path. Reference: [src/providers/init.ts](../../src/providers/init.ts) + ADR-043-A1.

API keys are only needed for non-default providers or `/consult` multi-model routing. Provider priority (ADR-051): `claude-code` (OAuth) → `kimi-api` → `kimi-proxy` → `openai` → `ollama` (last resort).

Secrets live in `.env` (git-ignored). `.env.example` is the template.

### Provider Keys

| Variable | Required | Description |
|----------|----------|-------------|
| `KIMI_API_KEY` | Optional (fallback) | Moonshot Kimi API — direct API fallback |
| `ENDIORBOT_KIMI_PROXY_URL` | Optional | Reuse an externally-managed `claude-code-proxy` (e.g. `http://127.0.0.1:18765`). Skips subprocess spawn. Sprint 141. |
| `ENDIORBOT_DISABLE_KIMI_PROXY` | Optional | Set `true` to skip kimi-proxy entirely |
| `GOOGLE_API_KEY` | Optional | Gemini provider + `/consult` multi-model (legacy) |
| `OPENAI_API_KEY` | Optional | OpenAI provider + `/consult` multi-model |
| `OLLAMA_URL` | Optional | Local Ollama fallback |

### Channel Adapters

| Variable | Required | Description |
|----------|----------|-------------|
| `ENDIORBOT_TELEGRAM_BOT_TOKEN` | For Telegram | Bot token from BotFather |
| `ENDIORBOT_TELEGRAM_CHAT_ID` | Optional | CEO's private chat id (for notifications) |
| `ZALO_BOT_TOKEN` | For Zalo | Zalo bot token |

### Gateway

| Variable | Required | Description |
|----------|----------|-------------|
| `ENDIORBOT_GATEWAY_PORT` | Optional | Gateway port (default: 18790) |
| `ENDIORBOT_GATEWAY_TOKEN` | For non-localhost Web API mutations | Auth token (Sprint 135 CPO-2) |
| `ENDIORBOT_AUTO_HANDOFF` | Optional | Auto-handoff from @mentions (default: `false`). Set `true` for power mode — routes without CEO prompt. Sprint 131. |
| `ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED` | Optional | Per-query context refresh (default: `false`). Kill switch — CEO flips directly. Sprint 133. |

### Config Externalization (Sprint 134)

All timeout values are read from environment variables with fallback defaults — override any value at runtime without redeployment. Source of truth: `src/config/timeouts.ts`.

| Variable | Default | Description |
|----------|---------|-------------|
| `ENDIORBOT_MODEL_TIMEOUT_MS` | 30000 | Per-model API call timeout |
| `ENDIORBOT_CHAT_TIMEOUT_MS` | 60000 | Total chat handler timeout |
| `MTCLAW_TIMEOUT_MS` | 130000 | MCP agent chat timeout |
| `MTCLAW_DEFAULT_TIMEOUT_MS` | 30000 | MCP tool call timeout |
| `ENDIORBOT_OPENAI_TIMEOUT_MS` | 30000 | OpenAI provider timeout |
| `ENDIORBOT_CLAUDE_TIMEOUT_MS` | 300000 | Claude Code CLI timeout |
| `ENDIORBOT_SESSION_IDLE_TIMEOUT_MS` | 1800000 | Session idle timeout (30 min) |
| `ENDIORBOT_FEEDBACK_WINDOW_MS` | 7200000 | RL feedback window (2 h) |

### Webhooks Ingress (Sprint 134)

EndiorBot accepts inbound webhooks from external systems (Zapier, email forwards).

```bash
# Required: set a shared secret (fail-closed without it — all requests 401)
export ENDIORBOT_WEBHOOK_SECRET="your-secret-here"

# Optional: rate limit per trigger per minute (default: 10)
export ENDIORBOT_WEBHOOK_RATE_LIMIT=10
```

Webhook endpoint: `POST /api/webhooks/:triggerId` with `x-webhook-secret` header.

Triggers are registered programmatically at runtime. Audit log: `~/.endiorbot/audit-logs/webhooks.log` (JSONL, 10 MB rotation, `0o600` permissions).

See `.env.example` for full list.

## DevOps Commands

```bash
# Ecosystem-aware build & run
endiorbot ops build                 # Detects ecosystem, runs build
endiorbot ops run                   # Detects ecosystem, runs start
endiorbot ops dev                   # Detects ecosystem, runs dev mode

# Bootstrap any repo
endiorbot bootstrap <url> --build --run
```

## New CLI Commands (Sprint 131–135)

```bash
# Unified command discovery (Sprint 132 M0)
endiorbot commands                    # List all commands across 4 channels
endiorbot commands --json             # JSON envelope output

# Exec-policy management (Sprint 132 M1)
endiorbot exec-policy show            # Current preset + effective allowlist
endiorbot exec-policy preset balanced # Set preset (open / balanced / strict)
endiorbot exec-policy allow "pnpm *"  # Add to allowlist
endiorbot exec-policy deny "rm -rf *" # Add to hard-deny
endiorbot exec-policy list            # Show full policy
endiorbot exec-policy audit           # Recent audit decisions

# OTT commands — same from Telegram / Zalo (Sprint 135)
# /exec-policy show | preset <name> | audit
# /config                             # View all config
# /config active-memory on|off        # Toggle Active Memory
# /config auto-handoff on|off         # Toggle auto-handoff
# /audit exec-policy|ssrf|webhooks    # View audit logs
# /webhooks list|test                 # Webhook management
```

## Web API Endpoints (Sprint 135)

```bash
# Read-only (no auth on localhost; requires GATEWAY_TOKEN if 0.0.0.0)
GET  /api/config                      # System config JSON
GET  /api/audit/exec-policy?limit=10  # Audit log entries
GET  /api/audit/ssrf?limit=10
GET  /api/audit/webhooks?limit=10
GET  /api/status                      # System status + Active Memory

# Mutations (ENDIORBOT_GATEWAY_TOKEN required)
POST /api/config/exec-policy/preset   # Body: {"preset":"balanced"}
POST /api/config/active-memory        # Body: {"enabled":true}
```

## Exec-Policy Preset Configuration

Per [ADR-046](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md), exec-policy fires BEFORE Autonomy Gates A/B/C:

| | `AUTO_HANDOFF=false` (default) | `AUTO_HANDOFF=true` (power mode) |
|---|---|---|
| **strict** | handoff prompt + per-command prompts (max safety) | silent dispatch + per-command prompts |
| **balanced** | handoff prompt + selective prompts (**recommended for `serve`**) | silent routing + risky-cmd prompts |
| **open** | handoff prompt then largely silent | closest to L3 autonomy (bounded by Gate B/C) |

**Production recommendation:** `balanced` preset + `ENDIORBOT_AUTO_HANDOFF=true` for `serve` mode.

## Audit Log Paths

| Log | Path | Format | Rotation |
|-----|------|--------|----------|
| Exec-policy decisions | `~/.endiorbot/audit-logs/exec-policy.log` | JSONL | 10 MB |
| SSRF blocks | `~/.endiorbot/audit-logs/ssrf-blocks.log` | JSONL | 10 MB |
| Webhook events | `~/.endiorbot/audit-logs/webhooks.log` | JSONL | 10 MB |

All audit files created with `0o600` permissions (owner read/write only). Sprint 133 Task 1.

## Kimi Proxy Deployment (Sprint 140–144)

EndiorBot supports Kimi k2.6 as a Tier-2 primary provider for 10 of 14 agents (ADR-052). Two modes:

### Mode 1: External Proxy (Recommended — Sprint 144 T4)

Run `claude-code-proxy` as a standalone service (e.g. via `claude-kimi` alias or `claude-code-proxy serve`), then point EndiorBot at it:

```bash
# Start the proxy externally (once, persists across EndiorBot restarts)
claude-code-proxy serve --port 18765

# Add to .env — EndiorBot reuses the proxy, no subprocess spawn
ENDIORBOT_KIMI_PROXY_URL=http://127.0.0.1:18765
```

Sprint 144 T4 formally deprecates the auto-subprocess spawn path. The external proxy approach avoids dual-instance conflicts, 10s health-check timeouts, and orphaned subprocesses on unexpected shutdown.

### Mode 2: Auto-Managed Subprocess (Deprecated — ADR-051)

Without `ENDIORBOT_KIMI_PROXY_URL`, EndiorBot previously auto-detected `claude-code-proxy` in PATH, spawned on a dynamic port, and health-checked within 10s. This path still works but is deprecated in Sprint 144. Prefer Mode 1 for all new deployments.

### Agent-Model Tier Mapping (ADR-052)

| Tier | Provider | Agents |
|------|----------|--------|
| 1 (Critical) | Claude Opus | `@architect`, `@cso`, `@ceo` |
| 2 (Standard) | Kimi k2.6 | `@coder`, `@reviewer`, `@tester`, `@pm`, `@cpo`, `@cto`, `@fullstack`, `@pjm`, `@researcher`, `@devops` |
| 3 (Free) | Ollama | `@assistant` |

Fallback chain: `kimi-proxy → kimi-api → openai → ollama`.

### Port Conflict Note

`ENDIORBOT_GATEWAY_PORT` must not conflict with other services on localhost. Claude Code extension (VSCode) may occupy ports in the 18790+ range. Check with `lsof -i :18791` before starting. Default: 18790.

## PID Lockfile (Sprint 144 T1)

`endiorbot serve` writes a PID file to `~/.endiorbot/serve.pid` on startup. If the file exists with an active PID, a second `serve` invocation exits immediately with an informative error — preventing accidental duplicate gateways.

```bash
# Normal start
endiorbot serve

# Force takeover (kills existing process, starts fresh)
endiorbot serve --force

# Check if currently running
cat ~/.endiorbot/serve.pid
```

The PID file is cleaned up on clean shutdown (SIGTERM/SIGINT). Stale files from a crash are detected via process existence check and auto-removed.

## Community Publish Checklist (Sprint 144)

Before publishing to npm / endior.net:

| Item | Status |
|------|--------|
| Package name: `endiorbot` (no scope prefix) | Done |
| Domain: endior.net | Done |
| `src/mcp-gateway/` (was `src/mtclaw/`) | Done |
| "Solo Developer Power Tool" identity | Done |
| MIT license + CONTRIBUTING.md + SECURITY.md | Done |
| Internal URL references removed | Done |
| 8,124+ tests pass | Done |

## Pre-Deploy Checklist

```bash
# 1. Build clean
pnpm build

# 2. All tests pass (8142+ expected)
pnpm test

# 3. Type check
pnpm tsc --noEmit

# 4. Compliance check
endiorbot compliance check

# 5. Gate status
endiorbot gate status

# 6. Exec-policy verification
endiorbot exec-policy show

# 7. Kimi proxy health (if using external)
curl -s ${ENDIORBOT_KIMI_PROXY_URL}/healthz

# 8. Check no duplicate serve running
cat ~/.endiorbot/serve.pid 2>/dev/null || echo "No existing serve"
```

---

## Alignment

- **Upstream:** [05-test](../05-test/) (verification), [04-build](../04-build/) (artifacts), [02-design](../02-design/) (NFRs)
- **Downstream:** [07-operate](../07-operate/) (monitoring, incidents)
- **Gates:** G4 (deploy readiness)
- **ADRs:** [ADR-046 Autonomous Execution Policy](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md)
- **Spine:** [stage-command-workflow-spine.md](../00-foundation/stage-command-workflow-spine.md)

## Stage Artifacts

| Artifact | Location | Owner |
|----------|----------|-------|
| This deployment guide | `docs/06-deploy/README.md` | @devops |
| Sprint launch checklists | `docs/06-deploy/sprint-*.md` | @devops + @cto |
| Environment config template | `.env.example` | @devops |

---

*EndiorBot | SDLC Framework **6.3.1** — Stage 06: Deploy — Updated Sprint 145 (2026-04-27)*
