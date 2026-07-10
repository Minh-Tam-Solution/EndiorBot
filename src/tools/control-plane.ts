/**
 * ToolControlPlane - Main orchestration layer for tool execution
 * Ties together PolicyEngine, ApprovalQueue, AuditLogger
 * Sprint 50 - Day 3-4 - Composio Integration Phase 1
 */

import crypto from 'crypto';
import { truncate } from "../utils/text-helpers.js";
import type {
  Tool,
  ToolResult,
  ToolRisk,
  PolicyDecision,
  ComposioConnection,
  ToolExecutionEvent,
} from './types.js';
import { PolicyEngine, type PolicyEngineConfig } from './policy-engine.js';
import { ApprovalQueue, ApprovalError, type ApprovalQueueConfig } from './approval-queue.js';
import { AuditLogger, type AuditLoggerConfig } from './audit-logger.js';
import { ComposioClient, type ComposioClientConfig } from './composio-client.js';
import {
  AuthManager,
  type AuthManagerConfig,
  type OAuthInitResult,
  type OAuthCallbackParams,
  type OAuthCallbackResult,
} from './auth-manager.js';

export interface ToolControlPlaneConfig {
  policyEngine?: PolicyEngineConfig;
  approvalQueue?: ApprovalQueueConfig;
  auditLogger?: AuditLoggerConfig;
  composioClient?: ComposioClientConfig;
  authManager?: AuthManagerConfig;
  /** Callback for Brain Layer 1 events (optional) */
  onToolExecution?: (event: ToolExecutionEvent) => Promise<void>;
}

export interface DryRunResult {
  tool_name: string;
  would_be_allowed: boolean;
  risk: ToolRisk | null;
  rate_limit_status: {
    would_pass: boolean;
    current_usage: Record<string, number>;
  };
  validation_errors?: string[];
}

export class ToolControlPlane {
  private policyEngine: PolicyEngine;
  private approvalQueue: ApprovalQueue;
  private auditLogger: AuditLogger;
  private composioClient: ComposioClient;
  private authManager: AuthManager;
  private onToolExecution: ((event: ToolExecutionEvent) => Promise<void>) | undefined;
  private connections: Map<string, ComposioConnection[]> = new Map();
  private initialized = false;

  constructor(config: ToolControlPlaneConfig = {}) {
    this.approvalQueue = new ApprovalQueue(config.approvalQueue);
    this.policyEngine = new PolicyEngine(this.approvalQueue, config.policyEngine);
    this.auditLogger = new AuditLogger(config.auditLogger);
    // Default to mockMode when no API key is provided (for testing and graceful degradation)
    const composioConfig = config.composioClient ?? {};
    if (!composioConfig.apiKey && !process.env.COMPOSIO_API_KEY && composioConfig.mockMode === undefined) {
      composioConfig.mockMode = true;
    }
    this.composioClient = new ComposioClient(composioConfig);
    this.authManager = new AuthManager(this.composioClient, config.authManager);
    this.onToolExecution = config.onToolExecution;
  }

  /**
   * Initialize the control plane
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.auditLogger.initialize();
    this.initialized = true;
  }

  /**
   * Evaluate a tool call against policies
   * Returns decision: allow, deny, or require_approval
   */
  async evaluate(
    toolName: string,
    args: unknown,
    principal_id: string,
    connection_id?: string
  ): Promise<PolicyDecision> {
    const decision = await this.policyEngine.evaluate(
      toolName,
      args,
      principal_id,
      connection_id
    );

    // Audit log the decision
    const argsHash = this.hashArgs(args);
    const risk = this.policyEngine.getToolRisk(toolName) ?? 'ADMIN';

    if (decision.action === 'deny') {
      await this.auditLogger.logDenied(principal_id, toolName, argsHash, decision.reason, risk);
    } else if (decision.action === 'require_approval') {
      await this.auditLogger.logPendingApproval(
        principal_id,
        toolName,
        argsHash,
        decision.approval_token!,
        risk
      );
    }

    return decision;
  }

