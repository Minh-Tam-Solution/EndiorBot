# PRD — openclaw Backport (Sprint 132–134) ✅ COMPLETE

**Feature:** Selective port of openclaw patterns to EndiorBot
**Owner:** @pm
**SDLC Stage:** 01-PLANNING (Post-Delivery)
**Framework:** SDLC 6.4.0
**Status:** COMPLETE — All M0, M1, S1, S2, C2 items delivered across Sprints 132-134
**Authority:** CTO G2 APPROVED (v3) · CPO Approved (light conditions) · CEO decisions locked 2026-04-11
**Delivery confirmed:** Sprint 132 (M0+M1 CLOSED), Sprint 133 (S1+S2 CLOSED), Sprint 134 (C2 CLOSED)
**Source plan:** `/Users/dttai/.claude/plans/glistening-nibbling-mist.md` (Plan v3)
**Identity check:** ✅ All items pass Solo Developer Power Tool (LOCKED) filter

---

## 1. Problem Statement (from G0.1)

EndiorBot was ported from openclaw ~3 months ago. openclaw has since matured on stabilization, plugin architecture, and several new capabilities (commands.list RPC, exec-policy cluster, Active Memory, webhooks, memory-wiki). CEO needs to know **which of these patterns are worth backporting to strengthen EndiorBot's Solo Developer Power Tool role**, without violating the identity lock or drifting toward a "platform".

**Pain points validated during plan review:**
- CEO can't remember ~33 commands across 4 channels (Web / Telegram / Zalo / CLI) → fixed by M0
- Autonomous agent (Sprint 72) has no command-granularity allowlist → fixed by M1
- Context-dependent CEO questions get stale context (Brain L4 loads only at session start, verified F3) → fixed by S1
- No CEO-controlled audit of native fetch/webhook paths → fixed by S2

---

## 2. Proposed Solution (High-level)

Port **4 patterns** across 2 sprints, with 2 conditional additions:

| ID | Pattern | Sprint | MoSCoW | Status |
|---|---|---|---|---|
| M0 | `commands.list` RPC + `endiorbot commands` subcommand | 132 opener | MUST | ✅ SHIPPED Sprint 132 |
| M1 | `exec-policy` CLI + approvals cluster | 132 | MUST | ✅ SHIPPED Sprint 132 |
| S1 | Active Memory sub-agent w/ 15s cache | 133 | SHOULD | ✅ SHIPPED Sprint 133 |
| S2 | Native fetch / webhook SSRF audit (rescoped) | 133 | SHOULD | ✅ SHIPPED Sprint 133 |
| C2 | Webhooks ingress (Zapier + Email only) | 134 | COULD (CEO-confirmed) | ✅ SHIPPED Sprint 134 |
| C1 | Evidence linter | — | **DROPPED** (CEO decision 2026-04-11 — no use case) | — |

---

## 3. User Stories with Acceptance Criteria

### M0 — Unified command discovery

> **As** CEO
> **I want to** ask EndiorBot "what can you do?" from any channel (Web, Telegram, Zalo, CLI)
> **So that** I don't have to remember 33 commands across 4 interfaces

**Acceptance criteria (Gherkin):**
```
Given EndiorBot is running
When I invoke `/commands` in Telegram
Then I see the same command list as `curl $WEB/rpc {"method":"cmd.list"}`
  And as `endiorbot commands` on CLI
  And as `/commands` in Zalo
  And the count (from envelope meta.total) equals the dispatcher registry count exactly (five equal numbers)

Given a new command is registered via createCommandDispatcher
When I re-invoke any of the four surfaces
Then the new command appears in all four without manual doc sync

Given the cmd.list RPC response envelope
When parsed by any surface
Then the response matches the envelope shape { commands: CmdEntry[], meta: { total, filteredCount, surface, dispatcherVersion, generatedAt } }
  And each CmdEntry includes name (required) and description (required)
  And optional fields category, parameters, sdlcStage are present-but-may-be-empty in v1
```

**Priority:** Must Have (P0)
**Success metric:** Zero instances of CEO asking "what was that command again?" across channels in the 2 weeks post-launch.

**Ground-truth corrections applied 2026-04-11 (from @architect design pass):**
- Method name is `cmd.list`, NOT `commands.list` — the existing gateway schema reserves `cmd.${string}` namespace from Sprint 93.
- `dispatcher.getRegisteredCommands()` is an **instance** method returning `string[]` (names only). Rich metadata (descriptions, parameters, SDLC stage) does **not** exist in the dispatcher today — it lives as hardcoded text in `generateHelpMessage()` at `src/commands/handlers/ott-commands.ts:550`. The v1 design introduces a new `COMMAND_METADATA` table at `src/commands/command-catalog.ts` seeded from that hardcoded text, with name + description as the minimum scaffold. Optional richer fields may stay empty in v1.
- Authoritative design: [docs/02-design/14-Technical-Specs/M0-commands-list-design.md](../../02-design/14-Technical-Specs/M0-commands-list-design.md) (note the actual directory is `14-Technical-Specs`, not `02-technical-specs`).
- Telegram + Zalo `/commands` wiring requires **zero** per-channel adapter edits — OTT ingress already forwards through `CommandDispatcher.dispatch()` via `GatewayIngress.handleInbound()` (`src/gateway/ingress.ts:117,152`). Registering a `commands` handler inside `createCommandDispatcher()` gives both channels `/commands` automatically.

