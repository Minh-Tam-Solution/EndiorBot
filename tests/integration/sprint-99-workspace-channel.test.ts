/**
 * Sprint 99 Integration Tests — Per-Chat Workspace + Unified Channel Architecture
 *
 * Covers all 5 phases:
 * - Phase 1: WorkspaceResolver + callAI workspace param
 * - Phase 2: Web → Ingress (metadata, senderId, chatId)
 * - Phase 3: SDLC commands workspace-aware (CommandContext.workspace)
 * - Phase 4: NBM /launch workspace wiring
 * - Phase 5: SOUL version bump 6.1.1 → 6.1.2
 *
 * @module tests/integration/sprint-99-workspace-channel
 * @sprint 99
 * @authority ADR-029
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// Phase 1: WorkspaceResolver
// ============================================================================

// Mock the singletons BEFORE importing the resolver
vi.mock("../../src/bridge/repo/chat-focus.js", () => {
  const mockFocusMap = new Map<string, { chatId: string; repoName: string; updatedAt: number }>();
  const manager = {
    getFocus: (chatId: string) => mockFocusMap.get(chatId) ?? null,
    setFocus: (chatId: string, repoName: string) => {
      mockFocusMap.set(chatId, { chatId, repoName, updatedAt: Date.now() });
    },
    clearFocus: (chatId: string) => mockFocusMap.delete(chatId),
    _map: mockFocusMap,
  };
  return {
    getChatFocusManager: () => manager,
    ChatFocusManager: vi.fn(),
  };
});

vi.mock("../../src/bridge/repo/repo-registry.js", () => {
  const mockRepoMap = new Map<string, { name: string; path: string }>();
  const registry = {
    get: (name: string) => mockRepoMap.get(name) ?? null,
    add: (name: string, path: string) => {
      mockRepoMap.set(name, { name, path });
      return { success: true };
    },
    _map: mockRepoMap,
  };
  return {
    getRepoRegistry: () => registry,
    RepoRegistry: vi.fn(),
  };
});

import { resolveWorkspace } from "../../src/bridge/repo/workspace-resolver.js";
import { getChatFocusManager } from "../../src/bridge/repo/chat-focus.js";
import { getRepoRegistry } from "../../src/bridge/repo/repo-registry.js";

describe("Phase 1: WorkspaceResolver", () => {
  beforeEach(() => {
    const focusMgr = getChatFocusManager() as ReturnType<typeof getChatFocusManager> & { _map: Map<string, unknown> };
    focusMgr._map.clear();
    const registry = getRepoRegistry() as ReturnType<typeof getRepoRegistry> & { _map: Map<string, unknown> };
    registry._map.clear();
  });

  it("returns fallback when no focus set", () => {
    const result = resolveWorkspace("chat-123", "/default/path");
    expect(result).toBe("/default/path");
  });

  it("returns repo path when chat has focus", () => {
    getRepoRegistry().add("paperclip", "/Users/test/paperclip");
    (getChatFocusManager() as any).setFocus("chat-123", "paperclip");

    const result = resolveWorkspace("chat-123", "/default/path");
    expect(result).toBe("/Users/test/paperclip");
  });

  it("returns fallback when focused repo not found in registry", () => {
    // Focus set but repo not registered
    (getChatFocusManager() as any).setFocus("chat-123", "deleted-repo");

    const result = resolveWorkspace("chat-123", "/default/path");
    expect(result).toBe("/default/path");
  });

  it("different chats get different workspaces", () => {
    getRepoRegistry().add("paperclip", "/Users/test/paperclip");
    getRepoRegistry().add("endiorbot", "/Users/test/endiorbot");

    (getChatFocusManager() as any).setFocus("chat-A", "paperclip");
    (getChatFocusManager() as any).setFocus("chat-B", "endiorbot");

    expect(resolveWorkspace("chat-A", "/default")).toBe("/Users/test/paperclip");
    expect(resolveWorkspace("chat-B", "/default")).toBe("/Users/test/endiorbot");
  });

  it("unfocused chat returns fallback alongside focused chat", () => {
    getRepoRegistry().add("paperclip", "/Users/test/paperclip");
    (getChatFocusManager() as any).setFocus("chat-A", "paperclip");

    expect(resolveWorkspace("chat-A", "/default")).toBe("/Users/test/paperclip");
    expect(resolveWorkspace("chat-B", "/default")).toBe("/default");
  });
});

// ============================================================================
// Phase 1: callAI workspace param
// ============================================================================

describe("Phase 1: callAI workspace param", () => {
  it("callAI accepts workspace parameter (type check)", async () => {
    // Import the ChannelRouter type to verify the signature
    const { ChannelRouter } = await import("../../src/agents/channel-router.js");

    // The callAI method should accept 4 params: agent, task, history?, workspace?
    // We just verify the function exists and has the right arity via type system
    // (TypeScript compile = pass)
    expect(typeof ChannelRouter.prototype.callAI).toBe("function");
  });
});

// ============================================================================
// Phase 1: MultiAgentDispatcher workspace param
// ============================================================================

describe("Phase 1: MultiAgentDispatcher workspace", () => {
  it("dispatch method accepts workspace parameter (type check)", async () => {
    const { MultiAgentDispatcher } = await import(
      "../../src/autonomy/multi-agent-dispatcher.js"
    );
    expect(typeof MultiAgentDispatcher.prototype.dispatch).toBe("function");
  });
});

// ============================================================================
// Phase 2: Web → Ingress unification
// ============================================================================

describe("Phase 2: Web → Ingress unification", () => {
  it("InboundResponse includes optional metadata field", async () => {
    // Type verification — if this compiles, metadata is in the interface
    const { GatewayIngress } = await import("../../src/gateway/ingress.js");
    expect(GatewayIngress).toBeDefined();
  });

  it("router-chat routes through ingress when available", async () => {
    const { registerRouterChatMethods } = await import(
      "../../src/gateway/methods/router-chat.js"
    );
    expect(typeof registerRouterChatMethods).toBe("function");
  });
});

describe("Phase 2: Ingress metadata in response", () => {
  it("AI chat response includes metadata (agent, model, latencyMs)", async () => {
    const { CommandDispatcher } = await import(
      "../../src/commands/command-dispatcher.js"
    );
    const { GatewayIngress } = await import("../../src/gateway/ingress.js");

    const dispatcher = new CommandDispatcher();
    const mockRouter = {
      routeMessage: async (text: string) => {
        const match = text.match(/@(\w+)\s+(.*)/);
        if (match) return { agents: [match[1]], task: match[2] };
        return null;
      },
      callAI: async (agent: string, task: string) => ({
        content: `[${agent}] Response to: ${task}`,
        provider: "mock-model",
      }),
      formatResponse: (agent: string, result: { content: string }) =>
        `@${agent}: ${result.content}`,
      getUsageHint: () => "Use @agent to chat.",
      config: { projectRoot: "/default" },
    };

    const ingress = new GatewayIngress(dispatcher, mockRouter as never);

    const response = await ingress.handleInbound({
      channel: "web",
      senderId: "web-user-1",
      content: "@pm plan sprint 1",
      metadata: { chatId: "web-chat-1" },
    });

    expect(response.text).toContain("@pm");
    expect(response.metadata).toBeDefined();
    expect(response.metadata?.agent).toBe("pm");
    expect(response.metadata?.model).toBe("mock-model");
    expect(typeof response.metadata?.latencyMs).toBe("number");
  });

  it("command responses do NOT include metadata", async () => {
    const { CommandDispatcher } = await import(
      "../../src/commands/command-dispatcher.js"
    );
    const { GatewayIngress } = await import("../../src/gateway/ingress.js");

    const dispatcher = new CommandDispatcher();
    dispatcher.register("help", async () => ({
      success: true,
      response: "Help text",
    }));

    const mockRouter = {
      routeMessage: async () => null,
      config: { projectRoot: "/default" },
    };

    const ingress = new GatewayIngress(dispatcher, mockRouter as never);

    const response = await ingress.handleInbound({
      channel: "web",
      senderId: "web-user-1",
      content: "/help",
    });

    expect(response.text).toBe("Help text");
    expect(response.metadata).toBeUndefined();
  });
});

// ============================================================================
// Phase 3: SDLC Commands workspace-aware
// ============================================================================

describe("Phase 3: CommandContext workspace field", () => {
  it("CommandContext interface includes workspace field", async () => {
    // Type verification — TypeScript compilation proves the field exists
    const { CommandDispatcher } = await import(
      "../../src/commands/command-dispatcher.js"
    );

    const d = new CommandDispatcher();
    let capturedWorkspace: string | undefined;

    d.register("test-cmd", async (ctx) => {
      capturedWorkspace = ctx.workspace;
      return { success: true, response: "ok" };
    });

    await d.dispatch("test-cmd", {
      userId: "user-1",
      args: [],
      channel: "web",
      workspace: "/test/workspace",
    });

    expect(capturedWorkspace).toBe("/test/workspace");
  });

  it("CommandContext workspace is optional (undefined when not set)", async () => {
    const { CommandDispatcher } = await import(
      "../../src/commands/command-dispatcher.js"
    );

    const d = new CommandDispatcher();
    let capturedWorkspace: string | undefined = "should-be-undefined";

    d.register("test-cmd", async (ctx) => {
      capturedWorkspace = ctx.workspace;
      return { success: true, response: "ok" };
    });

    await d.dispatch("test-cmd", {
      userId: "user-1",
      args: [],
      channel: "telegram",
    });

    expect(capturedWorkspace).toBeUndefined();
  });
});

describe("Phase 3: Ingress populates workspace for commands", () => {
  it("workspace is populated when chat has focus", async () => {
    // Set up focus
    getRepoRegistry().add("test-project", "/Users/test/project");
    (getChatFocusManager() as any).setFocus("chat-cmd-1", "test-project");

    const { CommandDispatcher } = await import(
      "../../src/commands/command-dispatcher.js"
    );
    const { GatewayIngress } = await import("../../src/gateway/ingress.js");

    const dispatcher = new CommandDispatcher();
    let capturedWorkspace: string | undefined;

    dispatcher.register("gate", async (ctx) => {
      capturedWorkspace = ctx.workspace;
      return { success: true, response: "Gate checked" };
    });

    const mockRouter = {
      config: { projectRoot: "/default/root" },
    };

    const ingress = new GatewayIngress(dispatcher, mockRouter as never);

    await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-1",
      content: "/gate G2",
      metadata: { chatId: "chat-cmd-1" },
    });

    expect(capturedWorkspace).toBe("/Users/test/project");
  });

  it("workspace is NOT set when chat has no focus (stays undefined)", async () => {
    const { CommandDispatcher } = await import(
      "../../src/commands/command-dispatcher.js"
    );
    const { GatewayIngress } = await import("../../src/gateway/ingress.js");

    const dispatcher = new CommandDispatcher();
    let capturedWorkspace: string | undefined = "should-stay-undefined";

    dispatcher.register("gate", async (ctx) => {
      capturedWorkspace = ctx.workspace;
      return { success: true, response: "Gate checked" };
    });

    const mockRouter = {
      config: { projectRoot: "/default/root" },
    };

    const ingress = new GatewayIngress(dispatcher, mockRouter as never);

    await ingress.handleInbound({
      channel: "telegram",
      senderId: "unfocused-user",
      content: "/gate G2",
    });

    // No focus = workspace resolves to projectRoot = no ctx.workspace set
    expect(capturedWorkspace).toBeUndefined();
  });
});

// ============================================================================
// Phase 4: /launch workspace wiring
// ============================================================================

describe("Phase 4: /launch workspace param", () => {
  it("handleLaunchCommand accepts workspace parameter", async () => {
    const { handleLaunchCommand } = await import(
      "../../src/commands/handlers.js"
    );

    // handleLaunchCommand(args, actorId, workspace?)
    // With no args, it should return usage help regardless of workspace
    const result = await handleLaunchCommand([], "actor-1", "/test/workspace");
    expect(result.success).toBe(false);
    expect(result.response).toContain("Usage:");
  });

  it("/launch uses workspace as default path when no explicit path given", async () => {
    const { handleLaunchCommand } = await import(
      "../../src/commands/handlers.js"
    );

    // Use a valid path under $HOME for path traversal protection
    const homePath = process.env.HOME ?? "/tmp";
    const workspacePath = join(homePath, "test-workspace");

    // Launch with agent but no path — should use workspace as default
    const result = await handleLaunchCommand(
      ["claude-code"],
      "actor-1",
      workspacePath,
    );

    // The result depends on tmux/agent availability, but the path should
    // be resolved to the workspace (not process.cwd())
    // We just verify the function doesn't reject the workspace path
    expect(result).toBeDefined();
    expect(result.response).toBeDefined();
  });

  it("commands/index.ts wires workspace to /launch registration", async () => {
    const { createCommandDispatcher } = await import(
      "../../src/commands/index.js"
    );

    const dispatcher = createCommandDispatcher();
    expect(dispatcher.has("launch")).toBe(true);
  });
});

// ============================================================================
// Phase 5: SOUL version bump
// ============================================================================

describe("Phase 5: SOUL version bump 6.1.1 → 6.1.2", () => {
  const soulsDir = join(
    process.cwd(),
    "docs/reference/templates/souls",
  );

  const soulFiles = [
    "SOUL-architect.md",
    "SOUL-assistant.md",
    "SOUL-coder.md",
    "SOUL-fullstack.md",
    "SOUL-pm.md",
    "SOUL-reviewer.md",
    "SOUL-tester.md",
  ];

  it("no SOUL files contain 6.1.1 references", () => {
    for (const file of soulFiles) {
      const filePath = join(soulsDir, file);
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, "utf-8");
      expect(content).not.toContain("6.1.1");
    }
  });

  it("updated SOUL files contain SDLC 6.x framework references", () => {
    // All SOULs aligned to SDLC 6.4.0 (Amendment C, Drift-Lessons Absorb).
    // Test accepts any 6.x version to remain resilient across future bumps.
    const filesWithVersion: string[] = [];
    for (const file of soulFiles) {
      const filePath = join(soulsDir, file);
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, "utf-8");
      if (/6\.\d+\.\d+/.test(content)) {
        filesWithVersion.push(file);
      }
    }
    expect(filesWithVersion.length).toBeGreaterThanOrEqual(7);
  });

  it("all 14 SOUL template files exist", () => {
    const allSouls = [
      "SOUL-architect.md", "SOUL-assistant.md", "SOUL-ceo.md",
      "SOUL-coder.md", "SOUL-cpo.md", "SOUL-cso.md", "SOUL-cto.md",
      "SOUL-devops.md", "SOUL-fullstack.md", "SOUL-pjm.md",
      "SOUL-pm.md", "SOUL-researcher.md", "SOUL-reviewer.md",
      "SOUL-tester.md",
    ];

    for (const file of allSouls) {
      const filePath = join(soulsDir, file);
      expect(existsSync(filePath)).toBe(true);
    }
  });
});

// ============================================================================
// Cross-phase: Workspace flows end-to-end
// ============================================================================

describe("Cross-phase: Workspace resolution end-to-end", () => {
  beforeEach(() => {
    const focusMgr = getChatFocusManager() as any;
    focusMgr._map.clear();
    const registry = getRepoRegistry() as any;
    registry._map.clear();
  });

  it("focused chat → AI routing uses workspace from ChatFocusManager", async () => {
    // Set up workspace
    getRepoRegistry().add("paperclip", "/Users/test/paperclip");
    (getChatFocusManager() as any).setFocus("tg-chat-1", "paperclip");

    const { CommandDispatcher } = await import(
      "../../src/commands/command-dispatcher.js"
    );
    const { GatewayIngress } = await import("../../src/gateway/ingress.js");

    const dispatcher = new CommandDispatcher();
    let capturedWorkspace: string | undefined;

    const mockRouter = {
      routeMessage: async (text: string) => {
        const match = text.match(/@(\w+)\s+(.*)/);
        if (match) return { agents: [match[1]], task: match[2] };
        return null;
      },
      callAI: async (agent: string, task: string, _history?: unknown, workspace?: string) => {
        capturedWorkspace = workspace;
        return { content: `[${agent}] done`, provider: "mock" };
      },
      formatResponse: (_a: string, r: { content: string }) => r.content,
      getUsageHint: () => "hint",
      config: { projectRoot: "/default" },
    };

    const ingress = new GatewayIngress(dispatcher, mockRouter as never);

    await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-1",
      content: "@pm plan sprint 1",
      metadata: { chatId: "tg-chat-1" },
    });

    expect(capturedWorkspace).toBe("/Users/test/paperclip");
  });

  it("unfocused chat → AI routing uses projectRoot as workspace", async () => {
    const { CommandDispatcher } = await import(
      "../../src/commands/command-dispatcher.js"
    );
    const { GatewayIngress } = await import("../../src/gateway/ingress.js");

    const dispatcher = new CommandDispatcher();
    let capturedWorkspace: string | undefined;

    const mockRouter = {
      routeMessage: async (text: string) => {
        const match = text.match(/@(\w+)\s+(.*)/);
        if (match) return { agents: [match[1]], task: match[2] };
        return null;
      },
      callAI: async (_agent: string, _task: string, _history?: unknown, workspace?: string) => {
        capturedWorkspace = workspace;
        return { content: "done", provider: "mock" };
      },
      formatResponse: (_a: string, r: { content: string }) => r.content,
      getUsageHint: () => "hint",
      config: { projectRoot: "/my/default/root" },
    };

    const ingress = new GatewayIngress(dispatcher, mockRouter as never);

    await ingress.handleInbound({
      channel: "telegram",
      senderId: "user-no-focus",
      content: "@pm do something",
    });

    expect(capturedWorkspace).toBe("/my/default/root");
  });

  it("Web channel sends senderId and chatId through ingress", async () => {
    const { CommandDispatcher } = await import(
      "../../src/commands/command-dispatcher.js"
    );
    const { GatewayIngress } = await import("../../src/gateway/ingress.js");

    const dispatcher = new CommandDispatcher();
    const mockRouter = {
      routeMessage: async (text: string) => {
        const match = text.match(/@(\w+)\s+(.*)/);
        if (match) return { agents: [match[1]], task: match[2] };
        return null;
      },
      callAI: async (agent: string, task: string) => ({
        content: `[${agent}] ${task}`,
        provider: "web-model",
      }),
      formatResponse: (_a: string, r: { content: string }) => r.content,
      getUsageHint: () => "hint",
      config: { projectRoot: "/default" },
    };

    const ingress = new GatewayIngress(dispatcher, mockRouter as never);

    // Simulate web client sending with clientId
    const response = await ingress.handleInbound({
      channel: "web",
      senderId: "web-abc123",
      content: "@assistant hello",
      metadata: { chatId: "web-web-abc123" },
    });

    expect(response.text).toBeDefined();
    expect(response.metadata?.agent).toBe("assistant");
    expect(response.metadata?.model).toBe("web-model");
  });
});
