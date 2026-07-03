/**
 * Context Budget Governance
 *
 * Token budget management for CEO Tool MVP (Sprint 54).
 * Implements Master Plan v2.0 requirements:
 * - Max 2K tokens/turn for context injection
 * - Max 3 blocks injected per turn
 * - Hard reset after 30 turns
 *
 * @module brain/context-budget
 * @version 1.0.0
 * @date 2026-02-28
 * @status ACTIVE - Sprint 54
 * @authority Master Plan v2.0 Section 6
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { createLogger, type Logger } from "../logging/index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Context block with priority.
 */
export interface ContextBlock {
  /** Block identifier */
  id: string;
  /** Block type */
  type: "mental_models" | "structures" | "patterns" | "events" | "custom";
  /** Block content */
  content: string;
  /** Token count */
  tokens: number;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Source layer (L1-L4) */
  layer: 1 | 2 | 3 | 4;
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Budget allocation result.
 */
export interface BudgetAllocation {
  /** Selected blocks within budget */
  blocks: ContextBlock[];
  /** Total tokens allocated */
  totalTokens: number;
  /** Tokens remaining */
  remainingTokens: number;
  /** Blocks dropped due to budget */
  droppedBlocks: ContextBlock[];
  /** Whether budget was exceeded */
  budgetExceeded: boolean;
}

/**
 * Session state for turn tracking.
 */
export interface SessionState {
  /** Session ID */
  sessionId: string;
  /** Current turn count */
  turnCount: number;
  /** Tokens used this session */
  tokensUsed: number;
  /** Last reset timestamp */
  lastReset: string;
  /** Created timestamp */
  createdAt: string;
}

/**
 * Context budget configuration.
 */
export interface ContextBudgetConfig {
  /** Max tokens per turn */
  maxTokensPerTurn: number;
  /** Max blocks per turn */
  maxBlocksPerTurn: number;
  /** Hard reset after N turns */
  hardResetAfterTurns: number;
  /** Warning threshold (% of budget) */
  warningThreshold: number;
}

// ============================================================================
// Constants (per Master Plan v2.0)
// ============================================================================

/** Default context budget configuration */
export const DEFAULT_CONTEXT_BUDGET_CONFIG: ContextBudgetConfig = {
  maxTokensPerTurn: 2000,      // 2K max
  maxBlocksPerTurn: 3,         // 3 blocks max
  hardResetAfterTurns: 30,     // Reset context every 30 turns
  warningThreshold: 0.8,       // Warn at 80% usage
};

/** Injection priority by layer (per Master Plan v2.0) */
export const LAYER_PRIORITY: Record<number, number> = {
  4: 1,  // L4 Mental Models - highest priority (always inject)
  3: 2,  // L3 Structures - inject on project switch
  2: 3,  // L2 Patterns - inject on similar errors
  1: 4,  // L1 Events - never inject (too noisy)
};

/** Rough estimate: ~4 characters per token */
const CHARS_PER_TOKEN = 4;

// ============================================================================
// ContextBudget Class
// ============================================================================

/**
 * ContextBudget - Token budget governance for Brain injection.
 *
 * Features:
 * - Max 2K tokens/turn for context injection
 * - Max 3 blocks injected per turn
 * - Priority-based selection (L4 > L3 > L2 > L1)
 * - Hard reset after 30 turns
 * - Budget warning at 80%
 *
 * Usage:
 * ```typescript
 * const budget = getContextBudget();
 *
 * // Allocate blocks within budget
 * const allocation = budget.allocate([
 *   { type: 'mental_models', content: '...', layer: 4 },
 *   { type: 'structures', content: '...', layer: 3 },
 * ]);
 *
 * // Check if reset needed
 * if (budget.needsReset(sessionId)) {
 *   budget.reset(sessionId);
 * }
 * ```
 */
export class ContextBudget {
  private log: Logger;
  private config: ContextBudgetConfig;
  private sessions: Map<string, SessionState> = new Map();

  constructor(config: Partial<ContextBudgetConfig> = {}) {
    this.log = createLogger("context-budget");
    this.config = { ...DEFAULT_CONTEXT_BUDGET_CONFIG, ...config };
  }

  /**
   * Estimate tokens for a string.
   */
  estimateTokens(content: string): number {
    return Math.ceil(content.length / CHARS_PER_TOKEN);
  }

