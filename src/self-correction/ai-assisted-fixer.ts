/**
 * AI-Assisted Fixer for Self-Correction Engine
 *
 * Handles TEST category fixes using AI consultation.
 * Per Sprint 37 Day 3-4: EXPERIMENTAL mode with 30% target.
 *
 * CTO Day 3-4 Constraints:
 * 1. EXPERIMENTAL flag must be visible in output (FixConfidence: "experimental")
 * 2. Routes through BudgetTracker with canAfford() check before AI calls
 * 3. verifyFix() counts double for EXPERIMENTAL (full test suite, not quick)
 *
 * @module src/self-correction/ai-assisted-fixer
 * @version 1.0.0
 * @date 2026-02-22
 * @status ACTIVE - Sprint 37 Day 3-4
 * @authority ADR-007 Budget Control, Phase 3
 */

import { readFileSync } from "fs";
import type {
  TestError,
  ProposedFix,
  FixResult,
  FixConfidence,
} from "./types.js";
import type { BudgetTracker } from "../budget/budget-tracker.js";
import { SONNET } from "../config/models.js";

// ============================================================================
// Types
// ============================================================================

/**
 * AI-Assisted Fixer configuration.
 */
export interface AIAssistedFixerConfig {
  /** Estimated cost per AI consultation (USD) */
  estimatedCostPerConsultation: number;
  /** Maximum tokens for AI response */
  maxTokens: number;
  /** Model to use for consultation */
  model: string;
  /** Provider for AI consultation */
  provider: string;
  /** Enable dry-run (no actual AI calls) */
  dryRun: boolean;
  /** Timeout for AI call (ms) */
  timeout: number;
  /** Working directory */
  workingDirectory: string;
}

/**
 * Default AI-Assisted Fixer config.
 */
export const DEFAULT_AI_FIXER_CONFIG: AIAssistedFixerConfig = {
  estimatedCostPerConsultation: 0.05, // $0.05 per consultation
  maxTokens: 1000,
  model: SONNET,
  provider: "anthropic",
  dryRun: false,
  timeout: 30000, // 30s
  workingDirectory: process.cwd(),
};

/**
 * AI consultation request.
 */
export interface AIConsultationRequest {
  /** Test error to fix */
  error: TestError;
  /** Test file content */
  testFileContent: string;
  /** Source file content (if identifiable) */
  sourceFileContent?: string;
  /** Test output/stack trace */
  testOutput: string;
}

/**
 * AI consultation response.
 */
export interface AIConsultationResponse {
  /** Whether AI provided a fix suggestion */
  hasSuggestion: boolean;
  /** Suggested fix description */
  description: string;
  /** Fixed code (if applicable) */
  fixedCode?: string;
  /** Explanation of the fix */
  explanation: string;
  /** Confidence level from AI */
  aiConfidence: "high" | "medium" | "low";
  /** Tokens used */
  tokensUsed: number;
  /** Actual cost (USD) */
  cost: number;
}

/**
 * Budget check result.
 */
export interface BudgetCheckResult {
  /** Can afford the consultation? */
  canAfford: boolean;
  /** Current budget percentage used */
  percentUsed: number;
  /** Remaining budget (USD) */
  remaining: number;
  /** Reason if cannot afford */
  reason?: string;
}

// ============================================================================
// AIAssistedFixer
// ============================================================================

/**
 * AIAssistedFixer - Uses AI to suggest fixes for TEST errors.
 *
 * Per CTO guidance:
 * - All fixes marked as EXPERIMENTAL (confidence: "experimental")
 * - Budget checked before each AI call
 * - Full test verification required (not quick)
 */
export class AIAssistedFixer {
  private config: AIAssistedFixerConfig;
  private budgetTracker: BudgetTracker | null = null;
  private consultationHistory: AIConsultationResponse[] = [];
  private totalCost: number = 0;

