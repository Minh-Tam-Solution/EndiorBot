/**
 * Gateway Chat Methods
 *
 * JSON-RPC methods for chat functionality.
 * Enables Desktop ↔ Provider communication via Gateway.
 *
 * @module gateway/methods/chat
 * @version 1.0.0
 * @date 2026-02-25
 * @status ACTIVE - Sprint 47 Chat Integration
 * @authority Sprint 47 Plan
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { randomUUID } from "crypto";
import type { GatewayServer } from "../server.js";
import type { ClientInfo } from "../types.js";
import { getProviderRegistry } from "../../providers/provider-registry.js";
import type { ChatRequest, ChatResponse, Message, AIProvider } from "../../providers/types.js";
import { recordCost } from "./budget.js";
import { createNotification } from "../protocol/schema.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Chat send parameters.
 */
export interface ChatSendParams {
  /** User message content */
  message: string;
  /** Optional session ID for context */
  sessionId?: string;
  /** Optional model override */
  model?: string;
  /** Optional system prompt */
  systemPrompt?: string;
  /** Optional conversation history */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * Chat send result.
 */
export interface ChatSendResult {
  /** Response ID */
  id: string;
  /** Response content */
  content: string;
  /** Model used */
  model: string;
  /** Token usage */
  usage: {
    input: number;
    output: number;
    cost: number;
  };
}

/**
 * Chat stream parameters.
 */
export interface ChatStreamParams {
  /** User message content */
  message: string;
  /** Optional session ID for context */
  sessionId?: string;
  /** Optional model override */
  model?: string;
  /** Optional system prompt */
  systemPrompt?: string;
  /** Optional conversation history */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * Chat stream start result.
 */
export interface ChatStreamResult {
  /** Stream ID for tracking */
  streamId: string;
  /** Model being used */
  model: string;
}

/**
 * Chat chunk notification data (sent via chat.chunk event).
 */
export interface ChatChunkData {
  /** Stream ID */
  streamId: string;
  /** Delta content */
  delta: string;
  /** Chunk index */
  index: number;
}

/**
 * Chat done notification data (sent via chat.done event).
 */
export interface ChatDoneData {
  /** Stream ID */
  streamId: string;
  /** Full content */
  content: string;
  /** Model used */
  model: string;
  /** Token usage */
  usage: {
    input: number;
    output: number;
    cost: number;
  };
  /** Finish reason */
  finishReason: string;
}

/**
 * Chat error notification data (sent via chat.error event).
 */
export interface ChatErrorData {
  /** Stream ID (if streaming) */
  streamId?: string;
  /** Error message */
  error: string;
  /** Error code */
  code: string;
}

// ============================================================================
// Internal State
// ============================================================================

/** Active streams for cleanup */
const activeStreams = new Map<string, { aborted: boolean }>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build messages array from params.
 */
function buildMessages(
  message: string,
  systemPrompt?: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>
): Message[] {
  const messages: Message[] = [];

  // Add system prompt if provided
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  // Add conversation history
  if (history && history.length > 0) {
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Add current user message
  messages.push({ role: "user", content: message });

  return messages;
}

/**
 * Calculate cost from token usage.
 */
function calculateCost(inputTokens: number, outputTokens: number, model: string): number {
  // Cost per 1K tokens (simplified - could be model-specific)
  const inputCostPer1K = model.includes("gpt-4") ? 0.01 : 0.0015;
  const outputCostPer1K = model.includes("gpt-4") ? 0.03 : 0.002;

  return (inputTokens / 1000) * inputCostPer1K + (outputTokens / 1000) * outputCostPer1K;
}

// ============================================================================
// Method Handlers
// ============================================================================

/** Server reference for notifications */
let serverRef: GatewayServer | null = null;

/**
 * Handle chat.send - Non-streaming chat request.
 */
async function handleChatSend(
  params: unknown,
  _client: ClientInfo
): Promise<ChatSendResult> {
  const { message, sessionId, model, systemPrompt, history } = (params ?? {}) as ChatSendParams;

  if (!message || typeof message !== "string" || message.trim() === "") {
    throw new Error("message is required and must be a non-empty string");
  }

  // Get provider
  const registry = getProviderRegistry();
  const provider = registry.getDefault();

  if (!provider) {
    throw new Error("No AI provider configured. Please configure a provider first.");
  }

  // Get model to use
  const modelToUse = model ?? provider.models[0]?.id ?? "default";

  // Build request
  const chatRequest: ChatRequest = {
    model: modelToUse,
    messages: buildMessages(message, systemPrompt, history),
    temperature: 0.7,
    maxTokens: 4096,
  };

  // Execute chat
  const response: ChatResponse = await provider.chat(chatRequest);

  // Calculate cost
  const cost = calculateCost(
    response.usage.promptTokens,
    response.usage.completionTokens,
    modelToUse
  );

  // Record cost for budget tracking
  if (sessionId) {
    recordCost({
      provider: provider.id,
      model: modelToUse,
      inputTokens: response.usage.promptTokens,
      outputTokens: response.usage.completionTokens,
      cost,
      sessionId,
    });
  }

  return {
    id: response.id,
    content: response.content,
    model: response.model,
    usage: {
      input: response.usage.promptTokens,
      output: response.usage.completionTokens,
      cost,
    },
  };
}

/**
 * Handle chat.stream - Streaming chat request.
 * Returns immediately with streamId, then sends chunks via notifications.
 */
async function handleChatStream(
  params: unknown,
  client: ClientInfo
): Promise<ChatStreamResult> {
  const { message, sessionId, model, systemPrompt, history } = (params ?? {}) as ChatStreamParams;

  if (!message || typeof message !== "string" || message.trim() === "") {
    throw new Error("message is required and must be a non-empty string");
  }

  // Get provider
  const registry = getProviderRegistry();
  const provider = registry.getDefault();

  if (!provider) {
    throw new Error("No AI provider configured. Please configure a provider first.");
  }

  // Get model to use
  const modelToUse = model ?? provider.models[0]?.id ?? "default";

  // Generate stream ID
  const streamId = randomUUID();
  activeStreams.set(streamId, { aborted: false });

  // Build request
  const chatRequest: ChatRequest = {
    model: modelToUse,
    messages: buildMessages(message, systemPrompt, history),
    temperature: 0.7,
    maxTokens: 4096,
    stream: true,
  };

  // Start streaming in background (don't await)
  void processStream(streamId, provider, chatRequest, client, sessionId, modelToUse);

  // Return immediately with stream ID
  return {
    streamId,
    model: modelToUse,
  };
}

/**
 * Process stream and send notifications.
 */
async function processStream(
  streamId: string,
  provider: AIProvider,
  request: ChatRequest,
  client: ClientInfo,
  sessionId: string | undefined,
  model: string
): Promise<void> {
  if (!serverRef) return;

  let fullContent = "";
  let chunkIndex = 0;
  let finishReason = "stop";

  try {
    for await (const chunk of provider.chatStream(request)) {
      // Check if stream was aborted
      const streamState = activeStreams.get(streamId);
      if (!streamState || streamState.aborted) {
        break;
      }

      // Accumulate content
      if (chunk.delta) {
        fullContent += chunk.delta;

        // Send chunk notification
        sendNotification(client.id, "chat.chunk", {
          streamId,
          delta: chunk.delta,
          index: chunkIndex++,
        } as ChatChunkData);
      }

      // Track finish reason
      if (chunk.finishReason) {
        finishReason = chunk.finishReason;
      }
    }

    // Estimate tokens (simplified - real implementation would track from chunks)
    const totalInputTokens = Math.ceil(request.messages.reduce((acc, m) => {
      const content = typeof m.content === "string" ? m.content : "";
      return acc + content.length / 4;
    }, 0));
    const totalOutputTokens = Math.ceil(fullContent.length / 4);

    // Calculate cost
    const cost = calculateCost(totalInputTokens, totalOutputTokens, model);

    // Record cost for budget tracking
    if (sessionId) {
      recordCost({
        provider: provider.id,
        model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cost,
        sessionId,
      });
    }

    // Send done notification
    sendNotification(client.id, "chat.done", {
      streamId,
      content: fullContent,
      model,
      usage: {
        input: totalInputTokens,
        output: totalOutputTokens,
        cost,
      },
      finishReason,
    } as ChatDoneData);

  } catch (error) {
    // Send error notification
    sendNotification(client.id, "chat.error", {
      streamId,
      error: error instanceof Error ? error.message : "Unknown error",
      code: "STREAM_ERROR",
    } as ChatErrorData);
  } finally {
    // Cleanup
    activeStreams.delete(streamId);
  }
}

/**
 * Send JSON-RPC notification to client.
 */
function sendNotification(clientId: string, method: string, params: unknown): void {
  if (!serverRef) return;

  // Get client WebSocket
  const clients = (serverRef as any).clients;
  if (!clients) return;

  const client = clients.get(clientId);
  if (!client || client.readyState !== 1) return; // 1 = WebSocket.OPEN

  // Create proper JSON-RPC notification
  const notification = createNotification(method, params);
  const message = JSON.stringify(notification);

  // Send directly via WebSocket
  client.send(message);
}

/**
 * Handle chat.abort - Abort a streaming request.
 */
function handleChatAbort(
  params: unknown,
  _client: ClientInfo
): { success: boolean } {
  const { streamId } = (params ?? {}) as { streamId?: string };

  if (!streamId) {
    throw new Error("streamId is required");
  }

  const streamState = activeStreams.get(streamId);
  if (!streamState) {
    throw new Error(`Stream not found: ${streamId}`);
  }

  streamState.aborted = true;
  return { success: true };
}

/**
 * Handle chat.history - Get chat history for a session.
 */
function handleChatHistory(
  params: unknown,
  _client: ClientInfo
): { messages: Array<{ role: string; content: string; timestamp: number }> } {
  const { sessionId, limit: _limit = 50 } = (params ?? {}) as {
    sessionId?: string;
    limit?: number;
  };

  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  // DEFERRED(Sprint 147): Implement session history storage (persisted JSONL per session)
  // For now, return empty array
  return { messages: [] };
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Register chat methods with the gateway server.
 */
export function registerChatMethods(server: GatewayServer): void {
  serverRef = server;

  server.registerMethod("chat.send", handleChatSend);
  server.registerMethod("chat.stream", handleChatStream);
  server.registerMethod("chat.abort", handleChatAbort);
  server.registerMethod("chat.history", handleChatHistory);
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Clear active streams (for testing).
 */
export function clearActiveStreams(): void {
  activeStreams.clear();
}

/**
 * Get active streams count (for testing).
 */
export function getActiveStreamsCount(): number {
  return activeStreams.size;
}

/**
 * Reset server reference (for testing).
 */
export function resetServerRef(): void {
  serverRef = null;
}
