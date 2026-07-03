/**
 * OTT Audit Logger
 *
 * Audit logging for OTT security events.
 * Tracks message processing, violations, and blocks.
 *
 * Storage: ~/.endiorbot/audit/ott-*.json
 * Rotation: Daily files, auto-cleanup after 30 days
 *
 * @module security/ott-audit
 * @version 1.0.0
 * @date 2026-02-24
 * @status ACTIVE - Sprint 46 Day 1
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, mkdirSync, appendFileSync, readdirSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * OTT audit entry type.
 */
export type OTTAuditType =
  | 'message'        // Regular message processed
  | 'violation'      // Violation detected
  | 'block'          // Message blocked
  | 'rate_limit';    // Rate limit exceeded

/**
 * Base OTT audit entry.
 */
export interface OTTAuditEntry {
  /** Entry type */
  type: OTTAuditType;
  /** Message ID from source */
  messageId: string;
  /** Source channel */
  source: string;
  /** Sender ID */
  senderId: string;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Message audit entry (clean messages).
 */
export interface OTTMessageAudit extends OTTAuditEntry {
  type: 'message';
  /** Content length (not full content for privacy) */
  contentLength: number;
  /** Whether message was processed */
  processed: boolean;
}

/**
 * Violation audit entry.
 */
export interface OTTViolationAudit extends OTTAuditEntry {
  type: 'violation';
  /** List of detected violations */
  violations: string[];
  /** Whether message was blocked */
  blocked: boolean;
  /** Block reason if blocked */
  blockReason?: string;
}

/**
 * Rate limit audit entry.
 */
export interface OTTRateLimitAudit extends OTTAuditEntry {
  type: 'rate_limit';
  /** Messages in window */
  messagesInWindow: number;
  /** Window size in ms */
  windowMs: number;
}

/**
 * Union type for all audit entries.
 */
export type AnyOTTAudit = OTTMessageAudit | OTTViolationAudit | OTTRateLimitAudit;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Audit configuration.
 */
export interface OTTAuditConfig {
  /** Base directory for audit logs */
  baseDir: string;
  /** Retention period in days */
  retentionDays: number;
  /** Enable console logging */
  consoleLog: boolean;
  /** Maximum entries per file before rotation */
  maxEntriesPerFile: number;
}

/**
 * Default audit configuration.
 */
export const DEFAULT_AUDIT_CONFIG: OTTAuditConfig = {
  baseDir: join(homedir(), '.endiorbot', 'audit'),
  retentionDays: 30,
  consoleLog: false,
  maxEntriesPerFile: 10_000,
};

// ============================================================================
// Audit Logger
// ============================================================================

/**
 * OTT Audit Logger.
 *
 * Provides structured audit logging for OTT security events.
 * Logs are stored in daily JSON files for easy querying.
 */
export class OTTAuditLogger {
  private readonly config: OTTAuditConfig;
  private entryCount: number = 0;
  private currentDate: string = '';

  constructor(config: Partial<OTTAuditConfig> = {}) {
    this.config = { ...DEFAULT_AUDIT_CONFIG, ...config };
    this.ensureDirectory();
  }

  /**
   * Ensure audit directory exists.
   */
  private ensureDirectory(): void {
    if (!existsSync(this.config.baseDir)) {
      mkdirSync(this.config.baseDir, { recursive: true });
    }
  }

  /**
   * Get current audit file path.
   */
  private getAuditFilePath(): string {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Reset counter on new day
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.entryCount = 0;
    }

    return join(this.config.baseDir, `ott-${today}.jsonl`);
  }

  /**
   * Write an audit entry.
   */
  async write(entry: AnyOTTAudit): Promise<void> {
    const filePath = this.getAuditFilePath();
    const line = JSON.stringify(entry) + '\n';

    try {
      appendFileSync(filePath, line, 'utf-8');
      this.entryCount++;

      if (this.config.consoleLog) {
        this.logToConsole(entry);
      }
    } catch (error) {
      // Silent fail for audit - don't break message processing
      console.error(`[OTT-AUDIT] Write error: ${error}`);
    }
  }

