# ADR-007: Autonomous Execution Budget

| Metadata | Value |
|----------|-------|
| **Status** | Approved |
| **Date** | 2026-02-22 |
| **Authors** | PM, Architect |
| **Reviewers** | CTO, CPO |
| **Sprint** | 36 |
| **Related ADRs** | ADR-006 (Checkpoint State Model) |

## Context

### Problem Statement

EndiorBot's autonomous operation without budget controls creates critical risks:

- **Runaway Costs**: A single autonomous session could spend $50+ if unchecked
- **CEO Overwhelm**: Unlimited notifications interrupt workflow
- **No Safety Net**: Self-correction loops (Sprint 37+) could retry indefinitely
- **Poor Predictability**: No cost estimation before task execution

Current state:
- No session or daily budget limits
- No cost tracking or warnings
- No circuit breakers for expensive operations
- No fallback to free models (Ollama)

### Goal

Implement comprehensive budget control and escalation to enable safe autonomous operation with:
- Hard budget limits ($2 session, $10 daily)
- Cost estimation before execution
- Circuit breakers for runaway operations
- Notification rate limiting (4/hour max)
- Automatic fallback to Ollama when budget exhausted

## Decision

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Budget Control System                         │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  Cost Estimator                          │   │
│   │  • Predict task cost before execution                   │   │
│   │  • Token estimation (input + output)                    │   │
│   │  • Historical averaging                                 │   │
│   │  • Confidence scoring                                   │   │
│   └─────────────────┬───────────────────────────────────────┘   │
│                     │                                            │
│                     ▼                                            │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  Budget Tracker                          │   │
│   │                                                          │   │
│   │  Session: $0.00 / $2.00  ████░░░░░░  40%               │   │
│   │  Daily:   $3.50 / $10.00 ████████░░  70%               │   │
│   │                                                          │   │
│   │  • Track costs: session, daily, per-track              │   │
│   │  • Enforce limits: pause at threshold                   │   │
│   │  • Warning at 80%                                       │   │
│   │  • Integration with CheckpointState                    │   │
│   └─────────────────┬───────────────────────────────────────┘   │
│                     │                                            │
│         ┌───────────┴───────────┐                               │
│         ▼                       ▼                               │
│   ┌──────────┐           ┌──────────┐                          │
│   │ Circuit  │           │Notification│                         │
│   │ Breakers │           │Rate Limiter│                         │
│   │          │           │            │                         │
│   │• Max 3   │           │• 4/hour max│                         │
│   │  retries │           │• Batching  │                         │
│   │• $0.50   │           │• Channels  │                         │
│   │  per task│           │            │                         │
│   │• 5 min   │           │            │                         │
│   │  timeout │           │            │                         │
│   └──────┬───┘           └──────┬─────┘                         │
│          │                      │                               │
│          └──────────┬───────────┘                               │
│                     ▼                                            │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Escalation Actions                          │   │
│   │                                                          │   │
│   │  On Limit:    [Pause + Notify] [Switch to Ollama] [Fail]│   │
│   │  On Warning:  [Notify CEO] [Log Event]                  │   │
│   │  On Breach:   [Escalate] [Create Approval Request]      │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Interfaces

