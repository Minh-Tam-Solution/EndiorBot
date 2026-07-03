/**
 * Reflect Step
 *
 * Reflect-after-tools pattern for LLM self-correction.
 * Ported from SDLC-Orchestrator: reflect_step.py
 *
 * Injects a reflection prompt after tool execution batches so the LLM
 * can self-correct errors. Frequency is configurable per agent.
 *
 * @module agents/quality/reflect-step
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.2 Implementation
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { Message } from "../../providers/types.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Default reflection prompt injected after tool execution.
 */
export const REFLECT_PROMPT =
  "Review the tool results above. Were there any errors or unexpected outcomes? " +
  "If so, explain what went wrong and suggest a corrected approach. " +
  "If everything looks correct, confirm and proceed.";

// ============================================================================
// Types
// ============================================================================

export interface ToolResult {
  tool: string;
  success: boolean;
  error?: string;
  output?: string;
}

export interface ReflectStepConfig {
  /**
   * Reflection frequency:
   * - 0 = disabled (no reflection)
   * - 1 = reflect after every tool batch (safest, default)
   * - N = reflect every Nth batch (balanced)
   */
  frequency?: number;

  /**
   * Custom reflection prompt (optional).
   */
  customPrompt?: string;
}

// ============================================================================
// Reflect Step Class
// ============================================================================

export class ReflectStep {
  private readonly frequency: number;
  private readonly prompt: string;

  /**
   * Create a new ReflectStep instance.
   *
   * @param config - Configuration options
   */
  constructor(config: ReflectStepConfig = {}) {
    this.frequency = config.frequency ?? 1;
    this.prompt = config.customPrompt ?? REFLECT_PROMPT;
  }

  /**
   * Determine if reflection step should be injected.
   *
   * Always reflects on errors regardless of frequency.
   * Otherwise follows batch_index % frequency schedule.
   *
   * @param toolResults - Results from tool execution batch
   * @param batchIndex - Current batch index (0-based)
   * @returns true if reflection should be injected
   */
  shouldReflect(toolResults: ToolResult[], batchIndex: number): boolean {
    if (this.frequency === 0) {
      return false;
    }

    // Always reflect if any tool returned an error
    if (toolResults.some((r) => r.error || !r.success)) {
      return true;
    }

    // Follow frequency schedule
    return batchIndex % this.frequency === 0;
  }

  /**
   * Format tool results into a human-readable summary.
   *
   * @param toolResults - Results from tool execution
   * @returns Formatted summary string
   */
  formatToolSummary(toolResults: ToolResult[]): string {
    const lines: string[] = [];

    for (const result of toolResults) {
      const toolName = result.tool || "unknown";

      if (result.error) {
        lines.push(`- ${toolName}: ERROR: ${result.error}`);
      } else if (!result.success) {
        lines.push(`- ${toolName}: FAILED`);
      } else {
        lines.push(`- ${toolName}: OK`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Create a reflection message for injection into conversation.
   *
   * @param toolResults - Results from tool execution
   * @returns Message object for injection
   */
  createReflectionMessage(toolResults: ToolResult[]): Message {
    const summary = this.formatToolSummary(toolResults);

    return {
      role: "user",
      content: `Tool execution summary:\n${summary}\n\n${this.prompt}`,
    };
  }

  /**
   * Inject reflection prompt after tool results.
   *
   * Appends a reflection message to the messages array.
   *
   * @param messages - Existing conversation messages (mutated in-place)
   * @param toolResults - Results from tool execution
   * @returns The modified messages array
   */
  injectReflection(messages: Message[], toolResults: ToolResult[]): Message[] {
    const reflectionMessage = this.createReflectionMessage(toolResults);
    messages.push(reflectionMessage);
    return messages;
  }

  /**
   * Check if reflection is needed and inject if so.
   *
   * Convenience method combining shouldReflect and injectReflection.
   *
   * @param messages - Existing conversation messages
   * @param toolResults - Results from tool execution
   * @param batchIndex - Current batch index
   * @returns true if reflection was injected
   */
  maybeInjectReflection(
    messages: Message[],
    toolResults: ToolResult[],
    batchIndex: number,
  ): boolean {
    if (this.shouldReflect(toolResults, batchIndex)) {
      this.injectReflection(messages, toolResults);
      return true;
    }
    return false;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalReflectStep: ReflectStep | undefined;

export function getReflectStep(config?: ReflectStepConfig): ReflectStep {
  if (!globalReflectStep) {
    globalReflectStep = new ReflectStep(config);
  }
  return globalReflectStep;
}

/**
 * Reset the global ReflectStep instance.
 * Useful for testing or reconfiguration.
 */
export function resetReflectStep(): void {
  globalReflectStep = undefined;
}
