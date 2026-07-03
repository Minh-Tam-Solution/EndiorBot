/**
 * Audit Commands — /audit <type>
 *
 * Sprint 125: /audit permissions [--limit N]
 * Sprint 135: /audit exec-policy | ssrf | webhooks [--limit N]
 *
 * @module commands/handlers/audit-commands
 * @version 2.0.0
 * @date 2026-04-12
 * @status ACTIVE — Sprint 135
 * @authority ADR-041 Permission Audit Trail + Sprint 135 Surface Parity
 * @sdlc SDLC Framework 6.4.0
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { queryRecentDecisions, formatAuditEntries } from "../../security/permission-audit.js";
import { readAuditTail } from "../../security/exec-approvals/index.js";
import type { CommandResult } from "../command-dispatcher.js";

// ============================================================================
// Helpers
// ============================================================================

function parseLimit(args: string[]): number {
  let limit = 10;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx >= 0 && args[limitIdx + 1]) {
    const parsed = parseInt(args[limitIdx + 1]!, 10);
    if (!isNaN(parsed) && parsed > 0) limit = Math.min(parsed, 50);
  }
  return limit;
}

function readJsonlTail(logPath: string, n: number): Record<string, unknown>[] {
  try {
    if (!existsSync(logPath)) return [];
    const lines = readFileSync(logPath, "utf-8").trim().split("\n").filter(l => l.length > 0);
    return lines.slice(-n).map(l => JSON.parse(l) as Record<string, unknown>).reverse();
  } catch {
    return [];
  }
}

// ============================================================================
// Subcommand handlers
// ============================================================================

function handlePermissions(args: string[]): CommandResult {
  const limit = parseLimit(args);
  const entries = queryRecentDecisions(limit);
  const formatted = formatAuditEntries(entries);
  return { success: true, response: `📋 *Permission Audit*\n\n${formatted}` };
}

function handleExecPolicyAudit(args: string[]): CommandResult {
  const limit = parseLimit(args);
  const entries = readAuditTail(limit);
  if (entries.length === 0) {
    return { success: true, response: "📋 No exec-policy audit entries." };
  }
  const lines = [`📋 **Exec-Policy Audit** (last ${entries.length})`, ""];
  for (const e of entries.reverse()) {
    const time = new Date(e.timestamp).toLocaleTimeString();
    const icon = e.decision === "allow" ? "✅" : e.decision === "deny" ? "🚫" : "❓";
    lines.push(`${icon} \`${time}\` **${e.decision}** — ${e.reason ?? "—"}`);
  }
  return { success: true, response: lines.join("\n") };
}

function handleSsrfAudit(args: string[]): CommandResult {
  const limit = parseLimit(args);
  const logPath = join(homedir(), ".endiorbot", "audit-logs", "ssrf-blocks.log");
  const entries = readJsonlTail(logPath, limit);
  if (entries.length === 0) {
    return { success: true, response: "📋 No SSRF block entries." };
  }
  const lines = [`🛡️ **SSRF Blocks** (last ${entries.length})`, ""];
  for (const e of entries) {
    const time = new Date(e["timestamp"] as number).toLocaleTimeString();
    lines.push(`🚫 \`${time}\` **${e["reason"]}** — ${e["url"] ?? "—"}`);
  }
  return { success: true, response: lines.join("\n") };
}

function handleWebhooksAudit(args: string[]): CommandResult {
  const limit = parseLimit(args);
  const logPath = join(homedir(), ".endiorbot", "audit-logs", "webhooks.log");
  const entries = readJsonlTail(logPath, limit);
  if (entries.length === 0) {
    return { success: true, response: "📋 No webhook audit entries." };
  }
  const lines = [`🔗 **Webhook Audit** (last ${entries.length})`, ""];
  for (const e of entries) {
    const time = new Date(e["timestamp"] as number).toLocaleTimeString();
    const icon = e["status"] === "dispatched" ? "✅" : "🚫";
    lines.push(`${icon} \`${time}\` **${e["status"]}** trigger=\`${e["triggerId"]}\``);
  }
  return { success: true, response: lines.join("\n") };
}

// ============================================================================
// Main dispatcher
// ============================================================================

/**
 * Handle /audit <type> [--limit N]
 */
export function handleAuditCommand(args: string[]): CommandResult {
  const subcommand = args[0]?.toLowerCase();

  switch (subcommand) {
    case "permissions":
      return handlePermissions(args.slice(1));
    case "exec-policy":
      return handleExecPolicyAudit(args.slice(1));
    case "ssrf":
      return handleSsrfAudit(args.slice(1));
    case "webhooks":
      return handleWebhooksAudit(args.slice(1));
    default:
      return {
        success: true,
        response: [
          "📋 **Audit Commands**",
          "",
          "/audit permissions [--limit N] — permission decisions",
          "/audit exec-policy [--limit N] — exec-policy allow/deny/prompt",
          "/audit ssrf [--limit N] — SSRF blocked requests",
          "/audit webhooks [--limit N] — webhook dispatch events",
        ].join("\n"),
      };
  }
}
