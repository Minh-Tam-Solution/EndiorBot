/**
 * Skills Command — List discovered skills in project.
 *
 * Sprint 152, Plan U3.
 *
 * @module cli/commands/skills
 * @sdlc SDLC Framework 6.3.1
 */

import type { Command } from "commander";
import { resolve } from "node:path";
import { discoverSkills } from "../../sdlc/scaffold/plugin-loader.js";
import { fmt } from "../ui/format.js";

export function registerSkillsCommand(program: Command): void {
  program
    .command("skills")
    .description("List discovered skills in project skills/ directory")
    .option("--path <path>", "Project path", process.cwd())
    .action((options: { path: string }) => {
      const projectPath = resolve(options.path);
      const skills = discoverSkills(projectPath);

      if (skills.length === 0) {
        console.log(fmt.dim("No skills found in skills/ directory."));
        console.log(
          fmt.dim("Run 'endiorbot init' to create the skills/ scaffold.")
        );
        return;
      }

      console.log(fmt.bold(`Discovered ${skills.length} skill(s):\n`));
      for (const skill of skills) {
        const source = skill.source === "folder" ? "📁" : skill.source === "root" ? "📋" : "📄";
        console.log(`  ${source} ${fmt.bold(skill.name)}`);
        if (skill.description) {
          console.log(`     ${fmt.dim(skill.description)}`);
        }
        if (skill.argumentHint) {
          console.log(
            `     ${fmt.dim(`Usage: /${skill.name} ${skill.argumentHint}`)}`
          );
        }
        console.log();
      }
    });
}
