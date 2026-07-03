# AI Development Workflows — EndiorBot + SDLC 6.4.0

**Phân tích use cases, workflows khi phát triển ứng dụng với AI Agents**
**Tham chiếu:** Sau Sheong, "From vibe coding to agentic engineering" (Apr 2026)
**Framework:** SDLC 6.4.0 · EndiorBot Sprint 144

---

## Bối cảnh: 5 cấp độ AI Engineering (Dan Shapiro)

Sau Sheong trích dẫn mô hình 5 cấp độ. EndiorBot hoạt động ở **Level 2–3** và đang tiến tới **Level 4**:

| Level | Mô tả | EndiorBot hiện tại | SDLC 6.4.0 Alignment |
|-------|-------|--------------------|----------------------|
| **L1** | Spicy autocomplete (Copilot) | Không — EndiorBot không phải IDE plugin | Không áp dụng |
| **L2** | AI coding assistants (Claude Code, Cursor) | **Có** — `@coder` spawn Claude Code trong tmux pane, multi-turn, persist session | Stage 04 (Build) — agent thực thi theo task, CEO review output |
| **L3** | Autonomous agents (ticket → deployment) | **Đang xây** — `ENDIORBOT_AUTO_HANDOFF=true` + exec-policy presets cho agent chain tự động | Stage 04–06 — agent chain PM→Architect→Coder→Reviewer→Tester, gated by G0→G4 |
| **L4** | Collaborative agent networks | **Thiết kế** — 14 SOUL agents + GoalDecomposer + HandoffGuards + ParallelExecutor (deferred ADR-046) | Full SDLC — multi-agent orchestration under governance |
| **L5** | Software factory | Chưa | Ngoài scope hiện tại |

---

## Ba sự thay đổi lớn (Sau Sheong) → EndiorBot đáp ứng thế nào

### 1. "Bottleneck đã dịch chuyển — từ engineering capacity sang decision speed"

**Quan sát của Sau Sheong:** Agent có thể tạo prototype overnight, nhưng approval deploy mất hàng tháng. Tổ chức nhanh nhất là tổ chức có khoảng cách ngắn nhất giữa quyết định và hành động.

**EndiorBot giải quyết:**

```
Workflow: CEO Decision Pipeline (< 30 giây)

Telegram: /gate status
→ "G2 pending: ADR-046 cần CEO approve"
→ CEO tap "Approve" trên điện thoại
→ EndiorBot: Agent chain resume tự động

# So sánh:
# Truyền thống: Email → Meeting → Minutes → JIRA ticket → Sprint planning → 2 tuần
# EndiorBot:    Telegram notification → Tap approve → Agent resumes → 30 giây
```

**SDLC 6.4.0 alignment:**
- **Gate Engine as code** (ADR-004) — gates evaluated programmatically, không manually checked
- **Conversation-First Governance** — approval qua OTT (Telegram/Zalo), không cần mở laptop
- **`ENDIORBOT_AUTO_HANDOFF=true`** — agent tự route, CEO chỉ approve ở boundary decisions

---

### 2. "Code có thể không còn là artifact bền vững — specifications và decision history mới quan trọng"

**Quan sát của Sau Sheong:** Nếu AI regenerate code on demand, thì thứ cần bảo tồn là *tại sao* quyết định được đưa ra, không phải code.

**EndiorBot giải quyết — ADR-first workflow:**

```
Workflow: Architecture Decision → Code → Evidence Trail

# Bước 1: Đặt câu hỏi kiến trúc
endiorbot consult "Redis vs PostgreSQL cho session storage?"
→ Claude phân tích + GPT phân tích + Gemini phân tích
→ Consensus + disagreements

# Bước 2: @architect tạo ADR (durable artifact)
endiorbot @architect "tạo ADR cho session storage dựa trên consult results"
→ docs/02-design/01-ADRs/ADR-047-session-storage.md
→ Lý do quyết định, trade-offs, rejected alternatives

# Bước 3: @coder implement (ephemeral — có thể regenerate)
endiorbot @coder "implement Redis session store theo ADR-047"
→ Code sinh ra từ ADR, có thể tái tạo nếu cần

# Bước 4: Evidence trail tự động
→ exec-policy audit log: ai đã chạy gì
→ Gate evidence: G2 checked, G3 reviewed
→ Sprint docs: what shipped, why, approved by whom
```

