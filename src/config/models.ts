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
// Kimi / Moonshot
// ============================================================================

export const KIMI_K3 = "kimi-k3" as const;
export const KIMI_K3_256K = "kimi-k3-256k" as const;
export const KIMI_FOR_CODING = "kimi-for-coding" as const;

// ============================================================================
// Legacy — backward compat for persisted checkpoints/sessions
// ============================================================================

export const LEGACY_SONNET = "claude-sonnet-4-5-20250929" as const;
export const LEGACY_OPUS = "claude-opus-4-5-20251101" as const;
export const LEGACY_HAIKU_3 = "claude-3-haiku-20240307" as const;
export const LEGACY_SONNET_35 = "claude-3-5-sonnet-20241022" as const;
export const LEGACY_KIMI_K2_6 = "kimi-k2-6" as const;
export const LEGACY_MOONSHOT_128K = "moonshot-v1-128k" as const;
export const LEGACY_MOONSHOT_32K = "moonshot-v1-32k" as const;

// ============================================================================
// Kimi passthrough (AnthropicProvider proxy — ADR-053)
// ============================================================================

export const KIMI_K2_6_PROXY = "kimi-k2.6" as const;

// ============================================================================
// Grouped defaults by provider
// ============================================================================

export const MODELS = {
  OPENAI_DEFAULT: "gpt-5.4",
  GEMINI_DEFAULT: "gemini-2.5-pro",
  OLLAMA_DEFAULT: "qwen3.5:9b",
  ANTHROPIC_DEFAULT: SONNET,
  BUDGET_DEFAULT: SONNET,
} as const;
