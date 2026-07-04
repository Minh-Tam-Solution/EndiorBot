/**
 * Gate Checklist
 *
 * Tier-specific checklists for SDLC gate evaluation.
 * Based on SDLC Framework v6.4.0 stage-gate definitions.
 *
 * Gates:
 *   - G0: Idea Validation
 *   - G0.1: Scope Lock
 *   - G1: Requirements Sign-off
 *   - G2: Design Approval
 *   - G3: Build Complete
 *   - G4: Release Ready
 *   - G-Sprint: Sprint Close
 *
 * @module sdlc/gates/gate-checklist
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.4 Implementation
 * @authority ADR-004 SDLC Gate Engine
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Types
// ============================================================================

/**
 * SDLC gate identifiers.
 */
export type GateId =
  | "G0"
  | "G0.1"
  | "G1"
  | "G2"
  | "G3"
  | "G4"
  | "G-Sprint";

/**
 * Project tier determines checklist complexity.
 */
export type ProjectTier = "LITE" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE";

/**
 * Checklist item status.
 */
export type ChecklistStatus = "pass" | "fail" | "manual" | "pending" | "skipped";

/**
 * A single checklist item for gate evaluation.
 */
export interface ChecklistItem {
  /**
   * Unique identifier for this item.
   */
  id: string;

  /**
   * Human-readable description.
   */
  description: string;

  /**
   * Whether this item is required for gate pass.
   */
  required: boolean;

  /**
   * Whether this item can be auto-checked.
   */
  autoCheck: boolean;

  /**
   * Current status of this item.
   */
  status: ChecklistStatus;

  /**
   * Path to evidence file (if any).
   */
  evidence?: string;

  /**
   * Auto-check function identifier (if autoCheck is true).
   */
  checker?: string;

  /**
   * Minimum tier required for this item.
   */
  minTier?: ProjectTier;
}

/**
 * Full checklist for a gate.
 */
export interface GateChecklist {
  gateId: GateId;
  gateName: string;
  description: string;
  items: ChecklistItem[];
}

// ============================================================================
// Tier Ordering (for comparison)
// ============================================================================

const TIER_ORDER: Record<ProjectTier, number> = {
  LITE: 0,
  STANDARD: 1,
  PROFESSIONAL: 2,
  ENTERPRISE: 3,
};

/**
 * Check if current tier meets minimum tier requirement.
 */
export function meetsMinTier(
  currentTier: ProjectTier,
  minTier: ProjectTier | undefined,
): boolean {
  if (!minTier) return true;
  return TIER_ORDER[currentTier] >= TIER_ORDER[minTier];
}

// ============================================================================
// Gate Checklists
// ============================================================================

/**
 * G0: Idea Validation Gate
 */
export const G0_CHECKLIST: GateChecklist = {
  gateId: "G0",
  gateName: "Idea Validation",
  description: "Validate that the idea is worth pursuing",
  items: [
    {
      id: "g0-problem-statement",
      description: "Problem statement documented",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "file:docs/00-foundation/problem-statement.md",
    },
    {
      id: "g0-business-case",
      description: "Business case documented",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "file:docs/00-foundation/business-case.md",
      minTier: "STANDARD",
    },
    {
      id: "g0-ceo-approval",
      description: "CEO approves idea",
      required: true,
      autoCheck: false,
      status: "pending",
    },
  ],
};

/**
 * G0.1: Scope Lock Gate
 */
export const G01_CHECKLIST: GateChecklist = {
  gateId: "G0.1",
  gateName: "Scope Lock",
  description: "Lock the scope before detailed planning",
  items: [
    {
      id: "g01-scope-document",
      description: "Scope document exists",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "file:docs/01-planning/scope.md",
    },
    {
      id: "g01-out-of-scope",
      description: "Out-of-scope items documented",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "file:docs/01-planning/out-of-scope.md",
      minTier: "PROFESSIONAL",
    },
    {
      id: "g01-ceo-approval",
      description: "CEO approves scope",
      required: true,
      autoCheck: false,
      status: "pending",
    },
  ],
};

/**
 * G1: Requirements Sign-off Gate
 */
export const G1_CHECKLIST: GateChecklist = {
  gateId: "G1",
  gateName: "Requirements Sign-off",
  description: "Requirements are complete and approved",
  items: [
    {
      id: "g1-requirements",
      description: "Requirements documented",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "file:docs/01-planning/requirements.md",
    },
    {
      id: "g1-user-stories",
      description: "User stories documented",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "file:docs/01-planning/user-stories.md",
    },
    {
      id: "g1-acceptance-criteria",
      description: "Acceptance criteria defined",
      required: true,
      autoCheck: false,
      status: "pending",
      minTier: "STANDARD",
    },
    {
      id: "g1-stakeholder-signoff",
      description: "Stakeholder sign-off obtained",
      required: true,
      autoCheck: false,
      status: "pending",
    },
  ],
};

/**
 * G2: Design Approval Gate
 */
