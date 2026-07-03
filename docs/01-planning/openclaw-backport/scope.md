# Scope — openclaw Backport

**Feature:** openclaw-backport (Sprint 132–134)
**Owner:** @pm
**Status:** COMPLETE — All in-scope items delivered. LOCKED 2026-04-11 post CEO Decision Log.
**Related:** [PRD.md](./PRD.md) · [Plan v3](/Users/dttai/.claude/plans/glistening-nibbling-mist.md)

---

## In Scope

### Sprint 132 (MUST) ✅ COMPLETE

| ID | Item | Effort | Risk | Status |
|---|---|---|---|---|
| **M0** | `commands.list` RPC + new `endiorbot commands` CLI subcommand + Telegram/Zalo/Web adapter wiring + normalization layer | S (0.5–1 day, ~150–200 LoC incl. tests) | low | ✅ DELIVERED Sprint 132 |
| **M1** | `exec-policy` CLI + approvals cluster under `src/security/exec-approvals/` (port from openclaw's ~18–20 non-test module cluster) + integration with existing Autonomous Gates A/B/C | M–L | med | ✅ DELIVERED Sprint 132 |

**M1 layering rule (locked):** exec-policy enforces **command allowlist**. Gates A/B/C enforce **time + cost bounds**. Orthogonal concerns, NOT merged semantics. The 6-cell matrix (preset × `ENDIORBOT_AUTO_HANDOFF`) MUST be fully defined in ADR-046 full — any undefined cell blocks handoff.

**M1 preset naming (locked):** `open` / `balanced` / `strict`. No dual naming in UI. openclaw lineage (`yolo` / `cautious` / `deny-all`) is internal code-comment only.

### Sprint 133 (SHOULD) ✅ COMPLETE

| ID | Item | Effort | Risk | Status |
|---|---|---|---|---|
| **S1** | Active Memory sub-agent pre-dispatch hook (cache-first, model-call-fallback) wired at existing `src/bus/message-bus.ts` `onInbound()` | M | med | ✅ DELIVERED Sprint 133 (kill switch: `ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED`) |
| **S2** | Native fetch / webhook SSRF audit + allowlist layer on `src/security/` and `src/gateway/` fetch call sites | S–M | low | ✅ DELIVERED Sprint 133 (SSRF block-list + allow-list tests all green) |

**S1/S2 kill-switch ownership (locked):** CEO only. No automatic policy. No p95-threshold auto-disable. CEO flips the config or CLI personally.

### Sprint 134 (COULD) ✅ COMPLETE

| ID | Item | Condition | Status |
|---|---|---|---|
| **C2** | Webhooks ingress — Zapier / generic HTTPS webhook + Email forward → EndiorBot | CEO confirmed scope 2026-04-11. Slack inbound **rejected** (identity-lock boundary). | ✅ DELIVERED Sprint 134 |
| **C5** | Architectural boundary test (single vitest scanning imports for back-channel violations) | Low effort, backlog | Backlog |

---

## Out of Scope (WON'T)

### Dropped by CEO decision 2026-04-11

| ID | Item | Reason |
|---|---|---|
| **C1** | Evidence linter (memory-wiki port) | **DROPPED.** No CEO-facing use case today. Identity-drift risk ("SDLC enforcer" role is forbidden by identity lock). Requires creating a new markdown evidence substrate — subsystem-scale effort, not a lint tool. Revisit if a future CEO workflow demands it. |

### Rejected by identity lock (Solo Developer Power Tool, not platform)

- **Channels:** Matrix, Signal, iMessage, Teams, IRC, Feishu, Slack (as full channel), Discord. 4-channel parity is locked at Web / Telegram / Zalo / CLI.
- **Mobile / native:** iOS, Android, native macOS apps beyond existing `apps/desktop/`.
- **Platform infra:** 110+ bundled extensions, full plugin SDK, `extensions/*` workspace pattern.
- **Providers:** Seedance 2.0, Gemma 4, Arcee AI. Our 6-provider set is sufficient.
- **Networking:** Tailscale remote gateway pairing.
- **Testing infra:** Live Matrix/Telegram QA homeservers.
- **Voice:** Talk MLX (macOS-only MVP, experimental, platform-bound).

### Rejected by wrong-vector analysis (plan v3 R2)

- **C3 — multipass runner:** openclaw still hardening; host-env-bound (requires Multipass installed). Not a Sprint 132–134 candidate. Revisit when their runner stabilizes.
- **Direct mirror of openclaw commit `fbf11ebdb7` (CDP source-range restriction):** EndiorBot has no sandboxed browser. Wrong vector. S2 is our own fetch audit, not a mirror.

### Deferred pending telemetry

- **C4 — Codex provider:** Defer. Check `.endiorbot/audit/` + `/consult` logs for openai provider usage share. If < 5% → defer confirmed.

---

## Constraints

**Must preserve:**
- 4 Non-Negotiable Invariants (Thin Client pattern, stdin-JSON hooks, SOUL=governance/CC=execution, Sonnet default model)
- Identity LOCKED: Solo Developer Power Tool (NOT platform, NOT SDLC enforcer)
- 4-channel parity (Web / Telegram / Zalo / CLI) — M0 specifically strengthens this
- 2K tokens/turn, 3 blocks/turn, hard reset every 30 turns
- Sprint 72 Autonomous Gates A/B/C (M1 layers ON TOP, does not replace)
- Sprint 131 `ENDIORBOT_AUTO_HANDOFF` semantics (M1 matrix must compose cleanly)

**Must not:**
- Create ADR-047 (use ADR-046 expansion instead — per CTO C-HARD-1)
- Introduce dual preset naming in UI
- Add automatic kill-switch policies (CEO-only control)
- Skip the false-positive guard for S2
- Hand off M1 until ADR-046 full is CTO + CPO signed

---

## CEO Decision Log (2026-04-11)

| # | Decision | Locked value |
|---|---|---|
| 1 | M0 sprint placement | **Sprint 132 opener** |
| 2 | M1 preset naming | **open / balanced / strict** (single scheme) |
| 3 | C1 (evidence linter) | **DROP** — no use case |
| 4 | C2 (webhooks) scope | **Zapier / HTTPS webhook + Email forward** (no Slack) |
| 5 | S1/S2 kill-switch ownership | **CEO only** — no automatic policy |
| 6 | CTO pre-draft ADR-046 expansion | **ACCEPTED** — @cto drafts, @pm + @cpo review |

---

*EndiorBot | Solo Developer Power Tool (LOCKED) | SDLC 6.4.0 | openclaw-backport scope | Status: COMPLETE*
