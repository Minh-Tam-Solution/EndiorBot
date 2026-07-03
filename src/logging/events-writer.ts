/**
 * Events Writer for JSONL File Storage
 *
 * Writes event log entries to ~/.endiorbot/events.jsonl in append-only mode.
 * Provides low-overhead event logging for the Autonomy Epic (Sprint 35).
 *
 * @module logging/events-writer
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 1
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { WriteStream } from "node:fs";
import { type EventLog, serializeEvent } from "./event-types.js";

// ============================================================================
// Events Writer Class
// ============================================================================

/**
 * Events writer for JSONL file storage.
 *
 * Writes events to a JSONL file in append-only mode.
 * Uses buffered writes for performance.
 *
 * @example
 * ```typescript
 * const writer = new EventsWriter("~/.endiorbot/events.jsonl");
 * await writer.write(event);
 * await writer.flush();
 * await writer.close();
 * ```
 */
export class EventsWriter {
  private readonly filePath: string;
  private writeStream: WriteStream | null = null;
  private pendingWrites: number = 0;
  private closed: boolean = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Ensure the directory exists and create write stream.
   */
  private ensureStream(): WriteStream {
    if (this.closed) {
      throw new Error("EventsWriter is closed");
    }

    if (!this.writeStream) {
      // Ensure directory exists
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Create write stream in append mode
      this.writeStream = createWriteStream(this.filePath, {
        flags: "a", // Append mode
        encoding: "utf8",
        autoClose: false,
      });

      // Handle errors
      this.writeStream.on("error", (err) => {
        console.error(`EventsWriter error: ${err.message}`);
      });
    }

    return this.writeStream;
  }

  /**
   * Write an event to the JSONL file.
   *
   * @param event - Event log entry to write
   * @returns Promise that resolves when write is queued
   */
  async write(event: EventLog): Promise<void> {
    const stream = this.ensureStream();
    const line = serializeEvent(event) + "\n";

    return new Promise<void>((resolve, reject) => {
      this.pendingWrites++;

      const success = stream.write(line, "utf8", (err) => {
        this.pendingWrites--;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });

      // If buffer is full, wait for drain
      if (!success) {
        stream.once("drain", () => {
          // Write already queued, just wait
        });
      }
    });
  }

  /**
   * Write multiple events in batch.
   *
   * @param events - Event log entries to write
   * @returns Promise that resolves when all writes are queued
   */
  async writeBatch(events: EventLog[]): Promise<void> {
    for (const event of events) {
      await this.write(event);
    }
  }

  /**
   * Flush pending writes to disk.
   *
   * @returns Promise that resolves when all writes are flushed
   */
  async flush(): Promise<void> {
    if (!this.writeStream) {
      return;
    }

    return new Promise<void>((resolve) => {
      // Wait for pending writes
      const checkPending = (): void => {
        if (this.pendingWrites === 0) {
          resolve();
        } else {
          setTimeout(checkPending, 10);
        }
      };
      checkPending();
    });
  }

  /**
   * Close the write stream.
   *
   * @returns Promise that resolves when stream is closed
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    if (!this.writeStream) {
      return;
    }

    await this.flush();

    return new Promise<void>((resolve, reject) => {
      if (!this.writeStream) {
        resolve();
        return;
      }

      this.writeStream.end(() => {
        this.writeStream = null;
        resolve();
      });

      this.writeStream.on("error", reject);
    });
  }

  /**
   * Get the file path being written to.
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Check if the writer is closed.
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Get the number of pending writes.
   */
  getPendingWrites(): number {
    return this.pendingWrites;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an events writer for the default events file.
 *
 * @param stateDir - State directory (default: ~/.endiorbot/)
 * @returns EventsWriter instance
 */
export function createEventsWriter(stateDir?: string): EventsWriter {
  const baseDir = stateDir ?? `${process.env.HOME}/.endiorbot`;
  const filePath = `${baseDir}/events.jsonl`;
  return new EventsWriter(filePath);
}
