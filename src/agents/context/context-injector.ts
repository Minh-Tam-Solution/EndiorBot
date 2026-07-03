/**
 * Context Injector
 *
 * Builds Claude Code prompts by injecting Brain L1-L4 context,
 * SOUL templates, and project context.
 *
 * Injection Flow:
 * 1. Load SOUL template for agent
 * 2. Load Brain L4 (mental models) - always
 * 3. Load Brain L3 (structures) - for moderate+ tasks
 * 4. Load Brain L2 (patterns) - for complex+ tasks
 * 5. Load project context (active.json)
 * 6. Build manifest and construct prompt
 *
 * @module agents/context/context-injector
 * @version 1.0.0
 * @date 2026-02-28
 * @status ACTIVE - Sprint 55
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { AgentRole } from "../types/handoff.js";
import type { TaskType, TaskComplexity, ModelTier } from "../types.js";
import { resolveTemplatesRoot } from "../../config/paths.js";
import {
  type ContextManifest,
  type ContextItem,
  buildManifest,
  createContextItem,
  getOptionsForComplexity,
  formatManifestLog,
} from "./context-manifest.js";
import {
  WORKSPACE_AWARENESS_SECTION,
  WORKSPACE_AWARENESS_SOURCE_ID,
} from "./workspace-awareness.js";
import {
  readMentalModels,
  readStructures,
  readPatterns,
  type MentalModelEntry,
  type StructureEntry,
  type PatternEntry,
} from "../../brain/index.js";
import { getContextBudget, type ContextBudget } from "../../brain/context-budget.js";
import { createLogger, type Logger } from "../../logging/index.js";
import { isFeatureEnabled } from "../../config/feature-flags.js";
import {
  RgProvider,
  createPolicy,
  getRetrievalLogger,
  type SearchResponse,
} from "../../search/index.js";
import {
  getContextAnchor,
  getSprintGoalManager,
  getGitContextManager,
  getAnchorBudget,
  formatCheckpointCompact,
  formatBlockerCompact,
  type Checkpoint,
} from "../../context/index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Context injection configuration.
 */
export interface InjectionConfig {
  /** Root directory for templates */
  templatesRoot: string;
  /** Project context file path */
  projectContextPath: string;
  /** Current tier */
  tier: "LITE" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE";
  /** Session ID for budget tracking */
  sessionId: string;
  /** Enable verbose logging */
  verbose: boolean;
}

/**
 * Injection request.
 */
export interface InjectionRequest {
  /** Target agent */
  agent: AgentRole;
  /** Task message */
  task: string;
  /** Task classification */
  classification: {
    taskType: TaskType;
    complexity: TaskComplexity;
    minModelTier: ModelTier;
  };
  /** Workspace path */
  workspace: string;
  /** Additional context to inject */
  additionalContext?: string;
}

/**
 * Injection result.
 */
export interface InjectionResult {
  /** Constructed prompt */
  prompt: string;
  /** System prompt (SOUL + context) */
  systemPrompt: string;
  /** User prompt (task) */
  userPrompt: string;
  /** Context manifest */
  manifest: ContextManifest;
  /** SOUL template content */
  soulContent: string;
  /** Token budget allocation */
  budgetAllocation: {
    tokens: number;
    budget: number;
    utilization: number;
  };
}

/**
 * Default injection configuration.
 */
export const DEFAULT_INJECTION_CONFIG: InjectionConfig = {
  templatesRoot: "docs/reference/templates",
  projectContextPath: ".sdlc-config.json",
  tier: "LITE",
  sessionId: "default",
  verbose: false,
};

// ============================================================================
// ContextInjector Class
// ============================================================================

/**
 * Injects context into Claude Code prompts.
 *
 * Usage:
 * ```typescript
 * const injector = new ContextInjector();
 *
 * const result = await injector.inject({
 *   agent: "pm",
 *   task: "Plan payment gateway integration",
 *   classification: { taskType: "architecture", complexity: "complex" },
 *   workspace: "/path/to/project",
 * });
 *
 * // Use result.prompt for Claude Code invocation
 * ```
 */
