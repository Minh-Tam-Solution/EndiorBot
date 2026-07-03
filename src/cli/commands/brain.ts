/**
 * Brain Command
 *
 * CLI command for managing the EndiorBot Brain.
 *
 * Usage:
 *   endiorbot brain status              - Show brain health and status
 *   endiorbot brain export [--output]   - Export brain state to file
 *   endiorbot brain layers [layerId]    - List layers or show entries
 *
 * @module cli/commands/brain
 * @version 1.0.0
 * @date 2026-02-24
 * @status ACTIVE - Sprint 45 Day 9
 * @authority ADR-009 Brain Architecture
 * @pillar 3 - Software Engineering 3.0
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import type { Command } from 'commander';

import { loadCEOProfile } from '../../brain/ceo-profile.js';
import { getBrainHealth, getVersionString } from '../../brain/evolution.js';
import { getAllEvents } from '../../brain/layers/events.js';
import { getAllModels } from '../../brain/layers/mental-models.js';
import { getAllPatterns } from '../../brain/layers/patterns.js';
import { getAllStructures } from '../../brain/layers/structures.js';
import {
  brainExists,
  computeBrainDigest,
  exportBrain,
  initializeBrain,
  readBrainVersion,
} from '../../brain/storage.js';

// ============================================================================
// Terminal Colors
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function green(text: string): string {
  return `${colors.green}${text}${colors.reset}`;
}

function red(text: string): string {
  return `${colors.red}${text}${colors.reset}`;
}

function yellow(text: string): string {
  return `${colors.yellow}${text}${colors.reset}`;
}

function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

function cyan(text: string): string {
  return `${colors.cyan}${text}${colors.reset}`;
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format relative time from ISO string
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Command Actions
// ============================================================================

/**
 * Show brain status.
 */
