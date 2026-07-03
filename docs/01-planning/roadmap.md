# Product Roadmap

**Project:** EndiorBot
**Version:** 2.0.0
**Date:** 2026-02-28
**SDLC Stage:** 01-PLANNING
**Identity:** Solo Developer Power Tool (LOCKED)

---

## Three Tiers (Per Master Plan v2.0)

```
┌───────────────────────────────────────────────────────────────────┐
│                    EndiorBot Roadmap                              │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Tier 1 — MVP (2-3 weeks)                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  endiorbot consult "<question>"  ← 2 models consultation   │  │
│  │  endiorbot gate status G2        ← Read-only checklist     │  │
│  │  endiorbot switch <project>      ← Minimal context         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│                            ▼                                      │
│  Tier 2 — Pro (4-6 weeks after MVP)                               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Auto-generate ADR template (CEO approve)                   │  │
│  │  Gate evidence manifest                                     │  │
│  │  History compaction + session resume                        │  │
│  │  OTT approvals via magic link                               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│                            ▼                                      │
│  Tier 3 — Productization (after 2-4 weeks CEO usage)              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Desktop shell                                              │  │
│  │  Skills gateway                                             │  │
│  │  Dynamic context overlay                                    │  │
│  │  Junior hub                                                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Tier 1 — MVP

**Timeline:** 2-3 weeks
**Status:** ✅ COMPLETE (Sprint 54)

### Sprint 54: MVP (COMPLETE)

| Task | Hours | Priority | Status |
|------|-------|----------|--------|
| ChatHandler (2-model) | 2h | P0 | ✅ DONE |
| AIRouter | 1.5h | P0 | ✅ DONE |
| primary_with_notes consolidation | 1h | P0 | ✅ DONE |
| ActionControlPlane stub | 1h | P0 | ✅ DONE |
| Context Budget governance | 1h | P0 | ✅ DONE |
| Gate status read-only | 0.5h | P0 | ✅ DONE |
| CLI `consult` command | 1h | P0 | ✅ DONE |
| Testing & documentation | 2h | P0 | ✅ DONE |

### MVP Features

| Feature | Command | Status |
|---------|---------|--------|
| 2-Model Consultation | `endiorbot consult` | ✅ DONE |
| Gate Status | `endiorbot gate status` | ✅ DONE |
| Project Switch | `endiorbot switch` | ✅ DONE |
| Brain L4 Injection | Auto at session start | ✅ DONE |

### MVP Success Criteria

| Metric | Target |
|--------|--------|
| Decision time | <30s (not 30-60 min) |
| Context switch | <2s |
| No copy/paste | 0 app switches |
| Gate status | At a glance |

---

## Tier 2 — Pro

**Timeline:** 4-6 weeks after MVP
**Status:** ✅ COMPLETE (Sprints 55-58)

### Sprint 55-56

| Feature | Priority |
|---------|----------|
| Brain provenance (schema_version) | P0 |
| Session resume with Brain | P0 |
| Telegram magic link approvals | P1 |
| Auto-ADR generation | P1 |

### Sprint 57-58

| Feature | Priority |
|---------|----------|
| Gate evidence manifest | P1 |
| History compaction | P1 |
| OTT bidirectional chat | P1 |

### Pro Success Criteria

| Metric | Target |
|--------|--------|
| Session resume | No context loss |
| Context drift | <5% re-explanations |

---

## Tier 3 — Productization

**Timeline:** Completed across Sprints 62-144
**Prerequisites:** Pro tier stable, CEO feedback collected

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Desktop shell | Electron app with full UI | ✅ SHIPPED Sprint 62 + 144 (9 pages) |
| Skills gateway | Extensible skill system | Backlog |
| Dynamic context overlay | Real-time context injection | Backlog |
| Junior hub | Task delegation and training | ✅ SHIPPED Sprint 144 (Desktop page) |
| Full multi-model (4+) | All providers | ✅ SHIPPED Sprint 140+ (5 providers) |
| SDLC enforcement | Not just checklist | ✅ SHIPPED Sprints 68-79 (gate engine, contracts) |

---

## Tier 4 — Bridge & Intelligence (Sprint 82-92)

**Timeline:** Sprint 82-92
**Prerequisites:** Agent Orchestration (Sprint 55) complete
**CTO Reviews:** ADR-024 (10/10), ADR-025 (8/10), ADR-026 (9/10→10/10 Final Sign-Off)

### Phase 1: Bridge Foundation (Sprint 82-84) ✅ COMPLETE

| Sprint | Scope | Status |
|--------|-------|--------|
| 82 | TmuxBridge + SessionRegistry + Telegram `/launch`, `/sessions`, `/kill` | ✅ |
| 83 | Copilot CLI Bridge + Repo Context + Managed Shell | ✅ |
| 84 | SOUL Bridge Foundation — persona injection via Strategy A/B | ✅ |

### Phase 2: Bridge Completion (Sprint 85-86) ✅ COMPLETE

| Sprint | Scope | Status |
|--------|-------|--------|
| 85 | Permission Approval via Telegram — hook verification + relay | ✅ |
| 86 | /send Command + Turn Context — sendKeys relay + context injection | ✅ |

ADR-024 complete at Sprint 86.

### Phase 3: Intelligence Integration (Sprint 87-88) ✅ COMPLETE

| Sprint | Scope | Status |
|--------|-------|--------|
| 87 | Brain L4 + Context Anchoring in Bridge — 3-layer envelope injection | ✅ |
| 88 | Evaluator + Vibecoding in Bridge Output Pipeline — 5-signal scoring | ✅ |

Intelligence parity at Sprint 88. 3-layer context model complete.

### Phase 4: Agent Teams (Sprint 89-91) ✅ COMPLETE

| Sprint | Scope | Status |
|--------|-------|--------|
| 89 | Team file generation — `install-teams` CLI + team installer | ✅ |
| 90 | Telegram `/launch --as-team` + complexity gate + smart routing | ✅ |
| 91 | Team monitoring, cost tracking, `/team-health`, `/kill-team` | ✅ |

### Phase 5: Infrastructure (Sprint 92) ✅ COMPLETE

| Sprint | Scope | Status |
|--------|-------|--------|
| 92 | Unified App Launcher — lock file + PID tracking + crash recovery | ✅ |

**Tier 4 COMPLETE** — All 11 sprints (82-92) delivered. 5,859 tests passing.

### ADR List (Bridge & Intelligence)

| ADR | Title | Sprint |
|-----|-------|--------|
| ADR-024 | Notification Bridge + Multi-Agent Session Management | 82-86 |
| ADR-025 | Session Intelligence Envelope + 3-Layer Context Model | 84-88 |
| ADR-026 | Claude Code Agent Teams | 89-91 |

### Intelligence Injection Map

| System | Layer | Sprint | Method |
|--------|-------|--------|--------|
| SOUL Templates | Launch-time | 84 ✅ | `--agent` / `--append-system-prompt-file` |
| Permission Approval | Turn-time | 85 ✅ | Async polling via Telegram |
| /send + Hooks | Turn-time | 86 ✅ | sendKeys task prefix |
| Brain L4 + Context | Launch+Turn | 87 ✅ | Envelope → CLI + sendKeys |
| Evaluator + Vibecoding | Post-turn | 88 ✅ | Capture → pipeline → store |
| Agent Teams (files) | Launch-time | 89 ✅ | Team-aware agent files |
| Agent Teams (Telegram) | Turn-time | 90 ✅ | `/launch --as-team` |
| Team Monitoring | Post-turn | 91 ✅ | Dashboard, cost tracking |
| Unified Launcher | Infrastructure | 92 ✅ | Single process + PID |

---

## What's NOT in Roadmap

Per Master Plan v2.0, these are explicitly excluded:

| Feature | Reason |
|---------|--------|
| Enterprise team features | Solo developer focus |
| Complex RBAC | Just CEO + Junior roles |
| Heavy infrastructure | No DB, Redis, MinIO |
| Usage billing | Not needed |

---

## Milestones

| Milestone | Target | Criteria | Status |
|-----------|--------|----------|--------|
| **M1: MVP CLI** | End Sprint 54 | consult, gate, switch work | ✅ DONE |
| **M2: Brain Integration** | End Sprint 55 | L4 injection, provenance | ✅ DONE |
| **M3: Pro Features** | End Sprint 58 | Session resume, magic links | ✅ DONE |
| **M4: Desktop** | End Sprint 62 | Desktop app functional | ✅ DONE |
| **M5: Notification Bridge** | End Sprint 86 | tmux bridge, permissions, /send | ✅ DONE |
| **M6: Intelligence** | End Sprint 88 | SOUL + Brain + Context + Evaluator | ✅ DONE |
| **M7: Agent Teams** | End Sprint 91 | Team launch, monitoring, cost | ✅ DONE |
| **M8: Unified Launcher** | End Sprint 92 | PID tracking, crash recovery, lock | ✅ DONE |
| **M9: Kimi2.6 Fallback** | Sprint 140 | Kimi API + OAuth proxy as first fallback for all agents | ✅ DONE |
| **M10: CC-First Routing** | Sprint 143 | ADR-052 amendment — CC primary, Kimi fallback on rate-limit only | ✅ DONE |
| **M11: Gateway Hardening** | Sprint 144 | PID lockfile + circuit breaker + OTT timeout + Desktop channel | ✅ DONE |

---

## Current State

**Sprint 144 CLOSED** (2026-04-27)
- 8,142 tests passing, 39 commands, 14 agents, 5 channels, 5 providers
- All milestones M1–M11 complete
- See [Sprint History in README.md](./README.md) for full sprint log

**Next sprint:** TBD — See backlog items in Tier 3 (Skills gateway, dynamic context overlay)

---

## References

- [Master Plan v2.0](../00-foundation/master-plan.md) - Identity & scope
- [Sprint 92 Plan](../04-build/sprints/sprint-92-unified-launcher.md) - Latest completed sprint

---

*Solo Developer Power Tool | SDLC Framework v6.4.0 - Stage 01: Planning*
*Identity: LOCKED (2026-03-08) | Updated Sprint 144 (2026-04-27)*