export class ContextInjector {
  private readonly config: InjectionConfig;
  private readonly log: Logger;
  private readonly budget: ContextBudget;

  constructor(config: Partial<InjectionConfig> = {}) {
    this.config = { ...DEFAULT_INJECTION_CONFIG, ...config };
    this.log = createLogger("context-injector");
    this.budget = getContextBudget();
  }

  // ==========================================================================
  // Main Injection Method
  // ==========================================================================

  /**
   * Build and inject context for an agent invocation.
   */
  async inject(request: InjectionRequest): Promise<InjectionResult> {
    const startTime = Date.now();
    this.log.info("Starting context injection", {
      agent: request.agent,
      task: request.task.slice(0, 50),
      complexity: request.classification.complexity,
    });

    // 1. Load SOUL template
    const soulContent = await this.loadSoul(request.agent);

    // 2. Collect context items
    const items: ContextItem[] = [];

    // 2a. SOUL template (MUST)
    items.push(
      createContextItem(
        "soul",
        "MUST",
        `SOUL template for @${request.agent}`,
        soulContent,
        this.getSoulPath(request.agent)
      )
    );

    // 2a.5 (Layer 1.25). Workspace Awareness directive (MUST) - SDLC 6.4.0
    // Static module constant: no runtime interpolation, no caller-supplied text.
    // Injected between SOUL and Brain L4 to guarantee every agent runs
    // workspace discovery before asking the user for workspace-visible state.
    // Ref: .sdlc-framework/05-Templates-Tools/04-SASE-Artifacts/Agent-Continuity-Runtime-Guidance.md
    items.push(
      createContextItem(
        WORKSPACE_AWARENESS_SOURCE_ID,
        "MUST",
        "Workspace awareness directive (SDLC 6.4.0 Layer 1.25)",
        WORKSPACE_AWARENESS_SECTION
      )
    );

    // 2b. Brain L4 - Mental Models (MUST)
    const mentalModels = await this.loadMentalModels();
    if (mentalModels) {
      items.push(
        createContextItem(
          "brain_l4",
          "MUST",
          "Mental models and decision heuristics",
          mentalModels
        )
      );
    }

    // 2c. Project context (MUST)
    const projectContext = await this.loadProjectContext(request.workspace);
    if (projectContext) {
      items.push(
        createContextItem(
          "project",
          "MUST",
          "Project configuration and SDLC state",
          projectContext,
          join(request.workspace, this.config.projectContextPath)
        )
      );
    }

    // 2d. Brain L3 - Structures (USEFUL for moderate+)
    if (
      request.classification.complexity !== "simple"
    ) {
      const structures = await this.loadStructures();
      if (structures) {
        items.push(
          createContextItem(
            "brain_l3",
            "USEFUL",
            "Project structures and relationships",
            structures
          )
        );
      }
    }

    // 2e. Brain L2 - Patterns (USEFUL for complex+)
    if (
      request.classification.complexity === "complex" ||
      request.classification.complexity === "critical"
    ) {
      const patterns = await this.loadPatterns();
      if (patterns) {
        items.push(
          createContextItem(
            "brain_l2",
            "USEFUL",
            "Recognized patterns and anti-patterns",
            patterns
          )
        );
      }
    }

    // 2f. Codebase search results (USEFUL for BUILD/TEST stages) - Sprint 63
    if (isFeatureEnabled("SEARCH_ENABLED")) {
      const searchContext = await this.loadCodebaseContext(
        request.workspace,
        request.task,
        request.classification.complexity,
        request.agent
      );
      if (searchContext) {
        items.push(
          createContextItem(
            "search",
            "USEFUL",
            "Relevant code from codebase search",
            searchContext
          )
        );
      }
    }

    // 2g. Context anchoring (MUST for sprint goals, USEFUL for checkpoints) - Sprint 65
    if (isFeatureEnabled("CONTEXT_ANCHORING")) {
      const anchorContext = await this.loadAnchorContext();
      if (anchorContext) {
        items.push(
          createContextItem(
            "anchor",
            "MUST",
            "Sprint goals and context anchors",
            anchorContext
          )
        );
      }
    }

    // 2h. Additional context (USEFUL)
    if (request.additionalContext) {
      items.push(
        createContextItem(
          "custom",
          "USEFUL",
          "Additional context",
          request.additionalContext
        )
      );
    }

    // 3. Build manifest with budget-aware options
    const options = getOptionsForComplexity(request.classification.complexity);
    const manifest = buildManifest(
      request.agent,
      request.task,
      request.classification,
      items,
      options
    );

    // 4. Construct prompts
    const systemPrompt = this.buildSystemPrompt(manifest, soulContent);
    const userPrompt = this.buildUserPrompt(request);
    const prompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    // 5. Record budget usage
    this.budget.recordTurn(this.config.sessionId, manifest.stats.injectedTokens);

    // Log manifest if verbose
    if (this.config.verbose) {
      this.log.debug(formatManifestLog(manifest));
    }

    this.log.info("Context injection complete", {
      agent: request.agent,
      injectedItems: manifest.stats.injectedItems,
      injectedTokens: manifest.stats.injectedTokens,
      utilization: Math.round(manifest.stats.utilization * 100),
      buildTimeMs: Date.now() - startTime,
    });

    return {
      prompt,
      systemPrompt,
      userPrompt,
      manifest,
      soulContent,
      budgetAllocation: {
        tokens: manifest.stats.injectedTokens,
        budget: manifest.stats.tokenBudget,
        utilization: manifest.stats.utilization,
      },
    };
  }

