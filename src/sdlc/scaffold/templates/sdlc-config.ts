/**
 * SDLC Config Generator
 *
 * Generates .sdlc-config.json content.
 *
 * @module sdlc/scaffold/templates/sdlc-config
 * @version 1.1.0
 * @date 2026-03-05
 * @status ACTIVE - Sprint 79
 */

import type { ProjectConfig, SdlcConfig, ProjectTier } from "../types.js";
import { TIER_STAGES } from "../types.js";
import type { ProjectSnapshot } from "../../compliance/fix-types.js";

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate .sdlc-config.json content.
 * When snapshot is provided, includes techStack + analyzedAt fields.
 */
export function generateSdlcConfig(project: ProjectConfig, snapshot?: ProjectSnapshot): SdlcConfig {
  const stages = generateStagesPaths(project.tier);

  const config: SdlcConfig = {
    schema_version: "1.0.0",
    framework_version: project.frameworkVersion,
    generator: "endiorbot",
    generated_at: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
    },
    tier: project.tier,
    stages,
    gates: {
      current: "G0.1",
      passed: [],
    },
  };

  if (project.description) config.project.description = project.description;

  if (snapshot) {
    config.techStack = snapshot.techStack;
    config.analyzedAt = new Date().toISOString();
  }

  return config;
}

/**
 * Generate stage paths for tier.
 */
function generateStagesPaths(tier: ProjectTier): Record<string, string> {
  const stages = TIER_STAGES[tier];
  const paths: Record<string, string> = {};

  for (const stage of stages) {
    paths[stage] = `docs/${stage}`;
  }

  return paths;
}

/**
 * Serialize config to JSON string.
 */
export function serializeSdlcConfig(config: SdlcConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Generate minimal config for migration.
 */
export function generateMinimalConfig(
  project: { id: string; name: string },
  tier: ProjectTier,
  migratedFrom: string,
  originalConfig: unknown
): SdlcConfig {
  return {
    schema_version: "1.0.0",
    framework_version: "6.4.0",
    generator: "endiorbot",
    generated_at: new Date().toISOString(),
    migrated_from: migratedFrom,
    migrated_at: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
    },
    tier,
    _original: originalConfig,
  };
}
