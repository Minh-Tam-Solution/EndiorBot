/**
 * Account Manager for Smart Claude Account Switching
 *
 * Manages 2 Claude accounts with automatic failover.
 *
 * Per Sprint 38 Day 1-2 requirements:
 * - Manage 2 Claude accounts (primary + teamDev)
 * - Weekly quota tracking per account
 * - Auto-switch on rate limit
 * - Detect weekly reset (Monday 00:00 UTC)
 * - Notify CEO on account switch (max 4/hour)
 * - Learn actual quota from rate limit occurrences
 *
 * @module providers/account-manager
 * @version 1.0.0
 * @date 2026-02-23
 * @status ACTIVE - Sprint 38 Day 1-2
 * @authority ADR-008 Multi-Provider Architecture
 * @pillar 3 - Resource Optimization
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

import { createLogger, type Logger } from "../logging/index.js";
import type { ProviderErrorCode } from "./types.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Claude account identifier.
 */
export type AccountId = "primary" | "teamDev";

/**
 * Account status.
 */
export type AccountStatus =
  | "available"      // Ready to use
  | "rate_limited"   // Hit rate limit
  | "quota_exceeded" // Weekly quota exceeded
  | "unavailable"    // Cannot connect
  | "unknown";       // Not yet checked

/**
 * Account configuration.
 */
export interface AccountConfig {
  /** Account identifier */
  id: AccountId;
  /** Display name */
  name: string;
  /** Anthropic API key */
  apiKey: string;
  /** Estimated weekly quota (USD) */
  estimatedQuota: number;
  /** Priority (lower = higher priority) */
  priority: number;
}

/**
 * Account state (runtime).
 */
export interface AccountState {
  /** Account configuration */
  config: AccountConfig;
  /** Current status */
  status: AccountStatus;
  /** Usage this week (USD) */
  weeklyUsage: number;
  /** Learned quota (from rate limit occurrences) */
  learnedQuota: number | null;
  /** Last rate limit timestamp */
  lastRateLimitAt: Date | null;
  /** Last successful request timestamp */
  lastSuccessAt: Date | null;
  /** Total requests this week */
  weeklyRequests: number;
  /** Week start timestamp (for reset detection) */
  weekStart: Date;
}

/**
 * Account switch event.
 */
export interface AccountSwitchEvent {
  /** Previous account */
  from: AccountId;
  /** New account */
  to: AccountId;
  /** Switch reason */
  reason: "rate_limit" | "quota_exceeded" | "unavailable" | "manual";
  /** Timestamp */
  timestamp: Date;
}

/**
 * Account Manager configuration.
 */
export interface AccountManagerConfig {
  /** Primary account config */
  primary: Omit<AccountConfig, "id" | "priority">;
  /** Team dev account config */
  teamDev: Omit<AccountConfig, "id" | "priority">;
  /** Max notifications per hour */
  maxNotificationsPerHour: number;
  /** Callback for account switch notifications */
  onAccountSwitch?: (event: AccountSwitchEvent) => Promise<void>;
}

/**
 * Account selection result.
 */
export interface AccountSelection {
  /** Selected account ID */
  accountId: AccountId;
  /** API key for the account */
  apiKey: string;
  /** Account name */
  name: string;
  /** Why this account was selected */
  reason: string;
  /** Whether this is a fallback */
  isFallback: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default estimated weekly quota (USD) */
export const DEFAULT_WEEKLY_QUOTA = 50;

/** Rate limit cooldown period (ms) - 1 hour */
export const RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;

/** Max notifications per hour */
export const DEFAULT_MAX_NOTIFICATIONS_PER_HOUR = 4;

// ============================================================================
// AccountManager
// ============================================================================

/**
 * AccountManager - Smart Claude account switching.
 *
 * Manages 2 Claude accounts with automatic failover based on:
 * - Rate limits (429 errors)
 * - Quota tracking (weekly usage)
 * - Health status
 *
 * Features:
 * - Auto-switch on rate limit
 * - Weekly quota tracking
 * - Learns actual quota from rate limit occurrences
 * - CEO notifications (rate limited)
 * - Weekly reset detection (Monday 00:00 UTC)
 */
export class AccountManager {
  private accounts: Map<AccountId, AccountState> = new Map();
  private activeAccountId: AccountId = "primary";
  private switchHistory: AccountSwitchEvent[] = [];
  private notificationCount = 0;
  private notificationResetTime: Date;
  private onAccountSwitch: ((event: AccountSwitchEvent) => Promise<void>) | undefined;
  private maxNotificationsPerHour: number;
  private log: Logger;

