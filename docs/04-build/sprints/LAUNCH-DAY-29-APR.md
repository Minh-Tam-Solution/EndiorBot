---
type: launch-plan
date: 2026-04-29
slip_date: 2026-04-30
status: READY — all blockers resolved
authority: CEO + CTO G3 PRE-APPROVED 2026-04-27
attribution: "Initiated by @dttai, built with Minh Tam Solution"
---

# Launch Day Plan — 29 April 2026

> **Slip policy:** If 28/4 22:00 ICT gate fails (DNS/npm not ready) → slip to **30/4 morning ICT** (still Tuesday US evening). Hard gate, not soft reminder.

> **OpenClaw origin:** OpenClaw is internal MTS code. No external license obligation. NOTICE clause added to README.

## MTS Open-Source Ecosystem (cross-promotion)

EndiorBot is the 4th OSS project from MTS. Launch leverages existing audience:

| Project | Repo | Role in Launch |
|---------|------|----------------|
| **MTS-SDLC-Lite** | [GitHub](https://github.com/Minh-Tam-Solution/MTS-SDLC-Lite) | Methodology foundation — "EndiorBot implements SDLC at scale" |
| **TinySDLC** | [GitHub](https://github.com/Minh-Tam-Solution/tinysdlc) / [npm](https://npmjs.com/package/tinysdlc) | Predecessor — "EndiorBot is the production evolution of TinySDLC" |
| **AncestorTree** | [GitHub](https://github.com/Minh-Tam-Solution/AncestorTree) | Proof case — "Built in 1 evening with 8 AI agents" |
| **SDLC Framework 6.3.1** | [GitHub](https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework) | Full methodology — "503 docs, 11 training modules" |

**Cross-promotion actions on launch day:**
- Add "See also: EndiorBot" link to MTS-SDLC-Lite + TinySDLC + AncestorTree READMEs
- Reference AncestorTree success story in social posts: "1 person + 8 agents → production genealogy platform"
- TinySDLC README: "For production-grade orchestration, see EndiorBot"

---

## Pre-Launch Checklist (verified 2026-04-27)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | API keys rotated | DONE | Sprint 145 A1, SECURITY.md updated |
| 2 | Build clean | DONE | `pnpm build` — 0 TS errors |
| 3 | Tests pass | DONE | 8,124+ / 8,134 (10 skipped by design) |
| 4 | Internal refs cleaned | DONE | 0 nqh-internal, 0 CEO Power Tool in active docs |
| 5 | CI/CD pipeline | DONE | `.github/workflows/ci.yml` — `--pool=forks --retry=2` |
| 6 | npm pack clean | DONE | 0 sensitive files in package |
| 7 | SECURITY.md | DONE | Key rotation documented, contact dttai@mtsolution.com.vn |
| 8 | CHANGELOG | DONE | Sprint 139-145 entries added |
| 9 | ADR traceability | DONE | 51 ADRs, ADR-003 + ADR-006 created |
| 10 | God classes refactored | DONE | All 3 below 1,000 lines |
| 11 | OTT routing bugs fixed | DONE | Telegram router gutted, 1 local handler (/start) |
| 12 | Landing page | DONE | `site/index.html` ready for GitHub Pages |
| 13 | SDLC compliance | 96% | Target 95% — PASSED |
| 14 | CODE_OF_CONDUCT.md | DONE | Contributor Covenant 2.1 |
| 15 | FUNDING.yml | DONE | GitHub Sponsors + Buy Me a Coffee |
| 16 | Clean npm install test | DONE | tarball → install → `endiorbot --help` works |
| 17 | good-first-issue labels | TODO | Create 10+ issues before launch (CEO 28/4 evening) |

---

## Launch Day Sequence (CEO executes)

### Phase 0: Release Integrity Gate (08:45)

**HARD GATE — do NOT proceed to Phase 1 without ALL green:**

```bash
cd /Users/dttai/Documents/Python/01.NQH/EndiorBot

# 1. Verify keys rotated (CTO hard gate — Sprint 145 A1)
grep "Pre-publish key rotation (2026-04-27" SECURITY.md && echo "✅ Keys rotated" || echo "❌ BLOCK"

# 2. Clean build + smoke test
pnpm build && echo "✅ Build clean" || echo "❌ BLOCK"
pnpm test 2>&1 | tail -3  # Expect: 8,124+ pass

# 3. Package integrity
npm pack --dry-run 2>&1 | grep "total files" # Expect: ~2,300 files, 0 sensitive

# 4. No secrets in staged files
git diff --cached --name-only | grep -E "\.env$|\.mcp" && echo "❌ BLOCK" || echo "✅ Clean"
```

**All 4 green → proceed. Any red → STOP and fix.**

### Phase 1: Flip Public (09:00)

```bash
# 1. Final push (if any uncommitted changes)
cd /Users/dttai/Documents/Python/01.NQH/EndiorBot
git status
git push origin main

# 2. Flip EndiorBot repo to public
# GitHub → github.com/Minh-Tam-Solution/EndiorBot → Settings → Danger Zone → Change visibility → Public

# 3. SDLC Framework — handled by Orchestrator team (NOT EndiorBot scope)
# Coordinate: confirm Orchestrator team flips Framework public on same day

# 4. Verify both repos accessible
open https://github.com/Minh-Tam-Solution/EndiorBot
open https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework
```

### Phase 2: npm Publish (09:15)

```bash
# 1. Login to npm
npm login

# 2. Publish
cd /Users/dttai/Documents/Python/01.NQH/EndiorBot
npm publish --access public

# 3. Verify
npx endiorbot --help
npm info endiorbot
```

### Phase 3: GitHub Releases (09:30)

**Ownership:** CEO creates both releases. @pm verifies links + checksums after publish.

#### EndiorBot Release

GitHub → Releases → Draft new release:
- **Tag:** `v0.1.0-beta.1`
- **Title:** `EndiorBot v0.1.0-beta.1 — Solo Developer AI Orchestration Tool`
- **Body:**

```markdown
## EndiorBot v0.1.0-beta.1

> AI dev team in your terminal — 14 SDLC agents, 5 channels, answers in 30 seconds

> **Beta notice:** This is a v0.1.0 beta release. APIs may change between 0.x versions. Desktop app is a Developer Preview. Production use should start with CLI + Telegram channels.

> **Origin:** EndiorBot was ported from OpenClaw (Python) to TypeScript in Sprint 54. The OpenClaw backport (Sprint 131-132) brought exec-policy, Active Memory, and SSRF protection into the current architecture.

### Highlights

- **14 SOUL agents** — @pm, @architect, @coder, @reviewer, @tester + 9 more
- **5 channels** — CLI, Web, Telegram, Zalo, Desktop (Electron)
- **39 unified commands** — same commands work across all channels
- **CC-first routing** — Claude Code primary, Kimi fallback (free OAuth)
- **SDLC Framework 6.3.1** — 10-stage lifecycle, quality gates, compliance
- **Gateway resilience** — PID lockfile, circuit breaker, OTT 60s timeout
- **Desktop app** — Electron with gateway auto-start, API key management

### Quick Start

\`\`\`bash
npx endiorbot --help
npx endiorbot init --tier STANDARD
npx endiorbot serve
\`\`\`

### Stats

- 8,124+ tests | 39 commands | 51 ADRs | 14 agents | 5 channels
- SDLC 6.3.1 compliance: 96%
- Built on [SDLC Framework 6.3.1](https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework)

### Documentation

- [Usage Guide (20 workflows)](docs/07-operate/USAGE-GUIDE.md)
- [Architecture (51 ADRs)](docs/02-design/README.md)
- [Deploy Guide](docs/06-deploy/README.md)

### Known Limitations (Beta)

- APIs may change between 0.x releases
- Desktop app is in **Developer Preview** — requires `pnpm dev` (no prebuilt binaries)
- 2 moderate dev-only vulnerabilities (vite, brace-expansion)
- Checkpoint restore not yet implemented

MIT License — free for personal and commercial use.
```

#### SDLC Framework Release

GitHub → Releases → Draft new release:
- **Tag:** `v6.3.1`
- **Title:** `SDLC Framework 6.3.1 — AI+Human Development Methodology`
- **Body:**

```markdown
## SDLC Framework 6.3.1

> Built BY AI+Human Teams FOR AI+Human Teams

Universal, tool-agnostic development methodology — 7 pillars, 10 stages, 8 mental models.

### What's Inside

- **503 methodology documents** — principles, governance, templates
- **11 training modules (39 hours)** with 80 quiz questions
- **18 SOUL templates** — agent persona definitions
- **10 TEAM charters** — multi-agent collaboration patterns
- **4-tier classification** — LITE / STANDARD / PROFESSIONAL / ENTERPRISE

### Reference Implementation

- [EndiorBot](https://github.com/Minh-Tam-Solution/EndiorBot) — OSS tool implementing SDLC 6.3.1

MIT License — MTS SDLC Framework is a trademark of Minh Tam Solution.
```

### Phase 4: Deploy Landing Pages (10:00)

#### endior.net (EndiorBot)

```bash
# GitHub Pages: Settings → Pages → Source: Deploy from branch → main → /site
# CNAME already at site/CNAME → endior.net

# DNS (apex domain — use A records, NOT CNAME):
# A records: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
# www CNAME: www.endior.net → minh-tam-solution.github.io
```

#### sdlcframework.org (Framework)

```bash
# CPO condition 1: apex domain redirect — use registrar URL redirect, NOT CNAME
# Option A (recommended for launch): URL redirect at registrar
#   sdlcframework.org → https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework
#   (Registrar: Namecheap/GoDaddy/Cloudflare → URL Redirect Record for @ → GitHub URL)
#
# Option B (Sprint 147): GitHub Pages site + A records (same as endior.net pattern)
```

#### sdlcframework.dev (Orchestrator)

```bash
# URL redirect at registrar → https://mtsolution.com.vn (or "Coming Soon" page)
```

#### Pre-Social Gate (CPO condition 2)

**HARD GATE before Phase 5:** Do NOT post on social media until ALL links verified:

```bash
# Must ALL return 200 or 301/302 redirect:
curl -sI https://endior.net | head -1           # Expect: HTTP/2 200
curl -sI https://sdlcframework.org | head -1     # Expect: HTTP/1.1 301 (redirect to GitHub)
curl -sI https://sdlcframework.dev | head -1     # Expect: HTTP/1.1 301 (redirect)
npx endiorbot --help                             # Expect: usage output
npm info endiorbot                               # Expect: package metadata
```

If any link fails → **STOP social posting**. Fix DNS/deploy first. Social can happen hours later — broken links on launch day is worse than delayed announcement.

### Phase 5: Social Announcement (10:30 — AFTER pre-social gate passes)

**Sequencing (CPO directive):** X/Twitter + LinkedIn first → wait 30-60min for initial feedback → Facebook + Reddit.

**Ownership:** CEO posts on all channels. @pm prepares copy (pre-written below).

#### Twitter/X Thread

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
- 8,124+ tests
- 51 Architecture Decision Records
- Gateway resilience: circuit breaker, PID lockfile, OTT 60s timeout
- CC-first routing with Kimi fallback (free OAuth)

96% SDLC compliance ✅

5/5 Try it now:

npx endiorbot --help
npx endiorbot init --tier STANDARD
npx endiorbot serve

⭐ Star: github.com/Minh-Tam-Solution/EndiorBot
📖 Docs: endior.net
🎓 Framework: sdlcframework.org

MIT License — initiated by @dttai, built with Minh Tam Solution
```

#### Dev.to Article (publish within 1 week)

Title: "Building an AI Agent Orchestrator with 14 SOUL Agents — Lessons from 145 Sprints"

Outline:
1. The problem: 30-60min per decision → 30s with AI agents
2. Architecture: 5 channels, 39 commands, CC-first routing
3. SDLC governance: quality gates, compliance, vibecoding index
4. Lessons learned: 7 gateway failures in 2 hours (Sprint 143)
5. Open-source: how to contribute

#### LinkedIn Post

```
Excited to announce the open-source launch of two projects:

🤖 EndiorBot — AI orchestration tool for solo developers
📚 SDLC Framework 6.3.1 — development methodology for AI+Human teams

After 145 sprints of development:
• 14 AI agents across 5 channels
• 8,124+ tests, 96% SDLC compliance
• Gateway resilience: circuit breaker, PID lockfile
• CC-first routing with free Kimi fallback

The methodology is tool-agnostic — use it with any AI coding assistant.
The tool is the reference implementation.

Links in comments.
```

#### Facebook — CEO Personal + MTS Fan Page

**CEO Personal (facebook.com/dttai):**
```
🚀 Hôm nay mình open-source 2 dự án sau 145 sprints phát triển:

🤖 EndiorBot — công cụ AI cho solo developer
   14 AI agents × 5 kênh × 39 commands
   Trả lời trong 30 giây thay vì 30-60 phút

📚 SDLC Framework 6.3.1 — phương pháp luận phát triển AI+Human
   503 tài liệu, 11 modules đào tạo (39 giờ), 18 SOUL templates

Cả 2 đều MIT License — miễn phí cho cá nhân và thương mại.

GitHub: github.com/Minh-Tam-Solution/EndiorBot
npm: npx endiorbot --help
Docs: endior.net

#opensource #AI #developer #SDLC #TypeScript
```

**MTS Fan Page (Minh Tam Solution):**
```
🎉 Minh Tam Solution chính thức open-source SDLC Framework 6.3.1 — 
phương pháp luận phát triển phần mềm AI+Human đã được thực chiến 
qua 14 nền tảng trong NQH Technology Ecosystem.

Framework bao gồm:
✅ 7 trụ cột (Pillars) cho AI+Human Excellence
✅ 10 giai đoạn vòng đời phát triển (WHY → GOVERN)
✅ 18 SOUL templates cho AI agents
✅ 11 modules đào tạo (39 giờ) + 80 câu hỏi kiểm tra
✅ 503 tài liệu phương pháp luận

Kèm theo: EndiorBot — công cụ tham chiếu (reference implementation) 
với 14 AI agents, 5 kênh giao tiếp, 8,124+ tests.

🔗 Framework: github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework
🔗 EndiorBot: github.com/Minh-Tam-Solution/EndiorBot
🔗 Docs: sdlcframework.org | endior.net

MIT License — miễn phí sử dụng.

#MTS #SDLC #AIEngineering #OpenSource #Framework
```

#### Reddit (staggered — expert recommendation)

**29/4 20:30 ICT (US morning):**
- r/opensource — "EndiorBot: Open-source AI dev team in your terminal — 14 SDLC agents" (lowest hostility, methodology-friendly)

**30/4-1/5 (based on r/opensource reception — skip if <20 upvotes):**
- r/programming — "EndiorBot: 14 AI agents orchestrated via CLI, Telegram, or Desktop"
- r/typescript — "Building an agent orchestrator: 8,124 tests, 51 ADRs, 145 sprints"

#### Hacker News — Show HN (29/4 21:00 ICT = US morning peak)

```
Show HN: EndiorBot – 14 AI agents in your terminal with SDLC governance

EndiorBot is an open-source AI agent orchestrator for solo developers.
It routes @agent mentions to 14 specialized SDLC agents (PM, Architect,
Coder, Reviewer, Tester, etc.) across CLI, Web, Telegram, Zalo, and Desktop.

Key decisions:
- CC-first routing: Claude Code primary, Kimi (free OAuth) as fallback
- Gateway resilience: circuit breaker (2 failures → skip → 60s cooldown)
- 39 unified commands across all 5 channels via single CommandDispatcher
- Ported from Python (OpenClaw) to TypeScript — 145 sprints, 8,124 tests

Built on SDLC Framework 6.3.1 (also open-sourced today) — a tool-agnostic
methodology with 503 docs, 11 training modules, and 18 agent templates.

The same methodology was used to build AncestorTree (genealogy platform)
in 1 evening with 8 AI agents — https://ancestortree.endior.net

GitHub: https://github.com/Minh-Tam-Solution/EndiorBot
npm: npx endiorbot --help
```

---

## 3-Layer Weekly Rollout (proven from AncestorTree launch)

### Week 1: Core Developer Community (29/4-3/5)

| Day | Channel | Content |
|-----|---------|---------|
| Mon 29/4 | GitHub Discussions (pinned) + Release Notes | EN + VI |
| Mon 29/4 | X/Twitter thread + LinkedIn post | Global dev audience |
| Mon 29/4 | Facebook CEO + MTS Fan Page | Vietnamese dev community |
| Mon 29/4 21:00 ICT | Hacker News (Show HN) | Pure technical angle |
| Tue 30/4 | Reddit r/opensource | Problem-first framing |
| Wed 1/5 | Reddit r/programming (if r/opensource >20 upvotes) | Architecture deep-dive |
| Fri 3/5 | Cross-promote from MTS-SDLC-Lite + TinySDLC + AncestorTree READMEs | Existing audience |

### Week 2: Technical Deep-Dive (5-9/5)

| Channel | Content |
|---------|---------|
| Dev.to (English) | "Building an AI Agent Orchestrator — 145 Sprints" (~1500 words) |
| Viblo (Vietnamese) | Same article adapted for Vietnamese dev community |
| X/Twitter | 10-tweet architecture thread (CC-first routing, circuit breaker, 5-channel design) |
| LinkedIn | Follow-up: "Methodology behind the tool — SDLC 6.3.1" |

### Week 3+: Amplification (12/5+)

| Channel | Content |
|---------|---------|
| Reddit r/selfhosted, r/sideproject | Positioning for indie hackers |
| GitHub AMA Discussion | "Ask me anything about 145 sprints of AI-assisted development" |
| YouTube/Loom | 5-min demo video: init → serve → Telegram chat |

---

## Post-Launch Monitoring (29/4 afternoon)

| Check | How | Target |
|-------|-----|--------|
| CI badge green | GitHub Actions | Green within 1h |
| npm install works | `npx endiorbot --help` from clean machine | Success |
| Landing page live | `curl -I https://endior.net` | 200 OK |
| First GitHub star | GitHub notifications | Within 24h |
| First npm install | npm stats | Within 24h |
| First community issue | GitHub Issues | Within 1 week |

---

## Rollback Plan

If critical issue found post-launch:
1. **npm deprecate** (immediate): `npm deprecate endiorbot@0.1.0-beta.1 "Critical issue found — use beta.2 when available"`
   - Preferred over `npm unpublish` (npm policy limits unpublish to 72h + may be blocked if downloads exist)
2. **Fix → re-publish**: Fix issue, bump to `0.1.0-beta.2`, `npm publish --access public`
3. **Update GitHub Release**: Edit release notes to point to beta.2
4. **Repo stays public** (unless security vulnerability in code itself — then flip private temporarily)

---

## Success Metrics (1 week post-launch)

| Metric | Target | Stretch |
|--------|--------|---------|
| GitHub stars (EndiorBot) | 100 | 300 |
| GitHub stars (Framework) | 50 | 200 |
| npm weekly installs | 50 | 200 |
| First external PR | 2 weeks | 1 week |
| Dev.to article views | 500 | 2,000 |

---

*EndiorBot + SDLC Framework 6.3.1 | Launch Day Plan | 29 April 2026*
