/**
 * Anthropic Provider
 *
 * Implementation of AIProvider for Anthropic Claude models.
 * Uses @anthropic-ai/sdk for API communication.
 */

import { BaseProvider } from "../base-provider.js";
import type {
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ModelDefinition,
  ProviderConfig,
  ProviderHealth,
} from "../types.js";
import { ProviderError, type ProviderErrorCode } from "../types.js";
import { RateLimiter } from "../../security/rate-limiter.js";
import { safeFetch } from "../../security/safe-fetch.js";
import {
  SONNET, OPUS, HAIKU, FABLE,
  KIMI_K2_6_PROXY, KIMI_FOR_CODING,
  LEGACY_SONNET, LEGACY_OPUS, LEGACY_SONNET_35, LEGACY_HAIKU_3,
} from "../../config/models.js";

// Anthropic API response types
interface AnthropicResponse {
  id: string;
  model: string;
  content: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason?: string;
}

const CHAT_FEATURES: ModelDefinition["supportedFeatures"] = ["chat", "vision", "tools", "streaming"];

// Anthropic model definitions — all IDs imported from config/models SSOT
const ANTHROPIC_MODELS: ModelDefinition[] = [
  // Claude 5 family
  {
    id: SONNET,
    name: "Claude Sonnet 5",
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportedFeatures: CHAT_FEATURES,
  },
  {
    id: HAIKU,
    name: "Claude 4.5 Haiku",
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportedFeatures: CHAT_FEATURES,
  },
  {
    id: OPUS,
    name: "Claude Opus 5",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    supportedFeatures: CHAT_FEATURES,
  },
  {
    id: FABLE,
    name: "Claude Fable 5",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    supportedFeatures: CHAT_FEATURES,
  },
  // Legacy models (backward compat for persisted sessions/checkpoints)
  {
    id: LEGACY_SONNET,
    name: "Claude 4.5 Sonnet (legacy)",
    contextWindow: 200_000,
    maxOutputTokens: 16384,
    supportedFeatures: CHAT_FEATURES,
  },
  {
    id: LEGACY_OPUS,
    name: "Claude 4.5 Opus (legacy)",
    contextWindow: 200_000,
    maxOutputTokens: 16384,
    supportedFeatures: CHAT_FEATURES,
  },
  {
    id: LEGACY_SONNET_35,
    name: "Claude 3.5 Sonnet (legacy)",
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportedFeatures: CHAT_FEATURES,
  },
  {
    id: LEGACY_HAIKU_3,
    name: "Claude 3 Haiku (legacy)",
    contextWindow: 200_000,
    maxOutputTokens: 4096,
    supportedFeatures: CHAT_FEATURES,
  },
  // Passthrough models — kimi-coding (ADR-053) proxy routes these to Kimi
  {
    id: KIMI_K2_6_PROXY,
    name: "Kimi K2.6 (via proxy)",
    contextWindow: 256_000,
    maxOutputTokens: 16384,
    supportedFeatures: CHAT_FEATURES,
  },
  {
    id: KIMI_FOR_CODING,
    name: "Kimi for Coding (via proxy)",
    contextWindow: 256_000,
    maxOutputTokens: 16384,
    supportedFeatures: CHAT_FEATURES,
  },
];

/** Default rate limit for Anthropic API (50 req/min for most tiers) */
const DEFAULT_RATE_LIMIT = 50;

