import { describe, it, expect } from 'vitest';
import { AutonomyController, AUTONOMY_LEVELS } from '../../../src/agent/AutonomyController.js';

describe('AutonomyController', () => {
  it('starts at assist level', () => {
    const ctrl = new AutonomyController();
    expect(ctrl.level).toBe('assist');
  });

  it('returns correct config for current level', () => {
    const ctrl = new AutonomyController();
    const config = ctrl.getConfig();

    expect(config.level).toBe('assist');
    expect(config.label).toBe('Assist');
  });

  it('sets level to co-create', () => {
    const ctrl = new AutonomyController();
    const config = ctrl.setLevel('co-create');

    expect(config).toBeDefined();
    expect(config!.level).toBe('co-create');
    expect(ctrl.level).toBe('co-create');
  });

  it('sets level to autopilot', () => {
    const ctrl = new AutonomyController();
    const config = ctrl.setLevel('autopilot');

    expect(config).toBeDefined();
    expect(config!.level).toBe('autopilot');
    expect(ctrl.level).toBe('autopilot');
  });

  it('returns undefined for invalid level', () => {
    const ctrl = new AutonomyController();
    const config = ctrl.setLevel('invalid');

    expect(config).toBeUndefined();
    expect(ctrl.level).toBe('assist'); // unchanged
  });

  it('requiresReview: assist requires review for everything', () => {
    const ctrl = new AutonomyController();
    ctrl.setLevel('assist');

    expect(ctrl.requiresReview('creative')).toBe(true);
    expect(ctrl.requiresReview('engineering')).toBe(true);
  });

  it('requiresReview: co-create auto-approves creative, gates engineering', () => {
    const ctrl = new AutonomyController();
    ctrl.setLevel('co-create');

    expect(ctrl.requiresReview('creative')).toBe(false);
    expect(ctrl.requiresReview('engineering')).toBe(true);
  });

  it('requiresReview: autopilot auto-approves everything', () => {
    const ctrl = new AutonomyController();
    ctrl.setLevel('autopilot');

    expect(ctrl.requiresReview('creative')).toBe(false);
    expect(ctrl.requiresReview('engineering')).toBe(false);
  });

  it('lists all available levels', () => {
    const ctrl = new AutonomyController();
    const levels = ctrl.listLevels();

    expect(levels).toHaveLength(3);
    expect(levels.map(l => l.level)).toEqual(['assist', 'co-create', 'autopilot']);
  });

  it('AUTONOMY_LEVELS constant has correct structure', () => {
    expect(Object.keys(AUTONOMY_LEVELS)).toHaveLength(3);

    for (const [key, val] of Object.entries(AUTONOMY_LEVELS)) {
      expect(val.level).toBe(key);
      expect(val.label).toBeTruthy();
      expect(val.description).toBeTruthy();
    }
  });

  // Session-scoped autonomy tests
  it('stores autonomy level per session', () => {
    const ctrl = new AutonomyController();
    const config = ctrl.setLevel('autopilot', 'session-A');

    expect(config).toBeDefined();
    expect(config!.level).toBe('autopilot');
    // Default level unchanged
    expect(ctrl.level).toBe('assist');
    // Session A sees autopilot
    expect(ctrl.getConfig('session-A').level).toBe('autopilot');
    // Unknown session falls back to default
    expect(ctrl.getConfig('session-B').level).toBe('assist');
  });

  it('session-scoped requiresReview respects per-session level', () => {
    const ctrl = new AutonomyController();
    ctrl.setLevel('co-create', 'session-A');
    ctrl.setLevel('autopilot', 'session-B');

    // Session A: co-create — creative auto, engineering gated
    expect(ctrl.requiresReview('creative', 'session-A')).toBe(false);
    expect(ctrl.requiresReview('engineering', 'session-A')).toBe(true);

    // Session B: autopilot — everything auto
    expect(ctrl.requiresReview('creative', 'session-B')).toBe(false);
    expect(ctrl.requiresReview('engineering', 'session-B')).toBe(false);

    // Unknown session: default (assist) — everything gated
    expect(ctrl.requiresReview('creative', 'unknown')).toBe(true);
    expect(ctrl.requiresReview('engineering', 'unknown')).toBe(true);
  });

  it('isolates sessions from each other', () => {
    const ctrl = new AutonomyController();
    ctrl.setLevel('autopilot', 'session-A');
    ctrl.setLevel('assist', 'session-B');

    // Changing session A does not affect session B
    expect(ctrl.getConfig('session-A').level).toBe('autopilot');
    expect(ctrl.getConfig('session-B').level).toBe('assist');

    // Changing default does not affect sessions
    ctrl.setLevel('co-create');
    expect(ctrl.level).toBe('co-create');
    expect(ctrl.getConfig('session-A').level).toBe('autopilot');
    expect(ctrl.getConfig('session-B').level).toBe('assist');
  });
});
