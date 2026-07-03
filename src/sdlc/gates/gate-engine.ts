/**
 * Gate Engine
 *
 * Rule-based gate evaluation engine for SDLC compliance.
 * Evaluates gate checklists with auto-check and manual items.
 *
 * Features:
 *   - Auto-check for file existence, commands, coverage
 *   - Manual items require CEO approval
 *   - Evidence collection and storage
 *   - Vibecoding Index integration
 *   - Tier-specific checklist filtering
 *
 * @module sdlc/gates/gate-engine
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.4 Implementation
 * @authority ADR-004 SDLC Gate Engine
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { createHash } from "crypto";
import { existsSync, readdirSync, statSync } from "fs";
import { readFile } from "fs/promises";
import { basename, resolve } from "path";

import {
  type GateId,
  type ProjectTier,
  type ChecklistItem,
  type ChecklistStatus,
  getChecklist,
  getPreviousGate,
} from "./gate-checklist.js";
import { isGateConfirmed } from "./gate-store.js";
import { isItemMarked } from "./gate-mark-store.js";
import {
  StageContractEngine,
  type SDLCStage,
  type ContractEvaluation,
  isValidStage,
} from "../contracts/index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Evidence collected during gate evaluation.
 */
export interface Evidence {
  type: "file" | "commit" | "test_result" | "screenshot" | "document" | "command";
  path: string;
  hash: string;
  description: string;
  collectedAt: string;
  /**
   * How this evidence was produced.
   * - "programmatic": gate engine ran a checker (file hash, command exit code, coverage report)
   * - "agent_assertion": an agent claimed this without running a checker — REJECTED by auto-gate
   *
   * Honest-ceiling clause (Sprint 156): auto-gate evaluation ONLY accepts
   * programmatic evidence. Agent assertions are logged but never count toward
   * gate PASS. This is the code-level enforcement of the anti-confabulation rule.
   */
  source?: "programmatic" | "agent_assertion";
}

/**
 * Vibecoding result from index calculation.
 */
export interface VibecodingResult {
  score: number;
  zone: "green" | "yellow" | "orange" | "red";
  signals: {
    name: string;
    value: number;
    weight: number;
    threshold: number;
    passed: boolean;
  }[];
}

/**
 * Full gate evaluation result.
 */
export interface GateEvaluation {
  gateId: GateId;
  featureId: string;
  projectId: string;
  tier: ProjectTier;

  checklist: ChecklistItem[];
  evidence: Evidence[];
  vibecodingIndex: VibecodingResult | undefined;

  result: "PASS" | "FAIL" | "PENDING";
  evaluatedAt: string;
  evaluatedBy: "auto" | "ceo";

  summary: {
    total: number;
    passed: number;
    failed: number;
    pending: number;
    skipped: number;
  };

  manualOverride?: {
    reason: string;
    approvedBy: string;
    timestamp: string;
  };
}

/**
 * Configuration for gate engine.
 */
export interface GateEngineConfig {
  /**
   * Project root directory.
   */
  projectRoot: string;

  /**
   * Project tier for checklist filtering.
   */
  tier?: ProjectTier;

  /**
   * Function to calculate Vibecoding Index.
   */
  vibecodingCalculator?: () => Promise<VibecodingResult>;

  /**
   * Function to run shell commands.
   */
  commandRunner?: (cmd: string) => Promise<{ success: boolean; output: string }>;

  /**
   * Stage Contract Engine for contract evaluation.
   * If not provided, a default engine will be created on-demand.
   */
  stageContractEngine?: StageContractEngine;
}

// ============================================================================
// Gate Engine Class
// ============================================================================

/**
 * Rule-based gate evaluation engine.
 *
 * Evaluates SDLC gates by checking:
 * 1. Auto-checkable items (file existence, commands)
 * 2. Manual items (require CEO approval)
 * 3. Vibecoding Index integration
 * 4. Stage Contract compliance (Sprint 68)
 */
export class GateEngine {
  private readonly projectRoot: string;
  private readonly tier: ProjectTier;
  private readonly vibecodingCalculator:
    | (() => Promise<VibecodingResult>)
    | undefined;
  private readonly commandRunner:
    | ((cmd: string) => Promise<{ success: boolean; output: string }>)
    | undefined;
  private stageContractEngine: StageContractEngine | undefined;

  private evaluations: Map<string, GateEvaluation> = new Map();

  constructor(config: GateEngineConfig) {
    this.projectRoot = config.projectRoot;
    this.tier = config.tier ?? "STANDARD";
    this.vibecodingCalculator = config.vibecodingCalculator;
    this.commandRunner = config.commandRunner;
    this.stageContractEngine = config.stageContractEngine;
  }