```typescript
interface BudgetConfig {
  // Budget Limits
  daily_limit: number;           // USD, default: $10.00
  per_session_limit: number;     // USD, default: $2.00
  per_track_limit?: number;      // USD, default: $0.50 (Sprint 39+)
  warning_threshold: number;     // Percentage, default: 80%

  // Actions on Limit
  on_limit_reached: {
    action: 'pause_and_notify' | 'switch_to_ollama' | 'fail_fast';
    fallback_model?: string;     // For 'switch_to_ollama': "ollama/qwen2.5-coder"
    pause_duration?: number;     // Milliseconds to wait before escalating
  };

  // Notification Settings
  notification: {
    channels: ('console' | 'email' | 'slack')[];
    rate_limit: number;          // Max notifications per hour, default: 4
    batch_window: number;        // Milliseconds, default: 300000 (5 min)
    priority_levels: {
      warning: boolean;          // Send on 80% threshold
      limit: boolean;            // Send on limit reached
      breach: boolean;           // Send on circuit breaker
    };
  };

  // Circuit Breakers
  circuit_breakers: {
    enabled: boolean;
    max_retry_per_task: number;  // Default: 3
    max_cost_per_task: number;   // Default: $0.50
    max_duration_per_task: number; // Milliseconds, default: 300000 (5 min)
    escalate_on_breach: boolean; // Default: true
  };

  // Cost Estimation
  estimation: {
    enabled: boolean;            // Default: true
    require_approval_above: number; // USD, default: $1.00
    confidence_threshold: number;   // 0-1, default: 0.7
  };
}

interface BudgetState {
  session: {
    costSoFar: number;           // Current session cost
    limit: number;               // Session limit
    startTime: Date;             // Session start
  };

  daily: {
    costSoFar: number;           // Today's total cost
    limit: number;               // Daily limit
    date: string;                // YYYY-MM-DD (UTC)
    resetAt: Date;               // Next reset time (midnight UTC)
  };

  tracks?: {
    [trackId: string]: {
      costSoFar: number;
      limit: number;
    };
  };

  // Token tracking
  tokenUsage: TokenUsageRecord[];

  // Historical data
  historical: {
    avgCostPerTask: Record<TaskType, number>;
    avgCostPerModel: Record<string, number>;
    totalSpent: number;
  };
}

interface TokenUsageRecord {
  timestamp: Date;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  taskType?: TaskType;
  taskId?: string;
  trackId?: string;
}

interface CostEstimate {
  estimated_cost: number;        // USD
  estimated_tokens: {
    input: number;
    output: number;
  };
  confidence: 'low' | 'medium' | 'high';
  confidence_score: number;      // 0-1
  historical_avg?: number;       // From past similar tasks
  breakdown?: {
    model_cost: number;
    tool_cost?: number;          // For tool usage costs
    api_overhead?: number;
  };
  recommendation?: string;       // "Use Haiku for lower cost" etc.
}

interface BudgetAction {
  action: 'continue' | 'pause' | 'switch_model' | 'escalate' | 'fail';
  reason?: string;
  model?: string;                // For 'switch_model'
  approvalId?: string;           // For 'escalate'
  remainingBudget?: {
    session: number;
    daily: number;
  };
}

interface CircuitBreakerResult {
  status: 'closed' | 'open' | 'half_open';
  reason?: 'max_retry_exceeded' | 'max_cost_exceeded' | 'max_duration_exceeded';
  escalate: boolean;
  metrics: {
    retryCount: number;
    costSoFar: number;
    durationMs: number;
  };
}
```

### Budget Enforcement Flow

```
Task Execution Request
        │
        ▼
┌───────────────────┐
│ 1. Cost Estimate  │
│    estimateCost() │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 2. Check Budget   │
│    Available?     │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │ NO  │ YES │
    ▼     │     ▼
┌─────┐   │   ┌─────────────────┐
│Pause│   │   │ 3. Execute Task │
│     │   │   │    (track cost) │
└─────┘   │   └────────┬────────┘
          │            │
          │            ▼
          │   ┌─────────────────┐
          │   │ 4. Record Cost  │
          │   │    updateBudget()│
          │   └────────┬────────┘
          │            │
          │            ▼
          │   ┌─────────────────┐
          │   │ 5. Check Limits │
          │   │    threshold?   │
          │   └────────┬────────┘
          │            │
          │      ┌─────┴─────┐
          │      │ >80%│ OK  │
          │      ▼     │     │
          │   ┌────┐  │     │
          │   │Warn│  │     │
          │   └────┘  │     │
          │           │     │
          │      ┌────┴─────┴────┐
          │      │ >100%│  OK    │
          │      ▼      │        │
          │   ┌────┐   │        │
          │   │Pause│  │        │
          │   └────┘   │        │
          │            ▼
          └──────▶  Continue
```

### Budget Tracker Implementation

