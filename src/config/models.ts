/**
 * Model Constants — TRUE SSOT for all model ID strings.
 *
 * Every module that references a model ID MUST import from here.
 * Zero hardcoded model strings elsewhere in src/.
 *
 * Sprint 129: Centralized to prevent drift (GPT FIX-3).
 * Sprint 160: True SSOT — named constants, Claude 5 + Kimi K3.
 *
 * @module config/models
 */

// ============================================================================
// Anthropic — Claude 5 family
// ============================================================================

export const SONNET = "claude-sonnet-5" as const;
export const OPUS = "claude-opus-5" as const;
export const HAIKU = "claude-haiku-4-5-20251001" as const;
export const FABLE = "claude-fable-5" as const;

// ============================================================================
// Kimi — TWO distinct namespaces (verified from ~/.kimi-code/config.toml)
//
//   managed:kimi-code   → https://api.kimi.com/coding/v1  (CEO OAuth subscription)
//                         models: k3, k3-256k, kimi-for-coding
//   managed:moonshot-ai → https://api.moonshot.ai/v1      (direct API, dotted ids)
//                         models: kimi-k2.6, kimi-k2.7-code, moonshot-v1-*
//
// API-ID ≠ display-name: picker shows "K3" / "K3-256k" but the model field
// the endpoint accepts is "k3" / "k3-256k". Dot-vs-dash matters: Moonshot
// uses "kimi-k2.6" (dot), never "kimi-k2-6" (dash).
// ============================================================================

// Kimi Code subscription (api.kimi.com/coding)
export const KIMI_K3 = "k3" as const;
export const KIMI_K3_256K = "k3-256k" as const;
export const KIMI_FOR_CODING = "kimi-for-coding" as const; // display "K2.7 Coding"

// Moonshot direct API (api.moonshot.ai) — dotted ids
export const MOONSHOT_K2_7_CODE = "kimi-k2.7-code" as const; // newest Moonshot coding
export const KIMI_K2_6_PROXY = "kimi-k2.6" as const;         // dotted; AnthropicProvider proxy (ADR-053)

// ============================================================================
// Legacy — backward compat for persisted checkpoints/sessions
// ============================================================================

export const LEGACY_SONNET = "claude-sonnet-4-5-20250929" as const;
export const LEGACY_OPUS = "claude-opus-4-5-20251101" as const;
export const LEGACY_HAIKU_3 = "claude-3-haiku-20240307" as const;
export const LEGACY_SONNET_35 = "claude-3-5-sonnet-20241022" as const;
export const LEGACY_KIMI_K2_6 = "kimi-k2-6" as const;       // dash — old EndiorBot data only
export const LEGACY_MOONSHOT_128K = "moonshot-v1-128k" as const;
export const LEGACY_MOONSHOT_32K = "moonshot-v1-32k" as const;

// ============================================================================
// Grouped defaults by provider
// ============================================================================

export const MODELS = {
  OPENAI_DEFAULT: "gpt-5.4",
  GEMINI_DEFAULT: "gemini-2.5-pro",
  OLLAMA_DEFAULT: "qwen3.5:9b",
  ANTHROPIC_DEFAULT: SONNET,
  BUDGET_DEFAULT: SONNET,
  KIMI_CODING_DEFAULT: KIMI_FOR_CODING,   // proven subscription model; k3 available, opt-in
  KIMI_LATEST: KIMI_K3,                    // newest subscription model
  MOONSHOT_DEFAULT: MOONSHOT_K2_7_CODE,    // newest Moonshot direct-API coding model
} as const;

// ============================================================================
// Capability registry — SINGLE SOURCE for context window, pricing, tier.
//
// Consumers (model-selector, task-classifier, budget/*, metrics) resolve
// through THIS map instead of hardcoding numbers. Next vendor upgrade =
// edit here only, zero router/pricing-file changes.
// ============================================================================

export type CapabilityTier = "expert" | "powerful" | "fast" | "fable";

export interface ModelCapabilityProfile {
  provider: "anthropic" | "openai" | "gemini" | "kimi" | "ollama";
  /** Max context window (tokens). */
  contextWindow: number;
  /** Max output tokens. */
  maxOutputTokens: number;
  /** USD per 1M input tokens. */
  inputPer1M: number;
  /** USD per 1M output tokens. */
  outputPer1M: number;
  /** Coarse routing tier. */
  tier: CapabilityTier;
  /** false = pricing is an estimate pending vendor confirmation. */
  pricingConfirmed: boolean;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilityProfile> = {
  [OPUS]:   { provider: "anthropic", contextWindow: 1_000_000, maxOutputTokens: 128_000, inputPer1M: 5,  outputPer1M: 25, tier: "expert",   pricingConfirmed: true },
  [SONNET]: { provider: "anthropic", contextWindow: 1_000_000, maxOutputTokens: 64_000,  inputPer1M: 3,  outputPer1M: 15, tier: "powerful", pricingConfirmed: true },
  [FABLE]:  { provider: "anthropic", contextWindow: 1_000_000, maxOutputTokens: 128_000, inputPer1M: 10, outputPer1M: 50, tier: "fable",    pricingConfirmed: true },
  [HAIKU]:  { provider: "anthropic", contextWindow: 200_000,   maxOutputTokens: 32_000,  inputPer1M: 0.25, outputPer1M: 1.25, tier: "fast", pricingConfirmed: true },
  // Kimi Code subscription. Pricing is an estimate at the Moonshot tier —
  // subscription may be flat-rate; confirm at platform.kimi.ai billing.
  [KIMI_K3]:         { provider: "kimi", contextWindow: 1_000_000, maxOutputTokens: 16_384, inputPer1M: 3, outputPer1M: 15, tier: "powerful", pricingConfirmed: false },
  [KIMI_K3_256K]:    { provider: "kimi", contextWindow: 256_000,   maxOutputTokens: 16_384, inputPer1M: 3, outputPer1M: 15, tier: "powerful", pricingConfirmed: false },
  [KIMI_FOR_CODING]: { provider: "kimi", contextWindow: 256_000,   maxOutputTokens: 16_384, inputPer1M: 3, outputPer1M: 15, tier: "powerful", pricingConfirmed: false },
  [MOONSHOT_K2_7_CODE]: { provider: "kimi", contextWindow: 256_000, maxOutputTokens: 16_384, inputPer1M: 3, outputPer1M: 15, tier: "powerful", pricingConfirmed: false },
  // Other providers (defaults used by the model-selector).
  "gpt-5.4":         { provider: "openai", contextWindow: 400_000,   maxOutputTokens: 128_000, inputPer1M: 5,  outputPer1M: 15, tier: "powerful", pricingConfirmed: false },
  "gemini-2.5-pro":  { provider: "gemini", contextWindow: 1_000_000, maxOutputTokens: 65_536,  inputPer1M: 1.25, outputPer1M: 5, tier: "powerful", pricingConfirmed: false },
  "qwen3.5:9b":      { provider: "ollama", contextWindow: 128_000,   maxOutputTokens: 8_192,   inputPer1M: 0,  outputPer1M: 0,  tier: "fast",     pricingConfirmed: true },
};

/**
 * Capability lookup with a loud, fail-safe fallback.
 * Unknown model → highest-tier pricing proxy (budget-guard trips early, not never).
 */
export function getCapability(model: string): ModelCapabilityProfile {
  const cap = MODEL_CAPABILITIES[model];
  if (cap) return cap;
  return { provider: "anthropic", contextWindow: 200_000, maxOutputTokens: 16_384, inputPer1M: 10, outputPer1M: 50, tier: "fable", pricingConfirmed: false };
}
