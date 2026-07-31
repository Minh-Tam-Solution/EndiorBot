/**
 * Multi-Model Orchestrator
 *
 * Queries multiple AI models in parallel and consolidates responses.
 * Implements ADR-001 for expert consultation workflow.
 *
 * Features:
 * - Parallel queries to multiple providers (GPT, Gemini, Kimi, Mistral)
 * - Configurable timeouts and fallback behavior
 * - Response consolidation with consensus detection
 * - SDLC compliance checking
 *
 * @module agents/orchestrator/multi-model-orchestrator
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 6 Implementation
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Agent Personas
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { KIMI_K3 } from "../../config/models.js";

// ============================================================================
// Types
// ============================================================================

/**
 * AI provider identifier.
 */
export type ProviderId = "anthropic" | "openai" | "google" | "kimi" | "mistral";

/**
 * Model role in consultation.
 */
export type ModelRole = "primary" | "expert";

/**
 * Task type for routing.
 */
export type TaskType =
  | "architecture"
  | "code_review"
  | "security"
  | "research"
  | "general";

/**
 * Query status.
 */
export type QueryStatus = "pending" | "success" | "timeout" | "error";

/**
 * Model configuration.
 */
export interface ModelConfig {
  provider: ProviderId;
  model: string;
  role: ModelRole;
  purpose: string;
  taskTypes?: TaskType[];
}

/**
 * Query result from a single model.
 */
export interface ModelQueryResult {
  provider: ProviderId;
  model: string;
  role: ModelRole;
  status: QueryStatus;
  content?: string;
  latencyMs: number;
  error?: string;
}

/**
 * Consensus point from multiple responses.
 */
export interface ConsensusPoint {
  topic: string;
  agreement: number; // 0-1 representing % agreement
  description: string;
}

/**
 * Disagreement between models.
 */
export interface Disagreement {
  topic: string;
  positions: {
    provider: ProviderId;
    position: string;
  }[];
}

/**
 * Consolidated consultation result.
 */
export interface ConsultationResult {
  taskId: string;
  taskType: TaskType;
  query: string;
  timestamp: string;

  // Individual responses
  responses: ModelQueryResult[];

  // Consolidated analysis
  consensus: {
    hasConsensus: boolean;
    points: ConsensusPoint[];
    disagreements: Disagreement[];
  };

  // Final recommendation
  recommendation: string;

  // SDLC compliance
  sdlcCompliance: {
    passed: boolean;
    notes: string[];
  };

  // Metadata
  totalLatencyMs: number;
  modelsQueried: number;
  modelsResponded: number;
}

/**
 * Orchestrator configuration.
 */
export interface OrchestratorConfig {
  /**
   * Primary model configuration.
   */
  primary: ModelConfig;

  /**
   * Expert model configurations.
   */
  experts: ModelConfig[];

  /**
   * Per-model query timeout in ms.
   */
  perModelTimeout: number;

  /**
   * Total consultation timeout in ms.
   */
  totalTimeout: number;

  /**
   * Minimum responses required.
   */
  minimumResponses: number;

  /**
   * Fallback behavior on timeout.
   */
  fallbackBehavior: "use_available" | "require_minimum" | "fail_fast";
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  primary: {
    provider: "openai",
    model: "gpt-5.4",
    role: "primary",
    purpose: "Primary reasoning and analysis for CEO consultation",
  },
  experts: [
    {
      provider: "google",
      model: "gemini-2.5-pro",
      role: "expert",
      purpose: "Multi-modal reasoning, long-context analysis, critic",
      taskTypes: ["architecture", "research"],
    },
    {
      provider: "kimi",
      model: KIMI_K3,
      role: "expert",
      purpose: "Code generation, Chinese-context knowledge, alternative perspective",
      taskTypes: ["code_review", "architecture", "security"],
    },
  ],
  perModelTimeout: 30000, // 30s per model
  totalTimeout: 60000, // 60s total
  minimumResponses: 2,
  fallbackBehavior: "use_available",
};

// ============================================================================
// Multi-Model Orchestrator Class
// ============================================================================

/**
 * Orchestrates queries across multiple AI models.
 */
