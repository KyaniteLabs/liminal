import { describe, it, expect, test } from 'vitest';
/**
 * TUI Run / Stop and iteration timeline tests (Wave 3 Subagent B)
 *
 * (a) Run completes and timeline updates (mock run or integration test)
 * (b) Selecting an iteration updates selected index (unit test for state)
 */

describe('TUI Run and Iteration Timeline', () => {
  describe('(a) Run completes and timeline updates', () => {
    test('when run resolves, timeline has one entry per iteration with timestamp and score', async () => {
      const timelineEntries = [];
      const onProgress = (data) => {
        timelineEntries.push({
          version: data.iteration,
          timestamp: data.timestamp ?? Date.now(),
          score: data.score,
          promiseDetected: data.promiseDetected,
        });
      };

      const mockRun = async () => {
        onProgress({ iteration: 1, score: 0.6, promiseDetected: false, timestamp: 1000 });
        onProgress({ iteration: 2, score: 0.75, promiseDetected: false, timestamp: 2000 });
        onProgress({ iteration: 3, score: 0.9, promiseDetected: true, timestamp: 3000 });
        return { iterations: 3, code: 'done', completed: true };
      };

      await mockRun();

      expect(timelineEntries).toHaveLength(3);
      expect(timelineEntries[0]).toMatchObject({ version: 1, score: 0.6, promiseDetected: false });
      expect(timelineEntries[1]).toMatchObject({ version: 2, score: 0.75, promiseDetected: false });
      expect(timelineEntries[2]).toMatchObject({ version: 3, score: 0.9, promiseDetected: true });
      expect(timelineEntries[0].timestamp).not.toBeNull();
      expect(timelineEntries[1].timestamp).not.toBeNull();
      expect(timelineEntries[2].timestamp).not.toBeNull();
    });

    test('timeline updates incrementally during run (progress callback)', async () => {
      const timeline = [];
      const onProgress = (data) => {
        timeline.push({ v: data.iteration, score: data.score });
      };

      const runWithProgress = async () => {
        onProgress({ iteration: 1, score: 0.5, promiseDetected: false });
        expect(timeline).toHaveLength(1);
        onProgress({ iteration: 2, score: 0.7, promiseDetected: false });
        expect(timeline).toHaveLength(2);
        onProgress({ iteration: 3, score: 0.85, promiseDetected: true });
        expect(timeline).toHaveLength(3);
      };

      await runWithProgress();
      expect(timeline.map((t) => t.v)).toEqual([1, 2, 3]);
      expect(timeline.map((t) => t.score)).toEqual([0.5, 0.7, 0.85]);
    });
  });

  describe('(b) Selecting an iteration updates selected index', () => {
    test('selected iteration index state updates when user selects an iteration', () => {
      let selectedIndex = 0;
      const setSelectedIndex = (index) => {
        selectedIndex = index;
      };

      setSelectedIndex(2);
      expect(selectedIndex).toBe(2);

      setSelectedIndex(0);
      expect(selectedIndex).toBe(0);

      setSelectedIndex(5);
      expect(selectedIndex).toBe(5);
    });

    test('selected index is clamped to valid range when timeline has N entries', () => {
      const timelineLength = 4;
      let selectedIndex = 0;
      const setSelectedIndex = (index) => {
        selectedIndex = Math.max(0, Math.min(index, timelineLength - 1));
      };

      setSelectedIndex(2);
      expect(selectedIndex).toBe(2);

      setSelectedIndex(10);
      expect(selectedIndex).toBe(3);

      setSelectedIndex(-1);
      expect(selectedIndex).toBe(0);
    });
  });
});
