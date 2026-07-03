/**
 * Merge-Readiness Package (MRP) Service
 *
 * Generates Merge-Readiness Packages for SDLC compliance.
 * MRP verifies code is ready for merge/release.
 *
 * Usage:
 *   - Before G3 (Build Complete): Generate MRP for PR merge
 *   - Before G4 (Release Ready): Generate MRP for release
 *
 * Checklist includes:
 *   - Build status
 *   - Test status
 *   - Code review status
 *   - Vibecoding Index
 *   - Security scan
 *   - Documentation status
 *
 * @module sdlc/mrp-service
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.4 Implementation
 * @authority ADR-004 SDLC Gate Engine
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { VibecodingResult } from "./vibecoding/vibecoding-index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * MRP check item status.
 */
export type MRPCheckStatus = "pass" | "fail" | "pending" | "skipped";

/**
 * Individual check in an MRP.
 */
export interface MRPCheck {
  id: string;
  name: string;
  status: MRPCheckStatus;
  required: boolean;
  details?: string;
  evidence?: string;
  checkedAt?: string;
}

/**
 * Code review information.
 */
export interface CodeReview {
  reviewer: string;
  status: "approved" | "changes_requested" | "pending";
  comments?: string;
  reviewedAt?: string;
}

/**
 * Full Merge-Readiness Package.
 */
export interface MergeReadinessPackage {
  id: string;
  version: string;

  // Context
  projectId: string;
  featureId: string;
  branchName: string;
  targetBranch: string;
  prNumber?: string;

  // Metadata
  createdAt: string;
  createdBy: string;

  // Checks
  checks: MRPCheck[];

  // Vibecoding
  vibecodingResult?: VibecodingResult;

  // Reviews
  codeReviews: CodeReview[];

  // Summary
  allChecksPassed: boolean;
  blockers: string[];

  // Status
  status: "pending" | "ready" | "blocked" | "merged";
  mergedAt?: string;
  mergedBy?: string;
}

/**
 * Configuration for MRP generation.
 */
export interface MRPConfig {
  projectId: string;
  featureId: string;
  branchName: string;
  targetBranch: string;
  createdBy: string;
  prNumber?: string;
}

// ============================================================================
// Default Checks
// ============================================================================

/**
 * Standard MRP checks.
 */
export const DEFAULT_MRP_CHECKS: Omit<MRPCheck, "status" | "checkedAt">[] = [
  {
    id: "mrp-build",
    name: "Build passes",
    required: true,
  },
  {
    id: "mrp-lint",
    name: "Lint passes",
    required: true,
  },
  {
    id: "mrp-tests",
    name: "All tests pass",
    required: true,
  },
  {
    id: "mrp-coverage",
    name: "Test coverage > 80%",
    required: true,
  },
  {
    id: "mrp-vibecoding",
    name: "Vibecoding Index in Green zone",
    required: true,
  },
  {
    id: "mrp-security",
    name: "Security scan passed",
    required: false,
  },
  {
    id: "mrp-review",
    name: "Code review approved",
    required: true,
  },
  {
    id: "mrp-docs",
    name: "Documentation updated",
    required: false,
  },
  {
    id: "mrp-changelog",
    name: "Changelog updated",
    required: false,
  },
];

// ============================================================================
// MRP Service Class
// ============================================================================

/**
 * Service for generating and managing Merge-Readiness Packages.
 */
export class MRPService {
  private packages: Map<string, MergeReadinessPackage> = new Map();
  private packageCounter = 0;

  /**
   * Generate a new MRP ID.
   */
  private generateId(): string {
    this.packageCounter++;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `MRP-${date}-${String(this.packageCounter).padStart(3, "0")}`;
  }

