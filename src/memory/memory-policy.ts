/**
 * Memory Policy — Safety guardrails for ClawVault integration (ADR-038)
 *
 * Allowlist types, scrubber, TTL, eviction, opt-out.
 * CPO C-CPO-2 binding condition.
 *
 * @module memory/memory-policy
 * @version 1.0.0
 * @date 2026-03-31
 * @status ACTIVE — Sprint 124a
 * @authority ADR-038 Autonomous Workflow Integration
 * @sdlc SDLC Framework 6.4.0
 */

import { scrub } from "../security/output-scrubber.js";
import type { StructuredFact } from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/** Allowed observation types — no raw code, no credentials */
/** Agreed allowlist per ADR-038 + CPO C-CPO-2 */
const ALLOWED_TYPES = new Set([
  "decision",
  "bugfix",
  "discovery",
  "architecture_choice",
]);

/** Maximum facts per project (FIFO eviction) */
const MAX_FACTS_PER_PROJECT = 500;

/** TTL in days — facts older than this are evicted */
const FACT_TTL_DAYS = 30;

/** Max tokens for memory injection (within 2K turn budget) */
export const MAX_MEMORY_TOKENS = 300;

// ============================================================================
// Policy Checks
// ============================================================================

/**
 * Check if memory is disabled via environment.
 */
export function isMemoryDisabled(): boolean {
  return process.env.ENDIORBOT_MEMORY_DISABLED === "true";
}

/**
 * Check if a fact type is allowed for persistence.
 */
export function isAllowedFactType(type: string): boolean {
  return ALLOWED_TYPES.has(type);
}

/**
 * Scrub sensitive content from a fact value before persistence.
 * Uses existing output-redactor.
 */
export function scrubFactValue(value: string): string {
  const result = scrub(value);
  return result.scrubbed;
}

/**
 * Evict expired facts (older than TTL).
 * Returns only non-expired, non-superseded facts.
 */
export function evictExpiredFacts(facts: StructuredFact[]): StructuredFact[] {
  const cutoff = Date.now() - FACT_TTL_DAYS * 24 * 60 * 60 * 1000;

  return facts.filter((fact) => {
    // Skip superseded facts
    if (fact.validUntil) return false;
    // Check TTL
    const factTime = new Date(fact.validFrom).getTime();
    return factTime > cutoff;
  });
}

/**
 * Enforce max facts limit (FIFO — keep newest).
 */
export function enforceMaxFacts(facts: StructuredFact[]): StructuredFact[] {
  if (facts.length <= MAX_FACTS_PER_PROJECT) return facts;
  // Sort by validFrom descending, keep newest
  const sorted = [...facts].sort(
    (a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime(),
  );
  return sorted.slice(0, MAX_FACTS_PER_PROJECT);
}

/**
 * Format facts for injection into agent context.
 * Capped at MAX_MEMORY_TOKENS (~300 tokens ≈ 1200 chars).
 */
export function formatFactsForInjection(facts: StructuredFact[]): string {
  if (facts.length === 0) return "";

  const maxChars = MAX_MEMORY_TOKENS * 4; // ~4 chars per token
  let result = "[Memory — past decisions]\n";
  let charCount = result.length;

  for (const fact of facts) {
    const line = `- ${fact.entity}: ${fact.value}\n`;
    if (charCount + line.length > maxChars) break;
    result += line;
    charCount += line.length;
  }

  return result.trim();
}
