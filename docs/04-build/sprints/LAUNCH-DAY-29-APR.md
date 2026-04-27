---
type: launch-plan
date: 2026-04-29
status: READY — all blockers resolved
authority: CEO + CTO G3 PRE-APPROVED 2026-04-27
---

# Launch Day Plan — 29 April 2026

## Pre-Launch Checklist (verified 2026-04-27)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | API keys rotated | DONE | Sprint 145 A1, SECURITY.md updated |
| 2 | Build clean | DONE | `pnpm build` — 0 TS errors |
| 3 | Tests pass | DONE | 8,124+ / 8,134 (10 skipped by design) |
| 4 | Internal refs cleaned | DONE | 0 nqh-internal, 0 CEO Power Tool in active docs |
| 5 | CI/CD pipeline | DONE | `.github/workflows/ci.yml` — `--pool=forks --retry=2` |
| 6 | npm pack clean | DONE | 0 sensitive files in package |
| 7 | SECURITY.md | DONE | Key rotation documented, contact dttai@endior.net |
| 8 | CHANGELOG | DONE | Sprint 139-145 entries added |
| 9 | ADR traceability | DONE | 51 ADRs, ADR-003 + ADR-006 created |
| 10 | God classes refactored | DONE | All 3 below 1,000 lines |
| 11 | OTT routing bugs fixed | DONE | Telegram router gutted, 1 local handler (/start) |
| 12 | Landing page | DONE | `site/index.html` ready for GitHub Pages |
| 13 | SDLC compliance | 96% | Target 95% — PASSED |

---

## Launch Day Sequence (CEO executes)

### Phase 1: Flip Public (09:00)

```bash
# 1. Final push (if any uncommitted changes)
cd /Users/dttai/Documents/Python/01.NQH/EndiorBot
git status
git push origin main

# 2. Flip EndiorBot repo to public
# GitHub → github.com/Minh-Tam-Solution/EndiorBot → Settings → Danger Zone → Change visibility → Public

# 3. Flip SDLC Framework repo to public (coordinate with Orchestrator team)
# GitHub → github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework → Settings → Public

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

#### EndiorBot Release

GitHub → Releases → Draft new release:
- **Tag:** `v0.1.0-beta.1`
- **Title:** `EndiorBot v0.1.0-beta.1 — Solo Developer AI Orchestration Tool`
- **Body:**

```markdown
## EndiorBot v0.1.0-beta.1

> Solo Developer AI Orchestration Tool — get answers in 30s instead of 30min

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
- Desktop requires `pnpm dev` (no prebuilt binaries yet)
- 2 moderate dev-only vulnerabilities (vite, brace-expansion)

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

# DNS: endior.net → GitHub Pages IPs
# A records: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
# OR CNAME: endior.net → minh-tam-solution.github.io
```

#### sdlcframework.org (Framework)

```bash
# Option A (immediate): redirect to GitHub repo
# CNAME: sdlcframework.org → github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework

# Option B (Sprint 147): full docs site
```

#### sdlcframework.dev (Orchestrator)

```bash
# Simple "Coming Soon" page or redirect to MTS website
```

### Phase 5: Social Announcement (10:30)

#### Twitter/X Thread

```
1/5 🚀 Launching EndiorBot — open-source AI orchestration for solo developers

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

MIT License — built by @dttai for solo developers everywhere
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

#### Reddit

Post to:
- r/programming — "EndiorBot: Open-source AI agent orchestrator for solo developers"
- r/typescript — "14 SOUL agents in TypeScript — EndiorBot architecture"
- r/artificial — "SDLC Framework 6.3.1: Methodology for AI+Human development"

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
1. **npm unpublish** (within 72h): `npm unpublish endiorbot@0.1.0-beta.1`
2. **Repo back to private**: GitHub Settings → Danger Zone → Make private
3. **Fix → re-publish**: Fix issue, bump to `0.1.0-beta.2`, re-publish

---

## Success Metrics (1 week post-launch)

| Metric | Target | Stretch |
|--------|--------|---------|
| GitHub stars (EndiorBot) | 50 | 200 |
| GitHub stars (Framework) | 100 | 500 |
| npm weekly installs | 50 | 200 |
| First external PR | 2 weeks | 1 week |
| Dev.to article views | 500 | 2,000 |

---

*EndiorBot + SDLC Framework 6.3.1 | Launch Day Plan | 29 April 2026*
