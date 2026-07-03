---
adr: 049
status: "ACCEPTED — @cto countersigned 2026-04-19, full expansion not required"
date: 2026-04-19
title: "Historical credential exposure remediation (Sprint 138 P3-01)"
authority:
  proposer: "@devops"
  countersigners:
    - actor: "@cto"
      date: "2026-04-19"
      reference: "Sprint 138 P3-01 session review — noted safety discipline (private flip first, bare-mirror snapshot, two-pass filter-repo for blobs + messages, test-fixture restore, pre-rewrite tag deletion)"
  trigger: "Sprint 138 P3-01 rotation checklist authoring — `git log -S` on key prefixes returned non-zero matches on pre-Sprint-41 commits. Exposure surface identified before secrets reached wild-abuse state."
  notes: "CTO waived full expansion on countersign: the STUB content (context, decision, execution log with timestamps, consequences, preventive, back-compat, rollback) already meets full-ADR bar."
sdlc_framework: "6.4.0"
supersedes: []
referenced_by: ["Sprint 138 plan", "Sprint 138 P3-01 rotation checklist", "SECURITY.md incident section"]
---

# ADR-049: Historical credential exposure remediation (Sprint 138 P3-01)

**Status:** ACCEPTED — @cto countersigned 2026-04-19. Full expansion waived; the sections below are the authoritative record.

## Context

Sprint 136 session leaked 12 secret values through diagnostic tool outputs (`grep` / `ps -wwE` env dumps) into the session transcript. CTO flagged as HIGH urgency at Sprint 137 partial close (2026-04-19). Sprint 138 P3-01 opened to produce the rotation checklist.

While authoring the checklist, the @devops author ran `git log -S` on known key prefixes to confirm the Sprint 136 leak was **transcript-only** (not committed). The result was unexpected: multiple pre-Sprint-41 commits matched. Commit `92cd19a` (2026-04-04, "security(pre-oss): redact NQH private content, remove exposed credentials") had deleted credential-bearing files from HEAD but left history intact.

**Exposure audience widened** from "people who read one session transcript" to "anyone with clone access to the GitHub repo". At time of discovery, the repo was public (`github.com/Minh-Tam-Solution/EndiorBot`); forks count was 0.

## Key counts discovered in history

| Prefix | Commits matched | Classification |
|--------|-----------------|----------------|
| `sk-ant-` (Anthropic) | 6 | Mix of real keys + doc/test fixtures |
| `AIzaSy` (Google) | 3 | At least one real key value (39-char Google format) |
| `sk-proj-` (OpenAI) | 1 | Real key |
| `ghp_` (GitHub PAT) | 6 | Mix of real + docs |
| Telegram `\d{9,10}:[...]{35}` | 4 real + 2 synthetic test fixtures | Real tokens on multiple bot IDs |

Internal infrastructure hostnames (`example.com`) also present.

## Decision

Execute **remediation in two phases**, in this order:

1. **Option B (immediate) — Rotate all affected keys.** CEO rotates at each vendor console; attack surface becomes zero once the rotated keys die regardless of history state. Authoritative checklist: [`docs/08-collaborate/secrets-rotation-checklist.md`](../../08-collaborate/secrets-rotation-checklist.md).
2. **Option A (follow-up) — Rewrite git history.** Repository flipped private; `git filter-repo` strips credential-bearing paths + redacts remaining regex matches in blobs AND commit messages. Force-push; delete any pre-rewrite tags (they pin the leaked history to the remote via tag targets). Force-push protects new pull/clone operations from ever touching the old SHAs.

Option C (GitHub Support takedown) was considered and rejected — dead keys don't qualify for GitHub security-team intervention.

## Threat model clarification (LOCAL-ONLY constraint)

Per [`AGENTS.md`](../../08-collaborate/01-SDLC-Compliance/AGENTS.md) → "Handoff Boundary", EndiorBot is single-user on the CEO's MacBook. This incident is **exclusively** about GitHub-side credential hygiene. No production runtime, no other user accounts, no shared infrastructure.

## Execution log (2026-04-19)

- `13:37Z` — repo visibility check: `public`, 0 forks.
- `13:50Z` — CEO flipped repo to `private` (defense-in-depth; precedes rotation).
- `13:56Z` — `pre-rewrite-backup-20260419-205627` tag pushed + local bare mirror at `/tmp/endiorbot-pre-rewrite-20260419-205627.mirror` as rollback safety net.
- `14:00Z` — `git filter-repo --paths-from-file ... --invert-paths --replace-text ... --force` pass 1 (blob content + file removal).
- `14:02Z` — Second pass: `git filter-repo --replace-message` for key values in commit messages (one Google key had leaked via commit-message narrative).
- `14:04Z` — Verification: `git log -p` + `git log --format=%s%n%b` grep for high-entropy patterns across all refs → 0 matches.
- `14:07Z` — Test fixture restore: 5 test files had synthetic token strings matching the redaction regex and were restored from the pre-rewrite mirror. 2013/2013 tests pass post-restore.
- `14:14Z` — `git push --force origin main` (`4284f56` → `2fa7e2f`).
- `14:16Z` — Delete `pre-rewrite-backup-20260419-205627`, `pre-sprint-129-push`, `v1.0-pre-search`, `v1.0.0`, `v2.0.0` from origin (all pointed at pre-rewrite commits; their tag targets still exposed the keys).
- `14:17Z` — Final origin state: `main → 2fa7e2f` only, no tags.

## Consequences

**Accepted:**

- All existing clones (including CEO's other machines, if any) become stale. Re-clone required, not pull.
- All doc commit-hash citations (`docs/04-build/sprints/*.md` citing SHA-based commit references) are stale. Fixing the SHA references is a separate manual pass — deferred.
- Release tags `v1.0.0` and `v2.0.0` are deleted. Re-tag on rewritten SHAs if release markers are needed later.
- GitHub-side garbage collection of orphaned pre-rewrite commits takes time (hours to days); during the window, pre-rewrite SHAs may resolve via direct URL. Mitigated by the fact that keys are rotated-dead before the rewrite landed.

**Preventive (Sprint 138 follow-up):**

- Wire `gitleaks` as a pre-commit hook + `.gitleaksignore` allowlisting the known-synthetic test fixtures.
- Add a CI step invoking the same lint on every PR (when PRs come back online post-rewrite).

## Back-compat guarantee

File contents in HEAD are byte-identical to `4284f56` (the pre-rewrite top) **except for the credential-bearing files already deleted there**. Every test file + source file + doc file is equivalent. Only commit SHAs differ. Therefore application behavior is unchanged; only git forensic surface is.

## Rollback plan

If a critical path is missed and force-push turns out to be wrong:

1. Pre-rewrite bare mirror sits at `/tmp/endiorbot-pre-rewrite-20260419-205627.mirror` on the @devops machine until 2026-04-26 (7 days).
2. `git --git-dir=<mirror> push --force origin main` restores the pre-rewrite HEAD to origin.
3. Old tags can be recreated from the mirror.

## Open items for CTO countersign

- Confirm rotation status: is every one of the 12 checklist keys rotated + verified dead at its vendor?
- Approve scheduling of `gitleaks` follow-up as Sprint 138 P0 (ahead of P2 spikes, per CTO's earlier directive).
- Approve ADR-049 countersign block (structured per SOUL-pm Rule 4 schema from Sprint 138 P3-02).

---

*EndiorBot | Solo Developer Power Tool (LOCKED, LOCAL-ONLY) | SDLC 6.4.0 | ADR-049 STUB — drafted 2026-04-19*
