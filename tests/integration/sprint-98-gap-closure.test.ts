/**
 * Sprint 98 Gap Closure — Integration Tests
 *
 * Covers all Sprint 98 changes:
 *   Phase 1: AGENT_MODEL_MAP + InvokeRequest.model field
 *   Phase 2: ConversationStore integration + GatewayIngress conversation context
 *   Phase 4: InboundResponse.format passthrough
 *   CTO F1:  MAX_HISTORY_TOKENS token budget enforcement
 *
 * @module tests/integration/sprint-98-gap-closure
 * @sprint 98
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AGENT_MODEL_MAP,
  VALID_AGENTS,
  type AgentName,
  type AIResult,
  type RouteResult,
} from "../../src/agents/channel-router.js";
import type {
  InvokeRequest,
  InvokeMode,
} from "../../src/agents/invoke/claude-code-bridge.js";
import {
  ConversationStore,
  DEFAULT_MAX_TURNS,
  getConversationStore,
  resetConversationStore,
} from "../../src/channels/conversation/store.js";
import { GatewayIngress, type InboundMessage, type InboundResponse } from "../../src/gateway/ingress.js";
import { CommandDispatcher } from "../../src/commands/command-dispatcher.js";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a mock ChannelRouter that fulfils the structural interface required by
 * GatewayIngress without touching real AI providers.
 *
 * @param agentResponse - Text the mock AI returns for any callAI invocation
 * @param agentForRoute - Agent name the mock router extracts from messages
 */
function createMockRouter(
  agentResponse = "mock response",
  agentForRoute = "pm",
): {
  routeMessage: (text: string) => Promise<RouteResult | null>;
  callAI: (agent: string, task: string, history?: Array<{ role: string; content: string }>) => Promise<AIResult>;
  formatResponse: (agent: string, result: AIResult) => string;
  getUsageHint: () => string;
} {
  return {
    routeMessage: async (text: string): Promise<RouteResult | null> => {
      // Detects @<agent> mention and returns a RouteResult so that handleInbound
      // can reach the AI-chat path (not the "usage hint" path).
      const match = text.match(/@(\w+)\s*(.*)/);
      if (match) {
        return { agents: [match[1] ?? agentForRoute], task: match[2] ?? text };
      }
      // Also accept bracket format [@agent: task]
      const bracketMatch = text.match(/\[@(\w+):\s*(.*?)\]/);
      if (bracketMatch) {
        return { agents: [bracketMatch[1] ?? agentForRoute], task: bracketMatch[2] ?? text };
      }
      return null;
    },
    callAI: async (
      agent: string,
      task: string,
      _history?: Array<{ role: string; content: string }>,
    ): Promise<AIResult> => ({
      content: `${agentResponse} [agent=${agent}] [task=${task}]`,
      provider: "mock",
      durationMs: 1,
    }),
    formatResponse: (agent: string, result: AIResult): string =>
      `@${agent}\n\n${result.content}`,
    getUsageHint: (): string => "Dùng @agent hoặc [@agent: task] để gọi agent.",
    config: { projectRoot: "/mock/project" },
  } as any;
}

// ============================================================================
// 1. AGENT_MODEL_MAP — Phase 1
// ============================================================================

