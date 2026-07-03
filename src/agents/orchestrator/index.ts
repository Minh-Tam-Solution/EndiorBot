/**
 * Orchestrator Module
 *
 * Multi-model orchestration for expert consultation.
 *
 * @module agents/orchestrator
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 6 Implementation
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Agent Personas
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

export {
  MultiModelOrchestrator,
  getOrchestrator,
  resetOrchestrator,
  DEFAULT_ORCHESTRATOR_CONFIG,
  type ProviderId,
  type ModelRole,
  type TaskType,
  type QueryStatus,
  type ModelConfig,
  type ModelQueryResult,
  type ConsensusPoint,
  type Disagreement,
  type ConsultationResult,
  type OrchestratorConfig,
} from "./multi-model-orchestrator.js";

// Task Classifier
export {
  TaskClassifier,
  getTaskClassifier,
  resetTaskClassifier,
  createTaskClassifier,
} from "./task-classifier.js";

// Agent Router
export {
  AgentRouter,
  getAgentRouter,
  resetAgentRouter,
  createAgentRouter,
  type SoulMetadata,
  type SoulTemplate,
  type TierConfig,
  type RoutingDecision,
  type RoutingError,
  type RoutingResult,
  type RouterConfig,
} from "./agent-router.js";

// Mention Parser
export {
  parseMention,
  parseCLIMention,
  parseOTTMention,
  getFirstAgent,
  hasMention,
  getExecutorAgents,
  formatMention,
  type ParsedMention,
  type ParseError,
  type ParseResult,
} from "./mention-parser.js";

// Team Registry (ADR-017)
export {
  TeamRegistry,
  getTeamRegistry,
  resetTeamRegistry,
  createTeamRegistry,
} from "./team-registry.js";

// Workflow Templates
export {
  WorkflowTemplateManager,
  getWorkflowTemplateManager,
  resetWorkflowTemplateManager,
  WORKFLOW_TEMPLATES,
  type WorkflowTemplate,
  type TemplateStep,
  type TemplateExecutionOptions,
} from "./workflow-templates.js";
