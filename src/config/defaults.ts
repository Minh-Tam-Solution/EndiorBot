/**
 * EndiorBot Configuration Defaults
 *
 * Default configuration values and environment-aware overrides.
 * Provides sensible defaults for all configuration options.
 *
 * @module config/defaults
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 3-4
 * @authority ADR-001 Multi-Model Orchestrator, ADR-002 Project Context Switching
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { DEFAULT_CONFIG, type ProjectTier } from "./schema.js";

// ============================================================================
// Re-export DEFAULT_CONFIG for convenience
// ============================================================================

export { DEFAULT_CONFIG };

// ============================================================================
// Environment-Aware Defaults
// ============================================================================

/**
 * Environment override result type.
 */
export type EnvironmentOverrides = {
  gateway?: { port: number };
  logging?: { level: "debug" | "info" | "warn" | "error" };
  sdlc?: { tier: ProjectTier };
};

/**
 * Get default config with environment-specific overrides.
 *
 * @param env - Environment variables
 * @returns Config overrides from environment
 */
export function getEnvironmentDefaults(
  env: NodeJS.ProcessEnv = process.env,
): EnvironmentOverrides {
  const overrides: EnvironmentOverrides = {};

  // Gateway port from environment
  const portEnv = env.ENDIORBOT_GATEWAY_PORT;
  if (portEnv) {
    const port = Number.parseInt(portEnv, 10);
    if (Number.isFinite(port) && port > 0) {
      overrides.gateway = { port };
    }
  }

  // Log level from environment
  const logLevelEnv = env.ENDIORBOT_LOG_LEVEL?.toLowerCase();
  if (logLevelEnv && ["debug", "info", "warn", "error"].includes(logLevelEnv)) {
    overrides.logging = {
      level: logLevelEnv as "debug" | "info" | "warn" | "error",
    };
  }

  // Debug mode enables verbose logging
  if (env.ENDIORBOT_DEBUG === "1" || env.ENDIORBOT_DEBUG === "true") {
    overrides.logging = { level: "debug" };
  }

  // SDLC tier from environment
  const tierEnv = env.ENDIORBOT_TIER?.toUpperCase();
  if (
    tierEnv &&
    ["LITE", "STANDARD", "PROFESSIONAL", "ENTERPRISE"].includes(tierEnv)
  ) {
    overrides.sdlc = { tier: tierEnv as ProjectTier };
  }

  return overrides;
}

// ============================================================================
// Tier-Specific Defaults
// ============================================================================

/**
 * Tier defaults result type.
 */
export type TierDefaults = {
  agents?: {
    defaults: {
      maxConcurrent: number;
      model: { primary: string };
      contextPruning: { mode: string; ttl: string };
      compaction: { mode: string; threshold: number };
    };
  };
  orchestrator?: {
    queryMode: string;
    maxParallelQueries: number;
    perModelTimeout: number;
    totalTimeout: number;
    fallbackBehavior: string;
    minimumResponses: number;
    mergingAlgorithm: string;
    primaryModelWeight: number;
    expertModelWeight: number;
  };
  sdlc?: {
    frameworkVersion: string;
    docsRoot: string;
    tier: ProjectTier;
    strict: boolean;
    gates?: {
      autoEvaluate: boolean;
      requireApproval: string[];
    };
  };
  logging?: {
    level: string;
    format: string;
    redactSensitive: string;
    file?: {
      enabled: boolean;
      maxSize: string;
      maxFiles: number;
    };
  };
};

/**
 * Get tier-specific default overrides.
 *
 * @param tier - Project tier
 * @returns Config overrides for the tier
 */
