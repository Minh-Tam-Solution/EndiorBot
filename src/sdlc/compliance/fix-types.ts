/**
 * Compliance Fix Types
 *
 * Types, constants, and mappings for the compliance fix engine.
 * Maps SDLC stages to responsible agents, defines processing order,
 * and provides cross-stage context types.
 *
 * @module sdlc/compliance/fix-types
 * @version 1.0.0
 * @date 2026-03-03
 * @status ACTIVE - Sprint 75
 * @authority ADR-018 AI-Generated Compliance Content
 * @sprint 75
 */

import type { AgentRole } from "../../agents/types/handoff.js";
import type { ContentIssue, StageContentResult } from "./content-checker.js";
import type { ProjectTier } from "../scaffold/types.js";

// ============================================================================
// Constants
// ============================================================================

/** W4: Max file size for AI-generated content (50KB) */
export const MAX_GENERATED_FILE_SIZE = 50 * 1024;

// ============================================================================
// Stage → Agent Mapping
// ============================================================================

/**
 * Maps SDLC stages (lowercase) to the responsible agent role.
 * Used by the compliance fix engine to determine which agent
 * generates content for each stage.
 */
export const STAGE_AGENT_MAP: Record<string, AgentRole> = {
  "00-foundation": "pm",
  "01-planning": "pm",
  "02-design": "architect",
  "03-integrate": "architect",
  "04-build": "pjm",
  "05-test": "tester",
  "06-deploy": "devops",
  "07-operate": "devops",
  "08-collaborate": "pm",
  "09-govern": "pm",
  "10-archive": "pm",
};

/**
 * Tier-aware fallback agents when the primary agent is unavailable.
 * E.g., @tester is only available in PROFESSIONAL+ — STANDARD uses @reviewer.
 */
export const STAGE_AGENT_FALLBACK: Partial<Record<string, Partial<Record<ProjectTier, AgentRole>>>> = {
  "05-test": { LITE: "fullstack", STANDARD: "reviewer" },
};

// ============================================================================
// Stage Processing Order
// ============================================================================

/**
 * Stage processing order — ensures cross-stage dependencies.
 * Compliance fix processes stages sequentially in this order,
 * feeding each stage's output as context to subsequent stages.
 */
export const STAGE_PROCESSING_ORDER: string[] = [
  "00-foundation",
  "01-planning",
  "02-design",
  "03-integrate",
  "04-build",
  "05-test",
  "06-deploy",
  "07-operate",
  "08-collaborate",
  "09-govern",
  "10-archive",
];

// ============================================================================
// Stage → Gate Mapping (Dual-Track per SDLC 6.3.1)
// ============================================================================

/**
 * Maps stages to their applicable gates.
 * Feature gates: G0→G4, Sprint gates: G-Sprint, G-Sprint-Close.
 */
export const STAGE_GATE_MAP: Record<string, string[]> = {
  "00-foundation": ["G0"],
  "01-planning":   ["G0.1", "G1"],
  "02-design":     ["G2"],
  "03-integrate":  ["G2"],         // integration contracts validated at design gate
  "04-build":      ["G-Sprint"],  // CTO C4: G-Sprint-Close collapsed into G-Sprint
  "05-test":       ["G3"],
  "06-deploy":     ["G4"],
  "07-operate":    ["G4"],         // operations readiness confirmed post-deployment
  "08-collaborate":["G-Sprint"],   // team practices validated per sprint cadence
  "09-govern":     ["G4"],         // governance confirms G4 compliance
  "10-archive":    [],             // no gate — archive is post-governance
};

// ============================================================================
// SDLC 6.3.1 Stage Metadata
// ============================================================================

/**
 * Stage guiding questions per SDLC 6.3.1 — 10-Stage Lifecycle (Pillar 1).
 * Each stage is driven by a core question that all documentation must answer.
 */
