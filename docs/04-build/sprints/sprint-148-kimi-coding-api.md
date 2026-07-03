---
sprint: 148
status: PLANNED — G2 APPROVED, awaiting G3 validation
start_date: TBD (after Sprint 147 exit)
planned_duration: 2-3d
framework: "6.4.0"
authority:
  proposer: "@architect"
  countersigners:
    - actor: "@pm"
      date: "2026-05-07"
    - actor: "@cto"
      date: "2026-05-07"
      grade: "G2 APPROVED"
  trigger: "ADR-053 G2 approved — Kimi Coding API direct integration + kimi-proxy removal"
previous_sprint: "Sprint 147 — Agent Queue Integrity + UI Upgrade"
references:
  - docs/02-design/01-ADRs/ADR-053-kimi-coding-api-direct.md
  - docs/01-planning/requirements.md (FR-013)
---

# Sprint 148 — Kimi Coding API Integration (ADR-053)

## Context

ADR-053 đã được G2 approved (2026-05-07). Toàn bộ code changes đã implemented trong PR-Cleanup + PR-Provider:
- `kimi-proxy` (OAuth subprocess) đã xoá hoàn toàn
- `kimi-coding` provider mới (CEO subscription, `api.kimi.com/coding/v1`)
- `kimi-api` (Moonshot) re-roled thành backup, URL `.cn` → `.ai`
- Env split: `KIMI_API_KEY` (coding) vs `MOONSHOT_API_KEY` (backup)

Sprint 148 focus: **merge, deploy, validate, close G3**.

---

## P0 — Merge & Deploy

### T1: Merge PR-Cleanup + PR-Provider (~30m)

**What:**
1. PR-Cleanup: xoá `kimi-proxy/`, env split, URL fix, dead code removal
2. PR-Provider: thêm `kimi-coding/` provider, update fallback chain, SSRF tests

**Pre-merge checks:**
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `pnpm test` → 8,131+ passing, 0 regressions
- [ ] CI grep: zero `kimi-proxy` / `claude-code-proxy` refs in `src/`

**Owner:** @coder

---

### T2: Environment Configuration (~15m)

**What:** Update `.env` trên production instance(s):
```bash
# Primary — CEO subscription
KIMI_API_KEY=sk-xxx
KIMI_API_BASE_URL=https://api.kimi.com/coding/v1

# Backup — Moonshot (optional)
MOONSHOT_API_KEY=sk-xxx
MOONSHOT_API_BASE_URL=https://api.moonshot.ai/v1
```

**Cleanup:** Remove tất cả `KIMI_PROXY_*` và `ENDIORBOT_KIMI_PROXY_*` env vars.

**Owner:** @devops

---

### T3: Smoke Test — Provider Registration (~15m)

**What:**
```bash
# Verify providers register correctly
node -e "
const { initializeProvidersFromEnv } = require('./src/providers/init.js');
initializeProvidersFromEnv().then(count => {
  console.log('Providers registered:', count);
  console.log('kimi-coding:', process.env.KIMI_API_KEY ? 'YES' : 'NO');
  console.log('kimi-api:', process.env.MOONSHOT_API_KEY ? 'YES' : 'NO');
});
"
```

**Expected:**
- `kimi-coding` registered nếu `KIMI_API_KEY` có
- `kimi-api` registered nếu `MOONSHOT_API_KEY` có
- Không có error/warning về `kimi-proxy`

**Owner:** @tester

---

## P1 — G3 Validation (closes ADR-053)

### T4: TC-145.3 Live Contract Test (~30m)

**Script:** `tests/manual/mt-145-kimi-coding-live.mjs`

**Requires:** `KIMI_API_KEY` thật (CEO subscription)

**Steps:**
1. Health check `https://api.kimi.com/coding/v1`
2. Chat round-trip với `kimi-for-coding`
3. Model normalization test
4. Verify latency < 8s

**Evidence to attach:** Screenshot/log output từ script

**Owner:** @tester (với key từ CEO)

---

### T5: Fallback Chain E2E (~1h)

**What:** Simulate failures để verify fallback:
1. **Kimi-coding available** → request goes to `kimi-coding` ✅
2. **Kimi-coding fails (5xx)** → falls back to `kimi-api` ✅
3. **Both fail** → falls back to `claude-code` / `ollama` ✅
4. **Key missing** → graceful skip, no error ✅

**Method:** Mock hoặc temporarily block `api.kimi.com` (via hosts file / firewall rule)

**Owner:** @tester

---

### T6: Non-Coding Agent KPI — Baseline (~2h)

**What:** Chạy 5 tasks non-coding qua `@pm`, `@researcher`, `@cpo` để lấy baseline:
- Task 1: Write requirements brief
- Task 2: Research summary
- Task 3: Strategy memo
- Task 4: Backlog prioritization
- Task 5: Risk assessment

**Metrics recorded:**
- Provider used (kimi-coding vs fallback)
- Latency per task
- Output quality score (rubric 1-5)

**Owner:** @cpo + @tester

---

## P2 — Documentation & Handoff

### T7: SOUL Files Update (~1h)

**What:** Update `docs/reference/templates/souls/SOUL-*.md`:
- Xoá `kimi-proxy` references
- Thêm `kimi-coding (primary) → kimi-api (backup)` trong `## Model Fallback Policy`

**Affected SOULs:** Tất cả 14 agent SOUL files

**Owner:** @pm

---

### T8: CHANGELOG Entry (~15m)

**What:** Viết CHANGELOG cho release chứa ADR-053:
```
## [0.x.x-beta.3] — 2026-05-XX
### Added
- Kimi Coding API provider (CEO subscription, api.kimi.com/coding/v1)
### Changed
- kimi-api (Moonshot) re-roled to backup; URL corrected .cn → .ai
### Removed
- kimi-proxy (OAuth subprocess) + claude-code-proxy dependency
```

**Owner:** @pm

---

### T9: Update .env.example & Docs (~30m)

**What:** Đảm bảo `.env.example`, `README.md`, `USAGE-GUIDE.md` phản ánh env vars mới.

**Owner:** @pm

---

## Sequencing

```
Day 1 AM: T1 (merge) + T2 (env config)
Day 1 PM: T3 (smoke test) + T4 (live contract test)
Day 2 AM: T5 (fallback E2E) + T6 (KPI baseline — 5 tasks)
Day 2 PM: T7 (SOUL update) + T8 (CHANGELOG) + T9 (docs)
```

---

## Exit Criteria (G3 Close)

- [x] G2 evidence delivered (8/8 conditions)
- [ ] **T4**: TC-145.3 live contract test PASS với key thật
- [ ] **T5**: Fallback chain E2E verified (3 scenarios)
- [ ] **T6**: Non-coding agent KPI baseline recorded
- [ ] **T7**: All SOUL files updated
- [ ] Full test suite: 8,131+ passing, 0 regressions
- [ ] CHANGELOG updated

---

## Post-Sprint

### 7-Day KPI Monitoring Window (starts after deploy)

**Tracked by:** @cpo + `analytics/metrics-collector.ts`

| Metric | Threshold | Action if breached |
|---|---|---|
| Fallback rate to `claude-code` | < 15% | If > 15% for 3 days → triage |
| Latency p95 | < 8s | If > 8s → investigate rate-limit |
| Quality score (non-coding) | ≥ 4.0/5 | If < 4.0 → ADR-052 amendment讨论 |

**Review date:** 7 days after deploy

---

*EndiorBot | Solo Developer Power Tool | SDLC 6.4.0 | Sprint 148 Planned — 2026-05-07*
