/**
 * Gateway WebSocket Server
 *
 * WebSocket server for real-time Desktop ↔ CLI communication.
 * Implements JSON-RPC 2.0 protocol over WebSocket.
 *
 * @module gateway/server
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 44 Gateway Foundation
 * @authority ADR-010 Gateway Architecture
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { WebSocketServer, WebSocket, type RawData } from "ws";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  GatewayConfig,
  ConnectionStats,
  ClientInfo,
  GatewayEvent,
  IGatewayServer,
} from "./types.js";
import { homedir } from "os";
import { collectHealthReport } from "../monitoring/index.js";
import { getMessageBus } from "../bus/message-bus.js";
import { RateLimiter } from "../security/rate-limiter.js";
import { VERSION } from "../index.js";
import { resolveGatewayConfig, validateGatewayConfig } from "./config.js";
// Sprint 135 T4 routes (relocated from web-server.ts → here, Sprint 144 E2E fix)
import { TIMEOUTS } from "../config/timeouts.js";
import { getPreset, setPreset, getEffectivePolicy, readAuditTail } from "../security/exec-approvals/index.js";
import { isFeatureEnabled } from "../config/feature-flags.js";
import type { Preset } from "../security/exec-approvals/types.js";
import {
  type JsonRpcRequest,
  type JsonRpcResponse,
  isJsonRpcRequest,
  createSuccessResponse,
  JSONRPC_VERSION,
} from "./protocol/schema.js";
import {
  parseError,
  invalidRequest,
  methodNotFound,
  internalError,
  unauthorized,
} from "./protocol/errors.js";

// ============================================================================
// Constants
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Paths to search for the web UI HTML file */
const HTML_PATHS = [
  join(__dirname, "web", "index.html"),
  join(__dirname, "..", "..", "src", "gateway", "web", "index.html"),
  join(process.cwd(), "src", "gateway", "web", "index.html"),
];

// ============================================================================
// Types
// ============================================================================

/**
 * Extended WebSocket with client info.
 */
interface ExtendedWebSocket extends WebSocket {
  clientId: string;
  clientInfo: ClientInfo;
  isAlive: boolean;
}

/**
 * Method handler function.
 */
type MethodHandler = (
  params: unknown,
  client: ClientInfo
) => Promise<unknown> | unknown;

// ============================================================================
// Gateway Server
// ============================================================================

/**
 * GatewayServer - WebSocket server with JSON-RPC 2.0 protocol.
 *
 * Features:
 * 1. JSON-RPC 2.0 request/response
 * 2. Event broadcasting to subscribed clients
 * 3. Localhost-only or token authentication
 * 4. Ping/pong heartbeat
 */
export class GatewayServer implements IGatewayServer {
  private httpServer: ReturnType<typeof createServer> | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ExtendedWebSocket> = new Map();
  private methods: Map<string, MethodHandler> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private _stats: ConnectionStats;
  private _config: GatewayConfig;
  private _isRunning = false;
  private htmlContent = "";
  private httpRateLimiter = new RateLimiter(60_000, 100);

  constructor(config?: Partial<GatewayConfig>) {
    this._config = resolveGatewayConfig(config);
    this._stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      startedAt: new Date(),
    };

    this.loadHtmlContent();

