/**
 * ActionControlPlane
 *
 * Stub implementation for CEO Tool MVP (Sprint 54).
 * Implements ADR-012 pattern: propose → approve → execute → audit.
 *
 * Risk Classification:
 * - READ: auto-approve
 * - WRITE: auto-approve (within project)
 * - DESTRUCTIVE: require CEO approval
 * - MONEY: require CEO approval
 * - ADMIN: require CEO approval
 *
 * @module control-plane/action-control
 * @version 1.0.0
 * @date 2026-02-28
 * @status ACTIVE - Sprint 54
 * @authority ADR-012 ActionControlPlane
 * @pillar 2 - Quality Assurance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { createLogger, type Logger } from "../logging/index.js";
import { STATE_DIR } from "../config/paths.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Risk classification for actions.
 */
export type RiskLevel = "READ" | "WRITE" | "DESTRUCTIVE" | "MONEY" | "ADMIN";

/**
 * Approval status.
 */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "auto_approved";

/**
 * Action proposal.
 */
export interface ActionProposal {
  /** Unique proposal ID */
  id: string;
  /** Action description */
  action: string;
  /** Risk classification */
  risk: RiskLevel;
  /** Whether CEO approval is required */
  requiresApproval: boolean;
  /** Idempotency key for replay protection */
  idempotencyKey: string;
  /** Timestamp */
  timestamp: string;
  /** Source channel */
  source: "cli" | "web" | "telegram" | "zalo" | "gateway";
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Approval decision.
 */
export interface ApprovalDecision {
  proposalId: string;
  status: ApprovalStatus;
  decidedBy: "auto" | "ceo";
  reason?: string;
  timestamp: string;
}

/**
 * Action result.
 */
export interface ActionResult {
  proposalId: string;
  success: boolean;
  output?: string;
  error?: string;
  executedAt: string;
}

/**
 * Audit log entry.
 */
export interface AuditLogEntry {
  id: string;
  proposal: ActionProposal;
  decision: ApprovalDecision;
  result?: ActionResult;
  timestamp: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Blocked command patterns (never execute).
 */
const BLOCKED_COMMANDS: RegExp[] = [
  /rm\s+-rf\s+\//i,
  /rm\s+-rf\s+~/i,
  /rm\s+-rf\s+\*/i,
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /DELETE\s+FROM\s+\w+\s*;/i,
  /TRUNCATE\s+TABLE/i,
  /git\s+push\s+--force\s+origin\s+(main|master)/i,
  /git\s+reset\s+--hard/i,
  /format\s+c:/i,
  /mkfs\./i,
  /dd\s+if=/i,
  /:(){ :\|:& };:/,  // Fork bomb
];

/**
 * Risk classification rules.
 */
const RISK_RULES: Record<RiskLevel, { autoApprove: boolean; patterns?: RegExp[] }> = {
  READ: {
    autoApprove: true,
    patterns: [
      /cat\s+/i,
      /ls\s+/i,
      /find\s+/i,
      /grep\s+/i,
      /git\s+(status|log|diff|show)/i,
      /SELECT\s+/i,
    ],
  },
  WRITE: {
    autoApprove: true,
    patterns: [
      /echo\s+/i,
      /touch\s+/i,
      /mkdir\s+/i,
      /cp\s+/i,
      /mv\s+/i,
      /git\s+(add|commit)/i,
      /INSERT\s+INTO/i,
      /UPDATE\s+\w+\s+SET/i,
    ],
  },
  DESTRUCTIVE: {
    autoApprove: false,
    patterns: [
      /rm\s+/i,
      /rmdir\s+/i,
      /DELETE\s+FROM/i,
      /git\s+reset/i,
      /git\s+revert/i,
    ],
  },
  MONEY: {
    autoApprove: false,
    patterns: [
      /payment/i,
      /invoice/i,
      /charge/i,
      /refund/i,
      /transfer/i,
      /withdraw/i,
    ],
  },
  ADMIN: {
    autoApprove: false,
    patterns: [
      /sudo\s+/i,
      /chmod\s+/i,
      /chown\s+/i,
      /useradd/i,
      /userdel/i,
      /systemctl/i,
      /service\s+/i,
    ],
  },
};

// ============================================================================
// ActionControlPlane Class
// ============================================================================

/**
 * ActionControlPlane - Stub for CEO Tool MVP.
 *
 * Implements propose → approve → execute → audit pattern.
 *
 * Usage:
 * ```typescript
 * const controlPlane = getActionControlPlane();
 *
 * // Propose an action
 * const proposal = controlPlane.propose("git push origin main");
 *
 * // Evaluate (auto-approve or pending)
 * const decision = controlPlane.evaluate(proposal);
 *
 * // Execute if approved
 * if (decision.status === "approved" || decision.status === "auto_approved") {
 *   const result = await controlPlane.execute(proposal);
 * }
 * ```
 */
/** Storage paths for persistence */
const CONTROL_PLANE_DIR = join(STATE_DIR, "control-plane");
const PENDING_APPROVALS_FILE = join(CONTROL_PLANE_DIR, "pending-approvals.json");
const AUDIT_LOG_FILE = join(CONTROL_PLANE_DIR, "audit-log.jsonl");

export class ActionControlPlane {
  private log: Logger;
  private auditLog: AuditLogEntry[] = [];
  private pendingApprovals: Map<string, ActionProposal> = new Map();
  private idempotencyCache: Set<string> = new Set();

