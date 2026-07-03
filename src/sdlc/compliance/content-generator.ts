/**
 * Content Generator
 *
 * Generates compliance content via the invokePatch() pipeline.
 * Routes through PatchValidator + CEO confirmation + applyPatch().
 * Falls back to deterministic templates when bridge is unavailable.
 *
 * @module sdlc/compliance/content-generator
 * @version 1.0.0
 * @date 2026-03-03
 * @status ACTIVE - Sprint 75
 * @authority ADR-018 AI-Generated Compliance Content
 * @sprint 75
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { AgentRole } from "../../agents/types/handoff.js";
import type { PatchResponse } from "../../agents/invoke/claude-code-bridge.js";
import { resolveTemplatesRoot } from "../../config/paths.js";
import { scrub } from "../../security/output-scrubber.js";
import { countPlaceholders } from "./content-checker.js";
import type {
  AgentFixTask,
  FixAction,
  FixActionResult,
  GeneratorConfig,
  ProjectSnapshot,
} from "./fix-types.js";
import {
  AGENT_SKILL_MAP,
  MAX_GENERATED_FILE_SIZE,
  STAGE_QUESTIONS,
  STAGE_UPSTREAM,
  SECTION8_ARTIFACT_TYPES,
  BDD_REQUIRED_STAGES,
  findGateRequirement,
  findArtifactSpec,
  STAGE_GATE_MAP,
  TIER_COVERAGE_TARGETS,
  type GateArtifactSpec,
  type GateRequirement,
} from "./fix-types.js";

// ============================================================================
// Bridge Interface (decouples from concrete ClaudeCodeBridge)
// ============================================================================

/**
 * Minimal bridge interface for content generation.
 * Matches ClaudeCodeBridge.invokePatch() + isAvailable() signatures.
 */
export interface ContentGeneratorBridge {
  invokePatch(
    request: {
      systemPrompt: string;
      userPrompt: string;
      workspace: string;
      agent: AgentRole;
    },
    confirmCallback?: () => Promise<boolean>,
  ): Promise<PatchResponse>;
  isAvailable(): Promise<boolean>;
}

/**
 * Dependencies for content generation.
 */
