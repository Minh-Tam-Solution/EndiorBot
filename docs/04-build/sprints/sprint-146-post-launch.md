---
sprint: 146
status: DRAFT — blocked by Sprint 145 exit
start_date: TBD
planned_duration: 5d
framework: "6.4.0"
authority:
  proposer: "@pm"
  countersigners: ["@cto — gap analysis endorsed 2026-04-27"]
  trigger: "Sprint 145 dual-launch complete + SDLC audit + gap analysis"
previous_sprint: "Sprint 145 — Dual-Launch: SDLC Framework + EndiorBot"
references:
  - docs/04-build/sprints/sprint-145-dual-launch.md
---

# Sprint 146 — Post-Launch: Quality Hardening + Gap Closure

## Context

Sprint 145 launched both repos. Three audits during Sprint 145 identified quality gaps:

1. **SDLC 6.4.0 Compliance Audit** — 92% → 94% (target 95%)
2. **Code-Design Gap Analysis** — 2 missing ADRs, 4 modules without ADR
3. **Frontend-Backend Gap Analysis** — 3 P0 blockers fixed, 8 backend features with no UI

**P0 items already fixed in Sprint 145:**
- F1: Checkpoints + FixStats pages (IPC crash) — FIXED
- F2: `registerAllMethods()` gap (Desktop Chat → 39 commands) — FIXED
- F3: Dashboard hardcoded stats → real IPC data — FIXED
- H1: HSTS security header — FIXED

This sprint closes remaining gaps for OSS quality.

---

## P0 — Missing ADR Documents (blocks design traceability)

### T1: Write ADR-003 — CLI-Desktop Protocol (~1h)

**Gap:** 21+ code files cite `@authority ADR-003` but document doesn't exist.

**What:** Document the IPC protocol between `endiorbot.mjs` CLI and Electron Desktop app:
- IPC channel naming convention
- Security model (nodeIntegration + contextIsolation trade-offs)
- Gateway subprocess lifecycle
- Channel list and data contracts

**Files:** `docs/02-design/01-ADRs/ADR-003-CLI-Desktop-Protocol.md` (NEW)
**Evidence:** `apps/desktop/electron/main/ipc-handlers.ts`, `apps/desktop/electron/main/index.ts`
**Owner:** @architect

---

### T2: Write ADR-006 — Checkpoint State Model (~1h)

**Gap:** CLI entry point and checkpoint module cite `@authority ADR-006` but document doesn't exist.

**What:** Document checkpoint architecture:
- State machine (9 resilience states)
- Checkpoint triggers (time/event/patch_count)
- Storage format and recovery
- Failure classification (TRANSIENT/FIXABLE/DESIGN_ISSUE)

**Files:** `docs/02-design/01-ADRs/ADR-006-Checkpoint-State-Model.md` (NEW — note: `approved/ADR-006-Checkpoint-State-Model.md` exists as an early draft; consolidate)
**Evidence:** `src/sessions/checkpoint/`, `src/sessions/failure/`, `src/sessions/recovery/`
**Owner:** @architect

---

## P1 — Tech Debt (CSO audit + god classes)

### T3: God Class Refactoring — Top 3 (~4h)

| File | Lines | Extract |
|------|-------|---------|
| `src/sessions/autonomous/manager.ts` | 1,269 | `TaskQueue`, `AutonomyGateManager` |
| `src/channels/telegram/telegram-channel.ts` | 1,211 | `TelegramFormatter`, `TelegramCommandRouter` |
| `src/budget/budget-tracker.ts` | 1,104 | `BudgetAlertService`, `BudgetReporter` |

**Constraint:** Extract only. No behavior change. All tests pass unchanged.
**Owner:** @coder

---

### T4: Circular Dependency Fix — Approval Module (~1h)

**CSO audit:** `src/agents/router/patch-flow.ts` imports from `src/gateway/methods/approval.ts`.
**Fix:** Extract to `src/approval/queue.ts`. Both agents/ and gateway/ import from neutral module.
**Owner:** @architect + @coder

---

### T5: Triage 10 Production TODOs (~1h)

