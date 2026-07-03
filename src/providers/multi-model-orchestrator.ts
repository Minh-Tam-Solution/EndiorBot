/**
 * Multi-Model Orchestrator
 *
 * High-level service for multi-provider AI orchestration.
 *
 * Per Sprint 39 requirements:
 * - Auto-configure providers from environment
 * - Expert consultation with response consolidation
 * - Intelligent task-based routing
 * - Provider lifecycle management
 * - Health monitoring with auto-failover
 *
 * @module providers/multi-model-orchestrator
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 39
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { createLogger, type Logger } from "../logging/index.js";
import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  ProviderConfig as BaseProviderConfig,
} from "./types.js";

import {
  ResourceRouter,
  createResourceRouter,
  type ProviderId,
  type TaskType,
  type ProviderConfig as RouterProviderConfig,
  type ConsultationResult,
  type RoutingDecision,
  type ProviderHealth,
  type RouterUsageStats,
} from "./resource-router.js";

import {
  createOpenAIProviderFromEnv,
  OPENAI_MODELS,
} from "./openai/index.js";

import {
  createGeminiProviderFromEnv,
  GEMINI_MODELS,
} from "./gemini/index.js";

import {
  createOllamaProviderFromEnv,
  OLLAMA_MODELS,
} from "./ollama/index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Provider setup configuration.
 */
export interface ProviderSetup {
  /** Provider ID */
  id: ProviderId;
  /** Whether to enable this provider */
  enabled: boolean;
  /** Provider configuration */
  config?: BaseProviderConfig;
  /** Priority (lower = higher priority) */
  priority?: number;
  /** Task specialties */
  specialties?: TaskType[];
}

/**
 * Orchestrator configuration.
 */
export interface OrchestratorConfig {
  /** Provider setups */
  providers?: ProviderSetup[];
  /** Enable multi-model consultation */
  enableMultiModel?: boolean;
  /** Provider timeout (ms) */
  providerTimeoutMs?: number;
  /** Max parallel queries */
  maxParallelQueries?: number;
  /** Minimum providers for consultation */
  minConsultationProviders?: number;
  /** Auto-initialize providers */
  autoInitialize?: boolean;
  /** Health check interval (ms) - 0 to disable */
  healthCheckIntervalMs?: number;
}

/**
 * Expert consultation request.
 */
export interface ExpertConsultationRequest {
  /** Query for experts */
  query: string;
  /** Task type for routing */
  taskType?: TaskType;
  /** System prompt override */
  systemPrompt?: string;
  /** Specific providers to consult (overrides routing) */
  providers?: ProviderId[];
  /** Additional context */
  context?: string;
  /** Maximum tokens */
  maxTokens?: number;
  /** Temperature */
  temperature?: number;
}

/**
 * Expert consultation response.
 */
export interface ExpertConsultationResponse {
  /** Consolidated recommendation */
  recommendation: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Individual expert opinions */
  experts: ExpertOpinion[];
  /** Consensus summary */
  consensus: ConsensusAnalysis;
  /** Total cost */
  totalCost: number;
  /** Total latency */
  totalLatencyMs: number;
  /** Routing decision used */
  routing: RoutingDecision;
}

/**
 * Individual expert opinion.
 */
export interface ExpertOpinion {
  /** Provider ID */
  providerId: ProviderId;
  /** Model used */
  model: string;
  /** Response content */
  content: string;
  /** Latency */
  latencyMs: number;
  /** Token usage */
  tokens?: { input: number; output: number };
  /** Status */
  status: "success" | "error" | "timeout";
  /** Error message (if failed) */
  error?: string;
}

/**
 * Consensus analysis.
 */
export interface ConsensusAnalysis {
  /** Has consensus */
  hasConsensus: boolean;
  /** Agreement level (0-1) */
  agreementLevel: number;
  /** Common points across responses */
  commonPoints: string[];
  /** Points of disagreement */
  disagreements: string[];
  /** Key recommendations */
  keyRecommendations: string[];
  /** Concerns raised */
  concerns: string[];
}

/**
 * Orchestrator state.
 */
export type OrchestratorState = "created" | "initializing" | "ready" | "disposed";

// ============================================================================
// Constants
// ============================================================================

