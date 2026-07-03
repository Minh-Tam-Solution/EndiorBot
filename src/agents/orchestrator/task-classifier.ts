/**
 * Task Classifier
 *
 * Classifies queries to determine task type, complexity, and recommended models.
 * Enhanced with TaskComplexity taxonomy (simple/moderate/complex/critical).
 *
 * @module agents/orchestrator/task-classifier
 * @version 2.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 39 Enhanced
 * @authority ADR-001 Multi-Model Orchestrator
 * @pillar 3 - Agent Personas
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import type {
  ComplexityFactors,
  ModelRecommendation,
  ModelSelection,
  ModelTier,
  QueryClassification,
  TaskComplexity,
  TaskType,
} from "../types.js";

// ============================================================================
// Task Type Patterns
// ============================================================================

const TASK_PATTERNS: Record<TaskType, RegExp[]> = {
  architecture: [
    /design\s+(system|architecture|api|database|schema)/i,
    /architect(ure)?\s+(decision|review|pattern)/i,
    /how\s+should\s+(we|i)\s+(design|architect|structure)/i,
    /adr|technical\s+spec/i,
    /microservice|monolith|serverless/i,
    /@consult/i,
  ],
  security: [
    /security\s+(review|audit|vulnerability|assessment)/i,
    /auth(entication|orization)/i,
    /encrypt|decrypt|hash|salt/i,
    /injection|xss|csrf|sql\s+injection/i,
    /credential|secret|api\s*key/i,
    /owasp|penetration\s+test/i,
  ],
  code_gen: [
    /implement|create|build|write\s+(code|function|class|component)/i,
    /add\s+(feature|functionality|method)/i,
    /generate\s+(code|implementation)/i,
    /@quick/i,
  ],
  bug_fix: [
    /fix\s+(bug|error|issue|problem)/i,
    /debug|troubleshoot/i,
    /not\s+working|broken|failing/i,
    /error:\s+/i,
    /exception|crash|undefined/i,
  ],
  research: [
    /research|investigate|explore/i,
    /compare\s+(options|alternatives|approaches)/i,
    /what\s+are\s+the\s+(best|options|ways)/i,
    /recommend(ation)?s?\s+for/i,
    /state\s+of\s+the\s+art/i,
    /latest\s+(trends|practices|tools)/i,
  ],
  general: [],
};

// ============================================================================
// Complexity Indicators
// ============================================================================

/**
 * Critical complexity patterns (always critical).
 */
const CRITICAL_PATTERNS: RegExp[] = [
  /production\s+(deploy|release|rollback)/i,
  /security\s+(vulnerability|breach|incident)/i,
  /data\s+(migration|loss|corruption)/i,
  /breaking\s+change/i,
  /g3|g4\s+gate/i,
  /@critical/i,
];

/**
 * Complex patterns (multi-step reasoning needed).
 */
const COMPLEX_PATTERNS = [
  /integrat(e|ion)\s+with\s+multiple/i,
  /migrate|refactor|redesign/i,
  /scale|performance\s+optim/i,
  /distributed|concurrent|parallel/i,
  /complex|challenging|difficult/i,
  /cross-domain|cross-team/i,
  /adr|architecture\s+decision/i,
];

/**
 * Moderate patterns (standard reasoning).
 */
const MODERATE_PATTERNS = [
  /implement\s+(feature|functionality)/i,
  /add\s+(endpoint|api|component)/i,
  /update|modify|change/i,
  /test|spec|coverage/i,
];

/**
 * Simple patterns (trivial tasks).
 */
const SIMPLE_PATTERNS = [
  /simple|basic|straightforward/i,
  /quick|fast|easy/i,
  /typo|rename|update\s+(text|string)/i,
  /add\s+comment|documentation/i,
  /format|lint|style/i,
  /@quick/i,
];

// ============================================================================
// Urgency Indicators
// ============================================================================

const HIGH_URGENCY_PATTERNS = [
  /urgent|asap|immediately/i,
  /critical|blocker|blocking/i,
  /production\s+(issue|down|error)/i,
  /hotfix|emergency/i,
];

// ============================================================================
// Domain Patterns
// ============================================================================

const DOMAIN_PATTERNS: Record<string, RegExp[]> = {
  frontend: [/react|vue|angular|css|html|ui|ux|component/i],
  backend: [/api|server|database|endpoint|rest|graphql/i],
  devops: [/docker|kubernetes|ci|cd|deploy|infrastructure/i],
  testing: [/test|spec|coverage|mock|stub|fixture/i],
  security: [/auth|security|encrypt|permission/i],
  data: [/data|analytics|ml|ai|model|training/i],
};

