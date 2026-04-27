---
sprint: 145
status: IN PROGRESS
start_date: 2026-04-27
planned_duration: 3-4d
framework: "6.3.1"
authority:
  proposer: "@pm"
  countersigners: ["@cto G2 approved 2026-04-27", "@cpo GO 2026-04-27"]
  trigger: "Sprint 144 OSS publish readiness — dual-launch CEO directive"
previous_sprint: "Sprint 144 — Gateway Hardening + Community Publish Cleanup"
---

# Sprint 145 — Dual-Launch: SDLC Framework + EndiorBot

## Context

CEO directive: launch **SDLC Framework 6.3.1** (methodology) and **EndiorBot** (reference implementation) simultaneously as open-source projects.

**3 domains, 3 products:**

| Domain | Product | Type | GitHub Repo |
|--------|---------|------|-------------|
| **sdlcframework.org** | SDLC Framework 6.3.1 | OSS methodology (MIT) | Minh-Tam-Solution/SDLC-Enterprise-Framework |
| **endior.net** | EndiorBot v0.1.0-beta.1 | OSS tool (MIT) | Minh-Tam-Solution/EndiorBot |
| **sdlcframework.dev** | SDLC Orchestrator | Commercial (future) | Private |

**Brand decisions:**
- SDLC Framework keeps MTS branding (authentic, battle-tested, trademarked)
- EndiorBot uses "Solo Developer Power Tool" identity
- Cross-promotion: Framework README → EndiorBot as reference impl; EndiorBot README → Framework as methodology

---

## Track A: Security (Day 1) — BLOCKS EVERYTHING

### A1: Rotate ALL API Keys (~30min)

**Keys to rotate (both repos):**
- Anthropic, OpenAI, Gemini, Kimi API keys
- GitHub PAT, Telegram/Zalo bot tokens
- Ollama remote keys, MCP Gateway, Gateway token

**After rotation:**
- Update `.env` locally
- Verify `endiorbot serve` + Telegram message works
- Old keys confirmed dead

**Owner:** CEO

### A2: Update SECURITY.md (~15min)

- Add rotation date: "All credentials rotated on YYYY-MM-DD prior to public launch"
- Verify security contact email works (security@endior.net or dttai@mtsolution.com.vn)

**Owner:** @cso

---

## Track B: EndiorBot Pre-Publish (Day 1-2)

### B1: GitHub Actions CI/CD (~2h)

Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
```

**Owner:** @devops

### B2: Fix 2 Moderate Vulnerabilities (~30min)

- Add vite override to pnpm.overrides
- Verify `pnpm audit` clean

**Owner:** @coder

### B3: README Cross-Link (~30min)

Add to EndiorBot README.md:
```markdown
## Methodology

