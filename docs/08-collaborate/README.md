# 08-collaborate — Collaborate

## Purpose

**How to ALIGN humans and agents** — compliance, handover, and shared context so solo-dev + AI work stays auditable and safe.

This stage holds templates, audits, and knowledge transfer supporting stages 00-07. Execution goes through EndiorBot core.

---

## Collaboration Model

EndiorBot is a **personal AI assistant for builders**. It supports solo developers working with AI agents:

```
Developer ←→ EndiorBot (14 SOUL agents)
                │
                ├── @pm, @architect, @coder, @reviewer, @tester
                ├── @fullstack, @devops, @pjm, @researcher
                ├── @ceo, @cto, @cpo, @cso (advisors)
                └── @assistant (router)
```

### How Agents Collaborate

1. **Single agent:** `endiorbot @coder --patch "fix login bug"`
2. **Multi-agent:** `@pm @cto review the auth module` → GoalDecomposer splits → parallel execution
3. **Team mode:** `/launch claude --as-team dev "implement feature"` → dev team (coder + architect + reviewer + tester)

### Advisory Boundary

> EndiorBot output is advisory. In team/enterprise contexts, deliverables should flow through the organization's governance tools where evidence trails and quality gates apply.

---

## Community Publish Readiness (Sprint 144)

EndiorBot is published as a community open-source tool. All internal references have been cleaned up:

| Item | Detail |
|------|--------|
| npm package | `endiorbot` (no scope prefix) |
| Domain | endior.net |
| Identity | "Solo Developer Power Tool" |
| MCP bridge module | `src/mcp-gateway/` (McpGatewayBridge) |
| Budget system | `"self-hosted"` tier label |
| License | MIT |
| Community files | CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md |

### Command Parity Across 5 Channels (Sprint 144)

39 commands in `CommandDispatcher` — all verified across CLI, Web, Telegram, Zalo, Desktop:

```bash
endiorbot commands          # Full list with channel availability
endiorbot commands --json   # Machine-readable envelope
```

Sprint 144 added `/status` and `/clear` to the unified Dispatcher, completing OTT parity. Any command available on CLI is available on Telegram/Zalo/Desktop.

### Desktop as Collaboration Surface

The Desktop app (Electron) surfaces the full EndiorBot capability set in a native GUI:

- **Settings page** — API key management per provider, theme switching
- **Projects page** — workspace switching via `~/.endiorbot/repos.json`
- **Gates page** — 7 SDLC gate status, approve/reject with audit trail
- **Experts page** — provider status, circuit breaker health
- **Chat page** — gateway auto-starts as subprocess; no separate `serve` needed

## OSS Contribution Workflow

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full details.

```bash
# 1. Fork and clone
git clone https://github.com/<you>/EndiorBot.git

# 2. Install and verify
pnpm install && pnpm build && pnpm test

# 3. Create feature branch
git checkout -b feat/my-feature

# 4. Make changes with tests
# ... code ...

# 5. Verify
pnpm build && pnpm test    # 8,124+ tests must pass

# 6. Submit PR
git push origin feat/my-feature
```

---

## Contents

| Path | Role |
|------|------|
| `01-SDLC-Compliance/` | CLAUDE.md, AGENTS.md compliance copies; gate reports |
| `09-Knowledge-Transfer/` | Architecture overview, ADR summary, codebase map |
| `EXEC_ALLOWLIST.md` | Approved shell execution surfaces (security audit) |
| `LICENSE-AUDIT.md` | Third-party license audit (0 GPL/AGPL) |
| `FINAL-HANDOVER-CEO.md` | Sprint handover artifact |

---

## ADR-046 — Autonomous Execution Policy (Sprint 131–132)

The binding governance document for exec-policy, auto-handoff, and the 6-cell preset × `ENDIORBOT_AUTO_HANDOFF` matrix. Located at [`docs/02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md`](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md).

