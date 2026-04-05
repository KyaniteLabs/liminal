/**
 * SleepScheduler — Adaptive sleep timing based on user activity patterns.
 *
 * "Sleep when the user sleeps." The scheduler tracks when the user is active
 * and builds a simple activity model. When idle periods are detected, it
 * triggers dreaming at appropriate times:
 *
 *   - **Micro-dreams**: 5+ minutes idle. Quick consolidation pass, cache warming.
 *   - **Deep dreams**: 30+ minutes idle. Full two-stage dream pipeline.
 *
 * No configurable cron — the system figures it out from observed patterns.
 *
 * @module intuition/SleepScheduler
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SleepDepth = 'micro' | 'deep';

export interface SleepScheduleConfig {
  /** Idle minutes before a micro-dream. Default: 5 */
  microIdleMinutes?: number;
  /** Idle minutes before a deep dream. Default: 30 */
  deepIdleMinutes?: number;
  /** Maximum dreams per hour. Default: 6 */
  maxDreamsPerHour?: number;
  /** Minimum minutes between consecutive dreams. Default: 3 */
  minDreamSpacingMinutes?: number;
  /** Activity sample window in hours. Default: 24 */
  activityWindowHours?: number;
}

export interface ActivitySample {
  timestamp: number; // ms since epoch
  type: 'generation' | 'interaction' | 'command';
}

export interface SleepState {
  /** Whether the system is currently "awake" (user is active) */
  isAwake: boolean;
  /** Current sleep pressure (0-1, higher = more pressure to sleep) */
  sleepPressure: number;
  /** Minutes since last user activity */
  idleMinutes: number;
  /** Time of last dream */
  lastDreamAt: number | null;
  /** Dreams completed in current hour */
  dreamsThisHour: number;
  /** Current hour bucket for rate limiting */
  currentHourBucket: number;
  /** Recommended sleep depth */
  recommendedDepth: SleepDepth | null;
}

// ---------------------------------------------------------------------------
// SleepScheduler
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<SleepScheduleConfig> = {
  microIdleMinutes: 5,
  deepIdleMinutes: 30,
  maxDreamsPerHour: 6,
  minDreamSpacingMinutes: 3,
  activityWindowHours: 24,
};

export class SleepScheduler {
  private readonly config: Required<SleepScheduleConfig>;
  private activityLog: ActivitySample[] = [];
  private lastDreamAt: number | null = null;
  private dreamsThisHour = 0;
  private currentHourBucket = 0;

  constructor(config?: SleepScheduleConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Activity tracking
  // ---------------------------------------------------------------------------

  /**
   * Record a user activity event.
   * Call this whenever the user generates, edits, or interacts.
   */
  recordActivity(type: ActivitySample['type'] = 'interaction'): void {
    this.activityLog.push({
      timestamp: Date.now(),
      type,
    });

    // Trim old activity samples
    const cutoff = Date.now() - this.config.activityWindowHours * 60 * 60 * 1000;
    this.activityLog = this.activityLog.filter(a => a.timestamp > cutoff);
  }

  // ---------------------------------------------------------------------------
  // Sleep state
  // ---------------------------------------------------------------------------

  /**
   * Get current sleep state — should the system dream?
   */
  getState(): SleepState {
    const now = Date.now();
    const lastActivity = this.getLastActivityTime();
    const idleMinutes = lastActivity ? (now - lastActivity) / 60_000 : Infinity;

    // Sleep pressure: sigmoid on idle time
    // Pressure is low for first few minutes, ramps up as idle grows
    const sleepPressure = 1 / (1 + Math.exp(-(idleMinutes - 15) / 5));

    // Check rate limiting
    const hourBucket = Math.floor(now / (60 * 60 * 1000));
    if (hourBucket !== this.currentHourBucket) {
      this.currentHourBucket = hourBucket;
      this.dreamsThisHour = 0;
    }

    const rateLimitOk = this.dreamsThisHour < this.config.maxDreamsPerHour;
    const spacingOk = !this.lastDreamAt ||
      (now - this.lastDreamAt) > this.config.minDreamSpacingMinutes * 60 * 1000;

    // Determine depth
    let recommendedDepth: SleepDepth | null = null;
    if (idleMinutes >= this.config.deepIdleMinutes && rateLimitOk && spacingOk) {
      recommendedDepth = 'deep';
    } else if (idleMinutes >= this.config.microIdleMinutes && rateLimitOk && spacingOk) {
      recommendedDepth = 'micro';
    }

    return {
      isAwake: idleMinutes < this.config.microIdleMinutes,
      sleepPressure,
      idleMinutes,
      lastDreamAt: this.lastDreamAt,
      dreamsThisHour: this.dreamsThisHour,
      currentHourBucket: this.currentHourBucket,
      recommendedDepth,
    };
  }

  /**
   * Should the system dream right now?
   */
  shouldDream(): SleepDepth | null {
    return this.getState().recommendedDepth;
  }

  /**
   * Mark that a dream was completed.
   */
  markDreamCompleted(): void {
    this.lastDreamAt = Date.now();
    this.dreamsThisHour++;
  }

  // ---------------------------------------------------------------------------
  // Activity pattern analysis
  // ---------------------------------------------------------------------------

  /**
   * Get the user's typical active hours (0-23).
   * Returns an array of hours where activity density is above median.
   */
  getActiveHours(): number[] {
    if (this.activityLog.length < 10) return []; // Not enough data

    const hourCounts = new Array(24).fill(0) as number[];
    for (const sample of this.activityLog) {
      const hour = new Date(sample.timestamp).getHours();
      hourCounts[hour]++;
    }

    const median = hourCounts.sort((a, b) => a - b)[12]; // Rough median
    const activeHours: number[] = [];
    for (let h = 0; h < 24; h++) {
      if (hourCounts[h] > median) activeHours.push(h);
    }

    return activeHours;
  }

  /**
   * Get estimated "bedtime" — the hour when activity typically drops off.
   * Returns the first hour after sustained activity where activity drops below 25% of peak.
   */
  getEstimatedBedtime(): number | null {
    const activeHours = this.getActiveHours();
    if (activeHours.length < 3) return null;

    // Find the latest sustained active hour
    const sorted = [...activeHours].sort((a, b) => a - b);
    // Look for gaps in the sorted hours — bedtime is after the last gap
    for (let i = sorted.length - 1; i > 0; i--) {
      if (sorted[i] - sorted[i - 1] > 2) {
        return sorted[i - 1] + 1; // Hour after the last sustained block
      }
    }

    // No gap found — activity is spread across all hours
    return null;
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  private getLastActivityTime(): number | null {
    if (this.activityLog.length === 0) return null;
    return Math.max(...this.activityLog.map(a => a.timestamp));
  }

  /** Reset state. */
  reset(): void {
    this.activityLog = [];
    this.lastDreamAt = null;
    this.dreamsThisHour = 0;
  }

  /** Get activity log size. */
  get activityCount(): number {
    return this.activityLog.length;
  }
}
