/**
 * Checkpoint Versioning
 *
 * Schema version management for checkpoint compatibility.
 * Implements forward-only migrations per CTO guidance.
 *
 * @module sessions/checkpoint/versioning
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 35 Day 5
 * @authority ADR-006 Checkpoint State Model
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { CHECKPOINT_SCHEMA_VERSION } from "./types.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Version comparison result.
 */
export type VersionComparison = "equal" | "older" | "newer" | "invalid";

/**
 * Version compatibility result.
 */
export interface VersionCompatibility {
  /** Whether the versions are compatible */
  compatible: boolean;
  /** Current code schema version */
  codeVersion: string;
  /** Checkpoint schema version */
  checkpointVersion: string;
  /** Comparison result */
  comparison: VersionComparison;
  /** Whether migration is required */
  migrationRequired: boolean;
  /** Whether migration is possible */
  migrationPossible: boolean;
  /** Human-readable message */
  message: string;
}

/**
 * Parsed semver version.
 */
export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  valid: boolean;
}

// ============================================================================
// Version Parsing
// ============================================================================

/**
 * Parse a semver version string.
 *
 * @param version - Version string (e.g., "1.2.3")
 * @returns Parsed version object
 */
export function parseVersion(version: string): ParsedVersion {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    return { major: 0, minor: 0, patch: 0, valid: false };
  }

  // Type narrowing: regex guarantees match[1-3] exist when match is not null
  const [, majorStr, minorStr, patchStr] = match;
  if (!majorStr || !minorStr || !patchStr) {
    return { major: 0, minor: 0, patch: 0, valid: false };
  }

  return {
    major: parseInt(majorStr, 10),
    minor: parseInt(minorStr, 10),
    patch: parseInt(patchStr, 10),
    valid: true,
  };
}

/**
 * Check if a version string is valid semver.
 *
 * @param version - Version string to validate
 * @returns True if valid semver
 */
export function isValidVersion(version: string): boolean {
  return parseVersion(version).valid;
}

/**
 * Format a parsed version back to string.
 *
 * @param parsed - Parsed version
 * @returns Version string
 */