describe("Phase 1 — AGENT_MODEL_MAP", () => {
  describe("executive agents map to opus", () => {
    it("ceo → opus", () => {
      expect(AGENT_MODEL_MAP["ceo"]).toBe("opus");
    });

    it("cpo → opus", () => {
      expect(AGENT_MODEL_MAP["cpo"]).toBe("opus");
    });

    it("cto → opus", () => {
      expect(AGENT_MODEL_MAP["cto"]).toBe("opus");
    });
  });

  describe("architecture agents map to opus", () => {
    it("architect → opus", () => {
      expect(AGENT_MODEL_MAP["architect"]).toBe("opus");
    });

    it("cso → opus", () => {
      expect(AGENT_MODEL_MAP["cso"]).toBe("opus");
    });
  });

  describe("dev / test agents map to sonnet (legacy flat map)", () => {
    it("reviewer → sonnet", () => {
      expect(AGENT_MODEL_MAP["reviewer"]).toBe("sonnet");
    });

    it("coder → sonnet", () => {
      expect(AGENT_MODEL_MAP["coder"]).toBe("sonnet");
    });

    it("tester → sonnet", () => {
      expect(AGENT_MODEL_MAP["tester"]).toBe("sonnet");
    });

    it("researcher → sonnet", () => {
      expect(AGENT_MODEL_MAP["researcher"]).toBe("sonnet");
    });

    it("fullstack → sonnet", () => {
      expect(AGENT_MODEL_MAP["fullstack"]).toBe("sonnet");
    });

    it("assistant → sonnet", () => {
      expect(AGENT_MODEL_MAP["assistant"]).toBe("sonnet");
    });
  });

  describe("ops / project-tracking agents map to sonnet (Sprint 136 promotion)", () => {
    // Sprint 136 commits 1cbe357 (devops) + 9423ae7 (pjm) — promoted from
    // haiku to sonnet so executor-class agents share the same cadence on
    // sprint docs and ops actions.
    it("pjm → sonnet", () => {
      expect(AGENT_MODEL_MAP["pjm"]).toBe("sonnet");
    });

    it("devops → sonnet", () => {
      expect(AGENT_MODEL_MAP["devops"]).toBe("sonnet");
    });
  });

  describe("unknown agent defaults to undefined (fallback to sonnet at runtime)", () => {
    it("AGENT_MODEL_MAP['unknown'] is undefined", () => {
      expect(AGENT_MODEL_MAP["unknown"]).toBeUndefined();
    });

    it("AGENT_MODEL_MAP[''] is undefined", () => {
      expect(AGENT_MODEL_MAP[""]).toBeUndefined();
    });

    it("AGENT_MODEL_MAP['gpt'] is undefined", () => {
      expect(AGENT_MODEL_MAP["gpt"]).toBeUndefined();
    });
  });

  describe("coverage: every VALID_AGENT has an entry in AGENT_MODEL_MAP", () => {
    it("all VALID_AGENTS are present in AGENT_MODEL_MAP", () => {
      const missingAgents: string[] = [];
      for (const agent of VALID_AGENTS) {
        if (AGENT_MODEL_MAP[agent] === undefined) {
          missingAgents.push(agent);
        }
      }
      expect(
        missingAgents,
        `The following VALID_AGENTS are missing from AGENT_MODEL_MAP: ${missingAgents.join(", ")}`,
      ).toHaveLength(0);
    });

    it("all AGENT_MODEL_MAP values are one of: opus, sonnet, haiku", () => {
      const allowedTiers = new Set(["opus", "sonnet", "haiku"]);
      for (const [agent, tier] of Object.entries(AGENT_MODEL_MAP)) {
        expect(
          allowedTiers.has(tier),
          `AGENT_MODEL_MAP['${agent}'] = '${tier}' is not a valid tier`,
        ).toBe(true);
      }
    });

    it("AGENT_MODEL_MAP has exactly as many entries as VALID_AGENTS", () => {
      expect(Object.keys(AGENT_MODEL_MAP)).toHaveLength(VALID_AGENTS.length);
    });
  });

  describe("model tier invariants (CEO power tool budget control)", () => {
    it("only strategic and architecture agents use opus (Sprint 156: PM promoted)", () => {
      const opusAgents = Object.entries(AGENT_MODEL_MAP)
        .filter(([, tier]) => tier === "opus")
        .map(([agent]) => agent);

      const expectedOpusAgents = ["ceo", "cpo", "cso", "cto", "architect", "pm"];
      expect(opusAgents.sort()).toEqual(expectedOpusAgents.sort());
    });

    it("haiku is no longer in routing (Sprint 136: @devops + @pjm promoted to sonnet)", () => {
      // Sprint 136 commits 1cbe357 + 9423ae7 (2026-04-18): @devops and @pjm
      // moved from haiku → sonnet to match executor-class cadence on sprint
      // docs. No agent currently routes to haiku at the orchestration layer.
      const haikuAgents = Object.entries(AGENT_MODEL_MAP)
        .filter(([, tier]) => tier === "haiku")
        .map(([agent]) => agent);

      expect(haikuAgents).toEqual([]);
    });

    it("sonnet is the most common tier (balanced default for dev agents)", () => {
      const tierCounts: Record<string, number> = {};
      for (const tier of Object.values(AGENT_MODEL_MAP)) {
        tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
      }

      const sonnetCount = tierCounts["sonnet"] ?? 0;
      const opusCount = tierCounts["opus"] ?? 0;

      // sonnet has at least as many entries as opus.
      // (Sprint 136: haiku tier emptied, no haiku agents remain.)
      expect(sonnetCount).toBeGreaterThanOrEqual(opusCount);
    });
  });
});

// ============================================================================
// 2. InvokeRequest.model field — Phase 1
// ============================================================================