**SDLC 6.4.0 alignment:**
- **10-stage documentation structure** (00-foundation → 09-govern) — specifications, ADRs, gate evidence bền vững hơn code
- **SOUL-pm.md Ground-Truth Verification** — mọi claim phải verify trước khi trở thành decision
- **Correction-trail discipline** — sai thì sửa visible (không silent rewrite), tạo institutional memory
- **Vibecoding Index** (Section 7) — đo chất lượng code AI tạo ra, gate ở mức phù hợp theo tier

---

### 3. "Team structures đang co lại — 1 người có thể làm việc của 5-12 người"

**Câu chuyện thực của Sau Sheong:**
- 1 software engineer → duy trì hệ thống production dùng bởi 150+ projects (Singpass, GovWallet, TradeNet). 256 commits, 94 MRs trong 1 tháng. Ước tính cần 3-5 engineers nếu không có Claude Code.
- 2 data scientists (không có background software engineering) → 30 full-stack showcases, 150+ users, 20+ agencies. Giảm 5-7 ngày/showcase xuống 1-2 ngày (**30x multiplier**).
- 1 PM → vibecoded features trong kỳ nghỉ, giờ dùng trong client engagements.

**EndiorBot workflow cho "1-person team":**

```
Workflow: Solo Developer — Full SDLC in 1 Day

# Sáng: Plan (15 phút)
endiorbot plan "thêm OAuth2 login cho app"
→ Structured plan: user stories, acceptance criteria, agent assignments

# Sáng: Design (30 phút)
endiorbot @architect "thiết kế OAuth2 flow theo plan"
→ ADR + sequence diagram + API spec

# Trưa: Implement (2-4 giờ, autonomous)
export ENDIORBOT_AUTO_HANDOFF=true
endiorbot exec-policy preset balanced
endiorbot @coder "implement OAuth2 theo thiết kế @architect"
→ Claude Code: viết code, tạo tests, commit
→ Auto-handoff: @coder → @reviewer (security review)
→ Auto-handoff: @reviewer → @tester (integration tests)
# CEO monitor trên Telegram, chỉ approve khi cần

# Chiều: Review & Ship (30 phút)
endiorbot @reviewer "final review trước merge"
endiorbot gate status  # G3: Ship Ready?
endiorbot exec-policy audit  # Xem AI đã làm gì
# → Merge và deploy

# Kết quả: 1 ngày, 1 người, full SDLC compliance
# Truyền thống: 2-3 sprints, 3-5 người, 2-4 tuần
```

**SDLC 6.4.0 alignment:**
- **14 SOUL agents** thay thế 14 vai trò trong team truyền thống
- **Tier system** (LITE→ENTERPRISE) — solo dev dùng LITE (2 files, 4 stages), đủ governance cho side projects
- **Sprint automation** — `endiorbot plan` → `@architect` → `@coder` → `@reviewer` → `@tester` là 1 pipeline, không phải 5 meetings

---

## Use Cases phổ biến khi phát triển với AI

### UC-1: Prototype nhanh (Vibe Coding → Governed Vibe Coding)

**Vấn đề Sau Sheong nêu:** PM vibecoded features trong kỳ nghỉ, dùng trong client engagements. Không ai review security. "Capability tạo risk ở tốc độ tạo value."

**EndiorBot giải pháp: Governed Vibe Coding**

```
# Thay vì: Mở Claude Code trực tiếp, paste prompt, copy code, deploy
# Dùng:
endiorbot exec-policy preset balanced          # Hard-deny vẫn chặn lệnh nguy hiểm
endiorbot @fullstack "build landing page cho product X"
# → Code được tạo TRONG exec-policy boundary
# → @reviewer tự động review nếu AUTO_HANDOFF=true
# → Audit log ghi lại mọi thứ AI đã chạy
# → Security review có thể chạy sau: endiorbot @cso "audit landing page"
```