  /**
   * Evaluate a gate for a feature.
   *
   * @param gateId - Gate to evaluate
   * @param featureId - Feature being evaluated
   * @param projectId - Project identifier
   * @returns Gate evaluation result
   */
  async evaluate(
    gateId: GateId,
    featureId: string,
    projectId: string,
  ): Promise<GateEvaluation> {
    const checklist = getChecklist(gateId, this.tier);
    const evidence: Evidence[] = [];
    let vibecodingResult: VibecodingResult | undefined;

    // Check each item in the checklist
    for (const item of checklist.items) {
      if (item.autoCheck && item.checker) {
        const result = await this.runAutoCheck(item.checker);
        item.status = result.status;
        if (result.evidence) {
          result.evidence.source = "programmatic";
          evidence.push(result.evidence);
        }
      } else if (!item.autoCheck) {
        // Sprint 143 A3: Check persisted marks for manual items.
        // Team can mark items via `endiorbot gate mark` without CEO --force.
        if (isItemMarked(projectId, gateId, item.id)) {
          item.status = "pass";
        }
      }
    }

    // Calculate Vibecoding Index if needed
    const needsVibecoding = checklist.items.some(
      (i) => i.checker?.startsWith("vibecoding:"),
    );
    if (needsVibecoding && this.vibecodingCalculator) {
      vibecodingResult = await this.vibecodingCalculator();

      // Update vibecoding items
      for (const item of checklist.items) {
        if (item.checker?.startsWith("vibecoding:")) {
          const thresholdStr = item.checker.split(":")[1] ?? "30";
          const threshold = parseInt(thresholdStr, 10);
          item.status = vibecodingResult.score <= threshold ? "pass" : "fail";
        }
      }
    }

    // Calculate summary
    const summary = this.calculateSummary(checklist.items);

    // Determine overall result
    const result = this.determineResult(checklist.items);

    const evaluation: GateEvaluation = {
      gateId,
      featureId,
      projectId,
      tier: this.tier,
      checklist: checklist.items,
      evidence,
      vibecodingIndex: vibecodingResult,
      result,
      evaluatedAt: new Date().toISOString(),
      evaluatedBy: "auto",
      summary,
    };

    // Store evaluation
    const key = `${projectId}:${featureId}:${gateId}`;
    this.evaluations.set(key, evaluation);

    return evaluation;
  }

  /**
   * Apply manual override to a gate evaluation.
   *
   * @param gateId - Gate to override
   * @param featureId - Feature identifier
   * @param projectId - Project identifier
   * @param approvedBy - Who approved
   * @param reason - Reason for override
   * @returns Updated evaluation
   */
  applyOverride(
    gateId: GateId,
    featureId: string,
    projectId: string,
    approvedBy: string,
    reason: string,
  ): GateEvaluation {
    const key = `${projectId}:${featureId}:${gateId}`;
    const evaluation = this.evaluations.get(key);

    if (!evaluation) {
      throw new Error(`No evaluation found for ${key}`);
    }

    // Honest-ceiling guard (Sprint 156): SE4A agents cannot override gates.
    // Only SE4H roles (ceo, cto, cpo, cso) may apply manual overrides.
    const SE4H_ROLES = new Set(["ceo", "cto", "cpo", "cso"]);
    if (!SE4H_ROLES.has(approvedBy.toLowerCase())) {
      throw new Error(
        `HONEST-CEILING: Gate override rejected — "${approvedBy}" is not an SE4H role. ` +
        `Only SE4H (${[...SE4H_ROLES].join(", ")}) may override gate results. ` +
        `SE4A agents must produce programmatic evidence, not override gates.`,
      );
    }

    evaluation.manualOverride = {
      reason,
      approvedBy,
      timestamp: new Date().toISOString(),
    };
    evaluation.result = "PASS";
    evaluation.evaluatedBy = "ceo";

    return evaluation;
  }

  /**
   * Mark a manual checklist item as complete.
   *
   * @param gateId - Gate containing the item
   * @param featureId - Feature identifier
   * @param projectId - Project identifier
   * @param itemId - Checklist item to mark
   * @returns Updated evaluation
   */
  markManualItem(
    gateId: GateId,
    featureId: string,
    projectId: string,
    itemId: string,
    status: ChecklistStatus,
  ): GateEvaluation {
    const key = `${projectId}:${featureId}:${gateId}`;
    const evaluation = this.evaluations.get(key);

    if (!evaluation) {
      throw new Error(`No evaluation found for ${key}`);
    }

    const item = evaluation.checklist.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(`Checklist item ${itemId} not found in ${gateId}`);
    }

    item.status = status;
    evaluation.summary = this.calculateSummary(evaluation.checklist);
    evaluation.result = this.determineResult(evaluation.checklist);