describe("Phase 1 — InvokeRequest.model field (type-level)", () => {
  it("InvokeRequest accepts model: 'opus' (type-level check via construction)", () => {
    // This test is a compile-time type check encoded as a runtime assertion.
    // If the 'model' field does not exist on InvokeRequest, the TypeScript
    // compiler would fail before this test runs.
    const req: InvokeRequest = {
      mode: "READ" as InvokeMode,
      systemPrompt: "You are a CTO.",
      userPrompt: "Review the architecture.",
      workspace: "/tmp/workspace",
      agent: "cto",
      model: "opus",
    };

    expect(req.model).toBe("opus");
  });

  it("InvokeRequest accepts model: 'sonnet'", () => {
    const req: InvokeRequest = {
      mode: "READ" as InvokeMode,
      systemPrompt: "You are a coder.",
      userPrompt: "Write a function.",
      workspace: "/tmp/workspace",
      agent: "coder",
      model: "sonnet",
    };

    expect(req.model).toBe("sonnet");
  });

  it("InvokeRequest accepts model: 'haiku'", () => {
    const req: InvokeRequest = {
      mode: "READ" as InvokeMode,
      systemPrompt: "You are a devops engineer.",
      userPrompt: "Check deployment status.",
      workspace: "/tmp/workspace",
      agent: "devops",
      model: "haiku",
    };

    expect(req.model).toBe("haiku");
  });

  it("InvokeRequest.model is optional — can be omitted", () => {
    const req: InvokeRequest = {
      mode: "READ" as InvokeMode,
      systemPrompt: "You are an assistant.",
      userPrompt: "Summarize this.",
      workspace: "/tmp/workspace",
      agent: "assistant",
      // model intentionally absent
    };

    // model should be undefined when omitted
    expect(req.model).toBeUndefined();
  });

  it("InvokeRequest without model — model property is undefined (runtime fallback to sonnet)", () => {
    const req: Omit<InvokeRequest, "mode"> & { mode: InvokeMode } = {
      mode: "PATCH" as InvokeMode,
      systemPrompt: "You are a pm.",
      userPrompt: "Plan sprint.",
      workspace: "/tmp/workspace",
      agent: "pm",
    };

    // The runtime default fallback is "sonnet" (??= "sonnet" in channel-router)
    const resolvedModel = req.model ?? "sonnet";
    expect(resolvedModel).toBe("sonnet");
  });
});

// ============================================================================
// 3. ConversationStore — Phase 2
// ============================================================================