export interface ContentGeneratorDeps {
  /** Bridge for invoking Claude — null for deterministic fallback */
  bridge: ContentGeneratorBridge | null;
  /** Project snapshot for context */
  snapshot: ProjectSnapshot;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate content for a single fix action.
 *
 * Flow (via bridge):
 * 1. Load SOUL template for agent
 * 2. Load skill content if agent has skills
 * 3. Build system prompt (SOUL + skill + context + previous outputs)
 * 4. Build user prompt (specific artifact instructions)
 * 5. Call bridge.invokePatch() — PatchValidator + CEO confirm + applyPatch
 * 6. Post-write validation: placeholders, scrub, size cap
 *
 * Falls back to deterministic templates when bridge is unavailable.
 */
export async function generateContent(
  task: AgentFixTask,
  action: FixAction,
  config: GeneratorConfig,
  previousStageOutputs: Map<string, string>,
  deps: ContentGeneratorDeps,
): Promise<FixActionResult> {
  // Dry-run: return preview without invoking bridge
  if (config.dryRun) {
    return {
      action,
      success: true,
      content: buildDryRunPreview(task, action, deps.snapshot),
      dryRun: true,
    };
  }

  // Check bridge availability
  if (!deps.bridge || !(await deps.bridge.isAvailable())) {
    return generateDeterministicContent(task, action, deps.snapshot);
  }

  // Step 10: Load existing upstream docs from disk for context
  loadUpstreamDocs(config.projectPath, task.stage, previousStageOutputs);

  // Build prompts
  const systemPrompt = buildSystemPrompt(task, action, deps.snapshot, previousStageOutputs);
  const userPrompt = buildUserPrompt(action, task, deps.snapshot);

  // Build confirm callback
  const confirmCallback = config.autoConfirm
    ? async () => true
    : undefined; // Let bridge use its default confirmation

  try {
    // First invocation
    const firstResult = await invokeBridgeAndValidate(
      deps.bridge, systemPrompt, userPrompt, config, task, action, deps.snapshot, confirmCallback,
    );

    if (!firstResult.success || !firstResult.content) {
      return firstResult;
    }

    // Step 8: Quality validation + refinement loop
    const qualityCheck = validateContentQuality(firstResult.content, task, action, deps.snapshot);
    if (qualityCheck.passed) {
      return firstResult;
    }

    // Quality check failed — build refinement prompt and retry once (max 2 invocations)
    const refinementPrompt = buildRefinementPrompt(
      userPrompt, firstResult.content, qualityCheck.feedback,
    );

    const refinedResult = await invokeBridgeAndValidate(
      deps.bridge, systemPrompt, refinementPrompt, config, task, action, deps.snapshot, confirmCallback,
    );

    // Return best result (refined if successful, otherwise first)
    return refinedResult.success ? refinedResult : firstResult;
  } catch (err) {
    return {
      action,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      dryRun: false,
    };
  }
}

// ============================================================================
// Bridge Invocation + Refinement Helpers
// ============================================================================

async function invokeBridgeAndValidate(
  bridge: ContentGeneratorBridge,
  systemPrompt: string,
  userPrompt: string,
  config: GeneratorConfig,
  task: AgentFixTask,
  action: FixAction,
  _snapshot: ProjectSnapshot,
  confirmCallback?: () => Promise<boolean>,
): Promise<FixActionResult> {
  const patchResponse = await bridge.invokePatch(
    {
      systemPrompt,
      userPrompt,
      workspace: config.projectPath,
      agent: task.agent,
    },
    confirmCallback,
  );

  if (!patchResponse.success) {
    return {
      action,
      success: false,
      error: patchResponse.error ?? "invokePatch failed",
      dryRun: false,
    };
  }

  if (!patchResponse.applied) {
    return {
      action,
      success: false,
      error: patchResponse.confirmed
        ? "Patch confirmed but not applied"
        : "Patch not confirmed by CEO",
      dryRun: false,
    };
  }

  // Post-write validation
  const validationError = validateWrittenFile(
    join(config.projectPath, action.targetPath),
  );
  if (validationError) {
    return {
      action,
      success: false,
      error: validationError,
      dryRun: false,
    };
  }

  // Read written content for audit trail
  const writtenPath = join(config.projectPath, action.targetPath);
  const result: FixActionResult = {
    action,
    success: true,
    dryRun: false,
  };
  if (existsSync(writtenPath)) {
    result.content = readFileSync(writtenPath, "utf-8");
  }

  return result;
}

function buildRefinementPrompt(
  originalPrompt: string,
  previousDraft: string,
  feedback: string[],
): string {
  const draftPreview = previousDraft.slice(0, 3000);
  const lines: string[] = [];

  lines.push("REFINEMENT: The previous draft did not pass quality validation.");
  lines.push("");
  lines.push("Issues found:");
  for (const item of feedback) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("Previous draft (first 3000 chars):");
  lines.push("```");
  lines.push(draftPreview);
  lines.push("```");
  lines.push("");
  lines.push("Please regenerate the file addressing ALL issues above.");
  lines.push("");
  lines.push(originalPrompt);

  return lines.join("\n");
}

// ============================================================================
// Prompt Builders
// ============================================================================

function buildSystemPrompt(
  task: AgentFixTask,
  action: FixAction,
  snapshot: ProjectSnapshot,
  previousStageOutputs: Map<string, string>,
): string {
  const parts: string[] = [];

  // 1. SOUL template
  const soulContent = loadSoulTemplate(task.agent);
  if (soulContent) {
    parts.push(soulContent);
  } else {
    parts.push(buildMinimalAgentIdentity(task.agent));
  }

  // 2. Skill injection (e.g., e2e-api-testing for @tester)
  const skills = AGENT_SKILL_MAP[task.agent];
  if (skills) {
    for (const skillName of skills) {
      const skillContent = loadSkillContent(skillName);
      if (skillContent) {
        parts.push(`\n## Skill: ${skillName}\n\n${skillContent}`);
      }
    }
  }

  // 3. Project context
  parts.push(`\n${task.promptContext}`);

  // 4. Previous stage outputs (cross-stage consistency) — smart extraction, 2000 chars
  if (previousStageOutputs.size > 0) {
    parts.push("\n## Previous Stage Outputs (for cross-references)\n");
    for (const [stage, content] of previousStageOutputs) {
      const extracted = extractKeyContent(content, 2000);
      parts.push(`### ${stage}\n\`\`\`\n${extracted}\n\`\`\`\n`);
    }
  }

  // 5. Gate requirements
  if (task.gates.length > 0) {
    parts.push(`\n## Gate Requirements\n`);
    parts.push(`This content must satisfy gates: ${task.gates.join(", ")}`);
    parts.push(`Include a "## Quality Gates" section referencing these gates.`);
  }

  // 6. SDLC 6.4.0 Stage Context (Pillar 1 — 10-Stage Lifecycle)
  const stageQuestion = STAGE_QUESTIONS[task.stage];
  if (stageQuestion) {
    parts.push(
      `\n## SDLC Stage Context\n` +
      `Stage **${task.stage}** — guiding question: **"${stageQuestion}"**\n` +
      `Every section of your document must answer this question for THIS specific project.\n`,
    );
  }

  // 7. Section 8 Unified Specification Standard (YAML frontmatter for spec docs)
  if (SECTION8_ARTIFACT_TYPES.has(action.artifactType)) {
    const today = new Date().toISOString().split("T")[0];
    const specId = `SPEC-${task.stage.replace(/-/g, "").toUpperCase()}-001`;
    const titleWords = action.artifactType.replace(/\.(md|yaml)$/, "").replace(/-/g, " ");
    parts.push(
      `\n## Section 8 Specification Standard (REQUIRED)\n` +
      `Place this YAML frontmatter block as the VERY FIRST content in the file:\n` +
      `\`\`\`yaml\n---\n` +
      `spec_id: ${specId}\n` +
      `title: "${titleWords}"\n` +
      `spec_version: "1.0.0"\n` +
      `status: draft\n` +
      `tier: ${snapshot.tier}\n` +
      `stage: "${task.stage}"\n` +
      `category: functional\n` +
      `owner: "@${task.agent}"\n` +
      `created: ${today}\n` +
      `last_updated: ${today}\n` +
      `---\n\`\`\`\n`,
    );
  }

  // 8. BDD Requirements Format (01-planning + 00-foundation requirement docs)
  if (BDD_REQUIRED_STAGES.has(task.stage) && /requirement/i.test(action.artifactType)) {
    parts.push(
      `\n## BDD Requirements Format (MANDATORY per SDLC 6.4.0 Section 8)\n` +
      `All acceptance criteria and feature requirements MUST use Given/When/Then format:\n` +
      `\`\`\`gherkin\nFeature: [Feature Name]\n\n` +
      `  Scenario: [Scenario description]\n` +
      `    GIVEN [precondition specific to ${snapshot.name}]\n` +
      `    WHEN [user or system action]\n` +
      `    THEN [verifiable, measurable outcome]\n` +
      `\`\`\`\n` +
      `Anti-patterns to AVOID: UI selectors ("click #button"), database details ("row count"), timing ("sleep 5s").\n`,
    );
  }

  // 9. Cross-Stage Traceability (Design-First principle)
  const upstream = STAGE_UPSTREAM[task.stage] ?? [];
  if (upstream.length > 0) {
    const upstreamList = upstream
      .map((s) => `- \`docs/${s}/\` — cite specific artifacts that informed this document`)
      .join("\n");
    parts.push(
      `\n## Cross-Stage Traceability (REQUIRED per Design-First)\n` +
      `Your document MUST end with a "## References" section that links to upstream stages:\n` +
      upstreamList + "\n" +
      `Example: "This plan is derived from [Problem Statement](../../00-foundation/problem-statement.md)"\n`,
    );
  }

  // 10. Completeness Rules
  parts.push(
    `\n## Completeness Rules (NON-NEGOTIABLE)\n` +
    `- Document MUST be COMPLETE — never truncate, never use "see also" as a substitute for content\n` +
    `- Every section heading you write must have substantive content (≥3 sentences or a populated table)\n` +
    `- Target minimum 150 lines of real, project-specific content\n` +
    `- Depth over breadth: prefer thorough coverage of the most critical sections\n`,
  );

  // 11. Output constraints
  parts.push(`\n## Output Constraints`);
  parts.push(`- Generate REAL content specific to this project — NO placeholders`);
  parts.push(`- Do NOT include "TODO:", "TBD", or "Generated by EndiorBot" text`);
  parts.push(`- Reference actual project modules, dependencies, and tech stack`);
  parts.push(`- Keep file size under 50KB`);

  return parts.join("\n");
}

function buildUserPrompt(
  action: FixAction,
  task: AgentFixTask,
  snapshot: ProjectSnapshot,
): string {
  // Find gate-specific requirements for this artifact
  const gateReq = findGateRequirement(task.stage);
  const artifactSpec = gateReq?.artifacts.find((a) => a.artifactPath === action.artifactType);

  if (artifactSpec && gateReq) {
    return buildGateSpecificPrompt(action, task, snapshot, artifactSpec, gateReq);
  }
  // Fallback: enriched generic prompt
  return buildEnrichedGenericPrompt(action, task, snapshot);
}

function buildGateSpecificPrompt(
  action: FixAction,
  task: AgentFixTask,
  snapshot: ProjectSnapshot,
  spec: GateArtifactSpec,
  gate: GateRequirement,
): string {
  const lines: string[] = [];

  lines.push(`Generate: ${action.targetPath}`);
  lines.push("");
  lines.push(`This document feeds **${gate.gateId} — ${gate.gateName}**.`);
  lines.push(`Gate ${gate.gateId} pass criteria:`);
  for (const criterion of gate.passCriteria) {
    lines.push(`- ${criterion}`);
  }
  lines.push("");

  // Required content sections from gate spec
  lines.push("Required sections:");
  for (let i = 0; i < spec.contentRequirements.length; i++) {
    lines.push(`${i + 1}. ${spec.contentRequirements[i]}`);
  }
  lines.push("");

  // ALL code modules (not truncated)
  if (snapshot.codeModules.length > 0) {
    lines.push(`Project modules (${snapshot.codeModules.length} total):`);
    for (const mod of snapshot.codeModules) {
      const keyStr = mod.keyFiles.length > 0 ? `, key: ${mod.keyFiles.join(", ")}` : "";
      lines.push(`- ${mod.path}/ (${mod.fileCount} files${keyStr})`);
    }
    lines.push("");
  }

  // Dependencies
  if (snapshot.techStack.dependencies.length > 0) {
    lines.push(`Dependencies: ${snapshot.techStack.dependencies.join(", ")}`);
    lines.push("");
  }

  // Coverage targets for test-related artifacts
  if (task.stage === "05-test") {
    const targets = TIER_COVERAGE_TARGETS[snapshot.tier];
    if (targets) {
      lines.push(`Coverage targets (${snapshot.tier} tier): unit ≥${targets.unit}%, integration ≥${targets.integration}%, e2e: ${targets.e2e}`);
      lines.push("");
    }
  }

  // Upstream references
  const upstream = STAGE_UPSTREAM[task.stage] ?? [];
  if (upstream.length > 0) {
    lines.push(`References — link to: ${upstream.map((s) => `docs/${s}/`).join(", ")}`);
    lines.push("");
  }

  // YAML + BDD + min lines
  const constraints: string[] = [];
  if (spec.section8Yaml) constraints.push("YAML frontmatter required (Section 8)");
  if (spec.bddRequired) constraints.push("BDD GIVEN/WHEN/THEN format required for acceptance criteria");
  constraints.push(`Minimum ${spec.minLines} lines`);
  lines.push(constraints.join(". ") + ".");

  return lines.join("\n");
}

function buildEnrichedGenericPrompt(
  action: FixAction,
  task: AgentFixTask,
  snapshot: ProjectSnapshot,
): string {
  const lines: string[] = [];

  lines.push(`Generate the file: ${action.targetPath}`);
  lines.push("");
  lines.push(`Stage: ${action.stage}`);
  lines.push(`Artifact: ${action.artifactType}`);
  lines.push(`Description: ${action.description}`);
  lines.push("");

  // Include gate context if available
  const gates = STAGE_GATE_MAP[task.stage] ?? [];
  if (gates.length > 0) {
    lines.push(`Gates: ${gates.join(", ")}`);
  }

  // Include all modules
  if (snapshot.codeModules.length > 0) {
    lines.push("");
    lines.push(`Project modules (${snapshot.codeModules.length}):`);
    for (const mod of snapshot.codeModules) {
      lines.push(`- ${mod.path}/ (${mod.fileCount} files)`);
    }
  }

  lines.push("");
  lines.push(`Create this file with real, project-specific content.`);
  lines.push(`Do NOT use placeholder text, TODO markers, or generic template content.`);

  if (action.hierarchyLevel) {
    lines.push("");
    lines.push(`Document hierarchy level: ${action.hierarchyLevel}`);
  }

  return lines.join("\n");
}

// ============================================================================
// SOUL Template + Skill Loader
// ============================================================================

function loadSoulTemplate(agent: AgentRole): string | null {
  try {
    const soulPath = join(resolveTemplatesRoot(), "souls", `SOUL-${agent}.md`);
    if (existsSync(soulPath)) {
      return readFileSync(soulPath, "utf-8");
    }
  } catch {
    // Template not found
  }
  return null;
}

function loadSkillContent(skillName: string): string | null {
  try {
    const skillPath = join(".claude", "skills", skillName, "SKILL.md");
    if (existsSync(skillPath)) {
      return readFileSync(skillPath, "utf-8");
    }
  } catch {
    // Skill not found
  }
  return null;
}

function buildMinimalAgentIdentity(agent: AgentRole): string {
  const identities: Partial<Record<AgentRole, string>> = {
    pm: "You are a Product Manager. Generate clear, actionable project documentation.",
    architect: "You are a Software Architect. Generate technical design documentation with ADRs and specifications.",
    pjm: "You are a Project Manager. Generate sprint plans and project tracking documentation.",
    tester: "You are a QA Engineer. Generate test plans with coverage targets and acceptance criteria.",
    devops: "You are a DevOps Engineer. Generate deployment and operations documentation.",
    fullstack: "You are a Full-Stack Developer. Generate comprehensive technical documentation.",
    reviewer: "You are a Code Reviewer. Generate quality assurance and review documentation.",
  };

  return identities[agent] ?? `You are an SDLC agent (${agent}). Generate documentation for compliance.`;
}

// ============================================================================
// Post-Write Validation
// ============================================================================

/**
 * Validate a written file meets quality standards.
 * Returns error message if validation fails, null if OK.
 */
export function validateWrittenFile(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return `File not created: ${filePath}`;
  }

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (err) {
    return `Cannot read file: ${err instanceof Error ? err.message : String(err)}`;
  }

