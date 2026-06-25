---
sprint: 155
title: "Init Ecosystem Accuracy — 4 Detection & Template Fixes"
status: PLANNED
start_date: "2026-06-23"
adr: ADR-057
authority: "@cto"
assignee: "@coder (Kimi)"
---

# Sprint 155: Init Ecosystem Accuracy

## Objective

Fix 4 accuracy bugs discovered by field-testing `endiorbot init/skills/audit-claude-md` against DeepTutor (Python + Docker + Next.js repo).

## Scope

| ID | Fix | Effort | Files |
|----|-----|--------|-------|
| F1 | Docker ecosystem includes root language markers | S | `ecosystem-detector.ts` + tests |
| F2 | Ecosystem-aware commands in CLAUDE.md template | M | `claude-md.ts` + tests |
| F3 | Root SKILL.md discovery (Pass 0) | S | `plugin-loader.ts` + tests |
| F4 | Existence-checked path refs in subdir CLAUDE.md | S | `claude-md.ts` + tests |

**Total effort:** M (all 4 fixes in one sprint — they're independent, small, same module cluster)

## Acceptance Criteria

### F1: Docker + Root Language
- [ ] `detectEcosystem("/path/to/DeepTutor")` returns `language: "Python + TypeScript"` (not just "TypeScript")
- [ ] `scanSubEcosystems()` scans root for pyproject.toml, Cargo.toml, go.mod, package.json
- [ ] Root markers don't duplicate if a subdir has the same language
- [ ] Non-Docker ecosystems unchanged (root scan only runs when Docker detected)
- [ ] Unit tests cover: root Python + sub TypeScript, root-only Go, no sub-ecosystems

### F2: Ecosystem-Aware Commands
- [ ] Python project CLAUDE.md shows `pip install`, `pytest`, NOT `pnpm`
- [ ] Docker project shows `docker compose build/up`
- [ ] Rust project shows `cargo build/test`
- [ ] Node.js behavior unchanged (existing tests still pass)
- [ ] Fallback to generic when no snapshot (backward compat)

### F3: Root SKILL.md
- [ ] `discoverSkills("/path/to/DeepTutor")` finds root `SKILL.md`
- [ ] Root skill has `source: "root"` in result
- [ ] `DiscoveredSkill.source` type updated to `"root" | "folder" | "flat"`
- [ ] If `skills/<name>` conflicts with root name, skills/ wins
- [ ] `endiorbot skills` output shows root skill with 📋 indicator
- [ ] Existing tests for folder/flat patterns still pass

### F4: Existence-Checked Paths
- [ ] `docs/CLAUDE.md` only references paths that exist on disk
- [ ] No more `docs/02-design/01-ADRs/` hardcoded reference
- [ ] Freshly init'd project → `endiorbot audit-claude-md` → 0 REF warnings for subdir files
- [ ] Existing projects with full stage structure → all paths still listed

## Test Plan

```bash
# After implementation
pnpm build                                    # 0 errors
pnpm test                                     # All pass
pnpm test -- tests/cli/ecosystem-detector     # F1 tests
pnpm test -- tests/sdlc/scaffold/templates    # F2 + F4 tests
pnpm test -- tests/sdlc/scaffold/plugin-loader # F3 tests

# Smoke test on DeepTutor
endiorbot init --path /tmp/deeptutor-test --force
cat /tmp/deeptutor-test/.sdlc-config.json | grep language  # "Python + TypeScript"
cat /tmp/deeptutor-test/CLAUDE.md | grep -A5 "Development"  # pip/pytest, not pnpm
endiorbot skills --path /Users/dttai/Documents/Research/DeepTutor  # finds root SKILL.md
endiorbot audit-claude-md --path /tmp/deeptutor-test  # 0 REF warnings in subdir files

# Regression on EndiorBot itself
endiorbot skills --path .  # existing behavior preserved
endiorbot audit-claude-md --path .  # no new warnings
```

## Dependencies

None — all 4 fixes are self-contained within existing modules.

## Risks

- F1: `scanSubEcosystems()` root scan may pick up monorepo root markers that should be ignored — mitigated by only running root scan for Docker ecosystem
- F2: Ecosystem command map may miss edge cases — mitigated by falling back to generic
- F3: `source: "root"` type change requires updating existing switch/if statements — grep for `source` usage
