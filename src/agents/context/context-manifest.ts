/**
 * Context Manifest Types
 *
 * Defines the structure of context injection manifest for Claude Code.
 * Tracks what context was injected, token counts, and sources.
 *
 * Tier System:
 * - Tier 1 (MUST): Project, stage, task, gate - always injected
 * - Tier 2 (USEFUL): Decisions, ADRs, patterns - injected for complex tasks
 * - Tier 3 (OPTIONAL): Events, history - rarely injected
 *
 * @module agents/context/context-manifest
 * @version 1.0.0
 * @date 2026-02-28
 * @status ACTIVE - Sprint 55
 */

import type { AgentRole } from "../types/handoff.js";
import type { TaskType, TaskComplexity, ModelTier } from "../types.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Context tier levels.
 */
export type ContextTier = "MUST" | "USEFUL" | "OPTIONAL";

/**
 * Context source types.
 *
 * Sprint 63: Added "search" and "anchor" for Code Search Layer and Context Anchoring.
 * SDLC 6.4.0: Added "workspace_awareness" for Layer 1.25 injection (Agent Continuity).
 */
export type ContextSource =
  | "brain_l4"            // Mental models
  | "brain_l3"            // Structures
  | "brain_l2"            // Patterns
  | "brain_l1"            // Events (rarely used)
  | "soul"                // SOUL template
  | "workspace_awareness" // Workspace discovery directive (SDLC 6.4.0 Layer 1.25)
  | "tier_config"         // Tier configuration
  | "project"             // Project context (active.json)
  | "sdlc_stage"          // Current SDLC stage
  | "git"                 // Git context (branch, recent commits)
  | "codebase"            // Relevant code files (Sprint 63: via search)
  | "search"              // Code search results (Sprint 63)
  | "anchor"              // Context anchors (Sprint 65)
  | "custom";             // Custom injected context

/**
 * Single context item in the manifest.
 */
export interface ContextItem {
  /** Unique identifier */
  id: string;
  /** Context source */
  source: ContextSource;
  /** Context tier */
  tier: ContextTier;
  /** Description of content */
  description: string;
  /** File path if applicable */
  path?: string;
  /** Estimated token count */
  tokens: number;
  /** Whether this was actually injected */
  injected: boolean;
  /** Reason if not injected */
  skipReason?: string;
}

/**
 * Complete context manifest for a single agent invocation.
 */
export interface ContextManifest {
  /** Manifest ID */
  id: string;
  /** Agent being invoked */
  agent: AgentRole;
  /** Task message */
  task: string;
  /** Task classification */
  classification: {
    taskType: TaskType;
    complexity: TaskComplexity;
    minModelTier: ModelTier;
  };
  /** Context items */
  items: ContextItem[];
  /** Summary statistics */
  stats: {
    /** Total items */
    totalItems: number;
    /** Items actually injected */
    injectedItems: number;
    /** Items skipped */
    skippedItems: number;
    /** Total tokens in manifest */
    totalTokens: number;
    /** Tokens actually injected */
    injectedTokens: number;
    /** Budget limit */
    tokenBudget: number;
    /** Budget utilization (0-1) */
    utilization: number;
  };
  /** Tier breakdown */
  tiers: {
    must: { count: number; tokens: number; injected: number };
    useful: { count: number; tokens: number; injected: number };
    optional: { count: number; tokens: number; injected: number };
  };
  /** Creation timestamp */
  createdAt: string;
  /** Duration to build manifest (ms) */
  buildTimeMs: number;
}

/**
 * Manifest builder options.
 */
export interface ManifestBuilderOptions {
  /** Maximum tokens to inject */
  maxTokens: number;
  /** Maximum items to inject */
  maxItems: number;
  /** Include USEFUL tier */
  includeUseful: boolean;
  /** Include OPTIONAL tier */
  includeOptional: boolean;
  /** Force include specific items */
  forceInclude?: string[];
  /** Force exclude specific items */
  forceExclude?: string[];
}

/**
 * Default manifest builder options.
 */
export const DEFAULT_MANIFEST_OPTIONS: ManifestBuilderOptions = {
  maxTokens: 2000,       // Per Master Plan v2.0
  maxItems: 6,           // 3 blocks + some metadata
  includeUseful: true,   // Include for moderate+ complexity
  includeOptional: false, // Rarely needed
};

// ============================================================================
// Manifest Builder
// ============================================================================

/**
 * Build a context manifest from items.
 */