export const STAGE_QUESTIONS: Record<string, string> = {
  "00-foundation": "WHY are we building this?",
  "01-planning":   "WHAT are we building?",
  "02-design":     "HOW will we build it?",
  "03-integrate":  "How do components CONNECT?",
  "04-build":      "Are we BUILDING it right?",
  "05-test":       "Does it WORK correctly?",
  "06-deploy":     "Can we SHIP safely?",
  "07-operate":    "Is it RUNNING reliably?",
  "08-collaborate":"Is the team EFFECTIVE?",
  "09-govern":     "Are we COMPLIANT?",
  "10-archive":    "Is everything PRESERVED?",
};

/**
 * Upstream stages each stage must cite for cross-stage traceability.
 * SDLC 6.3.1 Design-First: each stage builds on evidence from prior stages.
 */
export const STAGE_UPSTREAM: Record<string, string[]> = {
  "01-planning":   ["00-foundation"],
  "02-design":     ["00-foundation", "01-planning"],
  "03-integrate":  ["02-design"],
  "04-build":      ["01-planning", "02-design"],
  "05-test":       ["01-planning", "04-build"],
  "06-deploy":     ["05-test"],
  "07-operate":    ["06-deploy"],
  "08-collaborate":["04-build"],
  "09-govern":     ["05-test", "06-deploy"],
};

/**
 * Artifact types that require Section 8 YAML frontmatter per SDLC 6.3.1.
 * Specification documents must include spec_id, status, tier, stage, owner.
 */
export const SECTION8_ARTIFACT_TYPES = new Set([
  "requirements.md",
  "problem-statement.md",
  "business-case.md",
  "architecture.md",
  "api-spec.yaml",
  "test-plan.md",
  "deploy-guide.md",
  "contributing.md",
  "governance.md",
]);

/**
 * Stages where BDD (Given/When/Then) format is required in requirement docs.
 * SDLC 6.3.1 Section 8: all acceptance criteria must be expressed in BDD format.
 */
export const BDD_REQUIRED_STAGES = new Set(["01-planning", "00-foundation"]);

// ============================================================================
// Agent → Skill Mapping
// ============================================================================

/**
 * Maps agents to skills that should be injected into their prompts.
 * Currently only @tester has the e2e-api-testing skill.
 */
export const AGENT_SKILL_MAP: Partial<Record<AgentRole, string[]>> = {
  tester: ["e2e-api-testing"],
};

// ============================================================================
// Document Hierarchy
// ============================================================================

/**
 * SDLC 6.3.1 document hierarchy levels.
 * Roadmap → Phases → Sprints → Backlog (4 levels).
 */
export type DocHierarchyLevel = "roadmap" | "phase" | "sprint" | "backlog" | "gate";

// ============================================================================
// normalizeStageKey — Bridge UPPERCASE contracts ↔ lowercase content-checker
// ============================================================================

/**
 * Normalize a stage key to lowercase for cross-map lookups.
 * Contracts use UPPERCASE ("00-FOUNDATION"), content-checker uses lowercase ("00-foundation").
 * This bridges the gap without codebase-wide casing migration (CTO C2).
 */
export function normalizeStageKey(stageKey: string): string {
  return stageKey.toLowerCase();
}

// ============================================================================
// Project Snapshot Types
// ============================================================================

/**
 * Tech stack information detected from project files.
 */
export interface TechStackInfo {
  /** Primary language (e.g., "TypeScript", "Python") */
  language: string;
  /** Framework (e.g., "Express", "Next.js") */
  framework?: string;
  /** Package manager (e.g., "pnpm", "npm", "yarn") */
  packageManager?: string;
  /** Detected ecosystem (e.g., "node", "python", "docker") */
  ecosystem?: "node" | "python" | "rust" | "docker" | "go" | "java";
  /** Has TypeScript config */
  hasTypeScript: boolean;
  /** Has Docker */
  hasDocker: boolean;
  /** Has CI/CD */
  hasCI: boolean;
  /** Dependencies list (top-level) */
  dependencies: string[];
  /** Dev dependencies list (top-level) */
  devDependencies: string[];
  /** Scripts from package.json */
  scripts: Record<string, string>;
  /** Desktop framework (e.g., "Tauri 2", "Electron") */
  desktop?: string;
}