export function formatVersion(parsed: ParsedVersion): string {
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

// ============================================================================
// Version Comparison
// ============================================================================

/**
 * Compare two versions.
 *
 * @param version1 - First version
 * @param version2 - Second version
 * @returns Comparison result: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(version1: string, version2: string): number {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (!v1.valid || !v2.valid) {
    return 0; // Treat invalid as equal to avoid breaking
  }

  // Compare major
  if (v1.major !== v2.major) {
    return v1.major > v2.major ? 1 : -1;
  }

  // Compare minor
  if (v1.minor !== v2.minor) {
    return v1.minor > v2.minor ? 1 : -1;
  }

  // Compare patch
  if (v1.patch !== v2.patch) {
    return v1.patch > v2.patch ? 1 : -1;
  }

  return 0;
}

/**
 * Get version comparison result.
 *
 * @param checkpointVersion - Version from checkpoint
 * @param codeVersion - Current code version (defaults to CHECKPOINT_SCHEMA_VERSION)
 * @returns Version comparison enum
 */
export function getVersionComparison(
  checkpointVersion: string,
  codeVersion: string = CHECKPOINT_SCHEMA_VERSION,
): VersionComparison {
  const v1 = parseVersion(checkpointVersion);
  const v2 = parseVersion(codeVersion);

  if (!v1.valid || !v2.valid) {
    return "invalid";
  }

  const cmp = compareVersions(checkpointVersion, codeVersion);

  if (cmp === 0) {
    return "equal";
  } else if (cmp < 0) {
    return "older"; // Checkpoint is older than code
  } else {
    return "newer"; // Checkpoint is newer than code
  }
}

// ============================================================================
// Compatibility Checking
// ============================================================================

/**
 * Check version compatibility between checkpoint and code.
 *
 * Per CTO guidance:
 * - Forward-only migrations (older checkpoint → current code is OK)
 * - Block on higher schema version (checkpoint newer than code)
 *
 * @param checkpointVersion - Version from checkpoint
 * @param codeVersion - Current code version (defaults to CHECKPOINT_SCHEMA_VERSION)
 * @returns Compatibility result
 */
export function checkVersionCompatibility(
  checkpointVersion: string,
  codeVersion: string = CHECKPOINT_SCHEMA_VERSION,
): VersionCompatibility {
  const comparison = getVersionComparison(checkpointVersion, codeVersion);
  const checkpointParsed = parseVersion(checkpointVersion);
  const codeParsed = parseVersion(codeVersion);

  // Invalid version
  if (comparison === "invalid") {
    return {
      compatible: false,
      codeVersion,
      checkpointVersion,
      comparison,
      migrationRequired: false,
      migrationPossible: false,
      message: `Invalid version format: checkpoint="${checkpointVersion}", code="${codeVersion}"`,
    };
  }

  // Equal versions - no migration needed
  if (comparison === "equal") {
    return {
      compatible: true,
      codeVersion,
      checkpointVersion,
      comparison,
      migrationRequired: false,
      migrationPossible: true,
      message: "Versions match, no migration needed",
    };
  }

  // Checkpoint is OLDER than code - migration possible (forward migration)
  if (comparison === "older") {
    // Check if migration is possible based on major version
    const majorCompatible = checkpointParsed.major === codeParsed.major;

    return {
      compatible: majorCompatible,
      codeVersion,
      checkpointVersion,
      comparison,
      migrationRequired: true,
      migrationPossible: majorCompatible,
      message: majorCompatible
        ? `Checkpoint v${checkpointVersion} can be migrated to v${codeVersion}`
        : `Major version mismatch: checkpoint v${checkpointVersion} cannot be migrated to v${codeVersion}`,
    };
  }

  // Checkpoint is NEWER than code - BLOCK (per CTO guidance)
  // This prevents silent data corruption when rolling back binary
  return {
    compatible: false,
    codeVersion,
    checkpointVersion,
    comparison,
    migrationRequired: false,
    migrationPossible: false,
    message: `BLOCKED: Checkpoint v${checkpointVersion} is newer than code v${codeVersion}. ` +
      `Upgrade your EndiorBot installation or delete the checkpoint.`,
  };
}

// ============================================================================
// Version Utilities
// ============================================================================

/**
 * Get the current schema version.
 */
export function getCurrentSchemaVersion(): string {
  return CHECKPOINT_SCHEMA_VERSION;
}

/**
 * Increment version by level.
 *
 * @param version - Current version
 * @param level - Level to increment ('major', 'minor', 'patch')
 * @returns New version string
 */
export function incrementVersion(
  version: string,
  level: "major" | "minor" | "patch",
): string {
  const parsed = parseVersion(version);

  if (!parsed.valid) {
    return version;
  }

  switch (level) {
    case "major":
      return `${parsed.major + 1}.0.0`;
    case "minor":
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case "patch":
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    default:
      return version;
  }
}

/**
 * Get all versions between two versions (exclusive).
 *
 * @param fromVersion - Starting version (exclusive)
 * @param toVersion - Ending version (inclusive)
 * @returns List of intermediate versions
 */
export function getVersionRange(
  fromVersion: string,
  toVersion: string,
): string[] {
  const from = parseVersion(fromVersion);
  const to = parseVersion(toVersion);

  if (!from.valid || !to.valid) {
    return [];
  }

  // Only support same major version ranges
  if (from.major !== to.major) {
    return [];
  }

  const versions: string[] = [];
  const current = { ...from };

  // Increment patch versions within minor
  while (compareVersions(formatVersion(current), toVersion) < 0) {
    // Increment patch
    current.patch++;

    // If patch overflows, increment minor
    if (current.minor < to.minor && current.patch > 99) {
      current.minor++;
      current.patch = 0;
    }

    // If minor overflows, stop
    if (current.minor > to.minor) {
      break;
    }

    const formatted = formatVersion(current);
    if (compareVersions(formatted, toVersion) <= 0) {
      versions.push(formatted);
    }

    // Safety: prevent infinite loops
    if (versions.length > 100) {
      break;
    }
  }

  return versions;
}

/**
 * Check if a version is within a range.
 *
 * @param version - Version to check
 * @param minVersion - Minimum version (inclusive)
 * @param maxVersion - Maximum version (inclusive)
 * @returns True if version is within range
 */
export function isVersionInRange(
  version: string,
  minVersion: string,
  maxVersion: string,
): boolean {
  const cmpMin = compareVersions(version, minVersion);
  const cmpMax = compareVersions(version, maxVersion);

  return cmpMin >= 0 && cmpMax <= 0;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when checkpoint version is incompatible.
 */
export class VersionIncompatibleError extends Error {
  public readonly checkpointVersion: string;
  public readonly codeVersion: string;
  public readonly comparison: VersionComparison;

  constructor(compatibility: VersionCompatibility) {
    super(compatibility.message);
    this.name = "VersionIncompatibleError";
    this.checkpointVersion = compatibility.checkpointVersion;
    this.codeVersion = compatibility.codeVersion;
    this.comparison = compatibility.comparison;
  }
}

/**
 * Error thrown when migration fails.
 */
export class MigrationError extends Error {
  public readonly fromVersion: string;
  public readonly toVersion: string;
  public readonly reason: string;

  constructor(fromVersion: string, toVersion: string, reason: string) {
    super(`Migration from v${fromVersion} to v${toVersion} failed: ${reason}`);
    this.name = "MigrationError";
    this.fromVersion = fromVersion;
    this.toVersion = toVersion;
    this.reason = reason;
  }
}