CSO audit found 10 `// TODO` markers in production code. For each:
- If feature deferred → convert to GitHub Issue + remove TODO
- If trivially fixable → fix inline
- If obsolete → remove

Key files: `evaluator/loop.ts:907`, `gateway/methods/chat.ts:454`, `cli/commands/status.ts:169`
**Owner:** @coder

---

## P1 — Community Experience

### T6: endior.net Landing Page Deploy (~30min)

- GitHub Pages: Settings → Pages → Source `main` branch, `/site` folder
- CNAME: `endior.net` DNS → GitHub Pages IP
- Verify: `curl -I https://endior.net`

**Owner:** CEO + @devops

---

### T7: CHANGELOG Sprint 139-145 Entries (~30min)

CHANGELOG.md currently stops at Sprint 135. Add entries for Sprints 139-145.
**Owner:** @pm

---

### T8: Desktop Release Build — macOS DMG (~2h)

```bash
cd apps/desktop && pnpm build
# → release/EndiorBot-1.0.0-arm64.dmg
```

Attach to GitHub Release as downloadable asset.
**Owner:** @devops

---

## P2 — Desktop UI Gaps (from frontend-backend analysis)

### T9: Desktop Pages for Backend Features (~4h)

Backend features with NO desktop UI (from gap analysis):

| Feature | Backend Module | Desktop Action |
|---------|---------------|----------------|
| Budget tracker | `src/budget/` | Add Budget page (read IPC `budget:get`) |
| Audit logs | `~/.endiorbot/audit-logs/` | Add Audit page (read last 50 entries) |
| Approval queue | `src/gateway/methods/approval.ts` | Show pending approvals on Dashboard |

**NOT in scope:** RL feedback, Brain layers, Active Memory toggle (advanced features, defer to Sprint 147+)
**Owner:** @coder

---

### T10: OTT Command Fallthrough Verification (~1h)

Verify that Telegram and Zalo local command handlers correctly fall through to CommandDispatcher for the 20+ commands not handled locally:
- `/plan`, `/link`, `/launch`, `/sessions`, `/switch`, `/repos`, `/focus`, `/exec-policy`, `/commands`, etc.
- Test each on Telegram: verify response comes from Dispatcher, not "Unknown command"

**Owner:** @tester

---

## P2 — Documentation Debt

### T11: Stale Framework Version Refs in docs/05-test/ (~30min)

13 test reports have `6.1.1`/`6.2.0` footers. Add header note: "Historical test report — framework version at time of writing."
**Owner:** @pm

---

## P1 — UI/UX Upgrade (Design Mockup → Production)

**Source:** Claude Design handoff bundle at `landing/` — 3 design prototypes:
- `landing/endiorbot-landing/` — OSS landing page (endior.net)
- `landing/endiorbot-app/` — Desktop + WebUI mockup (production UI target)
- `landing/sdlc-framework/` — SDLC Framework landing (sdlcframework.org)

### T12: Desktop UI Upgrade — Align with Design Mockup (~6h)

**Gap:** Current Desktop app (`apps/desktop/`) uses basic inline styles. Design mockup shows:
- Amber/dark theme with Fraunces + Inter Tight + JetBrains Mono typography
- 3-pane layout: sidebar → main content → context panel
- Polished agent cards, gate status visualization, sprint board
- macOS-native window chrome

**What:** Apply design system from `landing/endiorbot-app/app-styles.css` to production Desktop pages:

| Page | Current state | Target from mockup |
|------|--------------|-------------------|
| Dashboard | Basic stats cards (hardcoded → real IPC, Sprint 145 F3) | Agent activity feed, gate donut chart, sprint progress bar |
| Chat | Simple message list | Agent mention highlighting, typing indicator, provider badge |
| Settings | Functional but unstyled cards | Design-aligned cards, grouped sections |
| Gates | Basic gate list | Visual gate pipeline (G0→G4 flow), color-coded status |
| Projects | List from repos.json | Card grid with last-activity, tech stack badge |
| Experts | Provider status table | Provider health cards with latency + circuit breaker status |