**SDLC alignment:** Vibecoding Index (Section 7) đo chất lượng code AI sinh ra. Score > 60 → block ở STANDARD tier. Guardrails by default, không phải afterthought.

---

### UC-2: Bootstrap & Explore OSS repos

**Use case:** Muốn thử 1 OSS repo mới, hiểu architecture, đánh giá có nên adopt không.

```
# 1 lệnh: Clone → Detect → Build → Run
endiorbot bootstrap https://github.com/some/repo --build --run

# Sau đó: Hỏi AI về architecture
endiorbot chat
> "Explain the authentication flow in this codebase"
> "What are the main database models?"
> "Security concerns?"

# Hoặc chạy multi-model consult
endiorbot consult "nên adopt repo này hay build in-house?"
```

---

### UC-3: Legacy modernization

**Câu chuyện Sau Sheong:** GovTech dùng *Graphiqode* để phân tích codebases, build dependency graphs, extract business rules từ legacy code.

**EndiorBot workflow:**

```
# Bước 1: Analyze
endiorbot @researcher "phân tích legacy codebase, identify dependencies và business rules"

# Bước 2: Plan migration
endiorbot @architect "thiết kế migration strategy từ Express sang Fastify"
endiorbot consult "Express vs Fastify vs Hono cho migration?"

# Bước 3: Incremental implement
endiorbot @coder "migrate route /api/users sang Fastify, giữ backward compat"
endiorbot @tester "viết regression tests đảm bảo behavior không đổi"

# Bước 4: Verify
endiorbot compliance check  # SDLC structure intact?
endiorbot gate status       # Gates vẫn pass?
```

---

### UC-4: AI Code Review at Scale

**Câu chuyện Sau Sheong:** GovTech build *Prelude* — AI code review tool. Mỗi MR → Claude Code chạy trong sandbox → phân tích theo government classification policies → post structured comments.

**EndiorBot tương đương:**

```
# Review 1 module
endiorbot @reviewer "security review payment module"

# Review với nhiều model
endiorbot @reviewer "review auth module" 
endiorbot consult "có security concern nào trong auth flow này không?"

# Automated trong CI (tương lai)
# endiorbot @reviewer --ci --fail-on-high "review PR #123"
```

**SDLC alignment:** `@reviewer` là 1 trong 14 SOUL agents, co-owns G3 gate với `@tester`. Không ai ship mà không qua review.

---

### UC-5: Multi-model Decision Making

**Use case:** Quyết định kiến trúc quan trọng, cần nhiều góc nhìn.

```
endiorbot consult "microservices vs monolith cho app 100K LOC, team 3 người?"

# Kết quả:
# Claude: Monolith — team nhỏ, communication overhead thấp
# GPT:    Modular monolith — best of both worlds
# Gemini: Depends on deployment frequency — if daily, consider microservices
#
# Consensus: Modular monolith
# Disagreements: Deployment strategy

# CEO quyết định, @architect implement
endiorbot @architect "thiết kế modular monolith theo consensus từ consult"
```

---

### UC-6: Continuous Governance (không phải checkpoint governance)

**Quan sát Sau Sheong:** "Compliance as manual checklist → teams skip under deadline pressure. Compliance embedded in deployment pipeline → teams comply by default."

**EndiorBot giải pháp:**

```
# Governance tự động, không cần checklist manual

# Exec-policy: Agent KHÔNG THỂ chạy lệnh nguy hiểm
endiorbot exec-policy preset balanced
# → rm -rf / : DENIED (hard-deny)
# → git push --force: DENIED (hard-deny)
# → pnpm test: ALLOWED (allowlist)
# → git commit: PROMPT (CEO approve)

# SSRF protection: Agent KHÔNG THỂ fetch internal URLs
# → safeFetch chặn 169.254.169.254, private IPs, file://

# Active Memory: Context KHÔNG bị mất giữa các query
# → 15s cache, circuit breaker, fail-open

# Gate Engine: Ship readiness checked programmatically
endiorbot gate status
# → G0: Problem Validated ✓
# → G1: Requirements Complete ✓
# → G2: Design Approved ✓
# → G3: Ship Ready — pending @tester + @reviewer sign-off

# Audit trail: Mọi thứ được ghi lại
endiorbot exec-policy audit
# → Ai đã chạy gì, khi nào, từ kênh nào, bị block hay cho phép
```