function statusAction(): void {
  console.log('');
  console.log(bold('═══════════════════════════════════════════════════════════════'));
  console.log(bold('  Brain Status'));
  console.log(bold('═══════════════════════════════════════════════════════════════'));
  console.log('');

  if (!brainExists()) {
    console.log(`  Status:       ${red('not initialized')}`);
    console.log('');
    console.log(dim("  Run 'endiorbot brain init' to initialize the brain"));
    console.log('');
    console.log(bold('═══════════════════════════════════════════════════════════════'));
    console.log('');
    return;
  }

  try {
    const health = getBrainHealth();
    const version = readBrainVersion();
    const digest = computeBrainDigest();

    const status = health.initialized ? green('healthy') : red('unhealthy');
    const versionStr = getVersionString();

    console.log(`  Status:       ${status}`);
    console.log(`  Version:      ${cyan(versionStr)}`);
    console.log(`  Digest:       ${dim(digest.hash)}`);
    console.log(`  Updated:      ${formatRelativeTime(version.updatedAt)}`);
    console.log('');
    console.log(`  ${bold('Layers:')}`);
    console.log(`    Events:         ${health.layers.events} entries`);
    console.log(`    Patterns:       ${health.layers.patterns} patterns`);
    console.log(`    Structures:     ${health.layers.structures} structures`);
    console.log(`    Mental Models:  ${health.layers.mentalModels} rules`);
    console.log('');

    // CEO Profile
    try {
      const profile = loadCEOProfile();
      const ceoStatus = profile ? green('loaded') : yellow('not loaded');
      console.log(`  CEO Profile:  ${ceoStatus}`);
    } catch {
      console.log(`  CEO Profile:  ${dim('not loaded')}`);
    }

    console.log('');
    console.log(bold('═══════════════════════════════════════════════════════════════'));
    console.log('');
  } catch (error) {
    console.error(red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
    console.log('');
    console.log(bold('═══════════════════════════════════════════════════════════════'));
    console.log('');
  }
}

/**
 * Export brain state.
 */
interface ExportOptions {
  output?: string;
}

function exportAction(options: ExportOptions): void {
  if (!brainExists()) {
    console.log(red('✗ Brain is not initialized'));
    console.log(dim("  Run 'endiorbot brain init' first"));
    return;
  }

  try {
    // Initialize brain to ensure all files exist
    initializeBrain();

    const brainExport = exportBrain();

    // Determine output path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultPath = join(homedir(), '.endiorbot', `brain-export-${timestamp}.json`);
    const outputPath = options.output ?? defaultPath;

    // Write export
    const content = JSON.stringify(brainExport, null, 2);
    writeFileSync(outputPath, content, 'utf-8');

    console.log(green('✓ Brain exported successfully'));
    console.log(dim(`  Output: ${outputPath}`));
    console.log(dim(`  Size:   ${(content.length / 1024).toFixed(1)} KB`));
    console.log('');
    console.log(dim('  Export includes:'));
    console.log(dim(`    Events:         ${brainExport.layers.events.length}`));
    console.log(dim(`    Patterns:       ${brainExport.layers.patterns.length}`));
    console.log(dim(`    Structures:     ${brainExport.layers.structures.length}`));
    console.log(dim(`    Mental Models:  ${brainExport.layers.mentalModels.length}`));
  } catch (error) {
    console.error(red(`✗ Export failed: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * List layers or show layer entries.
 */
function layersAction(layerId?: string): void {
  if (!brainExists()) {
    console.log(red('✗ Brain is not initialized'));
    console.log(dim("  Run 'endiorbot brain init' first"));
    return;
  }

  try {
    // Initialize brain to ensure all files exist
    initializeBrain();

    if (!layerId) {
      // List all layers with counts
      const health = getBrainHealth();

      console.log('');
      console.log(bold('Brain Layers:'));
      console.log('');
      console.log(`  ${cyan('events')}         ${health.layers.events} entries`);
      console.log(`  ${cyan('patterns')}       ${health.layers.patterns} patterns`);
      console.log(`  ${cyan('structures')}     ${health.layers.structures} structures`);
      console.log(`  ${cyan('mental-models')}  ${health.layers.mentalModels} rules`);
      console.log('');
      console.log(dim('  Use: endiorbot brain layers <layer> to view entries'));
      console.log('');
      return;
    }

    // Show specific layer entries
    const MAX_ENTRIES = 10;

    switch (layerId) {
      case 'events': {
        const events = getAllEvents();
        const displayEvents = events.slice(-MAX_ENTRIES).reverse();

        console.log('');
        console.log(bold(`Events Layer (${events.length} total, showing last ${displayEvents.length}):`));
        console.log('');

        if (displayEvents.length === 0) {
          console.log(dim('  No events recorded'));
        } else {
          for (const event of displayEvents) {
            const time = formatRelativeTime(event.timestamp);
            console.log(`  ${dim(time.padEnd(12))} ${cyan(event.type)}`);
            if (event.sessionId) {
              console.log(`              ${dim(`session: ${truncate(event.sessionId, 20)}`)}`);
            }
          }
        }
        console.log('');
        break;
      }

      case 'patterns': {
        const patterns = getAllPatterns();
        const displayPatterns = patterns.slice(0, MAX_ENTRIES);

        console.log('');
        console.log(bold(`Patterns Layer (${patterns.length} total, showing first ${displayPatterns.length}):`));
        console.log('');

        if (displayPatterns.length === 0) {
          console.log(dim('  No patterns recorded'));
        } else {
          for (const pattern of displayPatterns) {
            const hitStr = `${pattern.count}x`;
            console.log(`  ${cyan(pattern.type.padEnd(10))} ${hitStr.padEnd(6)} ${truncate(pattern.signature, 40)}`);
            if (pattern.fixHint) {
              console.log(`              ${dim(`fix: ${truncate(pattern.fixHint, 50)}`)}`);
            }
          }
        }
        console.log('');
        break;
      }

      case 'structures': {
        const structures = getAllStructures();
        const displayStructures = structures.slice(0, MAX_ENTRIES);

        console.log('');
        console.log(bold(`Structures Layer (${structures.length} total, showing first ${displayStructures.length}):`));
        console.log('');

        if (displayStructures.length === 0) {
          console.log(dim('  No structures recorded'));
        } else {
          for (const structure of displayStructures) {
            const updated = formatRelativeTime(structure.updatedAt);
            console.log(`  ${cyan(structure.type.padEnd(15))} ${structure.projectId.padEnd(20)} ${dim(updated)}`);
          }
        }
        console.log('');
        break;
      }

      case 'mental-models': {
        const models = getAllModels();
        const displayModels = models.slice(0, MAX_ENTRIES);

        console.log('');
        console.log(bold(`Mental Models Layer (${models.length} total, showing first ${displayModels.length}):`));
        console.log('');

        if (displayModels.length === 0) {
          console.log(dim('  No mental models recorded'));
        } else {
          for (const model of displayModels) {
            const confidence = `${(model.confidence * 100).toFixed(0)}%`;
            console.log(`  ${cyan(model.domain.padEnd(12))} ${confidence.padEnd(5)} ${truncate(model.rule, 45)}`);
          }
        }
        console.log('');
        break;
      }

      default:
        console.log(red(`✗ Unknown layer: ${layerId}`));
        console.log(dim('  Available layers: events, patterns, structures, mental-models'));
    }
  } catch (error) {
    console.error(red(`✗ Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Initialize brain storage.
 */
function initAction(): void {
  if (brainExists()) {
    console.log(yellow('⚠ Brain is already initialized'));
    const version = getVersionString();
    console.log(dim(`  Version: ${version}`));
    return;
  }

  try {
    initializeBrain();
    const version = getVersionString();

    console.log(green('✓ Brain initialized successfully'));
    console.log(dim(`  Version: ${version}`));
    console.log(dim(`  Location: ~/.endiorbot/brain/`));
  } catch (error) {
    console.error(red(`✗ Failed to initialize brain: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register brain command.
 */
export function registerBrainCommand(program: Command): void {
  const brain = program.command('brain').description('Manage EndiorBot Brain');

  brain
    .command('status')
    .description('Show brain health and status')
    .action(statusAction);

  brain
    .command('export')
    .description('Export brain state to file')
    .option('-o, --output <path>', 'Output file path')
    .action(exportAction);

  brain
    .command('layers')
    .description('List layers or show layer entries')
    .argument('[layerId]', 'Layer to inspect (events, patterns, structures, mental-models)')
    .action(layersAction);

  brain
    .command('init')
    .description('Initialize brain storage')
    .action(initAction);
}
