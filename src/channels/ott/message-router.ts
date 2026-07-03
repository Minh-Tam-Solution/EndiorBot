/**
 * OTT Message Router
 *
 * Routes incoming OTT messages with InputSanitizer integration.
 * All external input is sanitized before being processed.
 *
 * Security features:
 * - 12 injection pattern detection (InputSanitizer)
 * - Audit logging for violations
 * - Defense-in-depth wrapping
 * - Rate limiting support
 *
 * @module channels/ott/message-router
 * @version 1.0.0
 * @date 2026-02-24
 * @status ACTIVE - Sprint 46 Day 1
 * @authority ADR-005 Python-to-TypeScript Porting
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { getInputSanitizer, type SanitizeResult } from '../../security/input-sanitizer.js';
import { auditOTTViolation, auditOTTMessage } from '../../security/ott-audit.js';

// ============================================================================
// Types
// ============================================================================

/**
 * OTT channel source identifiers.
 */
export type OTTChannelSource =
  | 'telegram'
  | 'zalo'
  | 'whatsapp'
  | 'slack'
  | 'discord'
  | 'webhook'
  | 'unknown';

/**
 * Incoming OTT message.
 */
export interface OTTMessage {
  /** Unique message ID from source */
  messageId: string;
  /** Source channel */
  source: OTTChannelSource;
  /** Sender ID (user/chat) */
  senderId: string;
  /** Raw message content */
  content: string;
  /** When message was received */
  receivedAt: Date;
  /** Optional reply-to message ID */
  replyTo?: string;
  /** Optional metadata from source */
  metadata?: Record<string, unknown>;
}

/**
 * Routed message after sanitization.
 */
export interface RoutedMessage {
  /** Original message */
  original: OTTMessage;
  /** Sanitized content */
  sanitized: string;
  /** Detected violations */
  violations: string[];
  /** Whether message should be processed */
  shouldProcess: boolean;
  /** Reason if blocked */
  blockReason?: string;
  /** Processing timestamp */
  processedAt: Date;
}

/**
 * Message handler function type.
 */
export type MessageHandler = (message: RoutedMessage) => Promise<void>;

/**
 * Route decision for a message.
 */
export interface RouteDecision {
  /** Allow processing */
  allow: boolean;
  /** Handler to use (if allowed) */
  handler?: string;
  /** Block reason (if denied) */
  reason?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Message router configuration.
 */
export interface MessageRouterConfig {
  /** Block messages with critical violations */
  blockOnCriticalViolation: boolean;
  /** Critical violation types that trigger blocking */
  criticalViolations: string[];
  /** Maximum violations before auto-block */
  maxViolationsBeforeBlock: number;
  /** Enable audit logging */
  enableAudit: boolean;
  /** Rate limit: messages per minute per sender */
  rateLimitPerMinute: number;
}

/**
 * Default router configuration.
 */
export const DEFAULT_ROUTER_CONFIG: MessageRouterConfig = {
  blockOnCriticalViolation: true,
  criticalViolations: [
    'system_prompt_override',
    'jailbreak_prefix',
    'instruction_override',
  ],
  maxViolationsBeforeBlock: 5,
  enableAudit: true,
  rateLimitPerMinute: 30,
};

// ============================================================================
// OTT Message Router
// ============================================================================

/**
 * OTT Message Router with InputSanitizer integration.
 *
 * Routes incoming OTT messages through security checks:
 * 1. Input sanitization (12 injection patterns)
 * 2. Violation audit logging
 * 3. Critical violation blocking
 * 4. Rate limiting
 */
export class OTTMessageRouter {
  private readonly config: MessageRouterConfig;
  private readonly handlers: Map<string, MessageHandler> = new Map();
  private readonly violationCounts: Map<string, number> = new Map();
  private readonly messageTimestamps: Map<string, number[]> = new Map();

  constructor(config: Partial<MessageRouterConfig> = {}) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
  }

  /**
   * Register a message handler.
   */
  registerHandler(name: string, handler: MessageHandler): void {
    this.handlers.set(name, handler);
  }

  /**
   * Unregister a message handler.
   */
  unregisterHandler(name: string): boolean {
    return this.handlers.delete(name);
  }

