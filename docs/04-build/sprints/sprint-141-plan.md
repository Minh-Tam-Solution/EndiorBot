---
sprint: 141
status: G1 APPROVED — CTO countersigned 2026-04-23 with 6 conditions; CPO countersigned with 3 conditions
start_date: 2026-04-24
planned_duration: 3-5d
framework: "6.4.0"
authority:
  proposer: "@pm"
  countersigners:
    - actor: "@cto"
      date: "2026-04-23"
      grade: "APPROVED WITH CONDITIONS"
      reference: "Sprint 140/141 combined review"
    - actor: "@cpo"
      date: "2026-04-23"
      grade: "APPROVED WITH CONDITIONS"
      reference: "Product outcome alignment review"
  trigger: "Sprint 140 carry-forward + CEO request for cost telemetry dashboard"
  notes: |
    Sprint 141 validates ADR-052 in production by measuring actual cost savings,
    tuning Ollama confidence thresholds, and hardening Kimi fallback resilience.
    No new architectural decisions — execution-only sprint.
    CTO: 6 binding conditions. CPO: 3 additional product conditions.
previous_sprint: "Sprint 140 — Kimi2.6 Integration + Agent-Model Tier Mapping"
references:
  - docs/02-design/01-ADRs/ADR-052-agent-model-tier-mapping.md
  - docs/04-build/sprints/sprint-140-plan.md
---

# Sprint 141 — Cost Telemetry + Ollama Confidence + Kimi Resilience

## Context

Sprint 140 delivered ADR-052 (Agent-Model Tier Mapping) with an **estimated 45–60% cost reduction**. Sprint 141 is the **validation sprint**: measure whether the estimate holds, tune the edge cases, and harden the fallback paths before declaring ADR-052 production-stable.

Three focus areas:
1. **Cost telemetry** — per-agent, per-provider cost tracking to validate savings
2. **Ollama confidence** — `@assistant` (Tier 3, Ollama primary) needs auto-escalation if quality drops
3. **Kimi resilience** — `@coder` and 9 other Tier-2 agents depend on Kimi; proxy rate-limits must not degrade UX

## Gate Status

| Gate | Requirement | Status | Evidence |
|------|-------------|--------|----------|
| G0.1 | Problem statement | ✅ | Sprint 140 SC-6 deferred; Ollama quality unknown; Kimi rate-limit unmeasured |
| G1 | Requirements complete | ✅ | CTO + CPO countersigned 2026-04-23 with conditions |
| G2 | ADR(s) | ✅ | ADR-052 already approved; no new ADRs needed |

---

## CTO Binding Conditions (6)

| # | Condition | Applies to | Status |
|---|-----------|-----------|--------|
| C1 | Ship P0-2 with `FF_OLLAMA_AUTO_ESCALATE = false`; enable after 3-day data collection | P0-2 | pending |
| C2 | Document Vietnamese uncertainty keywords scope (in or out for Sprint 141) | P0-2 | **OUT for Sprint 141** — Vietnamese keywords deferred to Sprint 142; English-only heuristic for v1 |
| C3 | Verify `KIMI_API_KEY` provisioned before sprint start | P0-3 | CEO to confirm |
| C4 | Add rollback criterion: confidence scorer false-positive rate >30% → disable `FF_OLLAMA_AUTO_ESCALATE` | P0-2 | pending (impl in code) |
| C5 | Define `TokenUsage` interface extension before modifying `base-provider.ts` | P0-1 | pending (Day 1) |
| C6 | Define metrics JSON schema for `~/.endiorbot/metrics/YYYY-MM-DD.json` | P0-1 | pending (Day 1) |

## CPO Binding Conditions (3)

| # | Condition | Applies to | Status |
|---|-----------|-----------|--------|
| P1 | Add **business success metrics**: cost giảm thực tế + quality guardrail (retry/escalation/manual override rates) | Sprint-level | pending |
| P2 | Ghi rõ **decision owner** cho mid-sprint gates (PM đề xuất, CTO/CPO phê duyệt) | P0-3 | pending |
| P3 | Định nghĩa output của `cost report` theo 3 câu hỏi quyết định: (1) đang tốn nhất ở agent nào? (2) fallback nào đắt nhất? (3) tiết kiệm thực so với baseline bao nhiêu? | P0-1 | pending |

