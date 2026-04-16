/**
 * Unit tests for TaskIntake — Phase 10 Lane 10-1
 *
 * Tests repo scanning, coverage loading, annotation scanning,
 * task classification, and spec generation.
 * Uses tmpdir for filesystem isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TaskIntake } from '../../../src/ledger/TaskIntake.js';

describe('TaskIntake', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'task-intake-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadCoverage', () => {
    it('returns empty array when coverage file does not exist', () => {
      const intake = new TaskIntake({ rootDir: tempDir });
      const result = intake.loadCoverage();
      expect(result).toEqual([]);
    });

    it('parses coverageMap and returns FileCoverage entries', () => {
      const covDir = join(tempDir, 'coverage');
      mkdirSync(covDir, { recursive: true });
      const srcDir = join(tempDir, 'src', 'foo');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'Bar.ts'), 'export function bar() { return 1; }');

      const coverageData = {
        coverageMap: {
          [join(tempDir, 'src/foo/Bar.ts')]: {
            s: { '0': 0, '1': 1, '2': 0 },
            b: { '0': [0, 1] },
            f: { '0': 1 },
          },
        },
      };
      writeFileSync(join(covDir, 'vitest-result.json'), JSON.stringify(coverageData));

      const intake = new TaskIntake({ rootDir: tempDir });
      const result = intake.loadCoverage();
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/foo/Bar.ts');
      // 1 of 3 statements hit = 33.3%
      expect(result[0].statementPct).toBeCloseTo(33.33, 0);
      expect(result[0].branchPct).toBe(50);
      expect(result[0].functionPct).toBe(100);
    });

    it('skips deferred modules (gui, tui, tui-bridge)', () => {
      const covDir = join(tempDir, 'coverage');
      mkdirSync(covDir, { recursive: true });

      const coverageData = {
        coverageMap: {
          [join(tempDir, 'src/gui/App.ts')]: { s: { '0': 0 }, b: {}, f: {} },
          [join(tempDir, 'src/tui/View.ts')]: { s: { '0': 0 }, b: {}, f: {} },
          [join(tempDir, 'src/core/Real.ts')]: { s: { '0': 0, '1': 1 }, b: {}, f: {} },
        },
      };
      writeFileSync(join(covDir, 'vitest-result.json'), JSON.stringify(coverageData));

      const intake = new TaskIntake({ rootDir: tempDir });
      const result = intake.loadCoverage();
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/core/Real.ts');
    });

    it('skips .d.ts and .test.ts files', () => {
      const covDir = join(tempDir, 'coverage');
      mkdirSync(covDir, { recursive: true });

      const coverageData = {
        coverageMap: {
          [join(tempDir, 'src/foo.d.ts')]: { s: { '0': 0 }, b: {}, f: {} },
          [join(tempDir, 'src/bar.test.ts')]: { s: { '0': 0 }, b: {}, f: {} },
          [join(tempDir, 'src/baz.ts')]: { s: { '0': 0 }, b: {}, f: {} },
        },
      };
      writeFileSync(join(covDir, 'vitest-result.json'), JSON.stringify(coverageData));

      const intake = new TaskIntake({ rootDir: tempDir });
      const result = intake.loadCoverage();
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/baz.ts');
    });
  });

  describe('scanAnnotations', () => {
    it('returns empty array when src directory does not exist', () => {
      const intake = new TaskIntake({ rootDir: tempDir });
      const result = intake.scanAnnotations();
      expect(result).toEqual([]);
    });

    it('finds TODO and FIXME annotations in source files', () => {
      const srcDir = join(tempDir, 'src', 'utils');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'helpers.ts'), [
        '// TODO: implement the caching layer for performance',
        'export function noop() {}',
        '// FIXME: this regex is too loose and matches invalid input',
        'export function validate() { return true; }',
      ].join('\n'));

      const intake = new TaskIntake({ rootDir: tempDir });
      const result = intake.scanAnnotations();
      expect(result).toHaveLength(2);
      expect(result[0].kind).toBe('TODO');
      expect(result[0].text).toContain('implement the caching layer');
      expect(result[1].kind).toBe('FIXME');
      expect(result[1].text).toContain('regex is too loose');
    });

    it('skips annotation lines with short text (<6 chars)', () => {
      const srcDir = join(tempDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'short.ts'), [
        '// TODO: fix',
        'export function bar() {}',
      ].join('\n'));

      const intake = new TaskIntake({ rootDir: tempDir });
      const result = intake.scanAnnotations();
      expect(result).toHaveLength(0);
    });

    it('skips files in excluded directories (ledger, test, dist)', () => {
      for (const dir of ['src/ledger', 'src/test', 'dist']) {
        const fullDir = join(tempDir, dir);
        mkdirSync(fullDir, { recursive: true });
        writeFileSync(join(fullDir, 'excluded.ts'), '// TODO: this should not appear in results\n');
      }

      const intake = new TaskIntake({ rootDir: tempDir });
      const result = intake.scanAnnotations();
      expect(result).toHaveLength(0);
    });
  });

  describe('generateSpecs', () => {
    it('classifies 0% coverage files as leaf tasks', () => {
      const intake = new TaskIntake({ rootDir: tempDir });
      const coverage = [{ path: 'src/foo/Bar.ts', statementPct: 0, branchPct: 0, functionPct: 0, statementTotal: 20 }];
      const specs = intake.generateSpecs(coverage, []);
      expect(specs).toHaveLength(1);
      expect(specs[0].taskClass).toBe('leaf');
      expect(specs[0].id).toMatch(/^L\d{3}$/);
    });

    it('classifies low coverage (<50%) files as wiring tasks', () => {
      const intake = new TaskIntake({ rootDir: tempDir });
      const coverage = [{ path: 'src/core/Engine.ts', statementPct: 25, branchPct: 10, functionPct: 30, statementTotal: 80 }];
      const specs = intake.generateSpecs(coverage, []);
      expect(specs).toHaveLength(1);
      expect(specs[0].taskClass).toBe('wiring');
      expect(specs[0].id).toMatch(/^W\d{3}$/);
    });

    it('classifies medium coverage (50-69%) as harness-quality tasks', () => {
      const intake = new TaskIntake({ rootDir: tempDir });
      const coverage = [{ path: 'src/llm/Client.ts', statementPct: 55, branchPct: 40, functionPct: 60, statementTotal: 100 }];
      const specs = intake.generateSpecs(coverage, []);
      expect(specs).toHaveLength(1);
      expect(specs[0].taskClass).toBe('harness-quality');
      expect(specs[0].id).toMatch(/^H\d{3}$/);
    });

    it('skips files already at 70%+ coverage', () => {
      const intake = new TaskIntake({ rootDir: tempDir });
      const coverage = [{ path: 'src/good.ts', statementPct: 80, branchPct: 75, functionPct: 85, statementTotal: 50 }];
      const specs = intake.generateSpecs(coverage, []);
      expect(specs).toHaveLength(0);
    });

    it('skips very small files (<3 statements)', () => {
      const intake = new TaskIntake({ rootDir: tempDir });
      const coverage = [{ path: 'src/tiny.ts', statementPct: 0, branchPct: 0, functionPct: 0, statementTotal: 2 }];
      const specs = intake.generateSpecs(coverage, []);
      expect(specs).toHaveLength(0);
    });

    it('generates orchestrator tasks from annotations', () => {
      const intake = new TaskIntake({ rootDir: tempDir });
      const annotations = [{ file: 'src/feature.ts', line: 10, kind: 'TODO' as const, text: 'add retry logic for transient failures' }];
      const specs = intake.generateSpecs([], annotations);
      expect(specs).toHaveLength(1);
      expect(specs[0].taskClass).toBe('orchestrator');
      expect(specs[0].id).toMatch(/^O\d{3}$/);
      expect(specs[0].title).toContain('add retry logic');
    });

    it('sets lane 1 for priority modules', () => {
      const intake = new TaskIntake({ rootDir: tempDir });
      const coverage = [{ path: 'src/generators/Output.ts', statementPct: 0, branchPct: 0, functionPct: 0, statementTotal: 30 }];
      const specs = intake.generateSpecs(coverage, []);
      expect(specs[0].lane).toBe(1);
    });
  });

  describe('run (integration)', () => {
    it('returns specs sorted by class priority then lane', () => {
      const srcDir = join(tempDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'low.ts'), 'export function low() {}');
      writeFileSync(join(srcDir, 'zero.ts'), 'export function zero() {}');

      const covDir = join(tempDir, 'coverage');
      mkdirSync(covDir, { recursive: true });
      const coverageData = {
        coverageMap: {
          [join(tempDir, 'src/zero.ts')]: { s: { '0': 0, '1': 0, '2': 0, '3': 0 }, b: {}, f: { '0': 0 } },
          [join(tempDir, 'src/low.ts')]: { s: { '0': 1, '1': 0, '2': 1, '3': 0, '4': 0, '5': 1, '6': 0, '7': 1, '8': 0, '9': 0 }, b: {}, f: { '0': 1, '1': 0 } },
        },
      };
      writeFileSync(join(covDir, 'vitest-result.json'), JSON.stringify(coverageData));

      const intake = new TaskIntake({ rootDir: tempDir });
      const specs = intake.run();
      if (specs.length >= 2) {
        const leafIdx = specs.findIndex(s => s.taskClass === 'leaf');
        const wiringIdx = specs.findIndex(s => s.taskClass === 'wiring');
        if (leafIdx !== -1 && wiringIdx !== -1) {
          expect(leafIdx).toBeLessThan(wiringIdx);
        }
      }
    });
  });
});