  /**
   * Create a context block.
   */
  createBlock(
    id: string,
    type: ContextBlock["type"],
    content: string,
    layer: ContextBlock["layer"],
  ): ContextBlock {
    return {
      id,
      type,
      content,
      tokens: this.estimateTokens(content),
      priority: LAYER_PRIORITY[layer] ?? 5,
      layer,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Allocate blocks within token budget.
   *
   * Selection algorithm:
   * 1. Sort by priority (lower = higher priority)
   * 2. Take blocks until budget exhausted
   * 3. Max 3 blocks per turn
   */
  allocate(blocks: ContextBlock[]): BudgetAllocation {
    // Sort by priority (L4 first, then L3, L2, L1)
    const sorted = [...blocks].sort((a, b) => a.priority - b.priority);

    const selectedBlocks: ContextBlock[] = [];
    const droppedBlocks: ContextBlock[] = [];
    let totalTokens = 0;

    for (const block of sorted) {
      // Check block limit
      if (selectedBlocks.length >= this.config.maxBlocksPerTurn) {
        droppedBlocks.push(block);
        continue;
      }

      // Check token limit
      if (totalTokens + block.tokens > this.config.maxTokensPerTurn) {
        droppedBlocks.push(block);
        continue;
      }

      // Skip L1 Events (too noisy)
      if (block.layer === 1) {
        droppedBlocks.push(block);
        continue;
      }

      selectedBlocks.push(block);
      totalTokens += block.tokens;
    }

    const budgetExceeded = droppedBlocks.length > 0;

    if (budgetExceeded) {
      this.log.warn("Context budget exceeded", {
        selected: selectedBlocks.length,
        dropped: droppedBlocks.length,
        totalTokens,
        maxTokens: this.config.maxTokensPerTurn,
      });
    }

    return {
      blocks: selectedBlocks,
      totalTokens,
      remainingTokens: this.config.maxTokensPerTurn - totalTokens,
      droppedBlocks,
      budgetExceeded,
    };
  }

  /**
   * Get or create session state.
   */
  getSession(sessionId: string): SessionState {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        sessionId,
        turnCount: 0,
        tokensUsed: 0,
        lastReset: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  /**
   * Record a turn for a session.
   */
  recordTurn(sessionId: string, tokensUsed: number): SessionState {
    const session = this.getSession(sessionId);
    session.turnCount++;
    session.tokensUsed += tokensUsed;

    this.log.debug("Turn recorded", {
      sessionId,
      turnCount: session.turnCount,
      tokensUsed: session.tokensUsed,
    });

    return session;
  }

  /**
   * Check if session needs hard reset.
   */
  needsReset(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    return session.turnCount >= this.config.hardResetAfterTurns;
  }

  /**
   * Reset session (hard reset after 30 turns).
   */
  reset(sessionId: string): SessionState {
    const session = this.getSession(sessionId);
    session.turnCount = 0;
    session.tokensUsed = 0;
    session.lastReset = new Date().toISOString();

    this.log.info("Session reset", { sessionId });
    return session;
  }

  /**
   * Check if approaching budget warning threshold.
   */
  isApproachingLimit(tokensUsed: number): boolean {
    return tokensUsed >= this.config.maxTokensPerTurn * this.config.warningThreshold;
  }

  /**
   * Get budget status for a session.
   */
  getStatus(sessionId: string): {
    session: SessionState;
    config: ContextBudgetConfig;
    needsReset: boolean;
  } {
    return {
      session: this.getSession(sessionId),
      config: this.config,
      needsReset: this.needsReset(sessionId),
    };
  }

  /**
   * Get configuration.
   */
  getConfig(): ContextBudgetConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<ContextBudgetConfig>): void {
    this.config = { ...this.config, ...config };
    this.log.info("Config updated", { config: this.config });
  }

  /**
   * Clear all sessions (for testing).
   */
  clearSessions(): void {
    this.sessions.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalContextBudget: ContextBudget | undefined;

/**
 * Get the global ContextBudget instance.
 */
export function getContextBudget(config?: Partial<ContextBudgetConfig>): ContextBudget {
  if (!globalContextBudget) {
    globalContextBudget = new ContextBudget(config);
  }
  return globalContextBudget;
}

/**
 * Reset the global ContextBudget (for testing).
 */
export function resetContextBudget(): void {
  globalContextBudget = undefined;
}
