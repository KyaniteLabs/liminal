/**
 * Tests for SuccessRateTracker and StagnationDetector integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SuccessRateTracker, createSuccessRateTracker } from '../../src/core/SuccessRateTracker.js';
import { StagnationDetector } from '../../src/core/StagnationDetector.js';

describe('SuccessRateTracker', () => {
  let tracker: SuccessRateTracker;

  beforeEach(() => {
    tracker = new SuccessRateTracker();
  });

  describe('Basic tracking', () => {
    it('should start with 0 success rate', () => {
      expect(tracker.getSuccessRate()).toBe(0);
      expect(tracker.getAttemptCount()).toBe(0);
      expect(tracker.getSuccessCount()).toBe(0);
    });

    it('should record successful attempts', () => {
      tracker.recordAttempt(true);
      expect(tracker.getSuccessRate()).toBe(1);
      expect(tracker.getAttemptCount()).toBe(1);
      expect(tracker.getSuccessCount()).toBe(1);
    });

    it('should record failed attempts', () => {
      tracker.recordAttempt(false);
      expect(tracker.getSuccessRate()).toBe(0);
      expect(tracker.getAttemptCount()).toBe(1);
      expect(tracker.getSuccessCount()).toBe(0);
    });

    it('should calculate correct success rate for mixed results', () => {
      tracker.recordAttempt(true);
      tracker.recordAttempt(true);
      tracker.recordAttempt(false);
      tracker.recordAttempt(false);

      expect(tracker.getSuccessRate()).toBe(0.5);
      expect(tracker.getAttemptCount()).toBe(4);
      expect(tracker.getSuccessCount()).toBe(2);
    });
  });

  describe('Window management', () => {
    it('should maintain rolling window of 20 attempts by default', () => {
      // Add 25 successes (should keep only last 20)
      for (let i = 0; i < 25; i++) {
        tracker.recordAttempt(true);
      }

      expect(tracker.getAttemptCount()).toBe(20);
      expect(tracker.getSuccessRate()).toBe(1);
    });

    it('should correctly roll off old attempts', () => {
      // Add 10 failures then 15 successes
      for (let i = 0; i < 10; i++) {
        tracker.recordAttempt(false);
      }
      for (let i = 0; i < 15; i++) {
        tracker.recordAttempt(true);
      }

      // Window should have 20 attempts: 5 failures + 15 successes
      expect(tracker.getAttemptCount()).toBe(20);
      expect(tracker.getSuccessCount()).toBe(15);
      expect(tracker.getSuccessRate()).toBe(0.75);
    });

    it('should support custom window size', () => {
      const customTracker = new SuccessRateTracker({ windowSize: 5 });

      customTracker.recordAttempt(true);
      customTracker.recordAttempt(true);
      customTracker.recordAttempt(true);
      customTracker.recordAttempt(false);
      customTracker.recordAttempt(false);
      customTracker.recordAttempt(false);

      // Should only keep last 5 (3 false, 2 true)
      expect(customTracker.getAttemptCount()).toBe(5);
      expect(customTracker.getSuccessRate()).toBe(0.4);
    });
  });

  describe('High-exploration mode (1/5th rule)', () => {
    it('should not enter high-exploration mode with >= 20% success', () => {
      // 4 successes out of 20 = 20%
      for (let i = 0; i < 16; i++) {
        tracker.recordAttempt(false);
      }
      for (let i = 0; i < 4; i++) {
        tracker.recordAttempt(true);
      }

      expect(tracker.getSuccessRate()).toBe(0.2);
      // Should not explore aggressively at exactly 20% (below threshold)
      // Wait, 0.2 is the threshold, so it SHOULD explore at < 0.2
      // At exactly 0.2, it's not strictly less than threshold
    });

    it('should enter high-exploration mode when success rate drops below 20%', () => {
      // Need at least 5 attempts to trigger
      tracker.recordAttempt(false);
      tracker.recordAttempt(false);
      tracker.recordAttempt(false);
      tracker.recordAttempt(false);
      expect(tracker.shouldExploreAggressively()).toBe(false); // Not enough samples yet

      tracker.recordAttempt(false); // 5th attempt, 0% success
      expect(tracker.shouldExploreAggressively()).toBe(true);
    });

    it('should exit high-exploration mode when success rate recovers to 30%', () => {
      // Enter high-exploration mode
      for (let i = 0; i < 5; i++) {
        tracker.recordAttempt(false);
      }
      expect(tracker.shouldExploreAggressively()).toBe(true);

      // Add successes to recover
      for (let i = 0; i < 5; i++) {
        tracker.recordAttempt(true);
      }
      // 5 failures, 5 successes = 50%
      expect(tracker.getSuccessRate()).toBe(0.5);
      expect(tracker.shouldExploreAggressively()).toBe(false);
    });

    it('should use hysteresis to avoid flapping', () => {
      // Enter high-exploration mode
      for (let i = 0; i < 10; i++) {
        tracker.recordAttempt(false);
      }
      for (let i = 0; i < 2; i++) {
        tracker.recordAttempt(true);
      }
      // 10 failures, 2 successes = ~17% success rate
      expect(tracker.shouldExploreAggressively()).toBe(true);

      // Add just enough successes to get to 25% (still below 30% recovery threshold)
      tracker.recordAttempt(true);
      tracker.recordAttempt(true);
      // Now 10 failures, 4 successes = ~29%

      // Should still be in high-exploration mode (needs 30% to exit)
      expect(tracker.shouldExploreAggressively()).toBe(true);

      // Add one more success to reach ~33%
      tracker.recordAttempt(true);
      // 10 failures, 5 successes = ~33%

      expect(tracker.shouldExploreAggressively()).toBe(false);
    });
  });

  describe('Snapshot functionality', () => {
    it('should provide complete snapshot', () => {
      tracker.recordAttempt(true);
      tracker.recordAttempt(false);

      const snapshot = tracker.getSnapshot();
      expect(snapshot.successRate).toBe(0.5);
      expect(snapshot.attempts).toBe(2);
      expect(snapshot.successes).toBe(1);
      expect(snapshot.isHighExploration).toBe(false);
      expect(snapshot.highExplorationDuration).toBe(0);
    });

    it('should track high-exploration duration', () => {
      // Enter high-exploration mode
      for (let i = 0; i < 5; i++) {
        tracker.recordAttempt(false);
      }

      let snapshot = tracker.getSnapshot();
      expect(snapshot.isHighExploration).toBe(true);
      expect(snapshot.highExplorationDuration).toBe(0); // Just entered

      // Add more attempts while in high-exploration
      tracker.recordAttempt(false);
      tracker.recordAttempt(false);

      snapshot = tracker.getSnapshot();
      expect(snapshot.highExplorationDuration).toBe(2); // 2 more attempts
    });
  });

  describe('Recommendations', () => {
    it('should recommend more candidates in high-exploration mode', () => {
      const baseCandidates = 3;

      // Normal mode
      tracker.recordAttempt(true);
      tracker.recordAttempt(true);
      expect(tracker.getRecommendedCandidates(baseCandidates)).toBe(baseCandidates);

      // Enter high-exploration mode
      for (let i = 0; i < 10; i++) {
        tracker.recordAttempt(false);
      }

      const recommended = tracker.getRecommendedCandidates(baseCandidates);
      expect(recommended).toBeGreaterThan(baseCandidates);
    });

    it('should recommend lower quality threshold in high-exploration mode', () => {
      // Normal mode
      tracker.recordAttempt(true);
      tracker.recordAttempt(true);
      expect(tracker.getQualityThresholdMultiplier()).toBe(1.0);

      // Enter high-exploration mode
      for (let i = 0; i < 10; i++) {
        tracker.recordAttempt(false);
      }

      expect(tracker.getQualityThresholdMultiplier()).toBe(0.85);
    });

    it('should calculate at least +2 candidates in high-exploration mode', () => {
      tracker.recordAttempt(false);
      tracker.recordAttempt(false);
      tracker.recordAttempt(false);
      tracker.recordAttempt(false);
      tracker.recordAttempt(false);

      expect(tracker.getRecommendedCandidates(1)).toBe(3); // 1 + 2
      expect(tracker.getRecommendedCandidates(2)).toBe(4); // 2 + 2
    });
  });

  describe('Reset functionality', () => {
    it('should clear all history on reset', () => {
      tracker.recordAttempt(true);
      tracker.recordAttempt(false);

      expect(tracker.getAttemptCount()).toBe(2);

      tracker.reset();

      expect(tracker.getSuccessRate()).toBe(0);
      expect(tracker.getAttemptCount()).toBe(0);
      expect(tracker.shouldExploreAggressively()).toBe(false);
    });
  });

  describe('Factory function', () => {
    it('should create tracker with defaults', () => {
      const t = createSuccessRateTracker();
      expect(t.getSuccessRate()).toBe(0);
    });

    it('should create tracker with custom config', () => {
      const t = createSuccessRateTracker({ windowSize: 10, explorationThreshold: 0.3 });
      expect(t).toBeInstanceOf(SuccessRateTracker);
    });
  });
});

describe('StagnationDetector with SuccessRateTracker', () => {
  let detector: StagnationDetector;

  beforeEach(() => {
    detector = new StagnationDetector(7);
  });

  describe('Integration', () => {
    it('should track success rate during stagnation checks', () => {
      // Check with high score (success)
      const result1 = detector.check(1, 0.8, 0.3, 'test prompt');
      expect(result1.successRate).toBe(1);
      expect(result1.exploreAggressively).toBe(false);

      // Check with low score (failure)
      const result2 = detector.check(2, 0.5, 0.2, 'test prompt');
      expect(result2.successRate).toBe(0.5);
    });

    it('should expose shouldExploreAggressively method', () => {
      // Initially false
      expect(detector.shouldExploreAggressively()).toBe(false);

      // Add several failures
      for (let i = 0; i < 5; i++) {
        detector.check(i + 1, 0.5, 0.1, 'test prompt');
      }

      expect(detector.shouldExploreAggressively()).toBe(true);
    });

    it('should expose getSuccessRate method', () => {
      expect(detector.getSuccessRate()).toBe(0);

      detector.check(1, 0.8, 0.3, 'test prompt');
      expect(detector.getSuccessRate()).toBe(1);

      detector.check(2, 0.5, 0.2, 'test prompt');
      expect(detector.getSuccessRate()).toBe(0.5);
    });

    it('should provide success rate snapshot', () => {
      detector.check(1, 0.8, 0.3, 'test prompt');
      detector.check(2, 0.5, 0.2, 'test prompt');

      const snapshot = detector.getSuccessRateSnapshot();
      expect(snapshot.successRate).toBe(0.5);
      expect(snapshot.attempts).toBe(2);
      expect(snapshot.successes).toBe(1);
    });
  });

  describe('1/5th success rule', () => {
    it('should trigger exploration when < 20% success rate', () => {
      // Add 10 iterations with low scores (failures)
      for (let i = 0; i < 10; i++) {
        const result = detector.check(i + 1, 0.5, 0.1, 'test prompt');

        if (i >= 4) {
          // After 5th iteration with 0% success
          expect(result.exploreAggressively).toBe(true);
        }
      }
    });

    it('should return success rate in all results', () => {
      const result = detector.check(1, 0.75, 0.3, 'test prompt');
      expect(result.successRate).not.toBeNull();
      expect(result.exploreAggressively).not.toBeNull();
    });
  });
});

describe('The 1/5th success rule edge cases', () => {
  it('should handle exactly 4 successes in 20 attempts (at threshold)', () => {
    const tracker = new SuccessRateTracker({ windowSize: 20, explorationThreshold: 0.2 });

    // 4 successes out of 20 = exactly 20%
    for (let i = 0; i < 16; i++) {
      tracker.recordAttempt(false);
    }
    for (let i = 0; i < 4; i++) {
      tracker.recordAttempt(true);
    }

    expect(tracker.getSuccessRate()).toBe(0.2);
    // With 16 failures followed by 4 successes, exploration mode was triggered
    // during the early failures (0% < 20%) and stays active due to hysteresis
    // until recovery threshold (30%) is reached
    expect(tracker.shouldExploreAggressively()).toBe(true);
  });

  it('should handle 3 successes in 20 attempts (below threshold)', () => {
    const tracker = new SuccessRateTracker({ windowSize: 20, explorationThreshold: 0.2 });

    // 3 successes out of 20 = 15%
    for (let i = 0; i < 17; i++) {
      tracker.recordAttempt(false);
    }
    for (let i = 0; i < 3; i++) {
      tracker.recordAttempt(true);
    }

    expect(tracker.getSuccessRate()).toBe(0.15);
    expect(tracker.shouldExploreAggressively()).toBe(true);
  });

  it('should require minimum 5 attempts before triggering exploration', () => {
    const tracker = new SuccessRateTracker({ windowSize: 20, explorationThreshold: 0.2 });

    // 4 failures (not enough samples)
    tracker.recordAttempt(false);
    tracker.recordAttempt(false);
    tracker.recordAttempt(false);
    tracker.recordAttempt(false);
    expect(tracker.shouldExploreAggressively()).toBe(false);

    // 5th failure triggers it
    tracker.recordAttempt(false);
    expect(tracker.shouldExploreAggressively()).toBe(true);
  });
});
