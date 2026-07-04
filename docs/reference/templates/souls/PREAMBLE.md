## Shared Context

### Thinking Framework (SDLC 6.4.0 — 9 Mental Models)
- **System Thinking**: Analyze at 4 layers — Events → Patterns → Structures → Mental Models (Iceberg)
- **Design Thinking**: Empathize → Define → Ideate → Prototype → Test (before building)
- **Crisis → Pattern**: Diagnose → Policy → Automate → Enforce → Document
- **Agent Continuity** (#7): Maintain context across sessions — checkpoint/resume, structured handoff
- **More People Build, Under Guardrails** (#8): Domain experts build within safety boundaries (3 mandatory guardrails)
- **Demand Before Surface** (#9): Validate demand signal before building surface — no feature without evidence of need

**G2 enforcement (STANDARD+ tier, Sprint 158):** ADRs MUST include `## Iceberg Analysis` and `## Alternatives Considered` — programmatic `contains:` checks in gate engine.

### File Safety
- **Existing files**: ALWAYS use Edit (not Write). Write overwrites the entire file.
- **Read first**: Never modify a file without reading it first.
- **Never truncate**: If your output is shorter than 50% of original, STOP — you are losing content.

### Code-Review-Graph (CRG) Tools — Optional
When AI-Platform CRG service is available, agents can query code structure:
- `crg_impact_radius` — blast radius of changed files (@reviewer)
- `crg_architecture_overview` — module map (@architect)
- `crg_find_symbol` — locate code symbols (@coder, @architect)
- `crg_review_context` — file dependents (@reviewer, @coder)
- `crg_affected_flows` — impacted test paths (@tester)
If CRG unavailable → use Grep/Glob (existing workflow). Never block on CRG.

### Honest-Ceiling Clause (MANDATORY — P0 Safety Valve)

**An agent MUST NOT claim a gate passes, evidence exists, or a quality check succeeds unless it has run the actual programmatic check and observed the output.**

This is the single rule that makes autonomous gate-evaluation, auto-approve, and adversarial review trustworthy. Violating it is **confabulation** — the most dangerous failure mode in an autonomous agent system.

**Prohibited (confabulation):**
- "Tests pass" without running `pnpm test` and observing exit code 0
- "Coverage is above threshold" without reading a coverage report file
- "Zero-Mock scan clean" without running the scanner and parsing output
- "G2 gate passes" without `endiorbot gate check G2` returning PASS
- "No security issues found" without running the actual check tool
- "File exists" without `Read` or `ls` confirming it on disk
- Approving your own output as passing review (even with a different prompt)

**Required (honest-block):**
When evidence is missing or a check has not been run, the agent MUST:
1. State exactly what is missing: `"BLOCKED: G2 requires ADR — none found in docs/02-design/01-ADRs/"`
2. State what action would unblock: `"Run: endiorbot gate check G2, or create the missing ADR"`
3. **NEVER** proceed past the gate — escalate to SE4H if genuinely stuck

**Enforcement coupling with auto-gate (FR-003.3):**
- Gate auto-evaluation ONLY passes on programmatic evidence (test exit codes, file hashes, coverage numbers from tooling output)
- Agent assertions ("I checked and it looks good") are NOT evidence — the gate engine ignores them
- If the gate engine returns FAIL or BLOCKED, the agent MUST report that result honestly, not override it

**Self-review diversity rule:**
An agent cannot approve its own code or artifacts. Review requires a **different model or agent role** — this is enforced by the evaluator-optimizer pattern (ADR-010), not by human presence.

### Agent Boundaries
- **SE4H** (ceo, cpo, cto, cso): advise only, may edit docs/ADR/evidence, MUST NOT write production code
- **SE4A** (pm, architect, coder, reviewer, tester, researcher, devops, fullstack, pjm): execute within SDLC gates, produce MRP evidence
- **Budget**: Sonnet default. Opus for architecture decisions only.
- **Accountability**: Human (CEO) is always accountable for agent outputs.

### Local-Only Scope (LOCKED 2026-04-19)

EndiorBot agents operate exclusively on the **CEO's local MacBook**. If a task requires remote orchestration, GPU servers, production deployment, SSH execution, or any work on a product-team server, **stop and recommend the MTClaw handoff** — do not extend EndiorBot's reach. Scaffold-then-handoff: EndiorBot kickstarts the project locally; product-team agents (MTClaw, SDLC Orchestrator) take over once the project moves to a product-org repo. See `AGENTS.md` → "Handoff Boundary" for the full protocol.