  // ==========================================================================
  // Context Loading
  // ==========================================================================

  /**
   * Load SOUL template for an agent.
   */
  private async loadSoul(agent: AgentRole): Promise<string> {
    const soulPath = this.getSoulPath(agent);

    if (!existsSync(soulPath)) {
      this.log.warn(`SOUL template not found: ${soulPath}`);
      return this.getDefaultSoul(agent);
    }

    try {
      const content = await readFile(soulPath, "utf-8");
      // Remove YAML frontmatter if present
      const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
      const body = bodyMatch?.[1];
      return body ? body.trim() : content.trim();
    } catch (err) {
      this.log.error(`Failed to load SOUL template: ${soulPath}`, { error: err });
      return this.getDefaultSoul(agent);
    }
  }

  /**
   * Load Brain L4 - Mental Models.
   */
  private async loadMentalModels(): Promise<string | undefined> {
    try {
      const models = readMentalModels();
      if (models.length === 0) return undefined;

      // Format mental models as concise rules
      const formatted = models
        .map((m: MentalModelEntry) => `- ${m.domain}: ${m.rule}`)
        .join("\n");

      return `## Decision Heuristics\n\n${formatted}`;
    } catch {
      this.log.warn("Failed to load mental models");
      return undefined;
    }
  }

  /**
   * Load Brain L3 - Structures.
   */
  private async loadStructures(): Promise<string | undefined> {
    try {
      const structures = readStructures();
      if (structures.length === 0) return undefined;

      // Format structures as concise list
      const formatted = structures
        .slice(0, 5) // Limit to 5 most recent
        .map((s: StructureEntry) => `- ${s.type}: ${s.projectId}`)
        .join("\n");

      return `## Project Structures\n\n${formatted}`;
    } catch {
      this.log.warn("Failed to load structures");
      return undefined;
    }
  }

  /**
   * Load Brain L2 - Patterns.
   */
  private async loadPatterns(): Promise<string | undefined> {
    try {
      const patterns = readPatterns();
      if (patterns.length === 0) return undefined;

      // Format patterns as concise list
      const formatted = patterns
        .slice(0, 5) // Limit to 5 most recent
        .map((p: PatternEntry) => `- ${p.type}: ${p.signature}${p.fixHint ? ` (${p.fixHint})` : ""}`)
        .join("\n");

      return `## Recognized Patterns\n\n${formatted}`;
    } catch {
      this.log.warn("Failed to load patterns");
      return undefined;
    }
  }

