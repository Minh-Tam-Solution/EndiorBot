---
status: ACCEPTED
authority:
  proposer: "@architect"
  countersigners:
    - actor: "@cto"
      date: "2026-02-23"
      grade: "retroactive"
      reference: "sprint-43-desktop-foundation"
  trigger: "Desktop app needs structured, secure communication with EndiorBot core"
  notes: "Retroactive ADR. Code shipped Sprint 43-144. Two-layer protocol (Electron IPC + WebSocket) documented from running implementation."
sdlc_framework: "6.4.0"
---

# ADR-003: CLI-Desktop Protocol

## Status

ACCEPTED (retroactive — code shipped Sprint 43-144)

## Context

EndiorBot ships a cross-platform Electron desktop app (`apps/desktop/`) that gives developers a native GUI over EndiorBot core. The app must:

1. **Manage the gateway subprocess** — start/stop `endiorbot.mjs serve` and relay its lifecycle events to the renderer
2. **Read/write local state** — settings (`~/.endiorbot/config.json`), repos list (`~/.endiorbot/repos.json`), SDLC gate results (`.sdlc-config.json`)
3. **Expose core objects** — `SessionManager`, `BudgetTracker`, `CheckpointState`, `GatewayServer`, `PersistentFixLogger`
4. **Stream real-time events** — gateway status changes, connection health, model output

Electron's architecture separates a privileged **main process** (Node.js, full OS access) from a sandboxed **renderer process** (browser). Without a defined protocol, the renderer cannot safely touch the filesystem or spawn subprocesses.

An additional constraint: the EndiorBot core library (`endiorbot`) is a Node.js ESM package that must be imported in the main process — it cannot run inside a browser sandbox.

## Decision

### Two-Layer Protocol

Communication between desktop components uses two independent layers:

```
Renderer (React UI)
    │
    ├─── IPC (Electron ipcRenderer) ──────────────────► Main Process
    │                                                        │
    │                                                        ├─ Core modules (lazy import)
    │                                                        ├─ File system R/W
    │                                                        └─ Subprocess management
    │
    └─── WebSocket ws://127.0.0.1:{port}/ws ──────────► Gateway subprocess
                                                            │
                                                            └─ endiorbot.mjs serve
                                                               (--no-telegram --no-zalo)
```

**Layer 1 — IPC**: Electron `ipcMain.handle` / `ipcRenderer.invoke` for synchronous-style RPC between renderer and main process. Used for settings, session state, checkpoint management, and gateway lifecycle control.

**Layer 2 — WebSocket**: Direct `WebSocket` from renderer to `ws://127.0.0.1:{port}/ws` for real-time chat and streaming output. Port defaults to `18790` (configurable via `ENDIORBOT_GATEWAY_PORT` or the `gatewayPort` setting).

### IPC Channel Naming Convention

All channels follow `module:action` format:

```
{module}:{verb}[Noun]
```

Examples: `settings:getAll`, `gateway:start`, `checkpoints:list`

### Gateway Subprocess Lifecycle

The main process spawns the gateway as a detached-false child process:

```
node endiorbot.mjs serve --no-telegram --no-zalo
```

Environment: a sanitized copy of `process.env` with `ELECTRON_RUN_AS_NODE` and `ELECTRON_NO_ASAR` removed, plus `ENDIORBOT_GATEWAY_PORT` injected. This prevents the child from accidentally behaving as an Electron process.

- **Auto-start**: `autoStartGateway()` runs immediately after `app.whenReady()` resolves, before the window loads. Success is detected either by stdout pattern match (`Gateway`/`listening`/port number) or a 5-second optimistic timeout.
- **Auto-kill**: `stopGateway()` is called in the `before-quit` app event via `SIGTERM`.
- **Status push**: After auto-start succeeds, main sends `gateway:status-changed` to the renderer via `win.webContents.send`.
- **Single instance**: `app.requestSingleInstanceLock()` prevents duplicate gateway processes.

### Security Model (Development Phase)

The renderer runs with:

```typescript
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false,
  sandbox: false,
}
```

This is explicitly temporary for the development sprint. The preload script path is defined but commented out (`// preload: PRELOAD_PATH`). The intent is to tighten to `contextIsolation: true` + preload bridge in a future sprint once the API surface stabilises.

External navigation is blocked: `will-navigate` rejects any URL that is not `file:` or the Vite dev server, handing it to `shell.openExternal` instead.

### Core Module Lazy Loading

The main process lazy-loads the `endiorbot` package via dynamic `import()` to handle build-order race conditions (desktop may be built before the core library). A `null` fallback pattern is used throughout: every IPC handler gracefully degrades when core is unavailable, returning static demo data rather than throwing.

```typescript
async function loadCoreModules(): Promise<typeof coreModules> {
  if (coreModules) return coreModules;
  try {
    const core = await import("endiorbot");
    coreModules = { ... };
    return coreModules;
  } catch {
    return null;  // Graceful degradation
  }
}
```

### Environment Loading

Because the desktop app runs in a separate cwd from the project root, `.env` and `.env.local` are located by walking candidate paths (`cwd`, `cwd/../..`, `__dirname/../../..`, etc.) and loaded with `dotenv.config()` before provider initialisation. This ensures API keys set in the project root `.env` are available to gateway methods started from the desktop.

## IPC Channel Registry

### App Module (`app:*`)
Registered directly in `index.ts`.