  /**
   * Route an incoming OTT message.
   *
   * @param message - Raw incoming message
   * @returns Routed message with sanitization results
   */
  async route(message: OTTMessage): Promise<RoutedMessage> {
    const processedAt = new Date();

    // Step 1: Sanitize input
    const sanitizer = getInputSanitizer();
    const result: SanitizeResult = sanitizer.sanitizeExternalInput(
      message.content,
      message.source
    );

    // Step 2: Check rate limiting
    const rateLimitExceeded = this.checkRateLimit(message.senderId);

    // Step 3: Determine if message should be processed
    const decision = this.decideRoute(result.violations, rateLimitExceeded);

    // Step 4: Build routed message
    const routed: RoutedMessage = {
      original: message,
      sanitized: result.sanitized,
      violations: result.violations,
      shouldProcess: decision.allow,
      processedAt,
    };

    if (!decision.allow && decision.reason) {
      routed.blockReason = decision.reason;
    }

    // Step 5: Audit logging
    if (this.config.enableAudit) {
      await this.auditMessage(routed);
    }

    // Step 6: Track violations per sender
    if (result.violations.length > 0) {
      this.trackViolations(message.senderId, result.violations.length);
    }

    return routed;
  }

  /**
   * Process a message through registered handlers.
   *
   * @param message - Raw OTT message
   * @returns true if processed successfully
   */
  async process(message: OTTMessage): Promise<boolean> {
    const routed = await this.route(message);

    if (!routed.shouldProcess) {
      return false;
    }

    // Process through all handlers
    for (const [_name, handler] of this.handlers) {
      try {
        await handler(routed);
      } catch (error) {
        // Log handler error but continue
        console.error(`Handler error: ${error}`);
      }
    }

    return true;
  }

  /**
   * Decide whether to route the message.
   */
  private decideRoute(violations: string[], rateLimitExceeded: boolean): RouteDecision {
    // Check rate limit
    if (rateLimitExceeded) {
      return {
        allow: false,
        reason: 'Rate limit exceeded',
      };
    }

    // Check for critical violations
    if (this.config.blockOnCriticalViolation) {
      const critical = violations.filter((v) =>
        this.config.criticalViolations.includes(v)
      );

      if (critical.length > 0) {
        return {
          allow: false,
          reason: `Critical violation: ${critical.join(', ')}`,
        };
      }
    }

    // Check violation count threshold
    if (violations.length >= this.config.maxViolationsBeforeBlock) {
      return {
        allow: false,
        reason: `Too many violations: ${violations.length}`,
      };
    }

    return {
      allow: true,
      handler: 'default',
    };
  }

  /**
   * Check rate limiting for a sender.
   */
  private checkRateLimit(senderId: string): boolean {
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const limit = this.config.rateLimitPerMinute;

    // Get or initialize timestamps
    let timestamps = this.messageTimestamps.get(senderId);
    if (!timestamps) {
      timestamps = [];
      this.messageTimestamps.set(senderId, timestamps);
    }

    // Filter to recent window
    const recent = timestamps.filter((t) => now - t < windowMs);
    this.messageTimestamps.set(senderId, recent);

    // Check limit
    if (recent.length >= limit) {
      return true;
    }

    // Add current timestamp
    recent.push(now);
    return false;
  }

  /**
   * Track violation count per sender.
   */
  private trackViolations(senderId: string, count: number): void {
    const current = this.violationCounts.get(senderId) ?? 0;
    this.violationCounts.set(senderId, current + count);
  }

  /**
   * Get violation count for a sender.
   */
  getViolationCount(senderId: string): number {
    return this.violationCounts.get(senderId) ?? 0;
  }

  /**
   * Reset violation count for a sender.
   */
  resetViolationCount(senderId: string): void {
    this.violationCounts.delete(senderId);
  }

  /**
   * Audit a routed message.
   */
  private async auditMessage(routed: RoutedMessage): Promise<void> {
    if (routed.violations.length > 0) {
      // Log violations - conditionally include blockReason
      const violationEntry: Parameters<typeof auditOTTViolation>[0] = {
        messageId: routed.original.messageId,
        source: routed.original.source,
        senderId: routed.original.senderId,
        violations: routed.violations,
        blocked: !routed.shouldProcess,
        timestamp: routed.processedAt.toISOString(),
      };
      if (routed.blockReason !== undefined) {
        violationEntry.blockReason = routed.blockReason;
      }
      await auditOTTViolation(violationEntry);
    } else {
      // Log clean message
      await auditOTTMessage({
        messageId: routed.original.messageId,
        source: routed.original.source,
        senderId: routed.original.senderId,
        contentLength: routed.original.content.length,
        processed: routed.shouldProcess,
        timestamp: routed.processedAt.toISOString(),
      });
    }
  }

