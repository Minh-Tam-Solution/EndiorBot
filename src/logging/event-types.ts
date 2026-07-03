/**
 * Event Types for Checkpoint/Resume System
 *
 * Defines event log types for the Autonomy Epic (Sprint 35).
 * Events are written to ~/.endiorbot/events.jsonl in append-only mode.
 *
 * @module logging/event-types
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 1
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Event Phases
// ============================================================================

/**
 * Event phases in the autonomous execution lifecycle.
 */
export type EventPhase =
  | "checkpoint" // Saving execution state
  | "resume" // Restoring execution state
  | "execute" // General execution
  | "tool_call" // Tool invocation
  | "gate_eval" // SDLC gate evaluation
  | "conflict" // File conflict detection
  | "rollback"; // Rolling back changes

// ============================================================================
// Event Outcomes
// ============================================================================

/**
 * Outcome of an event.
 */
export type EventOutcome =
  | "success" // Operation completed successfully
  | "failure" // Operation failed
  | "partial" // Operation partially completed
  | "skipped"; // Operation skipped (e.g., idempotent retry)

// ============================================================================
// Event Log Interface
// ============================================================================

/**
 * Event log entry for checkpoint/resume system.
 *
 * Log-Lite: Minimal overhead, append-only.
 * Per ADR-006 and Sprint 35 requirements.
 *
 * @example
 * ```json
 * {
 *   "timestamp": "2026-02-22T10:30:00.000Z",
 *   "phase": "checkpoint",
 *   "action": "save_checkpoint",
 *   "outcome": "success",
 *   "files_touched_count": 12,
 *   "retry_count": 0,
 *   "context": { "reason": "gate_pass", "gate": "G1" }
 * }
 * ```
 */
export interface EventLog {
  /** Event timestamp (ISO 8601) */
  timestamp: Date;

  /** Event phase in execution lifecycle */
  phase: EventPhase;

  /** Action being performed */
  action: string;

  /** Tool name if phase is 'tool_call' */
  tool?: string;

  /** Outcome of the action */
  outcome: EventOutcome;

  /** Cost delta for this event (in USD) */
  cost_delta?: number;

  /** Number of files touched by this event */
  files_touched_count: number;

  /** Number of retry attempts */
  retry_count: number;

  /**
   * Minimal context (no PII, no secrets).
   * Example: { "reason": "gate_pass", "gate": "G1" }
   */
  context?: Record<string, string>;
}

// ============================================================================
// Serialized Event Log
// ============================================================================

/**
 * Serialized event log entry (for JSONL storage).
 * Same as EventLog but with timestamp as ISO string.
 */
export interface SerializedEventLog {
  timestamp: string;
  phase: EventPhase;
  action: string;
  tool?: string;
  outcome: EventOutcome;
  cost_delta?: number;
  files_touched_count: number;
  retry_count: number;
  context?: Record<string, string>;
}

// ============================================================================
// Event Factory Functions
// ============================================================================

/**
 * Create a checkpoint event.
 */
export function createCheckpointEvent(
  action: string,
  outcome: EventOutcome,
  filesTouchedCount: number,
  context?: Record<string, string>,
): EventLog {
  const event: EventLog = {
    timestamp: new Date(),
    phase: "checkpoint",
    action,
    outcome,
    files_touched_count: filesTouchedCount,
    retry_count: 0,
  };
  if (context !== undefined) {
    event.context = context;
  }
  return event;
}

/**
 * Create a resume event.
 */
export function createResumeEvent(
  action: string,
  outcome: EventOutcome,
  filesTouchedCount: number,
  retryCount: number = 0,
  context?: Record<string, string>,
): EventLog {
  const event: EventLog = {
    timestamp: new Date(),
    phase: "resume",
    action,
    outcome,
    files_touched_count: filesTouchedCount,
    retry_count: retryCount,
  };
  if (context !== undefined) {
    event.context = context;
  }
  return event;
}

/**
 * Create a tool call event.
 */
export function createToolCallEvent(
  tool: string,
  action: string,
  outcome: EventOutcome,
  costDelta?: number,
  retryCount: number = 0,
  context?: Record<string, string>,
): EventLog {
  const event: EventLog = {
    timestamp: new Date(),
    phase: "tool_call",
    action,
    tool,
    outcome,
    files_touched_count: 0,
    retry_count: retryCount,
  };
  if (costDelta !== undefined) {
    event.cost_delta = costDelta;
  }
  if (context !== undefined) {
    event.context = context;
  }
  return event;
}

/**
 * Create a gate evaluation event.
 */
export function createGateEvent(
  gate: string,
  outcome: EventOutcome,
  context?: Record<string, string>,
): EventLog {
  const event: EventLog = {
    timestamp: new Date(),
    phase: "gate_eval",
    action: `evaluate_${gate}`,
    outcome,
    files_touched_count: 0,
    retry_count: 0,
    context: { gate },
  };
  if (context !== undefined) {
    event.context = { gate, ...context };
  }
  return event;
}

/**
 * Create a conflict detection event.
 */
export function createConflictEvent(
  action: string,
  outcome: EventOutcome,
  filesTouchedCount: number,
  context?: Record<string, string>,
): EventLog {
  const event: EventLog = {
    timestamp: new Date(),
    phase: "conflict",
    action,
    outcome,
    files_touched_count: filesTouchedCount,
    retry_count: 0,
  };
  if (context !== undefined) {
    event.context = context;
  }
  return event;
}

/**
 * Create a rollback event.
 */
export function createRollbackEvent(
  action: string,
  outcome: EventOutcome,
  filesTouchedCount: number,
  context?: Record<string, string>,
): EventLog {
  const event: EventLog = {
    timestamp: new Date(),
    phase: "rollback",
    action,
    outcome,
    files_touched_count: filesTouchedCount,
    retry_count: 0,
  };
  if (context !== undefined) {
    event.context = context;
  }
  return event;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize an event log entry to JSON string for JSONL storage.
 */
export function serializeEvent(event: EventLog): string {
  const serialized: SerializedEventLog = {
    timestamp: event.timestamp.toISOString(),
    phase: event.phase,
    action: event.action,
    outcome: event.outcome,
    files_touched_count: event.files_touched_count,
    retry_count: event.retry_count,
  };

  if (event.tool !== undefined) {
    serialized.tool = event.tool;
  }
  if (event.cost_delta !== undefined) {
    serialized.cost_delta = event.cost_delta;
  }
  if (event.context !== undefined) {
    serialized.context = event.context;
  }

  return JSON.stringify(serialized);
}

/**
 * Deserialize a JSON string to an event log entry.
 */
export function deserializeEvent(json: string): EventLog {
  const serialized: SerializedEventLog = JSON.parse(json);
  const event: EventLog = {
    timestamp: new Date(serialized.timestamp),
    phase: serialized.phase,
    action: serialized.action,
    outcome: serialized.outcome,
    files_touched_count: serialized.files_touched_count,
    retry_count: serialized.retry_count,
  };

  if (serialized.tool !== undefined) {
    event.tool = serialized.tool;
  }
  if (serialized.cost_delta !== undefined) {
    event.cost_delta = serialized.cost_delta;
  }
  if (serialized.context !== undefined) {
    event.context = serialized.context;
  }

  return event;
}