| Channel | Direction | Description |
|---------|-----------|-------------|
| `app:quit` | renderer → main | Quit the application |
| `app:relaunch` | renderer → main | Relaunch the application |
| `app:getPath` | renderer → main | Get Electron app path by name |
| `app:version` | renderer → main | Get application version string |
| `app:isDev` | renderer → main | Check if running in dev mode |
| `shell:openExternal` | renderer → main | Open URL in system browser |
| `shell:showItemInFolder` | renderer → main | Reveal file in Finder/Explorer |

### Window Module (`window:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `window:minimize` | renderer → main | Minimize window |
| `window:maximize` | renderer → main | Maximize / restore window |
| `window:close` | renderer → main | Close window |
| `window:isMaximized` | renderer → main | Query maximized state |
| `window:isFullScreen` | renderer → main | Query full-screen state |
| `window:setFullScreen` | renderer → main | Enter / exit full screen |

### Dialog Module (`dialog:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `dialog:open` | renderer → main | Show native open-file dialog |
| `dialog:save` | renderer → main | Show native save-file dialog |
| `dialog:message` | renderer → main | Show native message box |

### Settings Module (`settings:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `settings:get` | renderer → main | Get single setting by key |
| `settings:set` | renderer → main | Set single setting by key |
| `settings:getAll` | renderer → main | Get all settings as object |
| `settings:getApiKeys` | renderer → main | List all API key + config var slots (masked) |
| `settings:setApiKey` | renderer → main | Write key/config var value to `.env` |

API key IDs: `anthropic`, `openai`, `gemini`, `kimi`, `ollama`, `mcp_gateway`, `telegram`, `github`.
Config var IDs: `gateway_port`, `gateway_token`, `webhook_secret`, `kimi_proxy_url`.

### Gateway Module (`gateway:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `gateway:status` | renderer → main | Get current gateway status + stats |
| `gateway:isConnected` | renderer → main | Check if gateway server is running |
| `gateway:start` | renderer → main | Start gateway server (loads env + providers) |
| `gateway:stop` | renderer → main | Stop gateway server |
| `gateway:restart` | renderer → main | Stop then start gateway server |
| `gateway:status-changed` | main → renderer | Push notification when status changes |

### Session Module (`session:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `session:get` | renderer → main | Get active session details |
| `session:list` | renderer → main | List sessions (active session as single item) |

### Budget Module (`budget:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `budget:get` | renderer → main | Get budget status (session + daily + tracks) |

### Checkpoint Module (`checkpoints:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `checkpoints:list` | renderer → main | List checkpoint summaries |
| `checkpoints:restore` | renderer → main | Validate and initiate checkpoint restore |

### Fix Stats Module (`fixStats:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `fixStats:getWeeklySummary` | renderer → main | Get weekly fix analytics from PersistentFixLogger |
| `fixStats:getPatterns` | renderer → main | Get recurring error patterns (min 2 occurrences) |

### Repos Module (`repos:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `repos:list` | renderer → main | List registered repos from `~/.endiorbot/repos.json` |

### Gates Module (`gates:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `gates:status` | renderer → main | Get all gate statuses (core engine or `.sdlc-config.json` fallback) |

### Experts Module (`experts:*`)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `experts:providers` | renderer → main | List AI providers with configuration status and tier |

## WebSocket Layer (Renderer → Gateway)

The renderer's `gateway.safe.ts` store maintains a WebSocket to `ws://127.0.0.1:{port}/ws`:

- **Connection states**: `offline` → `connecting` → `connected` → `error`
- **Reconnect timeout**: 3 seconds before declaring offline
- **Port**: Reads from `useGatewayStore` state, default `18790`, must match `ENDIORBOT_GATEWAY_PORT`
- **Scope**: Real-time chat messages and streaming output only. Settings, session info, and checkpoints go through IPC, not WebSocket.

## Consequences

### Positive

- **Clean separation**: IPC handles structured queries; WebSocket handles streaming — each layer does what it is designed for
- **Graceful degradation**: Every IPC handler has a static fallback, so the UI remains usable while the gateway starts
- **No bundling conflict**: Core library imported by main process only; renderer stays pure browser
- **Subprocess isolation**: Gateway runs as a plain Node.js child process, fully independent of Electron's V8 context

### Negative

- **`nodeIntegration: true` is a security risk**: Any XSS in the renderer has full Node.js access. Accepted as temporary; preload script + context isolation is the planned migration
- **Port conflict**: Default port `18790` can conflict if another process uses it. The settings UI exposes `gatewayPort` to change it, but there is no automatic port scanning
- **Lazy load latency**: First IPC call after cold start incurs `import("endiorbot")` overhead (~200-500ms on first invocation)

### Mitigations

- Preload script path is already defined in code (`PRELOAD_PATH`), ready to enable when context isolation is activated
- Port is configurable via `settings:setApiKey` with key `gateway_port`
- Core module cache (`coreModules` singleton) ensures import cost is paid only once

## Related ADRs

- **ADR-001**: Multi-Model Orchestrator — provides `SessionManager`, `GatewayServer`
- **ADR-006**: Checkpoint State Model — `checkpoints:list` / `checkpoints:restore` IPC channels use `CheckpointState`
- **ADR-029**: Per-Chat Workspace Resolution — `repos:list` IPC reads `repos.json` managed by this ADR
- **ADR-032**: Event Bus Async Command — gateway WebSocket is the transport for async command responses

---

*ADR-003 v1.0.0 — ACCEPTED (retroactive)*
*EndiorBot Desktop Foundation — Sprint 43-144*
*SDLC Framework 6.4.0*
