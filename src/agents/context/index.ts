/**
 * Context Module - Barrel Export
 *
 * Context injection for Claude Code prompts.
 *
 * @module agents/context
 * @version 1.0.0
 * @date 2026-02-28
 * @status ACTIVE - Sprint 55
 */

// Context Manifest
export {
  type ContextManifest,
  type ContextItem,
  type ContextTier,
  type ContextSource,
  type ManifestBuilderOptions,
  buildManifest,
  createContextItem,
  estimateTokens,
  formatManifestLog,
  getOptionsForComplexity,
  DEFAULT_MANIFEST_OPTIONS,
} from "./context-manifest.js";

// Context Injector
export {
  ContextInjector,
  getContextInjector,
  resetContextInjector,
  createContextInjector,
  type InjectionConfig,
  type InjectionRequest,
  type InjectionResult,
  DEFAULT_INJECTION_CONFIG,
} from "./context-injector.js";

// Workspace Awareness (SDLC 6.4.0 Layer 1.25)
export {
  WORKSPACE_AWARENESS_SECTION,
  WORKSPACE_AWARENESS_SOURCE_ID,
} from "./workspace-awareness.js";

// Project Verifier
export {
  ProjectVerifier,
  getProjectVerifier,
  resetProjectVerifier,
  createProjectVerifier,
  verifyProject,
  type ProjectTier,
  type SDLCConfig,
  type GitStatus,
  type VerificationResult,
  type VerifierConfig,
  DEFAULT_VERIFIER_CONFIG,
} from "./project-verifier.js";

// Cross-Project (Sprint 59)
export {
  CrossProjectManager,
  getCrossProjectManager,
  resetCrossProjectManager,
  type ProjectContext,
  type CrossProjectContext,
  type CrossProjectOptions,
} from "./cross-project.js";
