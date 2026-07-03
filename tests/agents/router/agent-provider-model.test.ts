/**
 * ADR-052: Agent-Model Tier Mapping Tests
 *
 * Validates AGENT_PROVIDER_MODEL_MAP, TIER_FALLBACK_CHAIN,
 * getAgentProviderModel(), and dispatchAgentPrimary/dispatchAgentFallback.
 */

import {
  AGENT_PROVIDER_MODEL_MAP,
  TIER_FALLBACK_CHAIN,
  getAgentProviderModel,
  getAgentModel,
  AGENT_MODEL_MAP,
  TIER_AGENT_MODEL_MAP,
} from "../../../src/agents/router/agent-constants.js";

describe("ADR-052: Agent-Model Tier Mapping", () => {
  describe("AGENT_PROVIDER_MODEL_MAP", () => {
    it("covers all 14 agents", () => {
      const agents = [
        "pm", "architect", "coder", "reviewer", "tester", "researcher",
        "devops", "fullstack", "pjm", "ceo", "cpo", "cto", "cso", "assistant",
      ];
      for (const agent of agents) {
        expect(AGENT_PROVIDER_MODEL_MAP[agent as keyof typeof AGENT_PROVIDER_MODEL_MAP]).toBeDefined();
      }
    });

    it("Tier 1 agents use claude-code/opus (Sprint 156: strategic agents)", () => {
      const tier1Agents = ["architect", "cso", "ceo", "pm", "cpo", "cto"];
      for (const agent of tier1Agents) {
        const config = AGENT_PROVIDER_MODEL_MAP[agent as keyof typeof AGENT_PROVIDER_MODEL_MAP];
        expect(config.provider).toBe("claude-code");
        expect(config.model).toBe("opus");
        expect(config.tier).toBe(1);
      }
    });

    it("Tier 2 agents use kimi/kimi-code (Sprint 156: executor agents, CC Sonnet fallback)", () => {
      const tier2Agents = ["coder", "reviewer", "tester", "fullstack", "pjm", "researcher", "devops", "assistant"];
      for (const agent of tier2Agents) {
        const config = AGENT_PROVIDER_MODEL_MAP[agent as keyof typeof AGENT_PROVIDER_MODEL_MAP];
        expect(config).toBeDefined();
        expect(config.provider).toBe("kimi");
        expect(config.model).toBe("kimi-code");
        expect(config.tier).toBe(2);
      }
    });
  });

  describe("TIER_FALLBACK_CHAIN", () => {
    it("Tier 1: claude-code → kimi → ollama (AI-Platform last resort)", () => {
      expect(TIER_FALLBACK_CHAIN[1]).toEqual(["claude-code", "kimi", "ollama"]);
    });

    it("Tier 2: kimi → claude-code → ollama (CC Sonnet fallback on rate-limit)", () => {
      expect(TIER_FALLBACK_CHAIN[2]).toEqual(["kimi", "claude-code", "ollama"]);
    });
  });

  describe("getAgentProviderModel", () => {
    it("returns config for known agents", () => {
      expect(getAgentProviderModel("coder")?.provider).toBe("kimi");
      expect(getAgentProviderModel("architect")?.provider).toBe("claude-code");
      expect(getAgentProviderModel("assistant")?.provider).toBe("kimi");
    });

    it("returns undefined for unknown agents", () => {
      expect(getAgentProviderModel("unknown-agent")).toBeUndefined();
    });
  });

  describe("Backward compatibility", () => {
    it("getAgentModel still works and returns model name", () => {
      expect(getAgentModel("coder")).toBe("kimi-code");
      expect(getAgentModel("architect")).toBe("opus");
      expect(getAgentModel("assistant")).toBe("kimi-code");
    });

    it("AGENT_MODEL_MAP still has legacy entries", () => {
      expect(AGENT_MODEL_MAP.coder).toBe("sonnet"); // legacy value from TIER_AGENT_MODEL_MAP
      expect(AGENT_MODEL_MAP.architect).toBe("opus");
    });

    it("TIER_AGENT_MODEL_MAP preserved", () => {
      expect(Object.keys(TIER_AGENT_MODEL_MAP)).toEqual(["LITE", "STANDARD", "PROFESSIONAL", "ENTERPRISE"]);
    });
  });
});
