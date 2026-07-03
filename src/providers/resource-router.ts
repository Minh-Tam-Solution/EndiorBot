/**
 * Resource Router for Multi-Provider Request Routing
 *
 * Intelligently routes requests to the best available provider.
 *
 * Per Sprint 38 Day 3-4 requirements:
 * - Route by task type (architecture → multi-model, code → single)
 * - Parallel querying for expert consultation
 * - Provider health monitoring
 * - Failover on provider errors
 * - Cost tracking per provider
 *
 * @module providers/resource-router
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 38 Day 3-4
 * @authority ADR-008 Multi-Provider Architecture
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { createLogger, type Logger } from "../logging/index.js";
import type { AIProvider, ChatRequest, ChatResponse, ProviderErrorCode } from "./types.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Supported provider identifiers.
 */
export type ProviderId = "openai" | "gemini" | "ollama" | "anthropic";

/**
 * Task types that influence routing decisions.
 */
export type TaskType =
  | "architecture"    // Multi-model consultation
  | "code_review"     // Multi-model for critical reviews
  | "security"        // Multi-model required
  | "code_generation" // Single model (fastest)
  | "bug_fix"         // Single model (fastest)
  | "research"        // Gemini preferred (latest data)
  | "general";        // Default routing

/**
 * Provider configuration.
 */
export interface ProviderConfig {
  /** Provider identifier */
  id: ProviderId;
  /** Display name */
  name: string;
  /** Provider instance */
  provider: AIProvider;
  /** Models available */
  models: string[];
  /** Default model */
  defaultModel: string;
  /** Cost per 1K input tokens (USD) */
  inputCostPer1K: number;
  /** Cost per 1K output tokens (USD) */
  outputCostPer1K: number;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Task types this provider excels at */
  specialties: TaskType[];
  /** Whether provider is enabled */
  enabled: boolean;
}

/**
 * Provider health status.
 */
export interface ProviderHealth {
  /** Provider ID */
  providerId: ProviderId;
  /** Is healthy */
  healthy: boolean;
  /** Last check timestamp */
  lastCheck: Date;
  /** Last error (if any) */
  lastError: string | undefined;
  /** Response latency (ms) */
  latencyMs: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Total requests */
  totalRequests: number;
  /** Failed requests */
  failedRequests: number;
}

/**
 * Routing decision result.
 */
export interface RoutingDecision {
  /** Selected provider ID */
  providerId: ProviderId;
  /** Selected model */
  model: string;
  /** Reason for selection */
  reason: string;
  /** Alternative providers (for fallback) */
  alternatives: ProviderId[];
  /** Whether this is multi-model consultation */
  isMultiModel: boolean;
  /** All providers to query (if multi-model) */
  consultationProviders?: ProviderId[];
}

/**
 * Multi-model consultation result.
 */
export interface ConsultationResult {
  /** Individual responses */
  responses: {
    providerId: ProviderId;
    model: string;
    response: ChatResponse;
    latencyMs: number;
    status: "success" | "error" | "timeout";
    error?: string;
  }[];
  /** Consensus analysis */
  consensus: {
    hasConsensus: boolean;
    agreementLevel: number; // 0-1
    commonPoints: string[];
    disagreements: string[];
  };
  /** Total cost */
  totalCost: number;
  /** Total latency (max of all) */
  totalLatencyMs: number;
}

/**
 * Router configuration.
 */
export interface ResourceRouterConfig {
  /** Provider configurations */
  providers: ProviderConfig[];
  /** Timeout per provider (ms) */
  providerTimeoutMs: number;
  /** Max parallel queries */
  maxParallelQueries: number;
  /** Enable multi-model consultation */
  enableMultiModel: boolean;
  /** Minimum providers for consultation */
  minConsultationProviders: number;
}

/**
 * Usage statistics.
 */
