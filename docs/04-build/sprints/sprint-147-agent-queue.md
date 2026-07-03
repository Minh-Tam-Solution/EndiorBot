---
sprint: 147
status: DRAFT — queued after Sprint 146
start_date: TBD
planned_duration: 3-4d
framework: "6.4.0"
authority:
  proposer: "@pm"
  countersigners: []
  trigger: "CEO dogfooding 2026-04-27 — 3× duplicate agent messages on Telegram after gateway restart"
previous_sprint: "Sprint 146 — Post-Launch Quality Hardening"
references:
  - docs/02-design/14-Technical-Specs/gateway-architecture-review-sprint-143.md
  - docs/05-test/DOGFOODING-TEST-PLAN.md
---

# Sprint 147 — Agent Queue Integrity + UI Upgrade

## Context

CEO dogfooding session (2026-04-27 19:31-19:39) exposed a 3-layer dedup gap:

```
19:31 @pm review code sprint 3     → msgId 101 → enqueue → CC Bridge starts
19:38 @pm review code sprint 3 t   → msgId 102 → enqueue → "đang xử lý" sent BEFORE lock
19:38 @pm review code sprint 3     → msgId 103 → enqueue → same
19:39 → CEO sees 3× "đang xử lý" + 1× response (2 duplicate progress messages)
```

**OGA team diagnosis (confirmed by @tester):**
- BusDebounce (500ms) — expired, messages 7 min apart
- BusDedup (messageId) — different messageIds, no dedup
- Agent session lock (Sprint 143) — exists but positioned AFTER progress message
- Content dedup — **missing entirely**

**Sprint 143 session lock (`225364a`) works at `callAI()` level** but the "⏳ đang xử lý" progress message is sent at OTT adapter level (line 269 of `telegram-ott-adapter.ts`) BEFORE bus consumer reaches `callAI()`. CEO sees duplicate progress messages even though only 1 agent call actually processes.

---

## P0 — Agent Queue Integrity (blocks CEO daily usage)

### T1: Move Progress Message After Lock Check (~2h)

**Root cause:** "⏳ đang xử lý" sent at OTT adapter layer BEFORE session lock in `callAI()`.

**Current flow:**
```
OTT Adapter → send "đang xử lý" → publish to bus → consumer → ingress → callAI() → lock check
```

**Target flow:**
```
OTT Adapter → publish to bus → consumer → ingress → callAI() → lock check → IF OK → send "đang xử lý" via progressFn
```

**What:**
1. Remove the eager "đang xử lý" send from `telegram-ott-adapter.ts:265-270` (the `agentMatchBus` block)
2. Move agent detection + progress message into `callAI()` — send AFTER lock check succeeds
3. If lock rejects → send "⏳ @pm đang xử lý request trước (Xs elapsed)" via replyFn (already implemented in Sprint 143 lock)

**Files:**
- `src/channels/telegram/telegram-ott-adapter.ts` — remove eager progress send (~5 LoC delete)
- `src/agents/channel-router.ts` — send progress message after lock acquired (~10 LoC add)

**Risk:** CEO sees no immediate feedback when sending @agent message. Mitigation: bus consumer emits tick at 20s anyway (Sprint 136 A6). Gap is 0-20s of silence → acceptable for correctness.

**Tests:**
- Send @pm twice rapidly → only 1 "đang xử lý", second gets "đang xử lý request trước"
- Send @pm once → "đang xử lý" appears after lock acquired (no duplicate)

**Owner:** @coder

---

### T2: Content Dedup at Bus Consumer Level (~3h)

**Missing layer:** No dedup for same sender + same/similar agent message within time window.

**What:** Add content-based dedup in `src/bus/consumer.ts` before `ingress.handleInbound()`:

```typescript
// Content dedup key: senderId + agentMention + normalizedText
const dedupKey = `${msg.senderId}:${agentMatch}:${normalize(msg.content)}`;
const CONTENT_DEDUP_WINDOW_MS = 5 * 60_000; // 5 minutes

if (contentDedupMap.has(dedupKey)) {
  const prev = contentDedupMap.get(dedupKey)!;
  if (Date.now() - prev.timestamp < CONTENT_DEDUP_WINDOW_MS) {
    // Skip — same intent already processing or recently processed
    msg.replyFn("⏳ Request tương tự đang xử lý hoặc vừa hoàn thành. Chờ kết quả hoặc gửi lại sau.", {
      correlationId: msg.correlationId, isTrainableTurn: false
    }).catch(() => {});
    return;
  }
}
contentDedupMap.set(dedupKey, { timestamp: Date.now(), correlationId: msg.correlationId });
```

**Normalization rules:**
- Lowercase
- Collapse whitespace
- Remove trailing punctuation
- Similarity threshold: exact match for Sprint 147 (fuzzy matching deferred to 148)

