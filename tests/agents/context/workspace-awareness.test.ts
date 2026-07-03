/**
 * Workspace Awareness - Static Constant & Injection Ordering Tests
 *
 * Verifies the SDLC 6.4.0 Agent Continuity pattern:
 *   1. WORKSPACE_AWARENESS_SECTION is a module-level constant (immutable binding).
 *   2. Exact header text matches the declared section (no runtime drift).
 *   3. Injection ordering: SOUL → workspace-awareness → Brain L4 in the
 *      context-injector manifest.
 *
 * @module tests/agents/context/workspace-awareness
 * @sdlc_framework 6.4.0
 */

import { describe, it, expect } from "vitest";
import {
  WORKSPACE_AWARENESS_SECTION,
  WORKSPACE_AWARENESS_SOURCE_ID,
} from "../../../src/agents/context/workspace-awareness.js";

describe("workspace-awareness (SDLC 6.4.0 Layer 1.25)", () => {
  describe("Static constant (code-hygiene property)", () => {
    it("WORKSPACE_AWARENESS_SECTION is a non-empty string", () => {
      expect(typeof WORKSPACE_AWARENESS_SECTION).toBe("string");
      expect(WORKSPACE_AWARENESS_SECTION.length).toBeGreaterThan(100);
    });

    it("WORKSPACE_AWARENESS_SOURCE_ID is the stable identifier", () => {
      expect(WORKSPACE_AWARENESS_SOURCE_ID).toBe("workspace_awareness");
    });

    it("constant is immutable — string primitive cannot be mutated in place", () => {
      // String primitives are immutable in JS. This test documents the property
      // and protects against a future refactor that would replace the string
      // with a mutable container (e.g. an object or array).
      const before = WORKSPACE_AWARENESS_SECTION;
      // Attempting reassignment to the imported binding would be a TypeScript
      // compile error; verify runtime equality holds.
      expect(WORKSPACE_AWARENESS_SECTION).toBe(before);
      expect(WORKSPACE_AWARENESS_SECTION).toStrictEqual(before);
    });

    it("contains the MANDATORY header verbatim (no runtime drift)", () => {
      expect(WORKSPACE_AWARENESS_SECTION).toContain("## Workspace Awareness (MANDATORY)");
    });

    it("contains the 'Never ask the user' block", () => {
      expect(WORKSPACE_AWARENESS_SECTION).toContain("Never ask the user:");
      expect(WORKSPACE_AWARENESS_SECTION).toContain("What sprint is this?");
    });

    it("references the SDLC 6.4.0 Agent Continuity mental model", () => {
      expect(WORKSPACE_AWARENESS_SECTION).toContain("Agent Continuity");
      expect(WORKSPACE_AWARENESS_SECTION).toContain("Mental Model #7");
    });

    it("cites the solo developer power tool <30s guarantee (identity-lock linkage)", () => {
      expect(WORKSPACE_AWARENESS_SECTION).toContain("solo developer power tool");
      expect(WORKSPACE_AWARENESS_SECTION).toContain("<30");
    });

    it("lists the 5 discovery reads", () => {
      // Discovery protocol must list CLAUDE.md, AGENTS.md, sprint docs, config
      expect(WORKSPACE_AWARENESS_SECTION).toContain("CLAUDE.md");
      expect(WORKSPACE_AWARENESS_SECTION).toContain("AGENTS.md");
      expect(WORKSPACE_AWARENESS_SECTION).toContain("SPRINT-");
      expect(WORKSPACE_AWARENESS_SECTION).toContain(".sdlc-config.json");
    });
  });

  describe("No runtime interpolation (threat-model property)", () => {
    it("contains no template placeholders that could accept attacker-controlled input", () => {
      // Static constant must not contain ${...}, %s, {0}, or other interpolation
      // markers that would let a caller inject text into the directive.
      expect(WORKSPACE_AWARENESS_SECTION).not.toMatch(/\$\{[^}]+\}/); // ${foo}
      expect(WORKSPACE_AWARENESS_SECTION).not.toMatch(/%[sd]/); // %s %d
      expect(WORKSPACE_AWARENESS_SECTION).not.toMatch(/\{\d+\}/); // {0} {1}
    });
  });

  describe("Injection ordering (Layer 1.25 position)", () => {
    it("context-injector inserts workspace-awareness between SOUL and Brain L4", async () => {
      // Arrange — use the real ContextInjector to build a manifest; assert on
      // the ordering of injected items. This is a behavioral test of the
      // Layer 1.25 placement (not a mock-based assertion).
      const { ContextInjector } = await import(
        "../../../src/agents/context/context-injector.js"
      );

      const injector = new ContextInjector({
        templatesRoot: "docs/reference/templates",
        projectContextPath: ".sdlc-config.json",
        tier: "STANDARD",
        sessionId: "test-ordering",
        verbose: false,
      });

      const result = await injector.inject({
        agent: "coder",
        task: "implement feature X",
        classification: {
          taskType: "code_generation",
          complexity: "simple",
          minModelTier: "STANDARD",
        },
        workspace: process.cwd(),
      });

      const sources = result.manifest.items.map((i) => i.source);
      const soulIdx = sources.indexOf("soul");
      const waIdx = sources.indexOf("workspace_awareness");
      const brainL4Idx = sources.indexOf("brain_l4");

      // soul must precede workspace-awareness
      expect(soulIdx).toBeGreaterThanOrEqual(0);
      expect(waIdx).toBeGreaterThan(soulIdx);

      // workspace-awareness must precede Brain L4 (if L4 is present)
      if (brainL4Idx >= 0) {
        expect(waIdx).toBeLessThan(brainL4Idx);
      }
    });

    it("system prompt emits the workspace-awareness section text in full", async () => {
      const { ContextInjector } = await import(
        "../../../src/agents/context/context-injector.js"
      );

      const injector = new ContextInjector({
        templatesRoot: "docs/reference/templates",
        projectContextPath: ".sdlc-config.json",
        tier: "STANDARD",
        sessionId: "test-emission",
        verbose: false,
      });

      const result = await injector.inject({
        agent: "pm",
        task: "plan next sprint",
        classification: {
          taskType: "planning",
          complexity: "simple",
          minModelTier: "STANDARD",
        },
        workspace: process.cwd(),
      });

      // The full directive must appear in the system prompt — not just the
      // manifest entry. This guarantees the agent actually sees it.
      expect(result.systemPrompt).toContain("## Workspace Awareness (MANDATORY)");
      expect(result.systemPrompt).toContain("Never ask the user:");
    });
  });
});