  // W4: Size cap
  if (Buffer.byteLength(content, "utf-8") > MAX_GENERATED_FILE_SIZE) {
    return `File exceeds max size (${MAX_GENERATED_FILE_SIZE} bytes)`;
  }

  // Quality gate: no placeholders
  const placeholders = countPlaceholders(content);
  if (placeholders.length > 0) {
    return `File contains ${placeholders.length} placeholder(s): ${placeholders[0]}`;
  }

  // W2/P0-4: Security scrub check — write scrubbed content back or delete on violation
  const scrubResult = scrub(content);
  if (scrubResult.violations.length > 0) {
    if (scrubResult.scrubbed && scrubResult.scrubbed !== content) {
      // Write scrubbed (cleaned) version back to disk
      try {
        writeFileSync(filePath, scrubResult.scrubbed, "utf-8");
      } catch {
        // If we can't write back, delete the file to prevent credential leak
        try { unlinkSync(filePath); } catch { /* best-effort cleanup */ }
        return `Security violations (file deleted): ${scrubResult.violations.join(", ")}`;
      }
    } else {
      // No scrubbed version available — delete the file to prevent leak
      try { unlinkSync(filePath); } catch { /* best-effort cleanup */ }
      return `Security violations (file deleted): ${scrubResult.violations.join(", ")}`;
    }
  }

