/**
 * Vibecoding Module
 *
 * Code quality metrics and Vibecoding Index calculation.
 *
 * @module sdlc/vibecoding
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.4 Implementation
 * @authority ADR-004 SDLC Gate Engine
 * @pillar 7 - Quality Assurance System
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

export {
  VibecodingCalculator,
  getVibecodingCalculator,
  resetVibecodingCalculator,
  ZONE_THRESHOLDS,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  type VibecodingZone,
  type VibecodingSignal,
  type VibecodingResult,
  type VibecodingMetrics,
  type VibecodingConfig,
} from "./vibecoding-index.js";

export {
  BaselineManager,
  getBaselineManager,
  resetBaselineManager,
  type BaselineEntry,
  type BaselineData,
} from "./baseline.js";
