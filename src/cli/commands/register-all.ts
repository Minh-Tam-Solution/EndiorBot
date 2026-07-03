/**
 * Register All Commands
 *
 * Centralized command registration helper to avoid duplication
 * between cli/index.ts (single-command mode) and shell.ts (session mode).
 *
 * NOTE: Does NOT register the shell command itself to prevent recursion.
 *
 * @module cli/commands/register-all
 * @version 1.0.0
 * @date 2026-03-03
 * @status ACTIVE - Sprint 73
 * @authority TS-011 CLI Session Mode, CTO Review (Blocking Issue #1)
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { Command } from "commander";
import {
  registerStartCommand,
  registerSwitchCommand,
  registerStatusCommand,
  registerGateCommand,
  registerConsultCommand,
  registerCommandsListCommand,
  registerConfigCommand,
  registerCheckpointCommand,
  registerResumeCommand,
  registerQueueCommand,
  registerFixCommand,
  registerFixStatsCommand,
  registerFixesCommand,
  registerGatewayCommand,
  registerBrainCommand,
  registerEvalCommand,
  registerSetupCommand,
  registerSecretsCommand,
  registerAgentCommand,
  registerEvidenceCommand,
  registerContextCommand,
  registerWorkflowCommand,
  registerAnalyticsCommand,
  registerPerformanceCommand,
  registerCostCommand,
  registerInitCommand,
  registerComplianceCommand,
  registerDevopsCommand,
  registerBridgeCommand,
  registerServeCommand,
  registerSprintCloseCommand,
  registerBootstrapCommand,
  registerPlanCommand,
  registerChatCommand,
  registerExecPolicyCommand,
  registerReposCommand,
  registerApproveCommand,
  registerRejectCommand,
  registerAuditCommand,
  registerWebhooksCommand,
  registerSkillsCommand,
  registerAuditClaudeMdCommand,
} from "./index.js";

/**
 * Register all CLI commands on a Commander program instance.
 *
 * Does NOT register the shell command to prevent infinite recursion
 * when used inside the session REPL dispatcher.
 */
export function registerAllCommands(program: Command): void {
  registerStartCommand(program);
  registerSwitchCommand(program);
  registerStatusCommand(program);
  registerGateCommand(program);
  registerConsultCommand(program);
  registerCommandsListCommand(program);
  registerConfigCommand(program);
  registerCheckpointCommand(program);
  registerResumeCommand(program);
  registerQueueCommand(program);
  registerFixCommand(program);
  registerFixStatsCommand(program);
  registerFixesCommand(program);
  registerGatewayCommand(program);
  registerBrainCommand(program);
  registerEvalCommand(program);
  registerSetupCommand(program);
  registerSecretsCommand(program);
  registerAgentCommand(program);
  registerEvidenceCommand(program);
  registerContextCommand(program);
  registerWorkflowCommand(program);
  registerAnalyticsCommand(program);
  registerPerformanceCommand(program);
  registerCostCommand(program);
  registerInitCommand(program);
  registerComplianceCommand(program);
  registerDevopsCommand(program);
  registerBridgeCommand(program);
  registerServeCommand(program);
  registerSprintCloseCommand(program);
  registerBootstrapCommand(program);
  registerPlanCommand(program);
  registerChatCommand(program);
  registerExecPolicyCommand(program);
  registerReposCommand(program);
  registerApproveCommand(program);
  registerRejectCommand(program);
  registerAuditCommand(program);
  registerWebhooksCommand(program);
  registerSkillsCommand(program);
  registerAuditClaudeMdCommand(program);
}
