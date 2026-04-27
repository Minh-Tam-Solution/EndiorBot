# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x-beta | Yes |
| < 0.1.0 | No |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **dttai@mtsolution.com.vn**

Include:
- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

## Response Timeline

| Action | Timeline |
|--------|----------|
| Acknowledge receipt | 48 hours |
| Initial assessment | 5 business days |
| Critical fix | 7-14 days |
| Non-critical fix | Next release cycle |

## Security Measures

EndiorBot implements the following security controls:

- **Input Sanitization** — All gateway ingress paths sanitized (Sprint 116)
- **Command Injection Prevention** — All template-interpolated `execSync` calls converted to `execFileSync` with argument arrays (Sprint 116/118). Remaining safe hardcoded calls documented in [EXEC_ALLOWLIST.md](docs/08-collaborate/EXEC_ALLOWLIST.md)
- **Security Headers** — CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy on all HTTP responses (Sprint 117)
- **Rate Limiting** — 100 req/min per IP on non-health endpoints (Sprint 117)
- **CORS** — Configurable origins, no wildcard (Sprint 116)
- **Output Scrubbing** — Sensitive data redacted from responses

## Third-party “Claude Code” research trees (local workspace)

Some developers keep **unofficial** clones (e.g. source-map recoveries, community ports) for study. Those trees **must not** be linked from production code, published packages, or public repos without separate legal review. Governance: [ADR-039](docs/02-design/01-ADRs/ADR-039-Claude-Code-Research-Artifacts-Governance.md).

## Scope

This policy applies to the EndiorBot npm package (`endiorbot`) and its official Docker image.

Third-party integrations and plugins are not covered by this policy.

## 2026-04-19 incident — historical credential exposure

During Sprint 138 P3-01, a git-history credential leak was identified. Pre-Sprint-41 commits contained real API key values (Anthropic, Google, OpenAI, GitHub PAT, multiple Telegram bot tokens) in files that were **deleted from HEAD** by commit `92cd19a` (2026-04-04, "redact NQH private content") but **not removed from history** — the values remained reachable via `git log -p` on any clone. See ADR-049 for full analysis.

**Remediation (completed 2026-04-19):**

- **Option B (key rotation, immediate):** CEO rotated every affected key at each vendor console. Dead keys = zero cryptographic surface regardless of history state. Checklist: [`docs/08-collaborate/secrets-rotation-checklist.md`](docs/08-collaborate/secrets-rotation-checklist.md).
- **Option A (history rewrite, follow-up):** Repository flipped private; `git filter-repo` rewrote all 175 commits, stripping credential-bearing files (`SPRINT-38-*.md`, archived guides, binaries) and applying regex redaction over blobs + commit messages for: `sk-ant-*`, `AIzaSy*`, `sk-proj-*`, legacy `sk-*`, `ghp_*`, `github_pat_*`, Telegram `\d{9,10}:[A-Za-z0-9_-]{35}`, internal infra hostnames.
- **Tag purge:** `pre-sprint-129-push`, `v1.0-pre-search`, `v1.0.0`, `v2.0.0` pointed at pre-rewrite commits and exposed the same keys via tag targets; deleted from origin. Release markers can be re-tagged on rewritten SHAs if needed.
- **Force push:** `main` advanced from `4284f56` (pre-rewrite) to `2fa7e2f` (rewritten). **All existing clones are stale** — re-clone rather than pull.

**Residual risk (accepted):**

- Pre-rewrite SHAs may survive briefly in GitHub's internal GC cycle (hours to days). Keys are rotated-dead, so this is forensic exposure only.
- A local bundle mirror of the pre-rewrite repository exists on one maintainer machine for rollback safety; not shared, scheduled for deletion after the 7-day window.

**Pre-publish key rotation (2026-04-27, Sprint 145):**

All API keys rotated immediately before repository goes public:
- OpenAI, Google/Gemini, GitHub PAT, Telegram bot token, Zalo bot tokens, Ollama remote, MCP Gateway, Gateway token
- Old keys confirmed dead; new keys verified working via `endiorbot serve` + Telegram test message
- This rotation is independent of the 2026-04-19 incident; it is a belt-and-suspenders measure before public visibility.

**Preventive controls (Sprint 138 follow-up):**

- `gitleaks` pre-commit hook prevents new real-key commits.
- `.gitleaksignore` allowlists the known-synthetic test fixtures (Telegram `isValidBotToken` contract tests, scrubber invariant tests) that carry format-valid test vectors by design.
- ADR-049 records the incident for future reference.
