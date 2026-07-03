/**
 * EndiorBot Configuration Schema Tests
 *
 * Unit tests for config schema validation.
 *
 * @module tests/config/schema
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 33 Day 1-2
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.1.1
 */

import { describe, it, expect } from "vitest";
import {
  parseConfig,
  parsePartialConfig,
  DEFAULT_CONFIG,
  EndiorBotConfigSchema,
  ProviderConfigSchema,
  GatewayConfigSchema,
  SDLCConfigSchema,
  OrchestratorConfigSchema,
  LoggingConfigSchema,
  SecurityConfigSchema,
} from "../../src/config/schema.js";
import {
  validateConfig,
  validatePartialConfig,
  mergeWithDefaults,
  ConfigValidator,
  formatValidationErrors,
  createMinimalConfig,
  isConfigLike,
} from "../../src/config/validation.js";

// ============================================================================
// Schema Parsing Tests
// ============================================================================

describe("parseConfig", () => {
  it("should parse empty object with defaults", () => {
    const result = parseConfig({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeDefined();
    }
  });

  it("should parse minimal config", () => {
    const input = {
      gateway: {
        port: 8080,
        host: "localhost",
      },
    };
    const result = parseConfig(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.gateway?.port).toBe(8080);
      expect(result.data.gateway?.host).toBe("localhost");
    }
  });

  it("should reject invalid port", () => {
    const input = {
      gateway: {
        port: -1,
      },
    };
    const result = parseConfig(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("should reject invalid URL in provider", () => {
    const input = {
      providers: {
        anthropic: {
          baseUrl: "not-a-url",
        },
      },
    };
    const result = parseConfig(input);
    expect(result.ok).toBe(false);
  });

  it("should parse full config", () => {
    const input = {
      gateway: {
        port: 18790,
        host: "127.0.0.1",
      },
      providers: {
        anthropic: {
          enabled: true,
          timeout: 30000,
        },
      },
      sdlc: {
        frameworkVersion: "6.1.1",
        tier: "STANDARD",
      },
      orchestrator: {
        queryMode: "parallel",
        maxParallelQueries: 3,
      },
      logging: {
        level: "info",
        format: "pretty",
      },
      security: {
        inputSanitizer: { enabled: true },
        outputScrubber: { enabled: true },
        shellGuard: { enabled: true },
      },
    };
    const result = parseConfig(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sdlc?.tier).toBe("STANDARD");
      expect(result.data.orchestrator?.queryMode).toBe("parallel");
    }
  });
});

describe("parsePartialConfig", () => {
  it("should parse partial config", () => {
    const input = {
      logging: {
        level: "debug",
      },
    };
    const result = parsePartialConfig(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.logging?.level).toBe("debug");
    }
  });

  it("should reject invalid partial config", () => {
    const input = {
      logging: {
        level: "invalid-level",
      },
    };
    const result = parsePartialConfig(input);
    expect(result.ok).toBe(false);
  });
});

// ============================================================================
// Individual Schema Tests
// ============================================================================

describe("ProviderConfigSchema", () => {
  it("should parse valid provider config", () => {
    const input = {
      apiKey: "sk-test-123",
      baseUrl: "https://api.example.com",
      enabled: true,
      timeout: 30000,
      maxRetries: 3,
    };
    const result = ProviderConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should apply defaults", () => {
    const input = {};
    const result = ProviderConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
      expect(result.data.timeout).toBe(30000);
      expect(result.data.maxRetries).toBe(3);
    }
  });
});

describe("GatewayConfigSchema", () => {
  it("should parse valid gateway config", () => {
    const input = {
      port: 8080,
      host: "0.0.0.0",
      auth: {
        token: "secret-token",
      },
    };
    const result = GatewayConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should apply default port", () => {
    const input = {};
    const result = GatewayConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(18790);
      expect(result.data.host).toBe("127.0.0.1");
    }
  });
});

