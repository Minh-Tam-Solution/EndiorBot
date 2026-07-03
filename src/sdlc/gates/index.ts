/**
 * Gates Module
 *
 * SDLC gate evaluation and checklist management.
 *
 * @module sdlc/gates
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Phase 4.4 Implementation
 * @authority ADR-004 SDLC Gate Engine
 * @pillar 2 - Sprint Governance
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

// Gate Checklist
export {
  G0_CHECKLIST,
  G01_CHECKLIST,
  G1_CHECKLIST,
  G2_CHECKLIST,
  G3_CHECKLIST,
  G4_CHECKLIST,
  GSPRINT_CHECKLIST,
  GATE_CHECKLISTS,
  getChecklist,
  getGatesInOrder,
  getPreviousGate,
  meetsMinTier,
  type GateId,
  type ProjectTier,
  type ChecklistStatus,
  type ChecklistItem,
  type GateChecklist,
} from "./gate-checklist.js";

// Gate Engine
export {
  GateEngine,
  getGateEngine,
  resetGateEngine,
  type Evidence,
  type VibecodingResult,
  type GateEvaluation,
  type GateEngineConfig,
} from "./gate-engine.js";

// Gate Confirmation Store
export {
  loadGateConfirmations,
  saveGateConfirmation,
  isGateConfirmed,
  getGateConfirmation,
  type GateConfirmation,
} from "./gate-store.js";

// Gate Mark Store (Sprint 143 A3 — team-level manual item marks)
export {
  loadGateMarks,
  saveGateItemMark,
  isItemMarked,
  getItemMark,
  removeGateItemMark,
  type GateItemMark,
} from "./gate-mark-store.js";
