/**
 * Gate Command
 *
 * SDLC gate operations: status, recommend, confirm.
 * Integrates with the gate engine for evaluation.
 *
 * INVARIANT (Master Plan v3.1):
 *   Agent ≠ Authority: EndiorBot RECOMMENDS, CEO CONFIRMS
 *   Approval = Human Confirm: Explicit --confirm flag required
 *
 * Usage:
 *   endiorbot gate status
 *   endiorbot gate recommend G2 --feature AR-457
 *   endiorbot gate confirm G2 --feature AR-457 --confirm
 *
 * @module cli/commands/gate
 * @version 1.1.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 56 Update
 * @authority ADR-004 SDLC Gate Engine + Master Plan v3.1
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve as resolvePath } from "node:path";
import type { Command } from "commander";
import { loadActiveProject } from "../../config/paths.js";
import {
  GateEngine,
  getGatesInOrder,
  getChecklist,
  isGateConfirmed,
  saveGateConfirmation,
  saveGateItemMark,
  removeGateItemMark,
  type GateId,
  type ProjectTier,
  type ChecklistItem,
  type GateItemMark,
} from "../../sdlc/index.js";

// ============================================================================
// Types
// ============================================================================

interface ProjectContext {
  id: string;
  name: string;
  path: string;
  tier: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Sprint 137 P0-03 (2026-04-19): resolve a project context from a directory by
 * reading `.sdlc-config.json`. Returns undefined if the file is missing or
 * malformed. Used by `--project <path>` flag and cwd auto-detect to avoid the
 * footgun where `endiorbot gate confirm` silently targets the wrong repo (the
 * one stored in `~/.endiorbot/active-project.json`) instead of the cwd CEO is
 * actually working in.
 */
function readProjectFromDir(dir: string): ProjectContext | undefined {
  const configPath = resolvePath(dir, ".sdlc-config.json");
  if (!existsSync(configPath)) return undefined;
  try {
    const raw = readFileSync(configPath, "utf-8");
    const cfg = JSON.parse(raw) as {
      project?: { id?: string; name?: string };
      tier?: string;
    };
    const id = cfg.project?.id;
    const name = cfg.project?.name ?? id;
    if (!id || !name) return undefined;
    return {
      id,
      name,
      path: resolvePath(dir),
      tier: cfg.tier ?? "STANDARD",
    };
  } catch {
    return undefined;
  }
}

/**
 * Get current project for a gate command.
 *
 * Resolution order (Sprint 137 P0-03):
 *   1. `--project <path>` if supplied (explicit override).
 *   2. cwd auto-detect — if the current directory holds a `.sdlc-config.json`,
 *      use it. This is the fix for CEO's "I ran `endiorbot gate confirm` from
 *      BetterBox-TTS but it confirmed the gate against the EndiorBot repo
 *      because that was the active project" footgun.
 *   3. Active project from `~/.endiorbot/active-project.json` (legacy default).
 *
 * When the cwd-detected project differs from the active project, log a one-line
 * notice so CEO can spot accidental cross-repo confirms.
 */
function getCurrentProject(projectFlag?: string): ProjectContext | undefined {
  if (projectFlag) {
    const fromFlag = readProjectFromDir(projectFlag);
    if (fromFlag) return fromFlag;
    console.log(`⚠️  --project ${projectFlag} has no readable .sdlc-config.json`);
    return undefined;
  }

  const fromCwd = readProjectFromDir(process.cwd());
  const active = loadActiveProject();

  if (fromCwd) {
    if (active && active.path !== fromCwd.path) {
      console.log(
        `ℹ️  Using cwd project '${fromCwd.id}' (active project '${active.name}' at ${active.path} ignored — pass --project to override)`,
      );
    }
    return fromCwd;
  }

  if (!active) return undefined;

  return {
    id: active.name,
    name: active.name,
    path: active.path,
    tier: active.tier,
  };
}

/**
 * Format checklist item status.
 */
