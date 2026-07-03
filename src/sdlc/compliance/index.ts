/**
 * Compliance Module
 *
 * Exports for SDLC compliance checking and auto-fix.
 *
 * @module sdlc/compliance
 * @version 2.0.0
 * @date 2026-03-03
 * @status ACTIVE - Sprint 75 (fix engine added)
 * @sdlc SDLC Framework 6.4.0
 */

// Content checker (L2 compliance)
export {
  checkL2Compliance,
  checkStageContent,
  countContentLines,
  countPlaceholders,
  isPlaceholderLine,
  STAGE_CONTENT_REQUIREMENTS,
  type ContentIssue,
  type L2Result,
  type StageContentResult,
} from "./content-checker.js";

// Fix types & constants
export {
  MAX_GENERATED_FILE_SIZE,
  STAGE_AGENT_MAP,
  STAGE_AGENT_FALLBACK,
  STAGE_PROCESSING_ORDER,
  STAGE_GATE_MAP,
  AGENT_SKILL_MAP,
  normalizeStageKey,
  getAgentForStage,
  type AgentFixTask,
  type ComplianceFixConfig,
  type ComplianceFixResult,
  type FixAction,
  type FixActionResult,
  type AgentTaskResult,
  type GeneratorConfig,
  type ProjectSnapshot,
  type TechStackInfo,
  type CodeModule,
  type TestFileInfo,
  type ExistingDocInfo,
} from "./fix-types.js";

// Project context collector
export { collectProjectContext } from "./project-context-collector.js";

// Issue mapper
export { mapIssuesToFixTasks } from "./issue-mapper.js";

// Content generator
export {
  generateContent,
  type ContentGeneratorBridge,
  type ContentGeneratorDeps,
} from "./content-generator.js";

// Fix engine
export {
  ComplianceFixEngine,
  createComplianceFixEngine,
} from "./fix-engine.js";

// CLAUDE.md auditor (Sprint 153)
export {
  auditClaudeMd,
  acceptWarning,
} from "./claude-md-auditor.js";
export type {
  AuditResult,
  AuditWarning,
  AuditFileInfo,
  AuditBaseline,
  AuditSeverity,
} from "./claude-md-auditor.js";
