/**
 * Default Stage Contracts
 *
 * Default contracts for all 10 SDLC Framework 6.4.0 stages.
 * These define the required and produced artifacts per stage.
 *
 * @module sdlc/contracts/defaults
 * @version 1.0.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 68
 * @authority Master Plan v4.2, Sprint 68 T1.3
 * @sprint 68
 */

import type { StageContract, SDLCStage } from "./types.js";

// ============================================================================
// Default Contracts
// ============================================================================

/**
 * 00-FOUNDATION: Project foundation and identity.
 */
export const FOUNDATION_CONTRACT: StageContract = {
  stage: "00-FOUNDATION",
  name: "Foundation",
  description: "Establish project identity and baseline configuration",
  required: [],
  produces: [
    {
      pattern: "CLAUDE.md",
      description: "Claude Code integration guide",
      autoCreate: true,
      template: "claude-md",
    },
    {
      pattern: "IDENTITY.md",
      description: "Project identity and capabilities",
      autoCreate: true,
      template: "identity-md",
    },
    {
      pattern: ".sdlc-config.json",
      description: "SDLC framework configuration",
      autoCreate: true,
      template: "sdlc-config",
    },
  ],
  gates: ["G0"],
  validation: [],
  minTier: "LITE",
};

/**
 * 01-PLANNING: Requirements and roadmap planning.
 */
export const PLANNING_CONTRACT: StageContract = {
  stage: "01-PLANNING",
  name: "Planning",
  description: "Define requirements, roadmap, and sprint planning",
  required: [
    {
      pattern: "IDENTITY.md",
      description: "Project identity",
      optional: false,
      minCount: 1,
    },
    {
      pattern: ".sdlc-config.json",
      description: "SDLC configuration",
      optional: false,
      minCount: 1,
    },
  ],
  produces: [
    {
      pattern: "docs/01-planning/**/*.md",
      description: "Planning documents",
      autoCreate: false,
    },
    {
      pattern: "docs/01-planning/roadmap.md",
      description: "Project roadmap",
      autoCreate: true,
      template: "roadmap-md",
    },
  ],
  gates: ["G0", "G1"],
  validation: [],
  minTier: "LITE",
};

/**
 * 02-DESIGN: Architecture and design decisions.
 */
export const DESIGN_CONTRACT: StageContract = {
  stage: "02-DESIGN",
  name: "Design",
  description: "Architecture decisions, ADRs, and technical specifications",
  required: [
    {
      pattern: "docs/01-planning/roadmap.md",
      description: "Project roadmap",
      optional: true,
      minCount: 0,
    },
  ],
  produces: [
    {
      pattern: "docs/02-design/01-ADRs/ADR-*.md",
      description: "Architecture Decision Records",
      autoCreate: false,
    },
    {
      pattern: "docs/02-design/**/*.proto",
      description: "Protocol Buffer specifications",
      autoCreate: false,
    },
    {
      pattern: "docs/02-design/**/*.graphql",
      description: "GraphQL schemas",
      autoCreate: false,
    },
    {
      pattern: "docs/02-design/14-Technical-Specs/TS-*.md",
      description: "Technical specifications",
      autoCreate: false,
    },
  ],
  gates: ["G2"],
  validation: [
    {
      type: "min_count",
      pattern: "docs/02-design/01-ADRs/ADR-*.md",
      message: "At least one ADR is recommended for STANDARD+ tiers",
      severity: "warning",
      threshold: 1,
    },
  ],
  minTier: "STANDARD",
};

/**
 * 03-INTEGRATE: Integration planning and specifications.
 */
export const INTEGRATE_CONTRACT: StageContract = {
  stage: "03-INTEGRATE",
  name: "Integrate",
  description: "Integration patterns, API contracts, and data flow",
  required: [
    {
      pattern: "docs/02-design/01-ADRs/ADR-*.md",
      description: "Architecture decisions",
      optional: true,
      minCount: 0,
    },
  ],
  produces: [
    {
      pattern: "docs/03-integrate/**/*.md",
      description: "Integration documentation",
      autoCreate: false,
    },
    {
      pattern: "docs/03-integrate/**/*.yaml",
      description: "OpenAPI specifications",
      autoCreate: false,
    },
  ],
  gates: [],
  validation: [],
  minTier: "STANDARD",
};

