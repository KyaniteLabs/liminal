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
});
