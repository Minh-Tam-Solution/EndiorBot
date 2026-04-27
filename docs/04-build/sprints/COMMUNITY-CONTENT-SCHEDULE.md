---
type: community-content
date: 2026-04-29
status: READY — all content pre-written
authority: "@pm + CEO approved"
---

# Community Content & Publishing Schedule

> All content pre-written, CEO-approved. Publish per schedule below.
> Contact: dttai@mtsolution.com.vn

---

## Publishing Schedule Overview

```
29/4 (Launch Day)
├── 09:00  GitHub: Pinned Discussion (EN + VI)
├── 09:30  GitHub: Release Notes (auto from Phase 3)
├── 10:30  X/Twitter: 5-tweet thread (EN)
├── 10:30  LinkedIn: CEO post (EN)
├── 11:30  Facebook CEO: Personal post (VI)
├── 11:30  Facebook MTS: Fan page post (VI)
├── 21:00  Hacker News: Show HN (EN)
├── 20:30  Reddit: r/opensource (EN)

30/4 (Day +1)
├── 09:00  Reddit: r/programming (if r/opensource >20 upvotes)
├── 14:00  X/Twitter: Architecture thread (10 tweets)

1-3/5 (Week 1)
├── Dev.to: Long-form article (EN, ~1500 words)
├── Viblo: Vietnamese adaptation (~1500 words)
├── Reddit: r/typescript (if r/programming went well)
├── X/Twitter: Follow-up tips thread

5-9/5 (Week 2)
├── LinkedIn: Methodology follow-up
├── Facebook: AncestorTree case study cross-post
├── YouTube/Loom: 5-min demo video

12/5+ (Week 3+)
├── Reddit: r/selfhosted, r/sideproject
├── GitHub: AMA Discussion
├── Cross-promote from TinySDLC + AncestorTree READMEs
```

---

## Content 1: GitHub Pinned Discussion (EN + VI)

**When:** 29/4 09:00 ICT (right after repo goes public)
**Where:** GitHub → Discussions → New → Category: Announcements → Pin

### English Version

**Title:** 🚀 EndiorBot v0.1.0-beta.1 — AI dev team in your terminal

```markdown
# Welcome to EndiorBot!

**AI dev team in your terminal** — 14 SDLC agents, 5 channels, answers in 30 seconds.

## What is EndiorBot?

EndiorBot is an open-source AI agent orchestrator for solo developers. It routes `@agent` mentions to 14 specialized SDLC agents across CLI, Web, Telegram, Zalo, and Desktop.

## Quick Start

```bash
npx endiorbot --help
npx endiorbot init --tier STANDARD
npx endiorbot serve
```

## Key Features

- **14 SOUL agents** — @pm, @architect, @coder, @reviewer, @tester + 9 more
- **5 channels** — CLI, Web, Telegram, Zalo, Desktop (Developer Preview)
- **39 unified commands** — same commands work across all channels
- **CC-first routing** — Claude Code primary, Kimi (free OAuth) as fallback
- **SDLC Framework 6.3.1** — quality gates, compliance automation, vibecoding index
- **Gateway resilience** — PID lockfile, circuit breaker, OTT 60s timeout

## Origin

EndiorBot was ported from OpenClaw (internal MTS Python codebase) to TypeScript. After 145 sprints of development: 8,124+ tests, 51 ADRs, 96% SDLC compliance.

Built on [SDLC Framework 6.3.1](https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework) — also open-source.

## How to Contribute

- 🐛 [Report a bug](../../issues/new?template=bug_report.md)
- 💡 [Request a feature](../../issues/new?template=feature_request.md)
- 📖 [Improve documentation](../../issues?q=label%3A%22good+first+issue%22)
- ⭐ Star this repo if you find it useful

## Links

- 🌐 [endior.net](https://endior.net) — Landing page
- 📖 [Usage Guide (20 workflows)](docs/07-operate/USAGE-GUIDE.md)
- 🏗️ [Architecture (51 ADRs)](docs/02-design/README.md)
- 📦 [npm](https://www.npmjs.com/package/endiorbot)

## Related Projects

| Project | Description |
|---------|-------------|
| [SDLC Framework 6.3.1](https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework) | Methodology (503 docs, 11 training modules) |
| [TinySDLC](https://github.com/Minh-Tam-Solution/tinysdlc) | Lightweight predecessor (npm: tinysdlc) |
| [AncestorTree](https://github.com/Minh-Tam-Solution/AncestorTree) | Genealogy platform built in 1 evening with 8 AI agents |
| [MTS-SDLC-Lite](https://github.com/Minh-Tam-Solution/MTS-SDLC-Lite) | Starter methodology for startups |

---

Initiated by [@dttai](https://github.com/dttai), built with [Minh Tam Solution](https://mtsolution.com.vn).

MIT License — free for personal and commercial use.
```