/** Default health check interval (5 minutes) */
export const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Provider cost configurations (USD per 1K tokens) */
export const PROVIDER_COSTS: Record<ProviderId, { input: number; output: number }> = {
  openai: { input: 0.0025, output: 0.01 },      // GPT-4o pricing
  gemini: { input: 0.000075, output: 0.0003 },  // Gemini 2.0 Flash pricing
  ollama: { input: 0, output: 0 },               // Local, no cost
  anthropic: { input: 0.003, output: 0.015 },    // Claude 3.5 Sonnet pricing
};

// ============================================================================
// MultiModelOrchestrator
// ============================================================================

/**
 * MultiModelOrchestrator - High-level multi-provider AI service.
 *
 * Provides:
 * - Automatic provider configuration from environment
 * - Expert consultation with intelligent routing
 * - Response consolidation and consensus analysis
 * - Provider lifecycle management
 * - Health monitoring with auto-failover
 *
 * Usage:
 * ```typescript
 * const orchestrator = new MultiModelOrchestrator();
 * await orchestrator.initialize();
 *
 * // Simple query
 * const response = await orchestrator.query("How do I implement caching?");
 *
 * // Expert consultation
 * const consultation = await orchestrator.consult({
 *   query: "Design payment gateway integration",
 *   taskType: "architecture",
 * });
 *
 * console.log(consultation.recommendation);
 * console.log(consultation.consensus);
 * ```
 */
export class MultiModelOrchestrator {
  private state: OrchestratorState = "created";
  private router: ResourceRouter;
  private providers: Map<ProviderId, AIProvider> = new Map();
  private config: Required<OrchestratorConfig>;
  private healthCheckTimer: ReturnType<typeof setInterval> | undefined;
  private log: Logger;

