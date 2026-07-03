/**
 * History Compactor
 *
 * Auto-summarize conversation history before it hits the hard message/token cap.
 * Ported from SDLC-Orchestrator: history_compactor.py
 *
 * Features:
 *   - Trigger at 80% threshold (configurable)
 *   - Stale-guard to avoid re-compacting on every message
 *   - LLM summarization with fallback to deterministic truncation
 *   - Preserves recent messages verbatim
 *
 * @module agents/quality/history-compactor
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.2 Implementation
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { Message } from "../../providers/types.js";

// ============================================================================
// Constants (ADR-058 §2.3)
// ============================================================================

/**
 * Compact when message count/token count reaches this fraction of max.
 */
export const COMPACTION_THRESHOLD_RATIO = 0.80;

/**
 * Messages to keep verbatim (most recent) after compaction.
 */
export const KEEP_RECENT = 20;

/**
 * Maximum characters for the generated summary.
 */
export const MAX_SUMMARY_CHARS = 2000;

/**
 * Stale-guard: skip re-compaction if message count grew by less than this.
 */
export const STALE_GUARD_DELTA = 5;

/**
 * Summarizer system prompt (ZeroClaw N5 verbatim).
 */
export const SUMMARIZER_PROMPT =
  "You are a conversation summarizer. Summarize the following conversation " +
  "history in at most 2000 characters. " +
  "Preserve: user preferences, commitments, decisions, unresolved tasks, " +
  "key facts. " +
  "Omit: filler, repeated chit-chat, verbose tool logs. " +
  "Output only the summary text.";

// ============================================================================
// Types
// ============================================================================

export interface CompactionState {
  /**
   * Current summary from previous compaction (if any).
   */
  compactionSummary?: string;

  /**
   * Message count at last compaction.
   */
  lastCompactedMessages?: number;

  /**
   * ISO 8601 timestamp of last compaction.
   */
  lastCompactedAt?: string;
}

export interface CompactionResult {
  /**
   * Whether compaction was performed.
   */
  compacted: boolean;

  /**
   * The generated summary (if compacted).
   */
  summary?: string;

  /**
   * Number of messages compacted.
   */
  compactedCount?: number;

  /**
   * Number of messages kept.
   */
  keptCount?: number;

  /**
   * New message array (if compacted).
   */
  messages?: Message[];
}

export interface HistoryCompactorConfig {
  /**
   * Compaction threshold ratio (default: 0.80).
   */
  thresholdRatio?: number;

  /**
   * Messages to keep recent after compaction (default: 20).
   */
  keepRecent?: number;

  /**
   * Maximum summary characters (default: 2000).
   */
  maxSummaryChars?: number;

  /**
   * Stale guard delta (default: 5).
   */
  staleGuardDelta?: number;

  /**
   * Custom summarizer function (optional).
   * If not provided, fallback truncation is used.
   */
  summarizer?: (text: string) => Promise<string>;
}

// ============================================================================
// History Compactor Class
// ============================================================================

export class HistoryCompactor {
  private readonly thresholdRatio: number;
  private readonly keepRecent: number;
  private readonly maxSummaryChars: number;
  private readonly staleGuardDelta: number;
  private readonly summarizer: ((text: string) => Promise<string>) | undefined;

  /**
   * Create a new HistoryCompactor instance.
   *
   * @param config - Configuration options
   */
  constructor(config: HistoryCompactorConfig = {}) {
    this.thresholdRatio = config.thresholdRatio ?? COMPACTION_THRESHOLD_RATIO;
    this.keepRecent = config.keepRecent ?? KEEP_RECENT;
    this.maxSummaryChars = config.maxSummaryChars ?? MAX_SUMMARY_CHARS;
    this.staleGuardDelta = config.staleGuardDelta ?? STALE_GUARD_DELTA;
    this.summarizer = config.summarizer ?? undefined;
  }