function formatItemStatus(item: ChecklistItem): string {
  switch (item.status) {
    case "pass":
      return "✅";
    case "fail":
      return "❌";
    case "skipped":
      return "⏭️";
    default:
      return "⬜";
  }
}

/**
 * Format gate ID for display.
 */
function formatGateId(gateId: GateId): string {
  const names: Record<GateId, string> = {
    G0: "G0 - Problem Validation",
    "G0.1": "G0.1 - Opportunity Assessment",
    G1: "G1 - Requirements Lock",
    G2: "G2 - Design Approval",
    G3: "G3 - Build Complete",
    G4: "G4 - Release Ready",
    "G-Sprint": "G-Sprint - Sprint Close",
  };
  return names[gateId] ?? gateId;
}

// ============================================================================
// Command Runner (CTO C1: returns { success: boolean, output: string })
// ============================================================================

/**
 * Create a commandRunner for GateEngine that executes shell commands.
 * Only used when --run-checks flag is passed to avoid slow gate evaluations.
 */
function createCommandRunner(projectPath: string): (cmd: string) => Promise<{ success: boolean; output: string }> {
  return async (cmd: string) => {
    try {
      const output = execSync(cmd, { cwd: projectPath, stdio: "pipe", timeout: 60_000 }).toString("utf-8");
      return { success: true, output };
    } catch (err) {
      const output = err instanceof Error ? err.message : String(err);
      return { success: false, output };
    }
  };
}

// ============================================================================
// Command Actions
// ============================================================================

/**
 * Check if a gate's auto-checkable required items all pass.
 * Manual items (CEO approval) are excluded — those need explicit `gate confirm`.
 */
function isGateAutoReady(checklist: ChecklistItem[]): boolean {
  const autoRequired = checklist.filter((i) => i.required && i.autoCheck);
  if (autoRequired.length === 0) return false;
  return autoRequired.every((i) => i.status === "pass");
}

/**
 * Gate status action - show gates with progress-aware display.
 *
 * Logic:
 *   - Gates with all auto-checks passing → ⏳ AUTO-READY (pending CEO confirm)
 *   - First gate that isn't auto-ready → 🔄 CURRENT (expanded checklist)
 *   - All gates after current → 🔒 LOCKED
 *   - If --gate flag specified → show detailed evaluation for that gate
 */