  constructor(config: OrchestratorConfig = {}) {
    this.log = createLogger("orchestrator");
    this.config = {
      providers: config.providers ?? [],
      enableMultiModel: config.enableMultiModel ?? true,
      providerTimeoutMs: config.providerTimeoutMs ?? 30000,
      maxParallelQueries: config.maxParallelQueries ?? 3,
      minConsultationProviders: config.minConsultationProviders ?? 2,
      autoInitialize: config.autoInitialize ?? true,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS,
    };

    // Create router
    this.router = createResourceRouter({
      providerTimeoutMs: this.config.providerTimeoutMs,
      maxParallelQueries: this.config.maxParallelQueries,
      enableMultiModel: this.config.enableMultiModel,
      minConsultationProviders: this.config.minConsultationProviders,
    });

    this.log.info("MultiModelOrchestrator created", {
      enableMultiModel: this.config.enableMultiModel,
      providerCount: this.config.providers.length,
    });
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Get current state.
   */
  getState(): OrchestratorState {
    return this.state;
  }

  /**
   * Initialize the orchestrator.
   * Creates and registers all configured providers.
   */
  async initialize(): Promise<void> {
    if (this.state !== "created") {
      this.log.warn("Orchestrator already initialized or disposed");
      return;
    }

    this.state = "initializing";
    this.log.info("Initializing orchestrator");

    try {
      // If no providers configured, try auto-detect from environment
      if (this.config.providers.length === 0) {
        this.config.providers = this.detectProvidersFromEnv();
      }

      // Initialize each provider
      for (const setup of this.config.providers) {
        if (!setup.enabled) continue;

        try {
          await this.initializeProvider(setup);
        } catch (error) {
          this.log.warn("Failed to initialize provider", {
            providerId: setup.id,
            error: (error as Error).message,
          });
        }
      }

      // Start health check timer if configured
      if (this.config.healthCheckIntervalMs > 0) {
        this.startHealthCheckTimer();
      }

      this.state = "ready";
      this.log.info("Orchestrator initialized", {
        providers: Array.from(this.providers.keys()),
      });
    } catch (error) {
      this.state = "created";
      throw error;
    }
  }

  /**
   * Dispose the orchestrator.
   */
  async dispose(): Promise<void> {
    if (this.state === "disposed") return;

    this.log.info("Disposing orchestrator");

    // Stop health check timer
    if (this.healthCheckTimer) {
      const timer = this.healthCheckTimer;
      this.healthCheckTimer = undefined;
      clearInterval(timer);
    }

    // Dispose all providers
    for (const [id, provider] of this.providers) {
      try {
        await provider.dispose?.();
      } catch (error) {
        this.log.warn("Error disposing provider", {
          providerId: id,
          error: (error as Error).message,
        });
      }
    }

    this.providers.clear();
    this.state = "disposed";
    this.log.info("Orchestrator disposed");
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Simple query - routes to best available provider.
   */
  async query(
    query: string,
    options: {
      taskType?: TaskType;
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<ChatResponse> {
    this.ensureReady();

    const taskType = options.taskType ?? "general";
    const request = this.buildChatRequest(query, options);

    return this.router.execute(request, taskType);
  }

  /**
   * Query specific provider.
   */
  async queryProvider(
    providerId: ProviderId,
    query: string,
    options: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<ChatResponse> {
    this.ensureReady();

    const request = this.buildChatRequest(query, options);
    return this.router.executeWithProvider(providerId, request);
  }

  /**
   * Expert consultation - queries multiple providers.
   */
  async consult(
    request: ExpertConsultationRequest
  ): Promise<ExpertConsultationResponse> {
    this.ensureReady();

    const taskType = request.taskType ?? "architecture";

    // Build chat request options - only include defined values
    const chatOptions: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
      context?: string;
    } = {
      systemPrompt: request.systemPrompt ?? this.getConsultationSystemPrompt(taskType),
    };
    if (request.maxTokens !== undefined) {
      chatOptions.maxTokens = request.maxTokens;
    }
    if (request.temperature !== undefined) {
      chatOptions.temperature = request.temperature;
    }
    if (request.context !== undefined) {
      chatOptions.context = request.context;
    }
    const chatRequest = this.buildChatRequest(request.query, chatOptions);

    // Get routing decision
    const routing = this.router.route(taskType);

    // Execute consultation
    const result = await this.router.consult(chatRequest, taskType);

    // Transform to expert consultation response
    return this.transformConsultationResult(result, routing);
  }

  // ==========================================================================
  // Provider Management
  // ==========================================================================

  /**
   * Get registered providers.
   */
  getProviders(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider health.
   */
  getProviderHealth(providerId: ProviderId): ProviderHealth | undefined {
    return this.router.getHealth(providerId);
  }

  /**
   * Get all provider health statuses.
   */
  getAllHealth(): ProviderHealth[] {
    return this.router.getAllHealth();
  }

  /**
   * Get usage statistics.
   */
  getUsageStats(): RouterUsageStats {
    return this.router.getUsageStats();
  }

  /**
   * Reset usage statistics.
   */
  resetUsageStats(): void {
    this.router.resetUsageStats();
  }

  /**
   * Enable/disable a provider.
   */
  setProviderEnabled(providerId: ProviderId, enabled: boolean): boolean {
    return this.router.setProviderEnabled(providerId, enabled);
  }

  /**
   * Check health of all providers.
   */
  async checkAllHealth(): Promise<Map<ProviderId, ProviderHealth>> {
    const results = new Map<ProviderId, ProviderHealth>();

    for (const [id, provider] of this.providers) {
      try {
        const health = await provider.healthCheck();
        if (health.status === "healthy") {
          this.router.markHealthy(id);
        } else {
          this.router.markUnhealthy(id, health.message ?? "Health check failed");
        }
        const status = this.router.getHealth(id);
        if (status) {
          results.set(id, status);
        }
      } catch (error) {
        this.router.markUnhealthy(id, (error as Error).message);
        const status = this.router.getHealth(id);
        if (status) {
          results.set(id, status);
        }
      }
    }

    return results;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Ensure orchestrator is ready.
   */
  private ensureReady(): void {
    if (this.state !== "ready") {
      throw new Error(`Orchestrator not ready (state: ${this.state})`);
    }
  }

  /**
   * Detect available providers from environment.
   */
  private detectProvidersFromEnv(): ProviderSetup[] {
    const providers: ProviderSetup[] = [];

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      providers.push({
        id: "openai",
        enabled: true,
        priority: 1,
        specialties: ["code_generation", "bug_fix", "code_review"],
      });
    }

    // Gemini
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      providers.push({
        id: "gemini",
        enabled: true,
        priority: 2,
        specialties: ["research", "architecture"],
      });
    }

    // Ollama (local)
    if (process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL) {
      providers.push({
        id: "ollama",
        enabled: true,
        priority: 3,
        specialties: ["code_generation", "bug_fix"],
      });
    }

    this.log.info("Detected providers from environment", {
      providers: providers.map((p) => p.id),
    });

    return providers;
  }

  /**
   * Initialize a single provider.
   */
  private async initializeProvider(setup: ProviderSetup): Promise<void> {
    let provider: AIProvider;
    let defaultModel: string;
    let models: string[];

    switch (setup.id) {
      case "openai": {
        const openaiProvider = createOpenAIProviderFromEnv();
        if (setup.config) {
          await openaiProvider.initialize(setup.config);
        }
        provider = openaiProvider;
        defaultModel = "gpt-4o";
        models = OPENAI_MODELS.map((m) => m.id);
        break;
      }

      case "gemini": {
        const geminiProvider = createGeminiProviderFromEnv();
        if (setup.config) {
          await geminiProvider.initialize(setup.config);
        }
        provider = geminiProvider;
        defaultModel = "gemini-2.5-flash";
        models = GEMINI_MODELS.map((m) => m.id);
        break;
      }

      case "ollama": {
        const ollamaProvider = createOllamaProviderFromEnv();
        if (setup.config) {
          await ollamaProvider.initialize(setup.config);
        }
        provider = ollamaProvider;
        defaultModel = "qwen3-coder:30b";
        models = OLLAMA_MODELS.map((m) => m.name);
        break;
      }

      default:
        throw new Error(`Unknown provider: ${setup.id}`);
    }

    // Store provider
    this.providers.set(setup.id, provider);

    // Register with router
    const costs = PROVIDER_COSTS[setup.id];
    const routerConfig: RouterProviderConfig = {
      id: setup.id,
      name: this.getProviderName(setup.id),
      provider,
      models,
      defaultModel,
      inputCostPer1K: costs.input,
      outputCostPer1K: costs.output,
      priority: setup.priority ?? 5,
      specialties: setup.specialties ?? [],
      enabled: true,
    };

    this.router.registerProvider(routerConfig);

    this.log.info("Provider initialized", {
      providerId: setup.id,
      models: models.length,
      defaultModel,
    });
  }

  /**
   * Get human-readable provider name.
   */
  private getProviderName(id: ProviderId): string {
    const names: Record<ProviderId, string> = {
      openai: "OpenAI",
      gemini: "Google Gemini",
      ollama: "Ollama (Local)",
      anthropic: "Anthropic Claude",
    };
    return names[id] ?? id;
  }

  /**
   * Build chat request from query.
   */
  private buildChatRequest(
    query: string,
    options: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
      context?: string;
    }
  ): ChatRequest {
    const messages: ChatRequest["messages"] = [];

    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    let content = query;
    if (options.context) {
      content = `Context:\n${options.context}\n\nQuery:\n${query}`;
    }

    messages.push({ role: "user", content });

    const request: ChatRequest = {
      model: "", // Will be set by provider
      messages,
    };

    if (options.maxTokens !== undefined) {
      request.maxTokens = options.maxTokens;
    }

    if (options.temperature !== undefined) {
      request.temperature = options.temperature;
    }

    return request;
  }

  /**
   * Get system prompt for consultation.
   */
  private getConsultationSystemPrompt(taskType: TaskType): string {
    const prompts: Record<TaskType, string> = {
      architecture: `You are an expert software architect. Analyze the request and provide:
1. A clear recommendation with reasoning
2. Key architectural considerations
3. Potential risks or concerns
4. Alternative approaches if applicable

Be concise but thorough. Focus on practical, actionable advice.`,

      security: `You are a security expert. Analyze the request and provide:
1. Security assessment
2. Potential vulnerabilities
3. Recommended mitigations
4. Best practices to follow

Be thorough and prioritize security concerns.`,

      code_review: `You are an expert code reviewer. Analyze the code and provide:
1. Code quality assessment
2. Potential bugs or issues
3. Performance considerations
4. Suggestions for improvement

Be constructive and specific with recommendations.`,

      code_generation: `You are an expert software developer. Generate clean, well-structured code that:
1. Follows best practices
2. Is well-documented
3. Handles edge cases
4. Is testable and maintainable`,

      bug_fix: `You are a debugging expert. Analyze the issue and provide:
1. Root cause analysis
2. Proposed fix
3. Testing recommendations
4. Prevention strategies`,

      research: `You are a technical researcher. Provide:
1. Comprehensive analysis
2. Current best practices
3. Relevant examples
4. References and resources`,

      general: `You are a helpful AI assistant. Provide clear, accurate, and helpful responses.`,
    };

    return prompts[taskType] ?? prompts.general;
  }

  /**
   * Transform consultation result to response format.
   */
  private transformConsultationResult(
    result: ConsultationResult,
    routing: RoutingDecision
  ): ExpertConsultationResponse {
    // Extract expert opinions
    const experts: ExpertOpinion[] = result.responses.map((r) => {
      const opinion: ExpertOpinion = {
        providerId: r.providerId,
        model: r.model,
        content: r.response?.content ?? "",
        latencyMs: r.latencyMs,
        status: r.status,
      };
      // Add optional properties only if defined (exactOptionalPropertyTypes)
      if (r.response?.usage) {
        opinion.tokens = {
          input: r.response.usage.promptTokens,
          output: r.response.usage.completionTokens,
        };
      }
      if (r.error) {
        opinion.error = r.error;
      }
      return opinion;
    });

    // Analyze consensus with enhanced analysis
    const successExperts = experts.filter((e) => e.status === "success");
    const consensus = this.analyzeConsensus(successExperts);

    // Generate recommendation from successful responses
    const recommendation = this.generateRecommendation(successExperts, consensus);

    // Calculate confidence
    const confidence = this.calculateConfidence(successExperts, consensus);

    return {
      recommendation,
      confidence,
      experts,
      consensus,
      totalCost: result.totalCost,
      totalLatencyMs: result.totalLatencyMs,
      routing,
    };
  }

  /**
   * Analyze consensus from expert opinions.
   */
  private analyzeConsensus(experts: ExpertOpinion[]): ConsensusAnalysis {
    if (experts.length === 0) {
      return {
        hasConsensus: false,
        agreementLevel: 0,
        commonPoints: [],
        disagreements: [],
        keyRecommendations: [],
        concerns: [],
      };
    }

    if (experts.length === 1) {
      // Single expert
      const content = experts[0]?.content ?? "";
      return {
        hasConsensus: true,
        agreementLevel: 1,
        commonPoints: ["Single expert opinion"],
        disagreements: [],
        keyRecommendations: this.extractKeyPoints(content, "recommend"),
        concerns: this.extractKeyPoints(content, "concern"),
      };
    }

    // Multiple experts - analyze for common themes
    const allContent = experts.map((e) => e.content);

    // Extract key points from each response
    const allRecommendations = allContent.flatMap((c) =>
      this.extractKeyPoints(c, "recommend")
    );
    const allConcerns = allContent.flatMap((c) =>
      this.extractKeyPoints(c, "concern")
    );

    // Find common themes (simplified - in production use NLP)
    const commonPoints = this.findCommonThemes(allContent);
    const disagreements = this.findDisagreements(allContent);

    // Calculate agreement level
    const agreementLevel = Math.min(
      1,
      experts.length / this.config.minConsultationProviders
    );

    return {
      hasConsensus: agreementLevel >= 0.5 && commonPoints.length > 0,
      agreementLevel,
      commonPoints,
      disagreements,
      keyRecommendations: [...new Set(allRecommendations)].slice(0, 5),
      concerns: [...new Set(allConcerns)].slice(0, 5),
    };
  }

  /**
   * Extract key points from content.
   */
  private extractKeyPoints(
    content: string,
    type: "recommend" | "concern"
  ): string[] {
    const points: string[] = [];
    const lines = content.split("\n");

    const patterns =
      type === "recommend"
        ? [
            /recommend[s]?:?\s*(.+)/i,
            /suggest[s]?:?\s*(.+)/i,
            /should\s+(.+)/i,
            /best practice:?\s*(.+)/i,
          ]
        : [
            /concern[s]?:?\s*(.+)/i,
            /warning:?\s*(.+)/i,
            /risk[s]?:?\s*(.+)/i,
            /caution:?\s*(.+)/i,
            /potential issue:?\s*(.+)/i,
          ];

    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match?.[1]) {
          points.push(match[1].trim());
        }
      }
    }

    return points;
  }

