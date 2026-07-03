# 07-operate — Operate

## Purpose

**How to RUN reliably** — daily workflows, use cases, troubleshooting, and operational guidance.

---

## Daily Workflows

### Developer Workflow (Daily)

```
Morning:
  endiorbot chat                     # Start chat session
  "What's the sprint status?"        # AI summarizes from project context
  /gate status                       # Check pending gates (via OTT or CLI)
  Approve/Reject gates via Telegram  # Tap magic link

During the day:
  @architect "design API for module X"   # Personal SDLC agent team
  endiorbot plan "add feature Y"         # Generate structured plan
  endiorbot consult "Redis vs Postgres?" # Multi-model analysis

Evening:
  "Summarize today's progress"       # In chat session
  /exit                              # Save and close
```

### Developer Workflow

```bash
# 1. Bootstrap a new repo to explore
endiorbot bootstrap https://github.com/user/repo --build

# 2. Initialize SDLC structure
endiorbot init --tier STANDARD

# 3. Work with AI agents
endiorbot @coder --patch "fix the auth bug in login.ts"
endiorbot @reviewer "review the payment module"

# 4. Check quality gates
endiorbot gate status
endiorbot compliance check

# 5. Interactive chat for deep work
endiorbot chat --model ollama       # Free, local, private
```

### OTT Workflow (Telegram / Zalo)

```
/focus my-project                   # Set active repo
@pm plan the next sprint            # Talk to PM agent
@coder fix the login bug            # Talk to Coder agent
/gate status                        # Check gates
/consult "should we use GraphQL?"   # Multi-model consultation
/help                               # Full command list
```

---

## Key Use Cases

### 1. Multi-Model Consultation

Query 2-3 AI models simultaneously for balanced analysis:

```bash
endiorbot consult "microservices vs monolith for a 50K LOC app?"
# → GPT-5.4 analysis + Gemini 2.5-pro analysis + consensus
```

### 2. Project Bootstrap

Try any OSS repo in one command:

```bash
endiorbot bootstrap https://github.com/nicholasareed/glass --build --run
# → Clone → Detect Rust → cargo build → cargo run
```

Supported ecosystems: Docker, Node.js, Rust, Python, Go (detect-only), Java (detect-only).

### 3. Interactive Chat with Project Context

```bash
endiorbot chat
# AI knows your project (IDENTITY.md, git branch, recent commits)
# 40-turn history with auto-compaction
# Switch providers mid-session: /model gemini
```

### 4. SDLC Compliance

```bash
endiorbot init --tier PROFESSIONAL  # Set up 10-stage SDLC
endiorbot compliance check          # Verify structure
endiorbot compliance fix --yes      # Auto-fix missing files
```

### 5. Agent Orchestration (14 SOUL agents)

```bash
endiorbot @pm "plan sprint 130"
endiorbot @architect "design caching layer"
endiorbot @coder --patch "implement Redis cache"
endiorbot @tester "write integration tests"
endiorbot @reviewer "security review the cache module"
endiorbot @cso "audit permission model"
```

### 6. Sprint Planning

```bash
endiorbot plan "add user authentication with JWT"
# → Structured plan with agent assignments, saved to drafts/
```

---

## 5-Channel Operational Matrix (Sprint 144)

| Channel | Start | Port/Address | Status |
|---------|-------|-------------|--------|
| CLI | `endiorbot serve` or any CLI command | n/a | Operational |
| Web | auto on `serve` | `http://localhost:18790` | Operational |
| Telegram | auto on `serve` (token required) | Bot API poll | Operational |
| Zalo | auto on `serve` (token required) | Bot API poll | Operational |
| Desktop | launch Electron app (gateway auto-starts) | subprocess | Operational |

39 commands unified in `CommandDispatcher`. All 5 channels share the same handler surface — no channel-specific command logic.

### PID Lockfile Operations (Sprint 144 T1)

```bash
# Check if serve is running
cat ~/.endiorbot/serve.pid

# Force takeover (kills existing, starts fresh)
endiorbot serve --force

# Clean stop
kill $(cat ~/.endiorbot/serve.pid)
```

The PID file is auto-cleaned on graceful shutdown. Stale files from crashes are detected via process liveness check and removed on next start.

### OTT vs CLI Timeout Differences (Sprint 144 T3)

`originChannel` is threaded from the bus through ingress to the router, so timeout enforcement is channel-aware:

| Channel | Timeout | Rationale |
|---------|---------|-----------|
| Telegram | 60s | OTT message delivery window |
| Zalo | 60s | OTT message delivery window |
| Web | 60s | HTTP request timeout |
| CLI | 180s | Interactive terminal — user is watching |
| Desktop | 60s | Electron IPC (treated as OTT) |

If a model call exceeds the channel timeout, the in-flight request is cancelled and the user receives a timeout error with a retry suggestion.

## Monitoring & Health