**History:**
- Sprint 131: STUB created (binding sentence only, CPO C4)
- Sprint 132: Expanded STUB → FULL (@cto drafted, @cpo signed, @cto countersigned)
- Sprint 132: Amendment 1 — Finding #2 scope honesty (zero production construction sites for `AutonomousSessionManager`)

Signed by @cpo + @cto on 2026-04-11. Amendment 1 re-acknowledged by @cpo same day.

## SOUL-pm.md v1.2.0 — Ground-Truth Verification (Sprint 132)

Three new rules added to `docs/reference/templates/souls/SOUL-pm.md` to prevent assumed-state planning:

1. **Rule 1 — Integration-point verification:** Before citing a file path, function name, or behavior in a plan, verify it with a direct check (ls, grep, read). Cite the command + result.
2. **Rule 2 — Adjacent-artifact enumeration:** Before proposing a new numbered artifact (ADR-NNN, Sprint-NNN), ls the existing numbered range and check for collisions or adjacent docs covering the same topic.
3. **Rule 3 — Document drift check:** Before citing a status document, check its last-updated date against recent git activity. Flag if drift ≥ 3 days.

**Impact (Sprint 132):** Rule 1 was applied 5 times by 4 different agents (@cpo, @architect, @cto, @cpo again) and caught 3 load-bearing false claims before any reached production. This is the **correction-trail discipline** — when a claim is found false, it's corrected with a visible amendment trail (not silently rewritten), and the catching agent is credited.

Examples:
- @cpo caught `ChannelRouter.originChannel` false claim during ADR-046 sign → Finding #1 fix with credit
- @architect caught zero production construction sites during M1 design → Amendment 1 with credit

## Openclaw-Backport Pattern (Reusable Process)

Sprint 132 established a repeatable process for backporting from upstream repositories:

```
1. Survey upstream    → Explore agents map recent changes with commit-date evidence
2. Filter by identity → Solo Developer Power Tool filter (not platform, not SDLC enforcer)
3. MoSCoW prioritize  → MUST/SHOULD/COULD/WON'T with effort + risk estimates
4. Ground-truth verify → SOUL-pm.md Rule 1 on every integration point
5. Port the pattern   → Adapt the design, don't copy the code
6. ADR governance     → Expand existing ADRs rather than creating parallel docs
```

Artifacts produced: PRD ([`docs/01-planning/openclaw-backport/PRD.md`](../01-planning/openclaw-backport/PRD.md)), scope ([`docs/01-planning/openclaw-backport/scope.md`](../01-planning/openclaw-backport/scope.md)), sprint plans, design notes.

## Sprint 132 Gate Status

**G3 APPROVED** — CTO code review 9.5/10, zero conditions. Three rounds of plan review (CTO + CPO), all 8 conditions from v2 folded into v3. CEO decisions locked (6 items) on 2026-04-11.

## Sprint 144 — Gateway Hardening + Community Publish (2026-04-27)

Four tasks shipped:

- **T1 PID lockfile** — `~/.endiorbot/serve.pid` prevents accidental duplicate `serve`. `--force` flag for deliberate takeover.
- **T2 Provider circuit breaker** — 2 failures → OPEN → 60s cooldown → HALF-OPEN probe → CLOSED on success. Automatic fallback to next provider in chain. `getOpenCircuits()` for diagnostics.
- **T3 Channel-aware timeouts** — `originChannel` threaded bus → ingress → router. OTT/Web = 60s, CLI = 180s, ensuring OTT message delivery windows are respected without penalizing terminal users.
- **T4 Kimi subprocess deprecation** — External `claude-code-proxy serve` + `ENDIORBOT_KIMI_PROXY_URL` is now the recommended deployment path. Auto-spawn remains functional but deprecated.

Community publish cleanup also shipped: `src/mcp-gateway/` rename, `"self-hosted"` budget label, `endiorbot` npm package name, endior.net domain, identity alignment to "Solo Developer Power Tool".

**Test count:** 8,124+ pass (zero failures).

## Sprints 139–141 — OpenMythos Adoption + Kimi Integration (2026-04-20 → 2026-04-24)