  /**
   * Find common themes across responses.
   */
  private findCommonThemes(responses: string[]): string[] {
    if (responses.length < 2) return [];

    // Simple keyword-based theme detection
    const keywords = new Map<string, number>();
    const significantWords = new Set<string>();

    for (const response of responses) {
      const words = response.toLowerCase().match(/\b\w{4,}\b/g) ?? [];
      const uniqueWords = new Set(words);

      for (const word of uniqueWords) {
        keywords.set(word, (keywords.get(word) ?? 0) + 1);
      }
    }

    // Find words that appear in majority of responses
    const threshold = Math.ceil(responses.length / 2);
    for (const [word, count] of keywords) {
      if (count >= threshold) {
        significantWords.add(word);
      }
    }

    // Convert to themes (simplified)
    const themes: string[] = [];
    if (significantWords.size > 0) {
      themes.push(`${responses.length} experts agree on approach`);
    }

    return themes;
  }

  /**
   * Find disagreements across responses.
   */
  private findDisagreements(responses: string[]): string[] {
    // Simplified - look for contradicting patterns
    const contradictions: string[] = [];

    const positivePatterns = [/yes/i, /should/i, /recommend/i];
    const negativePatterns = [/no/i, /should not/i, /avoid/i];

    let hasPositive = false;
    let hasNegative = false;

    for (const response of responses) {
      for (const pattern of positivePatterns) {
        if (pattern.test(response)) hasPositive = true;
      }
      for (const pattern of negativePatterns) {
        if (pattern.test(response)) hasNegative = true;
      }
    }

    if (hasPositive && hasNegative) {
      contradictions.push("Experts have differing opinions on approach");
    }

    return contradictions;
  }

