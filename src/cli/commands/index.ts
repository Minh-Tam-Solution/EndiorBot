/**
 * CLI Commands Module
 *
 * Exports all CLI command registrations.
 *
 * @module cli/commands
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 6 Implementation
 * @authority ADR-006 CLI Architecture
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

export { registerStartCommand } from "./start.js";
export { registerSwitchCommand } from "./switch.js";
export { registerStatusCommand } from "./status.js";
export { registerGateCommand } from "./gate.js";
export { registerConsultCommand } from "./consult.js";
export { registerCommandsListCommand } from "./commands-list.js";
export { registerConfigCommand } from "./config.js";
export { registerCheckpointCommand, registerResumeCommand } from "./checkpoint.js";
export { registerQueueCommand } from "./queue.js";
export { registerFixCommand } from "./fix.js";
export { registerFixStatsCommand } from "./fix-stats.js";
export { registerFixesCommand } from "./fixes.js";
export { registerGatewayCommand } from "./gateway.js";
export { registerBrainCommand } from "./brain.js";
export { registerEvalCommand } from "./eval.js";
export { registerSetupCommand } from "./setup.js";
export { registerSecretsCommand } from "./secrets.js";
export { registerAgentCommand } from "./agent.js";
export { registerEvidenceCommand } from "./evidence.js";
export { registerContextCommand } from "./context.js";
export { registerWorkflowCommand } from "./workflow.js";
export { registerAnalyticsCommand } from "./analytics.js";
export { registerPerformanceCommand } from "./performance.js";
export { registerCostCommand } from "./cost.js";
export { registerInitCommand } from "./init.js";
export { registerComplianceCommand } from "./compliance.js";
export { registerDevopsCommand } from "./devops.js";
export { registerBridgeCommand } from "./bridge.js";
export { registerServeCommand } from "./serve.js";
export { registerShellCommand } from "./shell.js";
export { registerSprintCloseCommand } from "./sprint-close.js";
export { registerBootstrapCommand } from "./bootstrap.js";
export { registerPlanCommand } from "./plan.js";
export { registerChatCommand } from "./chat.js";
export { registerExecPolicyCommand } from "./exec-policy.js";
export { registerReposCommand } from "./repos.js";
export { registerApproveCommand } from "./approve.js";
export { registerRejectCommand } from "./reject.js";
export { registerAuditCommand } from "./audit.js";
export { registerWebhooksCommand } from "./webhooks.js";
export { registerSkillsCommand } from "./skills.js";
export { registerAuditClaudeMdCommand } from "./audit-claude-md.js";
export { registerAllCommands } from "./register-all.js";
