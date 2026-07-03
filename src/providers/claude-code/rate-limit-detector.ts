/**
 * Claude Code CLI Rate-Limit Detector
 *
 * EndiorBot uses Claude Code CLI via OAuth (Claude Max subscription).
 * The Max plan enforces two rate-limit windows:
 *   - 5-hour rolling window (prompt count / session budget)
 *   - Weekly window (~240-480 h of Sonnet depending on tier)
 *
 * When either window is exhausted, the CLI emits a specific error signature.
 * This module classifies a CLI response as RATE_LIMITED vs other failure modes
 * so the router can make a policy decision:
 *   - RATE_LIMITED   → fallback to Gemini (CEO-approved compensation path)
 *   - TIMEOUT / HANG → surface error to user (do NOT silently swap to paid API)
 *   - OTHER ERROR    → surface error to user
 *
 * Sprint 136 A11 (added after CEO field test 2026-04-18):
 *   "chúng ta chỉ fallback sang Gemini khi bị rate limit (5h, weekly rate limit) của CC"
 *
 * @module providers/claude-code/rate-limit-detector
 * @sdlc_framework 6.4.0
 */

export type ClaudeCodeFailureKind =
  | "RATE_LIMITED"   // Max plan 5h or weekly rate limit hit
  | "TIMEOUT"        // Process timed out (SIGTERM from our side)
  | "AUTH"           // OAuth session expired / not logged in
  | "OTHER";         // Anything else (unknown errors, crashes)

export interface ClaudeCodeFailureClassification {
  kind: ClaudeCodeFailureKind;
  /** Human-readable reason for the classification */
  reason: string;
  /** The exact token that triggered the match (if any) */
  matchedToken?: string;
}

/**
 * Patterns that indicate the Claude Code CLI hit a Max-plan rate limit.
 *
 * Sourced from observed CLI output:
 *   - "You've hit your 5-hour limit"
 *   - "weekly limit" / "weekly usage"
 *   - "rate limit" (generic HTTP 429 surfacing)
 *   - "usage limit" — canonical Anthropic error text
 *   - "resets at" (phrase near rate-limit messages indicating retry time)
 *
 * Multi-word phrases are case-insensitive. Keep this list conservative —
 * false positives cause user-visible Gemini routing when Claude is actually
 * just broken, which masks real bugs.
 */
// Order: most specific patterns FIRST so labels reflect the strongest signal.
// A generic /rate[-_ ]?limit/ match last as a catch-all.
const RATE_LIMIT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /"type"\s*:\s*"rate_limit_error"/i, label: "api-error-rate_limit" },
  { pattern: /"type"\s*:\s*"usage_policy_violation"/i, label: "api-error-usage_policy" },
  { pattern: /\b5[-\s]?hour\s+(rate\s+)?limit/i, label: "5-hour-limit" },
  { pattern: /\bweekly\s+(rate\s+)?limit/i, label: "weekly-limit" },
  { pattern: /\bweekly\s+usage\b/i, label: "weekly-usage" },
  { pattern: /\bHTTP\s*429\b/i, label: "http-429" },
  { pattern: /\b(quota|allotment)\s+(exceeded|exhausted)\b/i, label: "quota-exceeded" },
  { pattern: /\busage[\s_-]?limit(ed)?\b/i, label: "usage-limit" },
  { pattern: /\brate[\s_-]?limit(ed|_error)?\b/i, label: "rate-limit-generic" },
];

/**
 * Patterns that indicate OAuth / authentication failure (not rate-limit).
 * ADR-053 (Sprint 145): Auth failures now trigger kimi-coding fallback
 * (CEO subscription via API key, independent of Claude OAuth).
 * Kept separate from rate-limit so the router can log the root cause clearly.
 */
const AUTH_FAIL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bnot\s+authenticated\b/i, label: "not-authenticated" },
  { pattern: /\bnot\s+logged\s+in\b/i, label: "not-logged-in" },
  { pattern: /\bplease\s+(run\s+)?[`/]?login[`/]?/i, label: "login-required" },
  { pattern: /\bplease\s+(run\s+)?`?claude\s+login`?/i, label: "claude-login-required" },
  { pattern: /\boauth\s+(token\s+)?(expired|invalid)\b/i, label: "oauth-expired" },
  { pattern: /\b401\s+unauthorized\b/i, label: "http-401" },
];

/**
 * Classify a Claude Code CLI failure by inspecting its stdout + stderr.
 *
 * @param ctx — all signals from the failed invocation
 * @returns discriminated classification the router can branch on
 */
export function classifyClaudeCodeFailure(ctx: {
  stdout?: string;
  stderr?: string;
  error?: string;
  /** True when the failure was caused by our own timeout (SIGTERM from host) */
  timedOutByHost?: boolean;
  /** Process exit code, if known */
  exitCode?: number;
}): ClaudeCodeFailureClassification {
  // Host-side timeout takes precedence — we killed the child because it stalled,
  // so regardless of what it said, classify as TIMEOUT and surface to user.
  if (ctx.timedOutByHost) {
    return {
      kind: "TIMEOUT",
      reason: "Host-enforced timeout (SIGTERM). Claude Code CLI did not respond within the configured window.",
    };
  }

  const corpus = [ctx.stdout, ctx.stderr, ctx.error].filter(Boolean).join("\n");

  // Auth failures come BEFORE rate-limit — avoid false-matching "rate limit" in
  // an auth error page. Also, auth failures don't improve by switching to Gemini.
  for (const { pattern, label } of AUTH_FAIL_PATTERNS) {
    if (pattern.test(corpus)) {
      return {
        kind: "AUTH",
        reason: `Claude Code authentication failure: ${label}`,
        matchedToken: label,
      };
    }
  }

  for (const { pattern, label } of RATE_LIMIT_PATTERNS) {
    if (pattern.test(corpus)) {
      return {
        kind: "RATE_LIMITED",
        reason: `Claude Code Max-plan rate limit hit: ${label}`,
        matchedToken: label,
      };
    }
  }

  return {
    kind: "OTHER",
    reason:
      ctx.error ||
      (ctx.exitCode !== undefined
        ? `Claude Code exited with code ${ctx.exitCode}`
        : "Unknown Claude Code failure (no recognized pattern in stdout/stderr)"),
  };
}