  /**
   * Execute a tool after policy allows it
   * Note: For Phase 1, this is a mock implementation
   * Real Composio integration comes in Day 5-6
   */
  async execute(
    toolName: string,
    args: unknown,
    principal_id: string,
    connection_id?: string
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const callId = crypto.randomUUID();
    const argsHash = this.hashArgs(args);
    const risk = this.policyEngine.getToolRisk(toolName) ?? 'ADMIN';

    try {
      // Sprint 116 T5b: Guard against mock execution in production (Zero Mock Policy)
      if (!this.composioClient.isMockMode()) {
        throw new Error(
          `Tool execution not wired: ${toolName}. Composio integration pending. ` +
          `Set COMPOSIO_API_KEY or enable mockMode explicitly for testing.`
        );
      }
      const output = await this.mockExecute(toolName, args);
      const duration = Date.now() - startTime;

      // Log success
      await this.auditLogger.logSuccess(
        principal_id,
        toolName,
        argsHash,
        connection_id ?? '',
        truncate(JSON.stringify(output), 256),
        duration,
        risk
      );

      // Brain Layer 1 event
      if (this.onToolExecution) {
        await this.onToolExecution({
          type: 'tool_execution',
          tool_name: toolName,
          principal_id,
          input_hash: argsHash,
          output_summary: truncate(JSON.stringify(output), 256),
          success: true,
          latency_ms: duration,
          cost_usd: 0,
          connection_id: connection_id ?? '',
          timestamp: new Date(),
        });
      }

      return {
        id: callId,
        success: true,
        output,
        duration_ms: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof Error ? error.name : 'UNKNOWN';

      // Log failure
      await this.auditLogger.logFailure(
        principal_id,
        toolName,
        argsHash,
        connection_id ?? '',
        errorCode,
        errorMessage,
        duration,
        risk
      );

      // Brain Layer 1 event (failure)
      if (this.onToolExecution) {
        await this.onToolExecution({
          type: 'tool_execution',
          tool_name: toolName,
          principal_id,
          input_hash: argsHash,
          output_summary: `ERROR: ${errorMessage}`,
          success: false,
          latency_ms: duration,
          cost_usd: 0,
          connection_id: connection_id ?? '',
          timestamp: new Date(),
        });
      }

      return {
        id: callId,
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
        duration_ms: duration,
      };
    }
  }

  /**
   * Execute a tool with an approval token
   */
  async executeWithApproval(approvalToken: string): Promise<ToolResult> {
    // Validate and consume the token (throws if invalid/used/expired)
    await this.approvalQueue.validate(approvalToken);
    const pendingCall = await this.approvalQueue.getPendingCall(approvalToken);

    if (!pendingCall) {
      throw new ApprovalError('INVALID_TOKEN', 'No pending call found for this token');
    }

    // Execute the stored call
    return this.execute(
      pendingCall.name,
      pendingCall.arguments,
      pendingCall.principal_id,
      pendingCall.connection_id
    );
  }

  /**
   * Discover available tools (Phase 1: whitelist only)
   */
  async discoverTools(_principal_id: string, _apps?: string[]): Promise<Tool[]> {
    // Phase 1: Return static whitelist
    // Real Composio discovery comes in Day 5-6
    return this.policyEngine.getWhitelistedTools().map((name) => {
      const parts = name.split('.');
      const app = parts[0] ?? 'unknown';
      const action = parts[1] ?? 'action';
      const risk = this.policyEngine.getToolRisk(name);
      return {
        name,
        app,
        description: `${action} operation on ${app}`,
        parameters: [],
        tags: [risk ?? 'READ'],
      };
    });
  }

  /**
   * Get OAuth connections for a principal
   */
  async getConnections(principal_id: string): Promise<ComposioConnection[]> {
    return this.connections.get(principal_id) ?? [];
  }

  /**
   * Disconnect an OAuth connection
   */
  async disconnect(principal_id: string, connection_id: string): Promise<void> {
    const connections = this.connections.get(principal_id);
    if (!connections) return;

    const updated = connections.filter((c) => c.connection_id !== connection_id);
    if (updated.length === 0) {
      this.connections.delete(principal_id);
    } else {
      this.connections.set(principal_id, updated);
    }
  }

  /**
   * Dry-run a tool call (simulate without executing)
   * Useful for debugging and testing
   */
  async dryRun(toolName: string, _args: unknown): Promise<DryRunResult> {
    const risk = this.policyEngine.getToolRisk(toolName);
    const isAllowed = this.policyEngine.isToolAllowed(toolName);

    // Create a fake principal for dry-run
    const fakePrincipal = '00000000-0000-0000-0000-000000000000';
    const stats = this.policyEngine.getRateLimitStats(fakePrincipal);

    return {
      tool_name: toolName,
      would_be_allowed: isAllowed,
      risk,
      rate_limit_status: {
        would_pass: true, // Dry-run doesn't consume rate limits
        current_usage: stats.toolCounts,
      },
    };
  }

  /**
   * Cancel a pending approval token
   */
  async cancelApproval(approvalToken: string): Promise<boolean> {
    return this.approvalQueue.cancel(approvalToken);
  }

  /**
   * Get approval token status (without consuming it)
   */
  async getApprovalStatus(approvalToken: string): Promise<import('./types.js').ApprovalToken | null> {
    return this.approvalQueue.getTokenDetails(approvalToken);
  }

  /**
   * Get pending call details for an approval token
   */
  async getPendingCall(approvalToken: string): Promise<import('./types.js').ToolCall | null> {
    return this.approvalQueue.getPendingCall(approvalToken);
  }

  // ==========================================================================
  // OAuth Methods (Day 9)
  // ==========================================================================

  /**
   * Initiate OAuth flow for an app
   * Returns redirect URL and state token
   */
  async initOAuth(
    principal_id: string,
    app_name: string,
    scopes?: string[]
  ): Promise<OAuthInitResult> {
    return this.authManager.initOAuth(principal_id, app_name, scopes);
  }

  /**
   * Handle OAuth callback after user authorizes
   */
  async handleOAuthCallback(params: OAuthCallbackParams): Promise<OAuthCallbackResult> {
    return this.authManager.handleCallback(params);
  }

  /**
   * Get supported apps for OAuth
   */
  getSupportedApps(): string[] {
    return this.authManager.getSupportedApps();
  }

  /**
   * Check if app is supported
   */
  isAppSupported(app_name: string): boolean {
    return this.authManager.isAppSupported(app_name);
  }

  /**
   * Get rate limit stats for a principal
   */
  getRateLimitStats(principal_id: string) {
    return this.policyEngine.getRateLimitStats(principal_id);
  }

  /**
   * Get approval queue stats
   */
  getApprovalQueueStats() {
    return this.approvalQueue.getStats();
  }

  /**
   * Get audit stats
   */
  async getAuditStats(options?: { startDate?: Date; endDate?: Date }) {
    return this.auditLogger.getStats(options);
  }

  /**
   * Query audit logs by principal
   */
  async queryAuditByPrincipal(
    principal_id: string,
    options?: { limit?: number; startDate?: Date; endDate?: Date }
  ) {
    return this.auditLogger.queryByPrincipal(principal_id, options);
  }

  /**
   * Query audit logs by tool
   */
  async queryAuditByTool(
    tool: string,
    options?: { limit?: number; startDate?: Date; endDate?: Date }
  ) {
    return this.auditLogger.queryByTool(tool, options);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      policyEngine: boolean;
      approvalQueue: boolean;
      auditLogger: boolean;
    };
  }> {
    const approvalQueueStats = this.approvalQueue.getStats();

    return {
      status: 'healthy',
      components: {
        policyEngine: true,
        approvalQueue: approvalQueueStats.pending >= 0,
        auditLogger: this.initialized,
      },
    };
  }

