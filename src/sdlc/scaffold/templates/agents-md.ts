/**
 * AGENTS.md Generator
 *
 * Generates AGENTS.md content with AI agent roster.
 *
 * @module sdlc/scaffold/templates/agents-md
 * @version 1.0.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 61
 */

import type { ProjectConfig, ProjectTier, AgentDefinition } from "../types.js";
import { TIER_ORDER } from "../types.js";

// ============================================================================
// Agent Definitions
// ============================================================================

const ALL_AGENTS: AgentDefinition[] = [
  {
    id: "assistant",
    name: "Assistant",
    description: "General-purpose AI assistant for quick tasks",
    model: "sonnet",
    minTier: "LITE",
    capabilities: ["General questions", "Quick lookups", "Simple tasks"],
  },
  {
    id: "coder",
    name: "Coder",
    description: "Code generation and implementation",
    model: "sonnet",
    minTier: "LITE",
    capabilities: ["Write code", "Implement features", "Fix bugs", "Refactor"],
  },
  {
    id: "pm",
    name: "Product Manager",
    description: "Requirements gathering and planning",
    model: "sonnet",
    minTier: "STANDARD",
    capabilities: ["Requirements", "User stories", "Prioritization", "Roadmap"],
  },
  {
    id: "pjm",
    name: "Project Manager",
    description: "Sprint planning and tracking",
    model: "haiku",
    minTier: "PROFESSIONAL",
    capabilities: ["Sprint planning", "Task breakdown", "Progress tracking", "Risk management"],
  },
  {
    id: "reviewer",
    name: "Code Reviewer",
    description: "Code review and quality assurance",
    model: "opus",
    minTier: "STANDARD",
    capabilities: ["Code review", "Best practices", "Security review", "Performance review"],
  },
  {
    id: "architect",
    name: "Architect",
    description: "System design and architecture decisions",
    model: "opus",
    minTier: "STANDARD",
    capabilities: ["System design", "ADRs", "Trade-off analysis", "Technology selection"],
  },
  {
    id: "researcher",
    name: "Researcher",
    description: "Technical research and analysis",
    model: "sonnet",
    minTier: "PROFESSIONAL",
    capabilities: ["Research", "Competitive analysis", "Technology evaluation", "Documentation"],
  },
  {
    id: "tester",
    name: "QA Tester",
    description: "Test planning and execution",
    model: "sonnet",
    minTier: "LITE",
    capabilities: ["Test planning", "Test cases", "Bug reports", "Coverage analysis"],
  },
  {
    id: "ceo",
    name: "CEO Advisor",
    description: "Strategic advisory and decision support",
    model: "opus",
    minTier: "ENTERPRISE",
    capabilities: ["Strategy", "Business decisions", "Vision alignment", "Priority calls"],
  },
  {
    id: "cpo",
    name: "CPO Advisor",
    description: "Product strategy and user experience",
    model: "opus",
    minTier: "ENTERPRISE",
    capabilities: ["Product strategy", "UX decisions", "Feature prioritization", "Market fit"],
  },
  {
    id: "cto",
    name: "CTO Advisor",
    description: "Technical strategy and architecture oversight",
    model: "opus",
    minTier: "ENTERPRISE",
    capabilities: ["Technical strategy", "Architecture review", "Tech debt", "Scalability"],
  },
  {
    id: "cso",
    name: "CSO Advisor",
    description: "Security architecture, threat modeling, and compliance oversight",
    model: "opus",
    minTier: "PROFESSIONAL",
    capabilities: ["Threat modeling (STRIDE/PASTA)", "OWASP ASVS L2 compliance", "AGPL containment", "Supply chain security (SBOM)", "Security gate approvals (G2/G3/G4)"],
  },
  {
    id: "fullstack",
    name: "Full-Stack Developer",
    description: "End-to-end feature development",
    model: "sonnet",
    minTier: "PROFESSIONAL",
    capabilities: ["Frontend", "Backend", "Database", "API integration"],
  },
  {
    id: "devops",
    name: "DevOps Engineer",
    description: "Infrastructure and deployment automation",
    model: "haiku",
    minTier: "PROFESSIONAL",
    capabilities: ["CI/CD", "Infrastructure", "Monitoring", "Deployment"],
  },
];

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate AGENTS.md content.
 */