async function gateStatusAction(options: { gate?: string; runChecks?: boolean; project?: string }): Promise<void> {
  const project = getCurrentProject(options.project);

  if (!project) {
    console.log("⚠️  No active project. Use 'endiorbot start <project>' first.");
    return;
  }

  const tier = (project.tier as ProjectTier) ?? "STANDARD";

  // Create gate engine — inject commandRunner only with --run-checks flag
  const engineConfig: { projectRoot: string; tier: ProjectTier; commandRunner?: (cmd: string) => Promise<{ success: boolean; output: string }> } = {
    projectRoot: project.path,
    tier,
  };
  if (options.runChecks) {
    engineConfig.commandRunner = createCommandRunner(project.path);
  }
  const engine = new GateEngine(engineConfig);

  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│  🚪 SDLC Gates - ${project.name.slice(0, 42).padEnd(42)}│`);
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Tier: ${tier.padEnd(52)}│`);
  console.log("└─────────────────────────────────────────────────────────────┘");
  console.log("");

  // If specific gate requested, show detailed evaluation
  if (options.gate) {
    const gateId = options.gate as GateId;
    const evaluation = await engine.evaluate(gateId, "default", project.id);

    console.log(`📋 ${formatGateId(gateId)}`);
    console.log("─".repeat(60));

    for (const item of evaluation.checklist) {
      const status = formatItemStatus(item);
      const autoTag = item.autoCheck ? " [auto]" : "";
      console.log(`   ${status} ${item.description}${autoTag}`);
    }

    const { passed, total } = evaluation.summary;
    console.log("");
    console.log(`   Progress: ${passed}/${total} checks passed`);
    console.log("");
    return;
  }

  // Evaluate all gates with progress-aware display
  const gates = getGatesInOrder();
  let currentGateFound = false;

  for (const gateId of gates) {
    // Check if this gate was already confirmed (persisted)
    const confirmed = isGateConfirmed(project.id, gateId);

    if (confirmed) {
      const evaluation = await engine.evaluate(gateId, "default", project.id);
      const { passed, total } = evaluation.summary;
      console.log(`  ✅ ${formatGateId(gateId)}  [${passed}/${total} — CONFIRMED]`);
      continue;
    }

    const evaluation = await engine.evaluate(gateId, "default", project.id);
    const { passed, total } = evaluation.summary;

    if (isGateAutoReady(evaluation.checklist)) {
      // Auto-checks pass — awaiting CEO confirmation
      console.log(`  ⏳ ${formatGateId(gateId)}  [${passed}/${total} — pending CEO confirm]`);
    } else if (!currentGateFound) {
      // First non-ready gate = current gate — show expanded checklist
      currentGateFound = true;
      console.log(`  🔄 ${formatGateId(gateId)}  [${passed}/${total}]`);
      console.log("  " + "─".repeat(58));

      for (const item of evaluation.checklist) {
        const status = formatItemStatus(item);
        const autoTag = item.autoCheck ? " [auto]" : "";
        console.log(`     ${status} ${item.description}${autoTag}`);
      }

      console.log("");
    } else {
      // Future gate — locked until current gate is resolved
      console.log(`  🔒 ${formatGateId(gateId)}`);
    }
  }

  console.log("");
  if (!currentGateFound) {
    console.log("  🎉 All gates auto-ready! Use 'endiorbot gate confirm <gateId> --confirm' to approve.");
  } else {
    console.log("  💡 Use 'endiorbot gate recommend <gateId>' for detailed evaluation.");
    console.log("  💡 Use 'endiorbot gate confirm <gateId> --confirm' to approve a gate.");
  }
  console.log("");
}

/**
 * Gate recommend action - evaluate a gate and show recommendation.
 * READ-ONLY: Does not approve, just recommends.
 */