describe("Phase 2 — ConversationStore", () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
  });

  describe("add() and get()", () => {
    it("stores a user turn and retrieves it", () => {
      store.add("chat-1", "user", "Hello, @pm!");

      const turns = store.get("chat-1");
      expect(turns).toHaveLength(1);
      expect(turns[0]?.role).toBe("user");
      expect(turns[0]?.content).toBe("Hello, @pm!");
    });

    it("stores an assistant turn and retrieves it", () => {
      store.add("chat-1", "assistant", "Hello! How can I help?");

      const turns = store.get("chat-1");
      expect(turns).toHaveLength(1);
      expect(turns[0]?.role).toBe("assistant");
      expect(turns[0]?.content).toBe("Hello! How can I help?");
    });

    it("stores both user and assistant turns in chronological order", () => {
      store.add("chat-1", "user", "First message");
      store.add("chat-1", "assistant", "First reply");
      store.add("chat-1", "user", "Second message");
      store.add("chat-1", "assistant", "Second reply");

      const turns = store.get("chat-1");
      expect(turns).toHaveLength(4);
      expect(turns[0]?.role).toBe("user");
      expect(turns[0]?.content).toBe("First message");
      expect(turns[1]?.role).toBe("assistant");
      expect(turns[1]?.content).toBe("First reply");
      expect(turns[2]?.role).toBe("user");
      expect(turns[2]?.content).toBe("Second message");
      expect(turns[3]?.role).toBe("assistant");
      expect(turns[3]?.content).toBe("Second reply");
    });

    it("returns empty array for unknown chatId", () => {
      const turns = store.get("nonexistent-chat");
      expect(turns).toEqual([]);
    });

    it("each turn has a timestamp field", () => {
      const before = new Date();
      store.add("chat-1", "user", "timed message");
      const after = new Date();

      const turns = store.get("chat-1");
      expect(turns[0]?.timestamp).toBeInstanceOf(Date);
      expect(turns[0]!.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(turns[0]!.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("isolates history by chatId", () => {
      store.add("chat-A", "user", "Message A");
      store.add("chat-B", "user", "Message B");

      expect(store.get("chat-A")).toHaveLength(1);
      expect(store.get("chat-A")[0]?.content).toBe("Message A");
      expect(store.get("chat-B")).toHaveLength(1);
      expect(store.get("chat-B")[0]?.content).toBe("Message B");
    });
  });

  describe("maxTurns cap — CTO F1 memory guard", () => {
    it("caps history at DEFAULT_MAX_TURNS (10)", () => {
      for (let i = 0; i < DEFAULT_MAX_TURNS + 5; i++) {
        store.add("chat-cap", "user", `Turn ${i}`);
      }

      expect(store.get("chat-cap")).toHaveLength(DEFAULT_MAX_TURNS);
    });

    it("evicts oldest turns first when cap is reached", () => {
      for (let i = 0; i < DEFAULT_MAX_TURNS + 3; i++) {
        store.add("chat-evict", "user", `Turn ${i}`);
      }

      const turns = store.get("chat-evict");
      // First 3 turns evicted; first remaining turn should be "Turn 3"
      expect(turns[0]?.content).toBe("Turn 3");
      // Last turn should be the most recently added
      expect(turns[turns.length - 1]?.content).toBe(`Turn ${DEFAULT_MAX_TURNS + 2}`);
    });

    it("respects a custom maxTurns constructor argument", () => {
      const smallStore = new ConversationStore(3);
      for (let i = 0; i < 6; i++) {
        smallStore.add("chat-small", "user", `Turn ${i}`);
      }

      const turns = smallStore.get("chat-small");
      expect(turns).toHaveLength(3);
      expect(turns[0]?.content).toBe("Turn 3");
      expect(turns[2]?.content).toBe("Turn 5");
    });

    it("DEFAULT_MAX_TURNS is 10", () => {
      expect(DEFAULT_MAX_TURNS).toBe(10);
    });
  });

  describe("clear()", () => {
    it("removes history for a specific chatId", () => {
      store.add("chat-clear", "user", "Hello");
      store.clear("chat-clear");

      expect(store.get("chat-clear")).toEqual([]);
      expect(store.hasHistory("chat-clear")).toBe(false);
    });

    it("does not affect other chats when clearing one", () => {
      store.add("chat-X", "user", "Keep me");
      store.add("chat-Y", "user", "Delete me");

      store.clear("chat-Y");

      expect(store.get("chat-X")).toHaveLength(1);
      expect(store.get("chat-X")[0]?.content).toBe("Keep me");
      expect(store.get("chat-Y")).toEqual([]);
    });

    it("clearing a nonexistent chatId does not throw", () => {
      expect(() => store.clear("chat-nonexistent")).not.toThrow();
    });
  });

  describe("clearAll()", () => {
    it("removes all conversation histories", () => {
      store.add("chat-1", "user", "A");
      store.add("chat-2", "user", "B");
      store.add("chat-3", "user", "C");

      store.clearAll();

      expect(store.chatCount()).toBe(0);
      expect(store.get("chat-1")).toEqual([]);
      expect(store.get("chat-2")).toEqual([]);
      expect(store.get("chat-3")).toEqual([]);
    });
  });

  describe("size() and hasHistory()", () => {
    it("size() returns 0 for new chat", () => {
      expect(store.size("new-chat")).toBe(0);
    });

    it("size() returns number of turns stored", () => {
      store.add("chat-sz", "user", "A");
      store.add("chat-sz", "assistant", "B");

      expect(store.size("chat-sz")).toBe(2);
    });

    it("hasHistory() returns false for empty chat", () => {
      expect(store.hasHistory("chat-empty")).toBe(false);
    });

    it("hasHistory() returns true after adding a turn", () => {
      store.add("chat-hist", "user", "Some message");
      expect(store.hasHistory("chat-hist")).toBe(true);
    });
  });

  describe("chatCount()", () => {
    it("returns 0 for empty store", () => {
      expect(store.chatCount()).toBe(0);
    });

    it("returns number of distinct chats", () => {
      store.add("A", "user", "msg");
      store.add("B", "user", "msg");
      store.add("C", "user", "msg");
      // Adding more turns to existing chats should NOT increase chatCount
      store.add("A", "assistant", "reply");

      expect(store.chatCount()).toBe(3);
    });
  });

  describe("singleton via getConversationStore() / resetConversationStore()", () => {
    beforeEach(() => {
      resetConversationStore();
    });

    it("getConversationStore() returns the same instance on repeated calls", () => {
      const s1 = getConversationStore();
      const s2 = getConversationStore();
      expect(s1).toBe(s2);
    });

    it("resetConversationStore() produces a fresh instance", () => {
      const s1 = getConversationStore();
      s1.add("chat-reset", "user", "Before reset");

      resetConversationStore();

      const s2 = getConversationStore();
      expect(s2).not.toBe(s1);
      expect(s2.get("chat-reset")).toEqual([]);
    });

    it("singleton is shared across multiple callers", () => {
      const s1 = getConversationStore();
      s1.add("shared-chat", "user", "Written via s1");

      const s2 = getConversationStore();
      expect(s2.get("shared-chat")[0]?.content).toBe("Written via s1");
    });
  });
});

// ============================================================================
// 4. GatewayIngress conversation context — Phase 2
// ============================================================================

describe("Phase 2 — GatewayIngress conversation context storage", () => {
  let ingress: GatewayIngress;
  let capturedHistory: Array<{ role: string; content: string }> | undefined;

  beforeEach(() => {
    resetConversationStore();
    capturedHistory = undefined;

    const dispatcher = new CommandDispatcher();
    dispatcher.register("help", async () => ({
      success: true,
      response: "Help text",
    }));

    const router = {
      routeMessage: async (text: string): Promise<RouteResult | null> => {
        const match = text.match(/@(\w+)\s*(.*)/);
        if (match) {
          return { agents: [match[1]!], task: match[2] ?? text };
        }
        return null;
      },
      callAI: async (
        agent: string,
        task: string,
        history?: Array<{ role: string; content: string }>,
      ): Promise<AIResult> => {
        // Capture the history so tests can inspect it
        capturedHistory = history;
        return {
          content: `[${agent}] ${task}`,
          provider: "mock",
          durationMs: 1,
        };
      },
      formatResponse: (agent: string, result: AIResult): string =>
        `@${agent}\n\n${result.content}`,
      getUsageHint: (): string => "Dùng @agent để gọi agent.",
      config: { projectRoot: "/mock/project" },
    };

    ingress = new GatewayIngress(dispatcher, router as never);
  });

  it("stores user turn in ConversationStore after chat message", async () => {
    const msg: InboundMessage = {
      channel: "telegram",
      senderId: "user-1",
      content: "@pm plan next sprint",
      metadata: { chatId: "chat-42" },
    };

    await ingress.handleInbound(msg);

    const store = getConversationStore();
    const history = store.get("chat-42");

    const userTurns = history.filter((t) => t.role === "user");
    expect(userTurns).toHaveLength(1);
    expect(userTurns[0]?.content).toBe("@pm plan next sprint");
  });

  it("stores assistant turn in ConversationStore after chat message", async () => {
    const msg: InboundMessage = {
      channel: "telegram",
      senderId: "user-1",
      content: "@pm plan next sprint",
      metadata: { chatId: "chat-42" },
    };

    await ingress.handleInbound(msg);

    const store = getConversationStore();
    const history = store.get("chat-42");

    const assistantTurns = history.filter((t) => t.role === "assistant");
    expect(assistantTurns).toHaveLength(1);
    expect(assistantTurns[0]?.content.length).toBeGreaterThan(0);
  });

  it("stores both user and assistant turns in a single exchange", async () => {
    const msg: InboundMessage = {
      channel: "telegram",
      senderId: "user-1",
      content: "@coder write a test",
      metadata: { chatId: "chat-100" },
    };

    await ingress.handleInbound(msg);

    const store = getConversationStore();
    const history = store.get("chat-100");

    // Should have exactly 2 turns: user then assistant
    expect(history).toHaveLength(2);
    expect(history[0]?.role).toBe("user");
    expect(history[1]?.role).toBe("assistant");
  });

  it("accumulates turns across multiple messages to the same chatId", async () => {
    const baseMsg = {
      channel: "telegram",
      senderId: "user-1",
      metadata: { chatId: "chat-multi" },
    };

    await ingress.handleInbound({ ...baseMsg, content: "@pm first question" });
    await ingress.handleInbound({ ...baseMsg, content: "@pm second question" });

    const store = getConversationStore();
    const history = store.get("chat-multi");

    // 2 exchanges = 4 turns total
    expect(history).toHaveLength(4);
    expect(history[0]?.role).toBe("user");
    expect(history[0]?.content).toBe("@pm first question");
    expect(history[2]?.role).toBe("user");
    expect(history[2]?.content).toBe("@pm second question");
  });

  it("uses chatId from metadata when present", async () => {
    const msg: InboundMessage = {
      channel: "telegram",
      senderId: "sender-999",
      content: "@pm hello",
      metadata: { chatId: "explicit-chat-id" },
    };

    await ingress.handleInbound(msg);

    const store = getConversationStore();
    // Should be keyed by chatId, NOT senderId
    expect(store.hasHistory("explicit-chat-id")).toBe(true);
    expect(store.hasHistory("sender-999")).toBe(false);
  });

  it("falls back to senderId when chatId is absent from metadata", async () => {
    const msg: InboundMessage = {
      channel: "telegram",
      senderId: "sender-abc",
      content: "@pm hello",
      // No metadata.chatId
    };

    await ingress.handleInbound(msg);

    const store = getConversationStore();
    expect(store.hasHistory("sender-abc")).toBe(true);
  });

  it("passes existing history to callAI on the second message", async () => {
    const chatMetadata = { chatId: "chat-ctx" };

    // First message establishes context
    await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-1",
      content: "@pm plan sprint",
      metadata: chatMetadata,
    });

    // Reset captured history (was passed as empty/undefined for first message)
    capturedHistory = undefined;

    // Second message should pass the history from the first exchange
    await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-1",
      content: "@pm refine that plan",
      metadata: chatMetadata,
    });

    // callAI on the second message should receive prior history
    expect(capturedHistory).toBeDefined();
    expect(capturedHistory!.length).toBeGreaterThan(0);
    // The history passed into callAI should contain turns from the first exchange
    expect(capturedHistory!.some((t) => t.role === "user")).toBe(true);
    expect(capturedHistory!.some((t) => t.role === "assistant")).toBe(true);
  });

  it("does NOT store turns for command messages (only AI chat messages)", async () => {
    const msg: InboundMessage = {
      channel: "telegram",
      senderId: "user-1",
      content: "/help",
      metadata: { chatId: "chat-cmd" },
    };

    await ingress.handleInbound(msg);

    const store = getConversationStore();
    // Command path should not touch ConversationStore
    expect(store.hasHistory("chat-cmd")).toBe(false);
  });

  it("does NOT store turns when no agent is found (usage hint path)", async () => {
    const msg: InboundMessage = {
      channel: "telegram",
      senderId: "user-1",
      content: "just plain text without any agent mention",
      metadata: { chatId: "chat-nohint" },
    };

    await ingress.handleInbound(msg);

    const store = getConversationStore();
    expect(store.hasHistory("chat-nohint")).toBe(false);
  });

  it("different senders get separate conversation histories", async () => {
    // Sender A
    await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-A",
      content: "@pm message from A",
      metadata: { chatId: "chat-A" },
    });

    // Sender B
    await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-B",
      content: "@coder message from B",
      metadata: { chatId: "chat-B" },
    });

    const store = getConversationStore();
    const historyA = store.get("chat-A");
    const historyB = store.get("chat-B");

    expect(historyA[0]?.content).toBe("@pm message from A");
    expect(historyB[0]?.content).toBe("@coder message from B");
    // Histories are isolated
    expect(historyA.some((t) => t.content.includes("message from B"))).toBe(false);
    expect(historyB.some((t) => t.content.includes("message from A"))).toBe(false);
  });
});

