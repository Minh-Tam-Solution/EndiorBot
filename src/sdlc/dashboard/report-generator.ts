/**
 * Compliance Report Generator
 *
 * Generates compliance reports in multiple formats (Markdown, JSON, HTML).
 *
 * @module sdlc/dashboard/report-generator
 * @version 1.0.0
 * @date 2026-03-02
 * @status ACTIVE - Sprint 68
 * @authority Master Plan v4.2, Sprint 68 T3.4
 * @sprint 68
 */

import { createLogger, type Logger } from "../../logging/index.js";
import {
  type ComplianceDashboard,
  type ComplianceReport,
  type ReportOptions,
} from "./types.js";
import { ComplianceDashboardEngine } from "./compliance-dashboard.js";

// ============================================================================
// Report Generator
// ============================================================================

/**
 * Generates compliance reports from dashboard data.
 *
 * @example
 * ```typescript
 * const generator = new ReportGenerator(dashboardEngine);
 *
 * const report = await generator.generate({
 *   format: 'markdown',
 *   includeSuggestions: true,
 * });
 *
 * console.log(report.content);
 * ```
 */
export class ReportGenerator {
  private readonly log: Logger;
  private readonly dashboardEngine: ComplianceDashboardEngine;

  constructor(dashboardEngine: ComplianceDashboardEngine) {
    this.log = createLogger("ReportGenerator");
    this.dashboardEngine = dashboardEngine;
  }

  /**
   * Generate a compliance report.
   */
  async generate(options: ReportOptions): Promise<ComplianceReport> {
    const startTime = Date.now();
    this.log.debug("Generating compliance report", { format: options.format });

    // Get fresh dashboard data
    const dashboard = await this.dashboardEngine.refresh(true);

    // Generate content based on format
    let content: string;
    switch (options.format) {
      case "markdown":
        content = this.generateMarkdown(dashboard, options);
        break;
      case "json":
        content = this.generateJson(dashboard, options);
        break;
      case "html":
        content = this.generateHtml(dashboard, options);
        break;
      default:
        content = this.generateMarkdown(dashboard, options);
    }

    const report: ComplianceReport = {
      title: options.title ?? "SDLC Compliance Report",
      format: options.format,
      content,
      dashboard,
      generatedAt: new Date().toISOString(),
    };

    this.log.info("Report generated", {
      format: options.format,
      durationMs: Date.now() - startTime,
    });

    return report;
  }

  // ============================================================================
  // Markdown Generation
  // ============================================================================

  /**
   * Generate Markdown report.
   */
  private generateMarkdown(
    dashboard: ComplianceDashboard,
    options: ReportOptions
  ): string {
    const lines: string[] = [];
    const title = options.title ?? "SDLC Compliance Report";

    // Header
    lines.push(`# ${title}`);
    lines.push("");
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Overall Score:** ${dashboard.overallScore}/100`);
    lines.push(`**Status:** ${this.formatStatus(dashboard.status)}`);
    lines.push("");

    // Summary Table
    lines.push("## Summary");
    lines.push("");
    lines.push("| Stage | Score | Status | Issues |");
    lines.push("|-------|-------|--------|--------|");

    for (const stage of dashboard.stages) {
      const statusEmoji = this.getStatusEmoji(stage.status);
      const issueCount = stage.issues.length;
      lines.push(
        `| ${stage.name} | ${stage.score}% | ${statusEmoji} | ${issueCount} |`
      );
    }
    lines.push("");

    // Issues Section
    if (dashboard.issues.length > 0) {
      lines.push("## Issues");
      lines.push("");

      const maxIssues = options.maxIssues ?? dashboard.issues.length;
      const issuesToShow = dashboard.issues.slice(0, maxIssues);

      for (const issue of issuesToShow) {
        const severityEmoji = this.getSeverityEmoji(issue.severity);
        lines.push(`### ${severityEmoji} ${issue.message}`);
        lines.push("");
        lines.push(`- **Stage:** ${issue.stage}`);
        lines.push(`- **Severity:** ${issue.severity}`);
        if (issue.artifactPath) {
          lines.push(`- **Artifact:** \`${issue.artifactPath}\``);
        }
        if (options.includeSuggestions && issue.suggestion) {
          lines.push(`- **Suggestion:** ${issue.suggestion}`);
        }
        lines.push("");
      }