---

### M1 — Command allowlist for autonomous agent

> **As** CEO operating EndiorBot in autonomous mode (Sprint 72 Gates A/B/C)
> **I want to** set a command-granularity policy separate from time/cost budgets
> **So that** I can say "run anything in `balanced` mode but never `rm -rf` or `git push --force`"

**Acceptance criteria (Gherkin):**
```
Given preset `strict` is active
When an autonomous task attempts a Bash call
Then the call is blocked by the approvals layer BEFORE Gate A time/cost logic fires
  And the decision is logged to .endiorbot/audit/ with trace + preset name

Given preset `open` is active
When an autonomous task attempts the same Bash call
Then the call is allowed subject to Gate A/B/C time/cost bounds only

Given the 6-cell matrix (preset × ENDIORBOT_AUTO_HANDOFF) defined in ADR-046 full
When any cell is exercised in test
Then behavior matches the matrix exactly (routing permission, tool-invocation permission, CEO-visible UX)

Given I run `endiorbot exec-policy show`
Then I see: current preset, effective allowlist, last mutation timestamp, audit trail pointer
```

**Priority:** Must Have (P0)
**Dependencies:** ADR-046 full expansion (drafted by @cto, reviewed by @pm + @cpo). Blocked until signed.
**Preset naming (CEO-locked 2026-04-11):** `open` / `balanced` / `strict`. No dual naming in UI. openclaw lineage `yolo`/`cautious`/`deny-all` is internal code comment only.
**Success metric:** CEO can enable unattended autonomous runs with `balanced` preset and zero false-positive blocks on legitimate commands.

---

### S1 — Per-query context refresh (Active Memory)

> **As** CEO asking context-dependent questions across sessions
> **I want to** have recent context injected before the main reply, automatically
> **So that** EndiorBot doesn't feel "amnesiac" when I ask follow-up questions

**Acceptance criteria (Gherkin):**
```
Given Active Memory is enabled (activeMemory.enabled=true)
When I send a query that references earlier session content
Then context is injected before the main agent dispatches
  And total injected tokens ≤ 500
  And cache-hit latency ≤ 50ms
  And cache-miss (sub-agent) latency ≤ 300ms
  And p95 total reply latency delta ≤ 10% vs activeMemory.enabled=false

Given the sub-agent times out
When the timeout fires
Then the circuit breaker opens
  And the main reply still delivers (fail-open, no context)
  And the breaker logs the event

Given CEO flips activeMemory.enabled=false in config
When the next query arrives
Then the feature is fully bypassed within one turn (kill switch works)
```

**Priority:** Should Have (P1)
**Hard preconditions (abort feature if not met):** 500-token cap, 50/300 ms latency bounds, circuit breaker, kill switch, cache TTL default 15s (configurable 1–120s, ported from openclaw).
**Kill-switch ownership (CEO-locked 2026-04-11):** CEO only. No automatic policy. CEO flips the config or runs a CLI command personally.
**Success metric:** CEO subjective "EndiorBot remembers context" improves; objective p95 latency does not regress > 10%.

---

### S2 — Native fetch / webhook SSRF audit (rescoped)

> **As** CEO running EndiorBot which makes outbound HTTP calls (providers, webhooks, gateway)
> **I want** defense-in-depth on those fetch paths
> **So that** a malicious input can't coerce the bot into reaching private-IP / file:// / cloud-metadata endpoints
> **And** legitimate outbound traffic (public APIs, CDNs, webhooks) is never falsely blocked

**Acceptance criteria (Gherkin):**
```
Given the SSRF allowlist layer is active
When a fetch targets 169.254.169.254 (AWS metadata), 127.0.0.1, 10.0.0.0/8, file://, or other private-IP ranges
Then the fetch is blocked with a specific error code
  And the block is logged to .endiorbot/audit/

# FALSE-POSITIVE GUARD (CPO condition)
Given the same allowlist layer
When a fetch targets https://api.github.com/…
Then the fetch succeeds
When a fetch targets a standards-compliant public HTTPS webhook endpoint
Then the fetch succeeds
When a fetch targets an allow-listed CDN or package registry
Then the fetch succeeds
When a redirect chain goes public → public
Then the fetch succeeds (not a false-positive private-IP block)

Given existing pnpm test:security suite
When S2 ships
Then all existing tests remain green
```

**Priority:** Should Have (P1)
**Not a mirror** of openclaw commit `fbf11ebdb7` — that commit is a CDP-for-sandboxed-browser fix, and EndiorBot has no sandboxed browser (wrong vector, per plan v3 R2). This is our own audit of `src/security/` and `src/gateway/` fetch call sites.
**Kill-switch ownership (CEO-locked 2026-04-11):** CEO only.
**Success metric:** SSRF test cases all green; zero legitimate-outbound regressions in production the week after ship.

