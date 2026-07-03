/**
 * Plan Handler — "Idea → Structured Plan" (ADR-038 Phase 1)
 *
 * Display-only in Sprint 124a. No execution until 124b.
 * Uses OpenAI consult for task decomposition + GoalDecomposer for ordering.
 *
 * @module commands/handlers/plan-handler
 * @version 1.0.0
 * @date 2026-03-31
 * @status ACTIVE — Sprint 124a
 * @authority ADR-038 Autonomous Workflow Integration
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoalDecomposer } from "../../autonomy/goal-decomposer.js";
import type { GoalDecomposition } from "../../autonomy/types.js";

// ============================================================================
// Types
// ============================================================================

export interface PlanTask {
  index: number;
  agent: string;
  description: string;
  dependsOn: number[];
}

export interface PlanResult {
  success: boolean;
  goal: string;
  tasks: PlanTask[];
  decomposition: GoalDecomposition;
  savedPath?: string;
  error?: string;
}

export interface PlanOptions {
  goal: string;
  projectPath?: string;
  tier?: string;
  savePath?: string;
}

// ============================================================================
// Plan Handler (CTO C4: display-only, no execution)
// ============================================================================

/**
 * Generate a structured development plan from a goal description.
 * Returns structured result — caller handles display + save.
 */
export function generatePlan(opts: PlanOptions): PlanResult {
  const { goal } = opts;

  if (!goal || goal.trim().length === 0) {
    return {
      success: false,
      goal: "",
      tasks: [],
      decomposition: emptyDecomposition(""),
      error: "Goal description is required.",
    };
  }

  // Use GoalDecomposer for task decomposition + dependency ordering
  const decomposer = new GoalDecomposer();
  const decomposition = decomposer.decompose(goal);

  // If decomposer returns single @assistant task, use default development pipeline
  // (plan command always implies multi-agent work: design → code → test → review)
  let tasks: PlanTask[];
  if (decomposition.subtasks.length <= 1 && decomposition.subtasks[0]?.agent === "assistant") {
    tasks = buildDefaultPipeline(goal);
    decomposition.strategy = "sequential";
    const ts = Date.now();
    decomposition.subtasks = tasks.map((t, i) => ({
      id: `plan-${ts}-${i + 1}`,
      agent: t.agent,
      description: t.description,
      dependencies: t.dependsOn.map(d => `plan-${ts}-${d}`),
      priority: i,
      estimatedDurationMs: 15000,
      status: "pending" as const,
    }));
  } else {
    tasks = decomposition.subtasks.map((st, i) => ({
      index: i + 1,
      agent: st.agent,
      description: st.description,
      dependsOn: st.dependencies
        .map(depId => decomposition.subtasks.findIndex(s => s.id === depId) + 1)
        .filter(idx => idx > 0),
    }));
  }

  // Save to drafts if path provided
  const result: PlanResult = {
    success: true,
    goal,
    tasks,
    decomposition,
  };
  if (opts.savePath) {
    result.savedPath = savePlanToDrafts(opts.savePath, goal, tasks, decomposition);
  }

  return result;
}

// ============================================================================
// OTT Handler (Conversation-First)
// ============================================================================

export interface CommandResult {
  success: boolean;
  response: string;
}

/**
 * Handle /plan command from OTT channels.
 */
export function handlePlanCommand(args: string[], workspacePath?: string): CommandResult {
  const goal = args.join(" ").trim();

  if (!goal) {
    return {
      success: false,
      response: "Usage: /plan <description>\nExample: /plan add payment gateway with Stripe",
    };
  }

  const planOpts: PlanOptions = { goal };
  if (workspacePath) planOpts.projectPath = workspacePath;
  const result = generatePlan(planOpts);

  if (!result.success) {
    return { success: false, response: `❌ ${result.error}` };
  }

  const taskLines = result.tasks.map(t =>
    `${t.index}. [@${t.agent}] ${t.description}`
  ).join("\n");

  return {
    success: true,
    response: `📋 *Plan: ${goal}*\n\n${taskLines}\n\nTasks: ${result.tasks.length} | Strategy: ${result.decomposition.strategy}`,
  };
}

// ============================================================================
// Private Helpers
// ============================================================================

function savePlanToDrafts(
  projectPath: string,
  goal: string,
  tasks: PlanTask[],
  decomposition: GoalDecomposition,
): string {
  const draftsDir = join(projectPath, "docs", "04-build", "sprints", "drafts");
  if (!existsSync(draftsDir)) {
    mkdirSync(draftsDir, { recursive: true });
  }

  const date = new Date().toISOString().split("T")[0];
  const slug = goal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  const filename = `plan-${date}-${slug}.md`;
  const filePath = join(draftsDir, filename);

  const taskTable = tasks.map(t => {
    const deps = t.dependsOn.length > 0 ? `after task ${t.dependsOn.join(", ")}` : "—";
    return `| ${t.index} | @${t.agent} | ${t.description} | ${deps} |`;
  }).join("\n");

  const content = `# Plan: ${goal}

**Generated:** ${new Date().toISOString()}
**Strategy:** ${decomposition.strategy}
**Tasks:** ${tasks.length}
**Status:** DRAFT — execute via: endiorbot agent @<agent> --patch "<task>"

---

## Tasks

| # | Agent | Description | Dependencies |
|---|-------|-------------|--------------|
${taskTable}

---

*Generated by EndiorBot plan command (ADR-038)*
`;

  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

/**
 * Build a default 4-agent development pipeline when GoalDecomposer
 * can't decompose (e.g., non-English goals, generic descriptions).
 * Covers the standard SDLC workflow: design → implement → test → review.
 */
function buildDefaultPipeline(goal: string): PlanTask[] {
  return [
    { index: 1, agent: "architect", description: `Design approach and write ADR for: ${goal}`, dependsOn: [] },
    { index: 2, agent: "coder", description: `Implement: ${goal}`, dependsOn: [1] },
    { index: 3, agent: "tester", description: `Write tests for: ${goal}`, dependsOn: [2] },
    { index: 4, agent: "reviewer", description: `Code review and quality check: ${goal}`, dependsOn: [2, 3] },
  ];
}

function emptyDecomposition(goal: string): GoalDecomposition {
  return {
    goalId: `goal-${Date.now()}`,
    originalGoal: goal,
    subtasks: [],
    strategy: "sequential",
    estimatedDurationMs: 0,
    estimatedCostUsd: 0,
  };
}