// ============================================================================
// Complexity Scoring Weights
// ============================================================================

const COMPLEXITY_WEIGHTS = {
  conceptCount: 5,          // Per concept detected
  domainCrossing: 15,       // Cross-domain reference
  multiStepReasoning: 20,   // Needs multi-step
  securityImplications: 25, // Security involved
  productionScope: 30,      // Production impact
  needsValidation: 10,      // Needs external validation
  tokenEstimate: 0.01,      // Per estimated token
};

const COMPLEXITY_THRESHOLDS = {
  simple: 15,     // 0-15: simple
  moderate: 40,   // 16-40: moderate
  complex: 70,    // 41-70: complex
  critical: 100,  // 71+: critical
};

// ============================================================================
// Task Classifier
// ============================================================================

/**
 * TaskClassifier - Enhanced with TaskComplexity taxonomy.
 *
 * Features:
 * 1. Detects task type from query patterns
 * 2. Scores complexity using multiple factors
 * 3. Maps to TaskComplexity (simple/moderate/complex/critical)
 * 4. Recommends model tier based on complexity
 */
export class TaskClassifier {
  /**
   * Classify a query to determine task type and recommendations.
   */
  classify(query: string): QueryClassification {
    const taskType = this.detectTaskType(query);
    const factors = this.analyzeComplexityFactors(query, taskType);
    const complexityScore = this.calculateComplexityScore(factors, query);
    const complexity = this.scoreToComplexity(complexityScore);
    const legacyComplexity = this.complexityToLegacy(complexity);
    const urgency = this.detectUrgency(query);
    const domain = this.detectDomain(query);
    const minModelTier = this.complexityToTier(complexity);
    const recommendedModel = this.recommendModel(taskType, complexity);

    return {
      taskType,
      complexity,
      legacyComplexity,
      domain,
      urgency,
      recommendedModel,
      minModelTier,
      factors,
      complexityScore,
    };
  }

  /**
   * Detect the task type from query content.
   */
  detectTaskType(query: string): TaskType {
    // Check explicit markers first
    if (query.includes("@consult")) return "architecture";
    if (query.includes("@quick")) return "code_gen";

    // Check patterns for each task type
    for (const [taskType, patterns] of Object.entries(TASK_PATTERNS)) {
      if (taskType === "general") continue;

      for (const pattern of patterns) {
        if (pattern.test(query)) {
          return taskType as TaskType;
        }
      }
    }

    return "general";
  }

  /**
   * Get recommended models for a task type.
   */
  /**
   * Recommended models for consultation tasks.
   * Claude development is via Claude Code Bridge (OAuth) — not included here.
   * OpenAI = primary expert, Gemini = critic (per ADR-001 amendment).
   */
  getRecommendedModels(taskType: TaskType): ModelSelection[] {
    // ADR-052 (Sprint 140): Consult panel uses OpenAI + Gemini + Kimi
    switch (taskType) {
      case "architecture":
        return [
          { provider: "openai", model: "gpt-5.4", role: "primary" },
          { provider: "google", model: "gemini-2.5-pro", role: "expert" },
          { provider: "kimi", model: "kimi-k2-6", role: "expert" },
        ];
      case "security":
        return [
          { provider: "openai", model: "gpt-5.4", role: "primary" },
          { provider: "google", model: "gemini-2.5-pro", role: "expert" },
          { provider: "kimi", model: "kimi-k2-6", role: "expert" },
        ];
      case "code_gen":
      case "bug_fix":
        return [
          { provider: "kimi", model: "kimi-k2-6", role: "primary" },
          { provider: "openai", model: "gpt-5.4", role: "expert" },
        ];
      case "research":
        return [
          { provider: "openai", model: "gpt-5.4", role: "primary" },
          { provider: "google", model: "gemini-2.5-pro", role: "expert" },
          { provider: "kimi", model: "kimi-k2-6", role: "expert" },
        ];
      default:
        return [
          { provider: "openai", model: "gpt-5.4", role: "primary" },
          { provider: "kimi", model: "kimi-k2-6", role: "expert" },
        ];
    }
  }