export const G2_CHECKLIST: GateChecklist = {
  gateId: "G2",
  gateName: "Design Approval",
  description: "Design is complete and approved",
  items: [
    {
      id: "g2-adr-exists",
      description: "Architecture Decision Record exists",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "glob:docs/02-design/01-ADRs/ADR-*.md",
    },
    {
      id: "g2-requirements-trace",
      description:
        "At least one ADR references planning requirements (Stage 01→02 traceability)",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "contains:docs/02-design/01-ADRs/ADR-*.md:docs/01-planning/requirements|01-planning/requirements",
      minTier: "STANDARD",
    },
    {
      id: "g2-iceberg",
      description:
        "At least one ADR contains Iceberg Analysis (System Thinking enforcement)",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "contains:docs/02-design/01-ADRs/ADR-*.md:## Iceberg Analysis",
      minTier: "STANDARD",
    },
    {
      id: "g2-alternatives",
      description:
        "At least one ADR contains Alternatives Considered (Design Thinking enforcement)",
      required: true,
      autoCheck: true,
      status: "pending",
      checker:
        "contains:docs/02-design/01-ADRs/ADR-*.md:## Alternatives Considered|## Alternatives",
      minTier: "STANDARD",
    },
    {
      id: "g2-technical-spec",
      description: "Technical specification exists",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "glob:docs/02-design/14-Technical-Specs/TS-*.md",
      minTier: "STANDARD",
    },
    {
      id: "g2-api-spec",
      description: "API specification exists",
      required: false,
      autoCheck: true,
      status: "pending",
      checker: "glob:docs/02-design/15-API-Specs/*.md",
      minTier: "PROFESSIONAL",
    },
    {
      id: "g2-design-review",
      description: "Design review passed",
      required: true,
      autoCheck: false,
      status: "pending",
    },
  ],
};

/**
 * G3: Build Complete Gate
 */
export const G3_CHECKLIST: GateChecklist = {
  gateId: "G3",
  gateName: "Build Complete",
  description: "Implementation is complete and tested",
  items: [
    {
      id: "g3-build-passes",
      description: "Build passes without errors",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "command:pnpm build",
    },
    {
      id: "g3-lint-passes",
      description: "Lint passes without errors",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "command:pnpm lint",
    },
    {
      id: "g3-tests-pass",
      description: "All tests pass",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "command:pnpm test",
    },
    {
      id: "g3-coverage",
      description: "Test coverage > 80%",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "coverage:80",
      minTier: "STANDARD",
    },
    {
      id: "g3-vibecoding-green",
      description: "Vibecoding Index in Green zone (< 30)",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "vibecoding:30",
    },
    {
      id: "g3-code-review",
      description: "Code review complete",
      required: true,
      autoCheck: false,
      status: "pending",
    },
  ],
};

/**
 * G4: Release Ready Gate
 */
export const G4_CHECKLIST: GateChecklist = {
  gateId: "G4",
  gateName: "Release Ready",
  description: "Ready for production release",
  items: [
    {
      id: "g4-g3-passed",
      description: "G3 gate passed",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "gate:G3",
    },
    {
      id: "g4-changelog",
      description: "Changelog updated",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "file:CHANGELOG.md",
    },
    {
      id: "g4-version-bumped",
      description: "Version number bumped",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "version:package.json",
    },
    {
      id: "g4-deployment-ready",
      description: "Deployment artifacts ready",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "dir:dist",
      minTier: "STANDARD",
    },
    {
      id: "g4-security-scan",
      description: "Security scan passed",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "command:pnpm audit",
      minTier: "PROFESSIONAL",
    },
    {
      id: "g4-ceo-release-approval",
      description: "CEO release approval",
      required: true,
      autoCheck: false,
      status: "pending",
    },
  ],
};

/**
 * G-Sprint: Sprint Close Gate
 */
export const GSPRINT_CHECKLIST: GateChecklist = {
  gateId: "G-Sprint",
  gateName: "Sprint Close",
  description: "Sprint is complete and documented",
  items: [
    {
      id: "gsprint-stories-done",
      description: "All sprint stories completed",
      required: true,
      autoCheck: false,
      status: "pending",
    },
    {
      id: "gsprint-retrospective",
      description: "Sprint retrospective conducted",
      required: true,
      autoCheck: false,
      status: "pending",
      minTier: "STANDARD",
    },
    {
      id: "gsprint-documentation",
      description: "Sprint documentation updated",
      required: true,
      autoCheck: true,
      status: "pending",
      checker: "glob:docs/04-build/sprints/sprint-*-plan.md",
    },
    {
      id: "gsprint-ceo-signoff",
      description: "CEO sprint sign-off",
      required: true,
      autoCheck: false,
      status: "pending",
    },
  ],
};

// ============================================================================
// Checklist Registry
// ============================================================================

/**
 * All gate checklists indexed by gate ID.
 */
export const GATE_CHECKLISTS: Record<GateId, GateChecklist> = {
  "G0": G0_CHECKLIST,
  "G0.1": G01_CHECKLIST,
  "G1": G1_CHECKLIST,
  "G2": G2_CHECKLIST,
  "G3": G3_CHECKLIST,
  "G4": G4_CHECKLIST,
  "G-Sprint": GSPRINT_CHECKLIST,
};

/**
 * Get checklist for a gate, filtered by project tier.
 *
 * @param gateId - Gate to get checklist for
 * @param tier - Project tier to filter items
 * @returns Checklist with items filtered by tier
 */
export function getChecklist(
  gateId: GateId,
  tier: ProjectTier = "STANDARD",
): GateChecklist {
  const checklist = GATE_CHECKLISTS[gateId];

  if (!checklist) {
    const validIds = getGatesInOrder().join(", ");
    throw new Error(`Unknown gate ID: "${gateId}". Valid gates: ${validIds}`);
  }

  // Filter items by tier
  const filteredItems = checklist.items.filter((item) =>
    meetsMinTier(tier, item.minTier),
  );

  return {
    ...checklist,
    items: filteredItems.map((item) => ({ ...item })), // Clone items
  };
}

/**
 * Get all gates in execution order.
 */
export function getGatesInOrder(): GateId[] {
  return ["G0", "G0.1", "G1", "G2", "G3", "G4", "G-Sprint"];
}

/**
 * Get the previous gate (for dependency checking).
 */
export function getPreviousGate(gateId: GateId): GateId | undefined {
  const gates = getGatesInOrder();
  const index = gates.indexOf(gateId);
  if (index <= 0) return undefined;
  return gates[index - 1];
}