  constructor(config: Partial<AIAssistedFixerConfig> = {}) {
    this.config = { ...DEFAULT_AI_FIXER_CONFIG, ...config };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Set budget tracker for cost management.
   * Required for production use.
   */
  setBudgetTracker(tracker: BudgetTracker): void {
    this.budgetTracker = tracker;
  }

  /**
   * Check if budget allows for AI consultation.
   * Per CTO: Must check canAfford() before AI calls.
   */
  async checkBudget(): Promise<BudgetCheckResult> {
    if (!this.budgetTracker) {
      return {
        canAfford: true,
        percentUsed: 0,
        remaining: Infinity,
        reason: "No budget tracker configured",
      };
    }

    try {
      const status = await this.budgetTracker.getStatus();
      const estimatedCost = this.config.estimatedCostPerConsultation;

      // Access nested session scope from BudgetStatus
      const sessionPercentUsed = status.session.percentage;
      const sessionRemaining = status.session.remaining;

      // Check if at 90% or more budget
      if (sessionPercentUsed >= 90) {
        return {
          canAfford: false,
          percentUsed: sessionPercentUsed,
          remaining: sessionRemaining,
          reason: `Budget at ${sessionPercentUsed.toFixed(0)}% - escalate instead`,
        };
      }

      // Check if remaining budget covers estimated cost
      if (sessionRemaining < estimatedCost) {
        return {
          canAfford: false,
          percentUsed: sessionPercentUsed,
          remaining: sessionRemaining,
          reason: `Remaining budget ($${sessionRemaining.toFixed(2)}) insufficient for AI consultation ($${estimatedCost.toFixed(2)})`,
        };
      }

      return {
        canAfford: true,
        percentUsed: sessionPercentUsed,
        remaining: sessionRemaining,
      };
    } catch {
      // If budget check fails, be conservative
      return {
        canAfford: false,
        percentUsed: 100,
        remaining: 0,
        reason: "Budget check failed - be conservative",
      };
    }
  }

  /**
   * Propose an AI-assisted fix for a test error.
   *
   * Per CTO constraints:
   * 1. Returns fix with confidence: "experimental"
   * 2. Checks budget before AI call
   * 3. Tracks cost in BudgetTracker
   */
  async proposeFix(error: TestError, testOutput: string): Promise<ProposedFix | null> {
    // Step 1: Check budget
    const budgetCheck = await this.checkBudget();
    if (!budgetCheck.canAfford) {
      return null; // Escalate instead
    }

    // Step 2: Read test file content
    const testFileContent = this.readFile(error.testFile);
    if (!testFileContent) {
      return null;
    }

    // Step 3: Build consultation request
    const request: AIConsultationRequest = {
      error,
      testFileContent,
      testOutput,
    };

    // Step 4: Get AI consultation
    const consultation = await this.consultAI(request);
    if (!consultation.hasSuggestion || !consultation.fixedCode) {
      return null;
    }

    // Step 5: Track cost in budget
    await this.trackCost(consultation.cost);

    // Step 6: Build proposed fix with EXPERIMENTAL confidence
    // Per CTO: "EXPERIMENTAL flag must be visible in output"
    return {
      id: `ai-fix-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      error,
      type: "experimental",
      confidence: "experimental" as FixConfidence, // Per CTO constraint #1
      description: `[AI-ASSISTED] ${consultation.description}`,
      filePath: error.testFile,
      line: error.line,
      originalCode: this.extractOriginalCode(testFileContent, error.line),
      fixedCode: consultation.fixedCode,
      isMultiLine: consultation.fixedCode.includes("\n"),
    };
  }

  /**
   * Apply an AI-assisted fix.
   * Marks result as experimental for logging visibility.
   */
  applyFix(fix: ProposedFix, fileContent: string): FixResult {
    const startTime = Date.now();

    // Validate fix is experimental
    if (fix.confidence !== "experimental") {
      return {
        fix,
        status: "failed",
        duration: Date.now() - startTime,
        verified: false,
        errorMessage: "AIAssistedFixer only handles experimental fixes",
        strikes: 0,
      };
    }

    try {
      // Check if original code exists in file
      if (!fileContent.includes(fix.originalCode)) {
        return {
          fix,
          status: "failed",
          duration: Date.now() - startTime,
          verified: false,
          errorMessage: "Original code not found in file",
          strikes: 1,
        };
      }

      // Apply the fix (in memory, actual write handled by engine)
      const newContent = fileContent.replace(fix.originalCode, fix.fixedCode);

      if (newContent === fileContent) {
        return {
          fix,
          status: "skipped",
          duration: Date.now() - startTime,
          verified: false,
          errorMessage: "No changes made",
          strikes: 0,
        };
      }

      return {
        fix,
        status: "success",
        duration: Date.now() - startTime,
        verified: false, // Per CTO: Requires FULL verification, not quick
        strikes: 0,
      };
    } catch (err) {
      return {
        fix,
        status: "failed",
        duration: Date.now() - startTime,
        verified: false,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        strikes: 1,
      };
    }
  }

  /**
   * Get consultation history.
   */
  getConsultationHistory(): AIConsultationResponse[] {
    return [...this.consultationHistory];
  }

  /**
   * Get total cost of AI consultations.
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  /**
   * Get configuration.
   */
  getConfig(): AIAssistedFixerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(updates: Partial<AIAssistedFixerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Check if this fixer should handle the error.
   * Per Sprint 37: TEST category only.
   */
  canHandle(error: { category: string }): boolean {
    return error.category === "TEST";
  }

  /**
   * Get estimated cost for a consultation.
   */
  getEstimatedCost(): number {
    return this.config.estimatedCostPerConsultation;
  }

  /**
   * Reset consultation history and cost tracking.
   */
  reset(): void {
    this.consultationHistory = [];
    this.totalCost = 0;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Consult AI for a fix suggestion.
   * In production, this would call the actual AI provider.
   */
  private async consultAI(request: AIConsultationRequest): Promise<AIConsultationResponse> {
    if (this.config.dryRun) {
      return this.createDryRunResponse(request);
    }

    try {
      // CSO Sprint 144: AI provider integration not yet wired.
      // Return explicit "not available" instead of simulated mock data.
      // When a real provider is wired (future sprint), replace this block.
      const response: AIConsultationResponse = {
        hasSuggestion: false,
        description: "AI-assisted fix not available — provider not yet integrated",
        explanation: "The AI consultation feature requires a wired provider (Claude/GPT). " +
          "Currently returning no suggestion. Use manual test fixing or enable when provider is configured.",
        aiConfidence: "low",
        tokensUsed: 0,
        cost: 0,
      };
      this.consultationHistory.push(response);
      return response;
    } catch (err) {
      return {
        hasSuggestion: false,
        description: "AI consultation failed",
        explanation: err instanceof Error ? err.message : "Unknown error",
        aiConfidence: "low",
        tokensUsed: 0,
        cost: 0,
      };
    }
  }

  /**
   * Create dry-run response.
   */
  private createDryRunResponse(request: AIConsultationRequest): AIConsultationResponse {
    return {
      hasSuggestion: false,
      description: "[DRY-RUN] AI consultation simulated",
      explanation: `Would consult AI for test: ${request.error.testName}`,
      aiConfidence: "low",
      tokensUsed: 0,
      cost: 0,
    };
  }

  /**
   * Track cost in budget tracker.
   */
  private async trackCost(cost: number): Promise<void> {
    this.totalCost += cost;

    if (this.budgetTracker) {
      try {
        await this.budgetTracker.recordUsage({
          timestamp: new Date(),
          model: this.config.model,
          provider: this.config.provider,
          inputTokens: 500, // Approximate
          outputTokens: 200, // Approximate
          cost,
        });
      } catch {
        // Ignore tracking errors
      }
    }
  }

  /**
   * Read file content.
   */
  private readFile(filePath: string): string | null {
    try {
      const fullPath = filePath.startsWith("/")
        ? filePath
        : `${this.config.workingDirectory}/${filePath}`;
      return readFileSync(fullPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Extract original code around the error line.
   */
  private extractOriginalCode(content: string, line: number): string {
    const lines = content.split("\n");
    const start = Math.max(0, line - 2);
    const end = Math.min(lines.length, line + 2);
    return lines.slice(start, end).join("\n");
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an AI-assisted fixer instance.
 */
export function createAIAssistedFixer(
  config?: Partial<AIAssistedFixerConfig>
): AIAssistedFixer {
  return new AIAssistedFixer(config);
}

/**
 * Check if error requires AI assistance.
 */
export function requiresAIAssistance(error: { category: string }): boolean {
  return error.category === "TEST";
}

/**
 * Get the experimental confidence level.
 * Per CTO: All AI fixes must be marked as experimental.
 */
export function getExperimentalConfidence(): FixConfidence {
  return "experimental";
}