  constructor() {
    this.log = createLogger("action-control");
    this.ensureStorageDir();
    this.loadState();
  }

  /**
   * Ensure storage directory exists.
   */
  private ensureStorageDir(): void {
    if (!existsSync(CONTROL_PLANE_DIR)) {
      mkdirSync(CONTROL_PLANE_DIR, { recursive: true });
      this.log.debug("Created control-plane storage directory", { path: CONTROL_PLANE_DIR });
    }
  }

  /**
   * Load state from disk.
   */
  private loadState(): void {
    // Load pending approvals
    if (existsSync(PENDING_APPROVALS_FILE)) {
      try {
        const data = readFileSync(PENDING_APPROVALS_FILE, "utf-8");
        const approvals: ActionProposal[] = JSON.parse(data);
        for (const approval of approvals) {
          this.pendingApprovals.set(approval.id, approval);
        }
        this.log.debug("Loaded pending approvals", { count: approvals.length });
      } catch (error) {
        this.log.warn("Failed to load pending approvals", { error: (error as Error).message });
      }
    }

    // Load recent audit log (last 100 entries)
    if (existsSync(AUDIT_LOG_FILE)) {
      try {
        const data = readFileSync(AUDIT_LOG_FILE, "utf-8");
        const lines = data.trim().split("\n").filter(Boolean);
        // Take last 100 entries
        const recentLines = lines.slice(-100);
        for (const line of recentLines) {
          try {
            const entry: AuditLogEntry = JSON.parse(line);
            this.auditLog.push(entry);
          } catch {
            // Skip malformed lines
          }
        }
        this.log.debug("Loaded audit log", { count: this.auditLog.length });
      } catch (error) {
        this.log.warn("Failed to load audit log", { error: (error as Error).message });
      }
    }
  }

  /**
   * Save pending approvals to disk.
   */
  private savePendingApprovals(): void {
    try {
      const approvals = Array.from(this.pendingApprovals.values());
      writeFileSync(PENDING_APPROVALS_FILE, JSON.stringify(approvals, null, 2));
    } catch (error) {
      this.log.error("Failed to save pending approvals", { error: (error as Error).message });
    }
  }

  /**
   * Append audit log entry to disk.
   */
  private appendAuditLog(entry: AuditLogEntry): void {
    try {
      appendFileSync(AUDIT_LOG_FILE, JSON.stringify(entry) + "\n");
    } catch (error) {
      this.log.error("Failed to append audit log", { error: (error as Error).message });
    }
  }

  /**
   * Check if action is blocked (never execute).
   */
  isBlocked(action: string): boolean {
    for (const pattern of BLOCKED_COMMANDS) {
      if (pattern.test(action)) {
        this.log.warn("Blocked action detected", { action, pattern: pattern.toString() });
        return true;
      }
    }
    return false;
  }

  /**
   * Classify risk level of an action.
   */
  classifyRisk(action: string): RiskLevel {
    // Check from most restrictive to least
    for (const level of ["ADMIN", "MONEY", "DESTRUCTIVE", "WRITE", "READ"] as RiskLevel[]) {
      const rule = RISK_RULES[level];
      if (rule.patterns?.some((p) => p.test(action))) {
        return level;
      }
    }
    // Default to WRITE (requires file changes)
    return "WRITE";
  }

  /**
   * Propose an action for evaluation.
   */
  propose(
    action: string,
    source: ActionProposal["source"] = "cli",
    context?: Record<string, unknown>,
  ): ActionProposal {
    // Check if blocked
    if (this.isBlocked(action)) {
      throw new Error(`Action blocked by security policy: ${action}`);
    }

    const risk = this.classifyRisk(action);
    const requiresApproval = !RISK_RULES[risk].autoApprove;

    // Generate idempotency key (hash of action + timestamp bucket)
    const timeBucket = Math.floor(Date.now() / 60000); // 1-minute buckets
    const idempotencyKey = `${action}-${timeBucket}`;

    // Check idempotency
    if (this.idempotencyCache.has(idempotencyKey)) {
      throw new Error("Duplicate action within idempotency window");
    }

    const proposal: ActionProposal = {
      id: randomUUID(),
      action,
      risk,
      requiresApproval,
      idempotencyKey,
      timestamp: new Date().toISOString(),
      source,
      context: context ?? {},
    };

    this.log.info("Action proposed", {
      id: proposal.id,
      risk,
      requiresApproval,
      action: action.slice(0, 50),
    });

    return proposal;
  }

