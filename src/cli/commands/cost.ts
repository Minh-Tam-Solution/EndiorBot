/**
 * Cost Report Command — Sprint 141 P0-1
 *
 * Per-agent, per-provider cost telemetry dashboard.
 * Answers CPO's 3 questions:
 *   1. "Đang tốn nhất ở agent nào?"
 *   2. "Fallback nào đắt nhất?"
 *   3. "Tiết kiệm thực so với baseline bao nhiêu?"
 *
 * Usage:
 *   endiorbot cost report                    # Today's cost breakdown
 *   endiorbot cost report --week             # Weekly summary
 *   endiorbot cost report --agent coder      # Single agent detail
 *   endiorbot cost report --provider kimi    # Single provider detail
 *   endiorbot cost report --baseline         # Include savings vs pre-ADR-052
 *
 * @module cli/commands/cost
 * @sprint 141
 * @authority ADR-052 Agent-Model Tier Mapping
 */

import type { Command } from "commander";
import { getMetricsCollector, type DailyMetrics } from "../../analytics/index.js";
import { SONNET } from "../../config/models.js";

// ============================================================================
// Types
// ============================================================================

interface CostReportOptions {
  today?: boolean;
  week?: boolean;
  month?: boolean;
  agent?: string;
  provider?: string;
  baseline?: boolean;
}

// ============================================================================
// Baseline pricing (pre-ADR-052: all agents used Claude Sonnet)
// ============================================================================

const PRE_ADR052_BASELINE = {
  model: SONNET,
  inputPer1k: 0.003,
  outputPer1k: 0.015,
};

// ============================================================================
// Formatters
// ============================================================================

function formatUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function pct(a: number, b: number): string {
  if (b === 0) return "N/A";
  return `${((a / b) * 100).toFixed(1)}%`;
}

function bar(value: number, max: number, width = 20): string {
  if (max === 0) return "░".repeat(width);
  const filled = Math.round((value / max) * width);
  return "█".repeat(Math.min(filled, width)) + "░".repeat(Math.max(width - filled, 0));
}

// ============================================================================
// Report Generator
// ============================================================================

