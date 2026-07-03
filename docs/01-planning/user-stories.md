# User Stories

**Project:** EndiorBot
**Version:** 1.0.0
**Date:** 2026-02-21
**SDLC Stage:** 01-PLANNING

---

## Epic 1: Multi-Model AI Orchestration ✅ SHIPPED

### US-1.1: Automatic Expert Consultation

**As a** solo developer
**I want to** query multiple AI models automatically
**So that** I get diverse expert opinions without manual copy/paste

**Acceptance Criteria:**
- [x] Can configure expert panel (Claude Code, Kimi, OpenAI, Ollama — 5 providers)
- [x] Queries are sent in parallel
- [x] Responses are consolidated with consensus detection
- [x] Disagreements are highlighted with evidence
- [x] Total query time < 60 seconds

**Story Points:** 8
**Delivered:** Sprint 54+ (CC-first routing ADR-052, Sprint 143)

---

### US-1.2: Task-Based Model Routing

**As a** solo developer
**I want to** have the right models selected based on task type
**So that** I get the best expertise for each situation

**Acceptance Criteria:**
- [x] Architecture tasks → multi-model /consult (CC + OpenAI + Kimi)
- [x] Code generation → CC primary (fast, Kimi fallback)
- [x] Security review → multi-model via /consult
- [x] Research → multi-model via /consult (Gemini available in /consult)

**Story Points:** 5
**Delivered:** Sprint 140+ (provider routing, ADR-052 CC-first)

---

### US-1.3: Single Model Mode

**As a** solo developer
**I want to** force single model mode when I need speed
**So that** I can get quick answers without consultation overhead

**Acceptance Criteria:**
- [x] `endiorbot --model claude "quick fix"` uses CC only
- [x] No consolidation step
- [x] Response time < 10 seconds for simple queries (evaluator skip for simple tasks, Sprint 139)

**Story Points:** 3
**Delivered:** Sprint 54 + Sprint 139 (evaluator dynamic budget)

---

## Epic 2: Project Context Management ✅ SHIPPED

### US-2.1: Quick Project Switch

**As a** solo developer
**I want to** switch between projects instantly
**So that** I don't waste time re-establishing context

**Acceptance Criteria:**
- [x] `endiorbot switch bflow` switches to Bflow
- [x] Previous context saved automatically
- [x] New context loaded with SDLC state
- [x] Switch completes in < 2 seconds

**Story Points:** 5
**Delivered:** Sprint 54 (repos.json + ChatFocus, ADR-029)

---

### US-2.2: Context Preservation

**As a** solo developer
**I want to** preserve conversation history when switching
**So that** I can resume where I left off

**Acceptance Criteria:**
- [x] Conversation history saved on switch
- [x] History compacted if > 80% token budget
- [x] SDLC stage and gates preserved
- [x] Active task state preserved

**Story Points:** 5
**Delivered:** Sprint 55-56 (session resume, Brain provenance)

---

### US-2.3: Uncommitted Changes Warning

**As a** solo developer
**I want to** be warned about uncommitted changes
**So that** I don't lose work when switching projects

**Acceptance Criteria:**
- [x] Detect uncommitted git changes
- [x] Show warning before switch
- [x] Option to stash or commit first

**Story Points:** 3
**Delivered:** Sprint 57 (FR-002.3)

---

## Epic 3: SDLC Automation ✅ SHIPPED

### US-3.1: Automatic Gate Evaluation

**As a** solo developer
**I want to** auto-evaluate gate readiness
**So that** I don't manually track checklists

**Acceptance Criteria:**
- [x] `endiorbot gate status G2` evaluates G2
- [x] Checklist items auto-checked where possible
- [x] Missing items clearly listed
- [x] Vibecoding Index calculated
- [x] Recommendation provided
- [x] `endiorbot gate mark` for manual items (Sprint 143)

**Story Points:** 8
**Delivered:** Sprints 61-68 (gate engine, contracts, dashboard)

---

### US-3.2: Evidence Collection

**As a** solo developer
**I want to** have evidence collected automatically
**So that** I have audit trail for gates

**Acceptance Criteria:**
- [x] File references captured with hash (PatchManager, Sprint 68)
- [x] Commit references captured
- [x] Test results captured
- [x] Evidence stored in `~/.endiorbot/evidence/`
- [x] Gate mark evidence trail (Sprint 143)

**Story Points:** 5
**Delivered:** Sprint 68 (PatchManager + evidence store)

---

### US-3.3: CRP Generation

**As a** solo developer
**I want to** auto-generate Change Request Packages
**So that** I don't write boilerplate documentation

**Acceptance Criteria:**
- [x] Parse recent git commits
- [x] Extract change summary
- [x] Generate CRP markdown
- [x] Include SDLC metadata

**Story Points:** 5
**Delivered:** Sprint 68 (compliance dashboard, report generator)

---

## Epic 4: Security & Quality ✅ SHIPPED

### US-4.1: Input Sanitization