  return null;
}

// ============================================================================
// Content Quality Validation (Step 8)
// ============================================================================

/**
 * Result of content quality validation.
 */
export interface ContentQualityResult {
  passed: boolean;
  score: number;
  feedback: string[];
}

/**
 * Validate generated content against gate-specific requirements.
 * Returns feedback items that should trigger refinement.
 */
export function validateContentQuality(
  content: string,
  task: AgentFixTask,
  action: FixAction,
  snapshot: ProjectSnapshot,
): ContentQualityResult {
  const feedback: string[] = [];
  const artifactSpec = findArtifactSpec(task.stage, action.artifactType);
  const lines = content.split("\n").length;

  // 1. Section 8 YAML frontmatter check
  if (artifactSpec?.section8Yaml && !content.includes("spec_id:")) {
    feedback.push("Missing Section 8 YAML frontmatter (spec_id:, status:, tier:)");
  }

  // 2. BDD format check
  if (artifactSpec?.bddRequired && !/GIVEN\b/i.test(content)) {
    feedback.push("Missing BDD acceptance criteria (GIVEN/WHEN/THEN format required)");
  }

  // 3. Cross-stage References check
  const upstream = STAGE_UPSTREAM[task.stage] ?? [];
  if (upstream.length > 0 && !content.includes("## References")) {
    feedback.push(`Missing ## References section linking to upstream: ${upstream.join(", ")}`);
  }

  // 4. Min lines check
  const minLines = artifactSpec?.minLines ?? 100;
  if (lines < minLines) {
    feedback.push(`Only ${lines} lines — gate requires minimum ${minLines} lines`);
  }

  // 5. Project specificity check
  const moduleNames = snapshot.codeModules.slice(0, 5).map((m) => m.name);
  const mentionedModules = moduleNames.filter((n) => content.includes(n));
  if (mentionedModules.length < 2 && moduleNames.length >= 2) {
    feedback.push(`Content too generic — only ${mentionedModules.length} modules mentioned, need ≥2`);
  }

  // 6. Placeholder check
  const placeholders = countPlaceholders(content);
  if (placeholders.length > 0) {
    feedback.push(`Contains ${placeholders.length} placeholder(s): ${placeholders[0]}`);
  }

  const score = Math.max(0, 100 - feedback.length * 15);
  return { passed: feedback.length === 0, score, feedback };
}