/**
 * Code module detected in the project.
 */
export interface CodeModule {
  /** Module name (directory name) */
  name: string;
  /** Relative path from project root */
  path: string;
  /** Number of source files */
  fileCount: number;
  /** Key file names in the module */
  keyFiles: string[];
}

/**
 * Test file information.
 */
export interface TestFileInfo {
  /** Relative path from project root */
  path: string;
  /** Test type classification */
  type: "unit" | "integration" | "e2e" | "manual" | "unknown";
  /** File name */
  name: string;
}

/**
 * Existing documentation information.
 */
export interface ExistingDocInfo {
  /** Stage the doc belongs to */
  stage: string;
  /** Relative path from stage directory */
  path: string;
  /** Number of content lines */
  contentLines: number;
  /** Number of placeholders found */
  placeholderCount: number;
  /** Whether this doc has real (non-placeholder) content */
  hasRealContent: boolean;
}

/**
 * Complete project snapshot — context collected from the target project.
 * Fed into agent prompts for context-aware content generation.
 */
export interface ProjectSnapshot {
  /** Project name */
  name: string;
  /** Project description */
  description: string;
  /** Project tier */
  tier: ProjectTier;
  /** Detected tech stack */
  techStack: TechStackInfo;
  /** Code modules discovered */
  codeModules: CodeModule[];
  /** Test files discovered */
  testFiles: TestFileInfo[];
  /** Existing documentation */
  existingDocs: ExistingDocInfo[];
  /** Project root path */
  projectPath: string;
}

// ============================================================================
// Fix Action Types
// ============================================================================

/**
 * Single fix action — one file to create or update.
 */
export interface FixAction {
  /** Target file path (relative to project root) */
  targetPath: string;
  /** Stage this action belongs to */
  stage: string;
  /** What artifact this generates */
  artifactType: string;
  /** Description of what to generate */
  description: string;
  /** Hierarchy level in SDLC 6.3.1 doc structure */
  hierarchyLevel?: DocHierarchyLevel;
}

/**
 * Agent fix task — groups fix actions by stage and agent.
 */
