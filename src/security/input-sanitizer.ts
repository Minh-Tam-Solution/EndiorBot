/**
 * Input Sanitizer
 *
 * External content sanitization for OTT input.
 * Ported from SDLC-Orchestrator: input_sanitizer.py
 *
 * 12 injection regex patterns from OpenClaw src/security/external-content.ts.
 * All OTT messages are wrapped through sanitizeExternalInput() before
 * being injected into agent conversation context.
 *
 * @module security/input-sanitizer
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.1 Implementation
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Injection Patterns (12 patterns from OpenClaw)
// ============================================================================

export interface InjectionPattern {
  name: string;
  pattern: RegExp;
}

export const INJECTION_PATTERNS: InjectionPattern[] = [
  {
    name: "system_prompt_override",
    pattern: /(?:ignore|forget|disregard)\s+(?:previous|above|all)\s+(?:instructions|prompts|rules)/i,
  },
  {
    name: "role_injection",
    pattern: /you\s+are\s+(?:now|a)\s+/i,
  },
  {
    name: "delimiter_escape",
    pattern: /(```|<\|im_sep\|>|<\|system\|>|<\|end\|>)/,
  },
  {
    name: "base64_payload",
    pattern: /base64[:\s]/i,
  },
  {
    name: "prompt_leak_attempt",
    pattern: /(?:show|reveal|print|output)\s+(?:your|the|system)\s+(?:prompt|instructions|rules)/i,
  },
  {
    name: "instruction_override",
    pattern: /(?:new\s+instructions?|override\s+instructions?|updated?\s+rules?)/i,
  },
  {
    name: "jailbreak_prefix",
    pattern: /(?:DAN|developer\s+mode|jailbreak|bypass\s+filter)/i,
  },
  {
    name: "xml_injection",
    pattern: /<(?:system|assistant|user|function|tool)[\s>]/,
  },
  {
    name: "markdown_injection",
    pattern: /!\[.*?\]\(https?:\/\//,
  },
  {
    name: "unicode_escape",
    pattern: /\\u[0-9a-fA-F]{4}/,
  },
  {
    name: "repetition_attack",
    pattern: /(.{5,})\1{4,}/,
  },
  {
    name: "data_exfil_url",
    pattern: /(?:fetch|curl|wget|http\.get)\s*\(?['"]?https?:\/\//i,
  },
];

// ============================================================================
// Input Sanitizer Class
// ============================================================================

export interface SanitizeResult {
  sanitized: string;
  violations: string[];
}

export class InputSanitizer {
  private readonly patterns: InjectionPattern[];

  /**
   * Create a new InputSanitizer.
   *
   * @param extraPatterns - Additional patterns to check beyond the default 12
   */
  constructor(extraPatterns?: InjectionPattern[]) {
    this.patterns = [...INJECTION_PATTERNS];
    if (extraPatterns) {
      this.patterns.push(...extraPatterns);
    }
  }

  /**
   * Check text against all injection patterns.
   *
   * @param text - Input text to check
   * @returns List of pattern names that matched
   */
  checkViolations(text: string): string[] {
    const violations: string[] = [];

    for (const { name, pattern } of this.patterns) {
      if (pattern.test(text)) {
        violations.push(name);
      }
    }

    return violations;
  }

  /**
   * Sanitize external input by wrapping it in a safe container.
   *
   * The text is always wrapped regardless of violations, as defense-in-depth.
   * Violations are returned for audit trail.
   *
   * @param text - Raw external input (OTT channel, webhook, etc.)
   * @param channel - Source channel identifier (default: "ott")
   * @returns Object with sanitized text and list of violations
   */
  sanitizeExternalInput(text: string, channel = "ott"): SanitizeResult {
    const violations = this.checkViolations(text);

    // Wrap in safe container (defense-in-depth)
    const sanitized = `[EXTERNAL_INPUT channel=${channel}]\n${text}\n[/EXTERNAL_INPUT]`;

    return { sanitized, violations };
  }

  /**
   * Check if input contains any violations.
   *
   * @param text - Input text to check
   * @returns true if any violation pattern matches
   */
  hasViolations(text: string): boolean {
    return this.patterns.some(({ pattern }) => pattern.test(text));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalSanitizer: InputSanitizer | undefined;

export function getInputSanitizer(): InputSanitizer {
  if (!globalSanitizer) {
    globalSanitizer = new InputSanitizer();
  }
  return globalSanitizer;
}

/**
 * Convenience function for quick sanitization.
 *
 * @param text - Raw external input
 * @param channel - Source channel identifier
 * @returns Object with sanitized text and violations
 */
export function sanitize(text: string, channel = "ott"): SanitizeResult {
  return getInputSanitizer().sanitizeExternalInput(text, channel);
}