describe("SDLCConfigSchema", () => {
  it("should parse valid SDLC config", () => {
    const input = {
      frameworkVersion: "6.1.1",
      docsRoot: "docs",
      strict: true,
      tier: "PROFESSIONAL",
      currentStage: "04-build",
      gates: {
        autoEvaluate: true,
        requireApproval: ["G3", "G4"],
      },
    };
    const result = SDLCConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject invalid tier", () => {
    const input = {
      tier: "INVALID",
    };
    const result = SDLCConfigSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject invalid stage", () => {
    const input = {
      currentStage: "invalid-stage",
    };
    const result = SDLCConfigSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("OrchestratorConfigSchema", () => {
  it("should parse valid orchestrator config", () => {
    const input = {
      queryMode: "parallel",
      maxParallelQueries: 5,
      perModelTimeout: 60000,
      totalTimeout: 120000,
      fallbackBehavior: "use_available",
      minimumResponses: 2,
      mergingAlgorithm: "weighted_consensus",
      primaryModelWeight: 2.0,
      expertModelWeight: 1.0,
    };
    const result = OrchestratorConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should parse models array", () => {
    const input = {
      models: [
        {
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          role: "primary",
          enabled: true,
        },
        {
          provider: "openai",
          model: "gpt-5",
          role: "expert",
          enabled: true,
          purpose: "Architecture review",
        },
      ],
    };
    const result = OrchestratorConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.models?.length).toBe(2);
    }
  });
});

describe("LoggingConfigSchema", () => {
  it("should parse valid logging config", () => {
    const input = {
      level: "debug",
      format: "json",
      redactSensitive: "all",
      file: {
        enabled: true,
        path: "/var/log/endiorbot.log",
        maxSize: "50MB",
        maxFiles: 10,
      },
    };
    const result = LoggingConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("SecurityConfigSchema", () => {
  it("should parse valid security config", () => {
    const input = {
      inputSanitizer: {
        enabled: true,
        patterns: ["sql-injection", "xss"],
      },
      outputScrubber: {
        enabled: true,
        patterns: ["api-key", "password"],
      },
      shellGuard: {
        enabled: true,
        blockedPatterns: ["rm -rf", "DROP TABLE"],
      },
    };
    const result = SecurityConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Validation Module Tests
// ============================================================================

describe("validateConfig", () => {
  it("should validate and apply defaults", () => {
    const result = validateConfig({}, { applyDefaults: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.gateway?.port).toBe(18790);
      expect(result.data.logging?.level).toBe("info");
    }
  });

  it("should collect warnings", () => {
    const result = validateConfig({}, { collectWarnings: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    }
  });
});

describe("validatePartialConfig", () => {
  it("should validate partial updates", () => {
    const result = validatePartialConfig({
      logging: { level: "warn" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.logging?.level).toBe("warn");
    }
  });
});

describe("mergeWithDefaults", () => {
  it("should merge config with defaults", () => {
    const input = {
      gateway: { port: 9000 },
    };
    const result = mergeWithDefaults(input as any);
    expect(result.gateway?.port).toBe(9000);
    expect(result.gateway?.host).toBe("127.0.0.1");
    expect(result.logging?.level).toBe("info");
  });
});

describe("ConfigValidator", () => {
  it("should cache valid config", () => {
    const validator = new ConfigValidator();
    const result = validator.validate({});
    expect(result.ok).toBe(true);
    expect(validator.getLastValidConfig()).toBeDefined();
    expect(validator.getLastValidationTime()).toBeDefined();
  });

  it("should check fresh config", () => {
    const validator = new ConfigValidator();
    validator.validate({});
    expect(validator.hasFreshConfig(60000)).toBe(true);
    expect(validator.hasFreshConfig(0)).toBe(false);
  });

  it("should clear cache", () => {
    const validator = new ConfigValidator();
    validator.validate({});
    validator.clearCache();
    expect(validator.getLastValidConfig()).toBeUndefined();
  });
});

describe("formatValidationErrors", () => {
  it("should format empty errors", () => {
    const result = formatValidationErrors([]);
    expect(result).toBe("No validation errors");
  });

  it("should format multiple errors", () => {
    const result = formatValidationErrors([
      { path: "gateway.port", message: "Must be positive" },
      { path: "logging.level", message: "Invalid level" },
    ]);
    expect(result).toContain("2 error(s)");
    expect(result).toContain("gateway.port");
    expect(result).toContain("logging.level");
  });
});

describe("createMinimalConfig", () => {
  it("should create valid minimal config", () => {
    const config = createMinimalConfig();
    const result = parseConfig(config);
    expect(result.ok).toBe(true);
  });
});

describe("isConfigLike", () => {
  it("should return true for objects", () => {
    expect(isConfigLike({})).toBe(true);
    expect(isConfigLike({ key: "value" })).toBe(true);
  });

  it("should return false for non-objects", () => {
    expect(isConfigLike(null)).toBe(false);
    expect(isConfigLike(undefined)).toBe(false);
    expect(isConfigLike([])).toBe(false);
    expect(isConfigLike("string")).toBe(false);
    expect(isConfigLike(123)).toBe(false);
  });
});

// ============================================================================
// DEFAULT_CONFIG Tests
// ============================================================================

describe("DEFAULT_CONFIG", () => {
  it("should be a valid config", () => {
    const result = parseConfig(DEFAULT_CONFIG);
    expect(result.ok).toBe(true);
  });

  it("should have expected default values", () => {
    expect(DEFAULT_CONFIG.gateway?.port).toBe(18790);
    expect(DEFAULT_CONFIG.gateway?.host).toBe("127.0.0.1");
    expect(DEFAULT_CONFIG.sdlc?.frameworkVersion).toBe("6.4.0");
    expect(DEFAULT_CONFIG.sdlc?.tier).toBe("STANDARD");
    expect(DEFAULT_CONFIG.logging?.level).toBe("info");
    expect(DEFAULT_CONFIG.logging?.format).toBe("pretty");
    expect(DEFAULT_CONFIG.orchestrator?.queryMode).toBe("parallel");
  });
});