function generateReport(
  dailyMetrics: DailyMetrics[],
  options: CostReportOptions,
): string {
  const lines: string[] = [];
  const period = options.week ? "week" : options.month ? "month" : "today";

  // Aggregate across days
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalInvocations = 0;
  let totalFallbacks = 0;
  const costByAgent: Record<string, number> = {};
  const costByProvider: Record<string, number> = {};
  const tokensByAgent: Record<string, { input: number; output: number }> = {};
  const tokensByProvider: Record<string, { input: number; output: number }> = {};
  const fallbacksByProvider: Record<string, number> = {};
  const invocationsByAgent: Record<string, number> = {};

  for (const daily of dailyMetrics) {
    totalCost += daily.cost.total;
    totalInput += daily.tokens.totalInput;
    totalOutput += daily.tokens.totalOutput;
    totalInvocations += daily.usage.totalInvocations;
    totalFallbacks += daily.fallbacks?.total ?? 0;

    for (const [agent, cost] of Object.entries(daily.cost.byAgent ?? {})) {
      costByAgent[agent] = (costByAgent[agent] ?? 0) + cost;
    }
    for (const [provider, cost] of Object.entries(daily.cost.byProvider ?? {})) {
      costByProvider[provider] = (costByProvider[provider] ?? 0) + cost;
    }
    for (const [agent, tokens] of Object.entries(daily.tokens.byAgent ?? {})) {
      const existing = tokensByAgent[agent] ?? { input: 0, output: 0 };
      existing.input += tokens.input;
      existing.output += tokens.output;
      tokensByAgent[agent] = existing;
    }
    for (const [provider, tokens] of Object.entries(daily.tokens.byProvider ?? {})) {
      const existing = tokensByProvider[provider] ?? { input: 0, output: 0 };
      existing.input += tokens.input;
      existing.output += tokens.output;
      tokensByProvider[provider] = existing;
    }
    for (const [provider, count] of Object.entries(daily.fallbacks?.byProvider ?? {})) {
      fallbacksByProvider[provider] = (fallbacksByProvider[provider] ?? 0) + count;
    }
    for (const [agent, count] of Object.entries(daily.usage.byAgent ?? {})) {
      invocationsByAgent[agent] = (invocationsByAgent[agent] ?? 0) + count;
    }
  }

  // ── Header ──
  lines.push("");
  lines.push("┌───────────────────────────────────────────────────────────┐");
  lines.push(`│  💰 EndiorBot Cost Report — ${period.padEnd(30)}│`);
  lines.push("├───────────────────────────────────────────────────────────┤");
  lines.push(`│  Total Cost: ${formatUsd(totalCost).padEnd(15)} Invocations: ${String(totalInvocations).padEnd(10)}│`);
  lines.push(`│  Tokens: ${String(totalInput + totalOutput).padEnd(15)} Fallbacks: ${String(totalFallbacks).padEnd(12)}│`);
  lines.push("└───────────────────────────────────────────────────────────┘");
  lines.push("");

  // ── Question 1: "Đang tốn nhất ở agent nào?" ──
  if (!options.provider) {
    lines.push("📊 Q1: Cost by Agent (top-down)");
    lines.push("─".repeat(60));
    const sorted = Object.entries(costByAgent).sort((a, b) => b[1] - a[1]);
    const maxCost = sorted[0]?.[1] ?? 0;

    if (sorted.length === 0) {
      lines.push("  (no cost data recorded yet)");
    }
    for (const [agent, cost] of sorted) {
      if (options.agent && agent !== options.agent) continue;
      const invCount = invocationsByAgent[agent] ?? 0;
      const costPerInv = invCount > 0 ? cost / invCount : 0;
      lines.push(`  @${agent.padEnd(12)} ${formatUsd(cost).padEnd(12)} ${bar(cost, maxCost)} ${pct(cost, totalCost).padStart(6)} (${invCount} calls, ${formatUsd(costPerInv)}/call)`);
    }
    lines.push("");
  }

  // ── Question 2: "Fallback nào đắt nhất?" ──
  lines.push("📊 Q2: Cost by Provider + Fallback Impact");
  lines.push("─".repeat(60));
  const providerSorted = Object.entries(costByProvider).sort((a, b) => b[1] - a[1]);
  const maxProviderCost = providerSorted[0]?.[1] ?? 0;

  if (providerSorted.length === 0) {
    lines.push("  (no provider cost data recorded yet)");
  }
  for (const [provider, cost] of providerSorted) {
    if (options.provider && provider !== options.provider) continue;
    const fallbackCount = fallbacksByProvider[provider] ?? 0;
    const tokens = tokensByProvider[provider];
    const tokenStr = tokens ? `${tokens.input + tokens.output} tokens` : "";
    const fbStr = fallbackCount > 0 ? ` ⚠️  ${fallbackCount} fallbacks` : "";
    lines.push(`  ${provider.padEnd(15)} ${formatUsd(cost).padEnd(12)} ${bar(cost, maxProviderCost)} ${pct(cost, totalCost).padStart(6)} ${tokenStr}${fbStr}`);
  }
  lines.push("");

  // ── Question 3: "Tiết kiệm thực so với baseline bao nhiêu?" ──
  if (options.baseline || (!options.agent && !options.provider)) {
    lines.push("📊 Q3: Savings vs Pre-ADR-052 Baseline (all agents on Claude Sonnet)");
    lines.push("─".repeat(60));

    const baselineCost =
      (totalInput / 1000) * PRE_ADR052_BASELINE.inputPer1k +
      (totalOutput / 1000) * PRE_ADR052_BASELINE.outputPer1k;
    const savings = baselineCost - totalCost;
    const savingsPct = baselineCost > 0 ? (savings / baselineCost) * 100 : 0;

    lines.push(`  Baseline (Claude Sonnet):  ${formatUsd(baselineCost)}`);
    lines.push(`  Actual (ADR-052 routing):  ${formatUsd(totalCost)}`);
    lines.push(`  Savings:                   ${formatUsd(savings)} (${savingsPct.toFixed(1)}%)`);

    if (savingsPct >= 30) {
      lines.push(`  ✅ BSC-1 met: savings ≥ 30%`);
    } else if (totalInvocations > 0) {
      lines.push(`  ⚠️  BSC-1 not yet met: savings ${savingsPct.toFixed(1)}% < 30% target`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// Actions
// ============================================================================

async function reportAction(options: CostReportOptions): Promise<void> {
  const collector = getMetricsCollector();
  const period = options.week ? "week" : options.month ? "month" : "today";

  const dates = getDateRange(period);
  const dailyMetrics: DailyMetrics[] = [];
  for (const date of dates) {
    const daily = collector.getDailyMetrics(date);
    if (daily) dailyMetrics.push(daily);
  }

  console.log(generateReport(dailyMetrics, options));
}

function getDateRange(period: string): string[] {
  const dates: string[] = [];
  const now = new Date();

  if (period === "today") {
    dates.push(now.toISOString().slice(0, 10));
  } else if (period === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
  } else if (period === "month") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates;
}

// ============================================================================
// Command Registration
// ============================================================================

export function registerCostCommand(program: Command): void {
  const cost = program
    .command("cost")
    .description("Cost telemetry dashboard (Sprint 141, ADR-052)");

  cost
    .command("report")
    .description("Show cost breakdown by agent and provider")
    .option("--today", "Today only (default)")
    .option("--week", "Last 7 days")
    .option("--month", "Last 30 days")
    .option("--agent <name>", "Filter by agent name")
    .option("--provider <id>", "Filter by provider ID")
    .option("--baseline", "Include savings vs pre-ADR-052 baseline")
    .action(reportAction);
}
