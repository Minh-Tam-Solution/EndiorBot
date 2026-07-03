/**
 * Agent Command
 *
 * Invokes SDLC agents via Claude Code with context injection.
 *
 * Usage:
 *   endiorbot @pm "plan payment gateway integration"
 *   endiorbot @coder --patch "fix the auth bug"
 *   endiorbot @architect --interactive "design microservices"
 *
 * Modes:
 *   (default)      PATCH mode - generate diff, confirm before apply
 *   --read         READ mode - no file changes
 *   --interactive  INTERACTIVE mode - human takes over
 *
 * @module cli/commands/agent
 * @version 1.0.0
 * @date 2026-02-28
 * @status ACTIVE - Sprint 55
 */

import type { Command } from "commander";
import { getAgentRouter, type RoutingDecision } from "../../agents/orchestrator/agent-router.js";
import { parseMention } from "../../agents/orchestrator/mention-parser.js";
import { getContextInjector } from "../../agents/context/context-injector.js";
import { getProjectVerifier } from "../../agents/context/project-verifier.js";
import {
  getClaudeCodeBridge,
  promptConfirmation,
  type InvokeMode,
} from "../../agents/invoke/claude-code-bridge.js";
import { parseResponse } from "../../agents/invoke/response-parser.js";
import { validatePatch } from "../../agents/invoke/patch-validator.js";
import { formatManifestLog } from "../../agents/context/context-manifest.js";
import type { AgentRole } from "../../agents/types/handoff.js";
import { getWorkflowEngine } from "../../agents/orchestrator/workflow-engine.js";
import { getRiskClassifier } from "../../agents/safety/risk-classifier.js";
import { auditLog } from "../../agents/safety/audit-logger.js";
import { getCrossProjectManager, type CrossProjectContext } from "../../agents/context/cross-project.js";
import { getCRGClient, formatImpactForContext } from "../../graph/client.js";
import { execFileSync } from "node:child_process";

/** Sprint 131: Agents that benefit from CRG blast radius context */
const GRAPH_AWARE_AGENTS = new Set<AgentRole>(["reviewer", "architect", "coder", "tester"]);

/**
 * Sprint 131 (ADR-045): Build CRG context for graph-aware agents.
 * Returns a formatted context string or null if unavailable/not applicable.
 * Fail-soft: errors return null, never throw.
 */
