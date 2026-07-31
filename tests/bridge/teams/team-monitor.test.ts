/**
 * Team Monitor Tests — Sprint 91 (ADR-026)
 *
 * Covers: getTeamSessions, checkMemberHealth, estimateSessionCost,
 * getTeamStatus, formatTeamDashboard.
 *
 * @module tests/bridge/teams/team-monitor
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getTeamSessions,
  checkMemberHealth,
  estimateSessionCost,
  getTeamStatus,
  formatTeamDashboard,
  ESTIMATED_TOKENS_PER_MINUTE,
  type TeamStatus,
} from "../../../src/bridge/teams/team-monitor.js";

// ============================================================================
// Helpers
// ============================================================================

function makeSession(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "bridge_12345_abc",
    agentType: "claude-code" as const,
    tmuxTarget: "endiorbot:claudecode.0",
    tmuxSessionName: "endiorbot",
    projectPath: "/tmp/project",
    workspaceFingerprint: "abc123",
    status: "active" as const,
    riskMode: "read" as const,
    createdAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 min ago
    lastActivityAt: now.toISOString(),
    ...overrides,
  };
}

function makeMockRegistry(sessions: ReturnType<typeof makeSession>[] = []) {
  return {
    getAll: vi.fn().mockReturnValue(sessions),
    getActive: vi.fn().mockReturnValue(sessions.filter((s) => s.status === "active")),
    get: vi.fn((id: string) => sessions.find((s) => s.id === id)),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    markStopped: vi.fn(),
    markError: vi.fn(),
  };
}

function makeMockTmux() {
  return {
    isAvailable: vi.fn().mockResolvedValue("tmux 3.3a"),
    createSession: vi.fn(),
    sendKeys: vi.fn(),
    sendEnter: vi.fn(),
    capturePane: vi.fn().mockResolvedValue("some output"),
    killWindow: vi.fn(),
    listWindows: vi.fn(),
    sessionExists: vi.fn(),
  };
}

function makeMockPricing() {
  return {
    calculateCost: vi.fn().mockImplementation(
      (_model: string, inputTokens: number, outputTokens: number) => {
        // Sonnet pricing: $0.003/$0.015 per 1k
        return (inputTokens / 1000) * 0.003 + (outputTokens / 1000) * 0.015;
      },
    ),
    getPricingOrDefault: vi.fn(),
    listModels: vi.fn(),
    isStale: vi.fn(),
  };
}

const DEFAULT_POLICY = {
  allowedAgentTypes: ["claude-code"],
  maxSessionsPerAgent: 2,
  maxTotalSessions: 6,
  telegramRateLimit: { commandsPerMinute: 20, sendKeysPerMinute: 10 },
  perSessionSendKeysInterval: 3000,
  sendKeysMaxLength: 500,
  captureRedactPatterns: [],
  shellPanesDisabled: true,
  shellSessionsPerRepo: 1,
  maxShellSessions: 3,
  shellActorAllowlist: [],
  teamCostThresholdUsd: 5.0,
  teamStuckIdleThresholdSec: 180,
};

// ============================================================================
// Tests
// ============================================================================

describe("TeamMonitor — getTeamSessions (Sprint 91)", () => {
  it("should find sessions by teamId", () => {
    const sessions = [
      makeSession({ id: "s1", teamId: "dev", agentRole: "coder" }),
      makeSession({ id: "s2", teamId: "dev", agentRole: "reviewer" }),
      makeSession({ id: "s3", teamId: "qa", agentRole: "tester" }),
    ];
    const registry = makeMockRegistry(sessions);

    const result = getTeamSessions("dev", registry as never);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("should return empty for unknown teamId", () => {
    const registry = makeMockRegistry([
      makeSession({ teamId: "dev" }),
    ]);

    const result = getTeamSessions("unknown", registry as never);
    expect(result).toHaveLength(0);
  });
});

describe("TeamMonitor — checkMemberHealth (Sprint 91)", () => {
  let tmux: ReturnType<typeof makeMockTmux>;

  beforeEach(() => {
    tmux = makeMockTmux();
  });

  it("should classify as alive when pane responds and not idle", async () => {
    const session = makeSession({ lastActivityAt: new Date().toISOString() });

    const result = await checkMemberHealth(session as never, tmux as never, 180);
    expect(result.health).toBe("alive");
    expect(result.idleSeconds).toBeLessThan(5);
  });

  it("should classify as stuck when idle > threshold", async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const session = makeSession({ lastActivityAt: fiveMinAgo });

    const result = await checkMemberHealth(session as never, tmux as never, 180);
    expect(result.health).toBe("stuck");
    expect(result.idleSeconds).toBeGreaterThan(180);
  });

  it("should classify as crashed when capturePane throws", async () => {
    tmux.capturePane.mockRejectedValue(new Error("pane not found"));
    const session = makeSession();

    const result = await checkMemberHealth(session as never, tmux as never, 180);
    expect(result.health).toBe("crashed");
    expect(result.idleSeconds).toBe(0);
  });
});

describe("TeamMonitor — estimateSessionCost (Sprint 91)", () => {
  it("should estimate cost based on duration and sonnet pricing", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const session = makeSession({ createdAt: tenMinAgo });
    const pricing = makeMockPricing();

    const cost = estimateSessionCost(session as never, pricing as never);

    // 10 min * 500 input/min = 5000 input tokens
    // 10 min * 200 output/min = 2000 output tokens
    // Sonnet: (5000/1000)*0.003 + (2000/1000)*0.015 = 0.015 + 0.030 = 0.045
    expect(cost).toBeCloseTo(0.045, 2);
    expect(pricing.calculateCost).toHaveBeenCalledWith(
      "claude-sonnet-5",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("should return ~0 for zero-duration session", () => {
    const session = makeSession({ createdAt: new Date().toISOString() });
    const pricing = makeMockPricing();

    const cost = estimateSessionCost(session as never, pricing as never);
    expect(cost).toBeLessThan(0.001);
  });
});

describe("TeamMonitor — getTeamStatus (Sprint 91)", () => {
  it("should aggregate all members with total cost", async () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const sessions = [
      makeSession({ id: "s1", teamId: "dev", agentRole: "coder", createdAt: tenMinAgo }),
      makeSession({ id: "s2", teamId: "dev", agentRole: "reviewer", createdAt: tenMinAgo }),
    ];
    const registry = makeMockRegistry(sessions);
    const tmux = makeMockTmux();
    const pricing = makeMockPricing();

    const status = await getTeamStatus("dev", {
      registry: registry as never,
      tmux: tmux as never,
      policy: DEFAULT_POLICY as never,
      pricingRegistry: pricing as never,
    });

    expect(status.teamId).toBe("dev");
    expect(status.members).toHaveLength(2);
    expect(status.totalCostUsd).toBeGreaterThan(0);
    expect(status.thresholdUsd).toBe(5.0);
  });

  it("should flag threshold exceeded when total > policy limit", async () => {
    // Create session 100 min ago → high cost
    const longAgo = new Date(Date.now() - 100 * 60 * 1000).toISOString();
    const sessions = [
      makeSession({ id: "s1", teamId: "dev", agentRole: "coder", createdAt: longAgo }),
      makeSession({ id: "s2", teamId: "dev", agentRole: "reviewer", createdAt: longAgo }),
      makeSession({ id: "s3", teamId: "dev", agentRole: "architect", createdAt: longAgo }),
    ];
    const registry = makeMockRegistry(sessions);
    const tmux = makeMockTmux();
    const pricing = makeMockPricing();

    const status = await getTeamStatus("dev", {
      registry: registry as never,
      tmux: tmux as never,
      policy: { ...DEFAULT_POLICY, teamCostThresholdUsd: 0.01 } as never,
      pricingRegistry: pricing as never,
    });

    expect(status.thresholdExceeded).toBe(true);
  });

  it("should use override threshold when provided", async () => {
    const sessions = [
      makeSession({ id: "s1", teamId: "dev", agentRole: "coder" }),
    ];
    const registry = makeMockRegistry(sessions);
    const tmux = makeMockTmux();
    const pricing = makeMockPricing();

    const status = await getTeamStatus("dev", {
      registry: registry as never,
      tmux: tmux as never,
      policy: DEFAULT_POLICY as never,
      pricingRegistry: pricing as never,
      thresholdOverride: 10.0,
    });

    expect(status.thresholdUsd).toBe(10.0);
  });

  it("should sort leader first", async () => {
    const sessions = [
      makeSession({ id: "s1", teamId: "dev", agentRole: "reviewer" }),
      makeSession({ id: "s2", teamId: "dev", agentRole: "coder" }),
    ];
    const registry = makeMockRegistry(sessions);
    const tmux = makeMockTmux();
    const pricing = makeMockPricing();

    const status = await getTeamStatus("dev", {
      registry: registry as never,
      tmux: tmux as never,
      policy: DEFAULT_POLICY as never,
      pricingRegistry: pricing as never,
    });

    // coder is the leader of dev team
    expect(status.members[0]!.agentRole).toBe("coder");
    expect(status.members[0]!.isLeader).toBe(true);
  });
});

describe("TeamMonitor — formatTeamDashboard (Sprint 91)", () => {
  it("should render multi-member dashboard", () => {
    const status: TeamStatus = {
      teamId: "dev",
      members: [
        { sessionId: "s1", agentRole: "coder", health: "alive", estimatedCostUsd: 0.42, idleSeconds: 5, isLeader: true },
        { sessionId: "s2", agentRole: "reviewer", health: "alive", estimatedCostUsd: 0.18, idleSeconds: 10, isLeader: false },
      ],
      totalCostUsd: 0.60,
      thresholdUsd: 5.0,
      thresholdExceeded: false,
    };

    const dashboard = formatTeamDashboard(status);
    expect(dashboard).toContain("dev-team");
    expect(dashboard).toContain("@coder (leader)");
    expect(dashboard).toContain("@reviewer");
    expect(dashboard).toContain("est. $0.42");
    expect(dashboard).toContain("$5.00 limit");
  });

  it("should show idle time for stuck members", () => {
    const status: TeamStatus = {
      teamId: "dev",
      members: [
        { sessionId: "s1", agentRole: "architect", health: "stuck", estimatedCostUsd: 0.31, idleSeconds: 252, isLeader: false },
      ],
      totalCostUsd: 0.31,
      thresholdUsd: 5.0,
      thresholdExceeded: false,
    };

    const dashboard = formatTeamDashboard(status);
    expect(dashboard).toContain("stuck");
    expect(dashboard).toContain("idle 4m 12s");
  });

  it("should show EXCEEDED when threshold exceeded", () => {
    const status: TeamStatus = {
      teamId: "dev",
      members: [
        { sessionId: "s1", agentRole: "coder", health: "alive", estimatedCostUsd: 6.0, idleSeconds: 0, isLeader: true },
      ],
      totalCostUsd: 6.0,
      thresholdUsd: 5.0,
      thresholdExceeded: true,
    };

    const dashboard = formatTeamDashboard(status);
    expect(dashboard).toContain("EXCEEDED");
  });

  it("should handle empty team", () => {
    const status: TeamStatus = {
      teamId: "dev",
      members: [],
      totalCostUsd: 0,
      thresholdUsd: 5.0,
      thresholdExceeded: false,
    };

    const dashboard = formatTeamDashboard(status);
    expect(dashboard).toContain("No active team members found");
  });
});

describe("TeamMonitor — Constants (Sprint 91)", () => {
  it("should export ESTIMATED_TOKENS_PER_MINUTE", () => {
    expect(ESTIMATED_TOKENS_PER_MINUTE.input).toBe(500);
    expect(ESTIMATED_TOKENS_PER_MINUTE.output).toBe(200);
  });
});
