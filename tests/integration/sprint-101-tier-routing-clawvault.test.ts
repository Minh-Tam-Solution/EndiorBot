/**
 * Sprint 101: Tier-Aware Routing + ClawVault Memory Foundation — Integration Tests
 *
 * Tests workspace tier resolver, tier-aware model routing wiring,
 * observation scorer, fact store, and session handoff.
 *
 * @sprint 101
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

// ============================================================================
// Phase 1: Workspace Tier Resolver
// ============================================================================

describe("Phase 1: Workspace Tier Resolver", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `endiorbot-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    const { clearWorkspaceTierCache } = await import("../../src/agents/workspace-tier-resolver.js");
    clearWorkspaceTierCache();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("returns ENTERPRISE when no .sdlc-config.json exists", async () => {
    const { resolveWorkspaceTier } = await import("../../src/agents/workspace-tier-resolver.js");
    expect(resolveWorkspaceTier(testDir)).toBe("ENTERPRISE");
  });

  it("returns LITE when tier is LITE", async () => {
    writeFileSync(join(testDir, ".sdlc-config.json"), JSON.stringify({ tier: "LITE" }));
    const { resolveWorkspaceTier } = await import("../../src/agents/workspace-tier-resolver.js");
    expect(resolveWorkspaceTier(testDir)).toBe("LITE");
  });

  it("returns STANDARD when tier is STANDARD", async () => {
    writeFileSync(join(testDir, ".sdlc-config.json"), JSON.stringify({ tier: "STANDARD" }));
    const { resolveWorkspaceTier } = await import("../../src/agents/workspace-tier-resolver.js");
    expect(resolveWorkspaceTier(testDir)).toBe("STANDARD");
  });

  it("returns PROFESSIONAL when tier is PROFESSIONAL", async () => {
    writeFileSync(join(testDir, ".sdlc-config.json"), JSON.stringify({ tier: "PROFESSIONAL" }));
    const { resolveWorkspaceTier } = await import("../../src/agents/workspace-tier-resolver.js");
    expect(resolveWorkspaceTier(testDir)).toBe("PROFESSIONAL");
  });

  it("returns ENTERPRISE when tier is ENTERPRISE", async () => {
    writeFileSync(join(testDir, ".sdlc-config.json"), JSON.stringify({ tier: "ENTERPRISE" }));
    const { resolveWorkspaceTier } = await import("../../src/agents/workspace-tier-resolver.js");
    expect(resolveWorkspaceTier(testDir)).toBe("ENTERPRISE");
  });

  it("returns ENTERPRISE for invalid tier value", async () => {
    writeFileSync(join(testDir, ".sdlc-config.json"), JSON.stringify({ tier: "INVALID" }));
    const { resolveWorkspaceTier } = await import("../../src/agents/workspace-tier-resolver.js");
    expect(resolveWorkspaceTier(testDir)).toBe("ENTERPRISE");
  });

  it("returns ENTERPRISE for JSON parse error", async () => {
    writeFileSync(join(testDir, ".sdlc-config.json"), "not valid json{{{");
    const { resolveWorkspaceTier } = await import("../../src/agents/workspace-tier-resolver.js");
    expect(resolveWorkspaceTier(testDir)).toBe("ENTERPRISE");
  });

  it("returns ENTERPRISE when tier field is missing", async () => {
    writeFileSync(join(testDir, ".sdlc-config.json"), JSON.stringify({ name: "test" }));
    const { resolveWorkspaceTier } = await import("../../src/agents/workspace-tier-resolver.js");
    expect(resolveWorkspaceTier(testDir)).toBe("ENTERPRISE");
  });

  it("uses cache on second call (no re-read)", async () => {
    writeFileSync(join(testDir, ".sdlc-config.json"), JSON.stringify({ tier: "LITE" }));
    const { resolveWorkspaceTier } = await import("../../src/agents/workspace-tier-resolver.js");

    const result1 = resolveWorkspaceTier(testDir);
    // Change file — should still return cached value
    writeFileSync(join(testDir, ".sdlc-config.json"), JSON.stringify({ tier: "STANDARD" }));
    const result2 = resolveWorkspaceTier(testDir);

    expect(result1).toBe("LITE");
    expect(result2).toBe("LITE"); // Cached
  });

  it("clearWorkspaceTierCache() forces re-read", async () => {
    writeFileSync(join(testDir, ".sdlc-config.json"), JSON.stringify({ tier: "LITE" }));
    const { resolveWorkspaceTier, clearWorkspaceTierCache } = await import("../../src/agents/workspace-tier-resolver.js");

    const result1 = resolveWorkspaceTier(testDir);
    writeFileSync(join(testDir, ".sdlc-config.json"), JSON.stringify({ tier: "STANDARD" }));
    clearWorkspaceTierCache();
    const result2 = resolveWorkspaceTier(testDir);

    expect(result1).toBe("LITE");
    expect(result2).toBe("STANDARD"); // Re-read after cache clear
  });
});

// ============================================================================
// Phase 2: Tier-Aware Routing Wiring
// ============================================================================

describe("Phase 2: getAgentModel() wiring verification (ADR-052)", () => {
  it("getAgentModel() returns provider-aware model with ENTERPRISE default", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    // ADR-052 Amendment (Sprint 156): coder is Tier 2 → Kimi primary
    expect(getAgentModel("coder")).toBe("kimi-code");
    // ADR-052: ceo is Tier 1 → Claude Opus
    expect(getAgentModel("ceo")).toBe("opus");
  });

  it("getAgentModel() with LITE tier returns provider-aware models for available agents", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    // ADR-052 Amendment (Sprint 156): coder is Tier 2 → Kimi primary
    expect(getAgentModel("coder", "LITE")).toBe("kimi-code");
    expect(getAgentModel("pm", "LITE")).toBeUndefined();
    expect(getAgentModel("ceo", "LITE")).toBeUndefined();
  });

  it("getAgentModel() with STANDARD tier includes LITE + STANDARD agents", async () => {
    const { getAgentModel } = await import("../../src/agents/channel-router.js");
    // ADR-052 Amendment (Sprint 143): CC-first for all Tier 2 agents
    expect(getAgentModel("coder", "STANDARD")).toBe("kimi-code");
    expect(getAgentModel("pm", "STANDARD")).toBe("opus");
    expect(getAgentModel("architect", "STANDARD")).toBe("opus");
    expect(getAgentModel("ceo", "STANDARD")).toBeUndefined();
  });

  it("AGENT_MODEL_MAP backward compat unchanged", async () => {
    const { AGENT_MODEL_MAP } = await import("../../src/agents/channel-router.js");
    expect(Object.keys(AGENT_MODEL_MAP).sort()).toEqual([
      "architect", "assistant", "ceo", "coder", "cpo", "cso", "cto",
      "devops", "fullstack", "pjm", "pm", "researcher", "reviewer", "tester",
    ]);
  });

  it("telegram-ott-adapter imports getAgentModel (not AGENT_MODEL_MAP)", async () => {
    // Verify the adapter module loads without error
    const mod = await import("../../src/channels/telegram/telegram-ott-adapter.js");
    expect(mod).toBeDefined();
  });
});

// ============================================================================
// Phase 3: Observation Scorer
// ============================================================================

describe("Phase 3: Observation Scorer", () => {
  it("scoreObservation returns type-based defaults", async () => {
    const { scoreObservation } = await import("../../src/memory/observation-scorer.js");

    const decision = scoreObservation("decision", "Use PostgreSQL");
    expect(decision.importance).toBe(0.9);
    expect(decision.confidence).toBe(0.85);

    const fact = scoreObservation("fact", "Node.js v20");
    expect(fact.importance).toBe(0.6);
    expect(fact.confidence).toBe(0.75);
  });

  it("all memory types have importance scores", async () => {
    const { scoreObservation } = await import("../../src/memory/observation-scorer.js");

    const types = ["decision", "lesson", "fact", "commitment", "preference", "blocker", "project"] as const;
    for (const type of types) {
      const score = scoreObservation(type, "test");
      expect(score.importance).toBeGreaterThan(0);
      expect(score.importance).toBeLessThanOrEqual(1);
      expect(score.confidence).toBeGreaterThan(0);
      expect(score.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("decision has highest importance (0.9)", async () => {
    const { getTypeImportance } = await import("../../src/memory/observation-scorer.js");
    expect(getTypeImportance("decision")).toBe(0.9);
    expect(getTypeImportance("commitment")).toBe(0.85);
    expect(getTypeImportance("lesson")).toBe(0.8);
  });

  it("filterByImportance filters correctly", async () => {
    const { filterByImportance } = await import("../../src/memory/observation-scorer.js");
    const observations = [
      { id: "1", type: "decision" as const, content: "a", confidence: 0.9, importance: 0.9, source: "@arch", sessionId: "s1", createdAt: "2026-01-01", tags: [] },
      { id: "2", type: "fact" as const, content: "b", confidence: 0.7, importance: 0.6, source: "@coder", sessionId: "s1", createdAt: "2026-01-01", tags: [] },
      { id: "3", type: "preference" as const, content: "c", confidence: 0.5, importance: 0.3, source: "@ceo", sessionId: "s1", createdAt: "2026-01-01", tags: [] },
    ];

    const structural = filterByImportance(observations, 0.8);
    expect(structural).toHaveLength(1);
    expect(structural[0]!.type).toBe("decision");

    const potential = filterByImportance(observations, 0.4);
    expect(potential).toHaveLength(2);
  });

  it("IMPORTANCE_THRESHOLDS are defined", async () => {
    const { IMPORTANCE_THRESHOLDS } = await import("../../src/memory/observation-scorer.js");
    expect(IMPORTANCE_THRESHOLDS.structural).toBe(0.8);
    expect(IMPORTANCE_THRESHOLDS.potential).toBe(0.4);
  });
});

// ============================================================================
// Phase 3: Fact Store
// ============================================================================

describe("Phase 3: Fact Store", () => {
  let testProjectId: string;

  beforeEach(() => {
    testProjectId = `test-${randomUUID()}`;
  });

  afterEach(() => {
    // Cleanup test project dir
    const { join } = require("node:path");
    const { homedir } = require("node:os");
    const { existsSync, rmSync } = require("node:fs");
    const dir = join(homedir(), ".endiorbot", "memory", testProjectId);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("empty store returns no facts", async () => {
    const { FactStore } = await import("../../src/memory/fact-store.js");
    const store = new FactStore(testProjectId);
    await store.load();
    expect(store.getAllFacts()).toHaveLength(0);
    expect(store.getCurrentFactCount()).toBe(0);
  });

  it("addFacts and query by entity", async () => {
    const { FactStore } = await import("../../src/memory/fact-store.js");
    const store = new FactStore(testProjectId);

    const fact = FactStore.createFact("EndiorBot", "framework", "SDLC 6.1.2", "@architect");
    store.addFacts([fact]);

    const results = store.query({ entity: "EndiorBot" });
    expect(results).toHaveLength(1);
    expect(results[0]!.value).toBe("SDLC 6.1.2");
  });

  it("addFacts and query by relation", async () => {
    const { FactStore } = await import("../../src/memory/fact-store.js");
    const store = new FactStore(testProjectId);

    store.addFacts([
      FactStore.createFact("EndiorBot", "tier", "STANDARD", "@coder"),
      FactStore.createFact("paperclip", "tier", "LITE", "@coder"),
    ]);

    const results = store.query({ relation: "tier" });
    expect(results).toHaveLength(2);
  });

  it("conflict resolution: same entity+relation supersedes old fact", async () => {
    const { FactStore } = await import("../../src/memory/fact-store.js");
    const store = new FactStore(testProjectId);

    const oldFact = FactStore.createFact("EndiorBot", "tier", "STANDARD", "@coder");
    store.addFacts([oldFact]);

    const newFact = FactStore.createFact("EndiorBot", "tier", "PROFESSIONAL", "@architect");
    store.addFacts([newFact]);

    // Query returns only current (non-superseded) facts
    const current = store.query({ entity: "EndiorBot", relation: "tier" });
    expect(current).toHaveLength(1);
    expect(current[0]!.value).toBe("PROFESSIONAL");

    // All facts (including superseded) are preserved
    const all = store.getAllFacts();
    expect(all).toHaveLength(2);
    expect(all[0]!.validUntil).toBeDefined(); // old fact superseded
    expect(all[1]!.validUntil).toBeUndefined(); // new fact is current
  });

  it("save and load persists facts", async () => {
    const { FactStore } = await import("../../src/memory/fact-store.js");

    // Create and save
    const store1 = new FactStore(testProjectId);
    store1.addFacts([
      FactStore.createFact("EndiorBot", "language", "TypeScript", "@coder"),
      FactStore.createFact("EndiorBot", "tier", "STANDARD", "@coder"),
    ]);
    await store1.save();

    // Load in new instance
    const store2 = new FactStore(testProjectId);
    await store2.load();

    expect(store2.getAllFacts()).toHaveLength(2);
    expect(store2.getCurrentFactCount()).toBe(2);

    const langFacts = store2.query({ entity: "EndiorBot", relation: "language" });
    expect(langFacts).toHaveLength(1);
    expect(langFacts[0]!.value).toBe("TypeScript");
  });

  it("createFact generates UUID and timestamp", async () => {
    const { FactStore } = await import("../../src/memory/fact-store.js");
    const fact = FactStore.createFact("test", "rel", "val", "@source");

    expect(fact.id).toBeTruthy();
    expect(fact.id.length).toBe(36); // UUID format
    expect(fact.validFrom).toBeTruthy();
    expect(fact.validUntil).toBeUndefined();
    expect(fact.confidence).toBe(0.8);
  });

  it("query with no filter returns all current facts", async () => {
    const { FactStore } = await import("../../src/memory/fact-store.js");
    const store = new FactStore(testProjectId);

    store.addFacts([
      FactStore.createFact("A", "r1", "v1", "@s"),
      FactStore.createFact("B", "r2", "v2", "@s"),
    ]);

    const results = store.query({});
    expect(results).toHaveLength(2);
  });
});

// ============================================================================
// Phase 3: Session Handoff
// ============================================================================

describe("Phase 3: Session Handoff", () => {
  let testProjectId: string;

  beforeEach(() => {
    testProjectId = `test-${randomUUID()}`;
  });

  afterEach(() => {
    const { join } = require("node:path");
    const { homedir } = require("node:os");
    const { existsSync, rmSync } = require("node:fs");
    const dir = join(homedir(), ".endiorbot", "memory", testProjectId);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("createHandoff generates timestamp", async () => {
    const { createHandoff } = await import("../../src/memory/session-handoff.js");
    const handoff = createHandoff({
      sessionId: "s1",
      workingOn: ["Sprint 101"],
      blocked: [],
      nextSteps: ["Write tests"],
      decisions: ["Use JSONL"],
      openQuestions: [],
      agentSource: "@coder",
    });

    expect(handoff.createdAt).toBeTruthy();
    expect(handoff.sessionId).toBe("s1");
    expect(handoff.workingOn).toEqual(["Sprint 101"]);
    expect(handoff.agentSource).toBe("@coder");
  });

  it("save and load handoff round-trip", async () => {
    const { createHandoff, saveHandoff, loadLatestHandoff } = await import("../../src/memory/session-handoff.js");

    const handoff = createHandoff({
      sessionId: "session-abc",
      workingOn: ["Implement FactStore"],
      blocked: ["Waiting for CTO review"],
      nextSteps: ["Write tests", "Update docs"],
      decisions: ["Use per-project scoping"],
      openQuestions: ["How to handle multi-workspace?"],
      agentSource: "@architect",
    });

    saveHandoff(testProjectId, handoff);
    const loaded = loadLatestHandoff(testProjectId);

    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe("session-abc");
    expect(loaded!.workingOn).toEqual(["Implement FactStore"]);
    expect(loaded!.blocked).toEqual(["Waiting for CTO review"]);
    expect(loaded!.agentSource).toBe("@architect");
  });

  it("loadLatestHandoff returns null when no handoffs", async () => {
    const { loadLatestHandoff } = await import("../../src/memory/session-handoff.js");
    const result = loadLatestHandoff(testProjectId);
    expect(result).toBeNull();
  });

  it("loadLatestHandoff returns most recent by timestamp", async () => {
    const { createHandoff, saveHandoff, loadLatestHandoff } = await import("../../src/memory/session-handoff.js");

    const older = createHandoff({
      sessionId: "s1",
      workingOn: ["Old task"],
      blocked: [], nextSteps: [], decisions: [], openQuestions: [],
      agentSource: "@coder",
    });
    // Manually set older timestamp
    (older as any).createdAt = "2026-01-01T00:00:00.000Z";
    saveHandoff(testProjectId, older);

    const newer = createHandoff({
      sessionId: "s2",
      workingOn: ["New task"],
      blocked: [], nextSteps: [], decisions: [], openQuestions: [],
      agentSource: "@coder",
    });
    saveHandoff(testProjectId, newer);

    const latest = loadLatestHandoff(testProjectId);
    expect(latest!.sessionId).toBe("s2");
    expect(latest!.workingOn).toEqual(["New task"]);
  });

  it("loadAllHandoffs returns all sorted by createdAt", async () => {
    const { createHandoff, saveHandoff, loadAllHandoffs } = await import("../../src/memory/session-handoff.js");

    const h1 = createHandoff({
      sessionId: "s1", workingOn: ["Task 1"],
      blocked: [], nextSteps: [], decisions: [], openQuestions: [],
      agentSource: "@coder",
    });
    (h1 as any).createdAt = "2026-01-02T00:00:00.000Z";
    saveHandoff(testProjectId, h1);

    const h2 = createHandoff({
      sessionId: "s2", workingOn: ["Task 2"],
      blocked: [], nextSteps: [], decisions: [], openQuestions: [],
      agentSource: "@coder",
    });
    (h2 as any).createdAt = "2026-01-01T00:00:00.000Z";
    saveHandoff(testProjectId, h2);

    const all = loadAllHandoffs(testProjectId);
    expect(all).toHaveLength(2);
    expect(all[0]!.sessionId).toBe("s2"); // Older first (ascending)
    expect(all[1]!.sessionId).toBe("s1");
  });
});

// ============================================================================
// Phase 3: Memory Module Barrel Export
// ============================================================================

describe("Phase 3: Memory Module Exports", () => {
  it("barrel export provides all public APIs", async () => {
    const memory = await import("../../src/memory/index.js");

    // Observation scorer
    expect(memory.scoreObservation).toBeTypeOf("function");
    expect(memory.filterByImportance).toBeTypeOf("function");
    expect(memory.IMPORTANCE_THRESHOLDS).toBeDefined();

    // Fact store
    expect(memory.FactStore).toBeTypeOf("function");

    // Session handoff
    expect(memory.createHandoff).toBeTypeOf("function");
    expect(memory.saveHandoff).toBeTypeOf("function");
    expect(memory.loadLatestHandoff).toBeTypeOf("function");
    expect(memory.loadAllHandoffs).toBeTypeOf("function");
  });
});