async function buildCRGContext(agent: AgentRole, workspace: string): Promise<string | null> {
  if (!GRAPH_AWARE_AGENTS.has(agent)) return null;

  const client = getCRGClient();
  if (!client.isAvailable()) return null;

  // Detect changed files via git (fail-soft)
  let changedFiles: string[] = [];
  try {
    const output = execFileSync("git", ["-C", workspace, "diff", "--name-only", "HEAD"], {
      encoding: "utf-8",
      timeout: 3000,
    });
    changedFiles = output.trim().split("\n").filter(f => f.length > 0);
  } catch {
    return null; // not a git repo or git error
  }

  if (changedFiles.length === 0) return null;

  // Derive repo_id from workspace basename
  const parts = workspace.split("/").filter(Boolean);
  const basename = parts[parts.length - 1] ?? "unknown";
  const repoId = basename.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  try {
    const impact = await client.impactRadius(repoId, changedFiles);
    return `## Code Graph Context (CRG)\n\n${formatImpactForContext(impact)}`;
  } catch {
    return null; // CRG unavailable or repo not indexed
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Agent command options.
 */
interface AgentOptions {
  patch?: boolean;
  read?: boolean;
  interactive?: boolean;
  yes?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  tier?: "LITE" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE";
  timeout?: number;
  /** Cross-project mode: comma-separated project paths/IDs */
  projects?: string;
  /** Output file for cross-project results */
  output?: string;
  /**
   * Internal: handoff recursion depth. Not exposed as CLI flag.
   * Sprint 131 follow-up (reviewer MAJOR): caps A→B→C→A cycles that
   * ALLOWED_TRANSITIONS alone cannot block. Matches HandoffGuards.maxDepth=3.
   */
  _handoffDepth?: number;
}

// Max handoff chain depth — matches DEFAULT_HANDOFF_GUARDS.maxDepth in
// src/agents/types/handoff.ts. Allows PM → Architect → Coder (3 levels).
const MAX_HANDOFF_DEPTH = 3;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format agent role for display.
 */
function formatAgent(role: AgentRole): string {
  const icons: Record<string, string> = {
    researcher: "🔍",
    pm: "📋",
    pjm: "📊",
    architect: "🏗️",
    coder: "💻",
    reviewer: "👀",
    tester: "🧪",
    devops: "🚀",
    assistant: "🤖",
    ceo: "👔",
    cpo: "🎯",
    cto: "⚙️",
  };
  return `${icons[role] ?? "🔹"} @${role}`;
}

/**
 * Format mode for display.
 */
function formatMode(mode: InvokeMode): string {
  const formats: Record<InvokeMode, string> = {
    READ: "📖 READ",
    PATCH: "🔧 PATCH",
    INTERACTIVE: "💬 INTERACTIVE",
  };
  return formats[mode];
}

/**
 * Display routing decision.
 */
function displayRoutingDecision(decision: RoutingDecision): void {
  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│  ${formatAgent(decision.agent).padEnd(56)}│`);
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│  Task: ${decision.message.slice(0, 51).padEnd(52)}│`);
  console.log(`│  Type: ${decision.classification.taskType.padEnd(52)}│`);
  console.log(`│  Complexity: ${decision.classification.complexity.padEnd(46)}│`);
  console.log(`│  Tier: ${decision.tier.padEnd(52)}│`);

  if (decision.warnings.length > 0) {
    console.log("│".padEnd(62) + "│");
    console.log(`│  ⚠️  Warnings:`.padEnd(62) + "│");
    for (const warning of decision.warnings) {
      console.log(`│     ${warning.slice(0, 54).padEnd(55)}│`);
    }
  }

  console.log("└─────────────────────────────────────────────────────────────┘");
}

/**
 * Display handoffs from response.
 */
function displayHandoffs(
  handoffs: Array<{ to: AgentRole; intent: string; priority: string }>
): void {
  if (handoffs.length === 0) return;

  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log(`│  🔄 Handoff Requests (${handoffs.length})`.padEnd(62) + "│");
  console.log("├─────────────────────────────────────────────────────────────┤");

  for (const h of handoffs) {
    console.log(`│  → ${formatAgent(h.to)} [${h.priority}]`.padEnd(62) + "│");
    console.log(`│     ${h.intent.slice(0, 54).padEnd(55)}│`);
  }

  console.log("└─────────────────────────────────────────────────────────────┘");
}

// ============================================================================
// Command Action
// ============================================================================

/**
 * Agent command action.
 */
async function agentAction(
  input: string,
  options: AgentOptions
): Promise<void> {
  // Initialize Sprint 55B components
  const workflow = getWorkflowEngine();
  const riskClassifier = getRiskClassifier();
  const verifier = getProjectVerifier();

  // Determine mode — SDLC agents default to PATCH (CEO: agents need write access)
  let mode: InvokeMode = "PATCH";
  if (options.interactive) {
    mode = "INTERACTIVE";
  } else if (options.read) {
    mode = "READ";
  }

  console.log("");
  console.log(`🤖 EndiorBot Agent Orchestrator`);
  console.log(`   Mode: ${formatMode(mode)}`);
  console.log("");

  // Verify project before proceeding
  const workspace = process.cwd();
  const projectCheck = verifier.quickCheck(workspace);
  if (!projectCheck.exists) {
    console.error(`❌ Invalid workspace: ${workspace}`);
    process.exit(1);
  }

  if (options.verbose && !projectCheck.hasSDLCConfig) {
    console.log("⚠️  No .sdlc-config.json found (using defaults)");
  }

  // Handle cross-project mode (Sprint 59)
  let crossProjectContext: CrossProjectContext | undefined;
  if (options.projects) {
    console.log("\n🔗 Cross-project mode enabled");
    const crossProjectManager = getCrossProjectManager();
    const secondaryProjects = options.projects.split(",").map((p) => p.trim());

    try {
      crossProjectContext = await crossProjectManager.loadCrossProjectContext({
        primaryPath: workspace,
        secondaryProjects,
        tokenBudget: 50000,
        mergeStrategy: "primary-first",
      });

      console.log(crossProjectManager.formatContext(crossProjectContext));
    } catch (err) {
      console.error(`❌ Cross-project load failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  // Parse mention
  const parseResult = parseMention(input);
  if (!parseResult.success) {
    console.error(`❌ ${parseResult.error.message}`);
    console.log("");
    console.log("Usage:");
    console.log('  endiorbot @pm "plan payment gateway"');
    console.log('  endiorbot @coder --patch "fix auth bug"');
    process.exit(1);
  }

  const mention = parseResult.data;

  // Route to agent
  const router = getAgentRouter({
    tier: options.tier ?? "LITE",
  });

  const routeResult = await router.route(mention);
  if (!routeResult.success) {
    console.error(`❌ Routing failed: ${routeResult.error.message}`);
    process.exit(1);
  }

  const decision = routeResult.decision;
  displayRoutingDecision(decision);

  // Inject context
  console.log("\n🧠 Injecting context...");
  const injector = getContextInjector({
    tier: options.tier ?? "LITE",
    verbose: options.verbose ?? false,
  });

  // Build additional context from cross-project if enabled
  let additionalContext: string | undefined;
  if (crossProjectContext) {
    const contextLines = [
      "## Cross-Project Context",
      "",
      `Primary Project: ${crossProjectContext.primary.name}`,
      `Secondary Projects: ${crossProjectContext.secondary.map((p: { name: string }) => p.name).join(", ") || "None"}`,
      `Token Budget: ${crossProjectContext.totalTokens}/${crossProjectContext.tokenBudget}`,
      "",
    ];

    // Include project summaries
    if (crossProjectContext.summaries.length > 0) {
      contextLines.push("### Project Summaries");
      for (const summary of crossProjectContext.summaries) {
        contextLines.push(summary);
        contextLines.push("");
      }
    }

    // Include warnings if any
    if (crossProjectContext.warnings.length > 0) {
      contextLines.push("### Warnings");
      for (const warning of crossProjectContext.warnings) {
        contextLines.push(`- ⚠️ ${warning}`);
      }
      contextLines.push("");
    }

    additionalContext = contextLines.join("\n");
  }

  // Sprint 131 (ADR-045): CRG enrichment for graph-aware agents
  const crgContext = await buildCRGContext(decision.agent, workspace);
  if (crgContext) {
    additionalContext = additionalContext
      ? `${additionalContext}\n\n${crgContext}`
      : crgContext;
    if (options.verbose) {
      console.log("   CRG: blast radius context injected");
    }
  }

  const injection = await injector.inject({
    agent: decision.agent,
    task: decision.message,
    classification: decision.classification,
    workspace,
    ...(additionalContext ? { additionalContext } : {}),
  });

  if (options.verbose) {
    console.log("\n" + formatManifestLog(injection.manifest));
  } else {
    console.log(`   Injected: ${injection.manifest.stats.injectedItems} items, ${injection.manifest.stats.injectedTokens} tokens`);
  }

  // Classify risk
  const riskResult = riskClassifier.classify({
    agent: decision.agent,
    mode,
    task: decision.message,
  });

  if (options.verbose) {
    console.log(`\n🛡️ Risk: ${riskResult.level} (${riskResult.confirmation} confirmation)`);
  }

  // Block CRITICAL actions without explicit confirmation
  if (riskResult.level === "CRITICAL" && !options.interactive) {
    console.log("\n⚠️  CRITICAL risk detected!");
    for (const factor of riskResult.factors) {
      console.log(`   - ${factor.name}: ${factor.description} (+${factor.weight})`);
    }
    const proceed = await promptConfirmation("\nProceed with this CRITICAL action?");
    if (!proceed) {
      console.log("\n⏸️  Action cancelled by user");
      auditLog({
        agent: decision.agent,
        task: decision.message,
        project: projectCheck.isGitRepo ? workspace.split("/").pop() ?? "unknown" : "unknown",
        mode,
        tier: options.tier ?? "LITE",
        status: "cancelled",
        risk: riskResult.level,
        duration_ms: 0, // Cancelled before execution
      });
      return;
    }
  }

  // Check if dry run
  if (options.dryRun) {
    console.log("\n🏃 Dry run - not invoking Claude Code");
    console.log("\nSystem Prompt:");
    console.log("-".repeat(60));
    console.log(injection.systemPrompt.slice(0, 500) + "...");
    console.log("-".repeat(60));
    return;
  }

  // Start workflow tracking
  const startTime = Date.now();
  const workflowContext = workflow.start(
    decision.agent,
    decision.message,
    undefined, // Classification passed via metadata
    { mode, workspace, taskType: decision.classification.taskType, complexity: decision.classification.complexity }
  );

  // Model selection — PM + Architect use Opus for higher quality (CEO directive)
  const OPUS_AGENTS = new Set(["pm", "architect"]);
  const agentModel = OPUS_AGENTS.has(decision.agent) ? "opus" : undefined;

  // Invoke Claude Code
  console.log(`\n⚡ Invoking Claude Code (${mode} mode, model: ${agentModel ?? "sonnet"})...`);
  const bridge = getClaudeCodeBridge({
    verbose: options.verbose ?? false,
    defaultTimeout: options.timeout ?? 300,
  });

  // Check if Claude Code is available
  const available = await bridge.isAvailable();
  if (!available) {
    console.error("❌ Claude Code CLI not found. Make sure 'claude' is in your PATH.");
    process.exit(1);
  }

  try {
    if (mode === "INTERACTIVE") {
      // Interactive mode - hand over to human
      await bridge.invokeInteractive({
        systemPrompt: injection.systemPrompt,
        userPrompt: injection.userPrompt,
        workspace,
        agent: decision.agent,
        ...(agentModel ? { model: agentModel } : {}),
      });
      console.log("\n✅ Interactive session complete");
      process.exit(0);
    }

    if (mode === "PATCH") {
      // PATCH mode — invoke Claude with Edit tool enabled (Write still blocked).
      // When --yes or non-TTY, use direct invoke (no diff/confirm cycle).
      const autoApprove = options.yes || !process.stdin.isTTY;

      if (autoApprove) {
        const response = await bridge.invoke({
          systemPrompt: injection.systemPrompt,
          userPrompt: injection.userPrompt,
          workspace,
          agent: decision.agent,
          timeout: options.timeout ?? 300,
          mode: "PATCH",
          disallowedTools: ["NotebookEdit"],
          ...(agentModel ? { model: agentModel } : {}),
        });

        console.log("\n" + "─".repeat(60));
        if (response.success) {
          console.log(response.output);
        } else {
          console.error(`❌ Error: ${response.error}`);
        }
        console.log("─".repeat(60));

        const parsed = parseResponse(response.output);
        displayHandoffs(parsed.handoffs);
        process.exit(response.success ? 0 : 1);
      }

      // Interactive PATCH: generate diff, confirm, apply
      const initialResponse = await bridge.invokePatch(
        {
          systemPrompt: injection.systemPrompt,
          userPrompt: injection.userPrompt,
          workspace,
          agent: decision.agent,
          timeout: options.timeout ?? 300,
          ...(agentModel ? { model: agentModel } : {}),
        }
      );

      // Validate patch if we got a diff
      if (initialResponse.diff) {
        const validation = validatePatch(initialResponse.diff, workspace);
        if (!validation.allowed) {
          console.log("\n⚠️  Patch validation failed:");
          for (const risk of validation.risks) {
            console.log(`   - [${risk.severity}] ${risk.description}`);
          }
          console.log("\n" + "─".repeat(60));
          console.log(initialResponse.output);
          console.log("─".repeat(60));
          return;
        }

        // Show diff preview
        console.log("\n" + "─".repeat(60));
        console.log(initialResponse.output);
        console.log("─".repeat(60));

        // Ask for confirmation
        const confirmed = await promptConfirmation("\nApply this patch?");
        if (confirmed && initialResponse.diff) {
          // Re-invoke with callback to actually apply
          const response = await bridge.invokePatch(
            {
              systemPrompt: injection.systemPrompt,
              userPrompt: injection.userPrompt,
              workspace,
              agent: decision.agent,
              timeout: options.timeout ?? 300,
              ...(agentModel ? { model: agentModel } : {}),
            },
            async () => true // Already confirmed
          );

          if (response.applied) {
            console.log("\n✅ Patch applied successfully");
          } else {
            console.log("\n❌ Failed to apply patch");
            if (response.error) {
              console.error(`   ${response.error}`);
            }
          }

          // Parse for handoffs
          const parsed = parseResponse(response.output);
          displayHandoffs(parsed.handoffs);
        } else {
          console.log("\n⏸️  Patch not applied (declined)");
        }
      } else {
        // No diff generated
        console.log("\n" + "─".repeat(60));
        if (initialResponse.success) {
          console.log(initialResponse.output);
        } else {
          console.error(`❌ Error: ${initialResponse.error}`);
        }
        console.log("─".repeat(60));
        console.log("\n⚠️  No diff generated");

        // Parse for handoffs
        const parsed = parseResponse(initialResponse.output);
        displayHandoffs(parsed.handoffs);
      }

      process.exit(0);
    }

    // READ mode
    const response = await bridge.invokeRead({
      systemPrompt: injection.systemPrompt,
      userPrompt: injection.userPrompt,
      workspace,
      agent: decision.agent,
      timeout: options.timeout ?? 300,
      ...(agentModel ? { model: agentModel } : {}),
    });

    // Display result
    // Note: bridge already streams output to stderr in real-time (Sprint 133 UX fix).
    // Only print the separator + error here. Don't duplicate the output.
    console.log("\n" + "─".repeat(60));
    if (!response.success) {
      console.error(`❌ Error: ${response.error}`);
      process.exit(1);
    }
    console.log("─".repeat(60));

    // Parse for handoffs
    const parsed = parseResponse(response.output);
    displayHandoffs(parsed.handoffs);

    // Prompt for handoff continuation
    // Sprint 131 (ADR-046-STUB): CEO approval is the default. Opt-in auto mode
    // via ENDIORBOT_AUTO_HANDOFF=true skips the prompt for power users who trust
    // specific workflows. Destructive actions (PATCH mode) still pass through
    // existing gates regardless — see agent command PATCH flow.
    if (parsed.hasHandoff && parsed.handoffs.length > 0) {
      const firstHandoff = parsed.handoffs[0];
      if (firstHandoff) {
        const validation = router.validateTransition(decision.agent, firstHandoff.to);

        if (validation.allowed) {
          // Sprint 131 follow-up (reviewer MAJOR): cap recursion depth.
          // ALLOWED_TRANSITIONS blocks direct circular pairs, but A→B→C→A
          // cycles slip through. Match HandoffGuards.maxDepth=3 invariant.
          const currentDepth = options._handoffDepth ?? 0;
          if (currentDepth >= MAX_HANDOFF_DEPTH) {
            console.log(`\n⚠️  Handoff chain depth limit reached (${MAX_HANDOFF_DEPTH}) — stopping chain.`);
            console.log(`   Proposed next: ${formatAgent(decision.agent)} → ${formatAgent(firstHandoff.to)}`);
            console.log(`   Run manually if this chain is intentional.`);
          } else {
            console.log("");
            const autoMode = process.env.ENDIORBOT_AUTO_HANDOFF === "true";
            let continueHandoff: boolean;

            if (autoMode) {
              console.log(`⚡ Auto-handoff enabled → dispatching to ${formatAgent(firstHandoff.to)} (depth ${currentDepth + 1}/${MAX_HANDOFF_DEPTH})`);
              continueHandoff = true;
            } else {
              continueHandoff = await promptConfirmation(
                `📋 Handoff proposed: ${formatAgent(decision.agent)} → ${formatAgent(firstHandoff.to)}\n   Task: "${firstHandoff.intent}"\n   Depth: ${currentDepth + 1}/${MAX_HANDOFF_DEPTH}\n   Approve?`
              );
            }

            if (continueHandoff) {
              // Recursive call to handle next agent — increment depth counter
              const nextInput = `@${firstHandoff.to} "${firstHandoff.intent}"`;
              await agentAction(nextInput, { ...options, _handoffDepth: currentDepth + 1 });
            }
          }
        } else {
          console.log(`\n⚠️  Handoff blocked: ${validation.reason}`);
        }
      }
    }

    // Log successful completion
    const durationMs = Date.now() - startTime;
    auditLog({
      agent: decision.agent,
      task: decision.message,
      project: projectCheck.isGitRepo ? workspace.split("/").pop() ?? "unknown" : "unknown",
      mode,
      tier: options.tier ?? "LITE",
      status: "success",
      risk: riskResult.level,
      duration_ms: durationMs,
      ...(response.tokenUsage?.input ? { tokens_in: response.tokenUsage.input } : {}),
      ...(response.tokenUsage?.output ? { tokens_out: response.tokenUsage.output } : {}),
      ...(parsed.handoffs[0]?.to ? { handoff_to: parsed.handoffs[0].to } : {}),
    });

    console.log("\n✅ Agent invocation complete");
    console.log(`   Duration: ${response.durationMs ?? durationMs}ms`);
    if (response.tokenUsage) {
      console.log(`   Tokens: ${response.tokenUsage.input} in / ${response.tokenUsage.output} out`);
    }
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Log failure
    auditLog({
      agent: decision.agent,
      task: decision.message,
      project: projectCheck.isGitRepo ? workspace.split("/").pop() ?? "unknown" : "unknown",
      mode,
      tier: options.tier ?? "LITE",
      status: "error",
      risk: riskResult.level,
      duration_ms: Date.now() - startTime,
    });

    // Update workflow state
    workflow.failStep(workflowContext.id, message);

    console.error(`\n❌ Agent invocation failed: ${message}`);
    process.exit(1);
  }
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register agent command.
 *
 * Supports @agent syntax at the start of input.
 */
export function registerAgentCommand(program: Command): void {
  // Note: Commander doesn't support @ prefix directly,
  // so we register as a regular command and handle @ parsing
  program
    .command("agent <input...>")
    .alias("@")
    .description("Invoke an SDLC agent via Claude Code")
    .option("--patch", "Enable PATCH mode (default — generate diff, confirm before apply)")
    .option("--read", "Enable READ mode (no file changes)")
    .option("--interactive", "Enable INTERACTIVE mode (human takes over)")
    .option("-y, --yes", "Auto-approve patches without confirmation")
    .option("-v, --verbose", "Show detailed context manifest and output")
    .option("--dry-run", "Show what would be done without executing")
    .option(
      "--tier <tier>",
      "Set tier (LITE, STANDARD, PROFESSIONAL, ENTERPRISE)",
      "LITE"
    )
    .option("--timeout <seconds>", "Set timeout in seconds", "300")
    .option("--projects <projects>", "Cross-project mode: comma-separated project paths (e.g., project-a,project-b)")
    .option("--output <file>", "Output file for results (cross-project mode)")
    .action(async (inputParts: string[], options: AgentOptions) => {
      // Join input parts back together
      let input = inputParts.join(" ");

      // Ensure @ prefix
      if (!input.startsWith("@")) {
        input = "@" + input;
      }

      // Parse timeout
      if (typeof options.timeout === "string") {
        options.timeout = parseInt(options.timeout, 10);
      }

      await agentAction(input, options);
    });

  // Register shorthand commands for SE4A agents (all tiers)
  const se4aAgents: AgentRole[] = [
    "researcher",
    "pm",
    "pjm",
    "architect",
    "coder",
    "reviewer",
    "tester",
    "devops",
  ];

  // SE4H agents (STANDARD+ tier only - advisor roles)
  const se4hAgents: AgentRole[] = [
    "ceo",
    "cpo",
    "cto",
  ];

  const agents = [...se4aAgents, ...se4hAgents];

  // SE4H agent descriptions with tier requirement
  const se4hDescriptions: Record<string, string> = {
    ceo: "Strategic direction and executive review (STANDARD+ tier)",
    cpo: "Product vision and prioritization (STANDARD+ tier)",
    cto: "Technical standards and architecture review (STANDARD+ tier)",
  };

  for (const agent of agents) {
    const isSe4h = se4hAgents.includes(agent);
    const description = isSe4h
      ? se4hDescriptions[agent] ?? `Invoke @${agent} agent`
      : `Invoke @${agent} agent`;

    program
      .command(`${agent} <message...>`)
      .description(description)
      .option("--patch", "Enable PATCH mode (default)")
      .option("--read", "Enable READ mode (no file changes)")
      .option("--interactive", "Enable INTERACTIVE mode")
      .option("-y, --yes", "Auto-approve patches")
      .option("-v, --verbose", "Show detailed output")
      .option("--dry-run", "Show what would be done")
      .option("--tier <tier>", "Set tier", isSe4h ? "STANDARD" : "LITE")
      .option("--timeout <seconds>", "Set timeout", "300")
      .action(async (messageParts: string[], options: AgentOptions) => {
        const message = messageParts.join(" ");
        const input = `@${agent} "${message}"`;

        if (typeof options.timeout === "string") {
          options.timeout = parseInt(options.timeout, 10);
        }

        await agentAction(input, options);
      });
  }
}