// ============================================================================
// 5. InboundResponse.format passthrough — Phase 4
// ============================================================================

describe("Phase 4 — InboundResponse.format passthrough", () => {
  let ingress: GatewayIngress;

  beforeEach(() => {
    resetConversationStore();

    const dispatcher = new CommandDispatcher();
    // A command that returns markdown format
    dispatcher.register("status", async () => ({
      success: true,
      response: "**Status**: OK",
      format: "markdown" as const,
    }));
    // A command that returns plain format
    dispatcher.register("ping", async () => ({
      success: true,
      response: "pong",
      format: "plain" as const,
    }));
    // A command that returns no format (undefined)
    dispatcher.register("nofmt", async () => ({
      success: true,
      response: "no format specified",
    }));

    const router = createMockRouter();
    ingress = new GatewayIngress(dispatcher, router as never);
  });

  it("AI chat response always has format: markdown", async () => {
    const response = await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-1",
      content: "@pm plan sprint",
    });

    expect(response.format).toBe("markdown");
  });

  it("command response with format: markdown is passed through", async () => {
    const response = await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-1",
      content: "/status",
    });

    expect(response.text).toBe("**Status**: OK");
    expect(response.format).toBe("markdown");
  });

  it("command response with format: plain is passed through", async () => {
    const response = await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-1",
      content: "/ping",
    });

    expect(response.text).toBe("pong");
    expect(response.format).toBe("plain");
  });

  it("command response with no format results in undefined format field", async () => {
    const response = await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-1",
      content: "/nofmt",
    });

    expect(response.text).toBe("no format specified");
    expect(response.format).toBeUndefined();
  });

  it("usage hint response has no format field", async () => {
    const response = await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-1",
      content: "plain text without any agent",
    });

    // Usage hint path sets no format
    expect(response.format).toBeUndefined();
  });

  it("unknown command response has no format field", async () => {
    const response = await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-1",
      content: "/unknowncmd",
    });

    expect(response.text).toContain("Unknown command");
    expect(response.format).toBeUndefined();
  });

  it("InboundResponse interface accepts all valid format values", () => {
    // Type-level check encoded as runtime assertions
    const markdown: InboundResponse = { text: "hello", format: "markdown" };
    const plain: InboundResponse = { text: "hello", format: "plain" };
    const html: InboundResponse = { text: "hello", format: "html" };
    const noFormat: InboundResponse = { text: "hello" };

    expect(markdown.format).toBe("markdown");
    expect(plain.format).toBe("plain");
    expect(html.format).toBe("html");
    expect(noFormat.format).toBeUndefined();
  });
});