  /**
   * Generate consolidated recommendation.
   */
  private generateRecommendation(
    experts: ExpertOpinion[],
    consensus: ConsensusAnalysis
  ): string {
    if (experts.length === 0) {
      return "Unable to generate recommendation - no expert responses available.";
    }

    if (experts.length === 1) {
      return experts[0]?.content ?? "";
    }

    // Build consolidated recommendation
    const parts: string[] = [];

    if (consensus.hasConsensus) {
      parts.push("**RECOMMENDATION** (Consensus achieved)\n");
    } else {
      parts.push("**RECOMMENDATION** (Mixed opinions)\n");
    }

    // Add key recommendations
    if (consensus.keyRecommendations.length > 0) {
      parts.push("\n**Key Points:**");
      for (const rec of consensus.keyRecommendations) {
        parts.push(`- ${rec}`);
      }
    }

    // Add concerns
    if (consensus.concerns.length > 0) {
      parts.push("\n**Concerns Raised:**");
      for (const concern of consensus.concerns) {
        parts.push(`- ${concern}`);
      }
    }

    // Add expert summary
    parts.push(`\n**Expert Summary:** ${experts.length} experts consulted`);
    for (const expert of experts) {
      parts.push(`- ${this.getProviderName(expert.providerId)}: ${expert.status}`);
    }

    return parts.join("\n");
  }

