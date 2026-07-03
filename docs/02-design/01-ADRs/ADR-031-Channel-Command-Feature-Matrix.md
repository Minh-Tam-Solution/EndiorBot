# ADR-031: Channel × Command Feature Matrix & Gap Closure

**Status**: IMPLEMENTED
**Date**: 2026-03-11
**Implemented**: 2026-03-12
**Sprint**: 103-105 (COMPLETE)
**Author**: @pm + @architect (Joint Analysis)
**Reviewers**: CTO (8.5/10 APPROVED → 9.5/10 final), CPO (APPROVED)

## Context

After Sprint 102's Unified Command Architecture (ADR-030), EndiorBot has 30 registered commands routed through a single `GatewayIngress` entry point for all 4 channels (CLI, Telegram, Web, Zalo). While ADR-030 unified read-only commands successfully, **write-capable commands** (particularly `/fix`) remain display-only on OTT/Web channels.

When testing compliance fix on the paperclip project via Telegram, the CEO discovered:
- `/fix` returns instructions ("Use: @pm run compliance fix") instead of executing
- `/launch --risk patch` flag is not parsed — sessions default to `read`
- `/mode patch` returns confirmation text but doesn't update session state
- `@agent` chat mentions always use `invokeRead()`, never `invokePatch()`

This creates a fundamental workflow break: CEO can run full SDLC compliance from CLI but not from mobile/web.

**Architectural validation:** MTClaw (NQH's production system) achieved channel parity by routing ALL mutations through `bus.PublishInbound()` — not by duplicating logic per channel. EndiorBot's equivalent is `CommandDispatcher.dispatch()` with shared handlers. Strategy A validates: dry-run executes directly, writes go to Bridge = no channel-specific mutation logic.

## Decision

### AD-1: Channel × Command Feature Matrix (Standing Reference)

Maintain a feature matrix mapping all 30 commands × 4 channels with execution modes:

| Category | Commands | CLI | OTT/Web |
|----------|----------|-----|---------|
| Info (display) | /help, /agents, /teams, /config, /gate, /compliance, /repos, /where | Execute | Execute |
| State (read+write) | /link, /focus, /switch | Execute | Execute |
| Init (write) | /init | Execute | Execute (Sprint 102) |
| **Fix (write)** | **/fix** | **Execute** | **Display only → GAP-001** |
| Bridge (tmux) | /launch, /capture, /kill, /send, /sessions | Execute | Execute |
| Mode (bridge) | /mode | Execute | Display only → GAP-004 |
| Shell (tmux) | /sh, /cp, /attach | Execute | Execute (with /link) |
| AI | /eval, /consult | Execute | Execute |
| Team | /team-status, /kill-team | Execute | Execute (with /link) |
| Approval | /approve, /reject, /run | Execute | Execute |

### AD-2: Strategy A for Write Commands on OTT

For write-capable commands on OTT/Web channels:
- **Dry-run** (preview): Execute directly via shared handler → return structured result
- **Live execution** (`--yes`): Redirect to Bridge mode → `/launch --risk patch` + `/send`

Rationale:
- ComplianceFixEngine calls Claude Code `invokePatch()` per-task: O(N) calls, 60-180s duration
- OTT channels have no progress streaming — CEO sees silence for 2+ minutes
- Bridge mode preserves existing approval chain (no new security surface)

### AD-3: `/compliance fix` Alias (GAP-005)

Register `/compliance fix` as alias for `/fix` in Sprint 103. Keep `/fix` as primary entry point. Full rename with deprecation in Sprint 104 when risk mode UX is also updated.

### AD-4: Bridge Risk Mode Wiring (GAP-002 + GAP-004)

Single source of truth for risk mode: `session.riskMode` in session object. Both `/launch --risk` and `/mode` update this canonical field. `/send` and `invokePatch()` consult it. Sprint 104 scope.

### AD-5: Conservative PATCH Intent Classifier (GAP-003)

Allow `@agent` chat to use `invokePatch()` only when CEO explicitly requests writes. Intent classifier must be conservative (high-signal patterns only). Always require per-request CEO confirmation before `invokePatch()`. Sprint 105 scope.

## Gap Analysis

| Gap | Priority | Description | Sprint | Status |
|-----|----------|-------------|--------|--------|
| GAP-001 | P0 | `/fix` display-only on OTT/Web | 103 | ✅ CLOSED |
| GAP-002 | P1 | `/launch --risk` not parsed | 104 | ✅ CLOSED |
| GAP-003 | P2 | Agent mentions always READ mode | 105 | ✅ CLOSED |
| GAP-004 | P2 | `/mode` cosmetic only | 104 | ✅ CLOSED |
| GAP-005 | P1 | `/fix` naming collision | 103 (alias), 104 (rename) | ✅ CLOSED |

**All 5 gaps closed. ADR-031 IMPLEMENTED. (2026-03-12)**

## SDLC Workflow Decision Tree

```
CEO request on OTT/Web channel
  │
  ├── Read-only? (status, info, check)
  │     └── Direct command → return text
  │
  ├── Dry-run preview? (/fix without --yes)
  │     └── Direct command → engine.fix({dryRun:true}) → return summary
  │
  ├── Write operation? (/fix --yes)
  │     └── Redirect to Bridge mode
  │         /launch claude <path> --risk patch → /send compliance fix --yes
  │
  └── Complex/interactive? (architecture, refactor)
        └── Bridge mode REQUIRED → /launch → /send → /approve → /capture
```

## Consequences

### Positive
- CEO can preview SDLC compliance from any channel (mobile, web)
- Write operations go through Bridge mode with existing approval chain
- No new security surface for PATCH from remote channels
- Progressive: dry-run → bridge → mode-aware routing across 3 sprints

### Negative
- `/fix --yes` requires 2-3 commands instead of 1 on OTT (bridge overhead)
- Intent classifier (Sprint 105) adds complexity to chat routing

### Neutral
- CLI workflow unchanged (full execution as before)
- Bridge mode becomes the canonical path for write operations from remote channels

## Related ADRs

- [ADR-024](ADR-024-Notification-Bridge.md) — Notification Bridge (tmux sessions)
- [ADR-030](ADR-030-Unified-Command-Architecture.md) — Unified Command Architecture
- Progressive Trust T2/T3 (Sprint 95-97)

---

*Generated by EndiorBot — SDLC Framework 6.4.0*
