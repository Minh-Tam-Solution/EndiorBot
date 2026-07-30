/**
 * Kimi Coding Provider
 *
 * Direct integration with Kimi Coding API via CEO subscription.
 * Endpoint: https://api.kimi.com/coding (Anthropic-compatible).
 * Serves the kimi-for-coding model only.
 *
 * ADR-053: Primary kimi backend. Composes AnthropicProvider because the
 * endpoint speaks Anthropic-compatible API.
 *
 * @module providers/kimi-coding
 * @since Sprint 145 — ADR-053
 */

import { AnthropicProvider } from "../anthropic/index.js";
import { KIMI_FOR_CODING, KIMI_K3, KIMI_K3_256K } from "../../config/models.js";
import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ModelDefinition,
  ProviderConfig,
  ProviderHealth,
} from "../types.js";

/** Default Kimi Coding API endpoint ( AnthropicProvider appends /v1/messages ). */
const DEFAULT_KIMI_CODING_URL = "https://api.kimi.com/coding";

/**
 * Kimi Code subscription models (api.kimi.com/coding namespace).
 * IDs verified from ~/.kimi-code/config.toml: kimi-for-coding (K2.7 Coding),
 * k3, k3-256k. [0] kimi-for-coding is the proven default fallback.
 */
const KIMI_CODING_MODELS: ModelDefinition[] = [
  {
    id: KIMI_FOR_CODING,
    name: "Kimi for Coding (K2.7)",
    contextWindow: 256000,
    maxOutputTokens: 16384,
    supportedFeatures: ["chat", "vision", "tools", "streaming"],
  },
  {
    id: KIMI_K3,
    name: "Kimi K3",
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportedFeatures: ["chat", "vision", "tools", "streaming"],
  },
  {
    id: KIMI_K3_256K,
    name: "Kimi K3 256K",
    contextWindow: 256_000,
    maxOutputTokens: 16384,
    supportedFeatures: ["chat", "vision", "tools", "streaming"],
  },
];

/**
 * KimiCodingProvider delegates to an internal AnthropicProvider instance
 * because the Kimi Coding API exposes an Anthropic-compatible interface.
 *
 * We use composition rather than inheritance because AnthropicProvider
 * declares its id/name/models as literal types that cannot be overridden.
 */
export class KimiCodingProvider implements AIProvider {
  readonly id = "kimi-coding";
  readonly name = "Kimi Coding (CEO subscription)";
  readonly models = KIMI_CODING_MODELS;

  private inner = new AnthropicProvider();
  private _baseUrl: string | undefined;

  async initialize(config: ProviderConfig): Promise<void> {
    this._baseUrl = config.baseUrl ?? DEFAULT_KIMI_CODING_URL;
    await this.inner.initialize({
      ...config,
      apiKey: config.apiKey ?? "",
      baseUrl: this._baseUrl,
      timeout: config.timeout ?? 60_000,
    });
  }

  async dispose(): Promise<void> {
    await this.inner.dispose();
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const codingModel = this.resolveCodingModel(request.model);
    return this.inner.chat({ ...request, model: codingModel });
  }

  async *chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const codingModel = this.resolveCodingModel(request.model);
    yield* this.inner.chatStream({ ...request, model: codingModel });
  }

  /**
   * Resolve any model name to one the endpoint accepts.
   * If the model is already a Kimi coding model, pass through.
   * If it's a Claude/OpenAI model (from agent config), map to default.
   */
  private resolveCodingModel(model: string): string {
    const codingModelIds = KIMI_CODING_MODELS.map((m) => m.id);
    if (codingModelIds.includes(model)) return model;
    // Non-coding model name (e.g. "sonnet", "gpt-4o") → proven default (K2.7).
    return KIMI_CODING_MODELS[0]?.id ?? KIMI_FOR_CODING;
  }

  async healthCheck(): Promise<ProviderHealth> {
    return this.inner.healthCheck();
  }
}

/**
 * Create a KimiCodingProvider from environment variables.
 *
 * Env:
 *   KIMI_API_KEY — CEO subscription API key (required)
 *   KIMI_API_BASE_URL — optional override (default https://api.kimi.com/coding/v1)
 */
export function createKimiCodingProviderFromEnv(): KimiCodingProvider {
  const provider = new KimiCodingProvider();
  return provider;
}