// ============================================================================
// Smart Cross-Stage Context Extraction (Step 9)
// ============================================================================

/**
 * Extract key content from a document, preserving structure.
 * Keeps YAML frontmatter, headings, and first substantive line after each heading.
 * Max 2000 chars per document.
 */
export function extractKeyContent(content: string, maxChars: number = 2000): string {
  const lines = content.split("\n");
  const extracted: string[] = [];
  let charCount = 0;

  // Preserve YAML frontmatter if present
  if (lines[0]?.trim() === "---") {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      extracted.push(line);
      charCount += line.length + 1;
      if (i > 0 && line.trim() === "---") break;
    }
  }

  // Extract headings and first substantive line after each
  let lastWasHeading = false;
  for (const line of lines) {
    if (charCount >= maxChars) break;
    if (line.startsWith("## ") || line.startsWith("### ")) {
      extracted.push(line);
      charCount += line.length + 1;
      lastWasHeading = true;
    } else if (lastWasHeading && line.trim().length > 0) {
      extracted.push(line);
      charCount += line.length + 1;
      lastWasHeading = false;
    }
  }

  const result = extracted.join("\n");
  return result.length > maxChars ? result.slice(0, maxChars) + "\n...(truncated)" : result;
}

// ============================================================================
// Upstream Document Loading (Step 10)
// ============================================================================

