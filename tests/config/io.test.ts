/**
 * EndiorBot Configuration I/O Tests
 *
 * Unit tests for config file operations.
 *
 * @module tests/config/io
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 3-4
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.1.1
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadConfig,
  writeConfig,
  updateConfig,
  resetConfig,
  getConfig,
  clearConfigCache,
  substituteEnvVars,
  substituteEnvVarsDeep,
} from "../../src/config/io.js";
import { DEFAULT_CONFIG } from "../../src/config/schema.js";
import {
  getEnvironmentDefaults,
  getTierDefaults,
  getDefaultModel,
  DEFAULT_MODELS,
  DEFAULT_TIMEOUTS,
  DEFAULT_PATHS,
  DEFAULT_SECURITY,
} from "../../src/config/defaults.js";
import {
  ENV_VARS,
  getEnvVar,
  getEnvString,
  getEnvNumber,
  getEnvBoolean,
  isNixMode,
  isCIMode,
  isTestMode,
  isDebugMode,
  getLogLevel,
  getGatewayPort,
  getProviderApiKey,
  hasProviderApiKey,
  getAvailableProviders,
  getEnvironmentSummary,
} from "../../src/config/env-vars.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_DIR = path.join(os.tmpdir(), "endiorbot-test-config");
const TEST_CONFIG_PATH = path.join(TEST_DIR, "test-config.json");

beforeEach(() => {
  // Create test directory
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  // Clear cache before each test
  clearConfigCache();
});

afterEach(() => {
  // Clean up test files
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

// ============================================================================
// Environment Variable Substitution Tests
// ============================================================================

describe("substituteEnvVars", () => {
  it("should substitute simple variable", () => {
    const env = { MY_VAR: "hello" };
    expect(substituteEnvVars("${MY_VAR}", env)).toBe("hello");
  });

  it("should substitute multiple variables", () => {
    const env = { A: "foo", B: "bar" };
    expect(substituteEnvVars("${A}-${B}", env)).toBe("foo-bar");
  });

  it("should use default value", () => {
    const env = {};
    expect(substituteEnvVars("${MISSING:-default}", env)).toBe("default");
  });

  it("should return empty for missing variable without default", () => {
    const env = {};
    expect(substituteEnvVars("${MISSING}", env)).toBe("");
  });

  it("should preserve non-variable text", () => {
    const env = { VAR: "value" };
    expect(substituteEnvVars("prefix-${VAR}-suffix", env)).toBe(
      "prefix-value-suffix",
    );
  });
});

describe("substituteEnvVarsDeep", () => {
  it("should substitute in nested objects", () => {
    const env = { PORT: "8080", HOST: "localhost" };
    const input = {
      gateway: {
        port: "${PORT}",
        host: "${HOST}",
      },
    };
    const result = substituteEnvVarsDeep(input, env);
    expect(result).toEqual({
      gateway: {
        port: "8080",
        host: "localhost",
      },
    });
  });

  it("should substitute in arrays", () => {
    const env = { A: "one", B: "two" };
    const input = ["${A}", "${B}", "three"];
    const result = substituteEnvVarsDeep(input, env);
    expect(result).toEqual(["one", "two", "three"]);
  });

  it("should not modify non-string values", () => {
    const env = {};
    const input = { num: 123, bool: true, nil: null };
    const result = substituteEnvVarsDeep(input, env);
    expect(result).toEqual({ num: 123, bool: true, nil: null });
  });
});

// ============================================================================
// Config Load/Write Tests
// ============================================================================

describe("loadConfig", () => {
  it("should return error for missing file", () => {
    const result = loadConfig({
      configPath: path.join(TEST_DIR, "nonexistent.json"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not found");
    }
  });

  it("should create default config if createIfMissing", () => {
    const result = loadConfig({
      configPath: TEST_CONFIG_PATH,
      createIfMissing: true,
    });
    expect(result.ok).toBe(true);
    expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(true);
  });

  it("should load valid config file", () => {
    const testConfig = { gateway: { port: 9000 } };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));

    const result = loadConfig({ configPath: TEST_CONFIG_PATH });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.gateway?.port).toBe(9000);
    }
  });

  it("should apply defaults", () => {
    const testConfig = { gateway: { port: 9000 } };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));

    const result = loadConfig({
      configPath: TEST_CONFIG_PATH,
      applyDefaults: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.gateway?.port).toBe(9000);
      expect(result.config.gateway?.host).toBe("127.0.0.1");
    }
  });

  it("should reject invalid JSON", () => {
    fs.writeFileSync(TEST_CONFIG_PATH, "{ invalid json }");
    const result = loadConfig({ configPath: TEST_CONFIG_PATH });
    expect(result.ok).toBe(false);
  });

  it("should reject invalid config structure", () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ gateway: { port: -1 } }));
    const result = loadConfig({ configPath: TEST_CONFIG_PATH });
    expect(result.ok).toBe(false);
  });
});

describe("writeConfig", () => {
  it("should write config to file", () => {
    const config = { gateway: { port: 8080, host: "0.0.0.0" } };
    const result = writeConfig(config, {
      configPath: TEST_CONFIG_PATH,
      backup: false,
    });
    expect(result.ok).toBe(true);
    expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(true);
  });

  it("should create backup", () => {
    // First write
    writeConfig({ gateway: { port: 8080 } }, {
      configPath: TEST_CONFIG_PATH,
      backup: false,
    });

    // Second write with backup
    const result = writeConfig({ gateway: { port: 9000 } }, {
      configPath: TEST_CONFIG_PATH,
      backup: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup).toBeDefined();
      if (result.backup) {
        expect(fs.existsSync(result.backup)).toBe(true);
      }
    }
  });

  it("should merge with existing config", () => {
    writeConfig({ gateway: { port: 8080 } }, {
      configPath: TEST_CONFIG_PATH,
      backup: false,
    });

    writeConfig({ logging: { level: "debug" } }, {
      configPath: TEST_CONFIG_PATH,
      backup: false,
      merge: true,
    });

    const content = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    const config = JSON.parse(content);
    expect(config.gateway?.port).toBe(8080);
    expect(config.logging?.level).toBe("debug");
  });
});

describe("updateConfig", () => {
  it("should update specific fields", () => {
    writeConfig({ gateway: { port: 8080 } }, {
      configPath: TEST_CONFIG_PATH,
      backup: false,
    });

    updateConfig({ logging: { level: "warn" } }, { configPath: TEST_CONFIG_PATH });

    const result = loadConfig({ configPath: TEST_CONFIG_PATH });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.logging?.level).toBe("warn");
    }
  });
});

describe("resetConfig", () => {
  it("should reset to defaults", () => {
    writeConfig({ gateway: { port: 9999 } }, {
      configPath: TEST_CONFIG_PATH,
      backup: false,
    });

    resetConfig({ configPath: TEST_CONFIG_PATH, backup: false });

    const result = loadConfig({ configPath: TEST_CONFIG_PATH });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.gateway?.port).toBe(DEFAULT_CONFIG.gateway?.port);
    }
  });
});

describe("getConfig (with cache)", () => {
  it("should cache config", () => {
    writeConfig({ gateway: { port: 8080 } }, {
      configPath: TEST_CONFIG_PATH,
      backup: false,
    });

    const result1 = getConfig({ configPath: TEST_CONFIG_PATH });
    const result2 = getConfig({ configPath: TEST_CONFIG_PATH });

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
  });

  it("should force reload", () => {
    writeConfig({ gateway: { port: 8080 } }, {
      configPath: TEST_CONFIG_PATH,
      backup: false,
    });

    getConfig({ configPath: TEST_CONFIG_PATH });

    // Modify file
    writeConfig({ gateway: { port: 9000 } }, {
      configPath: TEST_CONFIG_PATH,
      backup: false,
    });

    const result = getConfig({
      configPath: TEST_CONFIG_PATH,
      forceReload: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.gateway?.port).toBe(9000);
    }
  });
});

// ============================================================================
// Defaults Tests
// ============================================================================

describe("getEnvironmentDefaults", () => {
  it("should override gateway port from env", () => {
    const env = { ENDIORBOT_GATEWAY_PORT: "9999" };
    const defaults = getEnvironmentDefaults(env);
    expect(defaults.gateway?.port).toBe(9999);
  });

  it("should override log level from env", () => {
    const env = { ENDIORBOT_LOG_LEVEL: "debug" };
    const defaults = getEnvironmentDefaults(env);
    expect(defaults.logging?.level).toBe("debug");
  });

  it("should enable debug mode from env", () => {
    const env = { ENDIORBOT_DEBUG: "1" };
    const defaults = getEnvironmentDefaults(env);
    expect(defaults.logging?.level).toBe("debug");
  });

  it("should override tier from env", () => {
    const env = { ENDIORBOT_TIER: "ENTERPRISE" };
    const defaults = getEnvironmentDefaults(env);
    expect(defaults.sdlc?.tier).toBe("ENTERPRISE");
  });
});

describe("getTierDefaults", () => {
  it("should return LITE defaults", () => {
    const defaults = getTierDefaults("LITE");
    expect(defaults.sdlc?.tier).toBe("LITE");
    expect(defaults.sdlc?.strict).toBe(false);
    expect(defaults.orchestrator?.queryMode).toBe("sequential");
  });

  it("should return STANDARD defaults", () => {
    const defaults = getTierDefaults("STANDARD");
    expect(defaults.sdlc?.tier).toBe("STANDARD");
  });

  it("should return PROFESSIONAL defaults", () => {
    const defaults = getTierDefaults("PROFESSIONAL");
    expect(defaults.sdlc?.tier).toBe("PROFESSIONAL");
    expect(defaults.sdlc?.strict).toBe(true);
    expect(defaults.orchestrator?.maxParallelQueries).toBe(5);
  });

  it("should return ENTERPRISE defaults", () => {
    const defaults = getTierDefaults("ENTERPRISE");
    expect(defaults.sdlc?.tier).toBe("ENTERPRISE");
    expect(defaults.orchestrator?.maxParallelQueries).toBe(10);
    expect(defaults.logging?.file?.enabled).toBe(true);
  });
});

describe("getDefaultModel", () => {
  it("should return anthropic primary model", () => {
    expect(getDefaultModel("anthropic", "primary")).toBe("claude-sonnet-5");
  });

  it("should return openai fast model", () => {
    expect(getDefaultModel("openai", "fast")).toBe("gpt-5-mini");
  });
});

describe("DEFAULT constants", () => {
  it("should have valid timeouts", () => {
    expect(DEFAULT_TIMEOUTS.modelQuery).toBeGreaterThan(0);
    expect(DEFAULT_TIMEOUTS.orchestration).toBeGreaterThan(DEFAULT_TIMEOUTS.modelQuery);
  });

  it("should have valid paths", () => {
    expect(DEFAULT_PATHS.stateDir).toBe(".endiorbot");
    expect(DEFAULT_PATHS.configFile).toBe("endiorbot.json");
  });

  it("should have security patterns", () => {
    expect(DEFAULT_SECURITY.inputPatterns.length).toBeGreaterThan(0);
    expect(DEFAULT_SECURITY.outputPatterns.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Environment Variable Tests
// ============================================================================

describe("ENV_VARS", () => {
  it("should have all required variables", () => {
    expect(ENV_VARS.STATE_DIR).toBe("ENDIORBOT_STATE_DIR");
    expect(ENV_VARS.CONFIG_PATH).toBe("ENDIORBOT_CONFIG_PATH");
    expect(ENV_VARS.GATEWAY_PORT).toBe("ENDIORBOT_GATEWAY_PORT");
  });
});

describe("getEnvVar", () => {
  it("should return value", () => {
    const env = { ENDIORBOT_STATE_DIR: "/custom/path" };
    expect(getEnvVar(ENV_VARS.STATE_DIR, env)).toBe("/custom/path");
  });

  it("should trim whitespace", () => {
    const env = { ENDIORBOT_STATE_DIR: "  /path  " };
    expect(getEnvVar(ENV_VARS.STATE_DIR, env)).toBe("/path");
  });

  it("should return undefined for empty", () => {
    const env = { ENDIORBOT_STATE_DIR: "" };
    expect(getEnvVar(ENV_VARS.STATE_DIR, env)).toBeUndefined();
  });
});

describe("getEnvString", () => {
  it("should return value or default", () => {
    expect(getEnvString(ENV_VARS.STATE_DIR, "/default", {})).toBe("/default");
    expect(getEnvString(ENV_VARS.STATE_DIR, "/default", { ENDIORBOT_STATE_DIR: "/custom" })).toBe("/custom");
  });
});

describe("getEnvNumber", () => {
  it("should parse number", () => {
    const env = { ENDIORBOT_GATEWAY_PORT: "9000" };
    expect(getEnvNumber(ENV_VARS.GATEWAY_PORT, 18790, env)).toBe(9000);
  });

  it("should return default for invalid", () => {
    const env = { ENDIORBOT_GATEWAY_PORT: "invalid" };
    expect(getEnvNumber(ENV_VARS.GATEWAY_PORT, 18790, env)).toBe(18790);
  });
});

describe("getEnvBoolean", () => {
  it("should parse true values", () => {
    expect(getEnvBoolean(ENV_VARS.DEBUG, false, { ENDIORBOT_DEBUG: "1" })).toBe(true);
    expect(getEnvBoolean(ENV_VARS.DEBUG, false, { ENDIORBOT_DEBUG: "true" })).toBe(true);
    expect(getEnvBoolean(ENV_VARS.DEBUG, false, { ENDIORBOT_DEBUG: "yes" })).toBe(true);
  });

  it("should parse false values", () => {
    expect(getEnvBoolean(ENV_VARS.DEBUG, true, { ENDIORBOT_DEBUG: "0" })).toBe(false);
    expect(getEnvBoolean(ENV_VARS.DEBUG, true, { ENDIORBOT_DEBUG: "false" })).toBe(false);
  });
});

describe("mode checks", () => {
  it("should detect nix mode", () => {
    expect(isNixMode({ ENDIORBOT_NIX_MODE: "1" })).toBe(true);
    expect(isNixMode({})).toBe(false);
  });

  it("should detect CI mode", () => {
    expect(isCIMode({ CI: "true" })).toBe(true);
    expect(isCIMode({ GITHUB_ACTIONS: "true" })).toBe(true);
    expect(isCIMode({})).toBe(false);
  });

  it("should detect test mode", () => {
    expect(isTestMode({ NODE_ENV: "test" })).toBe(true);
    expect(isTestMode({ VITEST: "true" })).toBe(true);
  });

  it("should detect debug mode", () => {
    expect(isDebugMode({ ENDIORBOT_DEBUG: "1" })).toBe(true);
    expect(isDebugMode({})).toBe(false);
  });
});

describe("getLogLevel", () => {
  it("should return log level from env", () => {
    expect(getLogLevel({ ENDIORBOT_LOG_LEVEL: "debug" })).toBe("debug");
    expect(getLogLevel({ ENDIORBOT_LOG_LEVEL: "WARN" })).toBe("warn");
  });

  it("should default to debug in debug mode", () => {
    expect(getLogLevel({ ENDIORBOT_DEBUG: "1" })).toBe("debug");
  });

  it("should default to info", () => {
    expect(getLogLevel({})).toBe("info");
  });
});

describe("getGatewayPort", () => {
  it("should return port from env", () => {
    expect(getGatewayPort({ ENDIORBOT_GATEWAY_PORT: "9000" })).toBe(9000);
  });

  it("should return default port", () => {
    expect(getGatewayPort({})).toBe(18790);
  });
});

describe("API key helpers", () => {
  it("should get provider API key", () => {
    const env = { ANTHROPIC_API_KEY: "sk-ant-test" };
    expect(getProviderApiKey("anthropic", env)).toBe("sk-ant-test");
  });

  it("should check provider API key existence", () => {
    const env = { ANTHROPIC_API_KEY: "sk-ant-test" };
    expect(hasProviderApiKey("anthropic", env)).toBe(true);
    expect(hasProviderApiKey("openai", env)).toBe(false);
  });

  it("should get available providers", () => {
    const env = {
      ANTHROPIC_API_KEY: "sk-ant-test",
      OPENAI_API_KEY: "sk-openai-test",
    };
    const providers = getAvailableProviders(env);
    expect(providers).toContain("anthropic");
    expect(providers).toContain("openai");
    expect(providers).not.toContain("google");
  });
});

describe("getEnvironmentSummary", () => {
  it("should return summary object", () => {
    const env = {
      ENDIORBOT_GATEWAY_PORT: "9000",
      ENDIORBOT_DEBUG: "1",
      ANTHROPIC_API_KEY: "test",
    };
    const summary = getEnvironmentSummary(env);
    expect(summary.gatewayPort).toBe(9000);
    expect(summary.debugMode).toBe(true);
    expect(summary.availableProviders).toContain("anthropic");
  });
});
