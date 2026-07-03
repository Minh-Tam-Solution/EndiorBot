/**
 * Permission Audit Logger — Wraps BridgeAuditLogger (CTO C3: no parallel writer)
 *
 * Logs permission decisions via BridgeAuditLogger infrastructure.
 * Query support reads from the JSONL file directly.
 *
 * @module security/permission-audit
 * @version 2.0.0
 * @date 2026-04-02
 * @status ACTIVE — Sprint 125 (CTO C3 fix)
 * @authority ADR-041 Permission Audit Trail
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BridgeAuditLogger } from "../bridge/security/bridge-audit.js";
import type { DecisionReason } from "../agents/safety/risk-classifier.js";
import { scrub } from "./output-scrubber.js";

// ============================================================================
// Types
// ============================================================================

export interface PermissionAuditEntry {
  ts: string;
  tool: string;
  decision: "allow" | "deny" | "confirm";
  reason: DecisionReason;
  riskLevel: string;
  agent?: string;
  sessionId?: string;
}

// ============================================================================
// Singleton — reuses BridgeAuditLogger with permission-specific config
// ============================================================================

const AUDIT_LOG_PATH = join(homedir(), ".endiorbot", "audit", "permissions.jsonl");

let auditLogger: BridgeAuditLogger | undefined;

function getAuditLogger(): BridgeAuditLogger {
  if (!auditLogger) {
    auditLogger = new BridgeAuditLogger({
      logPath: AUDIT_LOG_PATH,
      maxFileSize: 5 * 1024 * 1024, // 5MB (CPO retention policy)
      maxBackups: 3, // 3-month archive
    });
  }
  return auditLogger;
}

// ============================================================================
// Write — delegates to BridgeAuditLogger (CTO C3: no own JSONL writer)
// ============================================================================

/**
 * Log a permission decision.
 * Scrubs tool content before logging (ADR-041 privacy).
 */
export function logPermissionDecision(entry: PermissionAuditEntry): void {
  // Scrub tool name for sensitive content (ADR-041 privacy risk)
  const scrubbedTool = scrub(entry.tool).scrubbed;

  getAuditLogger().log({
    event: "permission_decision" as never, // Extended event type
    actorId: entry.agent ?? "system",
    actor: "agent" as never,
    details: {
      tool: scrubbedTool,
      decision: entry.decision,
      reason: entry.reason,
      riskLevel: entry.riskLevel,
    },
    ...(entry.sessionId ? { sessionId: entry.sessionId } : {}),
  });
}

// ============================================================================
// Query — reads JSONL directly (BridgeAuditLogger is write-only)
// ============================================================================

/**
 * Read recent permission decisions from audit log.
 */
export function queryRecentDecisions(limit = 10): PermissionAuditEntry[] {
  if (!existsSync(AUDIT_LOG_PATH)) return [];

  try {
    const content = readFileSync(AUDIT_LOG_PATH, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const entries: PermissionAuditEntry[] = [];

    const start = Math.max(0, lines.length - limit);
    for (let i = lines.length - 1; i >= start; i--) {
      try {
        const raw = JSON.parse(lines[i]!) as Record<string, unknown>;
        // Map BridgeAuditEntry format back to PermissionAuditEntry
        const details = raw.details as Record<string, unknown> | undefined;
        if (details?.tool) {
          entries.push({
            ts: raw.ts as string,
            tool: details.tool as string,
            decision: details.decision as "allow" | "deny" | "confirm",
            reason: details.reason as DecisionReason,
            riskLevel: details.riskLevel as string,
            agent: raw.actorId as string,
          });
        }
      } catch {
        // Skip malformed
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * Format audit entries for display (CLI/OTT).
 */
export function formatAuditEntries(entries: PermissionAuditEntry[]): string {
  if (entries.length === 0) return "No permission decisions recorded.";

  const lines = entries.map((e, i) => {
    const icon = e.decision === "allow" ? "✅" : e.decision === "deny" ? "❌" : "⚠️";
    const time = e.ts.split("T")[1]?.split(".")[0] ?? e.ts;
    const agentLabel = e.agent && e.agent !== "system" ? ` @${e.agent}` : "";
    return `${i + 1}. ${icon} ${e.tool} (${e.riskLevel}) — ${e.reason.type}: ${e.reason.detail}${agentLabel} — ${time}`;
  });

  return `Last ${entries.length} permission decisions:\n${lines.join("\n")}`;
}
