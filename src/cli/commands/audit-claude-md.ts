/**
 * Audit CLAUDE.md Command — Check for stale references, size bloat, outdated patterns.
 *
 * Sprint 153, Plan U4.
 *
 * @module cli/commands/audit-claude-md
 * @sdlc SDLC Framework 6.4.0
 */

import type { Command } from "commander";
import { resolve } from "node:path";
import {
  auditClaudeMd,
  acceptWarning,
} from "../../sdlc/compliance/claude-md-auditor.js";
import { fmt } from "../ui/format.js";

export function registerAuditClaudeMdCommand(program: Command): void {
  program
    .command("audit-claude-md")
    .description(
      "Check CLAUDE.md files for stale references, size bloat, and outdated patterns"
    )
    .option("--path <path>", "Project path", process.cwd())
    .option("--accept <id>", "Suppress a warning by ID")
    .action((options: { path: string; accept?: string }) => {
      const projectPath = resolve(options.path);

      // Handle --accept mode
      if (options.accept) {
        acceptWarning(projectPath, options.accept);
        console.log(fmt.success(`Suppressed warning: ${options.accept}`));
        return;
      }

      // Run audit
      const result = auditClaudeMd(projectPath);

      // Display file info
      console.log(fmt.bold(`CLAUDE.md Audit — ${projectPath}\n`));

      if (result.files.length === 0) {
        console.log(fmt.dim("  No CLAUDE.md files found."));
        return;
      }

      for (const file of result.files) {
        const sizeStatus =
          file.lines > 300
            ? fmt.yellow(`${file.lines} lines`)
            : fmt.green(`${file.lines} lines`);
        console.log(
          `  ${file.path}: ${sizeStatus}, last modified ${file.daysSinceModified} days ago`
        );
      }

      console.log();

      // Display active warnings
      if (result.activeWarnings.length > 0) {
        console.log(fmt.bold("  Issues:"));
        for (const w of result.activeWarnings) {
          const icon = w.severity === "warning" ? "⚠" : "ℹ";
          const lineRef = w.line > 0 ? `:${w.line}` : "";
          console.log(
            `    ${icon} [${w.id}] ${w.file}${lineRef} — ${w.message}`
          );
        }
      } else {
        console.log(fmt.success("  No issues found."));
      }

      // Display suppressed count
      if (result.suppressed.length > 0) {
        console.log(
          fmt.dim(
            `\n  Suppressed: ${result.suppressed.length} (use --accept <id> to manage)`
          )
        );
      }
    });
}
