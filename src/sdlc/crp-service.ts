/**
 * Change Request Package (CRP) Service
 *
 * Generates Change Request Packages for SDLC compliance.
 * CRP documents changes, rationale, and impact analysis.
 *
 * Usage:
 *   - Before G2 (Design): Generate CRP for architecture changes
 *   - Before G3 (Build): Generate CRP for implementation changes
 *   - Ad-hoc: Generate CRP for significant scope changes
 *
 * @module sdlc/crp-service
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
 * Change type classification.
 */
export type ChangeType =
  | "feature"
  | "enhancement"
  | "bugfix"
  | "refactor"
  | "security"
  | "performance"
  | "documentation";

/**
 * Change priority/urgency.
 */
export type ChangePriority = "critical" | "high" | "medium" | "low";

/**
 * Impact assessment level.
 */
export type ImpactLevel = "breaking" | "major" | "minor" | "patch";

/**
 * Individual change item within a CRP.
 */
export interface ChangeItem {
  id: string;
  type: ChangeType;
  title: string;
  description: string;
  rationale: string;
  filesAffected: string[];
  estimatedEffort: string;
}

/**
 * Impact analysis for a CRP.
 */
export interface ImpactAnalysis {
  level: ImpactLevel;
  breaking: boolean;
  affectedComponents: string[];
  riskFactors: string[];
  mitigations: string[];
  testingRequired: string[];
}

/**
 * Full Change Request Package.
 */
export interface ChangeRequestPackage {
  id: string;
  version: string;
  title: string;
  description: string;

  // Metadata
  createdAt: string;
  createdBy: string;
  projectId: string;
  featureId: string;

  // Classification
  priority: ChangePriority;
  targetGate: string;
  sdlcStage: string;

  // Changes
  changes: ChangeItem[];

  // Analysis
  impact: ImpactAnalysis;

  // Approval
  status: "draft" | "submitted" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

/**
 * Configuration for CRP generation.
 */
export interface CRPConfig {
  projectId: string;
  featureId: string;
  createdBy: string;
}

// ============================================================================
// CRP Service Class
// ============================================================================

/**
 * Service for generating and managing Change Request Packages.
 */
export class CRPService {
  private packages: Map<string, ChangeRequestPackage> = new Map();
  private packageCounter = 0;

  /**
   * Generate a new CRP ID.
   */
  private generateId(): string {
    this.packageCounter++;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `CRP-${date}-${String(this.packageCounter).padStart(3, "0")}`;
  }

  /**
   * Create a new Change Request Package.
   */
  create(
    config: CRPConfig,
    data: {
      title: string;
      description: string;
      priority: ChangePriority;
      targetGate: string;
      sdlcStage: string;
    },
  ): ChangeRequestPackage {
    const id = this.generateId();

    const crp: ChangeRequestPackage = {
      id,
      version: "1.0.0",
      title: data.title,
      description: data.description,
      createdAt: new Date().toISOString(),
      createdBy: config.createdBy,
      projectId: config.projectId,
      featureId: config.featureId,
      priority: data.priority,
      targetGate: data.targetGate,
      sdlcStage: data.sdlcStage,
      changes: [],
      impact: {
        level: "minor",
        breaking: false,
        affectedComponents: [],
        riskFactors: [],
        mitigations: [],
        testingRequired: [],
      },
      status: "draft",
    };

    this.packages.set(id, crp);
    return crp;
  }

  /**
   * Add a change item to a CRP.
   */
  addChange(crpId: string, change: Omit<ChangeItem, "id">): ChangeItem {
    const crp = this.packages.get(crpId);
    if (!crp) {
      throw new Error(`CRP ${crpId} not found`);
    }
    if (crp.status !== "draft") {
      throw new Error(`Cannot modify ${crp.status} CRP`);
    }

    const changeItem: ChangeItem = {
      id: `${crpId}-C${String(crp.changes.length + 1).padStart(2, "0")}`,
      ...change,
    };

    crp.changes.push(changeItem);
    return changeItem;
  }

  /**
   * Update impact analysis for a CRP.
   */
  updateImpact(crpId: string, impact: Partial<ImpactAnalysis>): void {
    const crp = this.packages.get(crpId);
    if (!crp) {
      throw new Error(`CRP ${crpId} not found`);
    }
    if (crp.status !== "draft") {
      throw new Error(`Cannot modify ${crp.status} CRP`);
    }

    crp.impact = { ...crp.impact, ...impact };

    // Auto-detect breaking changes
    if (impact.level === "breaking") {
      crp.impact.breaking = true;
    }
  }

  /**
   * Submit a CRP for approval.
   */
  submit(crpId: string): ChangeRequestPackage {
    const crp = this.packages.get(crpId);
    if (!crp) {
      throw new Error(`CRP ${crpId} not found`);
    }
    if (crp.status !== "draft") {
      throw new Error(`Cannot submit ${crp.status} CRP`);
    }
    if (crp.changes.length === 0) {
      throw new Error("CRP must have at least one change");
    }

    crp.status = "submitted";
    return crp;
  }

