---
summary: "EndiorBot CLI + OTT command reference for templates & agent SOULs"
read_when:
  - Updating SOUL/team templates for new EndiorBot features
  - Scaffolding CLAUDE.md or AGENTS.md with command parity
---

# EndiorBot — Command Reference (Templates)

**Pattern:** Thin client — business logic lives in `./endiorbot.mjs` (or `pnpm exec endiorbot`), not in markdown.

**Framework:** SDLC **6.4.0** · **14 roles** (9 SE4A + 4 SE4H + assistant router).

---

## CLI (selected — full list: `./endiorbot.mjs --help`)

| Area | Command | Notes |
|------|---------|--------|
| **Serve** | `endiorbot serve` | Gateway + OTT + bus (unified) |
| **SDLC** | `endiorbot init`, `endiorbot gate …`, `endiorbot compliance …` | Init scaffold; gates; compliance |
| **Fix** | `endiorbot fix …` | Compliance fix (dry-run default) |
| **Consult** | `endiorbot consult "…"` | Multi-model (OpenAI primary + Gemini + Kimi2.6 expert panel) |
| **Plan** | `endiorbot plan "…"` | Structured task plan, **display-only**; saves under `docs/04-build/sprints/drafts/` |
| **Bootstrap** | `endiorbot bootstrap <git-url> …` | Clone → detect ecosystem → init SDLC → optional `--build` |
| **DevOps** | `endiorbot ops build`, `endiorbot ops run …` | Polyglot (Node, Rust, Python, …) via shared detector |
| **Bridge** | `endiorbot bridge …` | Claude Code bridge / sessions |
| **Workflow** | `endiorbot workflow …` | Queue/orchestration (execution depth varies by sprint) |
| **Sprint** | `endiorbot sprint close …` | Automated sprint closure (OTT: `/sprint-close` thin wrapper → same core) |
| **Switch** | `endiorbot switch …` | Project / workspace focus |

---

## OTT (Telegram / Zalo / Web commands)

Slash commands are registered in `CommandDispatcher` — **must stay in sync** with help text in `generateHelpMessage()`.

| Group | Commands |
|-------|-----------|
| **Workflow** | `/approve`, `/reject`, `/status` |
| **SDLC** | `/gate`, `/compliance`, `/compliance fix`, `/fix`, `/init` |
| **AI** | `/consult`, `/plan <description>`, `/agents`, `/teams` |
| **Bridge** | `/link`, `/launch`, `/sessions`, `/switch`, `/capture`, `/send`, `/eval`, `/kill` |
| **Teams** | `/team-status`, `/kill-team` |
| **Remote** | `/repos`, `/focus`, `/where`, `/cp …`, `/sh`, `/attach`, `/run` |
| **System** | `/config`, `/cost`, `/mode`, `/webhook`, `/clear`, `/help` |

**Mentions:** `@agent task`, `@team task` (e.g. `@planning …`, `@mtclaw.*` cross-system where configured).

---

## Agent roles (14)

**SE4A:** researcher, pm, pjm, architect, coder, reviewer, tester, devops, fullstack  

**SE4H:** ceo, cpo, cto, cso  

**Router:** assistant  

---

## Memory (ClawVault)

- Facts may be **injected** into context (read path) when not disabled.
- **Opt-out:** `ENDIORBOT_MEMORY_DISABLED=true`
- Policy: allowlisted observation types, scrubber, TTL, caps — see `src/memory/memory-policy.ts` and ADR-038.

---

## Maintainer note

When adding a CLI command: register in `register-all.ts`, add OTT handler if user-facing, update **this file**, and update SOULs that should mention the capability (e.g. PJM → sprint/plan, DevOps → ops, CEO → plan/bootstrap).