### Vietnamese Version (reply in same thread)

```markdown
# Chào mừng đến với EndiorBot! 🇻🇳

**AI dev team trong terminal** — 14 agents SDLC, 5 kênh, trả lời trong 30 giây.

## EndiorBot là gì?

EndiorBot là công cụ AI mã nguồn mở cho solo developer. Gõ `@agent` để gọi 14 agents chuyên biệt qua CLI, Web, Telegram, Zalo, hoặc Desktop.

## Bắt đầu nhanh

```bash
npx endiorbot --help
npx endiorbot init --tier STANDARD
npx endiorbot serve
```

## Nguồn gốc

EndiorBot được porting từ OpenClaw (Python, nội bộ MTS) sang TypeScript. Sau 145 sprints phát triển: 8,124+ tests, 51 ADRs, 96% SDLC compliance.

Xây dựng trên [SDLC Framework 6.3.1](https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework) — cũng mã nguồn mở.

## Dự án liên quan

- [AncestorTree](https://github.com/Minh-Tam-Solution/AncestorTree) — Nền tảng gia phả, xây trong 1 buổi tối với 8 AI agents
- [TinySDLC](https://github.com/Minh-Tam-Solution/tinysdlc) — Phiên bản nhẹ (npm: tinysdlc)
- [MTS-SDLC-Lite](https://github.com/Minh-Tam-Solution/MTS-SDLC-Lite) — Phương pháp luận cho startup

Khởi tạo bởi [@dttai](https://github.com/dttai), phát triển cùng [Minh Tam Solution](https://mtsolution.com.vn).
```

---

## Content 2: X/Twitter Thread (EN)

**When:** 29/4 10:30 ICT
**Where:** X/Twitter — CEO account

```
1/5 🚀 Launching EndiorBot — AI dev team in your terminal

14 AI agents × 5 channels × 39 commands
Get answers in 30s instead of 30min

Built on SDLC Framework 6.3.1 (also open-source today)

GitHub: github.com/Minh-Tam-Solution/EndiorBot
npm: npx endiorbot --help

2/5 What EndiorBot does:

@pm "plan payment gateway" → structured sprint plan
@architect "design auth" → ADR + API spec
@coder "fix login bug" → Claude Code in tmux
@consult "Redis vs Postgres?" → 3-model consultation

All from CLI, Web, Telegram, Zalo, or Desktop 📱💻

3/5 The methodology behind it:

SDLC Framework 6.3.1
- 7 pillars of AI+Human excellence
- 10-stage lifecycle (WHY → GOVERN)
- 18 SOUL agent templates
- 11 training modules (39 hours)
- 503 methodology docs

Free: github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework

4/5 Battle-tested:

- 145 sprints of development
- 8,124+ tests, 51 ADRs
- Gateway resilience: circuit breaker, PID lockfile
- CC-first routing with Kimi fallback (free OAuth)
- Ported from OpenClaw (Python → TypeScript)

96% SDLC compliance ✅

5/5 Try it now:

npx endiorbot --help
npx endiorbot init --tier STANDARD
npx endiorbot serve

⭐ Star: github.com/Minh-Tam-Solution/EndiorBot
📖 Docs: endior.net

MIT License — initiated by @dttai, built with Minh Tam Solution
```

