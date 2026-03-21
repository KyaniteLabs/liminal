import { describe, it, expect, beforeEach } from 'vitest';
import { ContextAccumulation } from '../../src/core/ContextAccumulation.js';

describe('ContextAccumulation', () => {
  beforeEach(() => {
    ContextAccumulation.clear();
  });

  describe('save(state)', () => {
    it('should save state to history', () => {
      const state = { iteration: 1, output: 'test output' };
      ContextAccumulation.save(state);
      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(state);
    });

    it('should save multiple states in sequence', () => {
      const state1 = { iteration: 1, output: 'first' };
      const state2 = { iteration: 2, output: 'second' };
      const state3 = { iteration: 3, output: 'third' };

      ContextAccumulation.save(state1);
      ContextAccumulation.save(state2);
      ContextAccumulation.save(state3);

      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0]).toEqual(state1);
      expect(history[1]).toEqual(state2);
      expect(history[2]).toEqual(state3);
    });

    it('should preserve state between operations', () => {
      const state1 = { iteration: 1, data: 'initial' };
      ContextAccumulation.save(state1);

      const loaded = ContextAccumulation.load();
      expect(loaded).toEqual(state1);

      const state2 = { iteration: 2, data: 'next' };
      ContextAccumulation.save(state2);

      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(state1);
      expect(history[1]).toEqual(state2);
    });

    it('should handle complex state objects', () => {
      const complexState = {
        iteration: 5,
        output: 'function test() { return true; }',
        metadata: {
          timestamp: Date.now(),
          quality: 0.85,
          tags: ['generative', 'art', 'p5']
        },
        nested: {
          deep: {
            value: [1, 2, 3]
          }
        }
      };

      ContextAccumulation.save(complexState);
      const history = ContextAccumulation.getHistory();
      expect(history[0]).toEqual(complexState);
    });

    it('should handle null and undefined values in state', () => {
      const stateWithNulls = {
        iteration: 1,
        output: null,
        error: undefined,
        data: 'valid'
      };

      ContextAccumulation.save(stateWithNulls);
      const history = ContextAccumulation.getHistory();
      expect(history[0]).toEqual(stateWithNulls);
    });

    it('should add state to end of history (not replace)', () => {
      const state1 = { iteration: 1, value: 'a' };
      const state2 = { iteration: 2, value: 'b' };

      ContextAccumulation.save(state1);
      ContextAccumulation.save(state2);

      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].value).toBe('a');
      expect(history[1].value).toBe('b');
    });

    it('should handle empty state objects', () => {
      const emptyState = {};
      ContextAccumulation.save(emptyState);
      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(emptyState);
    });

    it('should handle very large state objects', () => {
      const largeState = {
        iteration: 1,
        data: 'x'.repeat(100000), // 100KB string
        array: Array(1000).fill({ nested: 'value' })
      };

      ContextAccumulation.save(largeState);
      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].data).toHaveLength(100000);
      expect(history[0].array).toHaveLength(1000);
    });
  });

  describe('load()', () => {
    it('should return null when no state saved', () => {
      const loaded = ContextAccumulation.load();
      expect(loaded).toBeNull();
    });

    it('should return most recent state', () => {
      const state1 = { iteration: 1, output: 'first' };
      const state2 = { iteration: 2, output: 'second' };

      ContextAccumulation.save(state1);
      ContextAccumulation.save(state2);

      const loaded = ContextAccumulation.load();
      expect(loaded).toEqual(state2);
    });

    it('should return independent copy (not reference)', () => {
      const originalState = { iteration: 1, data: 'test' };
      ContextAccumulation.save(originalState);

      const loaded = ContextAccumulation.load();
      loaded.data = 'modified';

      const history = ContextAccumulation.getHistory();
      expect(history[0].data).toBe('test');
    });

    it('should persist state across multiple load calls', () => {
      const state = { iteration: 1, value: 42 };
      ContextAccumulation.save(state);

      const load1 = ContextAccumulation.load();
      const load2 = ContextAccumulation.load();
      const load3 = ContextAccumulation.load();

      expect(load1).toEqual(state);
      expect(load2).toEqual(state);
      expect(load3).toEqual(state);
    });

    it('should load state correctly after multiple saves', () => {
      ContextAccumulation.save({ iteration: 1, status: 'pending' });
      expect(ContextAccumulation.load().status).toBe('pending');

      ContextAccumulation.save({ iteration: 2, status: 'complete' });
      expect(ContextAccumulation.load().status).toBe('complete');

      ContextAccumulation.save({ iteration: 3, status: 'error' });
      expect(ContextAccumulation.load().status).toBe('error');
    });
  });

  describe('getHistory()', () => {
    it('should return empty array initially', () => {
      const history = ContextAccumulation.getHistory();
      expect(history).toEqual([]);
      expect(history).toHaveLength(0);
    });

    it('should return all saved states in order', () => {
      const states = [
        { iteration: 1, value: 'a' },
        { iteration: 2, value: 'b' },
        { iteration: 3, value: 'c' }
      ];

      states.forEach(state => ContextAccumulation.save(state));

      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].value).toBe('a');
      expect(history[1].value).toBe('b');
      expect(history[2].value).toBe('c');
    });

    it('should return copy of history array (not reference)', () => {
      ContextAccumulation.save({ iteration: 1, data: 'original' });

      const history1 = ContextAccumulation.getHistory();
      const history2 = ContextAccumulation.getHistory();

      // Mutating the returned array (push/splice) must not affect other calls
      history1.push({ iteration: 2, data: 'modified' });

      expect(history2).toHaveLength(1);
      expect(history2[0].data).toBe('original');
    });

    it('should maintain history after load operations', () => {
      ContextAccumulation.save({ iteration: 1, step: 'start' });
      ContextAccumulation.save({ iteration: 2, step: 'middle' });

      ContextAccumulation.load();

      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].step).toBe('start');
      expect(history[1].step).toBe('middle');
    });

    it('should build complete history across iterations', () => {
      const iterations = 10;
      for (let i = 1; i <= iterations; i++) {
        ContextAccumulation.save({
          iteration: i,
          timestamp: Date.now() + i * 1000,
          output: `Iteration ${i} output`
        });
      }

      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(iterations);

      for (let i = 0; i < iterations; i++) {
        expect(history[i].iteration).toBe(i + 1);
        expect(history[i].output).toContain(`Iteration ${i + 1}`);
      }
    });
  });

  describe('Truncation Strategy', () => {
    it('should truncate history when exceeding max size', () => {
      const maxSize = 50;

      for (let i = 1; i <= 100; i++) {
        ContextAccumulation.save({ iteration: i, value: `item${i}` });
      }

      const history = ContextAccumulation.getHistory();
      expect(history.length).toBeLessThanOrEqual(maxSize);
    });

    it('should keep most recent entries when truncating', () => {
      const maxHistorySize = 50;

      for (let i = 1; i <= 70; i++) {
        ContextAccumulation.save({ iteration: i, value: `item${i}` });
      }

      const history = ContextAccumulation.getHistory();
      expect(history.length).toBeLessThanOrEqual(maxHistorySize);

      const lastIteration = history[history.length - 1].iteration;
      expect(lastIteration).toBe(70);
    });

    it('should handle truncation with very large history', () => {
      const iterations = 1000;

      for (let i = 1; i <= iterations; i++) {
        ContextAccumulation.save({ iteration: i, data: `x`.repeat(100) });
      }

      const history = ContextAccumulation.getHistory();
      expect(history.length).toBeLessThan(iterations);
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should preserve data integrity after truncation', () => {
      for (let i = 1; i <= 60; i++) {
        ContextAccumulation.save({
          iteration: i,
          checksum: i * 12345,
          data: `iteration-${i}`
        });
      }

      const history = ContextAccumulation.getHistory();

      history.forEach((entry, index) => {
        const expectedIteration = history.length - 60 + index + 1;
        if (expectedIteration > 0) {
          expect(entry.iteration).toBeGreaterThanOrEqual(expectedIteration);
        }
      });
    });

    it('should not truncate when under max size', () => {
      for (let i = 1; i <= 10; i++) {
        ContextAccumulation.save({ iteration: i, value: `item${i}` });
      }

      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(10);
    });

    it('should load correct state after truncation', () => {
      for (let i = 1; i <= 70; i++) {
        ContextAccumulation.save({ iteration: i, status: i === 70 ? 'final' : 'pending' });
      }

      const loaded = ContextAccumulation.load();
      expect(loaded.iteration).toBe(70);
      expect(loaded.status).toBe('final');
    });
  });

  describe('clear()', () => {
    it('should clear all history', () => {
      ContextAccumulation.save({ iteration: 1, data: 'test1' });
      ContextAccumulation.save({ iteration: 2, data: 'test2' });
      expect(ContextAccumulation.getHistory()).toHaveLength(2);

      ContextAccumulation.clear();

      expect(ContextAccumulation.getHistory()).toEqual([]);
      expect(ContextAccumulation.load()).toBeNull();
    });

    it('should allow fresh start after clear', () => {
      ContextAccumulation.save({ iteration: 1, data: 'old' });
      ContextAccumulation.clear();

      ContextAccumulation.save({ iteration: 1, data: 'new' });

      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].data).toBe('new');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-object state gracefully', () => {
      ContextAccumulation.save(null);
      ContextAccumulation.save(undefined);
      ContextAccumulation.save('string');
      ContextAccumulation.save(123);

      const history = ContextAccumulation.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should handle circular references in state', () => {
      const circular = { iteration: 1 };
      circular.self = circular;

      ContextAccumulation.save(circular);

      const history = ContextAccumulation.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should handle rapid successive saves', () => {
      const saveCount = 100;
      for (let i = 0; i < saveCount; i++) {
        ContextAccumulation.save({ iteration: i, time: Date.now() });
      }

      const history = ContextAccumulation.getHistory();
      expect(history.length).toBeLessThanOrEqual(saveCount);
    });

    it('should handle state with special characters', () => {
      const specialState = {
        iteration: 1,
        unicode: '你好世界 🌍',
        emoji: '🎨🖌️✨',
        newlines: 'line1\nline2\nline3',
        quotes: '"quoted" and \'single\''
      };

      ContextAccumulation.save(specialState);
      const loaded = ContextAccumulation.load();
      expect(loaded.unicode).toBe(specialState.unicode);
      expect(loaded.emoji).toBe(specialState.emoji);
    });

    it('should handle empty and whitespace strings', () => {
      ContextAccumulation.save({ iteration: 1, empty: '', whitespace: '   ' });
      const loaded = ContextAccumulation.load();
      expect(loaded.empty).toBe('');
      expect(loaded.whitespace).toBe('   ');
    });
  });

  describe('Integration with Ralph-Wiggum Loop', () => {
    it('should simulate typical iteration workflow', () => {
      const iterations = [
        { iteration: 1, output: 'Initial sketch', quality: 0.3 },
        { iteration: 2, output: 'Added particles', quality: 0.5 },
        { iteration: 3, output: 'Improved colors', quality: 0.7 },
        { iteration: 4, output: 'Final version', quality: 0.9 }
      ];

      iterations.forEach(state => ContextAccumulation.save(state));

      const history = ContextAccumulation.getHistory();
      expect(history).toHaveLength(4);

      const latest = ContextAccumulation.load();
      expect(latest.quality).toBe(0.9);
      expect(latest.output).toContain('Final');
    });

    it('should track quality improvement across iterations', () => {
      const qualities = [0.2, 0.35, 0.5, 0.65, 0.8, 0.9];

      qualities.forEach((quality, index) => {
        ContextAccumulation.save({
          iteration: index + 1,
          quality: quality,
          improved: quality > (index > 0 ? qualities[index - 1] : 0)
        });
      });

      const history = ContextAccumulation.getHistory();

      for (let i = 1; i < history.length; i++) {
        expect(history[i].quality).toBeGreaterThan(history[i - 1].quality);
      }
    });
  });
});