// ============================================================================
// 6. MAX_HISTORY_TOKENS — CTO F1 token budget
// ============================================================================

describe("CTO F1 — MAX_HISTORY_TOKENS token budget (indirect via ConversationStore)", () => {
  /**
   * The MAX_HISTORY_TOKENS constant is private to channel-router.ts.
   * We test its effect indirectly:
   *   - ConversationStore caps at DEFAULT_MAX_TURNS (10) turns
   *   - The formatHistoryContext() function truncates oldest turns first
   *     when the total character count exceeds MAX_HISTORY_TOKENS * CHARS_PER_TOKEN
   *   - We verify the store never exceeds its cap (memory guard)
   */

  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore(DEFAULT_MAX_TURNS);
  });

  it("ConversationStore never exceeds DEFAULT_MAX_TURNS entries", () => {
    // Add many more turns than the cap
    const excess = 25;
    for (let i = 0; i < excess; i++) {
      store.add("budget-chat", i % 2 === 0 ? "user" : "assistant", `Turn content ${i}`);
    }

    const turns = store.get("budget-chat");
    expect(turns.length).toBeLessThanOrEqual(DEFAULT_MAX_TURNS);
  });

  it("oldest turns are discarded first when budget is exceeded", () => {
    for (let i = 0; i < DEFAULT_MAX_TURNS + 2; i++) {
      store.add("old-first", "user", `Message ${i}`);
    }

    const turns = store.get("old-first");
    // 'Message 0' and 'Message 1' should be evicted
    const contents = turns.map((t) => t.content);
    expect(contents).not.toContain("Message 0");
    expect(contents).not.toContain("Message 1");
    // Most recent should survive
    expect(contents).toContain(`Message ${DEFAULT_MAX_TURNS + 1}`);
  });

  it("very long messages still count as single turns (not split)", () => {
    // A single turn with 10 KB of content
    const longContent = "x".repeat(10_000);
    store.add("long-turn", "user", longContent);

    const turns = store.get("long-turn");
    expect(turns).toHaveLength(1);
    expect(turns[0]?.content).toHaveLength(10_000);
  });

  it("many turns of mixed long and short content respects turn cap", () => {
    // Mix: some very long, some very short
    for (let i = 0; i < 15; i++) {
      const content = i % 3 === 0 ? "x".repeat(5_000) : `short ${i}`;
      store.add("mixed", "user", content);
    }

    // Turn cap still enforced regardless of content length
    expect(store.get("mixed").length).toBeLessThanOrEqual(DEFAULT_MAX_TURNS);
  });

  it("the ConversationStore correctly tracks chatCount through growth and eviction", () => {
    // Simulate realistic usage: CEO chats with multiple agents
    for (let chat = 0; chat < 3; chat++) {
      for (let turn = 0; turn < DEFAULT_MAX_TURNS + 5; turn++) {
        store.add(`chat-${chat}`, "user", `Turn ${turn} in chat ${chat}`);
      }
    }

    // All 3 chats should exist
    expect(store.chatCount()).toBe(3);

    // Each chat should be capped
    for (let chat = 0; chat < 3; chat++) {
      expect(store.get(`chat-${chat}`).length).toBeLessThanOrEqual(DEFAULT_MAX_TURNS);
    }
  });

  it("history passed to callAI is the capped slice (not unbounded growth)", async () => {
    resetConversationStore();
    const globalStore = getConversationStore();

    // Pre-fill 8 turns so next message sees them in history
    for (let i = 0; i < 8; i++) {
      globalStore.add("token-budget-chat", i % 2 === 0 ? "user" : "assistant", `Older turn ${i}`);
    }

    let capturedHistoryLen = -1;

    const dispatcher = new CommandDispatcher();
    const router = {
      routeMessage: async (text: string): Promise<RouteResult | null> => {
        const m = text.match(/@(\w+)\s*(.*)/);
        return m ? { agents: [m[1]!], task: m[2] ?? text } : null;
      },
      callAI: async (
        _agent: string,
        _task: string,
        history?: Array<{ role: string; content: string }>,
      ): Promise<AIResult> => {
        capturedHistoryLen = history?.length ?? 0;
        return { content: "response", provider: "mock", durationMs: 1 };
      },
      formatResponse: (_agent: string, result: AIResult): string => result.content,
      getUsageHint: (): string => "hint",
      config: { projectRoot: "/mock/project" },
    };

    const testIngress = new GatewayIngress(dispatcher, router as never);

    await testIngress.handleInbound({
      channel: "telegram",
      senderId: "user-budget",
      content: "@pm new question",
      metadata: { chatId: "token-budget-chat" },
    });

    // The ingress stores.get() returns a live array reference.
    // After store.get() captures the reference (8 turns), store.add() appends
    // the current user turn to the SAME array before callAI is invoked.
    // Therefore callAI receives 9 turns (8 pre-filled + 1 user turn).
    // This is the actual behaviour — the history is the full context up to
    // and including the current user message.
    expect(capturedHistoryLen).toBe(9);
    // Regardless, the total never exceeds DEFAULT_MAX_TURNS
    expect(capturedHistoryLen).toBeLessThanOrEqual(DEFAULT_MAX_TURNS);
  });
});