---

## Content 3: LinkedIn Post (EN)

**When:** 29/4 10:30 ICT (simultaneously with X/Twitter)
**Where:** LinkedIn — CEO profile

```
Excited to announce the open-source launch of EndiorBot — an AI dev team in your terminal.

After 145 sprints of development, we're releasing:

🤖 EndiorBot — AI agent orchestrator for solo developers
• 14 SDLC agents (@pm, @architect, @coder, @reviewer, @tester + 9 more)
• 5 channels (CLI, Web, Telegram, Zalo, Desktop)
• 39 unified commands across all channels
• CC-first routing with free Kimi OAuth fallback
• 8,124+ tests, 51 Architecture Decision Records

📚 Built on SDLC Framework 6.3.1 (also open-source)
• 503 methodology documents
• 11 training modules (39 hours)
• Tool-agnostic — use with any AI coding assistant

The same methodology powered AncestorTree — a genealogy platform we built in 1 evening with 8 AI agents (now at v3.0 after 18 sprints).

EndiorBot is not a platform. It's a personal power tool that runs locally on your machine, orchestrating AI agents with enterprise-grade discipline but solo-developer simplicity.

Claude Code is recommended but not required — planning, methodology, and consultation agents work via Kimi (free), OpenAI, or any configured LLM.

🔗 GitHub: github.com/Minh-Tam-Solution/EndiorBot
🔗 npm: npx endiorbot --help
🔗 Docs: endior.net
🔗 Framework: github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework

MIT License — free for personal and commercial use.

Initiated by Đặng Thế Tài, built with Minh Tam Solution.

#OpenSource #AI #DeveloperTools #SDLC #TypeScript #ClaudeCode #AgentOrchestration
```

---

## Content 4: Facebook CEO Personal (VI)

**When:** 29/4 11:30 ICT (1h after X/LinkedIn)
**Where:** Facebook — CEO personal profile

```
🚀 Hôm nay mình chính thức open-source EndiorBot — "AI dev team trong terminal".

Sau 145 sprints phát triển (từ OpenClaw Python → TypeScript), EndiorBot giờ có:

🤖 14 AI agents SDLC — @pm, @architect, @coder, @reviewer, @tester + 9 nữa
📱 5 kênh — CLI, Web, Telegram, Zalo, Desktop
⚡ 39 lệnh thống nhất — cùng 1 lệnh chạy trên tất cả kênh
🧠 CC-first routing — Claude Code primary, Kimi fallback (miễn phí qua OAuth)
✅ 8,124+ tests, 51 ADRs, 96% SDLC compliance

Cùng phương pháp luận đã xây AncestorTree (nền tảng gia phả) trong 1 buổi tối với 8 AI agents — giờ đã v3.0 sau 18 sprints.

Claude Code được khuyến nghị nhưng KHÔNG bắt buộc. Planning, methodology, và consultation agents hoạt động qua Kimi (miễn phí), OpenAI, hoặc bất kỳ LLM nào.

🔗 GitHub: github.com/Minh-Tam-Solution/EndiorBot
🔗 npm: npx endiorbot --help
🔗 Landing page: endior.net
🔗 SDLC Framework: github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework

MIT License — miễn phí cho cá nhân và thương mại.

Ecosystem MTS open-source:
• EndiorBot — agent orchestrator cho solo developer
• TinySDLC — phiên bản nhẹ (npmjs.com/package/tinysdlc)
• AncestorTree — nền tảng gia phả số cho người Việt
• MTS-SDLC-Lite — phương pháp luận cho startup

#opensource #AI #developer #SDLC #TypeScript #MTS #EndiorBot
```

