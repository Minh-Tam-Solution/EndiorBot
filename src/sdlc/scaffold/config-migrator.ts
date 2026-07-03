/**
 * Config Migration Module
 *
 * Handles migration from tinysdlc and SDLC Orchestrator configs to EndiorBot.
 *
 * @module sdlc/scaffold/config-migrator
 * @version 1.0.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 61
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  DetectionResult,
  ProjectTier,
  SdlcConfig,
  TinysdlcConfig,
  SdlcOrchestratorConfig,
} from "./types.js";
import { TIER_ORDER, TIER_STAGES } from "./types.js";

// ============================================================================
// Types
// ============================================================================

export interface MigrationResult {
  /** Whether migration was successful */
  success: boolean;
  /** New config generated */
  config?: SdlcConfig;
  /** Path to backup file */
  backupPath?: string;
  /** Error message if failed */
  error?: string;
  /** Source generator */
  source: string;
}

export interface MigrationOptions {
  /** Create backup of original config */
  createBackup?: boolean;
  /** Target tier (overrides detected tier) */
  tier?: ProjectTier;
  /** Dry-run mode */
  dryRun?: boolean;
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Migrate from tinysdlc or SDLC Orchestrator to EndiorBot config.
 */
export async function migrateConfig(
  detection: DetectionResult,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const { createBackup = true, tier: overrideTier, dryRun = false } = options;

  // Validate migration is needed
  if (detection.state !== "TINYSDLC" && detection.state !== "SDLC_ORCHESTRATOR") {
    return {
      success: false,
      error: `Cannot migrate from state: ${detection.state}`,
      source: detection.generator ?? "unknown",
    };
  }

  if (!detection.configPath || !detection.rawConfig) {
    return {
      success: false,
      error: "No config file found to migrate",
      source: detection.generator ?? "unknown",
    };
  }

  const source = detection.generator ?? detection.state.toLowerCase();

  try {
    // Create backup if requested
    let backupPath: string | undefined;
    if (createBackup && !dryRun) {
      backupPath = await createConfigBackup(detection.configPath);
    }

    // Extract project info based on source
    const extractedInfo = detection.state === "TINYSDLC"
      ? extractFromTinysdlc(detection.rawConfig as TinysdlcConfig)
      : extractFromSdlcOrchestrator(detection.rawConfig as SdlcOrchestratorConfig);

    // Determine final tier
    const finalTier = overrideTier ?? extractedInfo.tier ?? "STANDARD";

    // Generate new config
    const config = generateMigratedConfig(
      extractedInfo.project,
      finalTier,
      source,
      detection.rawConfig
    );

    const result: MigrationResult = {
      success: true,
      config,
      source,
    };
    if (backupPath) result.backupPath = backupPath;
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      source,
    };
  }
}

/**
 * Extract project info from tinysdlc config.
 */
function extractFromTinysdlc(config: TinysdlcConfig): {
  project: { id: string; name: string; description?: string };
  tier?: ProjectTier;
} {
  const project: { id: string; name: string; description?: string } = {
    id: config.project?.id ?? slugify(config.project?.name ?? "project"),
    name: config.project?.name ?? "Migrated Project",
  };
  if (config.project?.description) project.description = config.project.description;

  const tierString = config.sdlc?.tier?.toUpperCase();
  const result: { project: typeof project; tier?: ProjectTier } = { project };
  if (isValidTier(tierString)) result.tier = tierString;

  return result;
}

/**
 * Extract project info from SDLC Orchestrator config.
 */
function extractFromSdlcOrchestrator(config: SdlcOrchestratorConfig): {
  project: { id: string; name: string; description?: string };
  tier?: ProjectTier;
} {
  const project: { id: string; name: string; description?: string } = {
    id: config.project?.id ?? slugify(config.project?.name ?? "project"),
    name: config.project?.name ?? "Migrated Project",
  };
  if (config.project?.description) project.description = config.project.description;

  const tierString = config.tier?.toUpperCase();
  const result: { project: typeof project; tier?: ProjectTier } = { project };
  if (isValidTier(tierString)) result.tier = tierString;

  return result;
}

/**
 * Generate migrated EndiorBot config.
 */
function generateMigratedConfig(
  project: { id: string; name: string; description?: string },
  tier: ProjectTier,
  source: string,
  originalConfig: unknown
): SdlcConfig {
  const stages = TIER_STAGES[tier];
  const stagePaths: Record<string, string> = {};

  for (const stage of stages) {
    stagePaths[stage] = `docs/${stage}`;
  }

  const projectInfo: { id: string; name: string; description?: string } = {
    id: project.id,
    name: project.name,
  };
  if (project.description) projectInfo.description = project.description;

  return {
    schema_version: "1.0.0",
    framework_version: "6.4.0",
    generator: "endiorbot",
    generated_at: new Date().toISOString(),
    migrated_from: source,
    migrated_at: new Date().toISOString(),
    project: projectInfo,
    tier,
    stages: stagePaths,
    gates: {
      current: "G0.1",
      passed: [],
    },
    _original: originalConfig,
  };
}

/**
 * Create backup of original config file.
 */
async function createConfigBackup(configPath: string): Promise<string> {
  const dir = path.dirname(configPath);
  const ext = path.extname(configPath);
  const base = path.basename(configPath, ext);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(dir, `${base}.backup-${timestamp}${ext}`);

  const content = fs.readFileSync(configPath, "utf-8");
  fs.writeFileSync(backupPath, content, "utf-8");

  return backupPath;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if string is a valid project tier.
 */
function isValidTier(tier: string | undefined): tier is ProjectTier {
  if (!tier) return false;
  return tier in TIER_ORDER;
}

/**
 * Create URL-safe slug from string.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Write migrated config to file.
 */
export async function writeMigratedConfig(
  configPath: string,
  config: SdlcConfig,
  dryRun = false
): Promise<void> {
  if (dryRun) {
    return;
  }

  const content = JSON.stringify(config, null, 2);
  fs.writeFileSync(configPath, content, "utf-8");
}