export function buildManifest(
  agent: AgentRole,
  task: string,
  classification: ContextManifest["classification"],
  items: ContextItem[],
  options: ManifestBuilderOptions = DEFAULT_MANIFEST_OPTIONS
): ContextManifest {
  const startTime = Date.now();
  const manifestId = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Initialize tier counts
  const tiers = {
    must: { count: 0, tokens: 0, injected: 0 },
    useful: { count: 0, tokens: 0, injected: 0 },
    optional: { count: 0, tokens: 0, injected: 0 },
  };

  // Process items
  let injectedTokens = 0;
  let injectedCount = 0;

  const processedItems = items.map((item) => {
    // Update tier counts
    const tierKey = item.tier.toLowerCase() as "must" | "useful" | "optional";
    tiers[tierKey].count++;
    tiers[tierKey].tokens += item.tokens;

    // Check if should inject
    let shouldInject = false;
    let skipReason: string | undefined;

    // Force include/exclude
    if (options.forceExclude?.includes(item.id)) {
      skipReason = "Force excluded";
    } else if (options.forceInclude?.includes(item.id)) {
      shouldInject = true;
    } else {
      // Check tier rules
      switch (item.tier) {
        case "MUST":
          shouldInject = true;
          break;
        case "USEFUL":
          shouldInject = options.includeUseful;
          skipReason = shouldInject ? undefined : "USEFUL tier disabled";
          break;
        case "OPTIONAL":
          shouldInject = options.includeOptional;
          skipReason = shouldInject ? undefined : "OPTIONAL tier disabled";
          break;
      }
    }

    // Check budget limits
    if (shouldInject) {
      if (injectedCount >= options.maxItems) {
        shouldInject = false;
        skipReason = "Max items exceeded";
      } else if (injectedTokens + item.tokens > options.maxTokens) {
        shouldInject = false;
        skipReason = "Token budget exceeded";
      }
    }

    // Update injection stats
    if (shouldInject) {
      injectedCount++;
      injectedTokens += item.tokens;
      tiers[tierKey].injected++;
    }

    return {
      ...item,
      injected: shouldInject,
      ...(skipReason ? { skipReason } : {}),
    };
  });

  const totalItems = items.length;
  const totalTokens = items.reduce((sum, i) => sum + i.tokens, 0);
  const skippedItems = totalItems - injectedCount;

  return {
    id: manifestId,
    agent,
    task,
    classification,
    items: processedItems,
    stats: {
      totalItems,
      injectedItems: injectedCount,
      skippedItems,
      totalTokens,
      injectedTokens,
      tokenBudget: options.maxTokens,
      utilization: injectedTokens / options.maxTokens,
    },
    tiers,
    createdAt: new Date().toISOString(),
    buildTimeMs: Date.now() - startTime,
  };
}

/**
 * Create a context item.
 */
export function createContextItem(
  source: ContextSource,
  tier: ContextTier,
  description: string,
  content: string,
  path?: string
): ContextItem {
  const tokens = estimateTokens(content);
  return {
    id: `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    source,
    tier,
    description,
    ...(path ? { path } : {}),
    tokens,
    injected: false, // Will be set by buildManifest
  };
}

/**
 * Estimate tokens for content.
 */
export function estimateTokens(content: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(content.length / 4);
}

/**
 * Format manifest for logging.
 */
export function formatManifestLog(manifest: ContextManifest): string {
  const lines: string[] = [
    `Context Manifest [${manifest.id}]`,
    `Agent: @${manifest.agent}`,
    `Task: ${manifest.task.slice(0, 50)}...`,
    `Complexity: ${manifest.classification.complexity}`,
    ``,
    `Injection Stats:`,
    `  Items: ${manifest.stats.injectedItems}/${manifest.stats.totalItems}`,
    `  Tokens: ${manifest.stats.injectedTokens}/${manifest.stats.tokenBudget} (${Math.round(manifest.stats.utilization * 100)}%)`,
    ``,
    `By Tier:`,
    `  MUST: ${manifest.tiers.must.injected}/${manifest.tiers.must.count} items`,
    `  USEFUL: ${manifest.tiers.useful.injected}/${manifest.tiers.useful.count} items`,
    `  OPTIONAL: ${manifest.tiers.optional.injected}/${manifest.tiers.optional.count} items`,
    ``,
    `Injected:`,
  ];

  for (const item of manifest.items.filter((i) => i.injected)) {
    lines.push(`  + [${item.source}] ${item.description} (${item.tokens} tokens)`);
  }

  if (manifest.stats.skippedItems > 0) {
    lines.push(``, `Skipped:`);
    for (const item of manifest.items.filter((i) => !i.injected)) {
      lines.push(`  - [${item.source}] ${item.description}: ${item.skipReason}`);
    }
  }

  lines.push(``, `Build time: ${manifest.buildTimeMs}ms`);

  return lines.join("\n");
}

/**
 * Get options based on task complexity.
 */
export function getOptionsForComplexity(
  complexity: TaskComplexity
): ManifestBuilderOptions {
  switch (complexity) {
    case "simple":
      return {
        ...DEFAULT_MANIFEST_OPTIONS,
        includeUseful: false,
        includeOptional: false,
        maxItems: 3,
      };
    case "moderate":
      return {
        ...DEFAULT_MANIFEST_OPTIONS,
        includeUseful: true,
        includeOptional: false,
        maxItems: 5,
      };
    case "complex":
      return {
        ...DEFAULT_MANIFEST_OPTIONS,
        includeUseful: true,
        includeOptional: false,
        maxItems: 6,
        maxTokens: 3000,
      };
    case "critical":
      return {
        ...DEFAULT_MANIFEST_OPTIONS,
        includeUseful: true,
        includeOptional: true,
        maxItems: 8,
        maxTokens: 4000,
      };
  }
}
