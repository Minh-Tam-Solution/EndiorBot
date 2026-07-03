/**
 * EndiorBot Configuration Module
 *
 * Unified entry point for all configuration functionality.
 * Provides schema validation, I/O operations, defaults, and utilities.
 *
 * @module config
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 5
 * @authority ADR-001 Multi-Model Orchestrator, ADR-002 Project Context Switching
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Schema Types and Validation
// ============================================================================

export {
  // Zod Schemas
  ProviderConfigSchema,
  GatewayConfigSchema,
  AgentDefaultsSchema,
  ProjectTierSchema,
  SDLCConfigSchema,
  ModelConfigSchema,
  OrchestratorConfigSchema,
  LoggingConfigSchema,
  SecurityConfigSchema,
  EndiorBotConfigSchema,
  // Inferred Types
  type ProviderConfig,
  type GatewayConfig,
  type AgentDefaults,
  type ProjectTier,
  type SDLCConfig,
  type ModelConfig,
  type OrchestratorConfig,
  type LoggingConfig,
  type SecurityConfig,
  type EndiorBotConfig,
  // Validation Types
  type ValidationResult,
  type ValidationIssue,
  // Parsing Functions
  parseConfig,
  parsePartialConfig,
  // Default Config
  DEFAULT_CONFIG,
} from "./schema.js";

// ============================================================================
// Validation Utilities
// ============================================================================

export {
  // Validation Functions
  validateConfig,
  validatePartialConfig,
  mergeWithDefaults,
  // Validator Class
  ConfigValidator,
  // Utility Functions
  isConfigLike,
  formatValidationErrors,
  createMinimalConfig,
  // Options Type
  type ValidateConfigOptions,
} from "./validation.js";

// ============================================================================
// Configuration I/O
// ============================================================================

export {
  // Load/Write Functions
  loadConfig,
  writeConfig,
  updateConfig,
  getConfig,
  clearConfigCache,
  // Environment Variable Substitution
  substituteEnvVars,
  substituteEnvVarsDeep,
  // Result Types
  type LoadConfigResult,
  type LoadConfigOptions,
  type WriteConfigResult,
  type WriteConfigOptions,
} from "./io.js";

// ============================================================================
// Default Values
// ============================================================================

export {
  // Environment Overrides
  getEnvironmentDefaults,
  type EnvironmentOverrides,
  // Tier Defaults
  getTierDefaults,
  type TierDefaults,
  // Model Defaults
  DEFAULT_MODELS,
  getDefaultModel,
  // Timeout Defaults
  DEFAULT_TIMEOUTS,
  // Path Defaults
  DEFAULT_PATHS,
  // Security Defaults
  DEFAULT_SECURITY,
} from "./defaults.js";

// ============================================================================
// Environment Variables
// ============================================================================

export {
  // Env Var Names
  ENV_VARS,
  type EnvVarName,
  // Getters
  getEnvVar,
  // Mode Detection
  isDebugMode,
  isNixMode,
  isCIMode,
  isTestMode,
  // Provider Keys
  getProviderApiKey,
  getAvailableProviders,
  // Environment Summary
  getEnvironmentSummary,
} from "./env-vars.js";

// ============================================================================
// Path Utilities
// ============================================================================

export {
  // Path Resolution
  resolveStateDir,
  resolveConfigPath,
  resolveCanonicalConfigPath,
  resolveConfigPathCandidate,
  resolveDefaultConfigCandidates,
  resolveGatewayLockDir,
  resolveGatewayPort,
  resolveOAuthDir,
  resolveOAuthPath,
  // Nix Mode
  resolveIsNixMode,
  isNixMode as isNixModeResolved,
  // Constants
  STATE_DIR,
  CONFIG_PATH,
  DEFAULT_GATEWAY_PORT,
} from "./paths.js";

// ============================================================================
// Feature Flags (Sprint 63+)
// ============================================================================

export {
  // Feature Flag Registry
  FEATURE_FLAGS,
  FEATURE_FLAG_SPRINTS,
  // Type Definitions
  type FeatureFlagKey,
  type FeatureFlagValue,
  // Utility Functions
  isFeatureEnabled,
  getEnabledFeatures,
  getDisabledFeatures,
  getFeatureFlagSummary,
  getFeatureFlagWithEnvOverride,
  getFeaturesForSprint,
} from "./feature-flags.js";

// ============================================================================
// Convenience Re-exports
// ============================================================================

/**
 * Load and validate configuration with defaults applied.
 *
 * This is the recommended way to get configuration in most cases.
 * It loads from disk, applies environment overrides, and validates.
 *
 * @example
 * ```typescript
 * import { getValidatedConfig } from "@config";
 *
 * const config = getValidatedConfig();
 * if (config.ok) {
 *   console.log(config.data.gateway.port);
 * }
 * ```
 */
export { getConfig as getValidatedConfig } from "./io.js";