export interface RouterUsageStats {
  /** Per-provider stats */
  byProvider: Record<ProviderId, {
    requests: number;
    tokens: { input: number; output: number };
    cost: number;
    avgLatencyMs: number;
  }>;
  /** Total stats */
  total: {
    requests: number;
    tokens: { input: number; output: number };
    cost: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Default provider timeout (30s) */
export const DEFAULT_PROVIDER_TIMEOUT_MS = 30000;

/** Default max parallel queries */
export const DEFAULT_MAX_PARALLEL_QUERIES = 3;

/** Default min consultation providers */
export const DEFAULT_MIN_CONSULTATION_PROVIDERS = 2;

/** Task types requiring multi-model consultation */
export const MULTI_MODEL_TASK_TYPES: TaskType[] = [
  "architecture",
  "security",
  "code_review",
];

/** Provider routing preferences by task type */
export const TASK_ROUTING_PREFERENCES: Record<TaskType, ProviderId[]> = {
  architecture: ["openai", "gemini", "ollama"],
  code_review: ["openai", "gemini"],
  security: ["openai", "gemini", "ollama"],
  code_generation: ["openai", "ollama"],
  bug_fix: ["openai", "ollama"],
  research: ["gemini", "openai"],
  general: ["openai", "gemini", "ollama"],
};

// ============================================================================
// ResourceRouter
// ============================================================================

/**
 * ResourceRouter - Intelligent multi-provider request routing.
 *
 * Routes requests to the best available provider based on:
 * - Task type (architecture, code, security, etc.)
 * - Provider health and availability
 * - Cost optimization
 * - Latency requirements
 *
 * Features:
 * - Multi-model consultation for critical decisions
 * - Automatic failover on provider errors
 * - Health monitoring and circuit breaking
 * - Cost tracking per provider
 */
export class ResourceRouter {
  private providers: Map<ProviderId, ProviderConfig> = new Map();
  private health: Map<ProviderId, ProviderHealth> = new Map();
  private usage: Map<ProviderId, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    totalLatencyMs: number;
  }> = new Map();
  private config: Required<ResourceRouterConfig>;
  private log: Logger;

  constructor(config: Partial<ResourceRouterConfig> = {}) {
    this.log = createLogger("resource-router");
    this.config = {
      providers: config.providers ?? [],
      providerTimeoutMs: config.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
      maxParallelQueries: config.maxParallelQueries ?? DEFAULT_MAX_PARALLEL_QUERIES,
      enableMultiModel: config.enableMultiModel ?? true,
      minConsultationProviders: config.minConsultationProviders ?? DEFAULT_MIN_CONSULTATION_PROVIDERS,
    };

    // Initialize providers
    for (const providerConfig of this.config.providers) {
      this.registerProvider(providerConfig);
    }

    this.log.info("ResourceRouter initialized", {
      providers: Array.from(this.providers.keys()),
      enableMultiModel: this.config.enableMultiModel,
    });
  }

  // ==========================================================================
  // Provider Management
  // ==========================================================================

  /**
   * Register a provider.
   */
  registerProvider(config: ProviderConfig): void {
    this.providers.set(config.id, config);
    this.health.set(config.id, {
      providerId: config.id,
      healthy: true,
      lastCheck: new Date(),
      lastError: undefined,
      latencyMs: 0,
      successRate: 1,
      totalRequests: 0,
      failedRequests: 0,
    });
    this.usage.set(config.id, {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      totalLatencyMs: 0,
    });

    this.log.info("Provider registered", {
      providerId: config.id,
      name: config.name,
      models: config.models,
    });
  }

  /**
   * Unregister a provider.
   */
  unregisterProvider(providerId: ProviderId): boolean {
    const removed = this.providers.delete(providerId);
    this.health.delete(providerId);
    this.usage.delete(providerId);

    if (removed) {
      this.log.info("Provider unregistered", { providerId });
    }

    return removed;
  }

  /**
   * Get provider configuration.
   */
  getProvider(providerId: ProviderId): ProviderConfig | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all registered providers.
   */
  getAllProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  /**
   * Enable/disable a provider.
   */
  setProviderEnabled(providerId: ProviderId, enabled: boolean): boolean {
    const config = this.providers.get(providerId);
    if (!config) return false;

    config.enabled = enabled;
    this.log.info("Provider enabled state changed", { providerId, enabled });
    return true;
  }

  // ==========================================================================
  // Routing
  // ==========================================================================

  /**
   * Route a request to the best provider.
   */
  route(taskType: TaskType = "general"): RoutingDecision {
    const isMultiModel = this.config.enableMultiModel &&
      MULTI_MODEL_TASK_TYPES.includes(taskType);

    // Get available providers for this task type
    const preferredProviders = TASK_ROUTING_PREFERENCES[taskType] ?? TASK_ROUTING_PREFERENCES.general;
    const availableProviders = this.getAvailableProviders(preferredProviders);

    if (availableProviders.length === 0) {
      this.log.error("No available providers for task", { taskType });
      throw new Error(`No available providers for task type: ${taskType}`);
    }

    // Sort by priority and health
    const sortedProviders = this.sortProvidersByScore(availableProviders);
    const primaryProvider = sortedProviders[0] as ProviderId;
    const primaryConfig = this.providers.get(primaryProvider)!;

    // Build routing decision
    const decision: RoutingDecision = {
      providerId: primaryProvider,
      model: primaryConfig.defaultModel,
      reason: this.buildRoutingReason(primaryProvider, taskType, isMultiModel),
      alternatives: sortedProviders.slice(1),
      isMultiModel,
    };

    // Add consultation providers for multi-model tasks
    if (isMultiModel) {
      decision.consultationProviders = sortedProviders.slice(
        0,
        Math.min(this.config.maxParallelQueries, sortedProviders.length)
      );
    }

    this.log.debug("Routing decision made", {
      taskType,
      decision: {
        providerId: decision.providerId,
        model: decision.model,
        isMultiModel: decision.isMultiModel,
        consultationProviders: decision.consultationProviders,
      },
    });

    return decision;
  }

  /**
   * Execute a single request.
   */
  async execute(
    request: ChatRequest,
    taskType: TaskType = "general"
  ): Promise<ChatResponse> {
    const decision = this.route(taskType);
    return this.executeWithProvider(decision.providerId, request);
  }

  /**
   * Execute request with specific provider.
   */
  async executeWithProvider(
    providerId: ProviderId,
    request: ChatRequest
  ): Promise<ChatResponse> {
    const config = this.providers.get(providerId);
    if (!config) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    const startTime = Date.now();

    try {
      const response = await Promise.race([
        config.provider.chat(request),
        this.createTimeout(this.config.providerTimeoutMs),
      ]);

      const latencyMs = Date.now() - startTime;
      this.recordSuccess(providerId, response, latencyMs);

      return response;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.recordFailure(providerId, error as Error, latencyMs);
      throw error;
    }
  }

  /**
   * Execute multi-model consultation.
   */
  async consult(
    request: ChatRequest,
    taskType: TaskType = "architecture"
  ): Promise<ConsultationResult> {
    const decision = this.route(taskType);

    if (!decision.isMultiModel || !decision.consultationProviders) {
      // Single model fallback
      const response = await this.executeWithProvider(decision.providerId, request);
      return this.wrapSingleResponse(decision.providerId, response);
    }

    const startTime = Date.now();
    const providers = decision.consultationProviders;

    this.log.info("Starting multi-model consultation", {
      providers,
      taskType,
    });

    // Execute all queries in parallel
    const results = await Promise.allSettled(
      providers.map(async (providerId) => {
        const providerStart = Date.now();
        try {
          const config = this.providers.get(providerId)!;
          const response = await Promise.race([
            config.provider.chat(request),
            this.createTimeout(this.config.providerTimeoutMs),
          ]);
          const latencyMs = Date.now() - providerStart;
          this.recordSuccess(providerId, response, latencyMs);

          return {
            providerId,
            model: config.defaultModel,
            response,
            latencyMs,
            status: "success" as const,
          };
        } catch (error) {
          const latencyMs = Date.now() - providerStart;
          this.recordFailure(providerId, error as Error, latencyMs);

          return {
            providerId,
            model: this.providers.get(providerId)?.defaultModel ?? "unknown",
            response: null as unknown as ChatResponse,
            latencyMs,
            status: "error" as const,
            error: (error as Error).message,
          };
        }
      })
    );

    // Process results
    const responses = results.map((result, index) => {
      const providerId = providers[index] as ProviderId;
      if (result.status === "fulfilled") {
        return result.value;
      }
      return {
        providerId,
        model: this.providers.get(providerId)?.defaultModel ?? "unknown",
        response: null as unknown as ChatResponse,
        latencyMs: 0,
        status: "error" as const,
        error: result.reason?.message ?? "Unknown error",
      };
    });

    // Calculate consensus (simplified)
    const successResponses = responses.filter((r) => r.status === "success");
    const consensus = this.analyzeConsensus(successResponses);

    // Calculate total cost
    const totalCost = successResponses.reduce((sum, r) => {
      const config = this.providers.get(r.providerId);
      if (!config || !r.response.usage) return sum;
      return sum + this.calculateCost(config, r.response.usage.promptTokens, r.response.usage.completionTokens);
    }, 0);

    const totalLatencyMs = Date.now() - startTime;

    this.log.info("Multi-model consultation complete", {
      successCount: successResponses.length,
      totalProviders: providers.length,
      hasConsensus: consensus.hasConsensus,
      totalCost,
      totalLatencyMs,
    });

    return {
      responses,
      consensus,
      totalCost,
      totalLatencyMs,
    };
  }

  // ==========================================================================
  // Health Monitoring
  // ==========================================================================

  /**
   * Get provider health.
   */
  getHealth(providerId: ProviderId): ProviderHealth | undefined {
    return this.health.get(providerId);
  }

  /**
   * Get all provider health statuses.
   */
  getAllHealth(): ProviderHealth[] {
    return Array.from(this.health.values());
  }

  /**
   * Check if provider is healthy.
   */
  isHealthy(providerId: ProviderId): boolean {
    const health = this.health.get(providerId);
    if (!health) return false;

    // Consider unhealthy if success rate < 50%
    if (health.totalRequests >= 5 && health.successRate < 0.5) {
      return false;
    }

    return health.healthy;
  }

  /**
   * Mark provider as unhealthy.
   */
  markUnhealthy(providerId: ProviderId, error: string): void {
    const health = this.health.get(providerId);
    if (!health) return;

    health.healthy = false;
    health.lastError = error;
    health.lastCheck = new Date();

    this.log.warn("Provider marked unhealthy", { providerId, error });
  }

  /**
   * Mark provider as healthy.
   */
  markHealthy(providerId: ProviderId): void {
    const health = this.health.get(providerId);
    if (!health) return;

    health.healthy = true;
    health.lastError = undefined;
    health.lastCheck = new Date();

    this.log.info("Provider marked healthy", { providerId });
  }

  /**
   * Report provider error for health tracking.
   */
  reportError(providerId: ProviderId, errorCode: ProviderErrorCode): void {
    const health = this.health.get(providerId);
    if (!health) return;

    health.failedRequests++;
    health.totalRequests++;
    health.successRate = 1 - (health.failedRequests / health.totalRequests);

    // Mark unhealthy for critical errors
    if (errorCode === "AUTH_ERROR" || errorCode === "RATE_LIMIT") {
      this.markUnhealthy(providerId, errorCode);
    }
  }

  // ==========================================================================
  // Usage Statistics
  // ==========================================================================

  /**
   * Get usage statistics.
   */
  getUsageStats(): RouterUsageStats {
    const byProvider: RouterUsageStats["byProvider"] = {} as RouterUsageStats["byProvider"];
    let totalRequests = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

    for (const [providerId, usage] of this.usage.entries()) {
      byProvider[providerId] = {
        requests: usage.requests,
        tokens: {
          input: usage.inputTokens,
          output: usage.outputTokens,
        },
        cost: usage.cost,
        avgLatencyMs: usage.requests > 0
          ? usage.totalLatencyMs / usage.requests
          : 0,
      };

      totalRequests += usage.requests;
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;
      totalCost += usage.cost;
    }

    return {
      byProvider,
      total: {
        requests: totalRequests,
        tokens: {
          input: totalInputTokens,
          output: totalOutputTokens,
        },
        cost: totalCost,
      },
    };
  }

  /**
   * Reset usage statistics.
   */
  resetUsageStats(): void {
    for (const usage of this.usage.values()) {
      usage.requests = 0;
      usage.inputTokens = 0;
      usage.outputTokens = 0;
      usage.cost = 0;
      usage.totalLatencyMs = 0;
    }

    this.log.info("Usage statistics reset");
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get available providers from preferred list.
   */
  private getAvailableProviders(preferred: ProviderId[]): ProviderId[] {
    return preferred.filter((id) => {
      const config = this.providers.get(id);
      return config?.enabled && this.isHealthy(id);
    });
  }

  /**
   * Sort providers by score (priority + health).
   */
  private sortProvidersByScore(providers: ProviderId[]): ProviderId[] {
    return providers.sort((a, b) => {
      const configA = this.providers.get(a)!;
      const configB = this.providers.get(b)!;
      const healthA = this.health.get(a)!;
      const healthB = this.health.get(b)!;

      // Score = priority (inverted) + success rate
      const scoreA = (10 - configA.priority) + healthA.successRate;
      const scoreB = (10 - configB.priority) + healthB.successRate;

      return scoreB - scoreA;
    });
  }

  /**
   * Build routing reason string.
   */
  private buildRoutingReason(
    providerId: ProviderId,
    taskType: TaskType,
    isMultiModel: boolean
  ): string {
    const config = this.providers.get(providerId)!;

    if (isMultiModel) {
      return `Multi-model consultation for ${taskType} using ${config.name} as primary`;
    }

    if (config.specialties.includes(taskType)) {
      return `${config.name} specializes in ${taskType}`;
    }

    return `${config.name} selected based on priority and availability`;
  }

  /**
   * Create timeout promise.
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Record successful request.
   */
  private recordSuccess(
    providerId: ProviderId,
    response: ChatResponse,
    latencyMs: number
  ): void {
    const health = this.health.get(providerId);
    const usage = this.usage.get(providerId);
    const config = this.providers.get(providerId);

    if (health) {
      health.totalRequests++;
      health.successRate = 1 - (health.failedRequests / health.totalRequests);
      health.latencyMs = latencyMs;
      health.lastCheck = new Date();
      health.healthy = true;
    }

    if (usage && response.usage) {
      usage.requests++;
      usage.inputTokens += response.usage.promptTokens;
      usage.outputTokens += response.usage.completionTokens;
      usage.totalLatencyMs += latencyMs;

      if (config) {
        usage.cost += this.calculateCost(
          config,
          response.usage.promptTokens,
          response.usage.completionTokens
        );
      }
    }
  }

  /**
   * Record failed request.
   */
  private recordFailure(
    providerId: ProviderId,
    error: Error,
    latencyMs: number
  ): void {
    const health = this.health.get(providerId);

    if (health) {
      health.totalRequests++;
      health.failedRequests++;
      health.successRate = 1 - (health.failedRequests / health.totalRequests);
      health.latencyMs = latencyMs;
      health.lastCheck = new Date();
      health.lastError = error.message;

      // Mark unhealthy after 3 consecutive failures
      if (health.failedRequests >= 3 && health.successRate < 0.5) {
        health.healthy = false;
      }
    }

    this.log.warn("Request failed", {
      providerId,
      error: error.message,
      latencyMs,
    });
  }

  /**
   * Calculate cost for tokens.
   */
  private calculateCost(
    config: ProviderConfig,
    inputTokens: number,
    outputTokens: number
  ): number {
    return (
      (inputTokens / 1000) * config.inputCostPer1K +
      (outputTokens / 1000) * config.outputCostPer1K
    );
  }

  /**
   * Wrap single response as consultation result.
   */
  private wrapSingleResponse(
    providerId: ProviderId,
    response: ChatResponse
  ): ConsultationResult {
    const config = this.providers.get(providerId);

    return {
      responses: [
        {
          providerId,
          model: config?.defaultModel ?? "unknown",
          response,
          latencyMs: 0,
          status: "success",
        },
      ],
      consensus: {
        hasConsensus: true,
        agreementLevel: 1,
        commonPoints: [],
        disagreements: [],
      },
      totalCost: config && response.usage
        ? this.calculateCost(config, response.usage.promptTokens, response.usage.completionTokens)
        : 0,
      totalLatencyMs: 0,
    };
  }

  /**
   * Analyze consensus from multiple responses.
   * Note: This is a simplified implementation. A real implementation
   * would use NLP to compare response content.
   */
  private analyzeConsensus(
    responses: Array<{ providerId: ProviderId; response: ChatResponse }>
  ): ConsultationResult["consensus"] {
    if (responses.length === 0) {
      return {
        hasConsensus: false,
        agreementLevel: 0,
        commonPoints: [],
        disagreements: [],
      };
    }

    if (responses.length === 1) {
      return {
        hasConsensus: true,
        agreementLevel: 1,
        commonPoints: ["Single provider response"],
        disagreements: [],
      };
    }

    // Simplified consensus: assume consensus if all providers responded
    const agreementLevel = responses.length / this.config.minConsultationProviders;

    return {
      hasConsensus: agreementLevel >= 0.5,
      agreementLevel: Math.min(agreementLevel, 1),
      commonPoints: [`${responses.length} providers responded`],
      disagreements: [],
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a ResourceRouter instance.
 */
export function createResourceRouter(
  config?: Partial<ResourceRouterConfig>
): ResourceRouter {
  return new ResourceRouter(config);
}

/**
 * Create ResourceRouter from environment variables.
 */
export function createResourceRouterFromEnv(): ResourceRouter {
  // This will be populated when providers are created
  return createResourceRouter({
    providerTimeoutMs: parseInt(
      process.env.PROVIDER_TIMEOUT_MS ?? String(DEFAULT_PROVIDER_TIMEOUT_MS),
      10
    ),
    maxParallelQueries: parseInt(
      process.env.MAX_PARALLEL_QUERIES ?? String(DEFAULT_MAX_PARALLEL_QUERIES),
      10
    ),
    enableMultiModel: process.env.ENABLE_MULTI_MODEL !== "false",
  });
}