/**
 * Load existing upstream docs from disk into previousStageOutputs.
 * Scans docs/{upstreamStage}/ for .md files and extracts key content.
 */
export function loadUpstreamDocs(
  projectPath: string,
  stage: string,
  previousStageOutputs: Map<string, string>,
): void {
  const upstream = STAGE_UPSTREAM[stage] ?? [];
  for (const upstreamStage of upstream) {
    // Skip if already loaded
    if (previousStageOutputs.has(upstreamStage)) continue;

    const stageDir = join(projectPath, "docs", upstreamStage);
    if (!existsSync(stageDir)) continue;

    try {
      const files = readdirSync(stageDir).filter((f) => f.endsWith(".md") && f !== "README.md");
      const parts: string[] = [];
      for (const file of files.slice(0, 5)) { // Max 5 files per stage
        try {
          const content = readFileSync(join(stageDir, file), "utf-8");
          parts.push(`### ${file}\n${extractKeyContent(content, 800)}`);
        } catch {
          // Skip unreadable files
        }
      }
      if (parts.length > 0) {
        previousStageOutputs.set(upstreamStage, parts.join("\n\n"));
      }
    } catch {
      // Skip inaccessible directories
    }
  }
}

// ============================================================================
// Deterministic Fallback
// ============================================================================

/**
 * Generate deterministic content when bridge is unavailable.
 * Uses project snapshot to create project-specific templates.
 */
function generateDeterministicContent(
  task: AgentFixTask,
  action: FixAction,
  snapshot: ProjectSnapshot,
): FixActionResult {
  const content = buildDeterministicTemplate(task, action, snapshot);

  return {
    action,
    success: true,
    content,
    dryRun: false,
  };
}