```typescript
class BudgetTracker {
  private state: BudgetState;
  private config: BudgetConfig;
  private costEstimator: CostEstimator;
  private circuitBreaker: CircuitBreaker;
  private notificationRateLimiter: NotificationRateLimiter;

  async recordCost(
    taskId: string,
    cost: number,
    model: string,
    provider: string,
    tokens: { input: number; output: number },
    taskType?: TaskType,
    trackId?: string
  ): Promise<BudgetAction> {
    // 1. Update session cost
    this.state.session.costSoFar += cost;
    this.state.daily.costSoFar += cost;

    // 2. Update track cost (if applicable)
    if (trackId && this.state.tracks) {
      this.state.tracks[trackId].costSoFar += cost;
    }

    // 3. Record token usage
    this.state.tokenUsage.push({
      timestamp: new Date(),
      model,
      provider,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      cost,
      taskType,
      taskId,
      trackId,
    });

    // 4. Update checkpoint state (Sprint 35 integration)
    await checkpoint.updateCostTracking({
      sessionCostSoFar: this.state.session.costSoFar,
      tokenUsage: this.state.tokenUsage,
    });

    // 5. Check session limit
    if (this.state.session.costSoFar >= this.state.session.limit) {
      return await this.handleLimitReached('session', this.state.session.costSoFar);
    }

    // 6. Check daily limit
    if (this.state.daily.costSoFar >= this.state.daily.limit) {
      return await this.handleLimitReached('daily', this.state.daily.costSoFar);
    }

    // 7. Check track limit (if applicable)
    if (trackId && this.state.tracks) {
      const track = this.state.tracks[trackId];
      if (track.costSoFar >= track.limit) {
        return await this.handleLimitReached('track', track.costSoFar, trackId);
      }
    }

    // 8. Check warning threshold
    const sessionPercent = (this.state.session.costSoFar / this.state.session.limit) * 100;
    if (sessionPercent >= this.config.warning_threshold) {
      await this.sendWarning('session', sessionPercent);
    }

    return {
      action: 'continue',
      remainingBudget: {
        session: this.state.session.limit - this.state.session.costSoFar,
        daily: this.state.daily.limit - this.state.daily.costSoFar,
      },
    };
  }

  private async handleLimitReached(
    type: 'session' | 'daily' | 'track',
    amount: number,
    trackId?: string
  ): Promise<BudgetAction> {
    // Create checkpoint before pausing (Sprint 35)
    await checkpoint.create({
      reason: 'budget_pause',
      description: `${type} budget limit reached: $${amount.toFixed(2)}`,
      metadata: { budgetType: type, amount, trackId },
    });

    // Notify CEO (rate limited)
    await this.notificationRateLimiter.send({
      type: 'budget_limit',
      priority: 'high',
      message: `${type} budget limit reached: $${amount.toFixed(2)}`,
      options: {
        continue_with_approval: 'Increase budget and continue',
        switch_to_ollama: 'Switch to free local model (Ollama)',
        stop: 'Stop execution and review',
      },
    });

    // Execute configured action
    switch (this.config.on_limit_reached.action) {
      case 'pause_and_notify':
        logger.warn(`Budget limit reached, pausing execution`, { type, amount });
        return { action: 'pause', reason: `${type}_limit_reached` };

      case 'switch_to_ollama':
        logger.info(`Budget limit reached, switching to Ollama`, { type, amount });
        return {
          action: 'switch_model',
          model: this.config.on_limit_reached.fallback_model ?? 'ollama/qwen2.5-coder',
          reason: `${type}_limit_reached`,
        };

      case 'fail_fast':
        throw new BudgetLimitError(`${type} budget limit reached: $${amount.toFixed(2)}`);
    }
  }

  private async sendWarning(type: 'session' | 'daily', percent: number): Promise<void> {
    const amount = type === 'session' ? this.state.session.costSoFar : this.state.daily.costSoFar;
    const limit = type === 'session' ? this.state.session.limit : this.state.daily.limit;
    const remaining = limit - amount;

    await this.notificationRateLimiter.send({
      type: 'budget_warning',
      priority: 'medium',
      message: `Budget warning: ${percent.toFixed(0)}% of ${type} limit reached`,
      details: {
        current: `$${amount.toFixed(2)}`,
        limit: `$${limit.toFixed(2)}`,
        remaining: `$${remaining.toFixed(2)}`,
        percent: `${percent.toFixed(0)}%`,
      },
    });

    logger.info('Budget warning sent', { type, percent, amount, limit });
  }

  async estimateCost(taskType: TaskType, model: string, context: TaskContext): Promise<CostEstimate> {
    return await this.costEstimator.estimate(taskType, model, context);
  }

  async checkCircuitBreaker(taskId: string, metrics: TaskMetrics): Promise<CircuitBreakerResult> {
    return await this.circuitBreaker.check(taskId, metrics);
  }

  async resetDaily(): Promise<void> {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];

    if (this.state.daily.date !== currentDate) {
      logger.info('Resetting daily budget', {
        previousDate: this.state.daily.date,
        previousCost: this.state.daily.costSoFar,
      });

      this.state.daily.costSoFar = 0;
      this.state.daily.date = currentDate;
      this.state.daily.resetAt = new Date(now.setUTCHours(24, 0, 0, 0));

      await this.persistState();
    }
  }
}
```