  /**
   * Load project context.
   */
  private async loadProjectContext(workspace: string): Promise<string | undefined> {
    const contextPath = join(workspace, this.config.projectContextPath);

    if (!existsSync(contextPath)) {
      return undefined;
    }

    try {
      const content = await readFile(contextPath, "utf-8");
      const config = JSON.parse(content);

      // Extract relevant fields
      const summary = {
        project: config.project?.name ?? "Unknown",
        tier: config.sdlc?.tier ?? this.config.tier,
        currentStage: config.sdlc?.currentStage ?? "unknown",
        features: config.sdlc?.features ?? [],
      };

      return `## Project Context\n\n${JSON.stringify(summary, null, 2)}`;
    } catch {
      this.log.warn(`Failed to load project context: ${contextPath}`);
      return undefined;
    }
  }

  /**
   * Load codebase context via code search.
   * Sprint 63: Code Search Layer integration.
   *
   * @param workspace - Workspace path
   * @param task - Task description (used as search query)
   * @param complexity - Task complexity
   * @param agent - Agent role
   */
  private async loadCodebaseContext(
    workspace: string,
    task: string,
    complexity: TaskComplexity,
    agent: AgentRole
  ): Promise<string | undefined> {
    // Only search for non-simple tasks
    if (complexity === "simple") {
      return undefined;
    }

    try {
      // Extract search terms from task
      const searchQuery = this.extractSearchTerms(task);
      if (!searchQuery) {
        return undefined;
      }

      // Create search provider
      const provider = new RgProvider({ cwd: workspace });

      // Check if provider is available
      const health = await provider.healthCheck();
      if (!health.available) {
        this.log.debug("RgProvider not available, skipping codebase search");
        return undefined;
      }

      // Create retrieval policy based on stage and role
      const policy = createPolicy(undefined, `@${agent}`);

      // Apply policy to search options
      const searchOptions = policy.applyToSearchOptions({
        query: searchQuery,
        topK: 5, // Limit results for context injection
        contextLines: 2,
      });

      // Execute search
      const response: SearchResponse = await provider.search(searchOptions);

      // Log evidence if enabled
      const logger = getRetrievalLogger();
      await logger.logSearchEvidence(response, searchQuery);

      // Check if we have results
      if (response.hits.length === 0) {
        return undefined;
      }

      // Enrich results with policy
      const enrichedHits = policy.enrichResults(response.hits);

      // Format results for injection
      const formatted = this.formatSearchResults(enrichedHits, response);

      return formatted;
    } catch (error) {
      this.log.debug("Codebase search failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Extract search terms from task description.
   */
  private extractSearchTerms(task: string): string | null {
    // Extract key terms from task
    // Remove common words and keep technical terms
    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been",
      "being", "have", "has", "had", "do", "does", "did", "will",
      "would", "could", "should", "may", "might", "must", "can",
      "and", "or", "but", "if", "then", "else", "when", "where",
      "what", "which", "who", "how", "why", "this", "that", "these",
      "those", "it", "its", "to", "of", "in", "for", "on", "with",
      "at", "by", "from", "as", "into", "through", "during", "before",
      "after", "above", "below", "between", "under", "again", "further",
      "once", "here", "there", "all", "each", "few", "more", "most",
      "other", "some", "such", "no", "not", "only", "same", "so",
      "than", "too", "very", "just", "also", "now", "please", "help",
      "need", "want", "create", "add", "update", "modify", "change",
      "fix", "implement", "make", "build", "write", "read",
    ]);

    const words = task
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    if (words.length === 0) {
      return null;
    }

    // Take first 5 meaningful words
    return words.slice(0, 5).join(" ");
  }

  /**
   * Format search results for context injection.
   */
  private formatSearchResults(
    hits: Array<{ path: string; line: number; content: string; specSnapshotMatch: boolean }>,
    response: SearchResponse
  ): string {
    const lines: string[] = [
      `## Relevant Code (${response.totalHits} matches, ${response.elapsed_ms}ms)`,
      "",
    ];

    for (const hit of hits.slice(0, 5)) {
      lines.push(`### ${hit.path}:${hit.line}${hit.specSnapshotMatch ? " ⭐" : ""}`);
      lines.push("```");
      lines.push(hit.content.trim());
      lines.push("```");
      lines.push("");
    }

    if (response.truncated) {
      lines.push(`*${response.totalHits - hits.length} more results truncated*`);
    }

    return lines.join("\n");
  }

  /**
   * Load context anchoring state.
   * Sprint 65: Context Anchoring integration.
   * Sprint 65 T5.14: Token budget optimization.
   *
   * Injects:
   * - Current sprint goal (prevents context drift)
   * - Recent checkpoint info
   * - Active blockers
   *
   * Uses budget-aware loading to optimize token usage:
   * - Full mode: Complete formatting
   * - Compact mode: Abbreviated formatting
   * - Minimal mode: Single-line summaries
   */
  private async loadAnchorContext(): Promise<string | undefined> {
    try {
      const sprintManager = getSprintGoalManager();
      const anchor = getContextAnchor();
      const gitManager = getGitContextManager();
      const anchorBudget = getAnchorBudget();

      // Collect components first to estimate tokens
      const currentGoal = await sprintManager.getCurrent();
      const checkpoints = await anchor.getCheckpoints();
      const blockers = await anchor.getBlockers();
      const gitContext = await gitManager.getContext(3);

      // Estimate tokens for each component
      const gitTokens = gitContext.isGitRepo
        ? anchorBudget.estimateTokens(gitManager.formatForContext(gitContext))
        : 0;
      const sprintGoalTokens = currentGoal
        ? sprintManager.estimateTokens(currentGoal, false)
        : 0;
      const checkpointTokens = checkpoints.length > 0 ? 50 : 0; // ~50 tokens for checkpoint
      const blockerTokens = blockers.length * 30; // ~30 tokens per blocker

      // Allocate budget
      const allocation = anchorBudget.allocate({
        gitTokens,
        sprintGoalTokens,
        checkpointTokens,
        blockerTokens,
      });

      const sections: string[] = [];
      const useCompact = allocation.strategy !== "full";

      // 0. Git context (T5.10 - branch context)
      if (gitContext.isGitRepo && !allocation.droppedItems.includes("git")) {
        if (useCompact) {
          sections.push(gitManager.getCompactContext(gitContext));
        } else {
          sections.push(gitManager.formatForContext(gitContext));
        }
      }

      // 1. Current sprint goal (critical for context)
      if (currentGoal && !allocation.droppedItems.includes("sprintGoal")) {
        sections.push("");
        if (useCompact) {
          sections.push(sprintManager.formatCompact(currentGoal));
        } else {
          sections.push(sprintManager.formatForContext(currentGoal));
        }
      }

      // 2. Recent checkpoint info
      if (
        checkpoints.length > 0 &&
        !allocation.droppedItems.includes("checkpoint")
      ) {
        const recent = checkpoints[0] as Checkpoint;
        sections.push("");
        if (useCompact) {
          sections.push(formatCheckpointCompact(recent));
        } else {
          sections.push("## Last Checkpoint");
          sections.push("");
          sections.push(`**Name:** ${recent.name}`);
          sections.push(`**Created:** ${recent.createdAt.toISOString()}`);
          sections.push(`**Trigger:** ${recent.trigger}`);
        }
      }

      // 3. Active blockers
      if (blockers.length > 0 && !allocation.droppedItems.includes("blockers")) {
        sections.push("");
        if (useCompact) {
          const blockerLines = blockers.slice(0, 3).map(formatBlockerCompact);
          sections.push(`Blockers: ${blockerLines.join("; ")}`);
        } else {
          sections.push("## Active Blockers");
          sections.push("");
          for (const blocker of blockers.slice(0, 5)) {
            sections.push(`- ⚠️ ${blocker.title}: ${blocker.description}`);
          }
        }
      }

      if (sections.length === 0) {
        return undefined;
      }

      // Log budget usage
      this.log.debug("Anchor context loaded", {
        strategy: allocation.strategy,
        totalTokens: allocation.totalTokens,
        truncated: allocation.truncated,
        droppedItems: allocation.droppedItems,
      });

      return sections.join("\n");
    } catch (error) {
      this.log.debug("Failed to load anchor context", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  // ==========================================================================
  // Prompt Construction
  // ==========================================================================

  /**
   * Build system prompt from manifest.
   */
  private buildSystemPrompt(manifest: ContextManifest, soulContent: string): string {
    const sections: string[] = [];

    // Add SOUL content
    sections.push(soulContent);

    // Layer 1.25: Workspace Awareness directive (SDLC 6.4.0) - always injected
    // right after SOUL so every agent sees the discovery protocol before Brain
    // L4 context is evaluated. Emitted explicitly (not via manifest items)
    // because the static constant is authoritative and must not be subject to
    // manifest filtering/truncation.
    const workspaceItem = manifest.items.find(
      (i) => i.source === WORKSPACE_AWARENESS_SOURCE_ID && i.injected
    );
    if (workspaceItem) {
      sections.push("\n---\n");
      sections.push(WORKSPACE_AWARENESS_SECTION);
    }

    // Add injected context (excluding soul + workspace_awareness already emitted)
    const injectedItems = manifest.items.filter(
      (i) =>
        i.injected &&
        i.source !== "soul" &&
        i.source !== WORKSPACE_AWARENESS_SOURCE_ID
    );

    if (injectedItems.length > 0) {
      sections.push("\n---\n\n## Context");

      for (const item of injectedItems) {
        // The content was stored during item creation
        // but we need to retrieve it from the original items
        sections.push(`\n### ${item.description}`);
        // Note: In a real implementation, we'd store content in items
        // For now, the content is embedded in the item creation
      }
    }

    // Add handoff format reminder
    sections.push(`
---

## Handoff Format

When your task is complete or you need another agent, respond with:

\`\`\`json
{
  "handoff": [
    {
      "to": "<agent-role>",
      "intent": "<what-they-should-do>",
      "priority": "P0|P1|P2",
      "inputs": {},
      "reason": "<why-handoff-needed>"
    }
  ]
}
\`\`\`

Valid agents: researcher, pm, pjm, architect, coder, reviewer, tester, devops
`);

    return sections.join("\n");
  }

  /**
   * Build user prompt from request.
   */
  private buildUserPrompt(request: InjectionRequest): string {
    return `## Task

${request.task}

## Workspace

${request.workspace}

## Task Type

${request.classification.taskType} (${request.classification.complexity} complexity)

---

Please complete this task following your SOUL guidelines. If you need to hand off to another agent, use the handoff JSON format.`;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Get SOUL template path for an agent.
   * Resolves from EndiorBot's package directory, not process.cwd().
   */
  private getSoulPath(agent: AgentRole): string {
    return join(
      resolveTemplatesRoot(),
      "souls",
      `SOUL-${agent}.md`
    );
  }

  /**
   * Get default SOUL content for an agent.
   */
  private getDefaultSoul(agent: AgentRole): string {
    return `# SOUL - ${agent}

You are a ${agent} agent in an SDLC workflow.
Follow best practices and communicate clearly.
Use the handoff format when you need another agent.
`;
  }

  /**
   * Get current budget status.
   */
  getBudgetStatus(): {
    sessionId: string;
    turnsUsed: number;
    needsReset: boolean;
  } {
    const session = this.budget.getSession(this.config.sessionId);
    return {
      sessionId: this.config.sessionId,
      turnsUsed: session.turnCount,
      needsReset: this.budget.needsReset(this.config.sessionId),
    };
  }

  /**
   * Update configuration.
   */
  setConfig(config: Partial<InjectionConfig>): void {
    Object.assign(this.config, config);
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let globalInjector: ContextInjector | undefined;

/**
 * Get the global ContextInjector instance.
 */
export function getContextInjector(
  config?: Partial<InjectionConfig>
): ContextInjector {
  if (!globalInjector) {
    globalInjector = new ContextInjector(config);
  }
  return globalInjector;
}

/**
 * Reset the global ContextInjector (for testing).
 */
export function resetContextInjector(): void {
  globalInjector = undefined;
}

/**
 * Create a new ContextInjector instance.
 */
export function createContextInjector(
  config?: Partial<InjectionConfig>
): ContextInjector {
  return new ContextInjector(config);
}