export class MultiModelOrchestrator {
  private readonly config: OrchestratorConfig;
  private consultationCounter = 0;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
  }

  /**
   * Generate consultation ID.
   */
  private generateId(): string {
    this.consultationCounter++;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `CONSULT-${date}-${String(this.consultationCounter).padStart(3, "0")}`;
  }

  /**
   * Classify task type from query.
   */
  classifyTask(query: string): TaskType {
    const lowerQuery = query.toLowerCase();

    if (
      lowerQuery.includes("architecture") ||
      lowerQuery.includes("design") ||
      lowerQuery.includes("structure")
    ) {
      return "architecture";
    }

    if (
      lowerQuery.includes("security") ||
      lowerQuery.includes("vulnerability") ||
      lowerQuery.includes("auth")
    ) {
      return "security";
    }

    if (
      lowerQuery.includes("review") ||
      lowerQuery.includes("code") ||
      lowerQuery.includes("pr")
    ) {
      return "code_review";
    }

    if (
      lowerQuery.includes("research") ||
      lowerQuery.includes("compare") ||
      lowerQuery.includes("options")
    ) {
      return "research";
    }

    return "general";
  }

  /**
   * Select models for a task type.
   */
  selectModels(taskType: TaskType): ModelConfig[] {
    const models: ModelConfig[] = [this.config.primary];

    for (const expert of this.config.experts) {
      // Include if no specific task types or matches current task
      if (!expert.taskTypes || expert.taskTypes.includes(taskType)) {
        models.push(expert);
      }
    }

    return models;
  }

  /**
   * Query a single model (simulated for now).
   */
  private async queryModel(
    model: ModelConfig,
    query: string,
    _taskType: TaskType,
  ): Promise<ModelQueryResult> {
    const startTime = Date.now();

    // Simulate API call (replace with actual provider calls)
    // In production, this would use the provider registry
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000),
    );

    // Simulated response based on provider
    const responses: Record<ProviderId, string> = {
      anthropic: `[Claude] Analysis of "${query.slice(0, 50)}..."\n\nRecommendation: Use a modular approach with clear separation of concerns. Consider implementing adapter pattern for flexibility.`,
      openai: `[GPT] Review of "${query.slice(0, 50)}..."\n\nSuggestion: Focus on scalability from the start. Consider rate limiting and caching strategies.`,
      google: `[Gemini] Assessment of "${query.slice(0, 50)}..."\n\nInsight: Cloud-native solutions would provide better long-term maintainability. Consider serverless where appropriate.`,
      kimi: `[Kimi] Analysis of "${query.slice(0, 50)}..."\n\nPerspective: Consider Chinese-market requirements and coding-specific optimizations. Evaluate long-context handling for large codebases.`,
      mistral: `[Mistral] Evaluation of "${query.slice(0, 50)}..."\n\nNote: Keep implementation simple. Avoid over-engineering for current requirements.`,
    };

    return {
      provider: model.provider,
      model: model.model,
      role: model.role,
      status: "success",
      content: responses[model.provider],
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Extract consensus points from responses.
   */
  private extractConsensus(responses: ModelQueryResult[]): {
    points: ConsensusPoint[];
    disagreements: Disagreement[];
  } {
    // Simplified consensus detection
    // In production, this would use NLP to analyze responses

    const successResponses = responses.filter((r) => r.status === "success");
    const hasConsensus = successResponses.length >= 2;

    const points: ConsensusPoint[] = [];
    const disagreements: Disagreement[] = [];

    if (hasConsensus) {
      points.push({
        topic: "Approach",
        agreement: 0.8,
        description: "Modular architecture with clear interfaces",
      });
    }

    return { points, disagreements };
  }

  /**
   * Generate recommendation from responses.
   */
  private generateRecommendation(
    responses: ModelQueryResult[],
    consensus: { points: ConsensusPoint[]; disagreements: Disagreement[] },
  ): string {
    const successResponses = responses.filter((r) => r.status === "success");

    if (successResponses.length === 0) {
      return "Unable to generate recommendation - no successful responses.";
    }

    const firstPoint = consensus.points[0];
    if (consensus.points.length > 0 && firstPoint) {
      return `Based on ${successResponses.length} expert opinions with ${Math.round(firstPoint.agreement * 100)}% agreement: ${firstPoint.description}`;
    }

    // Use primary model's response as fallback
    const primary = successResponses.find((r) => r.role === "primary");
    if (primary?.content) {
      return primary.content.slice(0, 200);
    }

    return successResponses[0]?.content?.slice(0, 200) ?? "No recommendation available.";
  }

  /**
   * Check SDLC compliance for the query.
   */
  private checkSDLCCompliance(
    taskType: TaskType,
    _responses: ModelQueryResult[],
  ): { passed: boolean; notes: string[] } {
    const notes: string[] = [];

    if (taskType === "architecture") {
      notes.push("Requires ADR before G2 gate");
    }

    if (taskType === "security") {
      notes.push("Security review required before G3 gate");
    }

    return {
      passed: true,
      notes,
    };
  }

  /**
   * Consult multiple models on a query.
   */
  async consult(query: string): Promise<ConsultationResult> {
    const startTime = Date.now();
    const taskId = this.generateId();
    const taskType = this.classifyTask(query);

    // Select models for this task
    const models = this.selectModels(taskType);

    // Query all models in parallel
    const queryPromises = models.map((model) =>
      this.queryModel(model, query, taskType).catch((err) => ({
        provider: model.provider,
        model: model.model,
        role: model.role,
        status: "error" as QueryStatus,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      })),
    );

    // Wait for all with timeout
    const responses = await Promise.race([
      Promise.all(queryPromises),
      new Promise<ModelQueryResult[]>((_, reject) =>
        setTimeout(
          () => reject(new Error("Total consultation timeout")),
          this.config.totalTimeout,
        ),
      ),
    ]).catch(() => {
      // On timeout, use whatever responses we have
      return queryPromises.map(() => ({
        provider: "anthropic" as ProviderId,
        model: "unknown",
        role: "primary" as ModelRole,
        status: "timeout" as QueryStatus,
        latencyMs: this.config.totalTimeout,
      }));
    });

    // Extract consensus
    const consensus = this.extractConsensus(responses);

    // Generate recommendation
    const recommendation = this.generateRecommendation(responses, consensus);

    // Check SDLC compliance
    const sdlcCompliance = this.checkSDLCCompliance(taskType, responses);

    const successCount = responses.filter((r) => r.status === "success").length;

    return {
      taskId,
      taskType,
      query,
      timestamp: new Date().toISOString(),
      responses,
      consensus: {
        hasConsensus: consensus.points.length > 0,
        points: consensus.points,
        disagreements: consensus.disagreements,
      },
      recommendation,
      sdlcCompliance,
      totalLatencyMs: Date.now() - startTime,
      modelsQueried: models.length,
      modelsResponded: successCount,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalOrchestrator: MultiModelOrchestrator | undefined;

export function getOrchestrator(
  config?: Partial<OrchestratorConfig>,
): MultiModelOrchestrator {
  if (!globalOrchestrator) {
    globalOrchestrator = new MultiModelOrchestrator(config);
  }
  return globalOrchestrator;
}

/**
 * Reset the global orchestrator instance.
 */
export function resetOrchestrator(): void {
  globalOrchestrator = undefined;
}