### Cost Estimator Implementation

```typescript
class CostEstimator {
  private pricing: ModelPricingRegistry;
  private historical: HistoricalData;

  async estimate(
    taskType: TaskType,
    model: string,
    context: TaskContext
  ): Promise<CostEstimate> {
    // 1. Estimate input tokens (prompt + context + conversation history)
    const inputTokens = this.estimateInputTokens(context);

    // 2. Estimate output tokens (based on task type and historical data)
    const outputTokens = await this.estimateOutputTokens(taskType, model);

    // 3. Get model pricing
    const pricing = await this.pricing.getPricing(model);
    if (!pricing) {
      throw new Error(`Pricing not found for model: ${model}`);
    }

    // 4. Calculate cost
    const cost =
      (inputTokens / 1000) * pricing.input_per_1k +
      (outputTokens / 1000) * pricing.output_per_1k;

    // 5. Get historical average for confidence
    const historicalAvg = await this.historical.getAverage(taskType, model);
    const confidence = this.calculateConfidence(cost, historicalAvg);

    // 6. Generate recommendation
    const recommendation = await this.generateRecommendation(taskType, cost, model);

    return {
      estimated_cost: cost,
      estimated_tokens: { input: inputTokens, output: outputTokens },
      confidence: confidence.level,
      confidence_score: confidence.score,
      historical_avg: historicalAvg,
      breakdown: {
        model_cost: cost,
        tool_cost: 0,
        api_overhead: 0,
      },
      recommendation,
    };
  }

  private estimateInputTokens(context: TaskContext): number {
    let tokens = 0;

    // Base system prompt
    tokens += 500;

    // User prompt
    tokens += this.countTokens(context.prompt);

    // File context
    for (const file of context.files ?? []) {
      tokens += this.countTokens(file.content);
    }

    // Conversation history
    tokens += this.countTokens(context.conversationHistory ?? '');

    return Math.ceil(tokens * 1.1); // 10% buffer
  }

  private async estimateOutputTokens(taskType: TaskType, model: string): Promise<number> {
    // Base estimates by task type
    const baseEstimates: Record<TaskType, number> = {
      code_implementation: 2000,
      code_review: 1000,
      test_writing: 1500,
      bug_fix: 800,
      refactoring: 1200,
      documentation: 1000,
      architecture: 3000,
      research: 2500,
    };

    const base = baseEstimates[taskType] ?? 1000;

    // Adjust by historical data
    const historicalAvg = await this.historical.getAverageOutputTokens(taskType, model);
    if (historicalAvg) {
      return Math.ceil((base + historicalAvg) / 2);
    }

    return base;
  }

  private calculateConfidence(
    estimated: number,
    historical?: number
  ): { level: 'low' | 'medium' | 'high'; score: number } {
    if (!historical) {
      return { level: 'low', score: 0.3 };
    }

    // Calculate variance
    const variance = Math.abs(estimated - historical) / historical;

    if (variance < 0.2) {
      return { level: 'high', score: 0.9 };
    } else if (variance < 0.5) {
      return { level: 'medium', score: 0.7 };
    } else {
      return { level: 'low', score: 0.4 };
    }
  }

  private async generateRecommendation(
    taskType: TaskType,
    cost: number,
    model: string
  ): Promise<string | undefined> {
    // Suggest cheaper alternatives for high-cost tasks
    if (cost > 0.1 && model.includes('opus')) {
      const haikuCost = await this.estimate(taskType, 'claude-3-5-haiku-20241022', {} as TaskContext);
      if (haikuCost.estimated_cost < cost * 0.5) {
        return `Consider using Haiku for this task (estimated $${haikuCost.estimated_cost.toFixed(3)} vs $${cost.toFixed(3)})`;
      }
    }

    // Suggest Ollama for simple tasks
    if (taskType === 'documentation' || taskType === 'formatting') {
      return 'Consider using Ollama (free) for this simple task';
    }

    return undefined;
  }

  private countTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
```

