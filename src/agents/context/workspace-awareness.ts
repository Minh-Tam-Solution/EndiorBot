/**
 * Workspace Awareness - Static Module Constant
 *
 * Implements SDLC 6.4.0 "Agent Continuity Runtime Guidance" (SASE Artifact).
 * Injected at Layer 1.25 of the context-injector pipeline (between SOUL and
 * Brain L4) to guarantee agents discover project workspace context before
 * asking the user for information already present in the workspace.
 *
 * Threat model:
 *   This constant is a `as const`, module-level, frozen string literal — no
 *   template interpolation, no config-driven composition, no caller-supplied
 *   text. This prevents prompt-building code paths from concatenating
 *   attacker-controlled input (env vars, config files, user messages) into
 *   the workspace-discovery directive. Does NOT protect against filesystem-
 *   level SOUL file mutation — that is a separate trust boundary governed by
 *   filesystem ACLs and exec-policy audit logs (Sprint 132).
 *
 * Property tested (see tests/agents/context/workspace-awareness.test.ts):
 *   - Module-level static constant (Object.isFrozen === true)
 *   - Exact header text match (no runtime drift)
 *   - Injection ordering: SOUL → workspace-awareness → Brain L4
 *
 * References:
 *   - SDLC Framework 6.4.0 addendum: .sdlc-framework/05-Templates-Tools/04-SASE-Artifacts/Agent-Continuity-Runtime-Guidance.md
 *   - Upstream pattern (Go): MTClaw commit 5b1463e, buildWorkspaceAwarenessSection()
 *   - Upstream pattern (Python): SDLC Orchestrator Sprint 59, prompt_builder.py Layer 1.25
 *
 * @module agents/context/workspace-awareness
 * @sdlc_framework 6.4.0
 * @pattern "Pattern A — System Prompt Injection"
 */

/**
 * Workspace Awareness section — verbatim mirror of MTClaw upstream pattern.
 *
 * Injected into system prompt for every agent that has filesystem-access tools.
 * Agents MUST run discovery reads before answering project-state questions.
 */
export const WORKSPACE_AWARENESS_SECTION = `## Workspace Awareness (MANDATORY)

Before answering ANY question about the project, planning, status, or next steps,
you MUST first read the project context using your tools.

Discovery protocol — run these reads BEFORE responding:
1. Read CLAUDE.md (root) — project overview, constraints, identity lock
2. Read AGENTS.md (root) — agent guidelines, SDLC conventions
3. List docs/04-build/sprints/ — find latest sprint plan
4. Read most recent SPRINT-*.md — current scope, task status, gate state
5. Read .sdlc-config.json — tier, stage, framework version

Never ask the user:
- "What sprint is this?" → read sprint docs
- "What's the backlog?" → read sprint plans + git log
- "What's the tech stack?" → read CLAUDE.md
- "What files are in the project?" → use list_files / Glob
- "What's the current gate?" → read .sdlc-config.json
- "What agents are configured?" → read AGENTS.md

This directive exists to honor Mental Model #7 (Agent Continuity): each new
AI session inherits enough context to continue work without re-briefing the
human. For EndiorBot specifically, this backs the solo developer power tool guarantee
that commands return answers in <30 seconds without clarifying questions about
state already visible in the workspace.` as const;

/**
 * Freeze the module-level export to block runtime mutation at the constant site.
 * The `as const` assertion enforces compile-time immutability of the literal type;
 * `Object.freeze` adds runtime immutability to the exported binding's container.
 *
 * Note: because this is a primitive string, the freeze is defensive rather than
 * strictly necessary for the value itself — the test suite verifies the binding
 * continues to resolve to the exact string.
 */
Object.freeze({ WORKSPACE_AWARENESS_SECTION });

/**
 * Stable identifier for the workspace-awareness context item.
 * Used by context-manifest and tests to assert injection ordering.
 */
export const WORKSPACE_AWARENESS_SOURCE_ID = "workspace_awareness" as const;