EndiorBot implements [SDLC Framework 6.3.1](https://sdlcframework.org) — 
a 7-Pillar, 10-Stage AI+Human development methodology.

- [Framework GitHub](https://github.com/Minh-Tam-Solution/SDLC-Enterprise-Framework)
- [Training: 11 modules, 39 hours](https://sdlcframework.org)
```

**Owner:** @pm

### B4: Verify npm Publish Config (~15min)

```bash
npm pack --dry-run   # Check what gets published
# Verify: dist/, endiorbot.mjs, .env.example, README.md, LICENSE, SECURITY.md
# Verify: NO .env, .mcp.json, node_modules, coverage/
```

**Owner:** @devops

---

## Track C: SDLC Framework Coordination (Day 2)

> **Note:** SDLC Framework is a **git submodule** inside the SDLC Orchestrator repo.
> Changes to Framework must be coordinated with the SDLC Orchestrator team.
> EndiorBot team prepares the request; Orchestrator team executes in their repo.

### C1: Request Cross-Link from Orchestrator Team (~30min)

**Submodule delta request (CTO C1):**

Framework submodule is currently pinned at `cac8cdd` (v6.3.1, 2026-04-17).
EndiorBot needs:
1. **Cross-link in README** — add "Reference Implementations" section (EndiorBot + Orchestrator)
2. **No code/content changes needed** — EndiorBot uses 6.3.1 as-is (all 7 pillars, 10 stages, SASE)
3. **Submodule pin stays at `cac8cdd`** — update only after Orchestrator team merges the README change

**Handoff to SDLC Orchestrator PM:**

Request adding to SDLC Framework README.md:
```markdown
## Reference Implementations

| Tool | Description | Link |
|------|-------------|------|
| **EndiorBot** | Solo developer AI orchestration tool — 14 SOUL agents, 5 channels, SDLC 6.3.1 compliance | [endior.net](https://endior.net) |
| **SDLC Orchestrator** | Enterprise platform (commercial, coming soon) | [sdlcframework.dev](https://sdlcframework.dev) |
```

**Owner:** @pm (EndiorBot) → handoff to Orchestrator team PM
**Repo:** SDLC-Orchestrator/SDLC-Enterprise-Framework (submodule)

### C2: Verify Framework Submodule Ready (~15min)

**Coordinate with Orchestrator team:**
- Framework submodule up-to-date (`git submodule update`)
- Verify LICENSE, README, CHANGELOG present in submodule
- No action needed on MTS branding (CEO decision: keep as-is)
- Confirm Orchestrator team will flip Framework submodule repo to public on launch day

**Owner:** @devops (EndiorBot) + Orchestrator team

### C3: Domain DNS Setup (~30min)

| Domain | Target | Type |
|--------|--------|------|
| sdlcframework.org | GitHub Pages or redirect → GitHub repo | A/CNAME |
| endior.net | GitHub Pages or redirect → GitHub repo | A/CNAME |
| sdlcframework.dev | Placeholder "Coming Soon" page | A/CNAME |

**Owner:** CEO + @devops

---

## Track D: Launch Day (Day 3)

### D1: Flip Both Repos Public (~5min)

Order matters (CTO C1: keys rotated first):

1. Verify keys rotated (Track A complete)
2. GitHub → Minh-Tam-Solution/SDLC-Enterprise-Framework → Settings → Public
3. GitHub → Minh-Tam-Solution/EndiorBot → Settings → Public
4. Verify both repos accessible

**Owner:** CEO

### D2: npm Publish EndiorBot (~15min)

```bash
cd EndiorBot
npm login
npm publish --access public
npx endiorbot --help   # Verify works globally
```

**Owner:** CEO

### D3: GitHub Releases (~1h)

**SDLC Framework Release:**
- Tag: `v6.3.1`
- Title: "SDLC Framework 6.3.1 — AI+Human Excellence"
- Body: 7 pillars, 10 stages, 11 training modules, 17 SOUL templates

**EndiorBot Release:**
- Tag: `v0.1.0-beta.1`
- Title: "EndiorBot v0.1.0-beta.1 — Solo Developer AI Orchestration"
- Body: 14 agents, 5 channels, 39 commands, 8,124 tests

**Owner:** @pm

### D4: Cross-Verification (~30min)

- [ ] sdlcframework.org resolves (GitHub Pages or redirect)
- [ ] endior.net resolves
- [ ] sdlcframework.dev shows "Coming Soon"
- [ ] `npx endiorbot --help` works
- [ ] EndiorBot README links to Framework repo
- [ ] Framework README links to EndiorBot
- [ ] CI badges green on both repos
- [ ] Both repos show MIT license badge

**Owner:** @pm + @devops

---

## Track E: Post-Launch (Day 3-4)

### E1: Social Announcement (~2h)

**Channels:**
- Twitter/X: Thread about dual launch
- Dev.to: Article "Building an AI Agent Orchestrator with SDLC 6.3.1"
- Reddit: r/programming, r/typescript, r/artificial

**Key messages:**
- "Open-sourcing 10 months of AI+Human development methodology"
- "14 AI agents across 5 channels — CLI, Web, Telegram, Zalo, Desktop"
- "Framework is tool-agnostic; EndiorBot is our reference implementation"
- "503 methodology docs + 222K lines of documentation — free to use"

**Owner:** CEO

### E2: CHANGELOG Updates (~30min)

- EndiorBot: Add Sprint 139-144 entries to CHANGELOG.md
- Framework: Verify CHANGELOG.md is current

**Owner:** @pm

---

## Sequencing

```
Day 1: Track A (security) + Track B (EndiorBot CI/CD + vuln fix)
Day 2: Track B (README cross-link) + Track C (Framework cross-link + DNS)
Day 3: Track D (flip public + npm + releases + verify)
Day 4: Track E (social + CHANGELOG) — buffer for issues
```

---

## Exit Criteria

- [ ] All API keys rotated (A1)
- [ ] SECURITY.md updated (A2)
- [ ] CI green on EndiorBot (B1)
- [ ] 0 high/critical vulnerabilities (B2)
- [ ] Cross-links in both READMEs (B3, C1)
- [ ] Both repos public on GitHub (D1)
- [ ] `npx endiorbot` works globally (D2)
- [ ] Both GitHub Releases published (D3)
- [ ] All 3 domains resolving (D4)

---

## Success Metrics (1 week post-launch)

| Metric | Target |
|--------|--------|
| GitHub stars (EndiorBot) | 50+ |
| GitHub stars (Framework) | 100+ |
| npm installs | 100+ |
| First external contributor PR | Within 2 weeks |
| First Dev.to article comment | Within 3 days |

---

*EndiorBot + SDLC Framework 6.3.1 | Dual-Launch Plan | Sprint 145 Draft — 2026-04-27*
