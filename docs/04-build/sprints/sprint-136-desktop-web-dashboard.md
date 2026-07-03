---
sprint: 136
status: DRAFT — Scope partially TBD, awaiting CEO confirmation on Desktop + Web dashboard specifics
start_date: TBD (after Sprint 135 formal close + CEO scope confirmation)
planned_duration: TBD — ~1h verified trivia + Desktop/Web scope (@pm claim: 5.5d, unverified)
framework: "6.4.0"
authority: "@pm draft 2026-04-17 (structural). Desktop/Web scope requires CEO confirmation before binding."
previous_sprint: "Sprint 135 — Surface Parity + P1 Workspace Awareness (IMPLEMENTATION COMPLETE 2026-04-17, awaiting formal close)"
---

# Sprint 136 — Desktop + Web Dashboard + Sprint 135 Carry-Overs

## Context

Sprint 135 closed with P1 Workspace Awareness added on top of the original 8-item scope (commits `2959517`, `b6b192e`, `0da795a`, `9fcdfcb`, `835f5f4`, `9df591f`, `999c325`). This sprint handles the **documentation debt** from Sprint 135 (ADR-048 full expansion, SOUL-pm v1.3.0 rule) plus **new scope** for Desktop + Web dashboard.

**Identity:** Solo Developer Power Tool (LOCKED) — Desktop + Web dashboard must serve CEO's <30s-answer guarantee, not grow into a multi-user platform.

## Scope

### Part A — Verified carry-over from Sprint 135 (~1h total)

| # | Item | Effort | Priority | Authority |
|---|------|--------|----------|-----------|
| A1 | L2 Handoff Completion — `## Handoff Completion (MANDATORY)` section in 4 executor SOULs (coder, pm, architect, tester; reviewer excluded — deliverable is review verdict, not file) | ~15 min | P1 | CPO approval 2026-04-17 |
| A2 | SOUL-pm v1.3.0 — add Ground-Truth Rule 4: "For versioned artifacts (framework, ADR-NNN, Sprint-NNN), PM confirms CTO sign-off explicitly before writing bump" | ~15 min | P1 | @pm carryover note 2026-04-17 (would have caught 4 pattern instances in Sprint 135) |
| A3 | L1 @pm CRG polish — add `crg_architecture_overview` + `crg_graph_status` guidance to SOUL-pm Capabilities | ~10 min | P3 | @pm backlog |
| A4 | ADR-048 full expansion — convert STUB → FULL; fill in: rollback plan detail, quality-gate alignment, sibling-pattern comparison (MTClaw Go vs Orchestrator Python vs EndiorBot TS) | ~30 min | P2 | @cto countersign requires full expansion by Sprint 136 close |
| A5 | Formal Sprint 135 close — pnpm test + build + summary doc + push 3 commits (`9df591f`, `999c325`, `d10e288`) | Unknown | P0 | @pjm maintenance |

**Already shipped, removed from backlog:**

- ~~SENSITIVE_COMMANDS "exec-policy"~~ — already in Set at `src/commands/command-dispatcher.ts:59` (Sprint 135 C-HARD-1)
- ~~Fetch boundary test~~ — already exists at `tests/architecture/fetch-boundary.test.ts` (Sprint 133 S2, 126 lines, active)

### Part A' — Gateway-level UX Fix (added 2026-04-18 after CEO field test)

**CEO use case** — CEO chạy `@tester` trên Telegram từ phone. Không có progress events, CEO thấy 5-phút silent wait rồi reply — nghĩ bot đơ, re-send, nhận duplicate work. Với A6-A10, CEO thấy heartbeat mỗi 10s + fallback transitions, tin tưởng hệ thống, không spam. **Serves Solo Developer Power Tool <30s-answer guarantee directly** — user biết là bot đang làm, không phải chờ mù.

**Trigger incident** (2026-04-18 16:47–16:54): CEO gửi `@tester plan smoke tests` → 7 phút silent (Claude Code CLI timeout 5 phút + cloud fallback 2 phút). Zero mid-flight updates.

