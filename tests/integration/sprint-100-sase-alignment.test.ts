/**
 * Sprint 100: SASE 6.1.2 Full Alignment — Integration Tests
 *
 * Tests tier matrix alignment, tier-aware model routing,
 * and multi-agent history propagation.
 *
 * @sprint 100
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Phase 1: Tier Constants + Agent Definitions (SASE 6.1.2)
// ============================================================================

describe("Phase 1: Tier Constants (SASE 6.1.2)", () => {
  it("TIER_AGENT_COUNT matches SASE 6.1.2", async () => {
    const { TIER_AGENT_COUNT } = await import("../../src/sdlc/scaffold/types.js");
    expect(TIER_AGENT_COUNT.LITE).toBe(3);
    expect(TIER_AGENT_COUNT.STANDARD).toBe(6);
    expect(TIER_AGENT_COUNT.PROFESSIONAL).toBe(11);
    expect(TIER_AGENT_COUNT.ENTERPRISE).toBe(14);
  });

  it("TIER_ORDER is unchanged", async () => {
    const { TIER_ORDER } = await import("../../src/sdlc/scaffold/types.js");
    expect(TIER_ORDER.LITE).toBe(0);
    expect(TIER_ORDER.STANDARD).toBe(1);
    expect(TIER_ORDER.PROFESSIONAL).toBe(2);
    expect(TIER_ORDER.ENTERPRISE).toBe(3);
  });
});

describe("Phase 1: Agent Definitions (SASE 6.1.2)", () => {
  it("has 14 agents total", async () => {
    const { getAllAgents } = await import("../../src/sdlc/scaffold/templates/agents-md.js");
    const agents = getAllAgents();
    expect(agents).toHaveLength(14);
  });

  it("LITE tier has assistant, coder, tester", async () => {
    const { getAllAgents } = await import("../../src/sdlc/scaffold/templates/agents-md.js");
    const agents = getAllAgents();
    const liteAgents = agents.filter(a => a.minTier === "LITE");
    const liteIds = liteAgents.map(a => a.id).sort();
    expect(liteIds).toEqual(["assistant", "coder", "tester"]);
  });

  it("STANDARD tier adds pm, architect, reviewer", async () => {
    const { getAllAgents } = await import("../../src/sdlc/scaffold/templates/agents-md.js");
    const agents = getAllAgents();
    const standardAgents = agents.filter(a => a.minTier === "STANDARD");
    const standardIds = standardAgents.map(a => a.id).sort();
    expect(standardIds).toEqual(["architect", "pm", "reviewer"]);
  });

  it("PROFESSIONAL tier adds cso, devops, fullstack, pjm, researcher", async () => {
    const { getAllAgents } = await import("../../src/sdlc/scaffold/templates/agents-md.js");
    const agents = getAllAgents();
    const proAgents = agents.filter(a => a.minTier === "PROFESSIONAL");
    const proIds = proAgents.map(a => a.id).sort();
    expect(proIds).toEqual(["cso", "devops", "fullstack", "pjm", "researcher"]);
  });

  it("ENTERPRISE tier adds ceo, cto, cpo", async () => {
    const { getAllAgents } = await import("../../src/sdlc/scaffold/templates/agents-md.js");
    const agents = getAllAgents();
    const entAgents = agents.filter(a => a.minTier === "ENTERPRISE");
    const entIds = entAgents.map(a => a.id).sort();
    expect(entIds).toEqual(["ceo", "cpo", "cto"]);
  });

  it("tester moved from PROFESSIONAL to LITE (SASE 6.1.2)", async () => {
    const { getAgentById } = await import("../../src/sdlc/scaffold/templates/agents-md.js");
    const tester = getAgentById("tester");
    expect(tester?.minTier).toBe("LITE");
  });

  it("architect moved from PROFESSIONAL to STANDARD (SASE 6.1.2)", async () => {
    const { getAgentById } = await import("../../src/sdlc/scaffold/templates/agents-md.js");
    const architect = getAgentById("architect");
    expect(architect?.minTier).toBe("STANDARD");
  });

  it("fullstack agent exists with PROFESSIONAL tier", async () => {
    const { getAgentById } = await import("../../src/sdlc/scaffold/templates/agents-md.js");
    const fullstack = getAgentById("fullstack");
    expect(fullstack).toBeDefined();
    expect(fullstack?.minTier).toBe("PROFESSIONAL");
    expect(fullstack?.model).toBe("sonnet");
  });

  it("devops moved from ENTERPRISE to PROFESSIONAL (SASE 6.1.2)", async () => {
    const { getAgentById } = await import("../../src/sdlc/scaffold/templates/agents-md.js");
    const devops = getAgentById("devops");
    expect(devops?.minTier).toBe("PROFESSIONAL");
    expect(devops?.model).toBe("haiku");
  });

  it("C-suite agents are ENTERPRISE tier", async () => {
    const { getAgentById } = await import("../../src/sdlc/scaffold/templates/agents-md.js");
    expect(getAgentById("ceo")?.minTier).toBe("ENTERPRISE");
    expect(getAgentById("cto")?.minTier).toBe("ENTERPRISE");
    expect(getAgentById("cpo")?.minTier).toBe("ENTERPRISE");
  });
});

// ============================================================================
// Phase 3: Tier-Aware AGENT_MODEL_MAP
// ============================================================================

describe("Phase 3: Tier-Aware AGENT_MODEL_MAP", () => {
  it("TIER_AGENT_MODEL_MAP has 4 tiers", async () => {
    const { TIER_AGENT_MODEL_MAP } = await import("../../src/agents/channel-router.js");
    expect(Object.keys(TIER_AGENT_MODEL_MAP)).toEqual(["LITE", "STANDARD", "PROFESSIONAL", "ENTERPRISE"]);
  });

  it("LITE tier has 3 agents: assistant, coder, tester", async () => {
    const { TIER_AGENT_MODEL_MAP } = await import("../../src/agents/channel-router.js");
    expect(Object.keys(TIER_AGENT_MODEL_MAP.LITE!).sort()).toEqual(["assistant", "coder", "tester"]);
  });

  it("STANDARD tier has 3 agents: pm, architect, reviewer", async () => {
    const { TIER_AGENT_MODEL_MAP } = await import("../../src/agents/channel-router.js");
    expect(Object.keys(TIER_AGENT_MODEL_MAP.STANDARD!).sort()).toEqual(["architect", "pm", "reviewer"]);
  });

  it("AGENT_MODEL_MAP backward compat — flat map with all 14 agents", async () => {
    const { AGENT_MODEL_MAP } = await import("../../src/agents/channel-router.js");
    expect(Object.keys(AGENT_MODEL_MAP).sort()).toEqual([
      "architect", "assistant", "ceo", "coder", "cpo", "cso", "cto",
      "devops", "fullstack", "pjm", "pm", "researcher", "reviewer", "tester",
    ]);
  });

  it("AGENT_MODEL_MAP preserves model assignments", async () => {
    const { AGENT_MODEL_MAP } = await import("../../src/agents/channel-router.js");
    expect(AGENT_MODEL_MAP.ceo).toBe("opus");
    expect(AGENT_MODEL_MAP.coder).toBe("sonnet");
    // Sprint 136 (1cbe357): @devops promoted haiku → sonnet to match
    // executor-class cadence on sprint docs / ops actions.
    expect(AGENT_MODEL_MAP.devops).toBe("sonnet");
    expect(AGENT_MODEL_MAP.architect).toBe("opus");
  });
});

describe("Phase 3: getAgentModel() (ADR-052 provider-aware)", () => {
  it("returns provider-aware model for LITE agent at LITE tier", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    // ADR-052 Amendment (Sprint 156): Tier 2 agents → Kimi primary (kimi-code)
    expect(getAgentModel("coder", "LITE")).toBe("kimi-code");
    expect(getAgentModel("assistant", "LITE")).toBe("kimi-code");
    expect(getAgentModel("tester", "LITE")).toBe("kimi-code");
  });

  it("returns undefined for STANDARD agent at LITE tier (strict enforcement)", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    expect(getAgentModel("pm", "LITE")).toBeUndefined();
    expect(getAgentModel("architect", "LITE")).toBeUndefined();
  });

  it("returns provider-aware model for STANDARD agents at STANDARD tier", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    // ADR-052 Amendment (Sprint 156): PM promoted to Tier 1 Opus; reviewer → Kimi
    expect(getAgentModel("pm", "STANDARD")).toBe("opus");
    expect(getAgentModel("architect", "STANDARD")).toBe("opus");
    expect(getAgentModel("reviewer", "STANDARD")).toBe("kimi-code");
  });

  it("STANDARD tier includes LITE agents (inheritance)", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    // ADR-052 Amendment (Sprint 156): Tier 2 agents → Kimi primary
    expect(getAgentModel("coder", "STANDARD")).toBe("kimi-code");
    expect(getAgentModel("tester", "STANDARD")).toBe("kimi-code");
  });

  it("returns undefined for ENTERPRISE agents at PROFESSIONAL tier", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    expect(getAgentModel("ceo", "PROFESSIONAL")).toBeUndefined();
    expect(getAgentModel("cto", "PROFESSIONAL")).toBeUndefined();
  });

  it("ENTERPRISE tier has all agents with provider-aware models", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    expect(getAgentModel("ceo", "ENTERPRISE")).toBe("opus");
    // ADR-052 Amendment (Sprint 156): devops/coder → Kimi primary
    expect(getAgentModel("devops", "ENTERPRISE")).toBe("kimi-code");
    expect(getAgentModel("coder", "ENTERPRISE")).toBe("kimi-code");
  });

  it("defaults to ENTERPRISE when no tier provided", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    expect(getAgentModel("ceo")).toBe("opus");
    // ADR-052 Amendment (Sprint 156): coder → Kimi primary
    expect(getAgentModel("coder")).toBe("kimi-code");
  });

  it("unknown tier falls back to flat map", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    // ADR-052 Amendment (Sprint 156): flat map returns provider-aware model → kimi-code
    expect(getAgentModel("coder", "UNKNOWN")).toBe("kimi-code");
  });

  it("unknown agent returns undefined", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    expect(getAgentModel("nonexistent", "ENTERPRISE")).toBeUndefined();
  });
});

// ============================================================================
// Phase 4: Multi-Agent History Propagation (CTO F4)
// ============================================================================

describe("Phase 4: Multi-Agent History Propagation", () => {
  it("dispatch() accepts history parameter", async () => {
    const { MultiAgentDispatcher } = await import("../../src/autonomy/multi-agent-dispatcher.js");

    const mockRouter = {
      callAI: vi.fn().mockResolvedValue({
        content: "test response",
        provider: "mock",
        model: "mock-model",
      }),
      config: { projectRoot: "/mock" },
    } as any;

    const dispatcher = new MultiAgentDispatcher();
    const history = [
      { role: "user", content: "previous message" },
      { role: "assistant", content: "previous response" },
    ];

    const result = await dispatcher.dispatch(
      {
        goalId: "test-goal",
        strategy: "sequential",
        subtasks: [{
          id: "sub-1",
          agent: "coder",
          description: "test task",
          dependencies: [],
        }],
      },
      mockRouter,
      "/test/workspace",
      history,
    );

    expect(result).toBeDefined();
    // Verify history was passed to callAI
    expect(mockRouter.callAI).toHaveBeenCalledWith(
      "coder",
      expect.any(String),
      history,
      "/test/workspace",
    );
  });

  it("dispatch() works without history (backward compat)", async () => {
    const { MultiAgentDispatcher } = await import("../../src/autonomy/multi-agent-dispatcher.js");

    const mockRouter = {
      callAI: vi.fn().mockResolvedValue({
        content: "test response",
        provider: "mock",
        model: "mock-model",
      }),
      config: { projectRoot: "/mock" },
    } as any;

    const dispatcher = new MultiAgentDispatcher();

    const result = await dispatcher.dispatch(
      {
        goalId: "test-goal",
        strategy: "sequential",
        subtasks: [{
          id: "sub-1",
          agent: "coder",
          description: "test task",
          dependencies: [],
        }],
      },
      mockRouter,
      "/test/workspace",
      // No history param — backward compat
    );

    expect(result).toBeDefined();
    // History should be undefined when not provided
    expect(mockRouter.callAI).toHaveBeenCalledWith(
      "coder",
      expect.any(String),
      undefined,
      "/test/workspace",
    );
  });

  it("parallel dispatch passes history to all subtasks", async () => {
    const { MultiAgentDispatcher } = await import("../../src/autonomy/multi-agent-dispatcher.js");

    const mockRouter = {
      callAI: vi.fn().mockResolvedValue({
        content: "test response",
        provider: "mock",
        model: "mock-model",
      }),
      config: { projectRoot: "/mock" },
    } as any;

    const dispatcher = new MultiAgentDispatcher();
    const history = [{ role: "user", content: "context" }];

    await dispatcher.dispatch(
      {
        goalId: "test-goal",
        strategy: "parallel",
        subtasks: [
          { id: "sub-1", agent: "coder", description: "task 1", dependencies: [] },
          { id: "sub-2", agent: "tester", description: "task 2", dependencies: [] },
        ],
      },
      mockRouter,
      "/test/ws",
      history,
    );

    // Both subtasks should receive history
    expect(mockRouter.callAI).toHaveBeenCalledTimes(2);
    expect(mockRouter.callAI).toHaveBeenNthCalledWith(1, "coder", expect.any(String), history, "/test/ws");
    expect(mockRouter.callAI).toHaveBeenNthCalledWith(2, "tester", expect.any(String), history, "/test/ws");
  });
});
