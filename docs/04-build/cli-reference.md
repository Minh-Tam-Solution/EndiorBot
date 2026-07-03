# EndiorBot CLI Reference

**Last Updated**: Sprint 144 (2026-04-27)
**Framework**: SDLC 6.4.0

## Quick Reference

```bash
endiorbot --help              # Show all commands
endiorbot --version           # Show version
```

---

## Agent Commands (Sprint 55-57)

### Agent Invocation

```bash
# Basic agent invocation
endiorbot @pm "plan payment gateway"
endiorbot @architect "design auth system"
endiorbot @coder "implement login endpoint"
endiorbot @reviewer "review PR #123"
endiorbot @tester "write tests for auth module"

# With mode override
endiorbot @coder --patch "fix auth bug"     # Apply as patch
endiorbot @coder --interactive "refactor"   # Interactive mode

# Multi-model consultation
endiorbot @consult "Redis vs PostgreSQL for sessions?"
```

### Available Agents

#### SE4A Agents (All Tiers)

| Agent | Role | Default Mode | Can Hand Off To |
|-------|------|--------------|-----------------|
| `@pm` | Product Manager | READ | architect, pjm |
| `@pjm` | Project Manager | READ | coder, tester |
| `@architect` | System Architect | READ | coder, reviewer |
| `@coder` | Developer | PATCH | reviewer, tester |
| `@reviewer` | Code Reviewer | READ | coder, pm |
| `@tester` | QA Engineer | READ | coder, devops |
| `@researcher` | Research Analyst | READ | pm |
| `@devops` | DevOps Engineer | INTERACTIVE | tester |
| `@assistant` | General Assistant | READ | all SE4A agents |

#### SE4H Agents (STANDARD+ Tier - Advisors Only)

| Agent | Role | Description |
|-------|------|-------------|
| `@ceo` | Chief Executive Officer | Strategic direction, executive review |
| `@cpo` | Chief Product Officer | Product vision, prioritization |
| `@cto` | Chief Technology Officer | Technical standards, architecture review |

> **Note:** SE4H agents are advisors - they provide guidance but cannot delegate to other agents.

```bash
# SE4H invocation (requires STANDARD+ tier)
endiorbot @ceo "review Q1 roadmap"
endiorbot @cpo "prioritize feature backlog"
endiorbot @cto "evaluate architecture options"

# Set tier for SE4H
endiorbot config set tier STANDARD
```

---

## SDLC Control Plane (Sprint 56)

### Gate Commands

```bash
# Show gate status
endiorbot gate status

# Show gate recommendation (read-only)
endiorbot gate recommend G2

# Human confirmation (explicit flag required)
endiorbot gate confirm G2 --confirm
```

### Evidence Commands

```bash
# List evidence
endiorbot evidence list
endiorbot evidence list --gate G2

# Add evidence
endiorbot evidence add ./docs/ADR-001.md --gate G2 --type adr
endiorbot evidence add ./specs/API.yaml --gate G3 --type api

# Verify evidence
endiorbot evidence verify

# Remove evidence
endiorbot evidence remove <evidence-id>
```

### Context Commands

```bash
# Show Brain layer status
endiorbot context status

# Generate context for Claude Code
endiorbot context inject > context.md

# Search across Brain layers
endiorbot context search "payment"

# Clear specific layer
endiorbot context clear --layer L4
```

---

## Project Management

### Project Commands

```bash
# Start new project
endiorbot start <project-id>

# Switch project
endiorbot switch <project-id>

# Show current project
endiorbot status
```

### Session Commands

```bash
# Show session info
endiorbot session info

# List recent sessions
endiorbot session list
```

---

## Configuration

### Config Commands

```bash
# Initialize config
endiorbot config init

# Validate config
endiorbot config validate

# Show config path
endiorbot config path

# Get config value
endiorbot config get tier
endiorbot config get logging.level

# Set config value
endiorbot config set tier STANDARD
endiorbot config set logging.level debug
```

### Secrets Management

```bash
# List configured secrets
endiorbot secrets list
```

---

## Gateway & Channels

### Gateway Commands

```bash
# Show gateway status
endiorbot gateway status

# Start gateway server
endiorbot gateway start

# Stop gateway server
endiorbot gateway stop
```

Default port: `18790`

### Setup Commands

```bash
# Show provider status
endiorbot setup status

# Configure GitHub Models
endiorbot setup github-models

# Configure Telegram
endiorbot setup telegram

# Configure Zalo
endiorbot setup zalo
```

---

## Command Discovery (Sprint 132 M0)

```bash
# Unified command listing — same result across all 4 channels
endiorbot commands                    # Human-readable table
endiorbot commands --json             # JSON envelope { commands, meta }
endiorbot commands --surface cli      # Filter by surface
endiorbot commands --category sdlc    # Filter by category
endiorbot status                      # System + session status summary
endiorbot clear                       # Clear active session context
```

From OTT (Telegram / Zalo): `/commands`, `/status`, `/clear` — return the same result automatically via `GatewayIngress`.

**Note:** As of Sprint 144, EndiorBot registers 39 total commands across CLI, Web, Telegram, Zalo, and Desktop surfaces.

**Five-equal-numbers invariant:** CLI, Web RPC (`cmd.list`), Telegram `/commands`, Zalo `/commands`, and dispatcher registry all return the same count.

---

