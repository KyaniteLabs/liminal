import { describe, it, expect } from 'vitest';
import { StuckDetector } from '../../../src/cortex/StuckDetector.js';
import type { ActiveProcess } from '../../../src/cortex/types.js';

describe('StuckDetector', () => {
  const detector = new StuckDetector();

  function makeProcess(name: string, startedAt: string): ActiveProcess {
    return { name, startedAt };
  }

  describe('classifyProcess', () => {
    it('classifies leaf tasks', () => {
      expect(detector.classifyProcess('Generate particle system')).toBe('leaf');
      expect(detector.classifyProcess('Render GLSL shader')).toBe('leaf');
      expect(detector.classifyProcess('Task execution #42')).toBe('leaf');
    });

    it('classifies wiring tasks', () => {
      expect(detector.classifyProcess('Bridge connector')).toBe('wiring');
      expect(detector.classifyProcess('Wire modules')).toBe('wiring');
    });

    it('classifies harness-quality tasks', () => {
      expect(detector.classifyProcess('Harness evaluation')).toBe('harness-quality');
      expect(detector.classifyProcess('Quality gate check')).toBe('harness-quality');
      expect(detector.classifyProcess('Evaluate candidate')).toBe('harness-quality');
    });

    it('classifies orchestrator tasks', () => {
      expect(detector.classifyProcess('Orchestrator tick')).toBe('orchestrator');
      expect(detector.classifyProcess('RalphLoop cycle')).toBe('orchestrator');
      expect(detector.classifyProcess('Cortex supervisor')).toBe('orchestrator');
    });

    it('defaults to unknown', () => {
      expect(detector.classifyProcess('Mysterious process')).toBe('unknown');
    });
  });

  describe('detect', () => {
    it('returns empty for no processes', () => {
      expect(detector.detect([], '2026-04-16T12:00:00Z')).toEqual([]);
    });

    it('detects stuck leaf task past 2-minute threshold', () => {
      const processes = [
        makeProcess('Generate particles', '2026-04-16T11:57:00Z'),
      ];
      const stuck = detector.detect(processes, '2026-04-16T12:00:01Z');

      expect(stuck).toHaveLength(1);
      expect(stuck[0].processName).toBe('Generate particles');
      expect(stuck[0].thresholdMs).toBe(2 * 60 * 1000);
      expect(stuck[0].suggestedRecovery).toContain('leaf');
    });

    it('does not flag leaf task under threshold', () => {
      const processes = [
        makeProcess('Generate particles', '2026-04-16T11:59:00Z'),
      ];
      const stuck = detector.detect(processes, '2026-04-16T12:00:00Z');
      expect(stuck).toHaveLength(0);
    });

    it('detects stuck wiring task past 5-minute threshold', () => {
      const processes = [
        makeProcess('Bridge connection setup', '2026-04-16T11:54:00Z'),
      ];
      const stuck = detector.detect(processes, '2026-04-16T12:00:01Z');

      expect(stuck).toHaveLength(1);
      expect(stuck[0].thresholdMs).toBe(5 * 60 * 1000);
    });

    it('detects stuck harness-quality task past 10-minute threshold', () => {
      const processes = [
        makeProcess('Harness evaluation suite', '2026-04-16T11:49:00Z'),
      ];
      const stuck = detector.detect(processes, '2026-04-16T12:00:01Z');

      expect(stuck).toHaveLength(1);
      expect(stuck[0].thresholdMs).toBe(10 * 60 * 1000);
    });

    it('detects stuck orchestrator past 15-minute threshold', () => {
      const processes = [
        makeProcess('RalphLoop iteration', '2026-04-16T11:44:00Z'),
      ];
      const stuck = detector.detect(processes, '2026-04-16T12:00:01Z');

      expect(stuck).toHaveLength(1);
      expect(stuck[0].thresholdMs).toBe(15 * 60 * 1000);
    });

    it('detects multiple stuck processes simultaneously', () => {
      const processes = [
        makeProcess('Generate code', '2026-04-16T11:57:00Z'),      // leaf, 3m old
        makeProcess('Bridge connector', '2026-04-16T11:54:00Z'),   // wiring, 6m old
        makeProcess('Quick task', '2026-04-16T11:59:30Z'),         // leaf, 30s old — NOT stuck
      ];
      const stuck = detector.detect(processes, '2026-04-16T12:00:00Z');

      expect(stuck).toHaveLength(2);
      expect(stuck.map((s) => s.processName)).toEqual(
        expect.arrayContaining(['Generate code', 'Bridge connector']),
      );
    });

    it('skips processes with invalid dates', () => {
      const processes = [
        makeProcess('Bad date', 'not-a-date'),
      ];
      const stuck = detector.detect(processes, '2026-04-16T12:00:00Z');
      expect(stuck).toHaveLength(0);
    });

    it('includes recovery suggestions per class', () => {
      const processes = [
        makeProcess('Orchestrator loop', '2026-04-16T11:44:00Z'),
      ];
      const stuck = detector.detect(processes, '2026-04-16T12:00:01Z');
      expect(stuck[0].suggestedRecovery).toContain('Restart');
    });
  });
});
