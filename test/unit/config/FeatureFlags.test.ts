/**
 * FeatureFlags unit tests.
 * Covers env-based flag resolution, defaults, and cleanup.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEvalMode, getRepairMode, isRepairEnabled } from '../../../src/config/FeatureFlags.js';

describe('FeatureFlags', () => {
  const originalEvalMode = process.env.LIMINAL_EVAL_MODE;
  const originalRepairMode = process.env.LIMINAL_REPAIR_MODE;

  beforeEach(() => {
    // Clean env before each test
    delete process.env.LIMINAL_EVAL_MODE;
    delete process.env.LIMINAL_REPAIR_MODE;
  });

  afterEach(() => {
    // Restore original env state
    if (originalEvalMode !== undefined) {
      process.env.LIMINAL_EVAL_MODE = originalEvalMode;
    } else {
      delete process.env.LIMINAL_EVAL_MODE;
    }
    if (originalRepairMode !== undefined) {
      process.env.LIMINAL_REPAIR_MODE = originalRepairMode;
    } else {
      delete process.env.LIMINAL_REPAIR_MODE;
    }
  });

  // ---------------------------------------------------------------------------
  // getEvalMode
  // ---------------------------------------------------------------------------
  describe('getEvalMode', () => {
    it('returns "auto" by default when env var is not set', () => {
      expect(getEvalMode()).toBe('auto');
    });

    it('returns "legacy" when LIMINAL_EVAL_MODE=legacy', () => {
      process.env.LIMINAL_EVAL_MODE = 'legacy';
      expect(getEvalMode()).toBe('legacy');
    });

    it('returns "strict-browser" when LIMINAL_EVAL_MODE=strict-browser', () => {
      process.env.LIMINAL_EVAL_MODE = 'strict-browser';
      expect(getEvalMode()).toBe('strict-browser');
    });

    it('returns "auto" when LIMINAL_EVAL_MODE=auto', () => {
      process.env.LIMINAL_EVAL_MODE = 'auto';
      expect(getEvalMode()).toBe('auto');
    });
  });

  // ---------------------------------------------------------------------------
  // getRepairMode
  // ---------------------------------------------------------------------------
  describe('getRepairMode', () => {
    it('returns "off" by default when env var is not set', () => {
      expect(getRepairMode()).toBe('off');
    });

    it('returns "single-round" when LIMINAL_REPAIR_MODE=single-round', () => {
      process.env.LIMINAL_REPAIR_MODE = 'single-round';
      expect(getRepairMode()).toBe('single-round');
    });

    it('returns "off" when LIMINAL_REPAIR_MODE=off', () => {
      process.env.LIMINAL_REPAIR_MODE = 'off';
      expect(getRepairMode()).toBe('off');
    });
  });

  // ---------------------------------------------------------------------------
  // isRepairEnabled
  // ---------------------------------------------------------------------------
  describe('isRepairEnabled', () => {
    it('returns false by default (repair mode is off)', () => {
      expect(isRepairEnabled()).toBe(false);
    });

    it('returns true when repair mode is single-round', () => {
      process.env.LIMINAL_REPAIR_MODE = 'single-round';
      expect(isRepairEnabled()).toBe(true);
    });

    it('returns false when repair mode is off', () => {
      process.env.LIMINAL_REPAIR_MODE = 'off';
      expect(isRepairEnabled()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Env isolation
  // ---------------------------------------------------------------------------
  describe('env isolation between tests', () => {
    it('test A: sets repair mode to single-round', () => {
      process.env.LIMINAL_REPAIR_MODE = 'single-round';
      expect(isRepairEnabled()).toBe(true);
    });

    it('test B: should NOT see the repair mode from test A', () => {
      // process.env was cleaned in beforeEach
      expect(isRepairEnabled()).toBe(false);
    });
  });
});