### Circuit Breaker Implementation

```typescript
class CircuitBreaker {
  private config: BudgetConfig['circuit_breakers'];
  private taskMetrics = new Map<string, TaskMetrics>();

  async check(taskId: string, metrics: TaskMetrics): Promise<CircuitBreakerResult> {
    if (!this.config.enabled) {
      return { status: 'closed', escalate: false, metrics };
    }

    // Check retry count
    if (metrics.retryCount >= this.config.max_retry_per_task) {
      logger.error('Circuit breaker: max retry exceeded', { taskId, retryCount: metrics.retryCount });
      return {
        status: 'open',
        reason: 'max_retry_exceeded',
        escalate: this.config.escalate_on_breach,
        metrics,
      };
    }

    // Check cost per task
    if (metrics.costSoFar >= this.config.max_cost_per_task) {
      logger.error('Circuit breaker: max cost exceeded', { taskId, cost: metrics.costSoFar });
      return {
        status: 'open',
        reason: 'max_cost_exceeded',
        escalate: this.config.escalate_on_breach,
        metrics,
      };
    }

    // Check duration per task
    if (metrics.durationMs >= this.config.max_duration_per_task) {
      logger.error('Circuit breaker: max duration exceeded', { taskId, duration: metrics.durationMs });
      return {
        status: 'open',
        reason: 'max_duration_exceeded',
        escalate: this.config.escalate_on_breach,
        metrics,
      };
    }

    // All checks passed
    return { status: 'closed', escalate: false, metrics };
  }

  async recordMetrics(taskId: string, metrics: Partial<TaskMetrics>): Promise<void> {
    const existing = this.taskMetrics.get(taskId) ?? {
      retryCount: 0,
      costSoFar: 0,
      durationMs: 0,
      startTime: new Date(),
    };

    this.taskMetrics.set(taskId, {
      ...existing,
      ...metrics,
    });
  }

  async reset(taskId: string): Promise<void> {
    this.taskMetrics.delete(taskId);
  }
}
```

### Notification Rate Limiter

```typescript
class NotificationRateLimiter {
  private config: BudgetConfig['notification'];
  private sentNotifications: { timestamp: Date; type: string; priority: string }[] = [];
  private batchQueue: Notification[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  async send(notification: Notification): Promise<void> {
    // Check rate limit
    const oneHourAgo = new Date(Date.now() - 3600000);
    this.sentNotifications = this.sentNotifications.filter(n => n.timestamp > oneHourAgo);

    if (this.sentNotifications.length >= this.config.rate_limit) {
      // Rate limit exceeded, add to batch queue
      this.batchQueue.push(notification);
      this.scheduleBatch();
      logger.warn('Notification rate limit exceeded, queued for batch', {
        queueSize: this.batchQueue.length,
        type: notification.type,
      });
      return;
    }

    // Send immediately
    await this.sendNow(notification);
  }

  private async sendNow(notification: Notification): Promise<void> {
    // Send to configured channels
    for (const channel of this.config.channels) {
      await this.sendToChannel(channel, notification);
    }

    // Record sent notification
    this.sentNotifications.push({
      timestamp: new Date(),
      type: notification.type,
      priority: notification.priority ?? 'medium',
    });

    logger.debug('Notification sent', { type: notification.type, channels: this.config.channels });
  }

  private async sendToChannel(channel: string, notification: Notification): Promise<void> {
    switch (channel) {
      case 'console':
        console.log(`\n${this.formatNotification(notification)}\n`);
        break;

      case 'email':
        // TODO: Implement email notification
        logger.debug('Email notification not implemented yet');
        break;

      case 'slack':
        // TODO: Implement Slack notification
        logger.debug('Slack notification not implemented yet');
        break;
    }
  }

  private formatNotification(notification: Notification): string {
    const icon = {
      budget_limit: '🛑',
      budget_warning: '⚠️',
      approval_required: '🔔',
      decision_notification: 'ℹ️',
      batch_summary: '📦',
    }[notification.type] ?? 'ℹ️';

    return `${icon} ${notification.message}`;
  }

  private scheduleBatch(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(async () => {
      if (this.batchQueue.length > 0) {
        // Send batch summary
        await this.sendNow({
          type: 'batch_summary',
          priority: 'low',
          message: `${this.batchQueue.length} notifications pending`,
          details: {
            notifications: this.batchQueue.map(n => ({
              type: n.type,
              message: n.message,
            })),
          },
        });

        this.batchQueue = [];
      }
      this.batchTimer = null;
    }, this.config.batch_window);
  }
}
```

