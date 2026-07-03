# 01-planning — Planning

## Purpose

**Key question:** **WHAT** are we building — scope, requirements, acceptance criteria, backlog?

Planning **feeds design (02)** and is **tested against (05)** via acceptance criteria. No feature work without traceable requirements.

---

## Alignment

- **Upstream:** [`../00-foundation/product-vision.md`](../00-foundation/product-vision.md), [`../00-foundation/stage-command-workflow-spine.md`](../00-foundation/stage-command-workflow-spine.md)  
- **Downstream:** `docs/02-design/` (ADRs, specs), `docs/03-integrate/` (contracts)  
- **Gates:** G0.1 (problem), G1 (requirements)  
- **Stage index:** [`../README.md`](../README.md)

---

## EndiorBot command hints (this stage)

| Type | Examples |
|------|----------|
| **Atomic** | `endiorbot plan "…"` / `/plan` — structured task draft → `docs/04-build/sprints/drafts/`; `consult` / `/consult` — multi-model input (CEO decides). |
| **Workflow** | `init` + compliance **check** after scope change; sprint planning with PJM in agent layer. |

Catalog: [`../reference/templates/COMMANDS.md`](../reference/templates/COMMANDS.md).

---

## Stage artifacts (living)

| Artifact | Status | Owner |
|----------|--------|-------|
| Requirements / user stories | Populate under `docs/01-planning/` | @pm + @pjm |
| Gate evidence | G0.1 / G1 | @cpo / @ceo per tier config |

---

## Sprint History (Recent)

| Sprint | Focus | Status |
|--------|-------|--------|
| 139 | OpenMythos evaluator optimization (#1-4) | CLOSED |
| 140 | Kimi k2.6 integration + ADR-052 tier mapping | CLOSED |
| 141 | Cost telemetry + Ollama confidence + Kimi resilience | CLOSED |
| 142 | Anti-drift improvements + vendor-agnostic provider refactor | CLOSED |
| 143 | Brain L2 activation + gate mark + gateway resilience hotfixes (7 issues) | CLOSED |
| 144 | Gateway hardening: PID lockfile + circuit breaker + OTT timeout + Kimi deprecation + community publish + desktop channel | CLOSED |
| **145** | **ADR-003 + ADR-006 added; docs consistency pass (51 ADRs, 5-channel parity)** | **IN PROGRESS** |

Full sprint index: [`../04-build/sprints/SPRINT-INDEX.md`](../04-build/sprints/SPRINT-INDEX.md)

## Sprint 144 Planning Highlights

### T1: PID Lockfile

Prevents duplicate `endiorbot serve` processes. Writes `~/.endiorbot/serve.pid` on startup; subsequent invocations detect existing PID and exit cleanly. `--force` flag bypasses the check for development use.

### T2: Provider Circuit Breaker

2 consecutive CC failures → circuit opens → instant Kimi fallback (no timeout wait). 60s cooldown before half-open probe. Exponential backoff up to 5 minutes max. Pattern reuses Active Memory in-memory state design.

### T3: OTT Timeout 60s

Telegram/Zalo/Web CC timeout reduced from 180s → 60s, then falls through to Kimi. CLI remains 180s. `originChannel` threaded through bus consumer → ingress → router to enable channel-aware routing.

### T4: Kimi Subprocess Deprecation

`kimi-subprocess` internal mode deprecated with `console.warn`. Docs updated to point to `ENDIORBOT_KIMI_PROXY_URL` external proxy pattern as the supported path.

### Community Publish Cleanup

- `src/mtclaw/` renamed to `src/mcp-gateway/` (`McpGatewayBridge`; backward-compat aliases retained)
- `"nqh"` provider key renamed to `"self-hosted"` in budget system
- "CEO Power Tool" → "Solo Developer Power Tool" across 337 docs + source files
- Internal URLs (nqh-internal.example, nhatquangholding.com) → endior.net / example.com
- npm package: `@dttai/endiorbot` → `endiorbot`
- 3 sensitive docs moved to `10-Archive/`
- Domain: endior.net (owner-controlled)

### Desktop Channel

All 7 pages functional: Dashboard, Chat (auto-gateway attach), Projects (live data from `repos.json`), Gates (7 SDLC gates rendered), Experts (provider status), Settings (API key management), Junior Hub. Gateway auto-starts as Electron subprocess on launch. TypeCheck clean, build clean.

### Command Parity Audit

- 39 commands in unified `CommandDispatcher` (up from 37)
- `/status` and `/clear` added to dispatcher (previously missing)
- Immediate `⚡ @agent` acknowledgement on all OTT channels before AI call
- All 5 channels verified: CLI, Web, Telegram, Zalo, Desktop

---

## Sprint 143 Planning Highlights

### Gate Mark — Team-Level Gate Progression

**Problem:** 10 gate checklist items with `autoCheck: false` required CEO `--force` override — no team-level mechanism existed. CEO quote: *"đã confirm mà phải dùng force luôn luôn là không đúng"*.

**Solution:** New `gate mark` subcommand enables teams to mark manual items as complete with evidence trail:

```bash
endiorbot gate mark G1 g1-stakeholder-signoff --pass --evidence "CEO approved via Telegram 2026-04-26"
endiorbot gate confirm G1 --confirm   # succeeds without --force
```

- Evidence persisted in `~/.endiorbot/evidence/<projectId>/gate-marks.json`
- `--evidence` flag mandatory for audit trail
- CEO `--force` override unchanged — `gate mark` is the team-level path

### CC-First Routing (ADR-052 Amendment)

All Tier 2 SDLC agents now use Claude Code (sonnet) as primary provider. Kimi is fallback on rate-limit only. CEO directive: *"dù dùng CC hay Kimi thì vẫn phải đọc codebase"* — workspace context injected for ALL intents, not PATCH-only.

### OGA Sprint 1 (Track B — Separate Project)

NQH Creative Studio (Open-Generative-AI) Sprint 1 kicked off — fork, rebrand, provider abstraction, local image generation via mflux on Apple Silicon. Managed by EndiorBot via `endiorbot repos add oga`.

## Current Stats

- **8,124+ tests** passing
- **39 commands** in unified CommandDispatcher, 30+ OTT commands
- **14 SOUL agents** across 3 tiers (CC-first for Tier 2)
- **5 active providers** (Claude Code, Kimi proxy, Kimi API, OpenAI, Ollama)
- **5 channels** active: CLI, Web, Telegram, Zalo, Desktop
- **2 moderate vulnerabilities** (dev-only, down from 37)

---

*EndiorBot | SDLC Framework **6.4.0** — Stage 01: Planning — Updated Sprint 145 (2026-04-27)*