```bash
# Gateway health
curl http://localhost:18790/health

# Cost tracking (Sprint 141)
endiorbot cost report                # Per-agent, per-provider cost breakdown
endiorbot cost report --today        # Today's costs
endiorbot cost report --agent coder  # Single agent cost
/cost                               # OTT: token usage & cost
endiorbot chat → /status            # Per-session cost in chat

# Session management
endiorbot chat --resume chat-abc123  # Resume saved chat
/sessions                            # List active tmux sessions
```

### Provider Circuit Breaker (Sprint 144 T2)

The provider layer now wraps each upstream provider call with a circuit breaker. Thresholds:

| State | Trigger | Behavior |
|-------|---------|----------|
| CLOSED (normal) | — | All requests pass through |
| OPEN | 2 consecutive failures | Provider skipped; next provider in fallback chain used |
| HALF-OPEN | 60s after OPEN | 1 probe request allowed |
| CLOSED (recover) | HALF-OPEN probe succeeds | Normal operation resumes |

```bash
# Diagnose open circuits (programmatic)
# In code: providerRouter.getOpenCircuits() → string[]

# Operational signal: if a provider is consistently OPEN, check API key / quota
endiorbot cost report --provider kimi   # Rate-limit and error stats
/status                                 # OTT: surface-level circuit status
```

When a circuit is OPEN the fallback chain activates automatically: `claude-code → kimi-proxy → kimi-api → openai → ollama`. No manual intervention needed for transient outages.

### Kimi Provider Monitoring (Sprint 140–141)

```bash
# Kimi proxy health check
curl -s ${ENDIORBOT_KIMI_PROXY_URL:-http://127.0.0.1:18765}/healthz

# Cost report filtered by provider
endiorbot cost report --provider kimi   # Kimi usage + rate-limit stats

# Check if proxy is responding (Tier-2 agents depend on this)
# If proxy is down, agents auto-fallback to kimi-api → openai
```

**Rate-limit decision gate:** If Kimi proxy 429 rate > 30%, promote `kimi-api` to co-primary. Monitor via `endiorbot cost report --provider kimi`.

## Autonomous Execution Monitoring (Sprint 132+)

### Exec-Policy Audit Logs

```bash
# Tail recent decisions
endiorbot exec-policy audit

# Or read JSONL directly
tail -20 ~/.endiorbot/audit-logs/exec-policy.log | jq .

# Change preset in your live local instance
endiorbot exec-policy preset balanced
endiorbot exec-policy show            # Verify
```

Each JSONL record: `timestamp`, `session_id`, `preset`, `command` (scrubbed), `decision` (`allow`/`deny`/`prompt`), `reason`, `origin_channel`, `auto_handoff`. 10 MB rotation, `0o600` permissions.

### SSRF Block Logs (Sprint 133 S2)

```bash
tail -20 ~/.endiorbot/audit-logs/ssrf-blocks.log | jq .
```

Records: `timestamp`, `url` (scrubbed), `reason`, `provider`, `session_id`.

### Active Memory Operations (Sprint 133 S1)

**Kill switch (CEO only):**
```bash
# Disable immediately if latency regresses
export ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED=false
# Or in .env: ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED=false
```

**Circuit breaker states:**
```
CLOSED (normal) → 3 consecutive failures → OPEN (skip sub-agent, fail-open)
                                              → 30s cooldown → HALF_OPEN (allow 1 attempt)
                                                                 → success → CLOSED
```

When breaker is OPEN: main reply still delivered (fail-open, no context injected). CEO perceives "no context enrichment" but never "no response". Logs breaker events to console.error.

**Hard bounds:** ≤500 tokens injected, ≤50ms cache-hit, ≤300ms cache-miss, 15s default TTL.

### Auto-Handoff Safety (Sprint 131)

```bash
# Enable power mode (routes @mentions without CEO prompt)
export ENDIORBOT_AUTO_HANDOFF=true

# Safety cap: MAX_HANDOFF_DEPTH=3 (hardcoded, not configurable)
# Chains deeper than 3 are blocked even with AUTO_HANDOFF=true
```

Monitor via existing agent audit logs. Composition with exec-policy: see [ADR-046 6-cell matrix](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md).

### Ollama Confidence Monitoring (Sprint 141)

`@assistant` (Tier 3, Ollama primary) has a heuristic confidence scorer. Responses below threshold auto-escalate to Kimi.

| Confidence | Action |
|-----------|--------|
| >= 0.7 | Accept Ollama response |
| 0.5 – 0.69 | Accept + log warning |
| < 0.5 | Auto-escalate to Kimi |

**Feature flag:** `FF_OLLAMA_AUTO_ESCALATE` — defaults to `false` (data collection mode). Enable after 3-day observation confirms < 20% escalation rate.

## Monitoring Surface Summary

