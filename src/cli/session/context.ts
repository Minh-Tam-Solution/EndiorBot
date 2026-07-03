/**
 * Session Context
 *
 * Module-scoped singleton for session state management.
 * Commander.js setOptionValue() does NOT propagate to subcommand action handlers,
 * so session state is managed here as a module-level singleton.
 *
 * @module cli/session/context
 * @version 1.0.0
 * @date 2026-03-03
 * @status ACTIVE - Sprint 73
 * @authority TS-011 CLI Session Mode, CTO Review (Blocking Issue #2)
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { ActiveProjectState } from "../../config/paths.js";

/**
 * Session state maintained across commands in interactive mode.
 */
export interface SessionState {
  /** Active project context (loaded once) */
  project: ActiveProjectState | null;

  /** Project path */
  projectPath: string;

  /** Session start time */
  startedAt: Date;

  /** Commands executed count */
  commandCount: number;

  /** Command history */
  history: string[];

  /** Last command had error */
  lastError: boolean;
}

// ============================================================================
// Module-Scoped Singleton
// ============================================================================

let _sessionState: SessionState | null = null;

/** Set by shell.ts at session start */
export function setSessionState(state: SessionState): void {
  _sessionState = state;
}

/** Called by command handlers to check if running in session mode */
export function getSessionState(): SessionState | null {
  return _sessionState;
}

/** Check if currently in session mode */
export function isSessionMode(): boolean {
  return _sessionState !== null;
}

/** Clear session state on exit */
export function clearSessionState(): void {
  _sessionState = null;
}