---

## P0-1: Per-Agent Cost Telemetry Dashboard

**What:** Extend `metrics-collector` and `budget-tracker` to record cost per agent and per provider, then expose a CLI command `endiorbot cost report`.

**Why:** Sprint 140 estimated 45–60% savings. Without telemetry, this is a guess.

**Files:**
- `src/analytics/metrics-collector.ts` — add `byAgent` and `byProvider` cost aggregation
- `src/budget/budget-tracker.ts` — record `agent` and `provider` on every `recordCost()` call
- `src/cli/commands/cost.ts` — new `endiorbot cost report [--today|--week|--agent <name>]` command
- `src/providers/base-provider.ts` — standardize `tokenUsage` return to include `providerId`

**CTO C5 — TokenUsage interface extension (define before modifying base-provider.ts):**

```typescript
interface ExtendedTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  providerId: AgentProviderId;  // "claude-code" | "kimi" | "ollama"
  model: string;                // e.g. "kimi-k2-6", "claude-opus-4"
  estimatedCostUsd?: number;    // from pricing-registry.ts
}
```

**CTO C6 — Metrics JSON schema:**

```json
{
  "date": "2026-04-24",
  "entries": [
    {
      "timestamp": "2026-04-24T10:15:00Z",
      "agent": "coder",
      "provider": "kimi",
      "model": "kimi-k2-6",
      "inputTokens": 1200,
      "outputTokens": 800,
      "estimatedCostUsd": 0.003,
      "sessionId": "abc-123",
      "durationMs": 4500,
      "fallbackUsed": false
    }
  ],
  "summary": {
    "totalCostUsd": 0.45,
    "byAgent": { "coder": 0.12, "reviewer": 0.08 },
    "byProvider": { "kimi": 0.30, "claude-code": 0.15, "ollama": 0.00 }
  }
}
```

**CPO P3 — `cost report` must answer 3 questions:**

1. **"Đang tốn nhất ở agent nào?"** → Top-N agents by cost, sorted descending
2. **"Fallback nào đắt nhất?"** → Entries where `fallbackUsed: true`, grouped by fallback provider
3. **"Tiết kiệm thực so với baseline bao nhiêu?"** → Compare actual Kimi cost vs. estimated Claude Sonnet cost (using pricing-registry baseline rates)

**Success criteria:**
- SC-1: `endiorbot cost report --today` shows breakdown by agent + provider answering CPO's 3 questions
- SC-2: Cost data persisted to `~/.endiorbot/metrics/YYYY-MM-DD.json` in CTO C6 schema
- SC-3: After 3 days of usage, `@coder` cost < 40% of pre-ADR-052 `@coder` cost (Kimi vs old Claude Sonnet)

---

## P0-2: Ollama Confidence Auto-Escalation

**What:** `@assistant` (Tier 3, Ollama primary) currently has no quality gate. Add a lightweight confidence check: if Ollama response is too short, contains uncertainty markers, or fails a keyword match, escalate to Kimi automatically.

**Why:** Free is only free if quality is acceptable. CEO must not notice `@assistant` getting dumber.

**Files:**
- `src/agents/router/providers.ts` — `callRemoteOllama()` returns `{ content, confidence }`
- `src/agents/router/ollama-confidence.ts` — new module: heuristic confidence scorer
  - Response length < 50 chars → low confidence
  - Contains "I don't know" / "unsure" / "cannot" → low confidence
  - No structured routing decision detected when agent is `@assistant` → low confidence
- `src/agents/channel-router.ts` — if `confidence < 0.6`, retry with `dispatchAgentFallback()`