  /**
   * Calculate confidence score.
   */
  private calculateConfidence(
    experts: ExpertOpinion[],
    consensus: ConsensusAnalysis
  ): number {
    if (experts.length === 0) return 0;

    // Base confidence on:
    // - Number of successful responses
    // - Agreement level
    const responseScore = experts.length / this.config.minConsultationProviders;
    const agreementScore = consensus.agreementLevel;

    // Weighted average
    const confidence = responseScore * 0.4 + agreementScore * 0.6;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Start health check timer.
   */
  private startHealthCheckTimer(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.checkAllHealth();
      } catch (error) {
        this.log.warn("Health check failed", {
          error: (error as Error).message,
        });
      }
    }, this.config.healthCheckIntervalMs);

    this.log.debug("Health check timer started", {
      intervalMs: this.config.healthCheckIntervalMs,
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create orchestrator with default configuration.
 */
export function createOrchestrator(
  config?: OrchestratorConfig
): MultiModelOrchestrator {
  return new MultiModelOrchestrator(config);
}

/**
 * Create and initialize orchestrator from environment.
 */
export async function createOrchestratorFromEnv(): Promise<MultiModelOrchestrator> {
  const orchestrator = new MultiModelOrchestrator({
    autoInitialize: true,
  });
  await orchestrator.initialize();
  return orchestrator;
}