export class AnthropicProvider extends BaseProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic";
  readonly models = ANTHROPIC_MODELS;

  private _apiKey: string | undefined;
  private _baseUrl: string | undefined;
  private timeout: number = 30000;
  private rateLimiter: RateLimiter;

  constructor(maxRequestsPerMinute: number = DEFAULT_RATE_LIMIT) {
    super();
    // Rate limiter: configurable req/min (default 50)
    this.rateLimiter = new RateLimiter(60_000, maxRequestsPerMinute);
  }

  /** Get API key (throws if not initialized) */
  private get apiKey(): string {
    if (!this._apiKey) {
      throw new ProviderError("Provider not initialized", this.id, "AUTH_ERROR", false);
    }
    return this._apiKey;
  }

  /** Get base URL (throws if not initialized) */
  private get baseUrl(): string {
    if (!this._baseUrl) {
      throw new ProviderError("Provider not initialized", this.id, "AUTH_ERROR", false);
    }
    return this._baseUrl;
  }

  protected async doInitialize(config: ProviderConfig): Promise<void> {
    if (!config.apiKey) {
      throw new ProviderError(
        "API key is required",
        this.id,
        "AUTH_ERROR",
        false,
      );
    }
    this._apiKey = config.apiKey;
    this._baseUrl = config.baseUrl ?? "https://api.anthropic.com";
    this.timeout = config.timeout ?? 30000;
  }

  protected async doDispose(): Promise<void> {
    this._apiKey = undefined;
    this._baseUrl = undefined;
    this.rateLimiter.clear();
  }

  protected async doChat(request: ChatRequest): Promise<ChatResponse> {
    this.checkRateLimit();
    this.validateModel(request.model);

    // Convert messages to Anthropic format
    const systemMessage = request.messages.find((m) => m.role === "system");
    const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

    const anthropicMessages = nonSystemMessages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: typeof msg.content === "string" ? msg.content : this.formatContent(msg.content),
    }));

    // ADR-040: Build structured system blocks with cache_control for prompt caching
    let systemParam: string | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> | undefined;
    if (systemMessage) {
      const content = systemMessage.content;
      if (Array.isArray(content) && content.length > 0 && typeof content[0] === "object" && "type" in content[0] && content[0].type === "text") {
        // Already structured SystemBlock[] — pass through with cache_control
        systemParam = (content as Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>);
      } else {
        // Flat string — wrap in single block (backward compatible, no caching)
        systemParam = this.extractTextContent(content);
      }
    }

    const body = {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      // Sprint 143: explicit stream:false prevents Kimi proxy from returning SSE.
      // Without this, proxy defaults to streaming → response.json() fails with
      // "Unexpected token 'e', 'event: mes...' is not valid JSON".
      stream: false,
      system: systemParam,
      messages: anthropicMessages,
    };

    const response = await this.makeRequest<AnthropicResponse>("/v1/messages", body);

    return {
      id: response.id,
      model: response.model,
      content: this.extractResponseContent(response.content),
      usage: {
        promptTokens: response.usage?.input_tokens ?? 0,
        completionTokens: response.usage?.output_tokens ?? 0,
        totalTokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      },
      finishReason: this.mapStopReason(response.stop_reason),
    };
  }

  protected async *doChatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    this.checkRateLimit();
    this.validateModel(request.model);

    const systemMessage = request.messages.find((m) => m.role === "system");
    const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

    const anthropicMessages = nonSystemMessages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: typeof msg.content === "string" ? msg.content : this.formatContent(msg.content),
    }));

    // ADR-040: Structured system blocks (same as doChat)
    let streamSystemParam: string | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> | undefined;
    if (systemMessage) {
      const content = systemMessage.content;
      if (Array.isArray(content) && content.length > 0 && typeof content[0] === "object" && "type" in content[0] && content[0].type === "text") {
        streamSystemParam = (content as Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>);
      } else {
        streamSystemParam = this.extractTextContent(content);
      }
    }

    const body = {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      system: streamSystemParam,
      messages: anthropicMessages,
      stream: true,
    };

    const response = await safeFetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    }, { provider: this.id });

    if (!response.ok || !response.body) {
      throw await this.handleErrorResponse(response);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            if (event.type === "content_block_delta" && event.delta?.text) {
              yield {
                id: event.message?.id ?? "",
                model: request.model,
                delta: event.delta.text,
              };
            } else if (event.type === "message_stop") {
              yield {
                id: event.message?.id ?? "",
                model: request.model,
                delta: "",
                finishReason: "stop",
              };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  }

  protected async doHealthCheck(): Promise<ProviderHealth> {
    const start = Date.now();

    try {
      // Simple API check - we just verify auth works
      const response = await safeFetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: HAIKU,
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(5000),
      }, { provider: this.id });

      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { status: "healthy", latencyMs };
      }

      if (response.status === 429) {
        return { status: "degraded", latencyMs, message: "Rate limited" };
      }

      return { status: "unhealthy", latencyMs, message: `HTTP ${response.status}` };
    } catch (error) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async makeRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // ADR-040: Add prompt caching beta header when system has structured blocks
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    };
    if (Array.isArray(body.system) && (body.system as Array<Record<string, unknown>>).some(b => b.cache_control)) {
      headers["anthropic-beta"] = "prompt-caching-2024-07-31";
    }

    try {
      const response = await safeFetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      }, { provider: this.id });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderError(
          "Request timeout",
          this.id,
          "TIMEOUT",
          true,
          error,
        );
      }

      throw new ProviderError(
        error instanceof Error ? error.message : "Unknown error",
        this.id,
        "NETWORK",
        true,
        error instanceof Error ? error : undefined,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async handleErrorResponse(response: Response): Promise<ProviderError> {
    let message = `HTTP ${response.status}`;
    let code: ProviderErrorCode = "SERVICE_ERROR";
    let retryable = false;

    try {
      const body = await response.json() as { error?: { message?: string } };
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // Use default message
    }

    switch (response.status) {
      case 401:
        code = "AUTH_ERROR";
        break;
      case 429:
        code = "RATE_LIMIT";
        retryable = true;
        break;
      case 400:
        code = "INVALID_REQUEST";
        break;
      case 500:
      case 502:
      case 503:
        code = "SERVICE_ERROR";
        retryable = true;
        break;
    }

    return new ProviderError(message, this.id, code, retryable);
  }

  private formatContent(content: { type: string; text?: string; imageUrl?: string }[]): string {
    return content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n");
  }

  private extractTextContent(content: string | { type: string; text?: string }[]): string {
    if (typeof content === "string") return content;
    return this.formatContent(content);
  }

  private extractResponseContent(content: unknown[]): string {
    if (!Array.isArray(content)) return "";
    return content
      .filter((c): c is { type: string; text: string } =>
        typeof c === "object" && c !== null && "type" in c && "text" in c && (c as Record<string, unknown>).type === "text"
      )
      .map((c) => c.text)
      .join("");
  }

  private mapStopReason(reason: string | undefined): ChatResponse["finishReason"] {
    switch (reason) {
      case "end_turn":
      case "stop_sequence":
        return "stop";
      case "max_tokens":
        return "length";
      case "tool_use":
        return "tool_calls";
      default:
        return "stop";
    }
  }

  /**
   * Check rate limit and throw if exceeded.
   */
  private checkRateLimit(): void {
    const result = this.rateLimiter.check(this.id);
    if (!result.allowed) {
      throw new ProviderError(
        `Rate limit exceeded. Reset in ${Math.ceil(result.resetIn / 1000)}s`,
        this.id,
        "RATE_LIMIT",
        true
      );
    }
  }
}
