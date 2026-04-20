import { describe, it, expect } from 'vitest';
import { AutonomyController, AUTONOMY_LEVELS } from '../../../src/agent/AutonomyController.js';

describe('AutonomyController', () => {
  describe('constructor defaults', () => {
    it('starts at assist level', () => {
      const ctrl = new AutonomyController();
      expect(ctrl.level).toBe('assist');
    });

    it('getConfig returns assist config by default', () => {
      const ctrl = new AutonomyController();
      const config = ctrl.getConfig();
      expect(config.level).toBe('assist');
      expect(config.label).toBe('Assist');
    });
  });

  describe('requiresReview', () => {
    it('assist level requires review for creative actions', () => {
      const ctrl = new AutonomyController();
      expect(ctrl.requiresReview('creative')).toBe(true);
    });

    it('assist level requires review for engineering actions', () => {
      const ctrl = new AutonomyController();
      expect(ctrl.requiresReview('engineering')).toBe(true);
    });

    it('co-create level auto-approves creative actions', () => {
      const ctrl = new AutonomyController();
      ctrl.setLevel('co-create');
      expect(ctrl.requiresReview('creative')).toBe(false);
    });

    it('co-create level requires review for engineering actions', () => {
      const ctrl = new AutonomyController();
      ctrl.setLevel('co-create');
      expect(ctrl.requiresReview('engineering')).toBe(true);
    });

    it('autopilot level auto-approves creative actions', () => {
      const ctrl = new AutonomyController();
      ctrl.setLevel('autopilot');
      expect(ctrl.requiresReview('creative')).toBe(false);
    });

    it('autopilot level auto-approves engineering actions', () => {
      const ctrl = new AutonomyController();
      ctrl.setLevel('autopilot');
      expect(ctrl.requiresReview('engineering')).toBe(false);
    });
  });

  describe('setLevel', () => {
    it('returns the config for a valid level', () => {
      const ctrl = new AutonomyController();
      const config = ctrl.setLevel('co-create');
      expect(config?.level).toBe('co-create');
      expect(config?.label).toBe('Co-Create');
    });

    it('returns undefined for an invalid level string', () => {
      const ctrl = new AutonomyController();
      expect(ctrl.setLevel('invalid')).toBeUndefined();
    });

    it('updates the default level when no session provided', () => {
      const ctrl = new AutonomyController();
      ctrl.setLevel('autopilot');
      expect(ctrl.level).toBe('autopilot');
    });

    it('scopes level to a specific session without changing default', () => {
      const ctrl = new AutonomyController();
      ctrl.setLevel('autopilot', 'session-1');
      expect(ctrl.level).toBe('assist');
      expect(ctrl.requiresReview('creative', 'session-1')).toBe(false);
      expect(ctrl.requiresReview('creative', 'session-2')).toBe(true);
    });

    it('falls back to default when session has no override', () => {
      const ctrl = new AutonomyController();
      ctrl.setLevel('co-create');
      expect(ctrl.requiresReview('creative', 'unknown-session')).toBe(false);
    });
  });

  describe('listLevels', () => {
    it('returns all three autonomy levels', () => {
      const ctrl = new AutonomyController();
      const levels = ctrl.listLevels();
      expect(levels).toHaveLength(3);
      expect(levels.map(l => l.level)).toEqual(['assist', 'co-create', 'autopilot']);
    });
  });

  describe('AUTONOMY_LEVELS constant', () => {
    it('has labels and descriptions for every level', () => {
      for (const [, config] of Object.entries(AUTONOMY_LEVELS)) {
        expect(config.label.length).toBeGreaterThan(0);
        expect(config.description.length).toBeGreaterThan(0);
      }
    });
  });
});