function buildDeterministicTemplate(
  task: AgentFixTask,
  action: FixAction,
  snapshot: ProjectSnapshot,
): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split("T")[0];

  // Section 8 YAML frontmatter for spec artifacts (SDLC 6.4.0)
  if (SECTION8_ARTIFACT_TYPES.has(action.artifactType)) {
    const specId = `SPEC-${task.stage.replace(/-/g, "").toUpperCase()}-001`;
    const titleWords = action.artifactType.replace(/\.(md|yaml)$/, "").replace(/-/g, " ");
    lines.push("---");
    lines.push(`spec_id: ${specId}`);
    lines.push(`title: "${titleWords}"`);
    lines.push(`spec_version: "1.0.0"`);
    lines.push(`status: draft`);
    lines.push(`tier: ${snapshot.tier}`);
    lines.push(`stage: "${task.stage}"`);
    lines.push(`category: functional`);
    lines.push(`owner: "@${task.agent}"`);
    lines.push(`created: ${now}`);
    lines.push(`last_updated: ${now}`);
    lines.push("---");
    lines.push("");
  }

  lines.push(`# ${formatArtifactTitle(action.artifactType)}`);
  lines.push("");
  lines.push(`**Project:** ${snapshot.name}`);
  lines.push(`**Stage:** ${action.stage}`);
  lines.push(`**Date:** ${now}`);
  lines.push(`**Tier:** ${snapshot.tier}`);
  lines.push("");

  // Stage-specific content
  switch (action.stage) {
    case "00-foundation":
      lines.push(...buildFoundationTemplate(action, snapshot));
      break;
    case "01-planning":
      lines.push(...buildPlanningTemplate(action, snapshot));
      break;
    case "02-design":
      lines.push(...buildDesignTemplate(action, snapshot));
      break;
    case "05-test":
      lines.push(...buildTestTemplate(action, snapshot));
      break;
    default:
      lines.push(...buildGenericTemplate(action, snapshot));
      break;
  }

  // Quality gates section
  if (task.gates.length > 0) {
    lines.push("");
    lines.push("## Quality Gates");
    lines.push("");
    for (const gate of task.gates) {
      lines.push(`- **${gate}**: Requirements verified`);
    }
  }

  // References section with upstream cross-stage traceability (SDLC 6.4.0)
  lines.push("");
  lines.push("## References");
  lines.push("");
  lines.push(`- SDLC Framework 6.4.0`);
  lines.push(`- Project: ${snapshot.name} (${snapshot.tier} tier)`);
  const upstream = STAGE_UPSTREAM[task.stage] ?? [];
  for (const up of upstream) {
    lines.push(`- [${up} documentation](../${up}/)`);
  }

  return lines.join("\n");
}