export function getTierDefaults(tier: ProjectTier): TierDefaults {
  switch (tier) {
    case "LITE":
      return {
        agents: {
          defaults: {
            maxConcurrent: 1,
            model: { primary: "anthropic/claude-haiku-4" },
            contextPruning: { mode: "none", ttl: "1h" },
            compaction: { mode: "none", threshold: 0.8 },
          },
        },
        orchestrator: {
          queryMode: "sequential",
          maxParallelQueries: 1,
          perModelTimeout: 30000,
          totalTimeout: 60000,
          fallbackBehavior: "use_available",
          minimumResponses: 1,
          mergingAlgorithm: "primary_with_notes",
          primaryModelWeight: 1.5,
          expertModelWeight: 1.0,
        },
        sdlc: {
          frameworkVersion: "6.4.0",
          docsRoot: "docs",
          tier: "LITE",
          strict: false,
          gates: {
            autoEvaluate: false,
            requireApproval: [],
          },
        },
      };

    case "STANDARD":
      return {
        sdlc: {
          frameworkVersion: "6.4.0",
          docsRoot: "docs",
          tier: "STANDARD",
          strict: true,
          gates: {
            autoEvaluate: true,
            requireApproval: ["G3", "G4"],
          },
        },
      };

    case "PROFESSIONAL":
      return {
        agents: {
          defaults: {
            maxConcurrent: 5,
            model: { primary: "anthropic/claude-sonnet-4-5" },
            contextPruning: { mode: "cache-ttl", ttl: "2h" },
            compaction: { mode: "safeguard", threshold: 0.75 },
          },
        },
        orchestrator: {
          queryMode: "parallel",
          maxParallelQueries: 5,
          perModelTimeout: 45000,
          totalTimeout: 90000,
          fallbackBehavior: "require_minimum",
          minimumResponses: 2,
          mergingAlgorithm: "weighted_consensus",
          primaryModelWeight: 1.5,
          expertModelWeight: 1.0,
        },
        sdlc: {
          frameworkVersion: "6.4.0",
          docsRoot: "docs",
          tier: "PROFESSIONAL",
          strict: true,
          gates: {
            autoEvaluate: true,
            requireApproval: ["G3", "G4"],
          },
        },
      };

    case "ENTERPRISE":
      return {
        agents: {
          defaults: {
            maxConcurrent: 10,
            model: { primary: "anthropic/claude-opus-4-5" },
            contextPruning: { mode: "cache-ttl", ttl: "4h" },
            compaction: { mode: "aggressive", threshold: 0.7 },
          },
        },
        orchestrator: {
          queryMode: "parallel",
          maxParallelQueries: 10,
          perModelTimeout: 60000,
          totalTimeout: 120000,
          fallbackBehavior: "require_minimum",
          minimumResponses: 3,
          mergingAlgorithm: "weighted_consensus",
          primaryModelWeight: 2.0,
          expertModelWeight: 1.0,
        },
        sdlc: {
          frameworkVersion: "6.4.0",
          docsRoot: "docs",
          tier: "ENTERPRISE",
          strict: true,
          gates: {
            autoEvaluate: true,
            requireApproval: ["G3", "G4"],
          },
        },
        logging: {
          level: "info",
          format: "pretty",
          redactSensitive: "tools",
          file: {
            enabled: true,
            maxSize: "50MB",
            maxFiles: 10,
          },
        },
      };

    default:
      return {};
  }
}

// ============================================================================
// Model Defaults
// ============================================================================

/**
 * Default model configurations for each provider.
 */
export const DEFAULT_MODELS = {
  anthropic: {
    primary: "claude-sonnet-4-5",
    expert: "claude-opus-4-5",
    fast: "claude-haiku-4",
  },
  openai: {
    primary: "gpt-5",
    expert: "gpt-5",
    fast: "gpt-5-mini",
  },
  google: {
    primary: "gemini-2-pro",
    expert: "gemini-2-ultra",
    fast: "gemini-2-flash",
  },
  mistral: {
    primary: "mistral-large",
    expert: "mistral-large",
    fast: "mistral-small",
  },
} as const;

/**
 * Get default model for a provider and role.
 */
export function getDefaultModel(
  provider: keyof typeof DEFAULT_MODELS,
  role: "primary" | "expert" | "fast" = "primary",
): string {
  return DEFAULT_MODELS[provider]?.[role] ?? DEFAULT_MODELS.anthropic[role];
}

// ============================================================================
// Timeout Defaults
// ============================================================================

/**
 * Default timeout values in milliseconds.
 */
export const DEFAULT_TIMEOUTS = {
  /** Per-model query timeout */
  modelQuery: 30000,
  /** Total orchestration timeout */
  orchestration: 60000,
  /** Config file I/O timeout */
  configIo: 5000,
  /** HTTP request timeout */
  httpRequest: 30000,
  /** WebSocket connection timeout */
  websocket: 10000,
  /** Shell command timeout */
  shellCommand: 60000,
} as const;

// ============================================================================
// Path Defaults
// ============================================================================

/**
 * Default directory names.
 */
export const DEFAULT_PATHS = {
  /** State directory name */
  stateDir: ".endiorbot",
  /** Config file name */
  configFile: "endiorbot.json",
  /** Projects subdirectory */
  projectsDir: "projects",
  /** Credentials subdirectory */
  credentialsDir: "credentials",
  /** Backups subdirectory */
  backupsDir: "backups",
  /** Logs subdirectory */
  logsDir: "logs",
} as const;

// ============================================================================
// Security Defaults
// ============================================================================

/**
 * Default security patterns.
 */
export const DEFAULT_SECURITY = {
  /** Input sanitizer patterns */
  inputPatterns: [
    "sql-injection",
    "xss",
    "command-injection",
    "path-traversal",
  ],
  /** Output scrubber patterns */
  outputPatterns: [
    "api-key",
    "password",
    "token",
    "secret",
    "credential",
    "private-key",
  ],
  /** Shell guard blocked commands */
  blockedCommands: [
    "rm -rf /",
    "rm -rf ~",
    "DROP TABLE",
    "DELETE FROM",
    "FORMAT C:",
  ],
} as const;
