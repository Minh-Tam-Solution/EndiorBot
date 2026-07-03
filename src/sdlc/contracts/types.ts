/**
 * Stage Contract Types
 *
 * Type definitions for SDLC Stage Contracts.
 * Stage contracts define required and produced artifacts per SDLC stage.
 *
 * @module sdlc/contracts/types
 * @version 1.0.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 68
 * @authority Master Plan v4.2, Sprint 68 T1.1
 * @sprint 68
 */

// ============================================================================
// SDLC Stages
// ============================================================================

/**
 * All SDLC Framework 6.4.0 stages.
 */
export const SDLC_STAGES = [
  "00-FOUNDATION",
  "01-PLANNING",
  "02-DESIGN",
  "03-INTEGRATE",
  "04-BUILD",
  "05-TEST",
  "06-DEPLOY",
  "07-OPERATE",
  "08-COLLABORATE",
  "09-ARCHIVE",
  "10-ARCHIVE",
] as const;

export type SDLCStage = (typeof SDLC_STAGES)[number];

// ============================================================================
// Artifact Requirements
// ============================================================================

/**
 * Artifact requirement definition.
 * Specifies a required artifact for a stage.
 */
export interface ArtifactRequirement {
  /** Glob pattern to match files (e.g., "ADR-*.md") */
  pattern: string;
  /** Human-readable description */
  description: string;
  /** Whether this requirement is optional */
  optional: boolean;
  /** Minimum number of files matching the pattern */
  minCount: number;
  /** Content validator name (optional) */
  validator?: string;
}

/**
 * Artifact production definition.
 * Specifies an artifact produced by a stage.
 */
export interface ArtifactProduction {
  /** Glob pattern for produced files */
  pattern: string;
  /** Human-readable description */
  description: string;
  /** Auto-scaffold this artifact if missing */
  autoCreate: boolean;
  /** Template to use for auto-creation */
  template?: string;
}

// ============================================================================
// Validation Rules
// ============================================================================

/**
 * Validation rule types.
 */
export type ValidationRuleType =
  | "file_exists"
  | "content_match"
  | "dependency_check"
  | "min_count"
  | "coverage_threshold"
  | "custom";

/**
 * Validation rule definition.
 */
export interface ValidationRule {
  /** Type of validation */
  type: ValidationRuleType;
  /** Pattern or expression to validate */
  pattern: string;
  /** Error message if validation fails */
  message: string;
  /** Severity of the validation */
  severity: "error" | "warning" | "info";
  /** Optional threshold value */
  threshold?: number;
}

// ============================================================================
// Stage Contract
// ============================================================================

/**
 * Stage contract definition.
 * Defines the contract for a single SDLC stage.
 */
export interface StageContract {
  /** Stage identifier (e.g., "04-BUILD") */
  stage: SDLCStage;
  /** Human-readable name (e.g., "Build") */
  name: string;
  /** Description of the stage */
  description?: string;

  // Input/Output
  /** Required artifacts (inputs) for this stage */
  required: ArtifactRequirement[];
  /** Produced artifacts (outputs) from this stage */
  produces: ArtifactProduction[];

  // Governance
  /** Associated gate IDs */
  gates: string[];

  // Validation
  /** Validation rules */
  validation: ValidationRule[];

  // Metadata
  /** Minimum tier required for this stage */
  minTier?: "LITE" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE";
}

// ============================================================================
// Evaluation Results
// ============================================================================

/**
 * Single artifact evaluation result.
 */
export interface ArtifactEvaluation {
  /** The requirement being evaluated */
  requirement: ArtifactRequirement;
  /** Whether the requirement is satisfied */
  satisfied: boolean;
  /** Files found matching the pattern */
  matchedFiles: string[];
  /** Count of matched files */
  matchCount: number;
  /** Reason for failure (if any) */
  reason?: string;
}

/**
 * Single validation result.
 */
export interface ValidationResult {
  /** The validation rule */
  rule: ValidationRule;
  /** Whether validation passed */
  passed: boolean;
  /** Actual value (if applicable) */
  actualValue?: string | number;
  /** Expected value (if applicable) */
  expectedValue?: string | number;
  /** Message for this result */
  message: string;
}

/**
 * Stage contract evaluation result.
 */
export interface ContractEvaluation {
  /** Stage being evaluated */
  stage: SDLCStage;
  /** Contract being evaluated */
  contract: StageContract;

  // Status
  /** Overall compliance status */
  status: "pass" | "warning" | "fail";
  /** Compliance score (0-100) */
  score: number;

  // Details
  /** Artifact evaluations */
  artifacts: ArtifactEvaluation[];
  /** Validation results */
  validations: ValidationResult[];

  // Summary
  /** Missing required artifacts */
  missingArtifacts: string[];
  /** Warnings */
  warnings: string[];
  /** Errors */
  errors: string[];

  // Metadata
  /** Evaluation timestamp */
  evaluatedAt: string;
  /** Evaluation duration (ms) */
  durationMs: number;
}

// ============================================================================
// Engine Configuration
// ============================================================================

/**
 * Stage contract engine configuration.
 */
export interface StageContractEngineConfig {
  /** Project root directory */
  projectRoot: string;
  /** Custom contracts (override defaults) */
  customContracts?: Partial<Record<SDLCStage, Partial<StageContract>>>;
  /** Enable strict mode (errors block transitions) */
  strictMode?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
}

// ============================================================================
// Export Helpers
// ============================================================================

/**
 * Check if a string is a valid SDLC stage.
 */
export function isValidStage(stage: string): stage is SDLCStage {
  return SDLC_STAGES.includes(stage as SDLCStage);
}

/**
 * Get the next stage in the SDLC cycle.
 */
export function getNextStage(stage: SDLCStage): SDLCStage | undefined {
  const index = SDLC_STAGES.indexOf(stage);
  if (index === -1 || index === SDLC_STAGES.length - 1) {
    return undefined;
  }
  return SDLC_STAGES[index + 1];
}

/**
 * Get the previous stage in the SDLC cycle.
 */
export function getPreviousStage(stage: SDLCStage): SDLCStage | undefined {
  const index = SDLC_STAGES.indexOf(stage);
  if (index <= 0) {
    return undefined;
  }
  return SDLC_STAGES[index - 1];
}