---

### C2 — Webhooks ingress (conditional, scope-narrowed)

> **As** CEO
> **I want to** forward an email or a Zapier webhook to EndiorBot
> **So that** I can trigger a summary / plan / action without opening a channel

**Acceptance criteria (sketch — full criteria pending @architect design):**
```
Given a Zapier/generic HTTPS webhook POST to the EndiorBot gateway ingress
When the payload matches a registered trigger
Then a command/workflow is dispatched and I receive the result on my preferred channel

Given an email is forwarded to a dedicated EndiorBot inbox (mechanism TBD during design)
When the email is parsed
Then the same trigger flow fires
```

**Priority:** Could Have (P2) — conditional
**CEO-locked scope (2026-04-11):** Zapier / generic HTTPS webhook + Email forward. **Slack inbound rejected** (identity-lock boundary).
**Target sprint:** 134+. Not on the critical path of this backport.

---

## 4. Success Metrics

| Metric | Target | Owner |
|---|---|---|
| M0: CEO "command not found" moments | → 0 per week after Sprint 132 opener | CEO self-report |
| M1: Autonomous run false-positive blocks | 0 under `balanced` preset in first week | Audit log analysis |
| S1: p95 reply latency delta (on vs off) | ≤ 10% | Benchmark suite |
| S2: SSRF block-list + allow-list tests | 100% pass | CI gate |
| C1 (dropped) | — | — |
| C2: CEO-triggered workflow count (if shipped) | ≥ 1/week baseline | Telemetry |

---

## 5. Dependencies and Constraints

**Hard dependencies:**
- **M1 → ADR-046 full expansion** (STUB → full, drafted by @cto, signed by @cpo + @cto, reviewed by @pm). No M1 @architect handoff until signed.
- **S1 → Brain L4 integration verification** — per plan v3 F3, L4 loads only at session start. S1 must augment, not replace.
- **All items → 4 Non-Negotiable Invariants** (Thin Client, stdin-JSON hooks, SOUL=governance/CC=execution, Sonnet default).

**Constraints:**
- 2K tokens/turn, 3 blocks/turn, hard reset every 30 turns (CLAUDE.md).
- Solo developer — no parallel human review; AI agents handle code review, testing, QA.
- Identity LOCKED: Solo Developer Power Tool (not platform, not SDLC enforcer).

---

## 6. Out of Scope (see scope.md for full list)

- C1 evidence linter — **DROPPED** (no CEO use case, identity-drift risk).
- All channels except Web / Telegram / Zalo / CLI (Matrix, Signal, iMessage, Teams, IRC, Feishu, Slack, Discord — identity lock).
- Native mobile apps beyond existing `apps/desktop/`.
- Full plugin SDK / 110+ bundled extensions.
- Seedance 2.0 / Gemma 4 / Arcee providers.
- Tailscale remote gateway pairing.
- Live Matrix/Telegram QA homeservers, multipass runner (C3, openclaw still hardening).
- Codex provider (C4, defer pending telemetry check).
- Talk MLX (platform-bound, not a voice product).

---

## 7. Open Questions

All 4 CEO open questions from plan v3 were resolved on 2026-04-11:
1. ~~C1 use case?~~ → **DROP**
2. ~~C2 triggers?~~ → **Zapier + Email forward, no Slack**
3. ~~M1 preset naming?~~ → **open / balanced / strict**
4. ~~M0 timing?~~ → **Sprint 132 opener**
5. ~~SOUL-pm.md ground-truth step PR?~~ → approved as separate PR, tracked outside this PRD

Remaining open for design phase:
- **M0:** exact schema of `commands.list` response (normalization layer) — @architect decides in Sprint 132
- **M1:** exact file layout of `src/security/exec-approvals/` cluster — @architect decides post ADR-046 full
- **S1:** cache backing store (in-memory Map vs persistent?) — @architect decides

---

## 8. References

- Plan v3 (CTO G2 APPROVED): `/Users/dttai/.claude/plans/glistening-nibbling-mist.md`
- ADR-046 STUB: `docs/02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy-STUB.md` (to be expanded)
- ADR-044: Agentic OS Alignment (referenced by ADR-046)
- Sprint 72: v2.0 Autonomous SDLC Agent (context for M1 layering)
- Sprint 131: CRG wiring + auto-handoff (context for `ENDIORBOT_AUTO_HANDOFF` matrix)
- openclaw reference files:
  - `openclaw/src/gateway/server-methods/commands.ts` (M0)
  - `openclaw/src/cli/exec-policy-cli.ts` + `openclaw/src/infra/exec-approval*` cluster (~30 files, M1)
  - `openclaw/extensions/active-memory/` (S1, especially cache TTL config)
  - `openclaw/extensions/webhooks/` (C2)

---

*EndiorBot | Solo Developer Power Tool (LOCKED) | SDLC 6.4.0 | openclaw-backport PRD*
*Generated by @pm post-G2 approval 2026-04-11 | Status: COMPLETE (Sprint 134 close 2026-04-??)*
