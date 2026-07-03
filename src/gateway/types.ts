/**
 * Gateway Types
 *
 * Core interfaces for WebSocket gateway server.
 * Enables real-time Desktop ↔ CLI communication.
 *
 * @module gateway/types
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 44 Gateway Foundation
 * @authority ADR-010 Gateway Architecture
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Gateway Configuration
// ============================================================================

/**
 * Gateway server configuration.
 */
export interface GatewayConfig {
  /** Port to listen on (default: 18790) */
  port: number;
  /** Host to bind to (default: '127.0.0.1' for localhost-only) */
  host: string;
  /** Enable authentication */
  authEnabled: boolean;
  /** Authentication token (required if authEnabled) */
  authToken?: string;
  /** Ping interval in ms (default: 30000) */
  pingInterval: number;
  /** Ping timeout in ms (default: 10000) */
  pingTimeout: number;
  /** Max message size in bytes (default: 1MB) */
  maxMessageSize: number;
  /** Allowed CORS origins (default: localhost only). Set to ["*"] for wildcard. */
  corsOrigins?: string[];
}

/**
 * Default gateway configuration.
 */
export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  port: 18790,
  host: process.env["ENDIORBOT_GATEWAY_HOST"] ?? "127.0.0.1",
  authEnabled: false,
  pingInterval: 30000,
  pingTimeout: 10000,
  maxMessageSize: 1024 * 1024, // 1MB
};

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Client connection state.
 */
export type ConnectionState = "connecting" | "open" | "closing" | "closed";

/**
 * Client information.
 */
export interface ClientInfo {
  /** Unique client ID */
  id: string;
  /** Client type */
  type: "desktop" | "cli" | "web" | "unknown";
  /** Remote address */
  remoteAddress: string;
  /** Connection time */
  connectedAt: Date;
  /** Last activity time */
  lastActivity: Date;
  /** Authenticated */
  authenticated: boolean;
  /** Subscribed event types */
  subscriptions: Set<string>;
}

/**
 * Connection statistics.
 */
export interface ConnectionStats {
  /** Total connections since server start */
  totalConnections: number;
  /** Currently active connections */
  activeConnections: number;
  /** Total messages received */
  messagesReceived: number;
  /** Total messages sent */
  messagesSent: number;
  /** Server start time */
  startedAt: Date;
}

// ============================================================================
// Gateway Events
// ============================================================================

/**
 * Event types that can be broadcast to clients.
 */
export type GatewayEventType =
  | "budget.updated"
  | "budget.warning"
  | "budget.limit"
  | "approval.pending"
  | "approval.resolved"
  | "checkpoint.created"
  | "checkpoint.restored"
  | "session.started"
  | "session.updated"
  | "session.ended"
  | "agent.status"
  | "gate.status"
  | "notification"
  | "error"
  | "bus.response"; // Sprint 106: async command/chat response via EventEmitterBus (ADR-032)

/**
 * Gateway event payload.
 */
export interface GatewayEvent<T = unknown> {
  /** Event type */
  type: GatewayEventType;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data: T;
  /** Optional session ID */
  sessionId?: string;
}

// ============================================================================
// Budget Event Data
// ============================================================================

/**
 * Budget update event data.
 */
export interface BudgetUpdateData {
  /** Session cost so far */
  sessionCost: number;
  /** Session limit */
  sessionLimit: number;
  /** Daily cost so far */
  dailyCost: number;
  /** Daily limit */
  dailyLimit: number;
  /** Percentage used (session) */
  sessionPercentage: number;
  /** Percentage used (daily) */
  dailyPercentage: number;
}

/**
 * Budget warning event data.
 */
export interface BudgetWarningData {
  /** Warning level */
  level: "warning" | "critical";
  /** Budget scope (session, daily, monthly) */
  scope: "session" | "daily" | "monthly";
  /** Current percentage used */
  percentage: number;
  /** Remaining budget */
  remaining: number;
  /** Warning message */
  message: string;
}

// ============================================================================
// Approval Event Data
// ============================================================================

/**
 * Approval pending event data.
 */
export interface ApprovalPendingData {
  /** Approval request ID */
  id: string;
  /** Request type */
  type: string;
  /** Request message */
  message: string;
  /** Expiration timestamp */
  expiresAt: number;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Approval resolved event data.
 */
export interface ApprovalResolvedData {
  /** Approval request ID */
  id: string;
  /** Request type */
  type: string;
  /** Resolution status */
  status: "pending" | "approved" | "rejected" | "expired";
  /** Resolved timestamp */
  resolvedAt: number;
  /** Who resolved the request */
  resolvedBy?: string;
  /** Resolution notes */
  notes?: string;
}

// ============================================================================
// Checkpoint Event Data
// ============================================================================

/**
 * Checkpoint created event data.
 */
export interface CheckpointCreatedData {
  /** Checkpoint ID */
  id: string;
  /** Checkpoint label */
  label?: string;
  /** Session ID */
  sessionId: string;
  /** Created timestamp */
  createdAt: number;
  /** Messages count */
  messagesCount: number;
}

// ============================================================================
// Session Event Data
// ============================================================================

/**
 * Session status event data.
 */
export interface SessionStatusData {
  /** Session ID */
  id: string;
  /** Session status */
  status: "active" | "paused" | "completed" | "failed";
  /** Current task */
  currentTask?: string;
  /** Duration in ms */
  durationMs: number;
  /** Token usage */
  tokenUsage: {
    input: number;
    output: number;
  };
}

// ============================================================================
// Gateway Server Interface
// ============================================================================

/**
 * Gateway server interface.
 */
export interface IGatewayServer {
  /** Server configuration */
  readonly config: GatewayConfig;
  /** Connection statistics */
  readonly stats: ConnectionStats;
  /** Server running state */
  readonly isRunning: boolean;

  /** Start the server */
  start(): Promise<void>;
  /** Stop the server */
  stop(): Promise<void>;
  /** Broadcast event to all clients */
  broadcast(event: GatewayEvent): void;
  /** Send event to specific client */
  sendTo(clientId: string, event: GatewayEvent): boolean;
  /** Get connected clients */
  getClients(): ClientInfo[];
  /** Disconnect a client */
  disconnect(clientId: string): void;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create gateway configuration with defaults.
 */
export function createGatewayConfig(
  overrides?: Partial<GatewayConfig>
): GatewayConfig {
  return {
    ...DEFAULT_GATEWAY_CONFIG,
    ...overrides,
  };
}

/**
 * Create a gateway event.
 */
export function createGatewayEvent<T>(
  type: GatewayEventType,
  data: T,
  sessionId?: string
): GatewayEvent<T> {
  const event: GatewayEvent<T> = {
    type,
    timestamp: Date.now(),
    data,
  };

  if (sessionId !== undefined) {
    event.sessionId = sessionId;
  }

  return event;
}