## Exec-Policy Management (Sprint 132 M1)

Control which commands autonomous agents can execute. Fires BEFORE Autonomy Gates A/B/C.

```bash
# View current state
endiorbot exec-policy show            # Preset, effective allowlist, last mutation
endiorbot exec-policy list            # Full policy detail

# Set preset (open / balanced / strict)
endiorbot exec-policy preset balanced # Recommended for production serve
endiorbot exec-policy preset strict   # Max safety — prompts on every command
endiorbot exec-policy preset open     # Permissive — hard-deny list still applies

# Custom rules
endiorbot exec-policy allow "pnpm *"  # Add to allowlist
endiorbot exec-policy deny "rm -rf *" # Add to hard-deny

# Audit trail
endiorbot exec-policy audit           # Recent decisions (allow/deny/prompt)
```

**Presets:**
- **strict** — deny-by-default, every command prompts CEO. Max friction, max safety.
- **balanced** — common safe commands allowed silently, mutating commands prompt, hard-deny list always blocks. **Recommended for `serve`.**
- **open** — most dev tooling allowed, hard-deny list still applies. Bounded by Gate B PATCH and Gate C cost cap.

**Hard-deny base list** (always blocked regardless of preset): `rm -rf /`, `git push --force` on protected branches, fork bombs, `mkfs.*`, `dd of=/dev/sd*`, etc. Additions require CEO approval.

**Shell metacharacter protection** (Sprint 133): commands containing `;`, `|`, `&&`, `||`, backticks, `$()` are automatically denied before pattern matching (`shell-metachar-rejected`).

**Audit log:** `~/.endiorbot/audit-logs/exec-policy.log` (JSONL, 10MB rotation, `0o600` permissions).

**Composition with auto-handoff:** See [ADR-046 6-cell matrix](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md).

---

## Auto-Handoff (Sprint 131)

```bash
# Enable power mode (routes @mentions without CEO prompt)
export ENDIORBOT_AUTO_HANDOFF=true

# Default: false (every handoff prompts CEO for approval)
# Safety cap: MAX_HANDOFF_DEPTH=3 (hardcoded)
```

When `true`: agents auto-route handoff proposals (e.g., `@pm` → `@architect` → `@coder`) without prompting. Destructive/merge/deploy actions remain gated by CEO approval regardless of this flag ([ADR-046 Binding Sentence](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md)).

---

## Active Memory (Sprint 133 S1)

Per-query context refresh with cache-first pattern. Augments Brain L4 (session-start only) with per-query context injection.

```bash
# Kill switch (CEO only)
export ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED=false   # Disable immediately
export ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED=true    # Enable

# Hard bounds:
# - ≤500 tokens injected per query
# - ≤50ms cache-hit latency
# - ≤300ms cache-miss latency
# - Circuit breaker: fail-open after 3 consecutive failures (30s cooldown)
# - Cache TTL: 15s default (configurable 1–120s)
```

---

## OTT Channel Integration (Sprint 57+)

### Telegram Bot

From Telegram, send messages to `@Endior_bot`:

```
[@pm: plan payment gateway integration]
[@architect: design database schema]
[@consult: should we use PostgreSQL or MongoDB?]
```

### Zalo OA

From Zalo, send messages to `Bot Endior`:

```
[@pm: plan payment integration]
[@coder: fix bug authentication]
```

---

## Budget & Cost

### Budget Commands

```bash
# Show budget status
endiorbot budget status

# Show session cost
endiorbot budget session

# Show daily cost
endiorbot budget daily
```

---

## Checkpoints

### Checkpoint Commands

```bash
# List checkpoints
endiorbot checkpoint list

# Create checkpoint
endiorbot checkpoint create "before refactor"

# Restore checkpoint
endiorbot checkpoint restore <checkpoint-id>
```

---

## Troubleshooting

### Diagnostic Commands

```bash
# Validate configuration
endiorbot config validate

# Check provider connectivity
endiorbot setup status

# Check secrets
endiorbot secrets list

# Check gateway
endiorbot gateway status
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Config not found" | `endiorbot config init` |
| "API key not set" | Check `.env.local` or run `endiorbot setup` |
| "Gateway not running" | `endiorbot gateway start` |
| "Permission denied" | `chmod 700 ~/.endiorbot/` |

---

## Environment Variables

| Variable | Purpose | Default | Since |
|----------|---------|---------|-------|
| `ANTHROPIC_API_KEY` | Anthropic API key | (required) | — |
| `OPENAI_API_KEY` | OpenAI API key | (optional) | — |
| `GOOGLE_API_KEY` | Google Gemini API key | (optional) | — |
| `ENDIORBOT_STATE_DIR` | State directory | `~/.endiorbot/` | — |
| `ENDIORBOT_CONFIG_PATH` | Config file path | `.sdlc-config.json` | — |
| `ENDIORBOT_DEBUG` | Debug mode (allows `localhost` fetch) | `false` | — |
| `ENDIORBOT_GATEWAY_PORT` | Gateway port | `18790` | — |
| `ENDIORBOT_AUTO_HANDOFF` | Auto-route @mention handoffs without CEO prompt | `false` | Sprint 131 |
| `ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED` | Per-query context refresh kill switch | `false` | Sprint 133 |

---

*EndiorBot CLI Reference v2.0 | Sprint 144 | SDLC Framework 6.4.0 | 39 total commands*
