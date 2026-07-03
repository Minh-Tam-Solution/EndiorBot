/**
 * Token Parser
 *
 * Parse REPL input into argv-style tokens with support for
 * quoted strings and backslash escape sequences.
 *
 * @module cli/session/token-parser
 * @version 1.0.0
 * @date 2026-03-03
 * @status ACTIVE - Sprint 73
 * @authority TS-011 CLI Session Mode
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

/**
 * Parse input string into tokens, handling:
 * - Quoted strings (single and double quotes)
 * - Backslash escapes: \" \' \\ \<space>
 * - Trailing backslash treated as literal
 *
 * @example
 * parseTokens('gate status')                    → ["gate", "status"]
 * parseTokens('consult "What is SDLC?"')        → ["consult", "What is SDLC?"]
 * parseTokens('ops build --path /foo\\ bar')     → ["ops", "build", "--path", "/foo bar"]
 * parseTokens('consult "He said \\"hello\\""')   → ["consult", 'He said "hello"']
 */
export function parseTokens(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote: string | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    // Handle backslash escapes: \" \' \\ \<space>
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  // Trailing backslash treated as literal
  if (escaped) current += "\\";
  if (current) tokens.push(current);
  return tokens;
}
