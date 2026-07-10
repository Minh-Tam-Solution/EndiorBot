/**
 * ToolExecutor - Execute tools with zod validation
 * Sprint 50 - Day 5-6 - Real Composio API Integration
 *
 * Handles:
 * - Input validation with zod schemas
 * - Tool execution via Composio
 * - Brain Layer 1 event emission
 * - Audit logging
 */

import crypto from 'crypto';
import { z } from 'zod';
import { truncate } from "../utils/text-helpers.js";
import type { ToolCall, ToolResult, ToolRisk, ToolExecutionEvent } from './types.js';
import { ComposioClient } from './composio-client.js';
import { AuditLogger } from './audit-logger.js';

/**
 * Input validation schemas for Phase 1 tools
 * From TOOL-POLICY.md
 */
const TOOL_SCHEMAS: Record<string, z.ZodSchema> = {
  'github.get_repo': z.object({
    owner: z.string().min(1).max(39).regex(/^[a-zA-Z0-9-]+$/),
    repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
  }),

  'github.get_issue': z.object({
    owner: z.string().min(1).max(39).regex(/^[a-zA-Z0-9-]+$/),
    repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
    issue_number: z.number().int().positive(),
  }),

  'github.create_issue': z.object({
    owner: z.string().min(1).max(39).regex(/^[a-zA-Z0-9-]+$/),
    repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
    title: z.string().min(1).max(256),
    body: z.string().max(64 * 1024).optional(),
    labels: z.array(z.string().max(50)).max(10).optional(),
  }),

  'gmail.list_messages': z.object({
    max_results: z.number().int().min(1).max(100).default(10),
    query: z.string().max(512).optional(),
  }),

  'gmail.send_message': z.object({
    to: z.string().email().max(254),
    subject: z.string().min(1).max(256),
    body: z.string().min(1).max(100 * 1024),
    cc: z.string().email().max(254).optional(),
    bcc: z.string().email().max(254).optional(),
  }),

  'google_calendar.list_events': z.object({
    calendar_id: z.string().default('primary'),
    time_min: z.string().datetime().optional(),
    time_max: z.string().datetime().optional(),
    max_results: z.number().int().min(1).max(100).default(10),
  }),

  'google_calendar.create_event': z.object({
    calendar_id: z.string().default('primary'),
    summary: z.string().min(1).max(256),
    start: z.string().datetime(),
    end: z.string().datetime(),
    description: z.string().max(8 * 1024).optional(),
    attendees: z.array(z.string().email()).max(50).optional(),
  }),

  'slack.list_channels': z.object({
    exclude_archived: z.boolean().default(true),
    limit: z.number().int().min(1).max(1000).default(100),
  }),

  'slack.send_message': z.object({
    channel: z.string().min(1),
    text: z.string().min(1).max(40 * 1024),
    thread_ts: z.string().optional(),
  }),

  'shell.execute_command': z.object({
    command: z.string().min(1).max(1024),
    cwd: z.string().max(4096).optional(),
    timeout: z.number().int().min(1000).max(300000).default(30000),
  }),
};

/**
 * Security: Denied patterns (injection protection)
 */