---

## Content 5: Facebook MTS Fan Page (VI)

**When:** 29/4 11:30 ICT (simultaneously with CEO personal)
**Where:** Facebook — Minh Tam Solution fan page

```
🎉 Minh Tam Solution chính thức open-source EndiorBot + SDLC Framework 6.3.1!

Sau hơn 10 tháng phát triển qua 145 sprints, chúng tôi chia sẻ 2 sản phẩm mã nguồn mở:

🤖 EndiorBot — Công cụ AI cho solo developer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 14 AI agents chuyên biệt (PM, Architect, Coder, Reviewer, Tester...)
• 5 kênh giao tiếp: CLI, Web, Telegram, Zalo, Desktop
• 39 lệnh thống nhất trên tất cả kênh
• Claude Code primary + Kimi fallback (miễn phí)
• 8,124+ tests, 51 Architecture Decision Records

📚 SDLC Framework 6.3.1 — Phương pháp luận AI+Human
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 7 trụ cột cho AI+Human Excellence
• 10 giai đoạn vòng đời (WHY → GOVERN)
• 18 SOUL templates cho AI agents
• 11 modules đào tạo (39 giờ) + 80 câu hỏi kiểm tra
• 503 tài liệu phương pháp luận

🏆 Đã được thực chiến qua:
• EndiorBot — 14 agents, 5 kênh, 8,124+ tests
• AncestorTree — Nền tảng gia phả, xây trong 1 buổi tối
• BFlow Platform — 200K+ SME
• NQH Technology Ecosystem — 14 nền tảng

🔗 EndiorBot: github.com/Minh-Tam-Solution/EndiorBot
🔗 Framework: github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework
🔗 Trang chủ: endior.net | sdlcframework.org
🔗 npm: npx endiorbot --help

MIT License — miễn phí sử dụng.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hệ sinh thái open-source MTS:
📦 EndiorBot — Agent orchestrator (endior.net)
📦 TinySDLC — Phiên bản nhẹ (npmjs.com/package/tinysdlc)
📦 AncestorTree — Gia phả số (ancestortree.endior.net)
📦 MTS-SDLC-Lite — Phương pháp luận cho startup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#MTS #SDLC #AIEngineering #OpenSource #EndiorBot #Framework #MinhTamSolution
```

---

## Content 6: Hacker News — Show HN (EN)

**When:** 29/4 21:00 ICT (= US East 10:00 AM — peak HN traffic)
**Where:** news.ycombinator.com → Submit → "Show HN"

**Title:** `Show HN: EndiorBot – 14 AI agents in your terminal with SDLC governance`

**URL:** `https://github.com/Minh-Tam-Solution/EndiorBot`

**Text (only if self-post, otherwise first comment):**

```
EndiorBot is an open-source AI agent orchestrator for solo developers.
It routes @agent mentions to 14 specialized SDLC agents (PM, Architect,
Coder, Reviewer, Tester, etc.) across CLI, Web, Telegram, Zalo, and Desktop.

Key technical decisions:
- CC-first routing: Claude Code primary, Kimi (free OAuth) as fallback
- Provider circuit breaker: 2 failures → skip → 60s cooldown → half-open
- 39 unified commands via single CommandDispatcher across all 5 channels
- Ported from Python (OpenClaw) to TypeScript — 145 sprints, 8,124 tests
- PID lockfile prevents duplicate serve processes

Claude Code is recommended but not required. Planning and consultation
agents work with Kimi (free), OpenAI, or any configured LLM.

Built on SDLC Framework 6.3.1 (also OSS today) — tool-agnostic methodology
with 503 docs, 11 training modules, and 18 agent templates.

We used the same methodology to build AncestorTree (Vietnamese genealogy
platform) in 1 evening with 8 AI agents — https://ancestortree.endior.net

npm: npx endiorbot --help
Docs: https://endior.net
```

