/**
 * EndiorBot Configuration Schema
 *
 * Zod-based schema for configuration validation.
 * Simplified for solo developer use - no enterprise team features.
 *
 * @module config/schema
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 1-2
 * @authority ADR-001 Multi-Model Orchestrator, ADR-002 Project Context Switching
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { z } from "zod";

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * AI provider configuration for multi-model orchestration.
 */
export const ProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  enabled: z.boolean().default(true),
  timeout: z.number().positive().default(30000),
  maxRetries: z.number().int().nonnegative().default(3),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// ============================================================================
// Gateway Configuration
// ============================================================================

/**
 * Gateway server configuration.
 */
export const GatewayConfigSchema = z.object({
  port: z.number().int().positive().default(18790),
  host: z.string().default("127.0.0.1"),
  auth: z
    .object({
      token: z.string().optional(),
      password: z.string().optional(),
    })
    .optional(),
});

export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Agent defaults configuration.
 */
export const AgentDefaultsSchema = z.object({
  maxConcurrent: z.number().int().positive().default(3),
  model: z
    .object({
      primary: z.string().default("anthropic/claude-sonnet-4-5"),
    })
    .optional(),
  contextPruning: z
    .object({
      mode: z.enum(["cache-ttl", "sliding-window", "none"]).default("cache-ttl"),
      ttl: z.string().default("1h"),
    })
    .optional(),
  compaction: z
    .object({
      mode: z.enum(["safeguard", "aggressive", "none"]).default("safeguard"),
      threshold: z.number().min(0).max(1).default(0.8),
    })
    .optional(),
});

export type AgentDefaults = z.infer<typeof AgentDefaultsSchema>;

// ============================================================================
// SDLC Configuration
// ============================================================================

/**
 * Project tier determines SDLC rigor level.
 */
export const ProjectTierSchema = z.enum([
  "LITE",
  "STANDARD",
  "PROFESSIONAL",
  "ENTERPRISE",
]);

export type ProjectTier = z.infer<typeof ProjectTierSchema>;

/**
 * SDLC configuration for framework integration.
 */
export const SDLCConfigSchema = z.object({
  frameworkVersion: z.string().default("6.4.0"),
  docsRoot: z.string().default("docs"),
  strict: z.boolean().default(true),
  tier: ProjectTierSchema.default("STANDARD"),
  currentStage: z
    .enum([
      "00-foundation",
      "01-planning",
      "02-design",
      "03-integrate",
      "04-build",
      "05-test",
      "06-deploy",
      "07-operate",
    ])
    .optional(),
  gates: z
    .object({
      autoEvaluate: z.boolean().default(true),
      requireApproval: z.array(z.enum(["G3", "G4"])).default(["G3", "G4"]),
    })
    .optional(),
});

export type SDLCConfig = z.infer<typeof SDLCConfigSchema>;

// ============================================================================
// Multi-Model Orchestrator Configuration
// ============================================================================

/**
 * Model configuration for multi-model orchestration.
 */