/**
 * 04-BUILD: Source code implementation.
 */
export const BUILD_CONTRACT: StageContract = {
  stage: "04-BUILD",
  name: "Build",
  description: "Source code implementation and feature development",
  required: [
    {
      pattern: "docs/02-design/01-ADRs/ADR-*.md",
      description: "Architecture decisions",
      optional: true,
      minCount: 0,
    },
  ],
  produces: [
    {
      pattern: "src/**/*.ts",
      description: "TypeScript source code",
      autoCreate: false,
    },
    {
      pattern: "src/**/*.tsx",
      description: "React components",
      autoCreate: false,
    },
    {
      pattern: "src/**/*.js",
      description: "JavaScript source code",
      autoCreate: false,
    },
  ],
  gates: ["G3", "G4"],
  validation: [
    {
      type: "file_exists",
      pattern: "src/**/*.ts",
      message: "Source code is required for BUILD stage",
      severity: "error",
    },
  ],
  minTier: "LITE",
};

/**
 * 05-TEST: Testing and quality assurance.
 */
export const TEST_CONTRACT: StageContract = {
  stage: "05-TEST",
  name: "Test",
  description: "Unit tests, integration tests, and E2E tests",
  required: [
    {
      pattern: "src/**/*.ts",
      description: "Source code",
      optional: false,
      minCount: 1,
    },
  ],
  produces: [
    {
      pattern: "tests/**/*.test.ts",
      description: "Unit tests",
      autoCreate: false,
    },
    {
      pattern: "tests/**/*.spec.ts",
      description: "Specification tests",
      autoCreate: false,
    },
    {
      pattern: "tests/e2e/**/*.test.ts",
      description: "End-to-end tests",
      autoCreate: false,
    },
  ],
  gates: ["G4"],
  validation: [
    {
      type: "file_exists",
      pattern: "tests/**/*.test.ts",
      message: "Tests are required for TEST stage",
      severity: "warning",
    },
  ],
  minTier: "STANDARD",
};

/**
 * 06-DEPLOY: Deployment configuration and release.
 */
export const DEPLOY_CONTRACT: StageContract = {
  stage: "06-DEPLOY",
  name: "Deploy",
  description: "Deployment configuration, CI/CD, and release management",
  required: [
    {
      pattern: "src/**/*.ts",
      description: "Source code",
      optional: false,
      minCount: 1,
    },
  ],
  produces: [
    {
      pattern: "docs/06-deploy/**/*.md",
      description: "Deployment documentation",
      autoCreate: false,
    },
    {
      pattern: ".github/workflows/**/*.yml",
      description: "GitHub Actions workflows",
      autoCreate: false,
    },
    {
      pattern: "Dockerfile",
      description: "Docker configuration",
      autoCreate: false,
    },
  ],
  gates: [],
  validation: [],
  minTier: "STANDARD",
};

/**
 * 07-OPERATE: Operations, monitoring, and maintenance.
 */
export const OPERATE_CONTRACT: StageContract = {
  stage: "07-OPERATE",
  name: "Operate",
  description: "Operations runbooks, monitoring, and SLAs",
  required: [],
  produces: [
    {
      pattern: "docs/07-operate/**/*.md",
      description: "Operations documentation",
      autoCreate: false,
    },
    {
      pattern: "docs/07-operate/runbooks/**/*.md",
      description: "Runbooks",
      autoCreate: false,
    },
  ],
  gates: [],
  validation: [],
  minTier: "PROFESSIONAL",
};

/**
 * 08-COLLABORATE: Collaboration and knowledge sharing.
 */