async function gateRecommendAction(
  gateId: string,
  options: { feature?: string; runChecks?: boolean; project?: string },
): Promise<void> {
  const project = getCurrentProject(options.project);

  if (!project) {
    console.log("⚠️  No active project. Use 'endiorbot start <project>' first.");
    return;
  }

  if (!existsSync(project.path)) {
    console.error(`❌ Project path not found: ${project.path}`);
    process.exit(1);
  }

  const featureId = options.feature ?? "default";
  const tier = (project.tier as ProjectTier) ?? "STANDARD";

  console.log("");
  console.log(`🔍 Evaluating ${gateId} for ${featureId}...`);
  console.log("");

  // Create gate engine — inject commandRunner with --run-checks
  const engineConfig: { projectRoot: string; tier: ProjectTier; commandRunner?: (cmd: string) => Promise<{ success: boolean; output: string }> } = {
    projectRoot: project.path,
    tier,
  };
  if (options.runChecks) {
    engineConfig.commandRunner = createCommandRunner(project.path);
  }
  const engine = new GateEngine(engineConfig);

  try {
    const evaluation = await engine.evaluate(
      gateId as GateId,
      featureId,
      project.id,
    );

    // Display results
    console.log("┌─────────────────────────────────────────────────────────────┐");
    console.log(`│  📋 ${formatGateId(gateId as GateId).padEnd(55)}│`);
    console.log("├─────────────────────────────────────────────────────────────┤");

    // Show checklist results
    for (const item of evaluation.checklist) {
      const status = formatItemStatus(item);
      console.log(`│  ${status} ${item.description.slice(0, 55).padEnd(55)}│`);
    }

    console.log("├─────────────────────────────────────────────────────────────┤");

    // Show vibecoding if available
    if (evaluation.vibecodingIndex) {
      const zone = evaluation.vibecodingIndex.zone;
      const zoneEmoji: Record<string, string> = {
        green: "🟢",
        yellow: "🟡",
        orange: "🟠",
        red: "🔴",
      };
      console.log(
        `│  Vibecoding: ${zoneEmoji[zone] ?? "⚪"} ${evaluation.vibecodingIndex.score}/100 (${zone})`.padEnd(62) + "│",
      );
    }

    // Show result
    const resultEmoji = evaluation.result === "PASS" ? "✅" : "❌";
    console.log(`│  Result: ${resultEmoji} ${evaluation.result}`.padEnd(62) + "│");
    console.log("└─────────────────────────────────────────────────────────────┘");
    console.log("");

    if (evaluation.result === "PASS") {
      console.log("🎉 RECOMMENDATION: Gate ready for approval");
      console.log("");
      console.log("   To confirm, run:");
      console.log(`   endiorbot gate confirm ${gateId} --feature ${featureId} --confirm`);
    } else {
      console.log("⚠️  RECOMMENDATION: Gate NOT ready. Address the issues above.");
    }
    console.log("");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Evaluation failed: ${message}`);
    process.exit(1);
  }
}

/**
 * Gate confirm action - confirm a gate (CEO action).
 * REQUIRES --confirm flag to enforce explicit human approval.
 */
async function gateConfirmAction(
  gateId: string,
  options: { feature?: string; force?: boolean; confirm?: boolean; project?: string },
): Promise<void> {
  // INVARIANT: Explicit --confirm flag required
  if (!options.confirm) {
    console.log("");
    console.log("❌ Missing --confirm flag");
    console.log("");
    console.log("   Gate confirmation requires explicit human approval.");
    console.log("   This is an SDLC invariant: Agent ≠ Authority");
    console.log("");
    console.log("   To confirm, run:");
    console.log(`   endiorbot gate confirm ${gateId} --confirm`);
    console.log("");
    process.exit(1);
  }

  const project = getCurrentProject(options.project);

  if (!project) {
    console.log("⚠️  No project resolvable from --project, cwd, or active project.");
    console.log("   Either cd into a project with .sdlc-config.json,");
    console.log("   pass --project <path>, or run 'endiorbot start <name>'.");
    return;
  }

  const featureId = options.feature ?? "default";
  const tier = (project.tier as ProjectTier) ?? "STANDARD";

  console.log("");
  console.log(`🔐 Confirming ${gateId} for ${featureId} in '${project.id}' (${project.path})...`);

  // Create gate engine
  const engine = new GateEngine({ projectRoot: project.path, tier });

  try {
    // First evaluate
    const evaluation = await engine.evaluate(
      gateId as GateId,
      featureId,
      project.id,
    );

    // Sprint 143 A3 follow-up (OGA team feedback): When CEO runs --confirm,
    // manual items (autoCheck: false) should auto-pass. CEO's explicit --confirm
    // IS the approval — they shouldn't need --force for items like "CEO approves"
    // or "stakeholder sign-off" when they are the one confirming.
    if (evaluation.result !== "PASS") {
      const blockingManualItems = evaluation.checklist.filter(
        (i) => i.required && !i.autoCheck && (i.status === "pending" || i.status === "manual"),
      );
      const blockingAutoItems = evaluation.checklist.filter(
        (i) => i.required && i.autoCheck && i.status !== "pass" && i.status !== "skipped",
      );

      if (blockingAutoItems.length === 0 && blockingManualItems.length > 0) {
        // All auto-checks passed; only manual items block. CEO --confirm auto-resolves them.
        for (const item of blockingManualItems) {
          saveGateItemMark(project.id, {
            gateId: gateId as GateId,
            itemId: item.id,
            status: "pass",
            evidence: `Auto-approved by CEO via 'gate confirm ${gateId} --confirm'`,
            markedAt: new Date().toISOString(),
            markedBy: "CEO",
          });
          item.status = "pass";
        }
        // Re-determine result after marking
        evaluation.result = evaluation.checklist.filter((i) => i.required).every(
          (i) => i.status === "pass" || i.status === "skipped",
        ) ? "PASS" : "FAIL";
        if (blockingManualItems.length > 0) {
          console.log(`  ✅ ${blockingManualItems.length} manual item(s) auto-approved by CEO confirm:`);
          for (const item of blockingManualItems) {
            console.log(`     • ${item.id} — ${item.description}`);
          }
        }
      }
    }

    if (evaluation.result !== "PASS" && !options.force) {
      console.log("");
      console.log("❌ Cannot confirm - gate evaluation failed (auto-check items not passing).");
      console.log("   Use --force to override (CEO only).");
      console.log("");
      process.exit(1);
    }

    if (evaluation.result !== "PASS" && options.force) {
      // Apply manual override
      engine.applyOverride(
        gateId as GateId,
        featureId,
        project.id,
        "CEO",
        "Manual override by CEO",
      );
      console.log("⚠️  Override applied by CEO.");
    }

    // Persist confirmation to disk
    const now = new Date().toISOString();
    const confirmation: { gateId: GateId; featureId: string; confirmedAt: string; confirmedBy: string; force: boolean; reason?: string } = {
      gateId: gateId as GateId,
      featureId,
      confirmedAt: now,
      confirmedBy: "CEO",
      force: !!options.force,
    };
    if (options.force) {
      confirmation.reason = "Manual override by CEO";
    }
    saveGateConfirmation(project.id, confirmation);

    console.log("");
    console.log("┌─────────────────────────────────────────────────────────────┐");
    console.log(`│  ✅ ${gateId} CONFIRMED                                      │`);
    console.log("├─────────────────────────────────────────────────────────────┤");
    console.log(`│  Feature: ${featureId.padEnd(49)}│`);
    console.log(`│  Project: ${project.name.slice(0, 49).padEnd(49)}│`);
    console.log(`│  Confirmed: ${now.slice(0, 19).padEnd(47)}│`);
    console.log(`│  By: CEO (explicit --confirm flag)`.padEnd(62) + "│");
    console.log("└─────────────────────────────────────────────────────────────┘");
    console.log("");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Approval failed: ${message}`);
    process.exit(1);
  }
}

