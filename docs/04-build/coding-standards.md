# Coding Standards

EndiorBot TypeScript coding standards and policies.

**Date**: 2026-02-22
**Status**: ACTIVE - Sprint 34 (content current as of Sprint 144)
**Authority**: ADR-001, ADR-002

---

## Console Output Policy

### Rule
- **Non-CLI modules**: Use structured logging via `Logger` class
- **CLI modules**: May use `console.log` for user-facing output

### Rationale
CLI commands produce terminal output that users read directly. Using `console.log` is intentional and appropriate for:
- Command output (tables, status messages, prompts)
- Error messages with formatting (colors, emojis)
- Interactive prompts

### ESLint Configuration
```javascript
// eslint.config.js - CLI override
{
  files: ['src/cli/**/*.ts'],
  rules: {
    'no-console': 'off',  // CLI uses console for user output
  },
}
```

### Where to Use What

| Module | Output Method | Example |
|--------|--------------|---------|
| `src/cli/commands/*` | `console.log` | User-facing messages |
| `src/cli/logger.ts` | `Logger` | Structured debug/info |
| `src/providers/*` | `Logger` | API interactions |
| `src/logging/*` | `Logger` | Self-documentation |
| `src/sdlc/*` | `Logger` | Gate evaluations |
| `src/agents/*` | `Logger` | Agent operations |

---

## Logging Standards

### Standard Fields (ADR-001/ADR-002)

Every log entry should include standard fields for tracing:

```typescript
interface StandardLogFields {
  correlationId?: string;  // Request tracing across multi-model calls
  sessionId?: string;      // Project session tracking
  projectId?: string;      // Multi-project context switching
}
```

### Propagation Path

Standard fields flow through the system:

```
CLI Command
    │
    ├── logger.withCorrelation(uuid)
    │
    ▼
Session Manager
    │
    ├── logger.withSession(sessionId)
    │
    ▼
Provider (Anthropic/OpenAI)
    │
    ├── logger.withProject(projectId)
    │
    ▼
Gate Engine
    │
    └── All fields preserved in child loggers
```

### End-to-End Example

```typescript
import { createLogger, type Logger } from "../logging/index.js";
import { v4 as uuid } from "uuid";

// 1. CLI entry point - create correlation ID
const correlationId = uuid();
const baseLogger = createLogger("cli")
  .withCorrelation(correlationId);

baseLogger.info("Starting consultation", { query: "design payment gateway" });

// 2. Session layer - add session context
async function handleSession(logger: Logger, sessionId: string) {
  const sessionLogger = logger.withSession(sessionId);
  sessionLogger.debug("Session active", { models: ["claude", "gpt"] });

  // 3. Provider calls - add project context
  await queryProviders(sessionLogger, "bflow-001");
}

// 4. Provider layer - project-specific logging
async function queryProviders(logger: Logger, projectId: string) {
  const providerLogger = logger.withProject(projectId);

  providerLogger.info("Querying Claude", { model: "claude-opus-4" });
  // ... API call ...

  providerLogger.info("Querying GPT", { model: "gpt-5" });
  // ... API call ...
}

// 5. Gate engine - all context preserved
function evaluateGate(logger: Logger, gateId: string) {
  // Child loggers preserve all standard fields
  const gateLogger = logger.child({ gate: gateId });
  gateLogger.info("Evaluating gate checklist");
  // correlationId, sessionId, projectId all present
}
```

### JSON Output Example

```json
{
  "timestamp": "2026-02-22T10:30:00.000Z",
  "level": "info",
  "logger": "provider",
  "message": "Chat completed",
  "correlationId": "abc-123-def",
  "sessionId": "sess-456",
  "projectId": "bflow-001",
  "context": {
    "model": "claude-opus-4",
    "durationMs": 1250,
    "usage": { "inputTokens": 500, "outputTokens": 200 }
  }
}
```

---

## TypeScript Strict Mode

### exactOptionalPropertyTypes

We use `exactOptionalPropertyTypes: true` in tsconfig.json. This means:

```typescript
// ❌ WRONG - undefined not assignable to optional string
const options: LoggerOptions = {
  name: "test",
  correlationId: this.correlationId,  // Error if undefined
};

// ✅ CORRECT - conditionally add property
const options: LoggerOptions = { name: "test" };
if (this.correlationId !== undefined) {
  options.correlationId = this.correlationId;
}
```

### Import Style

Use consistent type imports:

```typescript
// ✅ Separate type imports
import type { Logger, LogLevel } from "../logging/index.js";
import { createLogger } from "../logging/index.js";

// ✅ Combined with inline type
import { createLogger, type Logger } from "../logging/index.js";
```

---

## Error Handling

Use structured errors:

```typescript
class EndiorBotError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EndiorBotError";
  }
}

// Usage
throw new EndiorBotError(
  "GATE_NOT_READY",
  "G2 gate requirements not met",
  { missing: ["ADR", "API spec"] },
);
```

---

## Security

### Sensitive Data

Never log sensitive data. The logging module auto-redacts:

```typescript
// Input
logger.info("Provider config", {
  provider: "anthropic",
  apiKey: "sk-ant-secret123",  // Sensitive!
});

// Output (redacted)
{
  "provider": "anthropic",
  "apiKey": "[REDACTED]"
}
```

### Patterns Redacted
- API keys: `sk-*`, `pk-*`, `api-*`
- JWT tokens: `eyJ*`
- Auth headers: `Authorization`, `x-api-key`
- Credentials: `password`, `secret`, `token`

See `src/logging/redaction.ts` for full pattern list.

---

*SDLC Framework v6.4.0*
*Sprint 34 Day 7-8*