**Threshold tuning:**
| Confidence | Action |
|-----------|--------|
| ≥ 0.7 | Accept Ollama response |
| 0.5 – 0.69 | Accept but log warning |
| < 0.5 | Auto-escalate to Kimi (when `FF_OLLAMA_AUTO_ESCALATE = true`) |

**CTO C1 — Feature-flagged rollout:**
- Ship with `FF_OLLAMA_AUTO_ESCALATE = false` (env: `ENDIORBOT_FF_OLLAMA_AUTO_ESCALATE`)
- Log ALL confidence scores for first 3 days (regardless of flag state)
- After 3-day data collection, review threshold distribution; enable flag only if thresholds are validated

**CTO C2 — Vietnamese uncertainty keywords:** OUT for Sprint 141. English-only heuristic v1. Vietnamese keywords (`"không biết"`, `"không chắc"`, `"tôi không"`) deferred to Sprint 142 — documented as known limitation.

**CTO C4 — Rollback criterion:** If confidence scorer false-positive rate >30% (measures responses that were escalated but Kimi returned equivalent quality), disable `FF_OLLAMA_AUTO_ESCALATE` and log investigation ticket.

**Escalation latency note:** The <2s budget includes Kimi proxy cold-start. If proxy is idle, first call may take 3-5s (proxy spin-up). Acceptable for `@assistant` UX; document as known behavior.

**Success criteria:**
- SC-4: `@assistant` responses with confidence < 0.5 trigger Kimi fallback within 5s (relaxed from 2s to account for proxy cold-start)
- SC-5: Ollama escalation rate < 20% (if >20%, model is too weak — revisit Tier 3 assignment)
- SC-4b: All confidence scores logged regardless of feature flag state (CTO C1 data collection)

---

## P0-3: Kimi Proxy Rate-Limit Monitoring

**What:** Track Kimi proxy health (rate-limit hits, fallback to `kimi-api`, fallback to Claude). Expose metrics in `endiorbot cost report` and add alerting.

**Why:** CEO's `kimi-proxy` (OAuth via `claude-code-proxy`) is known to be rate-limited in practice. If Tier-2 agents hit rate limits frequently, user experience degrades.

**Files:**
- `src/providers/kimi-proxy/index.ts` — intercept 429 responses, increment counter
- `src/providers/kimi-proxy/rate-limit-monitor.ts` — new module: track 429s, fallback frequency, latency
- `src/agents/router/providers.ts` — `callKimiProvider()` logs fallback reason (proxy vs API)
- `src/cli/commands/cost.ts` — `endiorbot cost report --provider kimi` shows rate-limit stats

**CTO C3 — Pre-sprint prerequisite:** Verify `KIMI_API_KEY` (Moonshot API) is provisioned and has sufficient quota. If no key → fallback chain degrades to Claude (expensive), defeating the cost optimization. **CEO to confirm before Day 1.**

**Decision gate (Sprint 141 mid-point, CPO P2 — decision owner):**

| Metric | Threshold | Action | Decision owner |
|--------|-----------|--------|---------------|
| Kimi proxy 429 rate > 30% | Mid-sprint | Promote `kimi-api` to co-primary | @pm proposes → @cto approves |
| Kimi proxy 429 rate < 10% | Mid-sprint | Keep current order, monitor only | @pm confirms |
| Ollama escalation rate > 20% | Mid-sprint | Demote `@assistant` from Ollama to Kimi | @pm proposes → @cpo approves |
| Cost savings < 30% (vs. baseline) | End-of-sprint | Investigate: wrong pricing? wrong routing? | @pm escalates to CEO |

**Success criteria:**
- SC-6: Rate-limit telemetry visible in `endiorbot cost report`
- SC-7: Fallback chain latency < 5s end-to-end (proxy fail → API succeed)

---

## P1-1: @consult ChatHandler Full Kimi Wiring

**What:** Sprint 140 added `kimi` to the CLI `--kimi` flag and `multi-model-orchestrator.ts`, but `ChatHandler` (`src/gateway/chat-handler.ts`) resolves `"kimi"` → `kimi-api`/`kimi-proxy` via a conditional block. Harden this to use the provider registry directly.