| # | Item | Effort (CTO-revised) | Priority | Authority |
|---|------|---------------------|----------|-----------|
| A6 | Gateway progress events — ChannelRouter publishes `bus.publishOutbound({correlationId, text, isProgress: true})` every 10s during agent invocation. **Reuses existing `EventEmitterBus.publishOutbound` + `BusOutboundMessage.isProgress` field** — no new bus API needed (verified via grep 2026-04-18). | 30 min | P1 | CPO approval 2026-04-18 + @pm C-HARD-1 resolved |
| A7 | Fallback status event — when Claude Code Bridge times out/fails, Router publishes a progress event with `text: "⚠️ Claude Code timeout, switching to Gemini fallback..."` before invoking next provider. Reuses same `isProgress: true` channel. | 15 min | P1 | CPO approval 2026-04-18 |
| A8 | Telegram adapter: subscribe to progress events → `editMessageText`. 4 implementation steps: (1) Add `editMessage(chatId, messageId, newText)` wrapper on `TelegramChannel`; (2) Store `placeholderMessageId` per `correlationId` in state map; (3) Subscribe handler in adapter that calls wrapper on `isProgress: true`; (4) Cleanup state on final reply or session end. | 45-60 min | P1 | @pm C-SOFT-1 resolved |
| A9 | Zalo/WebUI/CLI/Desktop adapter stubs (log-only subscribers). **Zalo capability TBD** — Zalo Bot API may not support inline edit; fallback UX is either "send new progress message (chat spam)" or "suppress progress on Zalo entirely". WebUI has WebSocket — edit via `bus.response` event. CLI/Desktop are stubs for now. | 1-1.5h (after Zalo design answer) | P2 | @pm C-SOFT-2 (unresolved — needs Zalo API check before binding) |
| A10 | `ENDIORBOT_DISABLE_ANTHROPIC_FALLBACK=true` — opt-out flag in `src/providers/init.ts:50` block. **Prevent accidental Anthropic API spend when Claude Code OAuth hiccups — CEO wants to know OAuth failed, not silently swap to billable API.** | 10 min | P1 | **SHIPPED** in commit `60d92fb` (2026-04-18) |

**Bus infrastructure note**: A6 grep confirmed `EventEmitterBus` (src/bus/message-bus.ts:44) + `BusOutboundMessage.isProgress` (src/bus/types.ts:136) already exist. `publishOutbound({isProgress:true})` does NOT decrement `inFlight` counter (message-bus.ts:70). Zero new bus types or publish API needed — just call sites in ChannelRouter.

### Part B — Desktop + Web Dashboard (SCOPE TBD — CEO input required)

**@pm claim (unverified):** *"original Sprint 136 scope, 5.5d — from surface-parity plan"*

**Ground-truth status:** Claim cannot be verified. The only upstream reference is `docs/07-operate/USAGE-GUIDE.md:746` — *"upcoming Desktop app (Sprint 136)"* — aspirational, not scoped. No master roadmap doc with "5.5d Desktop + Web" was found.

**Before this part becomes binding, CEO must confirm:**

| Question | Why it matters |
|----------|----------------|
| Desktop tech stack — Tauri 2, Electron, or native? | Determines build pipeline, bundle size, update mechanism |
| Which pages for Web dashboard? (config view, audit logs, status, all three?) | Affects effort 1d–3d |
| Does Desktop wrap the Web dashboard, or is it standalone? | Shared vs separate code paths |
| Auth model for Desktop: local-only, or remote + GATEWAY_TOKEN? | Security boundary |
| Is this a "view" dashboard only, or "view + mutate"? | Mutate needs the same confirm-flow Sprint 135 added for OTT |

**Placeholder scope (pending CEO answers):**

| # | Item | Effort estimate | Priority |
|---|------|-----------------|----------|
| B1 | Desktop shell (tech TBD) wrapping existing Web API | TBD | TBD |
| B2 | Web dashboard — read-only pages for `/api/config`, `/api/audit`, `/api/status` | TBD | TBD |
| B3 | Mutate flow (preset change, AM toggle) in dashboard with confirm | TBD | TBD |

**Acceptance gate for Part B binding:** CEO writes answers to the 5 questions above in this doc (or a linked scope doc) before sprint kickoff.

## Out of scope (explicitly)

- L3 Group History — deferred per Sprint 135 decision (identity lock)
- Multi-user Desktop/Web — Solo Developer Power Tool identity lock prohibits
- Methodology changes to SDLC 6.4.0 framework (ADR-048 full expansion is a **documentation** task, not a framework edit)

## Success criteria

- Part A (5 items) shipped; all SOULs at 6.4.0 consistency; ADR-048 status FULL.
- Part B: either shipped with CEO-confirmed scope, or deferred to Sprint 137 if CEO scope pending at kickoff.
- No scope bleed between A and B — separate commits per part.

---

*EndiorBot | Solo Developer Power Tool (LOCKED) | SDLC 6.4.0 | Sprint 136 Draft Plan — structural; Part B pending CEO scope confirmation*
