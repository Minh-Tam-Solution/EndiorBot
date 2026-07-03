# TS-012 — CLI Command Parity Fix

**Sprint:** 146
**Owner:** @pm (design) → @coder (implementation)
**Authority:** PM Audit 2026-05-04 — 5 commands exist in dispatcher but missing CLI wiring
**Status:** DESIGN APPROVED — awaiting @coder handoff
**Identity check:** Solo Developer Power Tool (LOCKED) — thin-client invariant preserved
**Framework:** SDLC 6.4.0

---

## 0. Problem Statement

The unified command dispatcher (`src/commands/index.ts`) routes all registered commands to OTT (Telegram/Zalo) and Web API automatically via `GatewayIngress`. However, CLI commands require **manual registration** in `src/cli/commands/register-all.ts`. This decoupled architecture has caused 5 commands to be available on OTT/Web but **not on CLI**.

**Impact:** CEO had to manually edit `~/.endiorbot/repos.json` instead of using `endiorbot repos add` from terminal.

---

## 1. Gap Analysis

| # | Command | Dispatcher Handler | CLI File | Gap |
|---|---------|-------------------|----------|-----|
| 1 | `repos` | `remote-handlers.ts:141` — `handleReposCommand(args)` | MISSING | No CLI subcommand |
| 2 | `approve` | `index.ts:261` — inline (withLinkedActor) | MISSING | No CLI subcommand |
| 3 | `reject` | `index.ts:295` — inline (withLinkedActor) | MISSING | No CLI subcommand |
| 4 | `audit` | `audit-commands.ts:110` — `handleAuditCommand(args)` | MISSING | No CLI subcommand |
| 5 | `webhooks` | `webhook-commands.ts:20` — `handleWebhookOttCommand(args)` | MISSING | No CLI subcommand |

---

## 2. Design Approach

### 2.1 Pattern: Thin CLI Wrapper → Existing Handler

Each new CLI file follows the established pattern (see `exec-policy.ts`, `config.ts`):

```
src/cli/commands/<name>.ts
  → registerXxxCommand(program: Command): void
  → Calls existing handler from src/commands/handlers/
  → Prints result.response to stdout
  → Exits with code 0 (success) or 1 (failure)
```

### 2.2 No new business logic

All 5 handlers already exist and are tested via OTT. CLI wrappers are **pure plumbing** — parse Commander args → call handler → print response.

---

## 3. Implementation Spec

### 3.1 `src/cli/commands/repos.ts`

```
endiorbot repos              # list all registered repos
endiorbot repos add <name> <path>   # register a new repo
endiorbot repos remove <name>       # unregister a repo
```

- Calls `handleReposCommand(args: string[])` from `src/commands/remote-handlers.ts`
- Export: `registerReposCommand(program: Command): void`

### 3.2 `src/cli/commands/approve.ts`

```
endiorbot approve <approval-id>
```

- Calls into `getApprovalQueue()` directly (same logic as dispatcher inline handler)
- Note: `withLinkedActor` wrapper not needed for CLI — CLI user is implicitly the actor
- Export: `registerApproveCommand(program: Command): void`

### 3.3 `src/cli/commands/reject.ts`

```
endiorbot reject <approval-id>
```

- Same pattern as approve, marks request as rejected
- Export: `registerRejectCommand(program: Command): void`

### 3.4 `src/cli/commands/audit.ts`

```
endiorbot audit                          # show subcommand help
endiorbot audit permissions [--limit N]  # permission decisions
endiorbot audit exec-policy [--limit N]  # exec-policy allow/deny
endiorbot audit ssrf [--limit N]         # SSRF blocks
endiorbot audit webhooks [--limit N]     # webhook dispatch events
```

- Calls `handleAuditCommand(args: string[])` from `src/commands/handlers/audit-commands.ts`
- Export: `registerAuditCommand(program: Command): void`

### 3.5 `src/cli/commands/webhooks.ts`

```
endiorbot webhooks list    # show registered triggers
endiorbot webhooks test    # how to test a trigger
```

- Calls `handleWebhookOttCommand(args: string[])` from `src/commands/handlers/webhook-commands.ts`
- Export: `registerWebhooksCommand(program: Command): void`

---

## 4. Wiring Changes

### 4.1 `src/cli/commands/index.ts` — Add exports

```typescript
export { registerReposCommand } from "./repos.js";
export { registerApproveCommand } from "./approve.js";
export { registerRejectCommand } from "./reject.js";
export { registerAuditCommand } from "./audit.js";
export { registerWebhooksCommand } from "./webhooks.js";
```

### 4.2 `src/cli/commands/register-all.ts` — Add registrations

```typescript
import {
  // ...existing imports...
  registerReposCommand,
  registerApproveCommand,
  registerRejectCommand,
  registerAuditCommand,
  registerWebhooksCommand,
} from "./index.js";

export function registerAllCommands(program: Command): void {
  // ...existing registrations...
  registerReposCommand(program);
  registerApproveCommand(program);
  registerRejectCommand(program);
  registerAuditCommand(program);
  registerWebhooksCommand(program);
}
```

---

## 5. Structural Prevention (Future Sprint)

To prevent drift, add a test that verifies dispatcher-registered commands are a subset of CLI registrations:

```typescript
// tests/cli/command-parity.test.ts
it("all dispatcher commands have CLI wiring", () => {
  const dispatcherCommands = getDispatcherCommandNames(); // from catalog
  const cliCommands = getCLICommandNames(); // from register-all
  const missing = dispatcherCommands.filter(c => !cliCommands.includes(c));
  expect(missing).toEqual([]);
});
```

**Deferred to future sprint** — not blocking this fix.

---

## 6. Acceptance Criteria

- [ ] `endiorbot repos` / `endiorbot repos add zpix /path` works from CLI
- [ ] `endiorbot approve <id>` works from CLI
- [ ] `endiorbot reject <id>` works from CLI
- [ ] `endiorbot audit exec-policy --limit 5` works from CLI
- [ ] `endiorbot webhooks list` works from CLI
- [ ] `pnpm build` passes with no type errors
- [ ] `pnpm test` passes (no regressions)

---

## 7. Decision Log

| # | Decision | Alternatives | Why |
|---|----------|-------------|-----|
| D1 | Thin wrapper pattern (no new logic) | Refactor dispatcher to auto-generate CLI | YAGNI — 5 files is small; auto-gen adds complexity for 37 commands |
| D2 | approve/reject: CLI user = implicit actor | Require --actor flag | Solo dev tool — one user, no ambiguity |
| D3 | Separate repos.ts (not merged into bridge.ts) | Add as subcommand of bridge | `repos` is a top-level catalog command, not bridge-specific |
| D4 | Parity test deferred | Include in this sprint | Keep scope small — fix gaps first, prevent later |

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| approve/reject without linked actor breaks approval flow | Low | Medium | CLI actor defaults to "cli-user"; approval queue is local |
| Webhook commands show "use curl" (no running server) | Expected | Low | Same behavior as current OTT handler — informational only |

---

*Estimated effort: 1-2 hours implementation + build verification*