**Why:** Technical debt from rushed 3-model panel expansion.

**Files:**
- `src/gateway/chat-handler.ts` — replace conditional `providerId === "kimi"` resolution with registry lookup
- `src/providers/init.ts` — ensure `kimi-proxy` and `kimi-api` register with `models` array including `kimi-k2-6`

**Success criteria:**
- SC-8: `endiorbot consult "test" --kimi kimi-k2-6 --primary kimi` routes through provider registry, not hardcoded logic

---

## Sequencing

```
Day 1: P0-1 cost telemetry (metrics-collector + budget-tracker wiring)
Day 2: P0-2 Ollama confidence (heuristic scorer + fallback integration)
Day 3: P0-3 Kimi monitoring (rate-limit interceptor + reporting)
Day 4: P1-1 @consult hardening (registry lookup, cleanup)
Day 5: Integration testing + report validation
```

---

## Test Plan

| Component | Tests |
|-----------|-------|
| Cost telemetry | Unit: mock `recordCost()` with agent/provider; verify aggregation. CLI: `cost report` output parsing |
| Ollama confidence | Mock Ollama responses (short, unsure, valid) → verify escalation trigger at < 0.5 |
| Kimi monitoring | Mock 429 response → verify counter increment; mock timeout → verify fallback latency |
| @consult wiring | Integration: `consult` with `--primary kimi` hits registry, not conditional |

Estimated: ~15-20 new tests. Full regression against 8K+ tests.

---

## Success Criteria (Sprint-Level)

### Technical

- **SSC-1:** `endiorbot cost report` produces readable breakdown (agent × provider matrix)
- **SSC-2:** Ollama escalation rate measured and < 20% for `@assistant`
- **SSC-3:** Kimi proxy 429 rate measured and decision gate documented
- **SSC-4:** `@consult --primary kimi` works end-to-end via registry
- **SSC-5:** Full test suite passes; `npx tsc --noEmit` clean

### Business (CPO P1)

- **BSC-1:** Cost/session giảm thực tế ≥ 30% so với pre-ADR-052 baseline (measured via `cost report --baseline`)
- **BSC-2:** Quality guardrail: retry/escalation/manual-override rate không tăng >10% so với Sprint 140 baseline
- **BSC-3:** CEO satisfaction: không có complaint về chất lượng response từ Tier-2 (Kimi) agents sau 3 ngày sử dụng

---

## Carry-Forward to Sprint 142

### Sprint 141 items (conditional)

| Item | Trigger |
|------|---------|
| Promote `kimi-api` to co-primary | If P0-3 shows proxy 429 rate > 30% |
| Demote `@assistant` from Ollama | If P0-2 shows escalation rate > 20% |
| Cost optimization dashboard | If CEO wants real-time web dashboard instead of CLI |
| Vietnamese uncertainty keywords for P0-2 | CTO C2 scoped out of Sprint 141 |
| Enable `FF_OLLAMA_AUTO_ESCALATE` | After 3-day data validates thresholds (CTO C1) |

### OpenMythos deferred items (from Sprint 139 adoption roadmap)

| Item | Original Sprint | Status | Reactivation Trigger |
|------|----------------|--------|---------------------|
| Phase-Specific Behavior (Prelude/Recurrent/Coda extraction) | 140 | **Deferred** — replaced by Kimi pivot | Next session architecture sprint |
| Stability Guard for Long Loops (StabilityPolicy interface) | 141 | **Deferred** — replaced by Kimi validation | Long autonomous session > 60 min observed |
| Expert Routing (historical performance scoring, FF-gated) | 141 | **Deferred** — partially superseded by ADR-052 tier mapping | After cost telemetry validates provider performance data |

These items remain architecturally valid. Sprint 139's evaluator optimizations (convergence guard, adaptive budget, frozen injection, loop-index) are the foundation layer. The deferred items build on top. No urgency per CTO 2026-04-23 — Kimi cost savings have higher immediate ROI.

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | Sprint 141 G1 APPROVED — 2026-04-23*