// ============================================================================
// Gate Mark Action (Sprint 143 A3)
// ============================================================================

/**
 * Gate mark action — team marks a manual checklist item as complete.
 *
 * CEO bug report: "đã confirm mà phải dùng force luôn luôn là không đúng".
 * This lets teams mark `autoCheck: false` items with evidence so
 * `gate confirm` works without --force for routine gate progression.
 */
async function gateMarkAction(
  gateId: string,
  itemId: string,
  options: { pass?: boolean; reset?: boolean; evidence?: string; project?: string },
): Promise<void> {
  const project = getCurrentProject(options.project);

  if (!project) {
    console.log("⚠️  No project resolvable from --project, cwd, or active project.");
    return;
  }

  const tier = (project.tier as ProjectTier) ?? "STANDARD";

  // Validate gateId
  const validGates = getGatesInOrder();
  if (!validGates.includes(gateId as GateId)) {
    console.log(`❌ Unknown gate: "${gateId}". Valid: ${validGates.join(", ")}`);
    process.exit(1);
  }

  // Validate itemId exists in checklist AND is autoCheck: false
  const checklist = getChecklist(gateId as GateId, tier);
  const item = checklist.items.find((i) => i.id === itemId);

  if (!item) {
    console.log(`❌ Item "${itemId}" not found in ${gateId} checklist.`);
    console.log("");
    console.log("Available items:");
    for (const i of checklist.items) {
      const tag = i.autoCheck ? "[auto]" : "[manual]";
      console.log(`  ${i.id} — ${i.description} ${tag}`);
    }
    process.exit(1);
  }

  if (item.autoCheck) {
    console.log(`❌ Item "${itemId}" is auto-checkable. It passes when the artifact exists — no manual mark needed.`);
    console.log(`   Checker: ${item.checker ?? "none"}`);
    process.exit(1);
  }

  // Handle --reset
  if (options.reset) {
    const removed = removeGateItemMark(project.id, gateId as GateId, itemId);
    if (removed) {
      console.log(`✅ Mark removed: ${gateId} / ${itemId} reset to pending.`);
    } else {
      console.log(`ℹ️  No mark found for ${gateId} / ${itemId} — already pending.`);
    }
    return;
  }

  // Handle --pass (requires --evidence)
  if (!options.pass) {
    console.log(`❌ Specify --pass to mark the item, or --reset to clear it.`);
    console.log(`   Usage: endiorbot gate mark ${gateId} ${itemId} --pass --evidence "..."`);
    process.exit(1);
  }

  if (!options.evidence || options.evidence.trim().length === 0) {
    console.log(`❌ --evidence is required. Provide a reason for the audit trail.`);
    console.log(`   Usage: endiorbot gate mark ${gateId} ${itemId} --pass --evidence "CEO approved via Telegram"`);
    process.exit(1);
  }

  const mark: GateItemMark = {
    gateId: gateId as GateId,
    itemId,
    status: "pass",
    evidence: options.evidence.trim(),
    markedAt: new Date().toISOString(),
    markedBy: "team",
  };

  saveGateItemMark(project.id, mark);

  console.log("");
  console.log(`✅ Marked: ${gateId} / ${itemId}`);
  console.log(`   Item: ${item.description}`);
  console.log(`   Evidence: ${mark.evidence}`);
  console.log(`   Project: ${project.id}`);
  console.log("");
  console.log(`   Next: endiorbot gate confirm ${gateId} --confirm`);
  console.log("");
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register gate command.
 */
export function registerGateCommand(program: Command): void {
  const gate = program
    .command("gate")
    .description("SDLC gate operations");

  gate
    .command("status")
    .description("Show gate checklists")
    .option("-g, --gate <gateId>", "Show specific gate (G0, G1, G2, G3, G4)")
    .option("--run-checks", "Run command checks (build/lint/test) — slower but complete")
    .option("--project <path>", "Override resolved project (defaults to cwd, then active project)")
    .action(gateStatusAction);

  gate
    .command("recommend <gateId>")
    .description("Evaluate a gate and show recommendation (read-only)")
    .option("-f, --feature <featureId>", "Feature ID", "default")
    .option("--run-checks", "Run command checks (build/lint/test) — slower but complete")
    .option("--project <path>", "Override resolved project (defaults to cwd, then active project)")
    .action(gateRecommendAction);

  gate
    .command("mark <gateId> <itemId>")
    .description("Mark a manual checklist item as complete (team action, no CEO --force needed)")
    .option("--pass", "Mark item as passed")
    .option("--reset", "Reset item back to pending")
    .option("--evidence <text>", "Evidence/reason for audit trail (required with --pass)")
    .option("--project <path>", "Override resolved project")
    .action(gateMarkAction);

  gate
    .command("confirm <gateId>")
    .description("Confirm a gate (CEO action, requires --confirm flag)")
    .option("-f, --feature <featureId>", "Feature ID", "default")
    .option("--confirm", "Explicit confirmation (required)")
    .option("--force", "Force confirmation even if checks fail")
    .option("--project <path>", "Override resolved project (defaults to cwd, then active project)")
    .action(gateConfirmAction);

  // Legacy aliases (deprecated, will be removed in v2.0)
  gate
    .command("propose <gateId>")
    .description("[DEPRECATED] Use 'gate recommend' instead")
    .option("-f, --feature <featureId>", "Feature ID", "default")
    .action(async (gateId: string, options: { feature?: string }) => {
      console.log("⚠️  'gate propose' is DEPRECATED. Use 'gate recommend' instead.\n");
      await gateRecommendAction(gateId, options);
    });

  gate
    .command("approve <gateId>")
    .description("[DEPRECATED] Use 'gate confirm --confirm' instead")
    .option("-f, --feature <featureId>", "Feature ID", "default")
    .option("--force", "Force approval even if checks fail")
    .action(async (gateId: string, options: { feature?: string; force?: boolean }) => {
      console.log("⚠️  'gate approve' is DEPRECATED. Use 'gate confirm --confirm' instead.\n");
      await gateConfirmAction(gateId, { ...options, confirm: true });
    });
}
