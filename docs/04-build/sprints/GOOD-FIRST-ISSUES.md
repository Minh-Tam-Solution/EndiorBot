# Good First Issues — Pre-Launch Seed

> Create these 10+ issues on GitHub before launch day. Label: `good first issue`.
> Purpose: give new contributors a clear entry point on day 1.

---

## Documentation Issues (easiest — no code required)

### 1. Add screenshots to README
**Title:** `docs: add screenshots/GIFs of Desktop app and Telegram bot to README`
**Labels:** `good first issue`, `documentation`
**Body:**
The README has no visual preview. Add:
- Screenshot of Desktop app (Dashboard page)
- GIF of Telegram @agent interaction
- Screenshot of Web UI chat

### 2. Translate Usage Guide to Vietnamese
**Title:** `docs: translate Usage Guide (USAGE-GUIDE.md) to Vietnamese`
**Labels:** `good first issue`, `documentation`, `i18n`
**Body:**
The Usage Guide at `docs/07-operate/USAGE-GUIDE.md` is English-only. Create `USAGE-GUIDE.vi.md` with Vietnamese translation. The 20 workflow sections are the priority.

### 3. Add JSDoc to public API functions
**Title:** `docs: add JSDoc comments to exported functions in src/commands/index.ts`
**Labels:** `good first issue`, `documentation`
**Body:**
`src/commands/index.ts` exports `createCommandDispatcher()` with 39 registered commands. Several handler functions lack JSDoc descriptions. Add `@description`, `@param`, `@returns` to each.

---

## Code Quality (small, well-defined)

### 4. Replace console.log in OTT adapters with structured logger
**Title:** `fix: replace console.log with structured logger in OTT adapters`
**Labels:** `good first issue`, `code quality`
**Body:**
CSO audit found `console.log` calls in:
- `src/channels/zalo/zalo-ott-adapter.ts` (3 occurrences)
- `src/channels/telegram/telegram-ott-adapter.ts` (2 occurrences)

Replace with the project's structured logger (see `src/logging/` for pattern). This ensures output passes through the redaction pipeline.

### 5. Add missing env var to .env.example
**Title:** `fix: add ENDIORBOT_GATEWAY_PORT to .env.example`
**Labels:** `good first issue`, `configuration`
**Body:**
The env var `ENDIORBOT_GATEWAY_PORT` (default: 18790) is documented in the Usage Guide but missing from `.env.example`. Add it with a comment explaining the default and when to change it.

### 6. Standardize ADR status vocabulary
**Title:** `refactor: standardize ADR status field across 51 ADRs`
**Labels:** `good first issue`, `documentation`
**Body:**
ADRs use inconsistent status strings: `Approved`, `Accepted`, `ACCEPTED`, `IMPLEMENTED`, `Proposed`, `PROPOSED`. Standardize to: `PROPOSED`, `ACCEPTED`, `DEFERRED`, `SUPERSEDED`, `AMENDED`. See `docs/02-design/01-ADRs/` (51 files).

---

## Feature Requests (small scope)

### 7. Add /version command to CommandDispatcher
**Title:** `feat: add /version command returning EndiorBot version`
**Labels:** `good first issue`, `enhancement`
**Body:**
Add a `/version` command to `src/commands/index.ts` that returns the current EndiorBot version from `package.json`. Should work across all 5 channels.

### 8. Show provider health in /status command
**Title:** `feat: add provider health (circuit breaker state) to /status output`
**Labels:** `good first issue`, `enhancement`
**Body:**
The `/status` command shows basic info. Enhance it to show circuit breaker state for each provider:
- Claude Code: CLOSED/OPEN/HALF_OPEN
- Kimi: CLOSED/OPEN/HALF_OPEN

Use `getCircuitStatus()` from `src/agents/router/provider-circuit-breaker.ts`.

### 9. Desktop: Add repo count to sidebar
**Title:** `feat(desktop): show registered project count in sidebar`
**Labels:** `good first issue`, `desktop`, `enhancement`
**Body:**
The Desktop sidebar shows nav items but no contextual info. Add a small badge next to "Projects" showing the count from `repos:list` IPC call.

### 10. Add Zalo OA token refresh reminder
**Title:** `feat: warn when Zalo OA token is near expiry`
**Labels:** `good first issue`, `enhancement`, `zalo`
**Body:**
Zalo OA access tokens expire after a set period. Add a startup warning in `src/channels/zalo/zalo-config.ts` if the token was registered more than 30 days ago (based on config file timestamp).

---

## Bonus (if >10 needed)

### 11. Add `--json` flag to `/gate status` command
**Title:** `feat: add --json output flag to gate status command`
**Labels:** `good first issue`, `enhancement`

### 12. Desktop: keyboard shortcut for switching pages
**Title:** `feat(desktop): add Cmd+1..7 keyboard shortcuts for page navigation`
**Labels:** `good first issue`, `desktop`, `enhancement`

---

*Create these issues on GitHub before 29/4 launch. CEO can batch-create or delegate to @pm.*
