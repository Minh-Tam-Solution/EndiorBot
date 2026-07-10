/**
 * Queue Command
 *
 * Manage approval queue for CEO decisions.
 *
 * Usage:
 *   endiorbot queue                     - List pending approvals
 *   endiorbot queue list                - List pending approvals
 *   endiorbot queue show <id>           - Show approval details
 *   endiorbot queue approve <id>        - Approve request
 *   endiorbot queue reject <id>         - Reject request
 *   endiorbot queue cancel <id>         - Cancel request
 *   endiorbot queue cleanup             - Remove expired requests
 *
 * Per CTO Day 8 guidance:
 * - queue list shows urgency + expiry prominently
 * - queue approve requires confirmation for block-type decisions
 *
 * @module cli/commands/queue
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 36 Day 8
 * @authority ADR-007 Budget Control
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import * as readline from "readline";
import type { Command } from "commander";
import { padEndTruncate } from "../../utils/text-helpers.js";
import { getCommandLogger } from "../logger.js";
import {
  createApprovalQueue,
  getTimeUntilExpiry,
  type ApprovalRequest,
  type ApprovalUrgency,
} from "../../budget/index.js";

// ============================================================================
// Types
// ============================================================================

interface ListCommandOptions {
  verbose?: boolean;
  json?: boolean;
  all?: boolean;
}

interface ApproveCommandOptions {
  notes?: string;
  yes?: boolean;
}

interface RejectCommandOptions {
  reason?: string;
  yes?: boolean;
}

interface CleanupCommandOptions {
  dryRun?: boolean;
  force?: boolean;
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Get urgency color/symbol for display.
 */
function formatUrgency(urgency: ApprovalUrgency): string {
  const symbols: Record<ApprovalUrgency, string> = {
    critical: "🔴 CRITICAL",
    high: "🟠 HIGH",
    medium: "🟡 MEDIUM",
    low: "🟢 LOW",
  };
  return symbols[urgency] ?? urgency;
}

/**
 * Format time remaining until expiry.
 */