  /**
   * Create a new Merge-Readiness Package.
   */
  create(config: MRPConfig): MergeReadinessPackage {
    const id = this.generateId();

    // Initialize checks with pending status
    const checks: MRPCheck[] = DEFAULT_MRP_CHECKS.map((check) => ({
      ...check,
      status: "pending" as MRPCheckStatus,
    }));

    const mrp: MergeReadinessPackage = {
      id,
      version: "1.0.0",
      projectId: config.projectId,
      featureId: config.featureId,
      branchName: config.branchName,
      targetBranch: config.targetBranch,
      ...(config.prNumber !== undefined ? { prNumber: config.prNumber } : {}),
      createdAt: new Date().toISOString(),
      createdBy: config.createdBy,
      checks,
      codeReviews: [],
      allChecksPassed: false,
      blockers: [],
      status: "pending",
    };

    this.packages.set(id, mrp);
    return mrp;
  }

  /**
   * Update a check status.
   */
  updateCheck(
    mrpId: string,
    checkId: string,
    status: MRPCheckStatus,
    details?: string,
    evidence?: string,
  ): MergeReadinessPackage {
    const mrp = this.packages.get(mrpId);
    if (!mrp) {
      throw new Error(`MRP ${mrpId} not found`);
    }

    const check = mrp.checks.find((c) => c.id === checkId);
    if (!check) {
      throw new Error(`Check ${checkId} not found in MRP ${mrpId}`);
    }

    check.status = status;
    if (details !== undefined) {
      check.details = details;
    }
    if (evidence !== undefined) {
      check.evidence = evidence;
    }
    check.checkedAt = new Date().toISOString();

    // Recalculate overall status
    this.recalculateStatus(mrp);

    return mrp;
  }

  /**
   * Set Vibecoding result.
   */
  setVibecodingResult(
    mrpId: string,
    result: VibecodingResult,
  ): MergeReadinessPackage {
    const mrp = this.packages.get(mrpId);
    if (!mrp) {
      throw new Error(`MRP ${mrpId} not found`);
    }

    mrp.vibecodingResult = result;

    // Update vibecoding check
    const vibeCheck = mrp.checks.find((c) => c.id === "mrp-vibecoding");
    if (vibeCheck) {
      vibeCheck.status = result.zone === "green" ? "pass" : "fail";
      vibeCheck.details = `Score: ${result.score}, Zone: ${result.zone}`;
      vibeCheck.checkedAt = new Date().toISOString();
    }

    this.recalculateStatus(mrp);
    return mrp;
  }

  /**
   * Add a code review.
   */
  addCodeReview(mrpId: string, review: CodeReview): MergeReadinessPackage {
    const mrp = this.packages.get(mrpId);
    if (!mrp) {
      throw new Error(`MRP ${mrpId} not found`);
    }

    mrp.codeReviews.push({
      ...review,
      reviewedAt: review.reviewedAt ?? new Date().toISOString(),
    });

    // Update review check based on all reviews
    const hasApproval = mrp.codeReviews.some((r) => r.status === "approved");
    const reviewCheck = mrp.checks.find((c) => c.id === "mrp-review");
    if (reviewCheck) {
      reviewCheck.status = hasApproval ? "pass" : "pending";
      reviewCheck.details = `${mrp.codeReviews.length} review(s)`;
      reviewCheck.checkedAt = new Date().toISOString();
    }

    this.recalculateStatus(mrp);
    return mrp;
  }

  /**
   * Mark MRP as merged.
   */
  markMerged(mrpId: string, mergedBy: string): MergeReadinessPackage {
    const mrp = this.packages.get(mrpId);
    if (!mrp) {
      throw new Error(`MRP ${mrpId} not found`);
    }
    if (mrp.status !== "ready") {
      throw new Error(`Cannot merge MRP with status ${mrp.status}`);
    }

    mrp.status = "merged";
    mrp.mergedAt = new Date().toISOString();
    mrp.mergedBy = mergedBy;

    return mrp;
  }

  /**
   * Get an MRP by ID.
   */
  get(mrpId: string): MergeReadinessPackage | undefined {
    return this.packages.get(mrpId);
  }