export interface AgentFixTask {
  /** Stage (lowercase) */
  stage: string;
  /** Agent responsible */
  agent: AgentRole;
  /** Actions to perform */
  actions: FixAction[];
  /** Issues this task addresses */
  issues: ContentIssue[];
  /** Applicable gates */
  gates: string[];
  /** Prompt context: tech stack, code modules, etc. */
  promptContext: string;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of a single fix action.
 */
export interface FixActionResult {
  /** The action that was performed */
  action: FixAction;
  /** Whether the action succeeded */
  success: boolean;
  /** Generated content (if successful) */
  content?: string;
  /** Error message (if failed) */
  error?: string;
  /** Whether this was a dry-run preview */
  dryRun: boolean;
}

/**
 * Result of processing all actions for one agent task.
 */
export interface AgentTaskResult {
  /** The task that was processed */
  task: AgentFixTask;
  /** Results for each action */
  actionResults: FixActionResult[];
  /** Overall success (all actions succeeded) */
  success: boolean;
  /** Duration in ms */
  durationMs: number;
}

/**
 * Overall compliance fix result.
 */
export interface ComplianceFixResult {
  /** L2 score before fix */
  scoreBefore: number;
  /** L2 score after fix */
  scoreAfter: number;
  /** Total issues found */
  totalIssues: number;
  /** Issues fixed */
  issuesFixed: number;
  /** Issues failed to fix */
  issuesFailed: number;
  /** Per-task results */
  taskResults: AgentTaskResult[];
  /** Stage results before */
  stageResultsBefore: StageContentResult[];
  /** Stage results after */
  stageResultsAfter: StageContentResult[];
  /** Total duration in ms */
  durationMs: number;
  /** Patch ID for rollback */
  patchId?: string;
  /** Whether this was a dry-run */
  dryRun: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Compliance fix engine configuration.
 */
export interface ComplianceFixConfig {
  /** Target project path */
  projectPath: string;
  /** Project tier */
  tier: ProjectTier;
  /** Dry-run mode (preview only) */
  dryRun: boolean;
  /** Auto-confirm all patches (--yes flag) */
  autoConfirm: boolean;
  /** Fix specific stage only */
  stage?: string;
  /** Stages to process (from tier) */
  stages: string[];
}

/**
 * Content generator configuration.
 */
export interface GeneratorConfig {
  /** Project path */
  projectPath: string;
  /** Project tier */
  tier: ProjectTier;
  /** Dry-run mode */
  dryRun: boolean;
  /** Auto-confirm patches */
  autoConfirm: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the agent responsible for a stage, with tier-aware fallback.
 */
export function getAgentForStage(stage: string, tier: ProjectTier): AgentRole {
  const fallbacks = STAGE_AGENT_FALLBACK[stage];
  if (fallbacks) {
    const fallback = fallbacks[tier];
    if (fallback) return fallback;
  }
  return STAGE_AGENT_MAP[stage] ?? "pm";
}

// ============================================================================
// Gate-Artifact-Tier Matrix (SDLC Framework 6.3.1 Authority)
// ============================================================================
// Sources:
//   - Tier-Stage-Requirements: .sdlc-framework/02-Core-Methodology/Documentation-Standards/SDLC-Tier-Stage-Requirements.md
//   - Project Structure: .sdlc-framework/02-Core-Methodology/Documentation-Standards/SDLC-Project-Structure-Standard.md
//   - Quality Gates: .sdlc-framework/02-Core-Methodology/Governance-Compliance/SDLC-Quality-Security-Gates.md
//   - Exit Criteria: .sdlc-framework/02-Core-Methodology/SDLC-Stage-Exit-Criteria.md

/**
 * Specification for a single artifact required by a gate.
 */
export interface GateArtifactSpec {
  /** Relative to docs/{stage}/ */
  artifactPath: string;
  /** Required content sections/topics */
  contentRequirements: string[];
  /** Minimum line count for gate pass */
  minLines: number;
  /** Minimum tier that requires this artifact */
  minTier: ProjectTier;
  /** Whether Section 8 YAML frontmatter is required */
  section8Yaml: boolean;
  /** Whether BDD (GIVEN/WHEN/THEN) format is required */
  bddRequired: boolean;
}

/**
 * Full gate requirement — artifacts + pass criteria.
 */
export interface GateRequirement {
  gateId: string;
  gateName: string;
  stage: string;
  question: string;
  passCriteria: string[];
  manualApproval: string[];
  artifacts: GateArtifactSpec[];
}

/**
 * Coverage thresholds by tier (from Quality-Security-Gates.md).
 */
export const TIER_COVERAGE_TARGETS: Record<string, { unit: number; integration: number; e2e: string }> = {
  LITE:         { unit: 0,  integration: 0,  e2e: "none" },
  STANDARD:     { unit: 60, integration: 0,  e2e: "none" },
  PROFESSIONAL: { unit: 80, integration: 70, e2e: "critical paths" },
  ENTERPRISE:   { unit: 95, integration: 90, e2e: "all critical + edge" },
};

/**
 * Gate artifact requirements — maps each gate to required artifacts by tier.
 * Derived from SDLC Framework 6.3.1 authority documents.
 */
export const GATE_ARTIFACT_REQUIREMENTS: GateRequirement[] = [
  // ── G0: Problem Validation (Stage 00-foundation) ──
  {
    gateId: "G0",
    gateName: "Problem Validation",
    stage: "00-foundation",
    question: "WHY are we building this?",
    passCriteria: [
      "Problem clearly articulated with evidence",
      "Business case justified with ROI analysis",
      "Stakeholders identified and consulted",
    ],
    manualApproval: ["CEO approves idea"],
    artifacts: [
      {
        artifactPath: "problem-statement.md",
        contentRequirements: ["Problem description", "Stakeholders", "Impact analysis", "Success metrics", "Validation evidence"],
        minLines: 60,
        minTier: "LITE",
        section8Yaml: true,
        bddRequired: false,
      },
      {
        artifactPath: "business-case.md",
        contentRequirements: ["Business justification", "ROI analysis", "Success metrics", "Risk assessment"],
        minLines: 80,
        minTier: "LITE",
        section8Yaml: true,
        bddRequired: false,
      },
      {
        artifactPath: "user-research/README.md",
        contentRequirements: ["User interview summaries (5+ for PRO+)", "Persona references", "Research methodology"],
        minLines: 60,
        minTier: "PROFESSIONAL",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "personas.md",
        contentRequirements: ["Primary user personas (min 2)", "Goals", "Pain points", "Behavioral patterns"],
        minLines: 40,
        minTier: "PROFESSIONAL",
        section8Yaml: false,
        bddRequired: false,
      },
    ],
  },
  // ── G0.1: Scope Lock (Stage 01-planning) ──
  {
    gateId: "G0.1",
    gateName: "Scope Lock",
    stage: "01-planning",
    question: "WHAT are we building?",
    passCriteria: [
      "Scope clearly defined with in/out-of-scope items",
      "Requirements documented with measurable targets",
      "Acceptance criteria in BDD GIVEN/WHEN/THEN format",
    ],
    manualApproval: ["CEO approves scope"],
    artifacts: [
      {
        artifactPath: "scope.md",
        contentRequirements: ["In-scope items", "Out-of-scope items", "Assumptions", "Constraints"],
        minLines: 40,
        minTier: "LITE",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "requirements.md",
        contentRequirements: ["Functional requirements (1 per code module)", "Non-functional requirements (measurable targets)", "Acceptance criteria in BDD GIVEN/WHEN/THEN", "Dependency analysis"],
        minLines: 120,
        minTier: "LITE",
        section8Yaml: true,
        bddRequired: true,
      },
      {
        artifactPath: "user-stories.md",
        contentRequirements: ["Epic breakdown", "User stories with acceptance criteria", "Story mapping", "MoSCoW prioritization"],
        minLines: 60,
        minTier: "STANDARD",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "roadmap.md",
        contentRequirements: ["Phase plan", "Milestone timeline", "Gate alignment", "Risk register"],
        minLines: 50,
        minTier: "STANDARD",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "data-model.md",
        contentRequirements: ["Entity-relationship model", "Data dictionary", "Storage strategy", "Migration plan"],
        minLines: 60,
        minTier: "PROFESSIONAL",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "tech-stack.md",
        contentRequirements: ["Technology selection rationale", "Framework versions", "Dependency justification"],
        minLines: 40,
        minTier: "PROFESSIONAL",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "api-design.md",
        contentRequirements: ["API specification (OpenAPI/AsyncAPI)", "Endpoint inventory", "Auth strategy"],
        minLines: 80,
        minTier: "PROFESSIONAL",
        section8Yaml: true,
        bddRequired: false,
      },
    ],
  },
  // ── G1: Requirements Sign-off (Stage 01-planning) ── (same stage as G0.1, validates completeness)
  {
    gateId: "G1",
    gateName: "Requirements Sign-off",
    stage: "01-planning",
    question: "WHAT are we building?",
    passCriteria: [
      "All requirements documented and traceable",
      "Acceptance criteria complete for all features",
      "Stakeholder sign-off obtained",
    ],
    manualApproval: ["Stakeholder sign-off obtained"],
    artifacts: [], // Same artifacts as G0.1 — G1 validates completeness of existing docs
  },
  // ── G2: Design Approval (Stage 02-design) ──
  {
    gateId: "G2",
    gateName: "Design Approval",
    stage: "02-design",
    question: "HOW will we build it?",
    passCriteria: [
      "Architecture reviewed and approved by architect",
      "Technology stack justified with rationale",
      "All code modules covered in module architecture",
    ],
    manualApproval: ["Design review passed"],
    artifacts: [
      {
        artifactPath: "01-ADRs/ADR-001-initial-architecture.md",
        contentRequirements: ["Context", "Decision", "Consequences", "Alternatives considered", "Status"],
        minLines: 60,
        minTier: "LITE",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "architecture.md",
        contentRequirements: ["Architecture overview", "Module structure (ALL modules)", "Tech decisions with rationale", "Data flow", "API contracts", "Quality attributes", "ADR summary"],
        minLines: 120,
        minTier: "STANDARD",
        section8Yaml: true,
        bddRequired: false,
      },
      {
        artifactPath: "14-Technical-Specs/TS-001-technical-spec.md",
        contentRequirements: ["Component design", "Interfaces", "Data structures", "Error handling"],
        minLines: 80,
        minTier: "STANDARD",
        section8Yaml: true,
        bddRequired: false,
      },
      {
        artifactPath: "security-architecture.md",
        contentRequirements: ["Threat model (STRIDE/PASTA)", "Auth/authz design", "Data encryption strategy", "OWASP ASVS checklist"],
        minLines: 80,
        minTier: "PROFESSIONAL",
        section8Yaml: true,
        bddRequired: false,
      },
      {
        artifactPath: "15-API-Specs/api-spec.yaml",
        contentRequirements: ["OpenAPI 3.0 spec with endpoints", "Schemas", "Auth", "Error codes"],
        minLines: 80,
        minTier: "PROFESSIONAL",
        section8Yaml: true,
        bddRequired: false,
      },
    ],
  },
  // ── G-Sprint: Sprint Close (Stage 04-build) ──
  {
    gateId: "G-Sprint",
    gateName: "Sprint Close",
    stage: "04-build",
    question: "Are we BUILDING it right?",
    passCriteria: [
      "Sprint goals met or documented as incomplete",
      "Sprint documentation updated",
      "Code complete and tested",
    ],
    manualApproval: ["CEO sprint sign-off"],
    artifacts: [
      {
        artifactPath: "sprints/sprint-plan.md",
        contentRequirements: ["Sprint goals", "Stories/tasks", "Velocity", "Dependencies", "Risks"],
        minLines: 40,
        minTier: "LITE",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "sprints/sprint-retro.md",
        contentRequirements: ["What went well", "What to improve", "Action items"],
        minLines: 30,
        minTier: "STANDARD",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "sprints/sprint-metrics.md",
        contentRequirements: ["Velocity", "Burndown", "Scope changes", "DORA metrics"],
        minLines: 30,
        minTier: "PROFESSIONAL",
        section8Yaml: false,
        bddRequired: false,
      },
    ],
  },
  // ── G3: Build Complete (Stage 05-test) ──
  {
    gateId: "G3",
    gateName: "Build Complete",
    stage: "05-test",
    question: "Does it WORK correctly?",
    passCriteria: [
      "All tests pass (unit + integration + e2e per tier)",
      "Coverage meets tier threshold",
      "Code review complete",
    ],
    manualApproval: ["Code review complete"],
    artifacts: [
      {
        artifactPath: "test-plan.md",
        contentRequirements: ["Test strategy", "Coverage targets per tier", "Test types (unit/integration/e2e)", "Test cases per module", "BDD acceptance criteria", "Environment requirements"],
        minLines: 100,
        minTier: "STANDARD",
        section8Yaml: true,
        bddRequired: true,
      },
      {
        artifactPath: "test-results.md",
        contentRequirements: ["Test execution summary", "Pass/fail counts", "Coverage report", "Bug tracking"],
        minLines: 40,
        minTier: "STANDARD",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "performance-test.md",
        contentRequirements: ["Performance test plan", "Benchmarks", "API latency targets (<200ms p95)", "Load test results"],
        minLines: 60,
        minTier: "PROFESSIONAL",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "security-test.md",
        contentRequirements: ["SAST scan results", "Dependency scan", "OWASP checklist", "SBOM generation"],
        minLines: 60,
        minTier: "PROFESSIONAL",
        section8Yaml: false,
        bddRequired: false,
      },
    ],
  },
  // ── G4: Release Ready (Stage 06-deploy) ──
  {
    gateId: "G4",
    gateName: "Release Ready",
    stage: "06-deploy",
    question: "Can we SHIP safely?",
    passCriteria: [
      "G3 gate passed",
      "Deployment artifacts ready",
      "Rollback procedure documented",
    ],
    manualApproval: ["CEO release approval"],
    artifacts: [
      {
        artifactPath: "deploy-guide.md",
        contentRequirements: ["Deployment steps", "Environment config", "Rollback procedure", "Health checks", "Monitoring setup"],
        minLines: 80,
        minTier: "STANDARD",
        section8Yaml: true,
        bddRequired: false,
      },
      {
        artifactPath: "rollback-plan.md",
        contentRequirements: ["Rollback triggers", "Steps", "Verification", "Communication plan"],
        minLines: 40,
        minTier: "PROFESSIONAL",
        section8Yaml: false,
        bddRequired: false,
      },
      {
        artifactPath: "runbook.md",
        contentRequirements: ["Operations runbook", "Incident response", "Escalation", "SLA targets"],
        minLines: 60,
        minTier: "PROFESSIONAL",
        section8Yaml: false,
        bddRequired: false,
      },
    ],
  },
];

// ============================================================================
// Gate-Artifact Lookup Helpers
// ============================================================================

/**
 * Find the GateRequirement for a given stage.
 * Returns the first gate that matches the stage (primary gate).
 */
export function findGateRequirement(stage: string): GateRequirement | undefined {
  return GATE_ARTIFACT_REQUIREMENTS.find((g) => g.stage === stage);
}

/**
 * Find the GateArtifactSpec for a given stage and artifact path.
 */
export function findArtifactSpec(stage: string, artifactType: string): GateArtifactSpec | undefined {
  for (const gate of GATE_ARTIFACT_REQUIREMENTS) {
    if (gate.stage === stage) {
      const spec = gate.artifacts.find((a) => a.artifactPath === artifactType);
      if (spec) return spec;
    }
  }
  return undefined;
}

// ============================================================================
// Header Compliance Templates (SDLC 6.3.1)
// ============================================================================
// Authority:
//   - Document headers: SDLC-Naming-Standards.md Part 5
//   - Code file headers: SDLC-Compliance-Enforcement-Guide.md §Header Compliance Standards
//   - Section 8 YAML: SDLC-Specification-Standard.md §2.1

/**
 * Stage name lookup for header generation.
 */
export const STAGE_NAMES: Record<string, string> = {
  "00-foundation": "FOUNDATION",
  "01-planning":   "PLANNING",
  "02-design":     "DESIGN",
  "03-integrate":  "INTEGRATE",
  "04-build":      "BUILD",
  "05-test":       "TEST",
  "06-deploy":     "DEPLOY",
  "07-operate":    "OPERATE",
  "08-collaborate":"COLLABORATE",
  "09-govern":     "GOVERN",
  "10-archive":    "ARCHIVE",
};

/**
 * Result of checking a file's header compliance.
 */
export interface HeaderCheckResult {
  /** Whether the file has a valid header */
  hasHeader: boolean;
  /** Type of header found */
  headerType: "document" | "code" | "yaml" | "none";
  /** Fields that are missing from the header */
  missingFields: string[];
  /** Whether the header can be auto-fixed */
  fixable: boolean;
}

/**
 * Minimum header fields required per tier for document files.
 */
export const DOC_HEADER_REQUIRED_FIELDS: Record<ProjectTier, string[]> = {
  LITE:         [],                                                    // Recommended only
  STANDARD:     ["Version", "Date", "Status", "Stage"],
  PROFESSIONAL: ["Version", "Date", "Status", "Stage", "Authority"],
  ENTERPRISE:   ["Version", "Date", "Status", "Stage", "Authority"],
};

/**
 * Minimum header fields required per tier for code files.
 */
export const CODE_HEADER_REQUIRED_FIELDS: Record<ProjectTier, string[]> = {
  LITE:         [],                                                    // Optional
  STANDARD:     [],                                                    // Recommended only
  PROFESSIONAL: ["@module", "@sdlc", "@stage", "@tier"],
  ENTERPRISE:   ["@module", "@version", "@date", "@sdlc", "@stage", "@tier"],
};