  /**
   * Graceful shutdown
   */
  async dispose(): Promise<void> {
    this.approvalQueue.dispose();
    await this.auditLogger.dispose();
  }

  /**
   * Mock execution for Phase 1
   * Will be replaced by real ComposioClient in Day 5-6
   */
  private async mockExecute(toolName: string, args: unknown): Promise<unknown> {
    // Simulate some latency
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Return mock results based on tool type
    switch (toolName) {
      case 'github.get_repo':
        return {
          name: (args as { repo?: string }).repo ?? 'mock-repo',
          full_name: 'owner/mock-repo',
          private: false,
          stargazers_count: 42,
        };

      case 'github.get_issue':
        return {
          number: (args as { issue_number?: number }).issue_number ?? 1,
          title: 'Mock Issue',
          state: 'open',
          body: 'This is a mock issue for testing',
        };

      case 'github.create_issue':
        return {
          number: Math.floor(Math.random() * 1000),
          title: (args as { title?: string }).title ?? 'New Issue',
          state: 'open',
          html_url: 'https://github.com/owner/repo/issues/123',
        };

      case 'gmail.list_messages':
        return {
          messages: [
            { id: 'msg1', threadId: 'thread1' },
            { id: 'msg2', threadId: 'thread2' },
          ],
          resultSizeEstimate: 2,
        };

      case 'gmail.send_message':
        return {
          id: 'sent_' + crypto.randomUUID().slice(0, 8),
          threadId: 'thread_' + crypto.randomUUID().slice(0, 8),
        };

      case 'google_calendar.list_events':
        return {
          items: [
            { id: 'event1', summary: 'Mock Meeting' },
          ],
          nextPageToken: null,
        };

      case 'google_calendar.create_event':
        return {
          id: 'event_' + crypto.randomUUID().slice(0, 8),
          htmlLink: 'https://calendar.google.com/event/...',
        };

      case 'slack.list_channels':
        return {
          channels: [
            { id: 'C123', name: 'general' },
            { id: 'C456', name: 'random' },
          ],
        };

      case 'slack.send_message':
        return {
          ok: true,
          channel: (args as { channel?: string }).channel ?? 'C123',
          ts: Date.now().toString(),
        };

      case 'shell.execute_command':
        return {
          stdout: 'mock command output',
          stderr: '',
          exitCode: 0,
        };

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private hashArgs(args: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex');
  }
}