  /**
   * Analyze complexity factors from query.
   */
  analyzeComplexityFactors(query: string, taskType: TaskType): ComplexityFactors {
    const detectedDomains = this.detectAllDomains(query);

    return {
      conceptCount: this.countConcepts(query),
      domainCrossing: detectedDomains.length > 1,
      estimatedTokens: this.estimateTokens(query),
      multiStepReasoning: this.needsMultiStepReasoning(query),
      securityImplications: taskType === "security" || this.hasSecurityImplications(query),
      productionScope: this.hasProductionScope(query),
      needsValidation: this.needsValidation(query, taskType),
    };
  }

  /**
   * Calculate complexity score from factors and query patterns.
   */
  calculateComplexityScore(factors: ComplexityFactors, query?: string): number {
    let score = 0;

    // Factor-based scoring
    score += Math.min(factors.conceptCount * COMPLEXITY_WEIGHTS.conceptCount, 25);
    if (factors.domainCrossing) score += COMPLEXITY_WEIGHTS.domainCrossing;
    if (factors.multiStepReasoning) score += COMPLEXITY_WEIGHTS.multiStepReasoning;
    if (factors.securityImplications) score += COMPLEXITY_WEIGHTS.securityImplications;
    if (factors.productionScope) score += COMPLEXITY_WEIGHTS.productionScope;
    if (factors.needsValidation) score += COMPLEXITY_WEIGHTS.needsValidation;
    score += Math.min(factors.estimatedTokens * COMPLEXITY_WEIGHTS.tokenEstimate, 10);

    // Pattern-based adjustments (if query provided)
    if (query) {
      // Check for explicit critical patterns
      if (CRITICAL_PATTERNS.some((p) => p.test(query))) {
        score = Math.max(score, COMPLEXITY_THRESHOLDS.complex + 1);
      }
      // Boost for moderate patterns
      else if (MODERATE_PATTERNS.some((p) => p.test(query))) {
        score = Math.max(score, COMPLEXITY_THRESHOLDS.simple + 1);
      }
      // Reduce for simple patterns
      else if (SIMPLE_PATTERNS.some((p) => p.test(query))) {
        score = Math.min(score, COMPLEXITY_THRESHOLDS.simple);
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Convert score to TaskComplexity.
   */
  scoreToComplexity(score: number): TaskComplexity {
    if (score <= COMPLEXITY_THRESHOLDS.simple) return "simple";
    if (score <= COMPLEXITY_THRESHOLDS.moderate) return "moderate";
    if (score <= COMPLEXITY_THRESHOLDS.complex) return "complex";
    return "critical";
  }

  /**
   * Convert TaskComplexity to legacy format.
   */
  complexityToLegacy(complexity: TaskComplexity): "low" | "medium" | "high" {
    switch (complexity) {
      case "simple":
        return "low";
      case "moderate":
        return "medium";
      case "complex":
      case "critical":
        return "high";
    }
  }

  /**
   * Convert TaskComplexity to ModelTier.
   */
  complexityToTier(complexity: TaskComplexity): ModelTier {
    switch (complexity) {
      case "simple":
        return "fast";
      case "moderate":
        return "balanced";
      case "complex":
        return "powerful";
      case "critical":
        return "expert";
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Count distinct concepts in query.
   */
  private countConcepts(query: string): number {
    const conceptPatterns = [
      /\b(api|endpoint|route|controller)\b/gi,
      /\b(database|table|schema|model)\b/gi,
      /\b(component|view|page|layout)\b/gi,
      /\b(service|provider|module|plugin)\b/gi,
      /\b(auth|security|permission|role)\b/gi,
      /\b(test|spec|fixture|mock)\b/gi,
      /\b(deploy|release|pipeline|ci)\b/gi,
    ];

    let count = 0;
    for (const pattern of conceptPatterns) {
      const matches = query.match(pattern);
      if (matches) count += new Set(matches.map((m) => m.toLowerCase())).size;
    }

    return count;
  }

  /**
   * Estimate tokens for the query.
   */
  private estimateTokens(query: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(query.length / 4);
  }

  /**
   * Check if multi-step reasoning is needed.
   */
  private needsMultiStepReasoning(query: string): boolean {
    for (const pattern of COMPLEX_PATTERNS) {
      if (pattern.test(query)) return true;
    }
    return false;
  }

  /**
   * Check for security implications.
   */
  private hasSecurityImplications(query: string): boolean {
    const securityPatterns = [
      /auth|credential|secret|password|token/i,
      /encrypt|decrypt|hash|salt/i,
      /permission|access|role/i,
      /injection|xss|csrf/i,
    ];

    return securityPatterns.some((p) => p.test(query));
  }

  /**
   * Check for production scope.
   */
  private hasProductionScope(query: string): boolean {
    const productionPatterns = [
      /production|prod\b|live/i,
      /deploy|release|rollback/i,
      /customer|user\s+facing/i,
      /critical|breaking/i,
    ];

    return productionPatterns.some((p) => p.test(query));
  }

  /**
   * Check if validation is needed.
   */
  private needsValidation(query: string, taskType: TaskType): boolean {
    // Architecture and security always need validation
    if (taskType === "architecture" || taskType === "security") return true;

    const validationPatterns = [
      /verify|validate|confirm|check/i,
      /review|approve|sign-off/i,
      /gate|milestone/i,
    ];

    return validationPatterns.some((p) => p.test(query));
  }

  /**
   * Detect all domains mentioned in query.
   */
  private detectAllDomains(query: string): string[] {
    const detected: string[] = [];

    for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          detected.push(domain);
          break;
        }
      }
    }

    return detected;
  }

  /**
   * Detect urgency level.
   */
  private detectUrgency(query: string): "low" | "normal" | "high" {
    for (const pattern of HIGH_URGENCY_PATTERNS) {
      if (pattern.test(query)) {
        return "high";
      }
    }

    return "normal";
  }

  /**
   * Detect the domain/area of the query.
   */
  private detectDomain(query: string): string {
    for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          return domain;
        }
      }
    }

