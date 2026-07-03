/**
 * Evidence CLI Command
 *
 * Manages evidence for SDLC gates.
 * EXPOSES existing Evidence types from gate-engine.ts (per Sprint 56 plan).
 *
 * @module cli/commands/evidence
 * @version 1.0.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 56 Implementation
 * @authority Master Plan v3.1
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { Command } from "commander";

import { type GateId } from "../../sdlc/gates/gate-checklist.js";
import { resolveStateDir } from "../../config/paths.js";
import { logDebug, logError } from "../logger.js";

// ============================================================================
// Extended Evidence Types for CLI
// ============================================================================

/**
 * Extended evidence types for CLI (superset of gate-engine Evidence types).
 */
export type EvidenceType =
  | "file"
  | "commit"
  | "test_result"
  | "screenshot"
  | "document"
  | "command"
  | "adr"
  | "doc"
  | "pr"
  | "review";

/**
 * Evidence item stored in evidence.json.
 */
export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  uri: string;
  gate: GateId | string;
  stage: string;
  addedAt: string;
  addedBy: "cli" | "agent" | "api";
  verified: boolean;
  verifiedAt?: string;
  sha256?: string;
  description?: string;
}

/**
 * Evidence store format.
 */
export interface EvidenceStore {
  projectId: string;
  evidence: EvidenceItem[];
  lastUpdated: string;
}

// ============================================================================
// Evidence Store Operations
// ============================================================================

/**
 * Get evidence store path for a project.
 */
function getEvidenceStorePath(projectId: string): string {
  const stateDir = resolveStateDir();
  const evidenceDir = resolve(stateDir, "projects", projectId);
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  }
  return resolve(evidenceDir, "evidence.json");
}

/**
 * Load evidence store for a project.
 */