  /**
   * Log entry to console.
   */
  private logToConsole(entry: AnyOTTAudit): void {
    const prefix = `[OTT-AUDIT] [${entry.type.toUpperCase()}]`;

    switch (entry.type) {
      case 'message':
        console.log(`${prefix} ${entry.source}:${entry.senderId} - ${entry.contentLength} chars`);
        break;
      case 'violation':
        console.warn(`${prefix} ${entry.source}:${entry.senderId} - ${entry.violations.join(', ')}`);
        break;
      case 'rate_limit':
        console.warn(`${prefix} ${entry.source}:${entry.senderId} - Rate limited`);
        break;
    }
  }

  /**
   * Log a clean message.
   */
  async logMessage(entry: Omit<OTTMessageAudit, 'type'>): Promise<void> {
    await this.write({ type: 'message', ...entry });
  }

  /**
   * Log a violation.
   */
  async logViolation(entry: Omit<OTTViolationAudit, 'type'>): Promise<void> {
    await this.write({ type: 'violation', ...entry });
  }

  /**
   * Log a rate limit event.
   */
  async logRateLimit(entry: Omit<OTTRateLimitAudit, 'type'>): Promise<void> {
    await this.write({ type: 'rate_limit', ...entry });
  }

  /**
   * Clean up old audit files.
   */
  cleanup(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    let deletedCount = 0;

    try {
      const files = readdirSync(this.config.baseDir);

      for (const file of files) {
        if (!file.startsWith('ott-') || !file.endsWith('.jsonl')) {
          continue;
        }

        // Extract date from filename (ott-YYYY-MM-DD.jsonl)
        const dateMatch = file.match(/ott-(\d{4}-\d{2}-\d{2})\.jsonl/);
        if (!dateMatch || !dateMatch[1]) {
          continue;
        }

        const fileDate = dateMatch[1];
        if (fileDate < cutoffStr) {
          const filePath = join(this.config.baseDir, file);
          unlinkSync(filePath);
          deletedCount++;
        }
      }
    } catch (error) {
      console.error(`[OTT-AUDIT] Cleanup error: ${error}`);
    }

    return deletedCount;
  }

  /**
   * Get audit statistics.
   */
  getStats(): {
    currentFile: string;
    entriesWritten: number;
    retentionDays: number;
  } {
    return {
      currentFile: this.getAuditFilePath(),
      entriesWritten: this.entryCount,
      retentionDays: this.config.retentionDays,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalAuditLogger: OTTAuditLogger | undefined;

/**
 * Get the global OTT audit logger.
 */
export function getOTTAuditLogger(): OTTAuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new OTTAuditLogger();
  }
  return globalAuditLogger;
}

/**
 * Reset the global OTT audit logger.
 */
export function resetOTTAuditLogger(): void {
  globalAuditLogger = undefined;
}

/**
 * Create a new OTT audit logger with custom config.
 */
export function createOTTAuditLogger(config?: Partial<OTTAuditConfig>): OTTAuditLogger {
  return new OTTAuditLogger(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Audit an OTT message (clean, no violations).
 */
export async function auditOTTMessage(entry: Omit<OTTMessageAudit, 'type'>): Promise<void> {
  await getOTTAuditLogger().logMessage(entry);
}

/**
 * Audit an OTT violation.
 */
export async function auditOTTViolation(entry: Omit<OTTViolationAudit, 'type'>): Promise<void> {
  await getOTTAuditLogger().logViolation(entry);
}

/**
 * Audit a rate limit event.
 */
export async function auditOTTRateLimit(entry: Omit<OTTRateLimitAudit, 'type'>): Promise<void> {
  await getOTTAuditLogger().logRateLimit(entry);
}

/**
 * Run audit cleanup.
 */
export function cleanupOTTAudit(): number {
  return getOTTAuditLogger().cleanup();
}