    return "general";
  }

  /**
   * Recommend a model based on task type and complexity.
   */
  private recommendModel(
    taskType: TaskType,
    complexity: TaskComplexity
  ): ModelRecommendation {
    // ADR-052 (Sprint 140): Provider-aware model recommendations.
    // Critical complexity → Claude Opus (Tier 1)
    if (complexity === "critical") {
      return {
        model: "claude-opus-4",
        provider: "claude-code",
        reason: "Critical task requires expert-level reasoning (Tier 1)",
      };
    }

    // Security and architecture need powerful+ → Claude Opus (Tier 1)
    if (taskType === "security" || taskType === "architecture") {
      return {
        model: "claude-opus-4",
        provider: "claude-code",
        reason: `${taskType} task requires thorough analysis (Tier 1)`,
      };
    }

    // Complex coding tasks → Kimi k2.6 (Tier 2)
    if (complexity === "complex" && (taskType === "code_gen" || taskType === "bug_fix")) {
      return {
        model: "kimi-k2-6",
        provider: "kimi",
        reason: "Complex coding task — Kimi k2.6 provides strong reasoning at lower cost (Tier 2)",
      };
    }

    // Complex non-coding → Kimi k2.6 (Tier 2)
    if (complexity === "complex") {
      return {
        model: "kimi-k2-6",
        provider: "kimi",
        reason: "Complex task — Kimi k2.6 balanced power and cost (Tier 2)",
      };
    }

    // Moderate tasks → Kimi k2.6 (Tier 2)
    if (complexity === "moderate") {
      return {
        model: "kimi-k2-6",
        provider: "kimi",
        reason: "Balanced speed and quality via Kimi k2.6 (Tier 2)",
      };
    }

    // Simple non-coding → Ollama (Tier 3, free)
    if (complexity === "simple" && taskType !== "code_gen" && taskType !== "bug_fix") {
      return {
        model: "qwen3.5:9b",
        provider: "ollama",
        reason: "Simple non-coding task — Ollama free tier sufficient (Tier 3)",
      };
    }

    // Simple coding → Kimi k2.6 (still Tier 2 for coding quality)
    return {
      model: "kimi-k2-6",
      provider: "kimi",
      reason: "Simple task — Kimi k2.6 fast and cost-effective (Tier 2)",
    };
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let globalClassifier: TaskClassifier | undefined;

/**
 * Get the global TaskClassifier instance.
 */
export function getTaskClassifier(): TaskClassifier {
  if (!globalClassifier) {
    globalClassifier = new TaskClassifier();
  }
  return globalClassifier;
}

/**
 * Reset the global TaskClassifier (for testing).
 */
export function resetTaskClassifier(): void {
  globalClassifier = undefined;
}

/**
 * Create a new TaskClassifier instance.
 */
export function createTaskClassifier(): TaskClassifier {
  return new TaskClassifier();
}