  /**
   * Approve a CRP (CEO action).
   */
  approve(crpId: string, approvedBy: string): ChangeRequestPackage {
    const crp = this.packages.get(crpId);
    if (!crp) {
      throw new Error(`CRP ${crpId} not found`);
    }
    if (crp.status !== "submitted") {
      throw new Error(`Cannot approve ${crp.status} CRP`);
    }

    crp.status = "approved";
    crp.approvedBy = approvedBy;
    crp.approvedAt = new Date().toISOString();
    return crp;
  }

  /**
   * Reject a CRP (CEO action).
   */
  reject(
    crpId: string,
    rejectedBy: string,
    reason: string,
  ): ChangeRequestPackage {
    const crp = this.packages.get(crpId);
    if (!crp) {
      throw new Error(`CRP ${crpId} not found`);
    }
    if (crp.status !== "submitted") {
      throw new Error(`Cannot reject ${crp.status} CRP`);
    }

    crp.status = "rejected";
    crp.approvedBy = rejectedBy;
    crp.rejectionReason = reason;
    return crp;
  }

  /**
   * Get a CRP by ID.
   */
  get(crpId: string): ChangeRequestPackage | undefined {
    return this.packages.get(crpId);
  }

  /**
   * List all CRPs.
   */
  list(filter?: { status?: string; projectId?: string }): ChangeRequestPackage[] {
    let packages = Array.from(this.packages.values());

    if (filter?.status) {
      packages = packages.filter((p) => p.status === filter.status);
    }
    if (filter?.projectId) {
      packages = packages.filter((p) => p.projectId === filter.projectId);
    }

    return packages;
  }

  /**
   * Generate CRP markdown document.
   */
  toMarkdown(crpId: string): string {
    const crp = this.packages.get(crpId);
    if (!crp) {
      throw new Error(`CRP ${crpId} not found`);
    }

    const lines: string[] = [
      `# ${crp.id}: ${crp.title}`,
      "",
      `**Status:** ${crp.status.toUpperCase()}`,
      `**Priority:** ${crp.priority}`,
      `**Target Gate:** ${crp.targetGate}`,
      `**SDLC Stage:** ${crp.sdlcStage}`,
      `**Created:** ${crp.createdAt}`,
      `**Created By:** ${crp.createdBy}`,
      "",
      "## Description",
      "",
      crp.description,
      "",
      "## Changes",
      "",
    ];

    for (const change of crp.changes) {
      lines.push(`### ${change.id}: ${change.title}`);
      lines.push("");
      lines.push(`**Type:** ${change.type}`);
      lines.push(`**Estimated Effort:** ${change.estimatedEffort}`);
      lines.push("");
      lines.push("**Description:**");
      lines.push(change.description);
      lines.push("");
      lines.push("**Rationale:**");
      lines.push(change.rationale);
      lines.push("");
      lines.push("**Files Affected:**");
      for (const file of change.filesAffected) {
        lines.push(`- ${file}`);
      }
      lines.push("");
    }

    lines.push("## Impact Analysis");
    lines.push("");
    lines.push(`**Impact Level:** ${crp.impact.level}`);
    lines.push(`**Breaking Change:** ${crp.impact.breaking ? "Yes" : "No"}`);
    lines.push("");

    if (crp.impact.affectedComponents.length > 0) {
      lines.push("**Affected Components:**");
      for (const comp of crp.impact.affectedComponents) {
        lines.push(`- ${comp}`);
      }
      lines.push("");
    }

    if (crp.impact.riskFactors.length > 0) {
      lines.push("**Risk Factors:**");
      for (const risk of crp.impact.riskFactors) {
        lines.push(`- ${risk}`);
      }
      lines.push("");
    }

    if (crp.impact.mitigations.length > 0) {
      lines.push("**Mitigations:**");
      for (const mit of crp.impact.mitigations) {
        lines.push(`- ${mit}`);
      }
      lines.push("");
    }

    if (crp.impact.testingRequired.length > 0) {
      lines.push("**Testing Required:**");
      for (const test of crp.impact.testingRequired) {
        lines.push(`- ${test}`);
      }
      lines.push("");
    }

    if (crp.approvedBy) {
      lines.push("## Approval");
      lines.push("");
      lines.push(`**Approved By:** ${crp.approvedBy}`);
      if (crp.approvedAt) {
        lines.push(`**Approved At:** ${crp.approvedAt}`);
      }
      if (crp.rejectionReason) {
        lines.push(`**Rejection Reason:** ${crp.rejectionReason}`);
      }
    }

    lines.push("");
    lines.push("---");
    lines.push("*SDLC Framework v6.4.0*");

    return lines.join("\n");
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalCRPService: CRPService | undefined;

export function getCRPService(): CRPService {
  if (!globalCRPService) {
    globalCRPService = new CRPService();
  }
  return globalCRPService;
}

/**
 * Reset the global CRPService instance.
 * Useful for testing or reconfiguration.
 */
export function resetCRPService(): void {
  globalCRPService = undefined;
}