**Cleanup:** Evict entries older than `CONTENT_DEDUP_WINDOW_MS` on each check (prevent memory leak).

**Files:**
- `src/bus/consumer.ts` — add content dedup check before `ingress.handleInbound()` (~40 LoC)

**Tests:**
- Same text from same sender within 5min → second skipped with notice
- Same text from different sender → both process (different users)
- Same sender, different agent (@pm then @coder) → both process
- Same sender, same agent, different text → both process
- Same sender, same text, after 5min → processes (window expired)

**Owner:** @coder

---

### T3: Queue Replay Filter on Gateway Restart (~1h)

**Scenario:** Gateway restarts → N queued messages from same sender replay → all process.

**What:** When bus consumer starts processing after restart, apply last-wins filter:

```typescript
// On batch replay: group by (senderId + agentMention), keep only last message per group
```

**Implementation:** BusDebounce already has `lastMessage` tracking per sender. Extend: on startup, if debounce window is 0 (immediate), check if there are multiple messages for same sender+agent queued → discard all except the last.

**Files:**
- `src/bus/consumer.ts` — add startup replay filter (~20 LoC)
- `src/bus/debounce.ts` — extend to support batch dedup on flush

**Tests:**
- 3 queued messages same @pm from same sender → only last processes
- 3 queued messages different agents → all 3 process (different agents)

**Owner:** @coder

---

## P1 — UI/UX Upgrade (carry-forward from Sprint 146 if not complete)

### T4: Desktop UI Upgrade (from Sprint 146 T12) (~6h)

Apply design system from `landing/endiorbot-app/app-styles.css` to production Desktop pages.
See Sprint 146 T12 for full scope.

**Owner:** @coder

---

### T5: WebUI Static Rebuild (from Sprint 146 T13) (~3h)

Option A (CPO approved): rebuild inline HTML in `web-server.ts` with design tokens.
See Sprint 146 T13 for full scope.

**Owner:** @coder

---

### T6: Landing Page Production Build (from Sprint 146 T14) (~2h)

Vite build → static files → GitHub Pages deploy at endior.net.
See Sprint 146 T14 for full scope.

**Owner:** @devops

---

## P2 — Backlog

### T7: Shared `@endiorbot/ui` Package (CPO Sprint 147 directive)

Extract shared design tokens + components into a workspace package consumed by Desktop + Web.

**Scope:** pnpm workspace config → `packages/ui/` → CSS variables + React components → migrate Desktop first → then Web.

**Owner:** @architect + @coder
**Depends on:** T4, T5 complete (visual parity achieved first)

---

### T8: Fuzzy Content Dedup (~2h)

Extend T2 from exact-match to fuzzy similarity (Levenshtein distance ≤ 3 OR cosine similarity > 0.9 on normalized tokens). Handles CEO typo retries like `"review sprint 3"` vs `"review sprint 3 t"`.

**Owner:** @coder
**Depends on:** T2 complete

---

### T9: Desktop Pages — Budget, Audit, Approvals (from Sprint 146 T9) (~4h)

Backend features with no Desktop UI. See Sprint 146 T9 for scope.

**Owner:** @coder

---

## Sequencing

```
Day 1: T1 (move progress after lock, 2h) + T2 (content dedup, 3h)
Day 2: T3 (replay filter, 1h) + T4 (Desktop UI upgrade, start)
Day 3: T4 (Desktop UI, continue) + T5 (WebUI rebuild)
Day 4: T6 (landing build) + T7/T8/T9 if capacity
```

---

## Exit Criteria

- [ ] Zero duplicate "đang xử lý" messages when CEO sends @agent multiple times (T1)
- [ ] Same text from same sender within 5min → deduplicated with notice (T2)
- [ ] Gateway restart with queued messages → last-wins per sender+agent (T3)
- [ ] All 8,124+ tests pass, build clean
- [ ] Desktop UI matches design mockup (T4, if reached)

---

## Verification (CEO dogfooding test)

```
# Test T1: progress after lock
1. Send @pm plan sprint 148
2. Immediately send @pm plan sprint 148 again
3. Expected: 1× "đang xử lý" + 1× "đang xử lý request trước" (NOT 2× "đang xử lý")

# Test T2: content dedup
1. Send @pm review code sprint 3
2. Wait 30s, send @pm review code sprint 3 again
3. Expected: second gets "request tương tự đang xử lý"

# Test T3: restart replay
1. Stop endiorbot serve
2. Send 3× @pm messages on Telegram while server down
3. Start endiorbot serve
4. Expected: only last message processes
```

---

*EndiorBot | Solo Developer Power Tool | SDLC 6.4.0 | Sprint 147 Draft — 2026-04-27*