function formatExpiry(request: ApprovalRequest): string {
  const remaining = getTimeUntilExpiry(request);

  if (remaining === 0) {
    return "EXPIRED";
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format age of a request.
 */
function formatAge(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const age = Date.now() - created;

  const hours = Math.floor(age / (1000 * 60 * 60));
  const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 23) {
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Prompt user for confirmation.
 */
async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

// ============================================================================
// List Command
// ============================================================================

/**
 * List pending approvals action.
 */
async function listAction(options: ListCommandOptions): Promise<void> {
  const log = getCommandLogger("queue-list");
  const queue = createApprovalQueue();

  log.debug("Listing approval queue");

  try {
    const requests = options.all ? queue.getAll() : queue.getPending();

    if (options.json) {
      console.log(JSON.stringify(requests, null, 2));
      return;
    }

    console.log("");

    if (requests.length === 0) {
      console.log("  No pending approvals.");
      console.log("");
      return;
    }

    // Per CTO: urgency + expiry prominently displayed
    console.log("  Pending Approvals");
    console.log("  " + "=".repeat(78));
    console.log("");
    console.log(
      `  ${padEndTruncate("ID", 12)} ${padEndTruncate("URGENCY", 14)} ${padEndTruncate("TYPE", 22)} ${padEndTruncate("AGE", 6)} ${padEndTruncate("EXPIRES", 10)} STATUS`,
    );
    console.log("  " + "-".repeat(78));

    for (const req of requests) {
      const id = req.id.slice(4, 12); // Show short ID
      const urgency = formatUrgency(req.urgency);
      const type = req.decisionType;
      const age = formatAge(req.createdAt);
      const expires = req.status === "pending" ? formatExpiry(req) : "-";
      const status = req.status.toUpperCase();

      console.log(
        `  ${padEndTruncate(id, 12)} ${padEndTruncate(urgency, 14)} ${padEndTruncate(type, 22)} ${padEndTruncate(age, 6)} ${padEndTruncate(expires, 10)} ${status}`,
      );
    }

    console.log("");
    console.log("  " + "-".repeat(78));

    const stats = queue.getStats();
    console.log(`  Pending: ${stats.pending}  |  Approved: ${stats.approved}  |  Rejected: ${stats.rejected}`);

    console.log("");
    console.log("  Use 'endiorbot queue show <id>' for details");
    console.log("  Use 'endiorbot queue approve <id>' to approve");
    console.log("");

    log.info("Listed approval queue", { count: requests.length });
  } catch (error) {
    log.error("Failed to list queue", { error });
    console.error(
      `  Failed to list queue: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// ============================================================================
// Show Command
// ============================================================================

/**
 * Show approval details action.
 */
async function showAction(
  requestId: string,
  options: { verbose?: boolean; json?: boolean },
): Promise<void> {
  const log = getCommandLogger("queue-show");
  const queue = createApprovalQueue();

  log.debug("Showing approval request", { requestId });

  try {
    // Find request by partial ID
    const all = queue.getAll();
    const match = all.find(
      (req) =>
        req.id.includes(requestId) ||
        req.id.slice(4).startsWith(requestId),
    );

    if (!match) {
      console.error(`  Approval request not found: ${requestId}`);
      console.error("  Run 'endiorbot queue list' to see available requests.");
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify(match, null, 2));
      return;
    }

    console.log("");
    console.log("  Approval Request Details");
    console.log("  " + "=".repeat(58));
    console.log("");
    console.log(`  ID:           ${match.id}`);
    console.log(`  Status:       ${match.status.toUpperCase()}`);
    console.log(`  Type:         ${match.type}`);
    console.log(`  Decision:     ${match.decisionType}`);
    console.log(`  Risk Level:   ${match.riskLevel.toUpperCase()}`);
    console.log(`  Urgency:      ${formatUrgency(match.urgency)}`);
    console.log("");
    console.log(`  Reason:       ${match.reason}`);
    console.log("");
    console.log(`  Created:      ${new Date(match.createdAt).toLocaleString()}`);

    if (match.status === "pending") {
      console.log(`  Expires in:   ${formatExpiry(match)}`);
    }

    if (match.resolvedBy) {
      console.log("");
      console.log(`  Resolved by:  ${match.resolvedBy}`);
      if (match.resolvedAt) {
        console.log(`  Resolved at:  ${new Date(match.resolvedAt).toLocaleString()}`);
      }
      if (match.resolutionNotes) {
        console.log(`  Notes:        ${match.resolutionNotes}`);
      }
    }

    if (options.verbose && match.context) {
      console.log("");
      console.log("  Context:");
      if (match.context.description) {
        console.log(`    Description: ${match.context.description}`);
      }
      if (match.context.filesAffected && match.context.filesAffected.length > 0) {
        console.log(`    Files:       ${match.context.filesAffected.length} affected`);
        for (const file of match.context.filesAffected.slice(0, 5)) {
          console.log(`      - ${file}`);
        }
      }
      if (match.context.costImpact) {
        console.log(`    Cost:        $${match.context.costImpact.toFixed(2)}`);
      }
    }

    console.log("");
    console.log("  " + "=".repeat(58));

    if (match.status === "pending") {
      console.log("");
      console.log(`  To approve: endiorbot queue approve ${match.id.slice(4, 12)}`);
      console.log(`  To reject:  endiorbot queue reject ${match.id.slice(4, 12)} --reason "..."`);
    }

    console.log("");

    log.info("Showed approval request", { requestId: match.id });
  } catch (error) {
    log.error("Failed to show request", { error });
    console.error(
      `  Failed to show request: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// ============================================================================
// Approve Command
// ============================================================================

/**
 * Approve request action.
 * Per CTO: Requires confirmation for block-type decisions.
 */
async function approveAction(
  requestId: string,
  options: ApproveCommandOptions,
): Promise<void> {
  const log = getCommandLogger("queue-approve");
  const queue = createApprovalQueue();

  log.debug("Approving request", { requestId });

  try {
    // Find request by partial ID
    const all = queue.getAll();
    const match = all.find(
      (req) =>
        req.id.includes(requestId) ||
        req.id.slice(4).startsWith(requestId),
    );

    if (!match) {
      console.error(`  Approval request not found: ${requestId}`);
      process.exit(1);
    }

    if (match.status !== "pending") {
      console.error(`  Request already ${match.status}: ${requestId}`);
      process.exit(1);
    }

    // Per CTO: block-type decisions require confirmation
    if (match.type === "block" && !options.yes) {
      console.log("");
      console.log("  " + "=".repeat(58));
      console.log("  ⚠️  APPROVAL CONFIRMATION REQUIRED");
      console.log("  " + "=".repeat(58));
      console.log("");
      console.log(`  ID:       ${match.id.slice(4, 12)}`);
      console.log(`  Type:     ${match.decisionType}`);
      console.log(`  Risk:     ${match.riskLevel.toUpperCase()}`);
      console.log(`  Urgency:  ${formatUrgency(match.urgency)}`);
      console.log("");
      console.log(`  Reason:   ${match.reason}`);
      console.log("");

      const confirmed = await confirm("  Approve this request?");

      if (!confirmed) {
        console.log("");
        console.log("  Approval cancelled.");
        console.log("");
        return;
      }
    }

    // Approve the request
    const success = queue.approve(match.id, "CEO", options.notes);

    if (success) {
      console.log("");
      console.log(`  ✅ Request approved: ${match.id.slice(4, 12)}`);
      if (options.notes) {
        console.log(`  Notes: ${options.notes}`);
      }
      console.log("");

      log.info("Approved request", { requestId: match.id });
    } else {
      console.error(`  Failed to approve request: ${requestId}`);
      process.exit(1);
    }
  } catch (error) {
    log.error("Failed to approve request", { error });
    console.error(
      `  Failed to approve: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// ============================================================================
// Reject Command
// ============================================================================

/**
 * Reject request action.
 */
async function rejectAction(
  requestId: string,
  options: RejectCommandOptions,
): Promise<void> {
  const log = getCommandLogger("queue-reject");
  const queue = createApprovalQueue();

  log.debug("Rejecting request", { requestId });

  try {
    // Find request by partial ID
    const all = queue.getAll();
    const match = all.find(
      (req) =>
        req.id.includes(requestId) ||
        req.id.slice(4).startsWith(requestId),
    );

    if (!match) {
      console.error(`  Approval request not found: ${requestId}`);
      process.exit(1);
    }

    if (match.status !== "pending") {
      console.error(`  Request already ${match.status}: ${requestId}`);
      process.exit(1);
    }

    // Confirm rejection
    if (!options.yes) {
      console.log("");
      console.log(`  Rejecting: ${match.id.slice(4, 12)}`);
      console.log(`  Type:      ${match.decisionType}`);
      console.log(`  Reason:    ${options.reason ?? "(no reason provided)"}`);
      console.log("");

      const confirmed = await confirm("  Reject this request?");

      if (!confirmed) {
        console.log("");
        console.log("  Rejection cancelled.");
        console.log("");
        return;
      }
    }

    // Reject the request
    const success = queue.reject(match.id, "CEO", options.reason);

    if (success) {
      console.log("");
      console.log(`  ❌ Request rejected: ${match.id.slice(4, 12)}`);
      if (options.reason) {
        console.log(`  Reason: ${options.reason}`);
      }
      console.log("");

      log.info("Rejected request", { requestId: match.id });
    } else {
      console.error(`  Failed to reject request: ${requestId}`);
      process.exit(1);
    }
  } catch (error) {
    log.error("Failed to reject request", { error });
    console.error(
      `  Failed to reject: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// ============================================================================
// Cancel Command
// ============================================================================

/**
 * Cancel request action.
 */
async function cancelAction(
  requestId: string,
  options: { reason?: string },
): Promise<void> {
  const log = getCommandLogger("queue-cancel");
  const queue = createApprovalQueue();

  log.debug("Cancelling request", { requestId });

  try {
    // Find request by partial ID
    const all = queue.getAll();
    const match = all.find(
      (req) =>
        req.id.includes(requestId) ||
        req.id.slice(4).startsWith(requestId),
    );

    if (!match) {
      console.error(`  Approval request not found: ${requestId}`);
      process.exit(1);
    }

    if (match.status !== "pending") {
      console.error(`  Request already ${match.status}: ${requestId}`);
      process.exit(1);
    }

    // Cancel the request
    const success = queue.cancel(match.id, options.reason ?? "Cancelled via CLI");

    if (success) {
      console.log("");
      console.log(`  Request cancelled: ${match.id.slice(4, 12)}`);
      console.log("");

      log.info("Cancelled request", { requestId: match.id });
    } else {
      console.error(`  Failed to cancel request: ${requestId}`);
      process.exit(1);
    }
  } catch (error) {
    log.error("Failed to cancel request", { error });
    console.error(
      `  Failed to cancel: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// ============================================================================
// Cleanup Command
// ============================================================================

/**
 * Cleanup expired requests action.
 */
async function cleanupAction(options: CleanupCommandOptions): Promise<void> {
  const log = getCommandLogger("queue-cleanup");
  const queue = createApprovalQueue();

  log.debug("Cleaning up queue");

  try {
    const all = queue.getAll();
    const resolved = all.filter((r) => r.status !== "pending");

    if (options.dryRun) {
      console.log("");
      console.log(`  [DRY RUN] Would remove ${resolved.length} resolved request(s)`);
      console.log("");
      return;
    }

    if (resolved.length === 0) {
      console.log("");
      console.log("  No resolved requests to clean up.");
      console.log("");
      return;
    }

    if (!options.force) {
      console.log("");
      console.log(`  This will remove ${resolved.length} resolved request(s).`);
      console.log("  Use --force to confirm, or --dry-run to preview.");
      console.log("");
      return;
    }

    const removed = queue.clearResolved();

    console.log("");
    console.log(`  Removed ${removed} resolved request(s)`);
    console.log("");

    log.info("Cleaned up queue", { removed });
  } catch (error) {
    log.error("Failed to cleanup queue", { error });
    console.error(
      `  Failed to cleanup: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register queue command with subcommands.
 */
export function registerQueueCommand(program: Command): void {
  const queue = program
    .command("queue")
    .description("Manage approval queue for CEO decisions")
    .action(async () => {
      // Default action: list pending
      await listAction({});
    });

  // Subcommand: list
  queue
    .command("list")
    .description("List pending approval requests")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output as JSON")
    .option("-a, --all", "Include resolved requests")
    .action(async (opts) => {
      await listAction({
        verbose: opts.verbose,
        json: opts.json,
        all: opts.all,
      });
    });

  // Subcommand: show
  queue
    .command("show <requestId>")
    .description("Show approval request details")
    .option("-v, --verbose", "Show detailed output")
    .option("--json", "Output as JSON")
    .action(showAction);

  // Subcommand: approve
  queue
    .command("approve <requestId>")
    .description("Approve a pending request")
    .option("-n, --notes <notes>", "Approval notes")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (requestId, opts) => {
      await approveAction(requestId, {
        notes: opts.notes,
        yes: opts.yes,
      });
    });

  // Subcommand: reject
  queue
    .command("reject <requestId>")
    .description("Reject a pending request")
    .option("-r, --reason <reason>", "Rejection reason")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (requestId, opts) => {
      await rejectAction(requestId, {
        reason: opts.reason,
        yes: opts.yes,
      });
    });

  // Subcommand: cancel
  queue
    .command("cancel <requestId>")
    .description("Cancel a pending request")
    .option("-r, --reason <reason>", "Cancellation reason")
    .action(cancelAction);

  // Subcommand: cleanup
  queue
    .command("cleanup")
    .description("Remove resolved (approved/rejected/expired) requests")
    .option("--dry-run", "Preview without removing")
    .option("-f, --force", "Skip confirmation")
    .action(async (opts) => {
      await cleanupAction({
        dryRun: opts.dryRun,
        force: opts.force,
      });
    });
}
