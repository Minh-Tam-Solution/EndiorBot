/**
 * Quality Module
 *
 * Provides quality assurance patterns for agent interactions:
 * - Reflect-after-tools for self-correction
 * - History compaction for token budget management
 *
 * @module agents/quality
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.2 Implementation
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// Reflect Step
export {
  ReflectStep,
  getReflectStep,
  resetReflectStep,
  REFLECT_PROMPT,
  type ToolResult,
  type ReflectStepConfig,
} from "./reflect-step.js";

// History Compactor
export {
  HistoryCompactor,
  getHistoryCompactor,
  resetHistoryCompactor,
  COMPACTION_THRESHOLD_RATIO,
  KEEP_RECENT,
  MAX_SUMMARY_CHARS,
  STALE_GUARD_DELTA,
  SUMMARIZER_PROMPT,
  type CompactionState,
  type CompactionResult,
  type HistoryCompactorConfig,
} from "./history-compactor.js";