  /**
   * Get router statistics.
   */
  getStats(): {
    handlersRegistered: number;
    sendersTracked: number;
    totalViolations: number;
  } {
    let totalViolations = 0;
    for (const count of this.violationCounts.values()) {
      totalViolations += count;
    }

    return {
      handlersRegistered: this.handlers.size,
      sendersTracked: this.violationCounts.size,
      totalViolations,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalRouter: OTTMessageRouter | undefined;

/**
 * Get the global OTT message router.
 */
export function getOTTRouter(): OTTMessageRouter {
  if (!globalRouter) {
    globalRouter = new OTTMessageRouter();
  }
  return globalRouter;
}

/**
 * Reset the global OTT message router.
 */
export function resetOTTRouter(): void {
  globalRouter = undefined;
}

/**
 * Create a new OTT message router with custom config.
 */
export function createOTTRouter(config?: Partial<MessageRouterConfig>): OTTMessageRouter {
  return new OTTMessageRouter(config);
}

// ============================================================================
// Channel Integration (Sprint 46)
// ============================================================================

/**
 * Incoming message type from channels.
 * Mirrors IncomingMessage from types.ts for compatibility.
 */
interface ChannelIncomingMessage {
  messageId: string;
  senderId: string;
  content: string;
  receivedAt: Date;
  replyTo?: string;
  senderName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Sanitized message result after routing.
 */
export interface SanitizedChannelMessage {
  /** Original incoming message */
  original: ChannelIncomingMessage;
  /** Sanitized content */
  sanitized: string;
  /** Detected violations */
  violations: string[];
  /** Whether message should be processed */
  allowed: boolean;
  /** Block reason if denied */
  blockReason?: string;
}

/**
 * Secure message handler that wraps through OTTMessageRouter.
 */
export type SecureMessageHandler = (message: SanitizedChannelMessage) => Promise<void>;

/**
 * Wire a bidirectional channel's messages through OTTMessageRouter.
 *
 * Creates a secure handler that:
 * 1. Converts IncomingMessage to OTTMessage
 * 2. Routes through security checks
 * 3. Only calls handler if allowed
 *
 * @param source - Channel source identifier
 * @param handler - Handler for sanitized messages
 * @param router - Optional router instance (defaults to global)
 * @returns Wrapped handler for channel.onMessage()
 */
export function createSecureChannelHandler(
  source: OTTChannelSource,
  handler: SecureMessageHandler,
  router?: OTTMessageRouter
): (message: ChannelIncomingMessage) => Promise<void> {
  const routerInstance = router ?? getOTTRouter();

  return async (incoming: ChannelIncomingMessage): Promise<void> => {
    // Convert to OTTMessage
    const ottMessage: OTTMessage = {
      messageId: incoming.messageId,
      source,
      senderId: incoming.senderId,
      content: incoming.content,
      receivedAt: incoming.receivedAt,
    };

    // Conditionally add optional properties (exactOptionalPropertyTypes)
    if (incoming.replyTo !== undefined) {
      ottMessage.replyTo = incoming.replyTo;
    }
    if (incoming.metadata !== undefined) {
      ottMessage.metadata = incoming.metadata;
    }

    // Route through security
    const routed = await routerInstance.route(ottMessage);

    // Build sanitized message for handler
    const sanitized: SanitizedChannelMessage = {
      original: incoming,
      sanitized: routed.sanitized,
      violations: routed.violations,
      allowed: routed.shouldProcess,
    };

    if (routed.blockReason) {
      sanitized.blockReason = routed.blockReason;
    }

    // Call handler (it decides what to do with blocked messages)
    await handler(sanitized);
  };
}

/**
 * Create a handler that only processes allowed messages.
 *
 * @param handler - Handler for allowed sanitized content
 * @returns Secure handler wrapper
 */
export function createAllowedOnlyHandler(
  handler: (content: string, original: ChannelIncomingMessage) => Promise<void>
): SecureMessageHandler {
  return async (message: SanitizedChannelMessage): Promise<void> => {
    if (message.allowed) {
      await handler(message.sanitized, message.original);
    }
    // Blocked messages are silently dropped
  };
}
