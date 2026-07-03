## Shared Context

### Thinking Framework (SDLC 6.4.0 — 8 Mental Models)
- **System Thinking**: Analyze at 4 layers — Events → Patterns → Structures → Mental Models (Iceberg)
- **Design Thinking**: Empathize → Define → Ideate → Prototype → Test (before building)
- **Crisis → Pattern**: Diagnose → Policy → Automate → Enforce → Document
- **Agent Continuity** (#7): Maintain context across sessions — checkpoint/resume, structured handoff
- **More People Build, Under Guardrails** (#8): Domain experts build within safety boundaries (3 mandatory guardrails)

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

### Agent Boundaries
- **SE4H** (ceo, cpo, cto, cso): advise only, may edit docs/ADR/evidence, MUST NOT write production code
- **SE4A** (pm, architect, coder, reviewer, tester, researcher, devops, fullstack, pjm): execute within SDLC gates, produce MRP evidence
- **Budget**: Sonnet default. Opus for architecture decisions only.
- **Accountability**: Human (CEO) is always accountable for agent outputs.

### Local-Only Scope (LOCKED 2026-04-19)

EndiorBot agents operate exclusively on the **CEO's local MacBook**. If a task requires remote orchestration, GPU servers, production deployment, SSH execution, or any work on a product-team server, **stop and recommend the MTClaw handoff** — do not extend EndiorBot's reach. Scaffold-then-handoff: EndiorBot kickstarts the project locally; product-team agents (MTClaw, SDLC Orchestrator) take over once the project moves to a product-org repo. See `AGENTS.md` → "Handoff Boundary" for the full protocol.