      if (dashboard.issues.length > maxIssues) {
        lines.push(
          `*... and ${dashboard.issues.length - maxIssues} more issues*`
        );
        lines.push("");
      }
    }

    // Stage Details
    if (options.includeStageDetails) {
      lines.push("## Stage Details");
      lines.push("");

      for (const stage of dashboard.stages) {
        lines.push(`### ${stage.name} (${stage.stage})`);
        lines.push("");
        lines.push(`- **Score:** ${stage.score}%`);
        lines.push(`- **Status:** ${this.getStatusEmoji(stage.status)} ${stage.status}`);

        if (stage.missingArtifacts.length > 0) {
          lines.push(`- **Missing Artifacts:**`);
          for (const artifact of stage.missingArtifacts) {
            lines.push(`  - \`${artifact}\``);
          }
        }

        if (stage.issues.length > 0) {
          lines.push(`- **Issues:** ${stage.issues.length}`);
        }

        lines.push("");
      }
    }

    // Patch History
    if (options.includePatchHistory && dashboard.recentPatches.length > 0) {
      lines.push("## Recent Patches");
      lines.push("");

      const maxPatches = options.maxPatches ?? 5;
      const patchesToShow = dashboard.recentPatches.slice(0, maxPatches);

      for (const patch of patchesToShow) {
        const stateEmoji = this.getPatchStateEmoji(patch.state);
        lines.push(
          `- ${stateEmoji} **${patch.name}** (${patch.id})`
        );
        lines.push(`  - Author: ${patch.author}`);
        lines.push(`  - Changes: ${patch.changes.length} files`);
        lines.push(`  - State: ${patch.state}`);
      }
      lines.push("");
    }

    // Footer
    lines.push("---");
    lines.push("");
    lines.push("*Generated by EndiorBot SDLC Framework v6.4.0*");

    return lines.join("\n");
  }

  // ============================================================================
  // JSON Generation
  // ============================================================================

  /**
   * Generate JSON report.
   */
  private generateJson(
    dashboard: ComplianceDashboard,
    options: ReportOptions
  ): string {
    const report = {
      title: options.title ?? "SDLC Compliance Report",
      generatedAt: new Date().toISOString(),
      summary: {
        overallScore: dashboard.overallScore,
        status: dashboard.status,
        stageCount: dashboard.stages.length,
        issueCount: dashboard.issues.length,
        patchCount: dashboard.recentPatches.length,
      },
      stages: dashboard.stages.map((s) => ({
        stage: s.stage,
        name: s.name,
        score: s.score,
        status: s.status,
        missingArtifacts: s.missingArtifacts,
        issueCount: s.issues.length,
        ...(options.includeStageDetails ? { issues: s.issues } : {}),
      })),
      issues: options.maxIssues
        ? dashboard.issues.slice(0, options.maxIssues)
        : dashboard.issues,
      ...(options.includePatchHistory
        ? {
            recentPatches: dashboard.recentPatches.slice(
              0,
              options.maxPatches ?? 5
            ),
          }
        : {}),
    };

    return JSON.stringify(report, null, 2);
  }

  // ============================================================================
  // HTML Generation
  // ============================================================================

  /**
   * Generate HTML report.
   */
  private generateHtml(
    dashboard: ComplianceDashboard,
    options: ReportOptions
  ): string {
    const title = options.title ?? "SDLC Compliance Report";
    const statusColor = this.getStatusColor(dashboard.status);

    const stageRows = dashboard.stages
      .map(
        (s) => `
        <tr>
          <td>${s.name}</td>
          <td>${s.score}%</td>
          <td style="color: ${this.getStatusColor(s.status)}">${s.status}</td>
          <td>${s.issues.length}</td>
        </tr>
      `
      )
      .join("");

    const issueRows = dashboard.issues
      .slice(0, options.maxIssues ?? 20)
      .map(
        (i) => `
        <tr>
          <td style="color: ${this.getSeverityColor(i.severity)}">${i.severity}</td>
          <td>${i.stage}</td>
          <td>${i.message}</td>
        </tr>
      `
      )
      .join("");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .summary-card { padding: 15px; border-radius: 8px; background: #f5f5f5; }
    .score { font-size: 48px; font-weight: bold; color: ${statusColor}; }
    .status { font-size: 18px; color: ${statusColor}; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Generated: ${new Date().toISOString()}</p>

  <div class="summary">
    <div class="summary-card">
      <div class="score">${dashboard.overallScore}</div>
      <div>Overall Score</div>
    </div>
    <div class="summary-card">
      <div class="status">${dashboard.status}</div>
      <div>Status</div>
    </div>
    <div class="summary-card">
      <div style="font-size: 24px; font-weight: bold;">${dashboard.issues.length}</div>
      <div>Issues</div>
    </div>
  </div>

  <h2>Stage Compliance</h2>
  <table>
    <thead>
      <tr><th>Stage</th><th>Score</th><th>Status</th><th>Issues</th></tr>
    </thead>
    <tbody>
      ${stageRows}
    </tbody>
  </table>

  ${
    dashboard.issues.length > 0
      ? `
  <h2>Issues</h2>
  <table>
    <thead>
      <tr><th>Severity</th><th>Stage</th><th>Message</th></tr>
    </thead>
    <tbody>
      ${issueRows}
    </tbody>
  </table>
  `
      : ""
  }

  <div class="footer">
    Generated by EndiorBot SDLC Framework v6.4.0
  </div>
</body>
</html>
    `.trim();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      compliant: "Compliant",
      warning: "Warning",
      "non-compliant": "Non-Compliant",
    };
    return statusMap[status] ?? status;
  }

  private getStatusEmoji(status: string): string {
    const emojiMap: Record<string, string> = {
      pass: "✅",
      warning: "⚠️",
      fail: "❌",
      compliant: "✅",
      "non-compliant": "❌",
    };
    return emojiMap[status] ?? "❓";
  }

  private getSeverityEmoji(severity: string): string {
    const emojiMap: Record<string, string> = {
      error: "🔴",
      warning: "🟡",
      info: "🔵",
    };
    return emojiMap[severity] ?? "⚪";
  }

  private getPatchStateEmoji(state: string): string {
    const emojiMap: Record<string, string> = {
      pending: "🔄",
      committed: "✅",
      rolledback: "↩️",
    };
    return emojiMap[state] ?? "❓";
  }

  private getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      pass: "#28a745",
      warning: "#ffc107",
      fail: "#dc3545",
      compliant: "#28a745",
      "non-compliant": "#dc3545",
    };
    return colorMap[status] ?? "#6c757d";
  }

  private getSeverityColor(severity: string): string {
    const colorMap: Record<string, string> = {
      error: "#dc3545",
      warning: "#ffc107",
      info: "#17a2b8",
    };
    return colorMap[severity] ?? "#6c757d";
  }
}