const DENIED_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /data:text\/html/i,
  /\.\.\//,
  /\.\.\\/,
  /'.*OR.*'/i,
  /;\s*DROP\s+TABLE/i,
  /--\s*$/,
  /\/\*.*\*\//,
  /\bexec\s*\(/i,
  /\beval\s*\(/i,
  /\$\{.*\}/,
];

/**
 * Risk classification for Phase 1 tools
 */
const TOOL_RISK: Record<string, ToolRisk> = {
  'github.get_repo': 'READ',
  'github.get_issue': 'READ',
  'github.create_issue': 'WRITE',
  'gmail.list_messages': 'READ',
  'gmail.send_message': 'WRITE',
  'google_calendar.list_events': 'READ',
  'google_calendar.create_event': 'WRITE',
  'slack.list_channels': 'READ',
  'slack.send_message': 'WRITE',
  'shell.execute_command': 'DESTRUCTIVE',
};

/**
 * Configuration for ToolExecutor
 */
export interface ToolExecutorConfig {
  /** Callback for Brain Layer 1 events */
  onToolExecution?: (event: ToolExecutionEvent) => Promise<void>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  errors?: string[];
  sanitizedInput?: Record<string, unknown>;
}

/**
 * ToolExecutor executes tools with validation and audit logging
 */
export class ToolExecutor {
  private composioClient: ComposioClient;
  private auditLogger: AuditLogger;
  private onToolExecution: ((event: ToolExecutionEvent) => Promise<void>) | undefined;

  constructor(
    composioClient: ComposioClient,
    auditLogger: AuditLogger,
    config: ToolExecutorConfig = {}
  ) {
    this.composioClient = composioClient;
    this.auditLogger = auditLogger;
    this.onToolExecution = config.onToolExecution;
  }

  /**
   * Execute a tool with full validation and audit logging
   */
  async execute(
    toolCall: ToolCall,
    context: { connection_id?: string; risk?: ToolRisk }
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const argsHash = this.hashArgs(toolCall.arguments);
    const risk = context.risk ?? TOOL_RISK[toolCall.name] ?? 'ADMIN';

    // 1. Validate input
    const validation = await this.validateInput(toolCall.name, toolCall.arguments);
    if (!validation.success) {
      const duration = Date.now() - startTime;

      await this.auditLogger.logFailure(
        toolCall.principal_id,
        toolCall.name,
        argsHash,
        context.connection_id ?? '',
        'VALIDATION_ERROR',
        validation.errors?.join('; ') ?? 'Validation failed',
        duration,
        risk
      );

      // Emit Brain Layer 1 event for validation failure
      if (this.onToolExecution) {
        await this.onToolExecution({
          type: 'tool_execution',
          tool_name: toolCall.name,
          principal_id: toolCall.principal_id,
          input_hash: argsHash,
          output_summary: `VALIDATION_ERROR: ${validation.errors?.join('; ') ?? 'Validation failed'}`,
          success: false,
          latency_ms: duration,
          cost_usd: 0,
          connection_id: context.connection_id ?? '',
          timestamp: new Date(),
        });
      }

      return {
        id: toolCall.id,
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: validation.errors,
        },
        duration_ms: duration,
      };
    }

    // 2. Execute via Composio
    let result: ToolResult;
    try {
      const composioResult = await this.composioClient.executeTool(
        {
          ...toolCall,
          arguments: validation.sanitizedInput ?? toolCall.arguments,
        },
        toolCall.principal_id
      );

      const duration = Date.now() - startTime;
      result = {
        id: toolCall.id,
        success: true,
        output: composioResult,
        duration_ms: duration,
      };

      // Log success
      await this.auditLogger.logSuccess(
        toolCall.principal_id,
        toolCall.name,
        argsHash,
        context.connection_id ?? '',
        truncate(JSON.stringify(composioResult), 256),
        duration,
        risk
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof Error ? error.name : 'UNKNOWN';

      result = {
        id: toolCall.id,
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
        duration_ms: duration,
      };

      // Log failure
      await this.auditLogger.logFailure(
        toolCall.principal_id,
        toolCall.name,
        argsHash,
        context.connection_id ?? '',
        errorCode,
        errorMessage,
        duration,
        risk
      );
    }

    // 3. Emit Brain Layer 1 event
    if (this.onToolExecution) {
      await this.onToolExecution({
        type: 'tool_execution',
        tool_name: toolCall.name,
        principal_id: toolCall.principal_id,
        input_hash: argsHash,
        output_summary: result.success
          ? truncate(JSON.stringify(result.output), 256)
          : `ERROR: ${result.error?.message}`,
        success: result.success,
        latency_ms: result.duration_ms,
        cost_usd: 0, // Composio doesn't charge per-call
        connection_id: context.connection_id ?? '',
        timestamp: new Date(),
      });
    }

    return result;
  }

  /**
   * Validate tool input against zod schema
   */
  async validateInput(
    toolName: string,
    input: unknown
  ): Promise<ValidationResult> {
    // 1. Check if schema exists
    const schema = TOOL_SCHEMAS[toolName];
    if (!schema) {
      return {
        success: false,
        errors: [`No validation schema for tool: ${toolName}`],
      };
    }

    // 2. Check for denied patterns (security)
    const inputStr = JSON.stringify(input);
    for (const pattern of DENIED_PATTERNS) {
      if (pattern.test(inputStr)) {
        return {
          success: false,
          errors: ['Input contains blocked security pattern'],
        };
      }
    }

    // 3. Validate against zod schema
    const result = schema.safeParse(input);
    if (!result.success) {
      const errors = result.error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      return { success: false, errors };
    }

    return {
      success: true,
      sanitizedInput: result.data as Record<string, unknown>,
    };
  }

  /**
   * Get validation schema for a tool
   */
  getSchema(toolName: string): z.ZodSchema | null {
    return TOOL_SCHEMAS[toolName] ?? null;
  }

  /**
   * Check if tool has a validation schema
   */
  hasSchema(toolName: string): boolean {
    return toolName in TOOL_SCHEMAS;
  }

  /**
   * Get risk level for a tool
   */
  getToolRisk(toolName: string): ToolRisk {
    return TOOL_RISK[toolName] ?? 'ADMIN';
  }

  /**
   * Get all supported tools
   */
  getSupportedTools(): string[] {
    return Object.keys(TOOL_SCHEMAS);
  }

  /**
   * Dry-run validation (without execution)
   */
  async dryRunValidation(
    toolName: string,
    input: unknown
  ): Promise<{
    valid: boolean;
    errors?: string[];
    risk: ToolRisk;
    hasSchema: boolean;
  }> {
    const validation = await this.validateInput(toolName, input);
    const result: {
      valid: boolean;
      errors?: string[];
      risk: ToolRisk;
      hasSchema: boolean;
    } = {
      valid: validation.success,
      risk: this.getToolRisk(toolName),
      hasSchema: this.hasSchema(toolName),
    };
    if (validation.errors) {
      result.errors = validation.errors;
    }
    return result;
  }

  private hashArgs(args: unknown): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(args))
      .digest('hex');
  }
}

/**
 * Custom error class for executor-related errors
 */
export class ToolExecutorError extends Error {
  constructor(
    public readonly code: 'VALIDATION_ERROR' | 'EXECUTION_ERROR' | 'NO_SCHEMA',
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ToolExecutorError';
  }
}