| Log / Metric | Path | What it tells you |
|---|---|---|
| Gateway health | `GET /health` on port 18790 | Service is up |
| PID lockfile | `~/.endiorbot/serve.pid` | Whether serve is already running |
| Provider circuit breaker | `providerRouter.getOpenCircuits()` / `/status` | Which providers are degraded |
| Exec-policy audit | `~/.endiorbot/audit-logs/exec-policy.log` | What commands were allowed/denied/prompted |
| SSRF blocks | `~/.endiorbot/audit-logs/ssrf-blocks.log` | Outbound fetch attempts to private IPs |
| Token cost | `endiorbot cost report` or `/cost` (OTT) | Per-agent, per-provider cost |
| Kimi proxy health | `curl $ENDIORBOT_KIMI_PROXY_URL/healthz` | Proxy availability for Tier-2 agents |
| Kimi 429 rate | `endiorbot cost report --provider kimi` | Rate-limit frequency |
| Ollama confidence | Server logs (confidence scorer) | Escalation rate for Tier-3 |
| Active Memory | Feature flag + circuit breaker state | Context enrichment health |
| Channel timeouts | Server logs (`originChannel` tag) | OTT 60s vs CLI 180s enforcement |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `endiorbot serve` exits with "already running" | A previous instance is running. Use `--force` to take over, or `kill $(cat ~/.endiorbot/serve.pid)` to stop it first |
| Stale PID file after crash | Delete `~/.endiorbot/serve.pid` manually, then `endiorbot serve` |
| Port 18790 in use | `ENDIORBOT_GATEWAY_PORT=18800 endiorbot serve` — check `lsof -i :18790` for conflicts (Claude Code extension may occupy nearby ports) |
| Telegram not responding | Check `ENDIORBOT_TELEGRAM_BOT_TOKEN` in `.env`; verify gateway fully started (look for "Telegram adapter started" in logs) |
| Provider circuit OPEN (all retries exhausted) | `endiorbot cost report` to identify the failing provider; check API key / quota; circuit auto-recovers after 60s |
| OTT message timeout (60s) | Long-running agent task. Use CLI (`endiorbot @coder ...`) for tasks that take > 45s; CLI timeout is 180s |
| Desktop app: gateway not responding | Gateway subprocess may have crashed. Restart Desktop app; it will re-launch the gateway |
| Kimi proxy health check timeout (10s) | An external `claude-code-proxy` may already be running. Set `ENDIORBOT_KIMI_PROXY_URL=http://127.0.0.1:<port>` to reuse it instead of spawning a new one. Check `ps aux \| grep claude-code-proxy` |
| Kimi proxy dual-instance conflict | `claude-code-proxy` installed globally (for `claude-kimi` alias) conflicts with EndiorBot's auto-spawn. Fix: set `ENDIORBOT_KIMI_PROXY_URL` to the existing proxy URL, or `ENDIORBOT_DISABLE_KIMI_PROXY=true` to skip entirely |
| Server stuck at "Initializing ChannelRouter" | Kimi proxy health check blocking startup. Same fix: `ENDIORBOT_KIMI_PROXY_URL` or `ENDIORBOT_DISABLE_KIMI_PROXY=true` |
| Agent says "no Bash tool" | Agent is in READ mode; use `--risk patch` |
| Chat: "Provider not available" | Check API key for selected provider; check circuit breaker status |
| Bootstrap: "Toolchain not found" | Install ecosystem toolchain first |
| Exec-policy blocking agent commands | `endiorbot exec-policy preset open` (temporary); review audit log for false positives |
| Active Memory latency spike | `ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED=false` (immediate kill switch) |
| SSRF blocking kimi-proxy on localhost | Set `ENDIORBOT_KIMI_PROXY_URL` in `.env` — the SSRF allowlist trusts configured local provider URLs (Sprint 141 fix) |
| SSRF blocking legitimate API call | Check `~/.endiorbot/audit-logs/ssrf-blocks.log` for the blocked URL; if false positive, file a bug against `src/security/http-validator.ts` |
| Auto-handoff chain stuck | Check if depth ≥ 3 (MAX_HANDOFF_DEPTH cap); reduce @mention chain depth |

---

## Alignment

- **Upstream:** [06-deploy](../06-deploy/) (what was shipped), [03-integrate](../03-integrate/) (live integrations)
- **Downstream:** [09-govern](../09-govern/) (retros, RFCs), [04-build](../04-build/) (fixes)
- **ADRs:** [ADR-046 Autonomous Execution Policy](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md)
- **Sprints:** [Sprint 132](../04-build/sprints/sprint-132-openclaw-backport.md), [Sprint 133](../04-build/sprints/sprint-133-active-memory-ssrf.md), [Sprint 140](../04-build/sprints/sprint-140-plan.md), [Sprint 141](../04-build/sprints/sprint-141-plan.md), [Sprint 144](../04-build/sprints/sprint-144-plan.md)
- **Spine:** [stage-command-workflow-spine.md](../00-foundation/stage-command-workflow-spine.md)

---

*EndiorBot | SDLC Framework **6.4.0** — Stage 07: Operate — Updated Sprint 145 (2026-04-27)*