export function generateAgentsMd(project: ProjectConfig): string {
  const agents = getAgentsForTier(project.tier);
  const agentTable = generateAgentTable(agents);
  const agentDetails = generateAgentDetails(agents);
  const thinkingSection = generateThinkingFrameworkSection();
  const usageSection = generateUsageSection();
  const saseSection = generateSaseSection();

  return `# AGENTS.md - AI Agent Roster

## Overview

This document defines the AI agents available for **${project.name}** (${project.tier} tier).

**Total Agents:** ${agents.length}
**Framework:** SDLC ${project.frameworkVersion}

---

## Agent Roster

${agentTable}

---

${agentDetails}

---

${thinkingSection}

---

${usageSection}

---

${saseSection}

---

## Agentic Maturity Level

| Level | Name | Characteristic |
|-------|------|----------------|
| L0 | Tool-Assisted | AI as autocomplete |
| L1 | Agent-Assisted | Structured handoff |
| L2 | Structured Agentic | Full SASE workflow |
| L3 | Lifecycle Agentic | Proactive agents |

**Current Level:** L1 (Agent-Assisted)

---

*Generated by EndiorBot - SDLC Framework v${project.frameworkVersion}*
`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get agents available for tier.
 */
function getAgentsForTier(tier: ProjectTier): AgentDefinition[] {
  const tierLevel = TIER_ORDER[tier];
  return ALL_AGENTS.filter((agent) => TIER_ORDER[agent.minTier] <= tierLevel);
}

/**
 * Generate agent table.
 */
function generateAgentTable(agents: AgentDefinition[]): string {
  const rows = agents.map(
    (agent) =>
      `| @${agent.id} | ${agent.name} | ${agent.model} | ${agent.description} |`
  );

  return `| ID | Name | Model | Description |
|-----|------|-------|-------------|
${rows.join("\n")}`;
}

/**
 * Generate agent details section.
 */
function generateAgentDetails(agents: AgentDefinition[]): string {
  const details = agents.map((agent) => {
    const capabilities = agent.capabilities.map((c) => `- ${c}`).join("\n");

    return `### @${agent.id} - ${agent.name}

**Model:** ${agent.model}
**Min Tier:** ${agent.minTier}

${agent.description}

**Capabilities:**
${capabilities}`;
  });

  return `## Agent Details

${details.join("\n\n---\n\n")}`;
}

/**
 * Generate thinking framework section (SDLC 6.4.0 Pillar 0).
 * Aligns all agents on shared decision-making heuristics.
 */
function generateThinkingFrameworkSection(): string {
  return `## Thinking Framework (SDLC Pillar 0)

### System Thinking — Iceberg Model

Analyze problems at 4 layers, not just the visible event:

| Layer | Question | Intervention |
|-------|----------|-------------|
| **Events** | What happened? | Reactive — fix symptom |
| **Patterns** | What keeps happening? | Adaptive — add monitoring |
| **Structures** | What system causes this? | Creative — redesign |
| **Mental Models** | What beliefs allow this? | Transformative — change culture |

### Design Thinking — 5 Phases

Before building, follow: **Empathize → Define → Ideate → Prototype → Test**

- Problem space (diverge then converge) before solution space
- >70% success → iterate, 30-70% → dig deeper, <30% → pivot

### Crisis-to-Pattern — 5-Step Pipeline

When things break: **Diagnose → Create Policy → Automate → Enforce → Document**

Every crisis becomes a reusable pattern. Use Iceberg Model at step 1.

### Effort Compression (AI-Assisted)

| Task Type | Human | AI+EndiorBot | Compression |
|-----------|-------|-------------|-------------|
| Boilerplate | 2 days | 15 min | 100x |
| Tests | 1 day | 15 min | 50x |
| Feature | 1 week | 30 min | 30x |
| Bug fix | 4 hours | 15 min | 20x |

When completeness costs minutes more than the shortcut — always choose complete.`;
}

/**
 * Generate usage section.
 */
function generateUsageSection(): string {
  return `## Usage

### Invoking Agents

\`\`\`bash
# Via EndiorBot CLI
./endiorbot.mjs @pm "Create user story for login feature"
./endiorbot.mjs @architect "Design payment gateway integration"
./endiorbot.mjs @coder "Implement the login API endpoint"

# Via Claude Code
@pm create user story for login feature
@architect design payment gateway integration
\`\`\`

### Multi-Model Consultation

\`\`\`bash
./endiorbot.mjs consult "Should we use PostgreSQL or MongoDB?"
# Queries multiple models for consensus
\`\`\`

### Agent Handoff

Agents can delegate to other agents:
\`\`\`
@pm → @architect (design needed)
@architect → @coder (implementation)
@coder → @reviewer (review needed)
\`\`\``;
}

/**
 * Generate SASE section.
 */
function generateSaseSection(): string {
  return `## SASE Integration (SE 3.0)

### CRP - Consultation Resolution Process

How AI seeks human approval for decisions:
1. AI proposes action
2. Human reviews (CEO/approver)
3. Human confirms or rejects
4. AI proceeds based on decision

### MRP - Mentorship Resolution Process

How AI learns from feedback:
1. Human provides correction
2. AI acknowledges learning
3. AI applies learning to future tasks
4. Continuous improvement loop

### VCR - Vibecoding Critique Record

Quality control for AI-generated code:
- Track vibecoding index
- Review AI suggestions
- Document quality issues
- Improve prompts based on feedback`;
}

/**
 * Export agent definitions for testing.
 */
export function getAllAgents(): AgentDefinition[] {
  return [...ALL_AGENTS];
}

/**
 * Get agent by ID.
 */
export function getAgentById(id: string): AgentDefinition | undefined {
  return ALL_AGENTS.find((agent) => agent.id === id);
}
