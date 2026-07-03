/**
 * Config Migration Tests
 *
 * Unit tests for config migration from tinysdlc and SDLC Orchestrator.
 *
 * @module tests/sdlc/scaffold/config-migrator
 * @version 1.0.0
 * @date 2026-03-01
 * @status ACTIVE - Sprint 61
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  migrateConfig,
  writeMigratedConfig,
} from "../../../src/sdlc/scaffold/config-migrator.js";
import type {
  DetectionResult,
  TinysdlcConfig,
  SdlcOrchestratorConfig,
} from "../../../src/sdlc/scaffold/types.js";

// ============================================================================
// Test Setup
// ============================================================================

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "endiorbot-migration-test-"));
});

afterEach(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function createTinysdlcConfig(overrides: Partial<TinysdlcConfig> = {}): TinysdlcConfig {
  return {
    version: "1.0.0",
    project: {
      id: "test-project",
      name: "Test Project",
      description: "A test project",
    },
    sdlc: {
      frameworkVersion: "5.0.0",
      tier: "STANDARD",
    },
    ...overrides,
  };
}

function createSdlcOrchestratorConfig(
  overrides: Partial<SdlcOrchestratorConfig> = {}
): SdlcOrchestratorConfig {
  return {
    generator: "sdlc-orchestrator",
    version: "2.0.0",
    project: {
      id: "orchestrator-project",
      name: "Orchestrator Project",
      description: "An orchestrator project",
    },
    tier: "PROFESSIONAL",
    ...overrides,
  };
}

function createDetection(
  state: "TINYSDLC" | "SDLC_ORCHESTRATOR",
  config: TinysdlcConfig | SdlcOrchestratorConfig,
  configPath: string
): DetectionResult {
  return {
    state,
    configPath,
    rawConfig: config,
    existingFiles: [configPath],
    missingFiles: [],
    generator: state === "TINYSDLC" ? "tinysdlc" : "sdlc-orchestrator",
    generatorVersion: "1.0.0",
  };
}

// ============================================================================
// migrateConfig Tests - tinysdlc
// ============================================================================

describe("migrateConfig - tinysdlc", () => {
  it("should migrate tinysdlc config successfully", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.config).toBeDefined();
    expect(result.config?.generator).toBe("endiorbot");
    expect(result.config?.migrated_from).toBe("tinysdlc");
    expect(result.source).toBe("tinysdlc");
  });

  it("should extract project info from tinysdlc config", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig({
      project: {
        id: "my-app",
        name: "My App",
        description: "My application",
      },
    });
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?.project.id).toBe("my-app");
    expect(result.config?.project.name).toBe("My App");
    expect(result.config?.project.description).toBe("My application");
  });

  it("should extract tier from tinysdlc config", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig({
      sdlc: { tier: "PROFESSIONAL" },
    });
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?.tier).toBe("PROFESSIONAL");
  });

  it("should use override tier when specified", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig({
      sdlc: { tier: "LITE" },
    });
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, {
      tier: "ENTERPRISE",
      dryRun: true,
    });

    expect(result.config?.tier).toBe("ENTERPRISE");
  });

  it("should create backup when createBackup is true", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, {
      createBackup: true,
      dryRun: false,
    });

    expect(result.success).toBe(true);
    expect(result.backupPath).toBeDefined();
    expect(fs.existsSync(result.backupPath!)).toBe(true);
  });

  it("should not create backup when dryRun is true", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, {
      createBackup: true,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.backupPath).toBeUndefined();
  });

  it("should preserve original config in _original field", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?._original).toBeDefined();
    expect(result.config?._original).toEqual(config);
  });
});

// ============================================================================
// migrateConfig Tests - SDLC Orchestrator
// ============================================================================

describe("migrateConfig - SDLC Orchestrator", () => {
  it("should migrate SDLC Orchestrator config successfully", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createSdlcOrchestratorConfig();
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("SDLC_ORCHESTRATOR", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.config).toBeDefined();
    expect(result.config?.generator).toBe("endiorbot");
    expect(result.config?.migrated_from).toBe("sdlc-orchestrator");
  });

  it("should extract project info from SDLC Orchestrator config", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createSdlcOrchestratorConfig({
      project: {
        id: "orch-app",
        name: "Orchestrator App",
        description: "An orchestrator app",
      },
    });
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("SDLC_ORCHESTRATOR", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?.project.id).toBe("orch-app");
    expect(result.config?.project.name).toBe("Orchestrator App");
    expect(result.config?.project.description).toBe("An orchestrator app");
  });

  it("should extract tier from SDLC Orchestrator config", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createSdlcOrchestratorConfig({
      tier: "ENTERPRISE",
    });
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("SDLC_ORCHESTRATOR", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?.tier).toBe("ENTERPRISE");
  });
});

// ============================================================================
// migrateConfig Tests - Error Cases
// ============================================================================

describe("migrateConfig - Error Cases", () => {
  it("should fail for non-migratable states", async () => {
    const detection: DetectionResult = {
      state: "ENDIORBOT",
      configPath: "/some/path",
      rawConfig: {},
      existingFiles: [],
      missingFiles: [],
    };

    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot migrate from state");
  });

  it("should fail when no config path", async () => {
    const detection: DetectionResult = {
      state: "TINYSDLC",
      rawConfig: createTinysdlcConfig(),
      existingFiles: [],
      missingFiles: [],
    };

    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("No config file found");
  });

  it("should fail when no raw config", async () => {
    const detection: DetectionResult = {
      state: "TINYSDLC",
      configPath: "/some/path",
      existingFiles: [],
      missingFiles: [],
    };

    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("No config file found");
  });

  it("should default to STANDARD tier when not specified", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config: TinysdlcConfig = {
      project: { name: "No Tier Project" },
      // No tier specified
    };
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.config?.tier).toBe("STANDARD");
  });

  it("should generate project ID from name when not specified", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config: TinysdlcConfig = {
      project: { name: "My Project Name" },
    };
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.config?.project.id).toBe("my-project-name");
  });
});

// ============================================================================
// writeMigratedConfig Tests
// ============================================================================

describe("writeMigratedConfig", () => {
  it("should write config to file", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const originalConfig = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(originalConfig));

    const detection = createDetection("TINYSDLC", originalConfig, configPath);
    const migrationResult = await migrateConfig(detection, { dryRun: true });

    expect(migrationResult.config).toBeDefined();

    await writeMigratedConfig(configPath, migrationResult.config!);

    const written = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(written.generator).toBe("endiorbot");
    expect(written.migrated_from).toBe("tinysdlc");
  });

  it("should not write when dryRun is true", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const originalConfig = createTinysdlcConfig();
    const originalContent = JSON.stringify(originalConfig);
    fs.writeFileSync(configPath, originalContent);

    const detection = createDetection("TINYSDLC", originalConfig, configPath);
    const migrationResult = await migrateConfig(detection, { dryRun: true });

    await writeMigratedConfig(configPath, migrationResult.config!, true);

    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toBe(originalContent);
  });

  it("should pretty-print JSON output", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const originalConfig = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(originalConfig));

    const detection = createDetection("TINYSDLC", originalConfig, configPath);
    const migrationResult = await migrateConfig(detection, { dryRun: true });

    await writeMigratedConfig(configPath, migrationResult.config!);

    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toContain("\n");
    expect(content).toContain("  "); // Indentation
  });
});

// ============================================================================
// Migration Config Structure Tests
// ============================================================================

describe("Migration Config Structure", () => {
  it("should include migrated_at timestamp", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?.migrated_at).toBeDefined();
    expect(new Date(result.config!.migrated_at!).getTime()).toBeGreaterThan(0);
  });

  it("should include generated_at timestamp", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?.generated_at).toBeDefined();
  });

  it("should include schema_version", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?.schema_version).toBe("1.0.0");
  });

  it("should include framework_version", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?.framework_version).toBe("6.4.0");
  });

  it("should generate stage paths for tier", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig({ sdlc: { tier: "LITE" } });
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?.stages).toBeDefined();
    expect(result.config?.stages?.["00-foundation"]).toBe("docs/00-foundation");
  });

  it("should initialize gates to G0.1", async () => {
    const configPath = path.join(tempDir, ".sdlc-config.json");
    const config = createTinysdlcConfig();
    fs.writeFileSync(configPath, JSON.stringify(config));

    const detection = createDetection("TINYSDLC", config, configPath);
    const result = await migrateConfig(detection, { dryRun: true });

    expect(result.config?.gates?.current).toBe("G0.1");
    expect(result.config?.gates?.passed).toEqual([]);
  });
});