export const ModelConfigSchema = z.object({
  provider: z.enum(["anthropic", "openai", "google", "mistral"]),
  model: z.string(),
  role: z.enum(["primary", "expert"]).default("expert"),
  enabled: z.boolean().default(true),
  purpose: z.string().optional(),
  when: z.array(z.string()).optional(),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/**
 * Multi-model orchestrator configuration.
 */
export const OrchestratorConfigSchema = z.object({
  queryMode: z.enum(["parallel", "sequential", "cascade"]).default("parallel"),
  maxParallelQueries: z.number().int().positive().default(3),
  perModelTimeout: z.number().positive().default(30000),
  totalTimeout: z.number().positive().default(60000),
  fallbackBehavior: z.enum(["use_available", "require_minimum", "fail_fast"]).default("use_available"),
  minimumResponses: z.number().int().positive().default(1),
  mergingAlgorithm: z.enum(["weighted_consensus", "simple_majority", "primary_with_notes"]).default("weighted_consensus"),
  primaryModelWeight: z.number().positive().default(1.5),
  expertModelWeight: z.number().positive().default(1.0),
  models: z.array(ModelConfigSchema).optional(),
});

export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

// ============================================================================
// Logging Configuration
// ============================================================================

/**
 * Logging configuration.
 */
export const LoggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error", "fatal"]).default("info"),
  format: z.enum(["json", "pretty"]).default("pretty"),
  redactSensitive: z.enum(["none", "tools", "all"]).default("tools"),
  console: z.boolean().default(true),
  file: z
    .object({
      enabled: z.boolean().default(true),
      path: z.string().optional(),
      maxSize: z.string().default("10MB"),
      maxFiles: z.number().int().positive().default(7),
      dailyRotation: z.boolean().default(true),
    })
    .optional(),
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// ============================================================================
// Security Configuration
// ============================================================================

/**
 * Security configuration for input/output handling.
 */
export const SecurityConfigSchema = z.object({
  inputSanitizer: z
    .object({
      enabled: z.boolean().default(true),
      patterns: z.array(z.string()).optional(),
    })
    .optional(),
  outputScrubber: z
    .object({
      enabled: z.boolean().default(true),
      patterns: z.array(z.string()).optional(),
    })
    .optional(),
  shellGuard: z
    .object({
      enabled: z.boolean().default(true),
      blockedPatterns: z.array(z.string()).optional(),
    })
    .optional(),
});

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// ============================================================================
// Main Configuration Schema
// ============================================================================

/**
 * Complete EndiorBot configuration schema.
 */
export const EndiorBotConfigSchema = z.object({
  meta: z
    .object({
      lastTouchedVersion: z.string().optional(),
      lastTouchedAt: z.string().datetime().optional(),
    })
    .optional(),

  // Gateway
  gateway: GatewayConfigSchema.optional(),

  // Providers (AI model providers)
  providers: z
    .object({
      anthropic: ProviderConfigSchema.optional(),
      openai: ProviderConfigSchema.optional(),
      google: ProviderConfigSchema.optional(),
      mistral: ProviderConfigSchema.optional(),
    })
    .optional(),

  // Agents
  agents: z
    .object({
      defaults: AgentDefaultsSchema.optional(),
    })
    .optional(),

  // SDLC
  sdlc: SDLCConfigSchema.optional(),

  // Multi-model orchestrator
  orchestrator: OrchestratorConfigSchema.optional(),

  // Logging
  logging: LoggingConfigSchema.optional(),

  // Security
  security: SecurityConfigSchema.optional(),

  // Environment variables to inject
  env: z.record(z.string()).optional(),
});

export type EndiorBotConfig = z.infer<typeof EndiorBotConfigSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validation result type.
 */
export type ValidationResult<T> =
  | { ok: true; data: T; warnings: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[]; warnings: ValidationIssue[] };

/**
 * Validation issue type.
 */
export type ValidationIssue = {
  path: string;
  message: string;
  code?: string;
};

/**
 * Parse and validate a config object.
 */
export function parseConfig(input: unknown): ValidationResult<EndiorBotConfig> {
  const result = EndiorBotConfigSchema.safeParse(input);

  if (result.success) {
    return {
      ok: true,
      data: result.data,
      warnings: [],
    };
  }

  const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  return {
    ok: false,
    issues,
    warnings: [],
  };
}

/**
 * Validate config with partial data (for updates).
 */
export function parsePartialConfig(input: unknown): ValidationResult<Partial<EndiorBotConfig>> {
  const result = EndiorBotConfigSchema.partial().safeParse(input);

  if (result.success) {
    return {
      ok: true,
      data: result.data,
      warnings: [],
    };
  }

  const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  return {
    ok: false,
    issues,
    warnings: [],
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: EndiorBotConfig = {
  gateway: {
    port: 18790,
    host: "127.0.0.1",
  },
  agents: {
    defaults: {
      maxConcurrent: 3,
      model: {
        primary: "anthropic/claude-sonnet-4-5",
      },
      contextPruning: {
        mode: "cache-ttl",
        ttl: "1h",
      },
      compaction: {
        mode: "safeguard",
        threshold: 0.8,
      },
    },
  },
  sdlc: {
    frameworkVersion: "6.4.0",
    docsRoot: "docs",
    strict: true,
    tier: "STANDARD",
    gates: {
      autoEvaluate: true,
      requireApproval: ["G3", "G4"],
    },
  },
  orchestrator: {
    queryMode: "parallel",
    maxParallelQueries: 3,
    perModelTimeout: 30000,
    totalTimeout: 60000,
    fallbackBehavior: "use_available",
    minimumResponses: 1,
    mergingAlgorithm: "weighted_consensus",
    primaryModelWeight: 1.5,
    expertModelWeight: 1.0,
  },
  logging: {
    level: "info",
    format: "pretty",
    redactSensitive: "tools",
    console: true,
  },
  security: {
    inputSanitizer: {
      enabled: true,
    },
    outputScrubber: {
      enabled: true,
    },
    shellGuard: {
      enabled: true,
    },
  },
};
