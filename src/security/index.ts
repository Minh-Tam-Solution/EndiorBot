/**
 * Security Module
 *
 * Provides input sanitization, output scrubbing, and shell command guarding.
 * Ported from SDLC-Orchestrator Python implementations.
 *
 * @module security
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.1 Implementation
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// Input Sanitizer
export {
  InputSanitizer,
  getInputSanitizer,
  sanitize,
  INJECTION_PATTERNS,
  type InjectionPattern,
  type SanitizeResult,
} from "./input-sanitizer.js";

// Output Scrubber
export {
  OutputScrubber,
  getOutputScrubber,
  scrub,
  CREDENTIAL_PATTERNS,
  PEM_PATTERN,
  REDACTED_SUFFIX,
  PEM_REDACTED,
  type CredentialPattern,
  type ScrubResult,
} from "./output-scrubber.js";

// Shell Guard
export {
  ShellGuard,
  getShellGuard,
  checkCommand,
  DENY_PATTERNS,
  SAFE_ENV_VARS,
  MAX_OUTPUT_SIZE,
  type DenyPattern,
  type CommandCheckResult,
  type ShellGuardConfig,
} from "./shell-guard.js";

// Exec-Approvals cluster (Sprint 132 M1: exec-policy command allowlist)
export * as execApprovals from "./exec-approvals/index.js";

// HTTP Validator (SSRF defense — Sprint 133 S2)
export {
  SSRFBlockedError,
  validateFetchUrl,
  validateRedirectTarget,
  scrubUrl,
} from "./http-validator.js";

// Safe Fetch (SSRF-protected fetch wrapper — Sprint 133 S2)
export {
  safeFetch,
  writeSSRFAuditRecord,
  getSSRFAuditLogPath,
  type SSRFAuditRecord,
  type SafeFetchContext,
} from "./safe-fetch.js";

// OTT Audit Logger
export {
  OTTAuditLogger,
  createOTTAuditLogger,
  getOTTAuditLogger,
  resetOTTAuditLogger,
  auditOTTMessage,
  auditOTTViolation,
  auditOTTRateLimit,
  cleanupOTTAudit,
  DEFAULT_AUDIT_CONFIG,
  type OTTAuditConfig,
  type OTTAuditType,
  type OTTAuditEntry,
  type OTTMessageAudit,
  type OTTViolationAudit,
  type OTTRateLimitAudit,
  type AnyOTTAudit,
} from "./ott-audit.js";