  constructor(config: AccountManagerConfig) {
    this.log = createLogger("account-manager");
    this.maxNotificationsPerHour = config.maxNotificationsPerHour ?? DEFAULT_MAX_NOTIFICATIONS_PER_HOUR;
    this.onAccountSwitch = config.onAccountSwitch ?? undefined;
    this.notificationResetTime = new Date();

    // Initialize accounts
    this.initializeAccount({
      id: "primary",
      name: config.primary.name,
      apiKey: config.primary.apiKey,
      estimatedQuota: config.primary.estimatedQuota ?? DEFAULT_WEEKLY_QUOTA,
      priority: 1,
    });

    this.initializeAccount({
      id: "teamDev",
      name: config.teamDev.name,
      apiKey: config.teamDev.apiKey,
      estimatedQuota: config.teamDev.estimatedQuota ?? DEFAULT_WEEKLY_QUOTA,
      priority: 2,
    });

    this.log.info("AccountManager initialized", {
      accounts: Array.from(this.accounts.keys()),
      activeAccount: this.activeAccountId,
    });
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Select the best available account.
   * Returns the account with highest priority that is available.
   */
  selectAccount(): AccountSelection {
    // Check for weekly reset
    this.checkWeeklyReset();

    // Get all accounts sorted by priority
    const sortedAccounts = this.getSortedAccounts();

    for (const state of sortedAccounts) {
      if (this.isAccountAvailable(state)) {
        const isFallback = state.config.id !== this.activeAccountId;
        const reason = isFallback
          ? `Fallback from ${this.activeAccountId} to ${state.config.id}`
          : `Using preferred account ${state.config.id}`;

        return {
          accountId: state.config.id,
          apiKey: state.config.apiKey,
          name: state.config.name,
          reason,
          isFallback,
        };
      }
    }

    // All accounts unavailable - return primary anyway with warning
    const primary = this.accounts.get("primary")!;
    this.log.warn("All accounts unavailable, returning primary with warning");

    return {
      accountId: "primary",
      apiKey: primary.config.apiKey,
      name: primary.config.name,
      reason: "All accounts unavailable, attempting primary",
      isFallback: false,
    };
  }

  /**
   * Report successful request usage.
   */
  reportSuccess(accountId: AccountId, costUsd: number): void {
    const state = this.accounts.get(accountId);
    if (!state) return;

    state.weeklyUsage += costUsd;
    state.weeklyRequests++;
    state.lastSuccessAt = new Date();
    state.status = "available";

    this.log.debug("Request success reported", {
      accountId,
      costUsd,
      weeklyUsage: state.weeklyUsage,
      weeklyRequests: state.weeklyRequests,
    });

    // Check if approaching quota
    this.checkQuotaWarning(state);
  }

  /**
   * Report rate limit error.
   * Triggers account switch if necessary.
   */
  async reportRateLimit(accountId: AccountId): Promise<void> {
    const state = this.accounts.get(accountId);
    if (!state) return;

    state.status = "rate_limited";
    state.lastRateLimitAt = new Date();

    // Learn actual quota from rate limit
    if (state.learnedQuota === null || state.weeklyUsage < state.learnedQuota) {
      state.learnedQuota = state.weeklyUsage;
      this.log.info("Learned quota from rate limit", {
        accountId,
        learnedQuota: state.learnedQuota,
      });
    }

    this.log.warn("Rate limit reported", {
      accountId,
      weeklyUsage: state.weeklyUsage,
      learnedQuota: state.learnedQuota,
    });

    // Switch to next available account
    await this.switchToNextAvailable(accountId, "rate_limit");
  }

  /**
   * Report quota exceeded error.
   */
  async reportQuotaExceeded(accountId: AccountId): Promise<void> {
    const state = this.accounts.get(accountId);
    if (!state) return;

    state.status = "quota_exceeded";

    this.log.warn("Quota exceeded reported", {
      accountId,
      weeklyUsage: state.weeklyUsage,
    });

    // Switch to next available account
    await this.switchToNextAvailable(accountId, "quota_exceeded");
  }

  /**
   * Report provider error (for failover classification).
   */
  async reportError(accountId: AccountId, errorCode: ProviderErrorCode): Promise<void> {
    if (errorCode === "RATE_LIMIT") {
      await this.reportRateLimit(accountId);
    } else if (errorCode === "AUTH_ERROR") {
      await this.reportQuotaExceeded(accountId); // Treat auth error as quota issue
    }
    // Other errors don't trigger account switch
  }

  /**
   * Manually switch to a specific account.
   */
  async switchTo(accountId: AccountId): Promise<boolean> {
    const state = this.accounts.get(accountId);
    if (!state) return false;

    const previousAccount = this.activeAccountId;
    this.activeAccountId = accountId;

    const event: AccountSwitchEvent = {
      from: previousAccount,
      to: accountId,
      reason: "manual",
      timestamp: new Date(),
    };

    this.switchHistory.push(event);
    await this.notifyAccountSwitch(event);

    return true;
  }

  /**
   * Get current active account ID.
   */
  getActiveAccountId(): AccountId {
    return this.activeAccountId;
  }

  /**
   * Get account state.
   */
  getAccountState(accountId: AccountId): AccountState | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * Get all account states.
   */
  getAllAccountStates(): AccountState[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get switch history.
   */
  getSwitchHistory(): AccountSwitchEvent[] {
    return [...this.switchHistory];
  }

  /**
   * Get usage statistics.
   */
  getUsageStats(): {
    primary: { usage: number; quota: number; requests: number };
    teamDev: { usage: number; quota: number; requests: number };
    totalUsage: number;
    totalRequests: number;
  } {
    const primary = this.accounts.get("primary")!;
    const teamDev = this.accounts.get("teamDev")!;

    return {
      primary: {
        usage: primary.weeklyUsage,
        quota: primary.learnedQuota ?? primary.config.estimatedQuota,
        requests: primary.weeklyRequests,
      },
      teamDev: {
        usage: teamDev.weeklyUsage,
        quota: teamDev.learnedQuota ?? teamDev.config.estimatedQuota,
        requests: teamDev.weeklyRequests,
      },
      totalUsage: primary.weeklyUsage + teamDev.weeklyUsage,
      totalRequests: primary.weeklyRequests + teamDev.weeklyRequests,
    };
  }

  /**
   * Check if account is rate limited and cooldown has passed.
   */
  isAccountRecovered(accountId: AccountId): boolean {
    const state = this.accounts.get(accountId);
    if (!state) return false;

    if (state.status !== "rate_limited") {
      return state.status === "available";
    }

    // Check if cooldown has passed
    if (state.lastRateLimitAt) {
      const elapsed = Date.now() - state.lastRateLimitAt.getTime();
      if (elapsed >= RATE_LIMIT_COOLDOWN_MS) {
        state.status = "available";
        return true;
      }
    }

    return false;
  }

  /**
   * Reset account state (for testing or manual recovery).
   */
  resetAccount(accountId: AccountId): void {
    const state = this.accounts.get(accountId);
    if (!state) return;

    state.status = "available";
    state.lastRateLimitAt = null;

    this.log.info("Account reset", { accountId });
  }

  /**
   * Force weekly reset (for testing).
   */
  forceWeeklyReset(): void {
    for (const state of this.accounts.values()) {
      state.weeklyUsage = 0;
      state.weeklyRequests = 0;
      state.status = "available";
      state.weekStart = this.getWeekStart();
    }

    this.log.info("Weekly reset forced");
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Initialize an account.
   */
  private initializeAccount(config: AccountConfig): void {
    const state: AccountState = {
      config,
      status: "unknown",
      weeklyUsage: 0,
      learnedQuota: null,
      lastRateLimitAt: null,
      lastSuccessAt: null,
      weeklyRequests: 0,
      weekStart: this.getWeekStart(),
    };

    this.accounts.set(config.id, state);
  }

  /**
   * Get sorted accounts by priority.
   */
  private getSortedAccounts(): AccountState[] {
    return Array.from(this.accounts.values()).sort(
      (a, b) => a.config.priority - b.config.priority
    );
  }

  /**
   * Check if account is available for use.
   */
  private isAccountAvailable(state: AccountState): boolean {
    // Check recovery for rate limited accounts
    if (state.status === "rate_limited") {
      return this.isAccountRecovered(state.config.id);
    }

    if (state.status === "quota_exceeded" || state.status === "unavailable") {
      return false;
    }

    // Check quota warning (90% of estimated/learned quota)
    const quota = state.learnedQuota ?? state.config.estimatedQuota;
    if (state.weeklyUsage >= quota * 0.95) {
      return false;
    }

    return true;
  }

  /**
   * Switch to next available account.
   */
  private async switchToNextAvailable(
    fromAccountId: AccountId,
    reason: AccountSwitchEvent["reason"]
  ): Promise<void> {
    const sortedAccounts = this.getSortedAccounts();

    for (const state of sortedAccounts) {
      if (state.config.id !== fromAccountId && this.isAccountAvailable(state)) {
        const previousAccount = this.activeAccountId;
        this.activeAccountId = state.config.id;

        const event: AccountSwitchEvent = {
          from: previousAccount,
          to: state.config.id,
          reason,
          timestamp: new Date(),
        };

        this.switchHistory.push(event);
        await this.notifyAccountSwitch(event);

        this.log.info("Account switched", {
          from: previousAccount,
          to: state.config.id,
          reason,
        });

        return;
      }
    }

    this.log.error("No available accounts to switch to", { fromAccountId, reason });
  }

  /**
   * Notify about account switch (rate limited).
   */
  private async notifyAccountSwitch(event: AccountSwitchEvent): Promise<void> {
    // Check rate limit
    if (!this.canSendNotification()) {
      this.log.debug("Notification rate limited", {
        count: this.notificationCount,
        max: this.maxNotificationsPerHour,
      });
      return;
    }

    this.notificationCount++;

    if (this.onAccountSwitch) {
      try {
        await this.onAccountSwitch(event);
      } catch (error) {
        this.log.error("Failed to send account switch notification", {
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Check if can send notification (rate limiting).
   */
  private canSendNotification(): boolean {
    const now = new Date();
    const hourElapsed = now.getTime() - this.notificationResetTime.getTime() >= 60 * 60 * 1000;

    if (hourElapsed) {
      this.notificationCount = 0;
      this.notificationResetTime = now;
    }

    return this.notificationCount < this.maxNotificationsPerHour;
  }

  /**
   * Check for weekly reset (Monday 00:00 UTC).
   */
  private checkWeeklyReset(): void {
    const currentWeekStart = this.getWeekStart();

    for (const state of this.accounts.values()) {
      if (state.weekStart.getTime() !== currentWeekStart.getTime()) {
        this.log.info("Weekly reset detected", {
          accountId: state.config.id,
          previousUsage: state.weeklyUsage,
        });

        state.weeklyUsage = 0;
        state.weeklyRequests = 0;
        state.status = "available";
        state.weekStart = currentWeekStart;
      }
    }
  }

  /**
   * Check quota warning threshold.
   */
  private checkQuotaWarning(state: AccountState): void {
    const quota = state.learnedQuota ?? state.config.estimatedQuota;
    const usagePercent = (state.weeklyUsage / quota) * 100;

    if (usagePercent >= 80 && usagePercent < 90) {
      this.log.warn("Account approaching quota (80%)", {
        accountId: state.config.id,
        usage: state.weeklyUsage,
        quota,
        percent: usagePercent.toFixed(1),
      });
    } else if (usagePercent >= 90) {
      this.log.warn("Account near quota limit (90%)", {
        accountId: state.config.id,
        usage: state.weeklyUsage,
        quota,
        percent: usagePercent.toFixed(1),
      });
    }
  }

  /**
   * Get start of current week (Monday 00:00 UTC).
   */
  private getWeekStart(): Date {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysToMonday);
    weekStart.setUTCHours(0, 0, 0, 0);

    return weekStart;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an AccountManager instance.
 */
export function createAccountManager(
  config: AccountManagerConfig
): AccountManager {
  return new AccountManager(config);
}

/**
 * Create AccountManager from environment variables.
 */
export function createAccountManagerFromEnv(): AccountManager {
  const primaryApiKey = process.env.ANTHROPIC_API_KEY;
  const teamDevApiKey = process.env.ANTHROPIC_TEAM_DEV_API_KEY;

  if (!primaryApiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable not set");
  }

  return createAccountManager({
    primary: {
      name: "Primary (CEO)",
      apiKey: primaryApiKey,
      estimatedQuota: parseFloat(process.env.ANTHROPIC_PRIMARY_QUOTA ?? "50"),
    },
    teamDev: {
      name: "Team Dev",
      apiKey: teamDevApiKey ?? primaryApiKey, // Fallback to primary if not set
      estimatedQuota: parseFloat(process.env.ANTHROPIC_TEAM_DEV_QUOTA ?? "50"),
    },
    maxNotificationsPerHour: parseInt(
      process.env.ACCOUNT_MANAGER_MAX_NOTIFICATIONS ?? "4",
      10
    ),
  });
}