**SDLC alignment:**
- **Gate Engine as code** — gates evaluated automatically, not manually
- **exec-policy** fires BEFORE Gates A/B/C — defense in depth
- **SSRF protection** — centralized `safeFetch`, boundary test prevents bypass
- **Audit trail** — JSONL logs, 10MB rotation, `0o600` permissions

---

## Governance vs Speed — EndiorBot's Balance

Sau Sheong cảnh báo: "Tôi thấy organizations dùng Level 1 governance cho Level 3 capabilities. Kết quả không tốt."

EndiorBot giải quyết bằng **progressive trust model:**

| Preset | Governance Level | Speed | Khi nào dùng |
|--------|-----------------|-------|-------------|
| `strict` | Maximum — mỗi lệnh cần CEO approve | Chậm nhất | Production data, security-critical |
| `balanced` | Medium — safe commands tự động, risky commands cần approve | Nhanh + an toàn | **Default cho phát triển hàng ngày** |
| `open` | Minimum — chỉ hard-deny list chặn | Nhanh nhất | Prototype, hackathon, trusted workflows |

Kết hợp với `ENDIORBOT_AUTO_HANDOFF`:

| | `AUTO_HANDOFF=false` | `AUTO_HANDOFF=true` |
|---|---|---|
| `strict` | Tối đa control (2 prompts) | Trust chain, kiểm soát commands |
| `balanced` | Standard dev workflow | **Sweet spot cho `serve`** |
| `open` | 1 prompt rồi tự chạy | Gần L3 autonomy (vẫn bounded) |

---

## "Trust, care, and what's lost in abstraction"

Sau Sheong viết: "Active knowledge decays without practice. We need to design deliberately for the knowledge we want to retain."

**EndiorBot's approach:**

1. **ADR-first workflow** — decisions documented BEFORE code is written. Code is regenerable; decisions are not.
2. **Correction-trail discipline** — khi claim sai, sửa visible với credit cho người bắt lỗi. Tạo institutional memory.
3. **Ground-Truth Verification rules** (SOUL-pm.md v1.2.0) — 3 rules buộc agents verify claims trước khi act. Đã bắt 3 false claims trong 24 giờ đầu.
4. **Consult trước khi quyết định** — multi-model analysis đảm bảo CEO hiểu trade-offs, không chỉ accept AI output đầu tiên.
5. **Brain L4 Mental Models** — inject decision heuristics vào mỗi session. Knowledge được codify, không phụ thuộc cá nhân.

---

## Tổng kết: Workflow Map

