/**
 * Kimi API Provider (Moonshot)
 *
 * Direct integration with Moonshot AI API (api.moonshot.ai).
 * Uses OpenAI-compatible API format via composition with OpenAIProvider.
 *
 * ADR-053: Re-roled from primary to backup kimi provider. URL corrected .cn → .ai.
 *
 * @module providers/kimi-api
 * @since Sprint 140 — Kimi API fallback tier
 * @updated Sprint 145 — ADR-053 backup role + URL fix
 */

import { OpenAIProvider } from "../openai/index.js";
import {
  KIMI_K3,
  KIMI_K3_256K,
  LEGACY_KIMI_K2_6,
  LEGACY_MOONSHOT_128K,
  LEGACY_MOONSHOT_32K,
} from "../../config/models.js";
import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ModelDefinition,
  ProviderConfig,
  ProviderHealth,
} from "../types.js";

/** Default Moonshot API endpoint (corrected .cn → .ai per ADR-053). */
const DEFAULT_MOONSHOT_URL = "https://api.moonshot.ai/v1";

/** Kimi model definitions via Moonshot API. Current = K3 (1M ctx). */
const KIMI_API_MODELS: ModelDefinition[] = [
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
  // Legacy — backward compat for persisted sessions referencing old IDs.
  {
    id: LEGACY_KIMI_K2_6,
    name: "Kimi K2.6 (legacy)",
    contextWindow: 256000,
    maxOutputTokens: 16384,
    supportedFeatures: ["chat", "vision", "tools", "streaming"],
  },
  {
    id: LEGACY_MOONSHOT_128K,
    name: "Moonshot V1 128K (legacy)",
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportedFeatures: ["chat", "vision", "streaming"],
  },
  {
    id: LEGACY_MOONSHOT_32K,
    name: "Moonshot V1 32K (legacy)",
    contextWindow: 32000,
    maxOutputTokens: 8192,
    supportedFeatures: ["chat", "streaming"],
  },
];

/**
 * KimiApiProvider delegates to an internal OpenAIProvider instance
 * because Moonshot exposes an OpenAI-compatible API.
 *
 * ADR-053: Backup kimi provider — used when kimi-coding (CEO subscription)
 * is unavailable or rate-limited. Primary for this model is now kimi-coding.
 */
export class KimiApiProvider implements AIProvider {
  readonly id = "kimi-api";
  readonly name = "Kimi API (Moonshot)";
  readonly models = KIMI_API_MODELS;

  private inner = new OpenAIProvider({
    baseUrl: DEFAULT_MOONSHOT_URL,
    defaultModel: KIMI_K3,
    maxRequestsPerMinute: 60,
  });

  async initialize(config: ProviderConfig): Promise<void> {
    const initConfig: { apiKey: string; baseUrl: string } = {
      apiKey: config.apiKey ?? "",
      baseUrl: config.baseUrl ?? DEFAULT_MOONSHOT_URL,
    };
    await this.inner.initialize(initConfig);
  }

  async dispose(): Promise<void> {
    await this.inner.dispose();
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.inner.chat(request);
  }

  async *chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    yield* this.inner.chatStream(request);
  }

  async healthCheck(): Promise<ProviderHealth> {
    return this.inner.healthCheck();
  }
}

/**
 * Create a KimiApiProvider from environment variables.
 *
 * Env:
 *   MOONSHOT_API_KEY — Moonshot API key (required)
 *   MOONSHOT_API_BASE_URL — optional override (default https://api.moonshot.ai/v1)
 */
export function createKimiApiProviderFromEnv(): KimiApiProvider {
  const provider = new KimiApiProvider();
  return provider;
}