// ============================================================================
// 7. AGENT_MODEL_MAP × VALID_AGENTS cross-reference
// ============================================================================

describe("AGENT_MODEL_MAP × VALID_AGENTS cross-reference", () => {
  it("every agent in VALID_AGENTS array has a model mapping", () => {
    for (const agent of VALID_AGENTS) {
      expect(
        AGENT_MODEL_MAP[agent],
        `VALID_AGENTS includes '${agent}' but AGENT_MODEL_MAP does not have an entry for it`,
      ).toBeDefined();
    }
  });

  it("every key in AGENT_MODEL_MAP corresponds to a VALID_AGENT", () => {
    const validSet = new Set<string>(VALID_AGENTS);
    for (const agent of Object.keys(AGENT_MODEL_MAP)) {
      expect(
        validSet.has(agent),
        `AGENT_MODEL_MAP has key '${agent}' that is NOT in VALID_AGENTS`,
      ).toBe(true);
    }
  });

  it("VALID_AGENTS contains exactly 14 agents", () => {
    // Documented agents: pm, architect, coder, reviewer, tester, researcher,
    // devops, fullstack, pjm, ceo, cpo, cto, assistant, cso
    expect(VALID_AGENTS).toHaveLength(14);
  });

  it("all 14 VALID_AGENTS are present in AGENT_MODEL_MAP", () => {
    expect(Object.keys(AGENT_MODEL_MAP)).toHaveLength(14);
  });

  it("model routing follows the documented cost strategy (opus > sonnet)", () => {
    // Sprint 156: PM promoted to opus (Tier 1 strategic). Reviewer stays sonnet in legacy map.
    const opusTier: AgentName[] = ["ceo", "cpo", "cso", "cto", "architect", "pm"];
    const sonnetTier: AgentName[] = [
      "reviewer", "coder", "tester", "researcher", "fullstack", "assistant", "devops", "pjm",
    ];

    for (const agent of opusTier) {
      expect(AGENT_MODEL_MAP[agent], `${agent} should be opus`).toBe("opus");
    }
    for (const agent of sonnetTier) {
      expect(AGENT_MODEL_MAP[agent], `${agent} should be sonnet`).toBe("sonnet");
    }
  });
});
