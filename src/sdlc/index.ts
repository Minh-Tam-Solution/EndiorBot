/**
 * SDLC Module
 *
 * SDLC Framework v6.4.0 compliance automation:
 * - Gate evaluation (G0-G4, G-Sprint)
 * - Vibecoding Index calculation
 * - Change Request Package (CRP) generation
 * - Merge-Readiness Package (MRP) generation
 *
 * @module sdlc
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.4 Implementation
 * @authority ADR-004 SDLC Gate Engine
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// Gates
export {
  // Checklist exports
  G0_CHECKLIST,
  G01_CHECKLIST,
  G1_CHECKLIST,
  G2_CHECKLIST,
  G3_CHECKLIST,
  G4_CHECKLIST,
  GSPRINT_CHECKLIST,
  GATE_CHECKLISTS,
  getChecklist,
  getGatesInOrder,
  getPreviousGate,
  meetsMinTier,
  type GateId,
  type ProjectTier,
  type ChecklistStatus,
  type ChecklistItem,
  type GateChecklist,
  // Engine exports
  GateEngine,
  getGateEngine,
  resetGateEngine,
  type Evidence,
  type VibecodingResult,
  type GateEvaluation,
  type GateEngineConfig,
  // Gate Confirmation Store
  loadGateConfirmations,
  saveGateConfirmation,
  isGateConfirmed,
  getGateConfirmation,
  type GateConfirmation,
  // Gate Item Mark Store (Sprint 143 A3)
  loadGateMarks,
  saveGateItemMark,
  isItemMarked,
  getItemMark,
  removeGateItemMark,
  type GateItemMark,
} from "./gates/index.js";

// Vibecoding
export {
  VibecodingCalculator,
  getVibecodingCalculator,
  resetVibecodingCalculator,
  ZONE_THRESHOLDS,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  type VibecodingZone,
  type VibecodingSignal,
  type VibecodingResult as VibecodingIndexResult,
  type VibecodingMetrics,
  type VibecodingConfig,
} from "./vibecoding/index.js";

// CRP Service
export {
  CRPService,
  getCRPService,
  resetCRPService,
  type ChangeType,
  type ChangePriority,
  type ImpactLevel,
  type ChangeItem,
  type ImpactAnalysis,
  type ChangeRequestPackage,
  type CRPConfig,
} from "./crp-service.js";

// MRP Service
export {
  MRPService,
  getMRPService,
  resetMRPService,
  DEFAULT_MRP_CHECKS,
  type MRPCheckStatus,
  type MRPCheck,
  type CodeReview,
  type MergeReadinessPackage,
  type MRPConfig,
} from "./mrp-service.js";

// Patches (Sprint 68)
export {
  // Types
  type PatchState,
  type ChangeType as PatchChangeType,
  type DiffHunk,
  type FileChange,
  type Patch,
  type CreatePatchOptions,
  type RecordChangeOptions,
  type PatchHistoryOptions,
  type RollbackResult,
  type PatchManagerConfig,
  type PatchEventType,
  type PatchEvent,
  // Manager
  PatchManager,
  getPatchManager,
  resetPatchManager,
} from "./patches/index.js";

// Stage Contracts (Sprint 68)
export {
  // Stage constants
  SDLC_STAGES,
  type SDLCStage,
  // Contract types
  type ArtifactRequirement,
  type ArtifactProduction,
  type ValidationRuleType,
  type ValidationRule,
  type StageContract,
  type ArtifactEvaluation,
  type ValidationResult,
  type ContractEvaluation,
  type StageContractEngineConfig,
  // Default contracts
  STAGE_CONTRACTS,
  getStageContract,
  getAllContracts,
  getContractsForTier,
  // Engine
  StageContractEngine,
  getStageContractEngine,
  resetStageContractEngine,
  // Helpers
  isValidStage,
  getNextStage,
  getPreviousStage,
} from "./contracts/index.js";

// Dashboard (Sprint 68)
export {
  // Types
  type ComplianceStatus,
  type IssueSeverity,
  type ComplianceIssue,
  type StageCompliance,
  type GateResult,
  type ComplianceDashboard,
  type ReportFormat,
  type ReportOptions,
  type ComplianceReport,
  type DashboardConfig,
  // Dashboard Engine
  ComplianceDashboardEngine,
  getComplianceDashboard,
  resetComplianceDashboard,
  // Report Generator
  ReportGenerator,
} from "./dashboard/index.js";