**HN rules reminder:**
- No marketing language — pure technical
- Be ready to answer questions in comments for 2-3 hours
- Don't ask for upvotes (HN ban)

---

## Content 7: Reddit r/opensource (EN)

**When:** 29/4 20:30 ICT (= US East 9:30 AM)
**Where:** reddit.com/r/opensource

**Title:** `EndiorBot: Open-source AI dev team in your terminal — 14 SDLC agents across 5 channels`

**Body:**

```markdown
Hi r/opensource,

I've been building EndiorBot for the past 10 months (145 sprints) and just open-sourced it today.

**What it does:** Routes @agent mentions to 14 specialized AI agents (PM, Architect, Coder, Reviewer, Tester, etc.) across CLI, Web, Telegram, Zalo, and Desktop.

**Why I built it:** As a solo developer working on enterprise-scale projects, I was spending 30-60 minutes per decision — querying multiple AI models, copying context between apps, losing SDLC discipline. EndiorBot automates this.

**How it works:**
- `@pm "plan payment gateway"` → structured sprint plan
- `@architect "design auth"` → ADR + API spec
- `@coder "fix login bug"` → Claude Code in tmux
- `@consult "Redis vs Postgres?"` → 3-model parallel consultation

**Tech stack:** TypeScript, 8,124+ tests, 51 ADRs, Claude Code primary with Kimi (free OAuth) fallback. Claude Code is recommended but not required — planning agents work with any LLM.

**Origin:** Ported from OpenClaw (our internal Python codebase) to TypeScript.

Built on SDLC Framework 6.3.1 (also open-sourced today) — a tool-agnostic methodology with 503 docs and 11 training modules.

The same methodology was used to build [AncestorTree](https://github.com/Minh-Tam-Solution/AncestorTree) — a Vietnamese genealogy platform, built in 1 evening with 8 AI agents.

- GitHub: https://github.com/Minh-Tam-Solution/EndiorBot
- npm: `npx endiorbot --help`
- Docs: https://endior.net

MIT License. Feedback and contributions welcome!
```

---

## Content 8: Dev.to Article (EN, Week 1)

**When:** 1-3/5 (within first week)
**Where:** dev.to — CEO account

**Title:** `Building an AI Agent Orchestrator with 14 SOUL Agents — Lessons from 145 Sprints`

**Tags:** `#ai`, `#typescript`, `#opensource`, `#productivity`

**Outline (~1500 words):**

```markdown
## Introduction
- The problem: 30-60 min per decision as a solo developer
- The solution: 14 AI agents in your terminal

## Architecture: 5 Channels, 1 Dispatcher
- How 39 commands work across CLI, Web, Telegram, Zalo, Desktop
- GatewayIngress → CommandDispatcher + ChannelRouter
- Diagram: the request flow

## CC-First Routing: Why Claude Code Primary
- ADR-052: 3-tier model selection (Opus / Sonnet / Ollama)
- Kimi as free OAuth fallback
- Circuit breaker: 2 failures → skip → 60s cooldown

## SDLC Governance: Not Just Vibes
- Quality gates (G0-G4) as code
- Vibecoding Index: measuring AI code quality
- 51 Architecture Decision Records

## Lessons from 7 Failures in 2 Hours
- Sprint 143 CEO testing session
- /start unknown, CC timeout, Telegram markdown, duplicate messages
- How circuit breaker + PID lockfile emerged from production failure

## The Methodology Behind It
- SDLC Framework 6.3.1: tool-agnostic, 503 docs
- AncestorTree: 1 evening → production genealogy platform
- "Process-First" mental model

## Try It
- Quick start commands
- Links to GitHub, npm, docs

## What's Next
- Sprint 146: post-launch quality hardening
- Sprint 147: UI upgrade + agent queue integrity
- Community: good-first-issues, contributing guide
```

---

## Content 9: Viblo Article (VI, Week 1)