**As a** solo developer
**I want to** have inputs sanitized automatically
**So that** I'm protected from injection attacks

**Acceptance Criteria:**
- [x] SQL injection patterns blocked
- [x] XSS patterns blocked
- [x] Command injection blocked
- [x] Path traversal blocked
- [x] SSRF block-list (Sprint 133, openclaw backport S2)

**Story Points:** 5
**Delivered:** Sprint 54 (input-sanitizer) + Sprint 133 (SSRF audit)

---

### US-4.2: Output Scrubbing

**As a** solo developer
**I want to** have outputs scrubbed of secrets
**So that** I never accidentally leak credentials

**Acceptance Criteria:**
- [x] API keys redacted
- [x] Passwords redacted
- [x] Tokens redacted
- [x] AWS keys redacted

**Story Points:** 5
**Delivered:** Sprint 54 (output-scrubber)

---

### US-4.3: Vibecoding Index

**As a** solo developer
**I want to** see code quality score before commit
**So that** I maintain high standards

**Acceptance Criteria:**
- [x] Score 0-100 calculated
- [x] Green (0-30), Yellow (31-60), Orange (61-80), Red (81-100)
- [x] 5 quality signals measured
- [x] Block commit if Red zone

**Story Points:** 5
**Delivered:** Sprint 88 (Vibecoding in Bridge output pipeline)

---

## Epic 5: Junior Developer Support ✅ PARTIAL (Desktop Hub shipped, full delegation deferred)

### US-5.1: Task Assignment

**As a** solo developer
**I want to** assign tasks to junior developers via the Desktop UI
**So that** they have clear work items

**Acceptance Criteria:**
- [x] Junior Hub page available in Desktop app (Sprint 144)
- [ ] Full task assignment workflow with AI assist (deferred — backlog)
- [ ] Junior sees assigned tasks on login (deferred)

**Story Points:** 5
**Delivered:** Sprint 144 (Junior Hub Desktop page, basic UI functional)

---

### US-5.2: Learning Mode

**As a** junior developer
**I want to** understand why AI suggests certain approaches
**So that** I learn best practices

**Acceptance Criteria:**
- [ ] AI explains decisions when Learning Mode ON (deferred — backlog)
- [ ] References to documentation provided
- [ ] Best practices highlighted
- [ ] Alternative approaches discussed

**Story Points:** 3
**Status:** Backlog

---

### US-5.3: Sandbox Permissions

**As a** solo developer
**I want to** restrict junior access to safe areas
**So that** they can't break production

**Acceptance Criteria:**
- [ ] Junior can't push to main/master (deferred — backlog)
- [ ] Junior can't approve gates
- [ ] Junior can't access secrets
- [ ] All PRs require approval

**Story Points:** 3
**Status:** Backlog

---

## Epic 6: Desktop Channel ✅ SHIPPED (Sprint 144)

### US-6.1: Desktop App

**As a** solo developer
**I want to** use EndiorBot from a native desktop app
**So that** I can access all features without a terminal

**Acceptance Criteria:**
- [x] 9 pages: Dashboard, Chat, Projects, Gates, Experts, Settings, Junior Hub, Zalo, Telegram
- [x] Gateway auto-starts as Electron subprocess on launch
- [x] API key management in Settings page
- [x] Live data from repos.json in Projects page

**Story Points:** 13
**Delivered:** Sprint 144 (ADR-044 Desktop channel)

---

## Epic 7: Gateway Resilience ✅ SHIPPED (Sprint 143-144)

### US-7.1: Always-On Availability

**As a** solo developer
**I want to** EndiorBot to stay responsive even when Claude Code is unavailable
**So that** I never get a dead end response on Telegram

**Acceptance Criteria:**
- [x] PID lockfile prevents duplicate serve processes (Sprint 144)
- [x] Provider circuit breaker: 2 CC failures → instant Kimi fallback (Sprint 144)
- [x] OTT timeout 60s with immediate Kimi fallback (Sprint 144)
- [x] Telegram plain-text retry on Markdown parse failure (Sprint 143)
- [x] Per-agent session lock prevents duplicate concurrent calls (Sprint 143)

**Story Points:** 8
**Delivered:** Sprints 143-144 (FR-011)

---

## Sprint Backlog Summary

| Epic | Stories | Total Points | Status |
|------|---------|--------------|--------|
| E1: Multi-Model | 3 | 16 | ✅ SHIPPED |
| E2: Context | 3 | 13 | ✅ SHIPPED |
| E3: SDLC | 3 | 18 | ✅ SHIPPED |
| E4: Security | 3 | 15 | ✅ SHIPPED |
| E5: Junior | 3 | 11 | Partial (Desktop Hub only) |
| E6: Desktop | 1 | 13 | ✅ SHIPPED |
| E7: Gateway Resilience | 1 | 8 | ✅ SHIPPED |
| **Total** | **17** | **94** | |

---

*Solo Developer Power Tool | SDLC Framework v6.4.0 - Stage 01: Planning | Updated Sprint 144 (2026-04-27)*
