/**
 * Shell Guard
 *
 * Shell command safety guard for agent tools.
 * Ported from SDLC-Orchestrator: shell_guard.py
 *
 * Features:
 *   - 8 deny regex patterns (from Nanobot)
 *   - Path traversal detection
 *   - Workspace restriction
 *   - Output truncation (10KB)
 *   - Environment variable scrubbing
 *
 * Blocks dangerous shell commands before execution by agent tools.
 * Scrubs environment variables to safe allowlist for subprocess isolation.
 *
 * @module security/shell-guard
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.1 Implementation
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Constants
// ============================================================================

export const MAX_OUTPUT_SIZE = 10 * 1024; // 10KB

/**
 * Safe environment variable allowlist.
 * Only these 9 vars are passed to agent subprocesses.
 * LC_ALL included for Vietnamese UTF-8 locale (vi_VN.UTF-8).
 */
export const SAFE_ENV_VARS = [
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "TZ",
  "TERM",
  "USER",
  "SHELL",
  "TMPDIR",
] as const;

// ============================================================================
// Deny Patterns (8 patterns from Nanobot)
// ============================================================================

export interface DenyPattern {
  name: string;
  pattern: RegExp;
}

export const DENY_PATTERNS: DenyPattern[] = [
  {
    name: "recursive_delete",
    pattern: /rm\s+(-[rf]+\s+)*\//,
  },
  {
    name: "fork_bomb",
    pattern: /:\(\)\{.*\|.*&\s*\};/,
  },
  {
    name: "system_control",
    pattern: /(shutdown|reboot|halt|poweroff)/,
  },
  {
    name: "disk_operations",
    pattern: /(mkfs|fdisk|dd\s+if=)/,
  },
  {
    name: "raw_disk_write",
    pattern: />\s*\/dev\/sd/,
  },
  {
    name: "unsafe_permissions",
    pattern: /chmod\s+(-R\s+)?777/,
  },
  {
    name: "pipe_to_shell",
    pattern: /curl.*\|\s*(bash|sh)/,
  },
  {
    name: "eval_injection",
    pattern: /eval\s*\(/,
  },
];

// ============================================================================
// Shell Guard Class
// ============================================================================

export interface CommandCheckResult {
  allowed: boolean;
  reason: string;
}

export interface ShellGuardConfig {
  allowedPaths?: string[];
  extraDenyPatterns?: DenyPattern[];
}

export class ShellGuard {
  private readonly allowedPaths: string[];
  private readonly denyPatterns: DenyPattern[];

  /**
   * Create a new ShellGuard.
   *
   * @param config - Configuration options
   */
  constructor(config: ShellGuardConfig = {}) {
    this.allowedPaths = config.allowedPaths ?? [];
    this.denyPatterns = [...DENY_PATTERNS];

    if (config.extraDenyPatterns) {
      this.denyPatterns.push(...config.extraDenyPatterns);
    }
  }

  /**
   * Check if a shell command is safe to execute.
   *
   * @param command - Shell command to check
   * @returns Object with allowed flag and reason
   */
  checkCommand(command: string): CommandCheckResult {
    // Check deny patterns
    for (const { name, pattern } of this.denyPatterns) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          reason: `Blocked by deny pattern: ${name}`,
        };
      }
    }

    // Check path traversal
    if (command.includes("..")) {
      return {
        allowed: false,
        reason: "Path traversal detected: '..' in command",
      };
    }

    // Check workspace restriction (if allowed paths configured)
    if (this.allowedPaths.length > 0) {
      const tokens = command.split(/\s+/);

      for (const token of tokens) {
        if (token.startsWith("/")) {
          const isAllowed = this.allowedPaths.some((p) => token.startsWith(p));

          if (!isAllowed) {
            return {
              allowed: false,
              reason: `Path not allowed: ${token} (allowed: ${this.allowedPaths.join(", ")})`,
            };
          }
        }
      }
    }

    return { allowed: true, reason: "OK" };
  }

  /**
   * Check if command matches any deny pattern.
   *
   * @param command - Shell command to check
   * @returns true if command is blocked
   */
  isBlocked(command: string): boolean {
    return !this.checkCommand(command).allowed;
  }

  /**
   * Truncate command output to MAX_OUTPUT_SIZE (10KB).
   *
   * Prevents unbounded context injection from verbose commands.
   *
   * @param output - Raw command output
   * @returns Truncated output with indicator if truncated
   */
  static truncateOutput(output: string): string {
    if (output.length > MAX_OUTPUT_SIZE) {
      const truncated = output.slice(0, MAX_OUTPUT_SIZE);
      return (
        `${truncated}\n` +
        `... truncated (${output.length.toLocaleString()} bytes total, ` +
        `limit ${MAX_OUTPUT_SIZE.toLocaleString()} bytes)`
      );
    }
    return output;
  }

  /**
   * Return a safe environment dict for agent subprocess execution.
   *
   * Reads process.env, keeps only variables in SAFE_ENV_VARS.
   * Missing vars are omitted (not set to empty string).
   *
   * @returns Safe environment object for subprocess
   */
  static scrubEnvironment(): Record<string, string> {
    const safeEnv: Record<string, string> = {};

    for (const varName of SAFE_ENV_VARS) {
      const value = process.env[varName];
      if (value !== undefined) {
        safeEnv[varName] = value;
      }
    }

    return safeEnv;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalGuard: ShellGuard | undefined;

export function getShellGuard(): ShellGuard {
  if (!globalGuard) {
    globalGuard = new ShellGuard();
  }
  return globalGuard;
}

/**
 * Convenience function for quick command check.
 *
 * @param command - Shell command to check
 * @returns Object with allowed flag and reason
 */
export function checkCommand(command: string): CommandCheckResult {
  return getShellGuard().checkCommand(command);
}