### ADR-050: OpenMythos Evaluator Optimization Patterns (Sprint 139)

Selective adoption of 7 patterns from OpenMythos (Recurrent-Depth Transformer architecture) translated to EndiorBot's agent orchestration domain. **NOT code transplant — conceptual pattern mapping.**

| # | Pattern | OpenMythos Source | EndiorBot Target | Status |
|---|---------|-------------------|------------------|--------|
| 1 | Convergence Guard | ACT halting | EvaluatorLoop early stop | Shipped |
| 2 | Dynamic Budget | Variable loop depth | TaskComplexity → iteration budget | Shipped |
| 3 | Frozen Input | Frozen encoder injection | FrozenContext in optimizer | Shipped |
| 4 | Loop-Index | Loop-index embedding | Iteration-aware prompting | Shipped |
| 5 | Phase Behavior | Prelude/Recurrent/Coda | prelude()/recurrentLoop()/coda() | Shipped |
| 6 | Stability Guard | LTI-stable injection | StabilityPolicy (4 runtime guards) | Shipped |
| 7 | Expert Routing | MoE router | Historical performance scoring | Shipped (Phase 1, read-only) |

CTO review: all 7 items approved with fixes (bff6402). +64 new tests.

### ADR-051 + ADR-052: Kimi k2.6 Integration (Sprint 140–141)

**ADR-051:** Auto-managed `claude-code-proxy` subprocess for Kimi OAuth access.
**ADR-052:** 14-agent tier mapping (3 Opus, 10 Kimi, 1 Ollama). Estimated 45-60% cost reduction.

Sprint 141 added cost telemetry (`endiorbot cost report`), Ollama confidence scoring, and Kimi rate-limit monitoring.

**DevOps finding (Sprint 141):** Dual Kimi proxy instance conflict — `claude-code-proxy` running via `claude-kimi` alias conflicts with EndiorBot's auto-spawn. Fix: `ENDIORBOT_KIMI_PROXY_URL` env var to reuse external proxy + SSRF allowlist for configured local providers. See [06-deploy](../06-deploy/) and [07-operate](../07-operate/) for operational guidance.

## License

EndiorBot is [MIT licensed](../../LICENSE). All dependencies are MIT/ISC/Apache/BSD compatible (verified in [LICENSE-AUDIT.md](LICENSE-AUDIT.md)).

---

## Alignment

- **Feeds:** All stages, especially [00-foundation](../00-foundation/) (vision), [02-design](../02-design/) (ADRs)
- **Consumes:** Gate evidence and sprint outcomes from [04-build](../04-build/)
- **Key ADRs:** [ADR-046 Autonomous Execution Policy](../02-design/01-ADRs/ADR-046-Autonomous-Execution-Policy.md)
- **Backport PRD:** [openclaw-backport PRD](../01-planning/openclaw-backport/PRD.md) + [scope](../01-planning/openclaw-backport/scope.md)
- **Sprints:** [132](../04-build/sprints/sprint-132-openclaw-backport.md), [133](../04-build/sprints/sprint-133-active-memory-ssrf.md), [139](../04-build/sprints/sprint-139-plan.md), [140](../04-build/sprints/sprint-140-plan.md), [141](../04-build/sprints/sprint-141-plan.md), [144](../04-build/sprints/sprint-144-plan.md)
- **ADRs:** [ADR-050](../02-design/01-ADRs/ADR-050-openmythos-evaluator-optimization-patterns.md), [ADR-051](../02-design/01-ADRs/ADR-051-kimi-proxy-subprocess-orchestrator.md), [ADR-052](../02-design/01-ADRs/ADR-052-agent-model-tier-mapping.md)
- **Spine:** [stage-command-workflow-spine.md](../00-foundation/stage-command-workflow-spine.md)

---

*EndiorBot | SDLC Framework **6.4.0** — Stage 08: Collaborate — Updated Sprint 145 (2026-04-27)*
