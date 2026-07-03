/**
 * Checkpoint Migration
 *
 * Forward-only migration strategies for checkpoint schema upgrades.
 * Per CTO guidance: no backward migrations to prevent data corruption.
 *
 * @module sessions/checkpoint/migration
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 5
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type { CheckpointState } from "./types.js";
import { CHECKPOINT_SCHEMA_VERSION } from "./types.js";
import {
  checkVersionCompatibility,
  compareVersions,
  VersionIncompatibleError,
  MigrationError,
} from "./versioning.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Migration function signature.
 */
export type MigrationFn = (checkpoint: unknown) => unknown;

/**
 * Migration step definition.
 */
export interface MigrationStep {
  /** Source version */
  fromVersion: string;
  /** Target version */
  toVersion: string;
  /** Migration function */
  migrate: MigrationFn;
  /** Description of changes */
  description: string;
}

/**
 * Migration result.
 */
export interface MigrationResult {
  /** Whether migration succeeded */
  success: boolean;
  /** Original version */
  originalVersion: string;
  /** Final version after migration */
  finalVersion: string;
  /** List of migrations applied */
  migrationsApplied: string[];
  /** Migrated checkpoint (if successful) */
  checkpoint?: CheckpointState;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Migration registry.
 */
export interface MigrationRegistry {
  /** Registered migrations by source version */
  migrations: Map<string, MigrationStep>;
  /** Add a migration */
  register: (step: MigrationStep) => void;
  /** Get migration for a version */
  get: (fromVersion: string) => MigrationStep | undefined;
  /** Check if migration exists */
  has: (fromVersion: string) => boolean;
  /** Get all registered versions */
  versions: () => string[];
}

// ============================================================================
// Migration Registry
// ============================================================================

/**
 * Global migration registry.
 */
const migrationRegistry: MigrationRegistry = {
  migrations: new Map(),

  register(step: MigrationStep): void {
    this.migrations.set(step.fromVersion, step);
  },

  get(fromVersion: string): MigrationStep | undefined {
    return this.migrations.get(fromVersion);
  },

  has(fromVersion: string): boolean {
    return this.migrations.has(fromVersion);
  },

  versions(): string[] {
    return Array.from(this.migrations.keys()).sort(compareVersions);
  },
};

/**
 * Register a migration step.
 *
 * @param step - Migration step to register
 */
export function registerMigration(step: MigrationStep): void {
  migrationRegistry.register(step);
}

/**
 * Get the migration registry (for testing).
 */
export function getMigrationRegistry(): MigrationRegistry {
  return migrationRegistry;
}

/**
 * Clear all registered migrations (for testing).
 */
export function clearMigrations(): void {
  migrationRegistry.migrations.clear();
}

// ============================================================================
// Built-in Migrations
// ============================================================================

/**
 * Initialize built-in migrations.
 * Called automatically on module load.
 */
function initializeBuiltinMigrations(): void {
  // Example migration: 1.0.0 → 1.0.1
  // This is a placeholder for future migrations
  // Each migration should be a pure function that transforms the checkpoint
}

// Initialize on module load
initializeBuiltinMigrations();

// ============================================================================
// Migration Execution
// ============================================================================

/**
 * Find migration path from source to target version.
 *
 * @param fromVersion - Source version
 * @param toVersion - Target version
 * @returns List of migration steps (in order)
 */
export function findMigrationPath(
  fromVersion: string,
  toVersion: string,
): MigrationStep[] {
  const path: MigrationStep[] = [];
  let currentVersion = fromVersion;

  // Walk through migrations until we reach target
  while (compareVersions(currentVersion, toVersion) < 0) {
    const step = migrationRegistry.get(currentVersion);

    if (!step) {
      // No migration from this version - check if we can skip
      // If the target is the current schema version and we're at a version
      // without explicit migration, assume compatible (no changes needed)
      //
      // NOTE: When no migration is registered and target is current schema,
      // we assume the checkpoint is compatible with the current schema.
      // Once the first real migration is registered (e.g. 1.0.0 → 1.0.1),
      // this assumption must be reviewed — older checkpoints without a
      // migration hop could silently skip a required transformation.
      if (toVersion === CHECKPOINT_SCHEMA_VERSION) {
        break;
      }
      return []; // No path found
    }

    path.push(step);
    currentVersion = step.toVersion;

    // Safety: prevent infinite loops
    if (path.length > 100) {
      return [];
    }
  }

  return path;
}

/**
 * Apply a single migration step.
 *
 * @param checkpoint - Checkpoint to migrate
 * @param step - Migration step to apply
 * @returns Migrated checkpoint
 */
export function applyMigrationStep(
  checkpoint: unknown,
  step: MigrationStep,
): unknown {
  try {
    return step.migrate(checkpoint);
  } catch (error) {
    throw new MigrationError(
      step.fromVersion,
      step.toVersion,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

/**
 * Migrate a checkpoint to the current schema version.
 *
 * @param checkpoint - Checkpoint to migrate (raw, possibly old version)
 * @returns Migration result
 */
export function migrateCheckpoint(checkpoint: unknown): MigrationResult {
  // Extract version from checkpoint
  const rawCheckpoint = checkpoint as Record<string, unknown>;
  const meta = rawCheckpoint.meta as Record<string, unknown> | undefined;
  const originalVersion = (meta?.schemaVersion as string) ?? "unknown";

  // Check compatibility
  const compatibility = checkVersionCompatibility(originalVersion);

  // Block if checkpoint is newer than code
  if (compatibility.comparison === "newer") {
    return {
      success: false,
      originalVersion,
      finalVersion: originalVersion,
      migrationsApplied: [],
      error: compatibility.message,
    };
  }

  // No migration needed if versions match
  if (!compatibility.migrationRequired) {
    return {
      success: true,
      originalVersion,
      finalVersion: originalVersion,
      migrationsApplied: [],
      checkpoint: checkpoint as CheckpointState,
    };
  }

  // Find migration path
  const path = findMigrationPath(originalVersion, CHECKPOINT_SCHEMA_VERSION);

  // If no path but migration required, apply implicit migration
  // (update schema version without data changes)
  if (path.length === 0) {
    const migrated = applyImplicitMigration(checkpoint, CHECKPOINT_SCHEMA_VERSION);
    return {
      success: true,
      originalVersion,
      finalVersion: CHECKPOINT_SCHEMA_VERSION,
      migrationsApplied: [`${originalVersion} → ${CHECKPOINT_SCHEMA_VERSION} (implicit)`],
      checkpoint: migrated,
    };
  }

  // Apply migrations in order
  let current = checkpoint;
  const applied: string[] = [];

  for (const step of path) {
    try {
      current = applyMigrationStep(current, step);
      applied.push(`${step.fromVersion} → ${step.toVersion}`);
    } catch (error) {
      return {
        success: false,
        originalVersion,
        finalVersion: step.fromVersion,
        migrationsApplied: applied,
        error: error instanceof Error ? error.message : "Migration failed",
      };
    }
  }

  return {
    success: true,
    originalVersion,
    finalVersion: CHECKPOINT_SCHEMA_VERSION,
    migrationsApplied: applied,
    checkpoint: current as CheckpointState,
  };
}

/**
 * Apply implicit migration (version bump without data changes).
 *
 * Used when checkpoint schema is compatible but version number differs.
 */
function applyImplicitMigration(
  checkpoint: unknown,
  targetVersion: string,
): CheckpointState {
  const raw = checkpoint as Record<string, unknown>;
  const meta = { ...(raw.meta as Record<string, unknown>) };

  // Update schema version
  meta.schemaVersion = targetVersion;

  return {
    ...raw,
    meta,
  } as unknown as CheckpointState;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that a checkpoint can be loaded.
 *
 * @param checkpoint - Raw checkpoint data
 * @throws VersionIncompatibleError if version is incompatible
 */
export function validateCheckpointVersion(checkpoint: unknown): void {
  const rawCheckpoint = checkpoint as Record<string, unknown>;
  const meta = rawCheckpoint.meta as Record<string, unknown> | undefined;
  const version = (meta?.schemaVersion as string) ?? "unknown";

  const compatibility = checkVersionCompatibility(version);

  if (!compatibility.compatible && compatibility.comparison === "newer") {
    throw new VersionIncompatibleError(compatibility);
  }
}

/**
 * Check if a checkpoint needs migration.
 *
 * @param checkpoint - Raw checkpoint data
 * @returns True if migration is needed
 */
export function needsMigration(checkpoint: unknown): boolean {
  const rawCheckpoint = checkpoint as Record<string, unknown>;
  const meta = rawCheckpoint.meta as Record<string, unknown> | undefined;
  const version = (meta?.schemaVersion as string) ?? "unknown";

  const compatibility = checkVersionCompatibility(version);
  return compatibility.migrationRequired;
}

/**
 * Get checkpoint version.
 *
 * @param checkpoint - Raw checkpoint data
 * @returns Version string or "unknown"
 */
export function getCheckpointVersion(checkpoint: unknown): string {
  const rawCheckpoint = checkpoint as Record<string, unknown>;
  const meta = rawCheckpoint.meta as Record<string, unknown> | undefined;
  return (meta?.schemaVersion as string) ?? "unknown";
}

// ============================================================================
// Migration Builder
// ============================================================================

/**
 * Builder for creating migration steps.
 */
export class MigrationBuilder {
  private fromVer: string = "";
  private toVer: string = "";
  private desc: string = "";
  private migrateFn: MigrationFn = (c) => c;

  /**
   * Set source version.
   */
  from(version: string): this {
    this.fromVer = version;
    return this;
  }

  /**
   * Set target version.
   */
  to(version: string): this {
    this.toVer = version;
    return this;
  }

  /**
   * Set description.
   */
  description(desc: string): this {
    this.desc = desc;
    return this;
  }

  /**
   * Set migration function.
   */
  migrate(fn: MigrationFn): this {
    this.migrateFn = fn;
    return this;
  }

  /**
   * Build and register the migration.
   */
  register(): MigrationStep {
    const step: MigrationStep = {
      fromVersion: this.fromVer,
      toVersion: this.toVer,
      description: this.desc,
      migrate: this.migrateFn,
    };

    registerMigration(step);
    return step;
  }
}

/**
 * Create a new migration builder.
 */
export function defineMigration(): MigrationBuilder {
  return new MigrationBuilder();
}