```
┌──────────────────────────────────────────────────────────────┐
│                    CEO/Developer Day                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  📱 Telegram/Zalo (di chuyển) — Sprint 135: full surface       │
│  ├─ /status → sprint progress                                │
│  ├─ /gate status → approve/reject gates                      │
│  ├─ @pm plan feature → structured plan                       │
│  ├─ /commands → full command catalog                         │
│  ├─ /exec-policy show|preset|audit → security from phone     │
│  ├─ /config → view all config, toggle AM + auto-handoff      │
│  ├─ /audit exec-policy|ssrf|webhooks → audit from phone      │
│  └─ /webhooks list|test → webhook management                 │
│                                                               │
│  💻 CLI (trước máy tính)                                      │
│  ├─ endiorbot chat → multi-turn session                      │
│  ├─ endiorbot @coder "task" → Claude Code in tmux            │
│  ├─ endiorbot consult "question" → multi-model analysis      │
│  ├─ endiorbot plan "feature" → structured plan               │
│  ├─ endiorbot bootstrap <url> → try any OSS repo             │
│  ├─ endiorbot exec-policy show → current security posture    │
│  └─ endiorbot compliance check → SDLC health                 │
│                                                               │
│  🌐 Web API (localhost:18790) — Sprint 135                    │
│  ├─ GET /api/config → system config JSON                     │
│  ├─ GET /api/audit/:type → audit log viewer                  │
│  ├─ GET /api/status → system status + Active Memory          │
│  ├─ POST /api/config/* → mutations (GATEWAY_TOKEN auth)      │
│  └─ POST /api/webhooks/:id → webhook ingress (Sprint 134)    │
│                                                               │
│  🔒 Governance (automatic, embedded)                         │
│  ├─ exec-policy → command allowlist BEFORE Gates A/B/C       │
│  ├─ safeFetch → SSRF protection on all outbound HTTP         │
│  ├─ Active Memory → per-query context (cache + breaker)      │
│  ├─ Gate Engine → programmatic G0-G4 evaluation              │
│  ├─ Audit logs → JSONL, every decision recorded              │
│  └─ Vibecoding Index → AI code quality measurement           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Sprint 134-135: Config Externalization + Surface Parity

Sprint 134 externalized all hardcoded timeouts into `src/config/timeouts.ts` (SSOT, env-overridable) and shipped webhooks ingress (Zapier/email forward support).

Sprint 135 achieved **surface parity** — every Sprint 131-134 backend feature is now accessible from all channels.

---

## Sprint 140-141: CC-First Routing + Kimi Fallback

Sprint 140 introduced 3-tier agent-model mapping (ADR-052). Sprint 141 added cost telemetry + Kimi resilience. Sprint 143 amended ADR-052: **Claude Code primary for all Tier 2 agents** (was Kimi primary).

### Current Provider Routing (Sprint 143+)

```
@agent message
  → Claude Code (Sonnet) — primary, native codebase access
      ↓ on timeout / rate-limit
  → Kimi (k2.6 via OAuth proxy) — free fallback
      ↓ on failure
  → OpenAI / Ollama — last resort
```

| Tier | Provider | Model | Agents | Rationale |
|------|----------|-------|--------|-----------|
| 1 | Claude Code | claude-opus-4 | @architect, @cso, @ceo | Critical reasoning |
| 2 | Claude Code | sonnet | @coder, @pm, @reviewer + 7 more | CC first — codebase access; Kimi fallback |
| 3 | Ollama | qwen3.5:9b | @assistant | Free, local, routing |

### Kimi as Fallback (not primary)

```
Kimi access paths:
  kimi-proxy (OAuth, free) → kimi-api (Moonshot, paid) → cloud fallback (OpenAI)

Setup: ENDIORBOT_KIMI_PROXY_URL=http://127.0.0.1:18765 in .env
  → Reuses existing claude-code-proxy instance
  → No subprocess spawn (Sprint 144: deprecated)
```

---

## Sprint 143: Gateway Resilience Hotfixes

CEO 2-hour Telegram testing session exposed 7 production issues. All hotfixed same-day:

| Issue | Root cause | Fix |
|-------|-----------|-----|
| `/start` → Unknown command | No handler | Added to CommandDispatcher |
| CC timeout → error (no fallback) | TIMEOUT threw instead of falling back | Fallback chain wired |
| Kimi model rejected | Provider validated "sonnet" against Anthropic list | Model name resolution |
| Telegram swallows response | Markdown parse error → 400 | Plain-text retry |
| Duplicate messages | Multiple serve processes | Session lock + PID lockfile (Sprint 144) |

---

## Sprint 144: Gateway Hardening + 5-Channel Parity

### Provider Circuit Breaker

```
CC fails twice → circuit OPEN → skip CC → instant Kimi (60s cooldown)
  → 60s later → HALF-OPEN → try CC once
  → success → CLOSED (recovered)
  → failure → re-open (120s, max 5min)