**Files:**
- `apps/desktop/src/styles/` — NEW shared style module (extract from `app-styles.css`)
- `apps/desktop/src/pages/*.tsx` — Apply design tokens + layout from mockup
- `apps/desktop/src/components/` — Extract reusable components (AgentCard, GateChip, ProviderBadge)

**Constraint:** Visual upgrade only. IPC data contracts unchanged. All existing functionality preserved.

**Owner:** @coder
**Reference:** `landing/endiorbot-app/app-pages.jsx` (target visual)

---

### T13: WebUI Upgrade — Match Desktop Design System (~3h)

**Gap:** Web UI at `localhost:18790` is a minimal HTML page with basic chat. Design mockup shows a polished browser-native dashboard with:
- Sidebar navigation matching Desktop
- Chat with agent avatars + model badges
- System status bar (provider health, Active Memory, exec-policy)

**What:** Rebuild the static HTML served by `src/gateway/web-server.ts` (reads from inline `htmlContent`) with design-aligned markup + shared CSS variables from `app-styles.css`.

**Approach: Option A (static HTML rebuild)** — CPO decision 2026-04-27.
- Regenerate inline HTML with design tokens (colors, typography, layout) from mockup.
- No React in gateway — stays static HTML served by `web-server.ts`.
- Shared design tokens via CSS variables (same source as Desktop `app-styles.css`).
- Sprint 147 follow-up: extract `@endiorbot/ui` shared package (Option B).

**Owner:** @coder + @architect (for option B scoping)
**Reference:** `landing/endiorbot-app/webui-app.jsx` (target visual)

---

### T14: Landing Page Production Build (~2h)

**Gap:** Landing page at `landing/endiorbot-landing/` uses Babel in-browser JSX compilation (dev-only). Production needs:
- Pre-compiled JS bundle (no Babel CDN dependency)
- Minified CSS
- Deployable as static files for GitHub Pages

**What:**
1. Add Vite config for landing page build
2. `pnpm build:landing` → `dist/landing/` (static HTML + JS + CSS)
3. GitHub Pages deploy from `dist/landing/`
4. CNAME file for `endior.net`

**Files:**
- `landing/endiorbot-landing/vite.config.ts` (NEW)
- `landing/endiorbot-landing/package.json` (NEW — build scripts)
- GitHub Actions workflow for Pages deploy (if CI exists)

**Owner:** @devops
**Depends on:** T6 (DNS setup)

---

## Sequencing

```
Day 1: T1 (ADR-003) + T2 (ADR-006) + T5 (TODO triage) + T6 (deploy landing page)
Day 2: T3 (god classes, 4h) + T4 (circular dep, 1h)
Day 3: T7 (CHANGELOG) + T8 (Desktop build) + T12 (Desktop UI upgrade, start)
Day 4: T12 (Desktop UI, continue) + T13 (WebUI) + T14 (landing build)
Day 5: T9 (Desktop pages) + T10 (OTT verify) + T11 (test report footers)
```

---

## Exit Criteria

- [ ] ADR-003 and ADR-006 exist (T1, T2)
- [ ] No file >1,000 lines in top 3 god classes (T3)
- [ ] `grep "from.*gateway/methods/approval" src/agents/` returns 0 (T4)
- [ ] 0 production TODOs remaining or all tracked as Issues (T5)
- [ ] endior.net resolves with landing page (T6)
- [ ] CHANGELOG updated through Sprint 145 (T7)
- [ ] Desktop UI matches design mockup on all 7 pages (T12)
- [ ] WebUI upgraded with design system (T13)
- [ ] Landing page builds to static files, deployable (T14)
- [ ] All 8,124+ tests pass, build clean

---

## Success Metrics

| Metric | Target |
|--------|--------|
| SDLC compliance | ≥95% (currently 94%) |
| Code-design gaps | 0 missing ADRs for cited authorities |
| Frontend-backend gaps | 0 P0 blockers (already fixed) |
| God classes >1000 LOC | 0 (from 3) |
| Production TODOs | 0 (from 10) |

---

*EndiorBot | Solo Developer Power Tool | SDLC 6.4.0 | Sprint 146 Draft — 2026-04-27*
