/**
 * Plan Command — "Idea → Structured Plan" (ADR-038)
 *
 * Display-only in Sprint 124a. Saves to drafts/, no execution.
 *
 * @module cli/commands/plan
 * @version 1.0.0
 * @date 2026-03-31
 * @status ACTIVE — Sprint 124a
 * @authority ADR-038 Autonomous Workflow Integration
 * @sdlc SDLC Framework 6.4.0
 */

import type { Command } from "commander";
import { generatePlan, type PlanResult } from "../../commands/handlers/plan-handler.js";
import { resolveActiveProjectDir } from "../../config/paths.js";

// ============================================================================
// CLI Action
// ============================================================================

async function planAction(
  goal: string,
  options: { saveOnly?: boolean; json?: boolean; tier?: string },
): Promise<void> {
  const projectPath = resolveActiveProjectDir();

  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│  📋 EndiorBot Plan                                          │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");

  const result = generatePlan({
    goal,
    projectPath,
    savePath: projectPath,
  });

  if (!result.success) {
    console.error(`❌ ${result.error}`);
    process.exit(1);
  }

  // JSON output
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Display plan
  displayPlan(result);

  // Save confirmation
  if (result.savedPath) {
    console.log(`💾 Saved to: ${result.savedPath}`);
  }
  console.log("");
  console.log("💡 To execute tasks: endiorbot agent @<agent> --patch \"<task description>\"");
  console.log("");
}

function displayPlan(result: PlanResult): void {
  console.log(`Goal: ${result.goal}`);
  console.log(`Strategy: ${result.decomposition.strategy}`);
  console.log(`Tasks: ${result.tasks.length}`);
  console.log("");
  console.log("─".repeat(60));

  for (const task of result.tasks) {
    const deps = task.dependsOn.length > 0 ? ` (after ${task.dependsOn.join(", ")})` : "";
    console.log(`  ${task.index}. [@${task.agent}] ${task.description}${deps}`);
  }

  console.log("─".repeat(60));
  console.log("");
}

// ============================================================================
// Command Registration
// ============================================================================

export function registerPlanCommand(program: Command): void {
  program
    .command("plan")
    .description("Generate a structured development plan from a goal (display-only)")
    .argument("<goal>", "Goal description (e.g., 'add payment gateway with Stripe')")
    .option("--save-only", "Save plan without interactive prompt (default)")
    .option("--json", "Output as JSON")
    .option("--tier <tier>", "Project tier for effort estimation")
    .action(planAction);
}