**When:** 1-3/5 (same week as Dev.to)
**Where:** viblo.asia — CEO account

**Title:** `Xây dựng AI Agent Orchestrator với 14 SOUL Agents — Bài học từ 145 Sprints`

**Tags:** `AI`, `TypeScript`, `OpenSource`, `SDLC`

Same outline as Dev.to, adapted for Vietnamese audience:
- Add Vietnamese business context (BFlow 200K SME, NQH ecosystem)
- Reference AncestorTree as relatable case study (gia phả = Vietnamese culture)
- Include MTS-SDLC-Lite as starter methodology for Vietnamese startups
- Use Vietnamese code comments in examples

---

## Content 10: X/Twitter Architecture Thread (Day +1)

**When:** 30/4 14:00 ICT
**Where:** X/Twitter — CEO account

```
1/10 🏗️ Architecture deep-dive: how EndiorBot routes 39 commands across 5 channels

Thread 🧵

2/10 The problem: 5 different surfaces (CLI, Web, Telegram, Zalo, Desktop) each need to understand the same 39 commands.

Old approach: duplicate handlers in each channel.
Our approach: single CommandDispatcher, all channels route through it.

3/10 Architecture:

User Input → Channel Adapter → MessageBus → GatewayIngress
  ├── /command → CommandDispatcher (39 commands)
  └── @agent  → ChannelRouter (14 SDLC agents)

One ingress point. Zero duplication.

4/10 Telegram was the hardest.

We had 16 local command handlers that predated the unified Dispatcher. Each used a different handler function — some stale from Sprint 76.

Sprint 145 fix: gut all local handlers. Only /start stays local (Telegram-specific welcome). Everything else → Dispatcher.

5/10 The circuit breaker was born from failure.

Sprint 143: CEO tested on Telegram for 2 hours. CC Bridge timed out → 180s wait → no fallback.

Sprint 144: 2 failures → circuit OPEN → skip CC → instant Kimi response. 60s cooldown → half-open recovery.

6/10 CC-first routing (ADR-052 amendment):

Tier 1 (Opus): @architect, @cso, @ceo — critical reasoning
Tier 2 (Sonnet): @coder, @pm + 8 more — CC primary, Kimi fallback
Tier 3 (Ollama): @assistant — free, local routing

Claude Code recommended but NOT required.

7/10 PID lockfile — simplest fix, biggest impact.

CEO accidentally ran `endiorbot serve` twice → Telegram 409 conflicts → duplicate messages.

Fix: `~/.endiorbot/serve.pid` + `kill -0` liveness check. `--force` to takeover.

8/10 OTT-aware timeout:

Telegram/Zalo users expect chat-like speed. CLI users are at a terminal.

Solution: `originChannel` threaded through bus → ingress → router.
OTT: 60s CC timeout, then Kimi.
CLI: 180s CC timeout, then Kimi.

9/10 The methodology:

SDLC Framework 6.3.1 — tool-agnostic, 7 pillars, 10 stages.
503 docs. 11 training modules. 18 SOUL agent templates.

We used it to build AncestorTree (genealogy platform) in 1 evening.

10/10 Try it:

npx endiorbot --help
npx endiorbot init --tier STANDARD
npx endiorbot serve

⭐ github.com/Minh-Tam-Solution/EndiorBot
📖 endior.net

145 sprints. 8,124 tests. 51 ADRs. Open source.

Built by @dttai with @MinhTamSolution.
```

---

## Content 11: LinkedIn Methodology Follow-up (Week 2)

**When:** 5-9/5
**Where:** LinkedIn — CEO profile