export const COLLABORATE_CONTRACT: StageContract = {
  stage: "08-COLLABORATE",
  name: "Collaborate",
  description: "Team collaboration, knowledge base, and SDLC compliance",
  required: [],
  produces: [
    {
      pattern: "docs/08-collaborate/**/*.md",
      description: "Collaboration documentation",
      autoCreate: false,
    },
    {
      pattern: "docs/08-collaborate/01-SDLC-Compliance/**/*.md",
      description: "SDLC compliance documentation",
      autoCreate: false,
    },
  ],
  gates: [],
  validation: [],
  minTier: "STANDARD",
};

/**
 * 09-ARCHIVE: Project archival and retrospectives.
 */
export const ARCHIVE_CONTRACT: StageContract = {
  stage: "09-ARCHIVE",
  name: "Archive",
  description: "Project retrospectives, lessons learned, and archival",
  required: [],
  produces: [
    {
      pattern: "docs/09-archive/**/*.md",
      description: "Archive documentation",
      autoCreate: false,
    },
    {
      pattern: "docs/09-archive/retrospectives/**/*.md",
      description: "Sprint retrospectives",
      autoCreate: false,
    },
  ],
  gates: [],
  validation: [],
  minTier: "PROFESSIONAL",
};

/**
 * 10-ARCHIVE: Enterprise project archival, lessons learned, close-out.
 */
export const ARCHIVE_ENTERPRISE_CONTRACT: StageContract = {
  stage: "10-ARCHIVE",
  name: "Archive (Enterprise)",
  description: "Project archival, lessons learned, and close-out",
  required: [],
  produces: [
    {
      pattern: "docs/10-archive/**/*.md",
      description: "Archive documentation",
      autoCreate: false,
    },
    {
      pattern: "docs/10-archive/archive-checklist.md",
      description: "Archive checklist",
      autoCreate: false,
    },
    {
      pattern: "docs/10-archive/lessons-learned.md",
      description: "Lessons learned",
      autoCreate: false,
    },
  ],
  gates: [],
  validation: [],
  minTier: "ENTERPRISE",
};

// ============================================================================
// Stage Contracts Map
// ============================================================================

/**
 * All default stage contracts indexed by stage ID.
 */
export const STAGE_CONTRACTS: Record<SDLCStage, StageContract> = {
  "00-FOUNDATION": FOUNDATION_CONTRACT,
  "01-PLANNING": PLANNING_CONTRACT,
  "02-DESIGN": DESIGN_CONTRACT,
  "03-INTEGRATE": INTEGRATE_CONTRACT,
  "04-BUILD": BUILD_CONTRACT,
  "05-TEST": TEST_CONTRACT,
  "06-DEPLOY": DEPLOY_CONTRACT,
  "07-OPERATE": OPERATE_CONTRACT,
  "08-COLLABORATE": COLLABORATE_CONTRACT,
  "09-ARCHIVE": ARCHIVE_CONTRACT,
  "10-ARCHIVE": ARCHIVE_ENTERPRISE_CONTRACT,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the contract for a specific stage.
 */
export function getStageContract(stage: SDLCStage): StageContract {
  return STAGE_CONTRACTS[stage];
}

/**
 * Get all stage contracts.
 */
export function getAllContracts(): StageContract[] {
  return Object.values(STAGE_CONTRACTS);
}

/**
 * Get contracts for a specific tier (includes all lower tier stages).
 */
export function getContractsForTier(
  tier: "LITE" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE"
): StageContract[] {
  const tierOrder = ["LITE", "STANDARD", "PROFESSIONAL", "ENTERPRISE"];
  const tierIndex = tierOrder.indexOf(tier);

  return getAllContracts().filter((contract) => {
    const contractTierIndex = tierOrder.indexOf(contract.minTier ?? "LITE");
    return contractTierIndex <= tierIndex;
  });
}

/**
 * Get required stages for a tier.
 */
export function getRequiredStagesForTier(
  tier: "LITE" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE"
): SDLCStage[] {
  return getContractsForTier(tier).map((c) => c.stage);
}
