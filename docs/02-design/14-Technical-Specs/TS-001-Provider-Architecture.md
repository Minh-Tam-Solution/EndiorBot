# Technical Specification: Provider Architecture

**ID:** TS-001
**Status:** IMPLEMENTED
**Date:** 2026-02-22
**Related ADR:** ADR-001 (Multi-Model Orchestrator)
**SDLC Stage:** 02-DESIGN

---

## Overview

The Provider module abstracts AI model APIs (Anthropic, OpenAI, Google, Mistral) behind a unified interface, enabling multi-model orchestration.

---

## Architecture

```
src/providers/
├── index.ts                 # Re-exports
├── types.ts                 # Provider types
├── provider-registry.ts     # Provider registration
├── base-provider.ts         # Abstract base class
├── init.ts                  # Provider initialization from env
├── anthropic/
│   ├── index.ts
│   └── anthropic-provider.ts
├── openai/
│   ├── index.ts
│   └── openai-provider.ts
├── gemini/
│   ├── index.ts
│   └── gemini-provider.ts
├── kimi-api/
│   ├── index.ts             # Moonshot direct API (OpenAI-compatible)
│   └── subprocess-orchestrator.ts
├── kimi-proxy/
│   ├── index.ts             # Local claude-code-proxy (Anthropic-compatible)
│   └── subprocess-orchestrator.ts
├── ollama/
│   ├── index.ts
│   └── ollama-provider.ts
└── claude-code/
    ├── index.ts
    └── claude-code-provider.ts
```

---

## Core Interfaces

### Provider Interface

```typescript
interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly models: ModelDefinition[];

  // Lifecycle
  initialize(config: ProviderConfig): Promise<void>;
  dispose(): Promise<void>;

  // Core operations
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<ChatChunk>;

  // Health
  healthCheck(): Promise<ProviderHealth>;
}

interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

interface ModelDefinition {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportedFeatures: ModelFeature[];
}

type ModelFeature = 'chat' | 'vision' | 'tools' | 'streaming';
```

### Chat Request/Response

```typescript
interface ChatRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  stream?: boolean;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

interface ContentPart {
  type: 'text' | 'image';
  text?: string;
  imageUrl?: string;
}

interface ChatResponse {
  id: string;
  model: string;
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  finishReason: FinishReason;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

type FinishReason = 'stop' | 'length' | 'tool_calls' | 'error';
```

---

## Provider Registry

```typescript
class ProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();

  register(provider: AIProvider): void;
  unregister(providerId: string): void;
  get(providerId: string): AIProvider | undefined;
  list(): AIProvider[];

  // Convenience
  getDefault(): AIProvider;
  setDefault(providerId: string): void;
}

// Usage
const registry = new ProviderRegistry();
registry.register(new AnthropicProvider(config));
registry.register(new OpenAIProvider(config));

const claude = registry.get('anthropic');
const response = await claude.chat({ model: 'claude-opus-4', messages });
```

---

## Provider Implementations

### Anthropic Provider

```typescript
class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  readonly models: ModelDefinition[] = [
    { id: 'claude-opus-4', name: 'Claude Opus 4', contextWindow: 200000, ... },
    { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', contextWindow: 200000, ... },
    { id: 'claude-haiku-4', name: 'Claude Haiku 4', contextWindow: 200000, ... },
  ];

  private client: Anthropic;

  async initialize(config: ProviderConfig): Promise<void> {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.messages.create({
      model: request.model,
      messages: this.convertMessages(request.messages),
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
    });
    return this.convertResponse(response);
  }
}
```

### OpenAI Provider

```typescript
class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly models: ModelDefinition[] = [
    { id: 'gpt-5', name: 'GPT-5', contextWindow: 128000, ... },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000, ... },
  ];

  private client: OpenAI;

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: this.convertMessages(request.messages),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    });
    return this.convertResponse(response);
  }
}
```

---

## Error Handling

```typescript
class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly code: ProviderErrorCode,
    public readonly retryable: boolean,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

type ProviderErrorCode =
  | 'AUTH_ERROR'        // Invalid API key
  | 'RATE_LIMIT'        // Rate limited
  | 'CONTEXT_LENGTH'    // Input too long
  | 'TIMEOUT'           // Request timeout
  | 'NETWORK'           // Network error
  | 'INVALID_REQUEST'   // Bad request
  | 'SERVICE_ERROR'     // Provider service error
  | 'UNKNOWN';          // Unknown error
```

---

## Configuration

```yaml
# ~/.endiorbot/providers.yaml
providers:
  anthropic:
    enabled: true
    apiKey: ${ANTHROPIC_API_KEY}
    defaultModel: claude-opus-4
    timeout: 30000
    maxRetries: 3

  openai:
    enabled: true
    apiKey: ${OPENAI_API_KEY}
    defaultModel: gpt-5
    timeout: 30000

  kimi-api:
    enabled: true
    apiKey: ${KIMI_API_KEY}
    defaultModel: kimi-k2-6
    baseUrl: https://api.moonshot.cn/v1

  mistral:
    enabled: false
    apiKey: ${MISTRAL_API_KEY}
```

---

## Migration from MTS-OpenClaw

| MTS-OpenClaw File | EndiorBot Target | Changes |
|---------------|------------------|---------|
| src/providers/index.ts | src/providers/index.ts | Namespace updates |
| src/providers/anthropic.ts | src/providers/anthropic/anthropic-provider.ts | Modularize |
| src/providers/openai.ts | src/providers/openai/openai-provider.ts | Modularize |

---

## Testing Requirements

| Test Type | Coverage Target |
|-----------|-----------------|
| Unit tests | > 80% |
| Integration tests | Each provider |
| Mock tests | API responses |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @anthropic-ai/sdk | ^0.39 | Anthropic API |
| openai | ^4.80 | OpenAI API |
| @google/generative-ai | ^0.24 | Gemini API (legacy, not in fallback chain) |
| openai | ^4.80 | Moonshot Kimi API (OpenAI-compatible) |
| @mistralai/mistralai | ^1.3 | Mistral API |

---

*SDLC Framework v6.4.0 - Stage 02: Design*