  /**
   * Check if compaction should fire.
   *
   * Conditions:
   * 1. Current count >= max * thresholdRatio
   * 2. Stale-guard: count has grown by >= staleGuardDelta since last compaction
   *
   * @param currentCount - Current message or token count
   * @param maxCount - Maximum allowed count
   * @param state - Previous compaction state
   * @returns true if compaction should run
   */
  shouldCompact(
    currentCount: number,
    maxCount: number,
    state: CompactionState = {},
  ): boolean {
    const threshold = Math.floor(maxCount * this.thresholdRatio);

    if (currentCount < threshold) {
      return false;
    }

    // Stale-guard check
    const lastCompactedCount = state.lastCompactedMessages ?? 0;
    const delta = currentCount - lastCompactedCount;

    if (delta < this.staleGuardDelta) {
      return false;
    }

    return true;
  }

  /**
   * Perform compaction on messages array.
   *
   * @param messages - Full message history
   * @param maxCount - Maximum allowed count (messages or tokens)
   * @param state - Previous compaction state (will be updated)
   * @returns Compaction result with new messages and summary
   */
  async compact(
    messages: Message[],
    maxCount: number,
    state: CompactionState = {},
  ): Promise<CompactionResult> {
    const currentCount = messages.length;

    if (!this.shouldCompact(currentCount, maxCount, state)) {
      return { compacted: false };
    }

    if (messages.length <= this.keepRecent) {
      // Nothing to compact - all messages fit in recent window
      return { compacted: false };
    }

    // Split messages into older and recent
    const olderMessages = messages.slice(0, -this.keepRecent);
    const recentMessages = messages.slice(-this.keepRecent);

    // Build text representation of older messages
    const olderText = this.messagesToText(olderMessages);

    // Generate summary
    const summary = await this.summarize(olderText);

    // Create new message array with summary + recent
    const summaryMessage: Message = {
      role: "system",
      content: `Previous conversation summary:\n${summary}`,
    };

    const newMessages: Message[] = [summaryMessage, ...recentMessages];

    // Update state
    state.compactionSummary = summary;
    state.lastCompactedMessages = currentCount;
    state.lastCompactedAt = new Date().toISOString();

    return {
      compacted: true,
      summary,
      compactedCount: olderMessages.length,
      keptCount: recentMessages.length,
      messages: newMessages,
    };
  }

  /**
   * Generate summary for older messages.
   *
   * Uses configured summarizer if available, otherwise falls back to truncation.
   *
   * @param text - Plain text of older messages
   * @returns Summary string
   */
  private async summarize(text: string): Promise<string> {
    if (this.summarizer) {
      try {
        const summary = await this.summarizer(text);
        return summary.slice(0, this.maxSummaryChars);
      } catch {
        // Fall back to truncation on any error
        return this.fallbackTruncate(text);
      }
    }

    return this.fallbackTruncate(text);
  }

  /**
   * Deterministic fallback: truncate text to maxSummaryChars.
   *
   * @param text - Full message text
   * @returns Truncated string with indicator if needed
   */
  private fallbackTruncate(text: string): string {
    if (text.length <= this.maxSummaryChars) {
      return text;
    }

    const truncated = text.slice(0, this.maxSummaryChars - 20);
    return `${truncated}\n[...truncated]`;
  }

  /**
   * Convert messages array to plain text for summarization.
   *
   * @param messages - Messages to convert
   * @returns Plain text representation
   */
  private messagesToText(messages: Message[]): string {
    const lines: string[] = [];

    for (const msg of messages) {
      const role = msg.role;
      const content = this.extractContent(msg);

      // Limit each message to 500 chars to avoid huge summaries
      const excerpt =
        content.length > 500 ? `${content.slice(0, 497)}...` : content;

      lines.push(`[${role}]: ${excerpt}`);
    }

    return lines.join("\n\n");
  }

  /**
   * Extract text content from a message.
   *
   * @param message - Message to extract from
   * @returns Plain text content
   */
  private extractContent(message: Message): string {
    if (typeof message.content === "string") {
      return message.content;
    }

    // Handle array content (multimodal)
    return message.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalCompactor: HistoryCompactor | undefined;

export function getHistoryCompactor(
  config?: HistoryCompactorConfig,
): HistoryCompactor {
  if (!globalCompactor) {
    globalCompactor = new HistoryCompactor(config);
  }
  return globalCompactor;
}

/**
 * Reset the global HistoryCompactor instance.
 * Useful for testing or reconfiguration.
 */
export function resetHistoryCompactor(): void {
  globalCompactor = undefined;
}