### Default Configuration

```typescript
// src/config/budget-defaults.ts
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  daily_limit: 10.0,
  per_session_limit: 2.0,
  per_track_limit: 0.5,
  warning_threshold: 80,

  on_limit_reached: {
    action: 'pause_and_notify',
    fallback_model: 'ollama/qwen2.5-coder',
    pause_duration: 60000, // 1 minute
  },

  notification: {
    channels: ['console'],
    rate_limit: 4,
    batch_window: 300000, // 5 minutes
    priority_levels: {
      warning: true,
      limit: true,
      breach: true,
    },
  },

  circuit_breakers: {
    enabled: true,
    max_retry_per_task: 3,
    max_cost_per_task: 0.5,
    max_duration_per_task: 300000, // 5 minutes
    escalate_on_breach: true,
  },

  estimation: {
    enabled: true,
    require_approval_above: 1.0,
    confidence_threshold: 0.7,
  },
};
```

### Integration with Checkpoint (Sprint 35)

```typescript
// CheckpointState extension for budget tracking
interface CheckpointState {
  // ... existing fields ...

  budgetTracking: {
    sessionCostSoFar: number;
    dailyCostSoFar: number;
    tokenUsage: TokenUsageRecord[];
    lastUpdated: Date;
  };
}

// Budget restoration on resume
async function restoreBudgetState(checkpoint: CheckpointState): Promise<void> {
  // Restore session cost
  budgetTracker.state.session.costSoFar = checkpoint.budgetTracking.sessionCostSoFar;

  // Restore token usage
  budgetTracker.state.tokenUsage = checkpoint.budgetTracking.tokenUsage;

  // Check if daily limit still applies
  const checkpointDate = new Date(checkpoint.createdAt);
  const now = new Date();

  if (isSameDay(checkpointDate, now)) {
    // Same day, restore daily cost
    budgetTracker.state.daily.costSoFar = checkpoint.budgetTracking.dailyCostSoFar;
  } else {
    // New day, reset daily cost
    budgetTracker.state.daily.costSoFar = 0;
    budgetTracker.state.daily.date = now.toISOString().split('T')[0];
  }

  logger.info('Budget state restored from checkpoint', {
    sessionCost: budgetTracker.state.session.costSoFar,
    dailyCost: budgetTracker.state.daily.costSoFar,
  });
}
```

## Alternatives Considered

### 1. No Budget Control
- **Pros**: Simpler implementation, no pauses
- **Cons**: Runaway costs, poor CEO experience, unsafe autonomy
- **Decision**: Rejected - budget control is critical for Phase 2

### 2. Fixed Cost Per Task
- **Pros**: Predictable, simple
- **Cons**: Inflexible, doesn't account for task complexity
- **Decision**: Rejected - dynamic estimation is more accurate

### 3. Provider-Level Rate Limiting Only
- **Pros**: Relies on provider controls
- **Cons**: Not granular enough, no cross-provider tracking
- **Decision**: Rejected - need application-level control

### 4. Unlimited Ollama Fallback
- **Pros**: No cost after limit
- **Cons**: Quality drop, may not complete complex tasks
- **Decision**: Partially accepted - Ollama as fallback option, not automatic

## Consequences

### Positive
- **Cost Predictability**: $2 session / $10 daily limits prevent overspending
- **Safe Autonomy**: Budget control enables self-correction (Sprint 37+)
- **CEO Control**: Clear budget governance without micromanagement
- **Notification Management**: Rate limiting prevents CEO overwhelm
- **Graceful Degradation**: Fallback to Ollama when budget exhausted