function formatArtifactTitle(artifactType: string): string {
  return artifactType
    .replace(/\.md$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildFoundationTemplate(action: FixAction, snapshot: ProjectSnapshot): string[] {
  const lines: string[] = [];
  lines.push("## Overview");
  lines.push("");
  lines.push(`${snapshot.name} is a ${snapshot.techStack.language} project`
    + (snapshot.techStack.framework ? ` using ${snapshot.techStack.framework}` : "")
    + ".");
  lines.push("");

  if (action.artifactType === "problem-statement.md") {
    lines.push("## Problem Statement");
    lines.push("");
    lines.push(`This project addresses the need for a robust ${snapshot.techStack.language} solution.`);
    lines.push("");
    lines.push("## Stakeholders");
    lines.push("");
    lines.push("- Development team");
    lines.push("- End users");
  } else if (action.artifactType === "business-case.md") {
    lines.push("## Business Justification");
    lines.push("");
    lines.push("This project delivers value through improved developer productivity and code quality.");
    lines.push("");
    lines.push("## Success Metrics");
    lines.push("");
    lines.push("- Code quality improvements");
    lines.push("- Developer satisfaction");
  }

  return lines;
}

function buildPlanningTemplate(action: FixAction, snapshot: ProjectSnapshot): string[] {
  const lines: string[] = [];

  if (action.artifactType === "requirements.md") {
    lines.push("## Functional Requirements");
    lines.push("");
    for (const mod of snapshot.codeModules.slice(0, 5)) {
      lines.push(`- **${mod.name}**: Module with ${mod.fileCount} source files`);
    }
    lines.push("");
    lines.push("## Non-Functional Requirements");
    lines.push("");
    lines.push("- Performance: Response time under target thresholds");
    lines.push("- Security: Follow OWASP guidelines");
    lines.push("- Maintainability: Code coverage targets met");
    lines.push("");
    lines.push("## Acceptance Criteria");
    lines.push("");
    lines.push("```gherkin");
    lines.push("Feature: Core System Functionality");
    lines.push("");
    lines.push(`  Scenario: ${snapshot.name} core operation succeeds`);
    lines.push(`    GIVEN the ${snapshot.name} system is initialized with valid configuration`);
    lines.push(`    WHEN a user performs the primary operation`);
    lines.push(`    THEN the system responds successfully within the defined threshold`);
    lines.push(`      AND the result is persisted and auditable`);
    lines.push("");
    lines.push(`  Scenario: ${snapshot.name} handles invalid input gracefully`);
    lines.push(`    GIVEN the ${snapshot.name} system is running`);
    lines.push(`    WHEN an invalid or malformed request is submitted`);
    lines.push(`    THEN the system returns a descriptive error response`);
    lines.push(`      AND no data corruption occurs`);
    lines.push("```");
  } else if (action.artifactType === "roadmap.md") {
    lines.push("## Roadmap");
    lines.push("");
    lines.push("### Phase 1: Foundation");
    lines.push("- Project setup and architecture decisions");
    lines.push("- Core module implementation");
    lines.push("");
    lines.push("### Phase 2: Development");
    lines.push("- Feature implementation across all modules");
    lines.push("- Testing and quality assurance");
  }

  return lines;
}

function buildDesignTemplate(_action: FixAction, snapshot: ProjectSnapshot): string[] {
  const lines: string[] = [];
  lines.push("## Architecture Overview");
  lines.push("");
  lines.push(`The ${snapshot.name} project follows a modular architecture with ${snapshot.codeModules.length} modules.`);
  lines.push("");
  lines.push("## Module Structure");
  lines.push("");
  for (const mod of snapshot.codeModules.slice(0, 8)) {
    lines.push(`- \`${mod.path}/\` — ${mod.fileCount} files`);
  }
  return lines;
}

function buildTestTemplate(_action: FixAction, snapshot: ProjectSnapshot): string[] {
  const lines: string[] = [];
  const unitCount = snapshot.testFiles.filter((t) => t.type === "unit").length;
  const e2eCount = snapshot.testFiles.filter((t) => t.type === "e2e").length;

  lines.push("## Test Strategy");
  lines.push("");
  lines.push(`- **Total test files:** ${snapshot.testFiles.length}`);
  if (unitCount > 0) lines.push(`- **Unit tests:** ${unitCount} files`);
  if (e2eCount > 0) lines.push(`- **E2E tests:** ${e2eCount} files`);
  lines.push("");
  lines.push("## Coverage Targets");
  lines.push("");
  lines.push(`- **${snapshot.tier}** tier target: meet or exceed threshold`);
  lines.push("");
  lines.push("## Test Cases");
  lines.push("");
  for (const mod of snapshot.codeModules.slice(0, 5)) {
    lines.push(`- **${mod.name}**: Functional and integration tests`);
  }
  lines.push("");
  lines.push("## Acceptance Criteria");
  lines.push("");
  lines.push("```gherkin");
  lines.push("Feature: Test Suite Quality");
  lines.push("");
  lines.push(`  Scenario: All tests pass before merge`);
  lines.push(`    GIVEN the ${snapshot.name} test suite is executed`);
  lines.push(`    WHEN all test files run without errors`);
  lines.push(`    THEN all unit, integration, and E2E tests pass`);
  lines.push(`      AND no regressions are introduced in existing functionality`);
  lines.push("");
  lines.push(`  Scenario: New features include test coverage`);
  lines.push(`    GIVEN a new feature is implemented in ${snapshot.name}`);
  lines.push(`    WHEN the feature is submitted for review`);
  lines.push(`    THEN corresponding unit and integration tests are included`);
  lines.push(`      AND code coverage meets the ${snapshot.tier} tier threshold`);
  lines.push("```");

  return lines;
}

function buildGenericTemplate(action: FixAction, snapshot: ProjectSnapshot): string[] {
  const lines: string[] = [];
  lines.push("## Overview");
  lines.push("");
  lines.push(`Documentation for stage ${action.stage} of the ${snapshot.name} project.`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push(`This document covers the ${action.stage} stage requirements for a ${snapshot.tier} tier project.`);
  lines.push("");
  lines.push("## Details");
  lines.push("");
  lines.push(`The project consists of ${snapshot.codeModules.length} modules with ${snapshot.testFiles.length} test files.`);
  return lines;
}

// ============================================================================
// Dry-Run Preview
// ============================================================================

function buildDryRunPreview(
  task: AgentFixTask,
  action: FixAction,
  snapshot: ProjectSnapshot,
): string {
  return [
    `[DRY-RUN] Would generate: ${action.targetPath}`,
    `  Agent: @${task.agent}`,
    `  Stage: ${action.stage}`,
    `  Artifact: ${action.artifactType}`,
    `  Description: ${action.description}`,
    task.gates.length > 0 ? `  Gates: ${task.gates.join(", ")}` : "",
    `  Project: ${snapshot.name} (${snapshot.tier})`,
  ].filter(Boolean).join("\n");
}