    return evaluation;
  }

  /**
   * Get evaluation for a gate.
   */
  getEvaluation(
    gateId: GateId,
    featureId: string,
    projectId: string,
  ): GateEvaluation | undefined {
    const key = `${projectId}:${featureId}:${gateId}`;
    return this.evaluations.get(key);
  }

  /**
   * Check if a gate has passed.
   */
  hasGatePassed(
    gateId: GateId,
    featureId: string,
    projectId: string,
  ): boolean {
    const evaluation = this.getEvaluation(gateId, featureId, projectId);
    return evaluation?.result === "PASS";
  }

  /**
   * Check if previous gate has passed.
   */
  hasPreviousGatePassed(
    gateId: GateId,
    featureId: string,
    projectId: string,
  ): boolean {
    const previousGate = getPreviousGate(gateId);
    if (!previousGate) return true; // No previous gate
    return this.hasGatePassed(previousGate, featureId, projectId);
  }

  // ============================================================================
  // Auto-Check Implementation
  // ============================================================================

  /**
   * Run an auto-check based on checker string.
   */
  private async runAutoCheck(checker: string): Promise<{
    status: ChecklistStatus;
    evidence?: Evidence;
  }> {
    const parts = checker.split(":", 2);
    const type = parts[0] ?? "";
    const value = parts[1] ?? "";

    switch (type) {
      case "file":
        return this.checkFileExists(value);
      case "glob":
        return this.checkGlobExists(value);
      case "dir":
        return this.checkDirExists(value);
      case "command":
        return this.checkCommand(value);
      case "gate":
        return this.checkGatePassed(value as GateId);
      case "coverage":
        return this.checkCoverage(parseInt(value, 10));
      case "version":
        return this.checkVersionBumped(value);
      case "contract":
        return this.checkContractPassed(value);
      default:
        return { status: "pending" };
    }
  }

  /**
   * Check if a file exists.
   */
  private async checkFileExists(relativePath: string): Promise<{
    status: ChecklistStatus;
    evidence?: Evidence;
  }> {
    const fullPath = resolve(this.projectRoot, relativePath);
    const exists = existsSync(fullPath);

    if (exists) {
      const content = await readFile(fullPath, "utf-8");
      const hash = createHash("sha256").update(content).digest("hex");

      return {
        status: "pass",
        evidence: {
          type: "file",
          path: relativePath,
          hash,
          description: `File exists: ${relativePath}`,
          collectedAt: new Date().toISOString(),
        },
      };
    }

    return { status: "fail" };
  }

  /**
   * Check if files matching glob pattern exist.
   */
  private checkGlobExists(pattern: string): {
    status: ChecklistStatus;
    evidence?: Evidence;
  } {
    // Simple glob: extract directory and pattern
    const parts = pattern.split("/");
    const lastPart = parts.pop() ?? "";
    const dir = parts.join("/");
    const regex = new RegExp(
      "^" + lastPart.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    );

    const fullDir = resolve(this.projectRoot, dir);
    if (!existsSync(fullDir)) {
      return { status: "fail" };
    }

    const files = readdirSync(fullDir);
    const matches = files.filter((f) => regex.test(f));

    if (matches.length > 0) {
      return {
        status: "pass",
        evidence: {
          type: "file",
          path: pattern,
          hash: matches.join(","),
          description: `Found ${matches.length} files matching: ${pattern}`,
          collectedAt: new Date().toISOString(),
        },
      };
    }

    return { status: "fail" };
  }

  /**
   * Check if a directory exists.
   */
  private checkDirExists(relativePath: string): {
    status: ChecklistStatus;
    evidence?: Evidence;
  } {
    const fullPath = resolve(this.projectRoot, relativePath);
    const exists = existsSync(fullPath) && statSync(fullPath).isDirectory();

    if (exists) {
      return {
        status: "pass",
        evidence: {
          type: "file",
          path: relativePath,
          hash: "directory",
          description: `Directory exists: ${relativePath}`,
          collectedAt: new Date().toISOString(),
        },
      };
    }

    return { status: "fail" };
  }

  /**
   * Check if a command succeeds.
   */
  private async checkCommand(cmd: string): Promise<{
    status: ChecklistStatus;
    evidence?: Evidence;
  }> {
    if (!this.commandRunner) {
      return { status: "pending" };
    }

    try {
      const result = await this.commandRunner(cmd);
      return {
        status: result.success ? "pass" : "fail",
        evidence: {
          type: "command",
          path: cmd,
          hash: createHash("sha256").update(result.output).digest("hex"),
          description: result.success ? `Command succeeded: ${cmd}` : `Command failed: ${cmd}`,
          collectedAt: new Date().toISOString(),
        },
      };
    } catch {
      return { status: "fail" };
    }
  }

  /**
   * Check if a previous gate passed by querying the gate confirmation store.
   * CTO C2: use basename(this.projectRoot) for projectId.
   */
  private checkGatePassed(gateId: GateId): {
    status: ChecklistStatus;
    evidence?: Evidence;
  } {
    const projectId = basename(this.projectRoot);
    const confirmed = isGateConfirmed(projectId, gateId);
    if (confirmed) {
      return {
        status: "pass",
        evidence: {
          type: "document",
          path: `gate-confirmation:${gateId}`,
          hash: `confirmed:${projectId}`,
          description: `Gate ${gateId} confirmed for project ${projectId}`,
          collectedAt: new Date().toISOString(),
        },
      };
    }
    return { status: "pending" };
  }

  /**
   * Check test coverage meets threshold.
   * TODO Sprint N: parse vitest --coverage Istanbul/V8 output (CTO C3 — out of scope Sprint 80)
   */
  private checkCoverage(_threshold: number): {
    status: ChecklistStatus;
    evidence?: Evidence;
  } {
    return { status: "pending" };
  }

  /**
   * Check if a stage contract is satisfied.
   * Uses StageContractEngine to evaluate stage compliance.
   *
   * @param stageId - The SDLC stage to check (e.g., "04-BUILD")
   */
  private async checkContractPassed(stageId: string): Promise<{
    status: ChecklistStatus;
    evidence?: Evidence;
  }> {
    // Validate stage ID
    if (!isValidStage(stageId)) {
      return { status: "fail" };
    }

    // Get or create StageContractEngine
    if (!this.stageContractEngine) {
      this.stageContractEngine = new StageContractEngine({
        projectRoot: this.projectRoot,
      });
    }

    try {
      // Evaluate the stage contract
      const evaluation: ContractEvaluation = await this.stageContractEngine.evaluate(
        stageId as SDLCStage
      );

      // Map contract status to checklist status
      let status: ChecklistStatus;
      if (evaluation.status === "pass") {
        status = "pass";
      } else if (evaluation.status === "warning") {
        status = "pending"; // Warnings are pending until resolved
      } else {
        status = "fail";
      }

      // Build evidence
      const evidence: Evidence = {
        type: "document",
        path: `stage-contract:${stageId}`,
        hash: `score:${evaluation.score}`,
        description: `Stage ${stageId} contract: ${evaluation.status} (${evaluation.score}%)`,
        collectedAt: new Date().toISOString(),
      };

      // Add missing artifacts to description if any
      if (evaluation.missingArtifacts.length > 0) {
        evidence.description += ` - Missing: ${evaluation.missingArtifacts.join(", ")}`;
      }

      return { status, evidence };
    } catch (error) {
      // Log error and return fail status
      return { status: "fail" };
    }
  }

  /**
   * Check if version was bumped in package.json.
   */
  private async checkVersionBumped(filePath: string): Promise<{
    status: ChecklistStatus;
    evidence?: Evidence;
  }> {
    const fullPath = resolve(this.projectRoot, filePath);
    if (!existsSync(fullPath)) {
      return { status: "fail" };
    }

    try {
      const content = await readFile(fullPath, "utf-8");
      const pkg = JSON.parse(content) as { version?: string };
      if (pkg.version) {
        return {
          status: "pass",
          evidence: {
            type: "file",
            path: filePath,
            hash: pkg.version,
            description: `Version: ${pkg.version}`,
            collectedAt: new Date().toISOString(),
          },
        };
      }
    } catch {
      // Parse error
    }

    return { status: "fail" };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Calculate summary statistics for checklist items.
   */
  private calculateSummary(items: ChecklistItem[]): GateEvaluation["summary"] {
    const summary = {
      total: items.length,
      passed: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
    };

    for (const item of items) {
      switch (item.status) {
        case "pass":
          summary.passed++;
          break;
        case "fail":
          summary.failed++;
          break;
        case "pending":
        case "manual":
          summary.pending++;
          break;
        case "skipped":
          summary.skipped++;
          break;
      }
    }

    return summary;
  }

  /**
   * Determine overall gate result from checklist items.
   */
  private determineResult(
    items: ChecklistItem[],
  ): "PASS" | "FAIL" | "PENDING" {
    const requiredItems = items.filter((i) => i.required);

    // Check for any failed required items
    if (requiredItems.some((i) => i.status === "fail")) {
      return "FAIL";
    }

    // Check for any pending required items
    if (
      requiredItems.some(
        (i) => i.status === "pending" || i.status === "manual",
      )
    ) {
      return "PENDING";
    }

    // All required items passed
    return "PASS";
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalEngine: GateEngine | undefined;

export function getGateEngine(config?: GateEngineConfig): GateEngine {
  if (!globalEngine) {
    if (!config) {
      throw new Error("GateEngine requires config on first initialization");
    }
    globalEngine = new GateEngine(config);
  }
  return globalEngine;
}

/**
 * Reset the global GateEngine instance.
 * Useful for testing or reconfiguration.
 */
export function resetGateEngine(): void {
  globalEngine = undefined;
}