function loadEvidenceStore(projectId: string): EvidenceStore {
  const path = getEvidenceStorePath(projectId);
  if (existsSync(path)) {
    try {
      const content = readFileSync(path, "utf-8");
      return JSON.parse(content) as EvidenceStore;
    } catch {
      logError("Failed to parse evidence store", { path });
    }
  }
  return {
    projectId,
    evidence: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Save evidence store for a project.
 */
function saveEvidenceStore(store: EvidenceStore): void {
  const path = getEvidenceStorePath(store.projectId);
  store.lastUpdated = new Date().toISOString();
  writeFileSync(path, JSON.stringify(store, null, 2), { mode: 0o600 });
  logDebug("Evidence store saved", { path, count: store.evidence.length });
}

/**
 * Generate unique evidence ID.
 */
function generateEvidenceId(): string {
  return `ev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Calculate SHA256 hash of a file.
 */
function hashFile(filePath: string): string | undefined {
  try {
    const content = readFileSync(filePath);
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return undefined;
  }
}

/**
 * Get current project ID from active.json or cwd.
 */
function getCurrentProjectId(): string {
  const stateDir = resolveStateDir();
  const activePath = resolve(stateDir, "active.json");
  if (existsSync(activePath)) {
    try {
      const active = JSON.parse(readFileSync(activePath, "utf-8"));
      if (active.projectId) {
        return active.projectId as string;
      }
    } catch {
      // Fallback to cwd basename
    }
  }
  return basename(process.cwd());
}

// ============================================================================
// Evidence Verification
// ============================================================================

/**
 * Verify a single evidence item.
 */
async function verifyEvidenceItem(item: EvidenceItem): Promise<{ valid: boolean; reason?: string }> {
  const uri = item.uri;

  // File-based evidence
  if (item.type === "file" || item.type === "adr" || item.type === "document") {
    if (!existsSync(uri)) {
      return { valid: false, reason: "File not found" };
    }
    // Check hash if available
    if (item.sha256) {
      const currentHash = hashFile(uri);
      if (currentHash !== item.sha256) {
        return { valid: false, reason: "File content changed (hash mismatch)" };
      }
    }
    return { valid: true };
  }

  // Git commit evidence
  if (item.type === "commit") {
    try {
      execFileSync("git", ["cat-file", "-t", uri], { stdio: "pipe" });
      return { valid: true };
    } catch {
      return { valid: false, reason: "Git commit not found" };
    }
  }

  // URL-based evidence (doc, pr, review)
  if (item.type === "doc" || item.type === "pr" || item.type === "review") {
    // Basic URL validation - actual HTTP check would require async
    if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
      return { valid: false, reason: "Invalid URL format" };
    }
    return { valid: true }; // URL format valid (actual check would need fetch)
  }

  // Test results
  if (item.type === "test_result") {
    if (uri.startsWith("/") || uri.startsWith("./")) {
      if (!existsSync(uri)) {
        return { valid: false, reason: "Test result file not found" };
      }
    }
    return { valid: true };
  }

  // Screenshot
  if (item.type === "screenshot") {
    if (!existsSync(uri)) {
      return { valid: false, reason: "Screenshot file not found" };
    }
    return { valid: true };
  }

  // Command evidence (cannot verify execution)
  if (item.type === "command") {
    return { valid: true }; // Commands are records, not verifiable
  }

  return { valid: true };
}

// ============================================================================
// CLI Actions
// ============================================================================

/**
 * List evidence for current project.
 */
async function evidenceListAction(options: { gate?: string; stage?: string }): Promise<void> {
  const projectId = getCurrentProjectId();
  const store = loadEvidenceStore(projectId);

  let evidence = store.evidence;

  // Filter by gate
  if (options.gate) {
    evidence = evidence.filter((e) => e.gate === options.gate);
  }

  // Filter by stage
  if (options.stage) {
    evidence = evidence.filter((e) => e.stage === options.stage);
  }

  if (evidence.length === 0) {
    console.log(`📋 No evidence found for project: ${projectId}`);
    if (options.gate) console.log(`   Gate filter: ${options.gate}`);
    if (options.stage) console.log(`   Stage filter: ${options.stage}`);
    return;
  }

  console.log(`\n📋 Evidence for project: ${projectId}`);
  console.log(`   Total: ${evidence.length} items\n`);

  // Group by gate
  const byGate = new Map<string, EvidenceItem[]>();
  for (const item of evidence) {
    const key = item.gate || "unassigned";
    if (!byGate.has(key)) {
      byGate.set(key, []);
    }
    byGate.get(key)!.push(item);
  }

  for (const [gate, items] of byGate) {
    console.log(`🚪 Gate ${gate}:`);
    for (const item of items) {
      const status = item.verified ? "✓" : "?";
      const typeIcon = getTypeIcon(item.type);
      console.log(`   ${status} ${typeIcon} [${item.type}] ${item.uri}`);
      if (item.description) {
        console.log(`     └─ ${item.description}`);
      }
    }
    console.log();
  }
}

/**
 * Add evidence to current project.
 */
async function evidenceAddAction(
  uri: string,
  options: { gate: string; type: EvidenceType; stage?: string; description?: string },
): Promise<void> {
  const projectId = getCurrentProjectId();
  const store = loadEvidenceStore(projectId);

  // Determine stage from gate if not provided
  const stage = options.stage || getStageFromGate(options.gate);

  // Calculate hash for files
  let sha256: string | undefined;
  if (["file", "adr", "document", "screenshot", "test_result"].includes(options.type)) {
    const filePath = resolve(process.cwd(), uri);
    if (existsSync(filePath)) {
      sha256 = hashFile(filePath);
    }
  }

  const item: EvidenceItem = {
    id: generateEvidenceId(),
    type: options.type,
    uri,
    gate: options.gate,
    stage,
    addedAt: new Date().toISOString(),
    addedBy: "cli",
    verified: false,
    ...(sha256 && { sha256 }),
    ...(options.description && { description: options.description }),
  };

  // Verify immediately
  const verification = await verifyEvidenceItem(item);
  item.verified = verification.valid;
  if (verification.valid) {
    item.verifiedAt = new Date().toISOString();
  }

  store.evidence.push(item);
  saveEvidenceStore(store);

  const status = item.verified ? "✓" : "✗";
  console.log(`\n${status} Evidence added: ${item.id}`);
  console.log(`  Type: ${item.type}`);
  console.log(`  URI: ${item.uri}`);
  console.log(`  Gate: ${item.gate}`);
  console.log(`  Verified: ${item.verified}`);
  if (!verification.valid && verification.reason) {
    console.log(`  Warning: ${verification.reason}`);
  }
}

/**
 * Verify all evidence for current project.
 */
async function evidenceVerifyAction(options: { gate?: string }): Promise<void> {
  const projectId = getCurrentProjectId();
  const store = loadEvidenceStore(projectId);

  let evidence = store.evidence;
  if (options.gate) {
    evidence = evidence.filter((e) => e.gate === options.gate);
  }

  if (evidence.length === 0) {
    console.log(`📋 No evidence to verify for project: ${projectId}`);
    return;
  }

  console.log(`\n🔍 Verifying ${evidence.length} evidence items...\n`);

  let passed = 0;
  let failed = 0;

  for (const item of evidence) {
    const verification = await verifyEvidenceItem(item);
    item.verified = verification.valid;
    if (verification.valid) {
      item.verifiedAt = new Date().toISOString();
      passed++;
      console.log(`✓ ${item.id}: ${item.uri}`);
    } else {
      failed++;
      console.log(`✗ ${item.id}: ${item.uri}`);
      console.log(`  └─ ${verification.reason}`);
    }
  }

  saveEvidenceStore(store);

  console.log(`\n📊 Verification complete: ${passed} passed, ${failed} failed`);
}

/**
 * Remove evidence by ID.
 */
async function evidenceRemoveAction(evidenceId: string): Promise<void> {
  const projectId = getCurrentProjectId();
  const store = loadEvidenceStore(projectId);

  const index = store.evidence.findIndex((e) => e.id === evidenceId);
  if (index === -1) {
    console.log(`❌ Evidence not found: ${evidenceId}`);
    return;
  }

  const removed = store.evidence.splice(index, 1)[0];
  saveEvidenceStore(store);

  console.log(`\n✓ Evidence removed: ${evidenceId}`);
  console.log(`  Type: ${removed?.type}`);
  console.log(`  URI: ${removed?.uri}`);
}

// ============================================================================
// Helpers
// ============================================================================

function getTypeIcon(type: EvidenceType): string {
  const icons: Record<EvidenceType, string> = {
    file: "📄",
    commit: "📝",
    test_result: "🧪",
    screenshot: "📸",
    document: "📑",
    command: "💻",
    adr: "📐",
    doc: "🔗",
    pr: "🔀",
    review: "👀",
  };
  return icons[type] || "📎";
}

function getStageFromGate(gate: string): string {
  const stageMap: Record<string, string> = {
    G0: "00-FOUNDATION",
    G1: "01-PLANNING",
    G2: "02-DESIGN",
    G3: "03-INTEGRATION",
    G4: "04-BUILD",
    G5: "05-TEST",
    G6: "06-DEPLOY",
    G7: "07-OPERATE",
    G8: "08-COLLABORATE",
  };
  return stageMap[gate.toUpperCase()] || "UNKNOWN";
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register evidence command with CLI program.
 */
export function registerEvidenceCommand(program: Command): void {
  const evidence = program
    .command("evidence")
    .description("Manage SDLC gate evidence");

  evidence
    .command("list")
    .description("List evidence for current project")
    .option("--gate <gateId>", "Filter by gate (e.g., G2)")
    .option("--stage <stage>", "Filter by stage (e.g., 02-DESIGN)")
    .action(evidenceListAction);

  evidence
    .command("add <uri>")
    .description("Add evidence to current project")
    .requiredOption("--gate <gateId>", "Gate to attach evidence to (e.g., G2)")
    .requiredOption("--type <type>", "Evidence type (file, adr, commit, doc, pr, review)")
    .option("--stage <stage>", "SDLC stage (auto-detected from gate)")
    .option("--description <desc>", "Description of evidence")
    .action(evidenceAddAction);

  evidence
    .command("verify")
    .description("Verify all evidence still valid")
    .option("--gate <gateId>", "Only verify evidence for specific gate")
    .action(evidenceVerifyAction);

  evidence
    .command("remove <evidenceId>")
    .description("Remove evidence by ID")
    .action(evidenceRemoveAction);
}