```

### OTT-Aware Timeout

| Channel | CC Timeout | Then |
|---------|-----------|------|
| Telegram / Zalo / Web / Desktop | **60s** | Kimi fallback |
| CLI | **180s** | Kimi fallback |

### 5 Channels, 39 Commands

All channels route through the same GatewayIngress → CommandDispatcher:

| Channel | Access | Commands |
|---------|--------|----------|
| CLI | `endiorbot <cmd>` | 39 |
| Web UI | `http://localhost:18790` | 39 |
| Telegram | `@Endior_bot` | 39 |
| Zalo | Bot Endior | 39 |
| Desktop | Electron app (gateway auto-start) | 39 |

### Desktop App (Sprint 144)

Electron wrapper around Web UI with native OS features:
- 9 pages: Dashboard, Chat, Projects, Gates, Experts, Settings, Junior Hub, Checkpoints, Fix Stats
- Gateway auto-starts as subprocess (no manual `endiorbot serve` needed)
- API key management directly in Settings UI

### Immediate Acknowledgement

All OTT channels send `⚡ @agent` immediately when routing — no more silent waiting during long AI calls.

---

## Tổng kết: Workflow Map (Sprint 144)

```
┌──────────────────────────────────────────────────────────────┐
│                    Developer Day — 5 Channels                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  📱 Telegram/Zalo (on the go) — 39 commands                  │
│  ├─ /status → project + workspace context                    │
│  ├─ /gate status → approve/reject gates                      │
│  ├─ @pm plan feature → structured plan                       │
│  ├─ @coder fix bug → CC primary, Kimi fallback               │
│  ├─ /exec-policy show|preset|audit → security from phone     │
│  └─ ⚡ immediate ack before long AI calls                    │
│                                                               │
│  💻 CLI (at the desk)                                         │
│  ├─ endiorbot chat → multi-turn (CC/Kimi/OpenAI/Ollama)     │
│  ├─ endiorbot @coder "task" → Claude Code in tmux            │
│  ├─ endiorbot consult "question" → 3-model analysis          │
│  ├─ endiorbot serve → gateway + all channels                 │
│  └─ endiorbot serve --force → kill existing + takeover       │
│                                                               │
│  🖥️ Desktop (Electron)                                       │
│  ├─ Auto-starts gateway — Chat works immediately             │
│  ├─ Projects page → registered repos from repos.json         │
│  ├─ Settings → API key management (save to .env)             │
│  └─ Gates → 7 SDLC gate statuses at a glance                │
│                                                               │
│  🌐 Web UI (localhost:18790)                                  │
│  ├─ 39 commands via WebSocket gateway                        │
│  ├─ @agent chat with streaming responses                     │
│  └─ REST API for external integrations                        │
│                                                               │
│  🔒 Governance (automatic, embedded)                         │
│  ├─ Circuit breaker → skip failing providers automatically   │
│  ├─ PID lockfile → no duplicate serve processes              │
│  ├─ exec-policy → command allowlist BEFORE Gates             │
│  ├─ safeFetch → SSRF protection on outbound HTTP             │
│  ├─ Gate Engine → programmatic G0-G4 evaluation              │
│  └─ Audit logs → JSONL, every decision recorded              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Tham chiếu

- Sau Sheong, "From vibe coding to agentic engineering (abridged)", Apr 2026
- Dan Shapiro, Five Levels of AI Engineering
- [EndiorBot Usage Guide](USAGE-GUIDE.md) — 20 workflows
- [CLI Reference](../04-build/cli-reference.md) — Full command reference
- [ADR-046 Autonomous Execution Policy](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md)
- [ADR-052 Agent-Model Tier Mapping](../02-design/01-ADRs/ADR-052-agent-model-tier-mapping.md) — CC-first routing
- [SOUL-pm.md v1.2.0](../reference/templates/souls/SOUL-pm.md) — Ground-Truth Verification rules
- [Product Vision](../00-foundation/product-vision.md)
- [Deploy Guide](../06-deploy/README.md) — Docker, npm, Desktop, Kimi proxy setup
- [Gateway Architecture Review](../02-design/14-Technical-Specs/gateway-architecture-review-sprint-143.md)

---

*EndiorBot | Solo Developer Power Tool | SDLC 6.4.0 | AI Development Workflows v2.0 — Sprint 144 (2026-04-27)*
