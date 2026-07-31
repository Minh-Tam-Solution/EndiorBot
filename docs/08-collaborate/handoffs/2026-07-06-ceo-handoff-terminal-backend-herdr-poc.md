---
title: "CEO Handoff — CC-Bridge Terminal Backend: keep tmux, POC herdr (S133+)"
date: 2026-07-06
from: "CEO"
to: "@cto (EndiorBot)"
status: handoff
priority: P2 (S133+ experiment — do not preempt current sprint)
---

# CEO Handoff — Terminal Backend evaluation: tmux stays, herdr POC scoped here

## Decision summary (already ratified upstream)

An external expert review compared **tmux / cmux / herdr** as CC-bridge terminal backends. CEO fact-checked the premises against the actual codebases and ratified:

| Item | Verdict |
|------|---------|
| **tmux** | **STAYS as bridge backend** — proven, scriptable, SSH-safe, auditable. No replacement. |
| **cmux** | Personal productivity tool for macOS developers. NOT a platform component. No action. |
| **herdr** | Agent-aware multiplexer — **worth a 1-week POC, hosted HERE (EndiorBot)**, as an *optional* backend behind an abstraction. Not a rewrite. |

## Why EndiorBot is the POC host (not the upstream gateway)

1. **EndiorBot's bridge is the richest, live implementation** — `src/bridge/` already has launcher, process-monitor, output-evaluator, output-redactor, bridge-audit, session-registry. Most of the expert's "Track-1 hardening" list **already exists here** → do a **gap-analysis, not a greenfield build**.
2. **Solo-dev blast radius** — herdr is a young project; experimenting here is low-risk. The multi-tenant upstream platform adopts only *after* a passing POC **and** demonstrated demand on its own bridge lane.
3. **Module seam already exists** — `src/bridge/tmux/tmux-bridge.ts` is a natural boundary → introducing a `TerminalBackend` interface is cheap and keeps optionality.

## Scope (3 items, in order)

### 1. `TerminalBackend` abstraction (small, do first)
Extract the interface implied by `tmux-bridge.ts` (create/launch/send/capture/state/kill/recover). tmux remains the default and only production implementation. No behavior change.

### 2. Track-1 gap-analysis (not rebuild)
Compare existing bridge modules against the hardening list: session state from Claude Code hooks · transcript extraction · structured session metadata · health surface. Record what exists / what's missing. Only build items with a real usage-driven gap.

### 3. herdr POC (1 week, evidence-based)
Run against the 10-point checklist. **Rule: < 8/10 pass → do not adopt.** Each criterion verified-at-use (executed + observed), not impression-based. Findings land as an evidence report in this repo.

**Checklist (from expert review):**
1. Headless Ubuntu operation
2. SSH disconnect/reconnect session survival
3. CLI/API completeness: create workspace · launch · send input · capture output · query state · kill
4. Claude Code hooks integration
5. Log export
6. Crash isolation (herdr dies → agent sessions survive?)
7. systemd operation
8. Multi-user/security model
9. License compatibility
10. Bridge quality vs tmux (latency + failure rate, measured)

**CEO pre-conditions (binding, before first run):**
- **Source-read + license audit BEFORE executing** anything from the herdr repo (young project — supply-chain, telemetry, and privacy check first).
- POC runs with **no production or tenant data** — synthetic sessions only.
- Report = per-criterion evidence (commands + observed output), filed under `docs/` in this repo.

## Timing & guardrails

- **Priority P2, S133+** — current sprint commitments are not preempted by this experiment.
- This is a **learn-pattern evaluation, non-dependency**: EndiorBot stays fully functional on tmux regardless of POC outcome.
- Outcome routes: PASS ≥8/10 → propose `TerminalBackend` herdr implementation as optional backend (separate gate). FAIL → file the report, keep tmux, close the track.

## References
- Expert comparison: tmux (terminal multiplexer, server-grade) · cmux (macOS/Ghostty desktop terminal for agents) · herdr (agent multiplexer: real panes, agent state, API surface).
- Ecosystem decision register entry: ECO-DEC-2026-044 (agent-upgrade program context; this handoff is an adjacent research track).
