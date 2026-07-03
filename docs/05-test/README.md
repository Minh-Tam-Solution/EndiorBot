# 05-test — Test

## Purpose

**Key question:** Does it **work correctly** — evidence that requirements and design are satisfied?

Testing **closes the loop** back to **01** (acceptance) and **02** (specs). No G3/G4 without evidence.

---

## Alignment

- **Upstream:** `docs/04-build/` (code under test), `docs/02-design/` (NFRs), `docs/01-planning/` (acceptance criteria), `docs/03-integrate/` (contracts under test)  
- **Downstream:** `docs/06-deploy/` (release consumes verified artifacts)  
- **Gates:** **G3** (quality), **G4** readiness (with deploy stage 06)  
- **Spine:** [`../00-foundation/stage-command-workflow-spine.md`](../00-foundation/stage-command-workflow-spine.md)  
- **Stage index:** [`../README.md`](../README.md)

---

## Test ↔ build ↔ design

| Link | Rule |
|------|------|
| Tests → requirements | Critical paths covered by acceptance-linked tests or documented gap. |
| Tests → design | Security/contract tests align with ADR and integration specs. |
| Failures → fix loop | Use failure classification; avoid silent “skip” of red builds for gate claims. |

---

## EndiorBot command hints (this stage)

| Type | Examples |
|------|----------|
| **Atomic** | Project `pnpm test` / ecosystem test command; `compliance check`; `gate check G3`. |
| **Workflow** | `endiorbot sprint close` (includes verify steps); autonomous test/fix loops per `product-vision.md` when enabled. |

Catalog: [`../reference/templates/COMMANDS.md`](../reference/templates/COMMANDS.md).

---

## Stage artifacts (living)

| Artifact | Location | Owner |
|----------|----------|-------|
| Test plans / results | `docs/05-test/` | @tester |
| Coverage / evidence | Gate folders under `~/.endiorbot/evidence/` (per project policy) | @tester + @reviewer |

---

## Test Suite Stats (Sprint 144)

```
Test Files  364 passed (364)
Tests       8,124+ passed | 10 skipped
Duration    50.10s
TypeScript  0 errors (pnpm build clean)
Gitleaks    0 findings
```

## Test Categories

| Category | Tests | Coverage |
|----------|-------|----------|
| Evaluator (OpenMythos) | 297 | Convergence, dynamic budget, frozen input, loop-index |
| Agent Router | 73 | buildEnrichedPrompt, ADR-052 dispatch, Ollama confidence |
| Context/Transfer | 218 | Vision re-injection, context lifecycle, anchor CRUD |
| Sessions/Recovery | 23+ | Brain L2 pattern match, failure classification, recovery |
| Provider | 470+ | Kimi proxy, OpenAI, Gemini, Ollama, SSRF boundary |
| SDLC/Compliance | 200+ | Scaffold, contracts, gates, dashboard |

## Running Tests

```bash
pnpm test                           # Full suite (8,124+ tests)
npx vitest run tests/agents/router/ # Router tests only
npx vitest run tests/evaluator/     # Evaluator tests only
npx vitest run --reporter=verbose   # Verbose output
```

---

*EndiorBot | SDLC Framework **6.4.0** — Stage 05: Test — Updated Sprint 145 (2026-04-27)*
