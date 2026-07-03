/**
 * Checkpoint Serializer
 *
 * JSON serialization with optional compression for checkpoints.
 * Handles Date objects and provides size optimization.
 *
 * @module sessions/checkpoint/serializer
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 2-3
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { gzipSync, gunzipSync } from "node:zlib";
import type { CheckpointState, CheckpointSummary } from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Compression threshold in bytes (50KB).
 * Checkpoints larger than this are automatically compressed.
 */
export const COMPRESSION_THRESHOLD = 50 * 1024;

/**
 * Magic header for compressed checkpoints.
 */
const COMPRESSED_HEADER = "CKPT_GZ:";

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize a checkpoint to JSON string.
 *
 * @param checkpoint - Checkpoint state to serialize
 * @param compress - Force compression (default: auto based on size)
 * @returns JSON string (possibly gzipped and base64 encoded)
 */
export function serializeCheckpoint(checkpoint: CheckpointState, compress?: boolean): string {
  // Convert to JSON with date handling
  const json = JSON.stringify(checkpoint, dateReplacer);

  // Auto-compress if above threshold or forced
  const shouldCompress = compress ?? json.length > COMPRESSION_THRESHOLD;

  if (shouldCompress) {
    const compressed = gzipSync(Buffer.from(json, "utf8"));
    return COMPRESSED_HEADER + compressed.toString("base64");
  }

  return json;
}

/**
 * Deserialize a checkpoint from JSON string.
 *
 * @param data - Serialized checkpoint string
 * @returns Checkpoint state
 */
export function deserializeCheckpoint(data: string): CheckpointState {
  let json: string;

  // Check for compression header
  if (data.startsWith(COMPRESSED_HEADER)) {
    const base64 = data.slice(COMPRESSED_HEADER.length);
    const compressed = Buffer.from(base64, "base64");
    json = gunzipSync(compressed).toString("utf8");
  } else {
    json = data;
  }

  // Parse with date revival
  return JSON.parse(json, dateReviver) as CheckpointState;
}

/**
 * Check if serialized data is compressed.
 *
 * @param data - Serialized checkpoint string
 * @returns True if compressed
 */
export function isCompressed(data: string): boolean {
  return data.startsWith(COMPRESSED_HEADER);
}

/**
 * Get size of serialized checkpoint in bytes.
 *
 * @param data - Serialized checkpoint string
 * @returns Size in bytes
 */
export function getSerializedSize(data: string): number {
  return Buffer.byteLength(data, "utf8");
}

// ============================================================================
// Date Handling
// ============================================================================

/**
 * JSON replacer for Date objects.
 * Uses `this[key]` to access raw Date before JSON.stringify transforms it via toJSON().
 */
function dateReplacer(this: unknown, key: string, value: unknown): unknown {
  // Access the raw value from the object context
  // JSON.stringify calls toJSON() on Dates before passing to replacer,
  // so we need to check the original value via this[key]
  const rawValue = (this as Record<string, unknown>)[key];
  if (rawValue instanceof Date) {
    return { __type: "Date", __value: rawValue.toISOString() };
  }
  return value;
}

/**
 * JSON reviver for Date objects.
 */
function dateReviver(_key: string, value: unknown): unknown {
  if (
    typeof value === "object" &&
    value !== null &&
    "__type" in value &&
    (value as { __type: string }).__type === "Date" &&
    "__value" in value
  ) {
    return new Date((value as { __value: string }).__value);
  }
  return value;
}

// ============================================================================
// Summary Extraction
// ============================================================================

/**
 * Extract a lightweight summary from a checkpoint.
 *
 * @param checkpoint - Full checkpoint state
 * @param sizeBytes - Size of serialized checkpoint
 * @param compressed - Whether checkpoint is compressed
 * @returns Checkpoint summary
 */
export function extractSummary(
  checkpoint: CheckpointState,
  sizeBytes: number,
  compressed: boolean,
): CheckpointSummary {
  const summary: CheckpointSummary = {
    id: checkpoint.meta.id,
    createdAt: checkpoint.meta.createdAt,
    reason: checkpoint.meta.reason,
    sessionCost: checkpoint.cost.sessionCostSoFar,
    filesModified: checkpoint.filesystem.modifiedFiles.length,
    currentPhase: checkpoint.execution.currentPhase,
    sizeBytes,
    compressed,
  };
  if (checkpoint.meta.description !== undefined) {
    summary.description = checkpoint.meta.description;
  }
  return summary;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate checkpoint structure.
 *
 * @param checkpoint - Checkpoint to validate
 * @throws Error if checkpoint is invalid
 */
export function validateCheckpoint(checkpoint: CheckpointState): void {
  // Check required fields
  if (!checkpoint.meta?.id) {
    throw new Error("Checkpoint missing meta.id");
  }
  if (!checkpoint.meta?.schemaVersion) {
    throw new Error("Checkpoint missing meta.schemaVersion");
  }
  if (!checkpoint.meta?.createdAt) {
    throw new Error("Checkpoint missing meta.createdAt");
  }
  if (!checkpoint.meta?.reason) {
    throw new Error("Checkpoint missing meta.reason");
  }

  // Validate session
  if (!checkpoint.session?.session?.id) {
    throw new Error("Checkpoint missing session.session.id");
  }
  if (!checkpoint.session?.activeSoul) {
    throw new Error("Checkpoint missing session.activeSoul");
  }

  // Validate execution
  if (!checkpoint.execution?.currentPhase) {
    throw new Error("Checkpoint missing execution.currentPhase");
  }

  // Validate provenance
  if (!checkpoint.provenance?.repoCommitSha) {
    throw new Error("Checkpoint missing provenance.repoCommitSha");
  }
  if (!checkpoint.provenance?.nodeVersion) {
    throw new Error("Checkpoint missing provenance.nodeVersion");
  }

  // Validate brain
  if (!checkpoint.brain?.brainVersion) {
    throw new Error("Checkpoint missing brain.brainVersion");
  }
  if (!checkpoint.brain?.brainDigest) {
    throw new Error("Checkpoint missing brain.brainDigest");
  }
}

/**
 * Sanitize checkpoint for storage (remove sensitive data).
 *
 * @param checkpoint - Checkpoint to sanitize
 * @returns Sanitized checkpoint
 */
export function sanitizeCheckpoint(checkpoint: CheckpointState): CheckpointState {
  // Deep clone to avoid modifying original
  const sanitized = deserializeCheckpoint(serializeCheckpoint(checkpoint, false));

  // Sanitize environment fingerprint (keep only safe keys)
  const safeEnvKeys = ["SHELL", "LANG", "TERM", "NODE_ENV", "PWD"];
  const envFingerprint: Record<string, string> = {};
  for (const key of safeEnvKeys) {
    if (sanitized.provenance.envFingerprint[key]) {
      envFingerprint[key] = sanitized.provenance.envFingerprint[key];
    }
  }
  sanitized.provenance.envFingerprint = envFingerprint;

  // Clear any cached outputs that might contain sensitive data
  sanitized.idempotency.toolCallOutputsCache = {};

  return sanitized;
}