  /**
   * List all MRPs.
   */
  list(filter?: {
    status?: string;
    projectId?: string;
  }): MergeReadinessPackage[] {
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
   * Recalculate overall MRP status.
   */
  private recalculateStatus(mrp: MergeReadinessPackage): void {
    const blockers: string[] = [];

    // Check all required checks
    for (const check of mrp.checks) {
      if (check.required) {
        if (check.status === "fail") {
          blockers.push(`${check.name}: FAILED`);
        } else if (check.status === "pending") {
          blockers.push(`${check.name}: PENDING`);
        }
      }
    }

    mrp.blockers = blockers;
    mrp.allChecksPassed = blockers.length === 0;
    mrp.status = blockers.length === 0 ? "ready" : "blocked";
  }

  /**
   * Generate MRP markdown document.
   */
  toMarkdown(mrpId: string): string {
    const mrp = this.packages.get(mrpId);
    if (!mrp) {
      throw new Error(`MRP ${mrpId} not found`);
    }

    const statusEmoji = {
      pass: "✅",
      fail: "❌",
      pending: "⏳",
      skipped: "⏭️",
    };

    const lines: string[] = [
      `# ${mrp.id}: Merge-Readiness Package`,
      "",
      `**Status:** ${mrp.status.toUpperCase()}`,
      `**Branch:** ${mrp.branchName} → ${mrp.targetBranch}`,
      mrp.prNumber ? `**PR:** #${mrp.prNumber}` : "",
      `**Created:** ${mrp.createdAt}`,
      `**Created By:** ${mrp.createdBy}`,
      "",
      "## Checklist",
      "",
    ].filter(Boolean);

    for (const check of mrp.checks) {
      const emoji = statusEmoji[check.status];
      const required = check.required ? "(required)" : "(optional)";
      lines.push(`- ${emoji} **${check.name}** ${required}`);
      if (check.details) {
        lines.push(`  - ${check.details}`);
      }
    }

    if (mrp.vibecodingResult) {
      lines.push("");
      lines.push("## Vibecoding Index");
      lines.push("");
      lines.push(`**Score:** ${mrp.vibecodingResult.score}`);
      lines.push(`**Zone:** ${mrp.vibecodingResult.zone.toUpperCase()}`);
      lines.push("");
      lines.push("| Signal | Value | Threshold | Status |");
      lines.push("|--------|-------|-----------|--------|");
      for (const signal of mrp.vibecodingResult.signals) {
        const status = signal.passed ? "✅" : "❌";
        lines.push(
          `| ${signal.name} | ${signal.value} | ${signal.threshold} | ${status} |`,
        );
      }
    }

    if (mrp.codeReviews.length > 0) {
      lines.push("");
      lines.push("## Code Reviews");
      lines.push("");
      for (const review of mrp.codeReviews) {
        const status =
          review.status === "approved"
            ? "✅ Approved"
            : review.status === "changes_requested"
              ? "🔄 Changes Requested"
              : "⏳ Pending";
        lines.push(`- **${review.reviewer}**: ${status}`);
        if (review.comments) {
          lines.push(`  - ${review.comments}`);
        }
      }
    }

    if (mrp.blockers.length > 0) {
      lines.push("");
      lines.push("## Blockers");
      lines.push("");
      for (const blocker of mrp.blockers) {
        lines.push(`- ❌ ${blocker}`);
      }
    }

    if (mrp.mergedAt) {
      lines.push("");
      lines.push("## Merged");
      lines.push("");
      lines.push(`**Merged By:** ${mrp.mergedBy}`);
      lines.push(`**Merged At:** ${mrp.mergedAt}`);
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

let globalMRPService: MRPService | undefined;

export function getMRPService(): MRPService {
  if (!globalMRPService) {
    globalMRPService = new MRPService();
  }
  return globalMRPService;
}

/**
 * Reset the global MRPService instance.
 * Useful for testing or reconfiguration.
 */
export function resetMRPService(): void {
  globalMRPService = undefined;
}