    // Register built-in methods
    this.registerBuiltinMethods();
  }

  // ==========================================================================
  // Public Interface
  // ==========================================================================

  get config(): GatewayConfig {
    return this._config;
  }

  get stats(): ConnectionStats {
    return {
      ...this._stats,
      activeConnections: this.clients.size,
    };
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Start the gateway server (HTTP + WebSocket on same port).
   *
   * Web channel is first-class: browser gets full UI at http://host:port/
   * Desktop/CLI connects via ws://host:port/ws
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      throw new Error("Gateway server is already running");
    }

    // Validate config
    const validation = validateGatewayConfig(this._config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
    }

    // Create HTTP server (serves web UI + API endpoints)
    this.httpServer = createServer(this.handleHttpRequest.bind(this));

    // Attach WebSocket server to HTTP server at /ws path
    this.wss = new WebSocketServer({
      server: this.httpServer,
      path: "/ws",
      maxPayload: this._config.maxMessageSize,
    });

    // Set up event handlers
    this.wss.on("connection", this.handleConnection.bind(this));
    this.wss.on("error", this.handleServerError.bind(this));

    // Start heartbeat
    this.startHeartbeat();

    // Wait for server to be listening
    await new Promise<void>((resolve, reject) => {
      this.httpServer?.listen(this._config.port, this._config.host, () => {
        this._isRunning = true;
        this._stats.startedAt = new Date();
        resolve();
      });

      this.httpServer?.on("error", reject);
    });
  }

  /**
   * Stop the gateway server.
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    // Stop heartbeat
    this.stopHeartbeat();

    // Close all client connections
    for (const client of this.clients.values()) {
      client.close(1000, "Server shutting down");
    }
    this.clients.clear();

    // Close WebSocket server, then HTTP server
    await new Promise<void>((resolve, reject) => {
      this.wss?.close(() => {
        this.httpServer?.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    this.wss = null;
    this.httpServer = null;
    this._isRunning = false;
  }

  /**
   * Broadcast event to all subscribed clients.
   */
  broadcast(event: GatewayEvent): void {
    const message = JSON.stringify({
      jsonrpc: JSONRPC_VERSION,
      method: "event",
      params: event,
    });

    for (const client of this.clients.values()) {
      if (
        client.readyState === WebSocket.OPEN &&
        client.clientInfo.subscriptions.has(event.type)
      ) {
        client.send(message);
        this._stats.messagesSent++;
      }
    }
  }

  /**
   * Send event to specific client.
   */
  sendTo(clientId: string, event: GatewayEvent): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.readyState !== WebSocket.OPEN) {
      return false;
    }

    const message = JSON.stringify({
      jsonrpc: JSONRPC_VERSION,
      method: "event",
      params: event,
    });

    client.send(message);
    this._stats.messagesSent++;
    return true;
  }

  /**
   * Get connected clients.
   */
  getClients(): ClientInfo[] {
    return Array.from(this.clients.values()).map((ws) => ws.clientInfo);
  }

  /**
   * Disconnect a client.
   */
  disconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.close(1000, "Disconnected by server");
      this.clients.delete(clientId);
    }
  }

  /**
   * Register a method handler.
   */
  registerMethod(method: string, handler: MethodHandler): void {
    this.methods.set(method, handler);
  }

  // ==========================================================================
  // Connection Handling
  // ==========================================================================

  private handleConnection(ws: WebSocket, request: { socket: { remoteAddress?: string } }): void {
    const extWs = ws as ExtendedWebSocket;
    const clientId = randomUUID();
    const remoteAddress = request.socket.remoteAddress ?? "unknown";

    // Check localhost-only mode
    if (
      !this._config.authEnabled &&
      this._config.host === "127.0.0.1" &&
      !this.isLocalhost(remoteAddress)
    ) {
      ws.close(4001, "Only localhost connections allowed");
      return;
    }

    // Initialize client info
    extWs.clientId = clientId;
    extWs.isAlive = true;
    extWs.clientInfo = {
      id: clientId,
      type: "unknown",
      remoteAddress,
      connectedAt: new Date(),
      lastActivity: new Date(),
      authenticated: !this._config.authEnabled, // Auto-auth if no auth required
      subscriptions: new Set(),
    };

    // Store client
    this.clients.set(clientId, extWs);
    this._stats.totalConnections++;

    // Set up client event handlers
    ws.on("message", (data) => this.handleMessage(extWs, data));
    ws.on("close", () => this.handleClose(extWs));
    ws.on("error", (err) => this.handleClientError(extWs, err));
    ws.on("pong", () => {
      extWs.isAlive = true;
    });

    // Send welcome message
    this.sendWelcome(extWs);
  }

  private handleMessage(client: ExtendedWebSocket, data: RawData): void {
    this._stats.messagesReceived++;
    client.clientInfo.lastActivity = new Date();

    // Parse message
    let message: unknown;
    try {
      message = JSON.parse(data.toString());
    } catch {
      this.sendResponse(client, parseError());
      return;
    }

    // Validate JSON-RPC format
    if (!isJsonRpcRequest(message)) {
      this.sendResponse(client, invalidRequest(null, "Not a valid JSON-RPC request"));
      return;
    }

    // Check authentication
    if (!client.clientInfo.authenticated && message.method !== "auth") {
      this.sendResponse(client, unauthorized(message.id));
      return;
    }

    // Handle request
    void this.handleRequest(client, message);
  }

  private async handleRequest(
    client: ExtendedWebSocket,
    request: JsonRpcRequest
  ): Promise<void> {
    const handler = this.methods.get(request.method);

    if (!handler) {
      this.sendResponse(client, methodNotFound(request.id, request.method));
      return;
    }

    try {
      const result = await handler(request.params, client.clientInfo);
      this.sendResponse(client, createSuccessResponse(result, request.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.sendResponse(client, internalError(request.id, message));
    }
  }

  private handleClose(client: ExtendedWebSocket): void {
    this.clients.delete(client.clientId);
  }

  private handleClientError(client: ExtendedWebSocket, _error: Error): void {
    // Log error but don't crash
    this.clients.delete(client.clientId);
  }

  private handleServerError(_error: Error): void {
    // Log error but don't crash
  }

  // ==========================================================================
  // Response Handling
  // ==========================================================================

  private sendResponse(client: ExtendedWebSocket, response: JsonRpcResponse): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(response));
      this._stats.messagesSent++;
    }
  }

  private sendWelcome(client: ExtendedWebSocket): void {
    const welcome = {
      jsonrpc: JSONRPC_VERSION,
      method: "welcome",
      params: {
        clientId: client.clientId,
        serverVersion: VERSION,
        authRequired: this._config.authEnabled,
      },
    };
    client.send(JSON.stringify(welcome));
    this._stats.messagesSent++;
  }

  // ==========================================================================
  // Heartbeat
  // ==========================================================================

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients.values()) {
        if (!client.isAlive) {
          client.terminate();
          this.clients.delete(client.clientId);
          continue;
        }

        client.isAlive = false;
        client.ping();
      }
    }, this._config.pingInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ==========================================================================
  // Built-in Methods
  // ==========================================================================

  private registerBuiltinMethods(): void {
    // System methods
    this.registerMethod("system.ping", () => ({ pong: Date.now() }));

    this.registerMethod("system.version", () => ({
      gateway: VERSION,
      endiorbot: VERSION,
      protocol: JSONRPC_VERSION,
    }));

    this.registerMethod("system.stats", () => this.stats);

    // Health check method
    this.registerMethod("system.health", async (params) => {
      const options = params as {
        checkProviders?: boolean;
        providerCheckTimeout?: number;
      } | undefined;

      return collectHealthReport(this.stats, this.methods.size, {
        checkProviders: options?.checkProviders ?? false,
        providerCheckTimeout: options?.providerCheckTimeout ?? 5000,
      });
    });

    // Subscription methods
    this.registerMethod("subscribe", (params, client) => {
      const { events } = params as { events: string[] };
      if (!Array.isArray(events)) {
        throw new Error("events must be an array");
      }

      for (const event of events) {
        client.subscriptions.add(event);
      }

      return { subscribed: Array.from(client.subscriptions) };
    });

    this.registerMethod("unsubscribe", (params, client) => {
      const { events } = params as { events: string[] };
      if (!Array.isArray(events)) {
        throw new Error("events must be an array");
      }

      for (const event of events) {
        client.subscriptions.delete(event);
      }

      return { subscribed: Array.from(client.subscriptions) };
    });

    // Auth method (when auth enabled)
    this.registerMethod("auth", (params, client) => {
      if (!this._config.authEnabled) {
        client.authenticated = true;
        return { authenticated: true };
      }

      const { token } = params as { token?: string };
      if (token === this._config.authToken) {
        client.authenticated = true;
        return { authenticated: true };
      }

      throw new Error("Invalid token");
    });
  }

  // ==========================================================================
  // HTTP Handling (Web Channel — first-class, full EndiorBot features)
  // ==========================================================================

  private loadHtmlContent(): void {
    for (const htmlPath of HTML_PATHS) {
      if (existsSync(htmlPath)) {
        try {
          this.htmlContent = readFileSync(htmlPath, "utf-8");
          return;
        } catch {
          // Try next path
        }
      }
    }

    // Fallback HTML
    this.htmlContent = `<!DOCTYPE html>
<html><head><title>EndiorBot</title></head>
<body style="background:#0f1117;color:#e4e4e7;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<h1>EndiorBot Gateway</h1>
<p>Web UI not found. Connect via WebSocket at ws://localhost:${this._config.port}/ws</p>
</div>
</body></html>`;
  }

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? "/";

    // Security headers (Sprint 117 B1 + Sprint 145 HSTS)
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:",
    );

    // CORS headers (Sprint 116 T3: configurable origins, no more wildcard)
    const allowedOrigins = this._config.corsOrigins ?? [
      `http://localhost:${this._config.port}`,
      `http://127.0.0.1:${this._config.port}`,
    ];
    const requestOrigin = req.headers.origin ?? "";
    if (allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin || (allowedOrigins[0] ?? ""));
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Rate limiting (Sprint 117 B2) — exempt health endpoints per CPO
    const isHealthEndpoint = url === "/api/health";
    if (!isHealthEndpoint) {
      const clientIp = req.socket.remoteAddress ?? "unknown";
      const rateCheck = this.httpRateLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        res.writeHead(429, { "Content-Type": "application/json", "Retry-After": String(Math.ceil(rateCheck.resetIn / 1000)) });
        res.end(JSON.stringify({ error: "Too Many Requests", retryAfter: Math.ceil(rateCheck.resetIn / 1000) }));
        return;
      }
    }

    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(this.htmlContent);
    } else if (url === "/api/status") {
      // Sprint 115 (T5): Include bus metrics in status endpoint
      const busStats = getMessageBus().getStats();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        activeConnections: this.clients.size,
        uptimeSec: this._stats.startedAt
          ? Math.floor((Date.now() - this._stats.startedAt.getTime()) / 1000)
          : 0,
        serverVersion: VERSION,
        bus: {
          totalInbound: busStats.totalInbound,
          totalOutbound: busStats.totalOutbound,
          inFlight: busStats.inFlight,
          inboundListeners: busStats.inboundListeners,
          outboundListeners: busStats.outboundListeners,
          uptimeSec: Math.floor((Date.now() - busStats.startedAt) / 1000),
        },
      }));
    } else if (isHealthEndpoint) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", timestamp: new Date().toISOString() }));

    // ── Sprint 135 T4 Web API (relocated from web-server.ts, Sprint 144 E2E fix) ──

    } else if (url === "/api/config" && req.method === "GET") {
      const config = {
        execPolicy: { preset: getPreset(), policy: getEffectivePolicy() },
        activeMemory: { enabled: isFeatureEnabled("ACTIVE_MEMORY_ENABLED") },
        autoHandoff: { enabled: process.env["ENDIORBOT_AUTO_HANDOFF"] === "true" },
        timeouts: TIMEOUTS,
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(config, null, 2));

    } else if (url.match(/^\/api\/audit\/([a-z-]+)/) && req.method === "GET") {
      const auditMatch = url.match(/^\/api\/audit\/([a-z-]+)/)!;
      const type = auditMatch[1]!;
      const limitParam = new URL(url, `http://${req.headers.host ?? "localhost"}`).searchParams.get("limit");
      const limit = Math.min(parseInt(limitParam ?? "10", 10) || 10, 100);

      if (type === "exec-policy") {
        const entries = readAuditTail(limit);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ type, entries, count: entries.length }));
      } else {
        const logFiles: Record<string, string> = { ssrf: "ssrf-blocks.log", webhooks: "webhooks.log" };
        const logFile = logFiles[type];
        if (logFile) {
          const logPath = join(homedir(), ".endiorbot", "audit-logs", logFile);
          let entries: unknown[] = [];
          if (existsSync(logPath)) {
            const lines = readFileSync(logPath, "utf-8").trim().split("\n").filter(l => l.length > 0);
            entries = lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ type, entries, count: entries.length }));
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Unknown audit type: ${type}. Valid: exec-policy, ssrf, webhooks` }));
        }
      }

    } else if (url === "/api/config/exec-policy/preset" && req.method === "POST") {
      const token = this._config.authToken ?? process.env["ENDIORBOT_GATEWAY_TOKEN"];
      const provided = (req.headers.authorization ?? "").replace("Bearer ", "");
      if (!token || provided !== token) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized — set ENDIORBOT_GATEWAY_TOKEN" }));
        return;
      }
      const bodyChunks: Buffer[] = [];
      req.on("data", (c: Buffer) => bodyChunks.push(c));
      req.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(bodyChunks).toString("utf-8")) as { preset?: string };
          const validPresets = new Set(["open", "balanced", "strict"]);
          if (!body.preset || !validPresets.has(body.preset)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid preset. Valid: open, balanced, strict" }));
            return;
          }
          const old = getPreset();
          setPreset(body.preset as Preset);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, old, new: body.preset }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
        }
      });

    } else if (url === "/api/config/active-memory" && req.method === "POST") {
      const token = this._config.authToken ?? process.env["ENDIORBOT_GATEWAY_TOKEN"];
      const provided = (req.headers.authorization ?? "").replace("Bearer ", "");
      if (!token || provided !== token) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      const bodyChunks: Buffer[] = [];
      req.on("data", (c: Buffer) => bodyChunks.push(c));
      req.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(bodyChunks).toString("utf-8")) as { enabled?: boolean };
          if (typeof body.enabled !== "boolean") {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: 'Body must have { "enabled": true|false }' }));
            return;
          }
          process.env["ENDIORBOT_FF_ACTIVE_MEMORY_ENABLED"] = body.enabled ? "true" : "false";
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, activeMemory: body.enabled }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
        }
      });

    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private isLocalhost(address: string): boolean {
    return (
      address === "127.0.0.1" ||
      address === "::1" ||
      address === "::ffff:127.0.0.1" ||
      address === "localhost"
    );
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a gateway server instance.
 */
export function createGatewayServer(
  config?: Partial<GatewayConfig>
): GatewayServer {
  return new GatewayServer(config);
}
