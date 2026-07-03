/**
 * Output Scrubber
 *
 * Credential scrubber for agent tool output.
 * Ported from SDLC-Orchestrator: output_scrubber.py
 *
 * 7 credential patterns:
 *   - 6 key:value patterns (token, api_key, password, secret, bearer, credential)
 *   - 1 PEM block pattern
 *
 * Scrubs credentials from agent tool output BEFORE the output is fed
 * back into the LLM context or stored in evidence.
 *
 * Idempotent: scrub() checks for the "****[REDACTED]" suffix before
 * redacting and skips already-redacted values.
 *
 * @module security/output-scrubber
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

export const REDACTED_SUFFIX = "****[REDACTED]";
export const PEM_REDACTED = "[PEM_KEY_REDACTED]";

// ============================================================================
// Credential Patterns
// ============================================================================

export interface CredentialPattern {
  name: string;
  pattern: RegExp;
}

/**
 * PEM key block pattern (applied first, multiline).
 * Covers RSA, EC, OPENSSH, DSA and bare PRIVATE/PUBLIC KEY headers.
 */
export const PEM_PATTERN = new RegExp(
  "-----BEGIN (?:RSA |EC |OPENSSH |DSA )?(?:PRIVATE|PUBLIC) KEY-----" +
  "[\\s\\S]+?" +
  "-----END (?:RSA |EC |OPENSSH |DSA )?(?:PRIVATE|PUBLIC) KEY-----",
  "gm"
);

/**
 * 6 key:value credential patterns.
 * Patterns match: KEY <sep> VALUE where sep = '=' | ':' | whitespace
 * Values terminate at whitespace, comma, semicolon, quote, or EOL.
 */
export const CREDENTIAL_PATTERNS: CredentialPattern[] = [
  {
    name: "token",
    pattern: /(token\s*[=:]\s*)([^\s,;"']+)/gi,
  },
  {
    name: "api_key",
    pattern: /(api[_-]?key\s*[=:]\s*)([^\s,;"']+)/gi,
  },
  {
    name: "password",
    pattern: /(passw(?:or)?d\s*[=:]\s*)([^\s,;"']+)/gi,
  },
  {
    name: "secret",
    pattern: /(secret(?:[_-]?key)?\s*[=:]\s*)([^\s,;"']+)/gi,
  },
  {
    name: "bearer",
    pattern: /((?:Authorization:\s*)?Bearer\s+)([^\s,;"']+)/gi,
  },
  {
    name: "credential",
    pattern: /(credentials?\s*[=:]\s*)([^\s,;"']+)/gi,
  },
];

// ============================================================================
// Output Scrubber Class
// ============================================================================

export interface ScrubResult {
  scrubbed: string;
  violations: string[];
}

export class OutputScrubber {
  /**
   * Public constant for callers to reference the redaction suffix.
   */
  static readonly REDACTED_SUFFIX = REDACTED_SUFFIX;

  /**
   * Scrub credential values from text.
   *
   * Processing order:
   * 1. PEM key blocks (multiline, entire block replaced)
   * 2. Key:value patterns (6 patterns, idempotency-guarded)
   *
   * @param text - Raw agent output (shell result, file content, etc.)
   * @returns Object with scrubbed text and deduplicated list of pattern names that matched
   */
  scrub(text: string): ScrubResult {
    if (!text) {
      return { scrubbed: text, violations: [] };
    }

    const violations: string[] = [];
    let result = text;

    // Pass 1: PEM blocks
    const pemMatches = result.match(PEM_PATTERN);
    if (pemMatches && pemMatches.length > 0) {
      result = result.replace(PEM_PATTERN, PEM_REDACTED);
      violations.push("pem_block");
    }

    // Pass 2: Key:value patterns
    for (const { name, pattern } of CREDENTIAL_PATTERNS) {
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;

      let hasMatch = false;

      result = result.replace(pattern, (_match, prefix: string, value: string) => {
        // Idempotency guard: already-redacted value → leave unchanged
        if (value.includes(REDACTED_SUFFIX)) {
          return `${prefix}${value}`;
        }
        hasMatch = true;
        return `${prefix}${this.redactValue(value)}`;
      });

      if (hasMatch && !violations.includes(name)) {
        violations.push(name);
      }
    }

    return { scrubbed: result, violations };
  }

  /**
   * Preserve first 4 chars of value + "****[REDACTED]".
   *
   * If value is shorter than 4 chars, the entire value is preserved
   * and the redaction suffix is appended.
   */
  private redactValue(value: string): string {
    const prefix = value.slice(0, 4);
    return `${prefix}${REDACTED_SUFFIX}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalScrubber: OutputScrubber | undefined;

export function getOutputScrubber(): OutputScrubber {
  if (!globalScrubber) {
    globalScrubber = new OutputScrubber();
  }
  return globalScrubber;
}

/**
 * Convenience function for quick scrubbing.
 *
 * @param text - Raw agent output
 * @returns Object with scrubbed text and violations
 */
export function scrub(text: string): ScrubResult {
  return getOutputScrubber().scrub(text);
}
