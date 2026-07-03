# ADR-016: CLI Session Mode

**Status:** Accepted
**Date:** 2026-03-03
**Author:** Architect
**SDLC Stage:** 02-DESIGN
**Sprint:** 73

---

## Context

EndiorBot CLI currently operates in single-command mode: each invocation loads config, executes one command, and exits. During E2E testing and daily usage, CEO workflows often involve running 5-10 commands in sequence (gate status → confirm → build → run). Each invocation incurs ~60ms startup overhead and loses in-memory state.

**User request:** *"@pm should we add a persistent CLI mode so we don't exit after each command?"*

**PM Analysis:** Recommended YES as P2 feature. Keep both modes (single-command for scripts/CI, session for interactive use).

---

## Decision

Implement an interactive REPL mode via `endiorbot shell` (or `endiorbot -i`) that:

1. **Reuses existing Commander.js commands** — no duplication of command logic
2. **Maintains session state** — project context, config loaded once
3. **Coexists with single-command mode** — no breaking changes
4. **Intercepts `process.exit()`** — prevents commands from killing the session
5. **Uses Node.js `readline`** — built-in, no external dependencies

### Key Design Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| REPL library | `node:readline` | Built-in, zero dependencies, sufficient for our needs |
| Command reuse | Fresh `Command` per input + `exitOverride()` | Avoids maintaining separate command registry |
| process.exit handling | Scope-limited override | Commands use process.exit(1) for errors; must not kill session |
| Session commands prefix | `/` (slash) | Familiar convention (Discord, Slack), avoids collision with CLI commands |
| Prompt format | `endiorbot [project]>` | Shows context, minimal noise |
| Command name | `shell` (primary), `-i` (shorthand) | `shell` is descriptive; `-i` follows Python/Node convention |

---

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| No session mode | Zero effort | Poor interactive UX | ❌ Reject |
| Custom REPL framework | Full control | Unnecessary complexity | ❌ Reject |
| `node:readline` | Built-in, stable | No tab completion OOB | ✅ Selected |
| `inquirer.js` | Rich prompts | Overkill, adds dependency | ❌ Reject |
| `vorpal.js` | Built for CLI sessions | Abandoned, no maintenance | ❌ Reject |
| Duplicate command handlers | Independent from Commander | Code duplication, drift risk | ❌ Reject |

---

## Consequences

### Positive
- Faster interactive workflows (no repeated startup)
- Shared in-memory state (GateEngine, config) across commands
- Familiar REPL experience for developers
- Zero new dependencies (uses `node:readline`)
- No changes needed to existing commands

### Negative
- Must handle `process.exit()` interception carefully
- Commander.js `exitOverride()` may have edge cases
- Fresh `Command` per input adds minor overhead (~5ms)
- Tab completion not available in v1 (future enhancement)

### Risks
- Commands that call `process.exit()` deep in call stack may bypass interception (mitigate: `SessionExitSignal` exception)
- Long-running commands (e.g., `ops run`) block the REPL (mitigate: documented behavior, Ctrl+C support)
- Memory leaks from repeatedly creating Commander instances (mitigate: GC handles short-lived objects)

---

## Implementation Plan

| Task | Hours | Sprint |
|------|-------|--------|
| Shell command skeleton + REPL | 4h | 73 |
| Command dispatcher + exitOverride | 4h | 73 |
| Session commands (/exit, /clear, etc.) | 2h | 73 |
| Token parser (quoted strings) | 1h | 73 |
| Banner + prompt customization | 1h | 73 |
| Graceful shutdown (Ctrl+C, SIGTERM) | 2h | 73 |
| Unit tests (15) | 2h | 73 |
| E2E manual testing | 2h | 73 |
| **Total** | **18h** | **73** |

---

## References

- [TS-011: CLI Session Mode](../14-Technical-Specs/TS-011-CLI-Session-Mode.md)
- [ADR-006: CLI Architecture](./ADR-006-CLI-Architecture.md) (not yet created)
- Node.js readline API: https://nodejs.org/api/readline.html
- Commander.js exitOverride: https://github.com/tj/commander.js#override-exit-and-output-handling

---

*SDLC Framework v6.4.0 - Stage 02: Design*