  /**
   * Evaluate proposal and return decision.
   */
  evaluate(proposal: ActionProposal): ApprovalDecision {
    const decision: ApprovalDecision = {
      proposalId: proposal.id,
      status: "pending",
      decidedBy: "auto",
      timestamp: new Date().toISOString(),
    };

    if (!proposal.requiresApproval) {
      // Auto-approve
      decision.status = "auto_approved";
      decision.reason = `Risk level ${proposal.risk} auto-approved`;
      this.log.info("Action auto-approved", { id: proposal.id, risk: proposal.risk });
    } else {
      // Require CEO approval
      decision.status = "pending";
      decision.reason = `Risk level ${proposal.risk} requires CEO approval`;
      this.pendingApprovals.set(proposal.id, proposal);
      this.savePendingApprovals();
      this.log.info("Action pending approval", { id: proposal.id, risk: proposal.risk });
    }

    return decision;
  }

  /**
   * CEO approves a pending proposal.
   */
  approve(proposalId: string, reason?: string): ApprovalDecision {
    const proposal = this.pendingApprovals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    this.pendingApprovals.delete(proposalId);
    this.savePendingApprovals();

    const decision: ApprovalDecision = {
      proposalId,
      status: "approved",
      decidedBy: "ceo",
      reason: reason ?? "CEO approved",
      timestamp: new Date().toISOString(),
    };

    this.log.info("Action approved by CEO", { id: proposalId, reason });
    return decision;
  }

  /**
   * CEO rejects a pending proposal.
   */
  reject(proposalId: string, reason?: string): ApprovalDecision {
    const proposal = this.pendingApprovals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    this.pendingApprovals.delete(proposalId);
    this.savePendingApprovals();

    const decision: ApprovalDecision = {
      proposalId,
      status: "rejected",
      decidedBy: "ceo",
      reason: reason ?? "CEO rejected",
      timestamp: new Date().toISOString(),
    };

    this.log.info("Action rejected by CEO", { id: proposalId, reason });
    return decision;
  }

  /**
   * Execute an approved action (stub - actual execution handled elsewhere).
   */
  async execute(proposal: ActionProposal): Promise<ActionResult> {
    // Add to idempotency cache
    this.idempotencyCache.add(proposal.idempotencyKey);

    // Clean up old cache entries (keep last 1000)
    if (this.idempotencyCache.size > 1000) {
      const entries = Array.from(this.idempotencyCache);
      const toDelete = entries.slice(0, entries.length - 1000);
      for (const entry of toDelete) {
        this.idempotencyCache.delete(entry);
      }
    }

    // Stub: actual execution would happen here
    const result: ActionResult = {
      proposalId: proposal.id,
      success: true,
      output: `[Stub] Executed: ${proposal.action}`,
      executedAt: new Date().toISOString(),
    };

    this.log.info("Action executed", { id: proposal.id });
    return result;
  }

  /**
   * Record to audit log.
   */
  audit(proposal: ActionProposal, decision: ApprovalDecision, result?: ActionResult): void {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      proposal,
      decision,
      timestamp: new Date().toISOString(),
    };

    // Conditionally add result if provided
    if (result) {
      entry.result = result;
    }

    this.auditLog.push(entry);
    this.appendAuditLog(entry);

    // Keep last 1000 entries in memory
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }

    this.log.debug("Audit log entry added", { id: entry.id, proposalId: proposal.id });
  }

  /**
   * Get pending approvals.
   */
  getPendingApprovals(): ActionProposal[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Get audit log.
   */
  getAuditLog(limit = 100): AuditLogEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get pending approval by ID.
   */
  getPendingApproval(proposalId: string): ActionProposal | undefined {
    return this.pendingApprovals.get(proposalId);
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalControlPlane: ActionControlPlane | undefined;

/**
 * Get the global ActionControlPlane instance.
 */
export function getActionControlPlane(): ActionControlPlane {
  if (!globalControlPlane) {
    globalControlPlane = new ActionControlPlane();
  }
  return globalControlPlane;
}

/**
 * Reset the global ActionControlPlane (for testing).
 */
export function resetActionControlPlane(): void {
  globalControlPlane = undefined;
}