### Negative
- **Execution Pauses**: May interrupt autonomous flow
- **Estimation Accuracy**: Initial estimates may be off by 30-50%
- **Configuration Complexity**: Many knobs to tune
- **Storage Overhead**: Token usage tracking adds to state size

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Inaccurate Estimates** | Premature pauses or overspending | Historical data + 10% buffer, tunable over time |
| **Notification Spam** | CEO overwhelmed | Rate limiting (4/hour), batching (5 min window) |
| **Budget Too Restrictive** | Work doesn't complete | Easy config adjustment, Ollama fallback |
| **Circuit Breakers Too Strict** | Premature escalation | Tunable thresholds, metrics collection for tuning |
| **Daily Reset Edge Cases** | Budget tracking errors | UTC-based, explicit midnight reset |

## Implementation Plan

### Sprint 36 Week 1: Budget Tracking
- Day 1: ADR-007 approval, budget types
- Day 2-3: BudgetTracker, cost accumulator, circuit breakers
- Day 4: CostEstimator, token estimation
- Day 5: Checkpoint integration, budget recovery

### Sprint 36 Week 2: Escalation & Notification
- Day 6-7: Escalation router, decision classifier
- Day 8: Approval queue (persistence, CLI commands)
- Day 9: Notification system, rate limiter
- Day 10: E2E testing, sprint review

## Verification

### Unit Tests
```typescript
describe('BudgetTracker', () => {
  it('should track session cost correctly');
  it('should pause at session limit ($2.00)');
  it('should pause at daily limit ($10.00)');
  it('should warn at 80% threshold');
  it('should reset daily cost at midnight UTC');
  it('should integrate with checkpoint state');
});

describe('CircuitBreaker', () => {
  it('should trip on max retry (3)');
  it('should trip on max cost ($0.50)');
  it('should trip on max duration (5 min)');
  it('should escalate when configured');
});

describe('CostEstimator', () => {
  it('should estimate cost within 30% of actual');
  it('should provide confidence scores');
  it('should recommend cheaper alternatives');
  it('should use historical data when available');
});

describe('NotificationRateLimiter', () => {
  it('should enforce 4/hour rate limit');
  it('should batch notifications after limit');
  it('should send to configured channels');
});
```

### Integration Tests
- Full budget lifecycle: estimate → execute → track → limit → pause
- Checkpoint → resume → budget restoration
- Circuit breaker → escalation → approval queue
- Notification rate limiting under load

### E2E Test Scenarios (Sprint 36 Day 10)
1. Session budget limit ($2) → pause → notify
2. Daily budget limit ($10) → pause → notify
3. Budget warning at 80% → notify
4. Budget limit → fallback to Ollama
5. Circuit breaker triggers (max retry, max cost, max duration)
6. Approval queue persists across checkpoint/resume
7. Notification rate limit (4/hour) enforced
8. Cost estimation accuracy (±30%)

## Related ADRs
- **ADR-006**: Checkpoint State Model (budget tracking fields)
- **ADR-008**: Concurrency Model (per-track budgets)
- **ADR-009**: Self-Correction (circuit breakers for retry loops)

## Expert Feedback

### CPO Feedback (Autonomy Epic Planning)
> "4 notifications per hour max. No more CEO notification spam."
> "Budget limits are non-negotiable: $2 session, $10 daily."

**Decision**: Implemented as hard limits with rate-limited notifications.

### CTO Feedback (Circuit Breakers)
> "3 strikes rule: max 3 retries before escalation."
> "5 minute timeout per task. If it takes longer, something's wrong."

**Decision**: Circuit breakers with configurable thresholds.

### Architect Feedback (Ollama Fallback)
> "Ollama fallback is a good safety valve, but make it explicit, not automatic."

**Decision**: `switch_to_ollama` as configurable action, not default.

## References

### Tools Evaluated
- **LangSmith**: Token tracking, cost analysis
- **Weights & Biases**: Cost monitoring
- **Custom Implementation**: Chosen for full control and integration

### Pricing Sources
- Anthropic pricing: https://www.anthropic.com/pricing
- OpenAI pricing: https://openai.com/pricing
- Google Gemini pricing: https://cloud.google.com/vertex-ai/pricing

---

*ADR-007 created for EndiorBot Autonomous Execution Budget*
*SDLC Framework v6.4.0*
