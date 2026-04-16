/**
 * ModeRegistry tests — per-session mode storage and event emission
 */
import { describe, it, expect, vi } from 'vitest';
import { ModeRegistry } from '../../../src/agent/ModeRegistry.js';

describe('ModeRegistry', () => {
  describe('getMode()', () => {
    it('returns undefined for unknown session', () => {
      const registry = new ModeRegistry();
      expect(registry.getMode('unknown')).toBeUndefined();
    });
  });

  describe('setMode()', () => {
    it('stores and retrieves mode config', () => {
      const registry = new ModeRegistry();
      const config = registry.setMode('sess-1', 'make');
      expect(config.mode).toBe('make');
      expect(registry.getMode('sess-1')?.mode).toBe('make');
    });

    it('stores profile and autonomy', () => {
      const registry = new ModeRegistry();
      const config = registry.setMode('sess-1', 'make', 'creative', 'co-create');
      expect(config.profile).toBe('creative');
      expect(config.autonomy).toBe('co-create');
    });

    it('fires onModeChange callback when mode changes', () => {
      const onModeChange = vi.fn();
      const registry = new ModeRegistry({ onModeChange });
      registry.setMode('sess-1', 'make');
      expect(onModeChange).toHaveBeenCalledWith('sess-1', expect.objectContaining({ mode: 'make' }));
    });

    it('does not fire callback when same mode is set again', () => {
      const onModeChange = vi.fn();
      const registry = new ModeRegistry({ onModeChange });
      registry.setMode('sess-1', 'make');
      expect(onModeChange).toHaveBeenCalledTimes(1);
      registry.setMode('sess-1', 'make');
      expect(onModeChange).toHaveBeenCalledTimes(1);
    });

    it('fires callback when mode changes from make to ask', () => {
      const onModeChange = vi.fn();
      const registry = new ModeRegistry({ onModeChange });
      registry.setMode('sess-1', 'make');
      registry.setMode('sess-1', 'ask');
      expect(onModeChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('clear()', () => {
    it('removes mode for a session', () => {
      const registry = new ModeRegistry();
      registry.setMode('sess-1', 'make');
      expect(registry.getMode('sess-1')).toBeDefined();
      registry.clear('sess-1');
      expect(registry.getMode('sess-1')).toBeUndefined();
    });

    it('does not affect other sessions', () => {
      const registry = new ModeRegistry();
      registry.setMode('sess-1', 'make');
      registry.setMode('sess-2', 'ask');
      registry.clear('sess-1');
      expect(registry.getMode('sess-1')).toBeUndefined();
      expect(registry.getMode('sess-2')?.mode).toBe('ask');
    });
  });

  describe('activeSessions()', () => {
    it('lists sessions with active modes', () => {
      const registry = new ModeRegistry();
      expect(registry.activeSessions()).toEqual([]);
      registry.setMode('sess-1', 'make');
      registry.setMode('sess-2', 'ask');
      expect(registry.activeSessions()).toEqual(['sess-1', 'sess-2']);
    });

    it('removes cleared sessions', () => {
      const registry = new ModeRegistry();
      registry.setMode('sess-1', 'make');
      registry.clear('sess-1');
      expect(registry.activeSessions()).toEqual([]);
    });
  });

  describe('isolation', () => {
    it('different sessions have independent modes', () => {
      const registry = new ModeRegistry();
      registry.setMode('sess-1', 'make');
      registry.setMode('sess-2', 'ask');
      expect(registry.getMode('sess-1')?.mode).toBe('make');
      expect(registry.getMode('sess-2')?.mode).toBe('ask');
    });
  });
});