```
Last week I shared EndiorBot — the tool. This week I want to share the methodology behind it.

SDLC Framework 6.3.1 is a tool-agnostic development methodology built for AI+Human teams.

What makes it different from "just use agile":

1. **8 Mental Models** — not just process, but thinking frameworks. Agent Continuity (checkpoint/resume across sessions) was a game-changer for long AI coding sessions.

2. **Quality Gates as Code** — G0 through G4 are evaluated programmatically, not in a meeting. The gate engine checks artifacts, not opinions.

3. **Vibecoding Index** — a 0-100 composite score measuring the risk that AI-generated code lacks proper oversight. Score >60 = mandatory review.

4. **18 SOUL Templates** — each AI agent (PM, Architect, Coder, etc.) has a persona definition. Not a prompt — a role specification with SDLC-stage awareness.

5. **Anti-Vibecoding Section** — because "AI wrote it" is not a quality argument. The framework measures intent clarity, code ownership, context completeness, and AI attestation rate.

We used this methodology to build:
• EndiorBot (14 agents, 8,124 tests)
• AncestorTree (genealogy platform, built in 1 evening)
• BFlow Platform (200K+ SME)

The framework is free, MIT-licensed, and has 11 training modules (39 hours) with 80 quiz questions.

GitHub: github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework

What methodology do you use for AI-assisted development?

#SDLC #AI #Methodology #DeveloperTools #OpenSource
```

---

## Cross-Promotion Updates (Week 1)

### TinySDLC README addition

Add to `README.md` of `Minh-Tam-Solution/tinysdlc`:

```markdown
## Looking for Production-Grade Orchestration?

See [EndiorBot](https://github.com/Minh-Tam-Solution/EndiorBot) — the production evolution of TinySDLC with 14 SDLC agents, 5 channels, gateway resilience, and SDLC Framework 6.3.1 compliance.
```

### AncestorTree README addition

Add to `README.md` of `Minh-Tam-Solution/AncestorTree`:

```markdown
## Built With

- [EndiorBot](https://github.com/Minh-Tam-Solution/EndiorBot) — AI agent orchestrator (14 SDLC agents)
- [SDLC Framework 6.3.1](https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework) — Development methodology
```

### MTS-SDLC-Lite README addition

Add to `README.md` of `Minh-Tam-Solution/MTS-SDLC-Lite`:

```markdown
## Full Framework + Tooling

- [SDLC Framework 6.3.1](https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework) — Full enterprise framework (503 docs, 11 training modules)
- [EndiorBot](https://github.com/Minh-Tam-Solution/EndiorBot) — Reference implementation with 14 AI agents
```

---

## Response Templates (for Day 1 comments)

### For "What's the difference from Cursor/Copilot?"

```
Great question! EndiorBot is NOT an IDE plugin or code completion tool.

It's an agent orchestrator — you talk to specialized SDLC roles (@pm, @architect, @coder, @reviewer) and they coordinate work across your project.

Think of it as a virtual dev team, not an autocomplete.

Cursor/Copilot = code suggestion in your editor
EndiorBot = sprint planning, architecture decisions, multi-model consultation, code review, test strategy — all from your terminal or phone
```

### For "Why not just use Claude Code directly?"

```
You can! Claude Code is EndiorBot's primary provider.

EndiorBot adds:
1. Role specialization — @pm behaves differently from @coder
2. SDLC governance — quality gates, compliance, vibecoding index
3. Multi-channel — same commands from CLI, Telegram, Zalo, Desktop
4. Multi-model — @consult queries Claude + GPT + Kimi in parallel
5. Session management — per-chat workspace, checkpoint/resume

If you only need coding: Claude Code alone is perfect.
If you need planning + design + review + testing + governance: EndiorBot.
```

### For "Does this require Claude Code subscription?"

```
Recommended but NOT required.

- Planning agents (@pm, @pjm) work with Kimi (free OAuth) or any LLM
- Consultation (@consult) queries OpenAI + Gemini + Kimi in parallel
- Only coding workflow (@coder in PATCH mode) benefits from Claude Code

You can use EndiorBot with just Kimi (free) + Ollama (local, free).
```

---

*EndiorBot Community Content Schedule | v1.0 | 29 April 2026*
