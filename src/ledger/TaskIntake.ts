/**
 * Phase 10 Lane 10-1: Task Intake and Triage
 *
 * Scans the repo for candidate tasks from:
 *   1. Zero-coverage files (leaf tasks — write new tests)
 *   2. Low-coverage files (wiring tasks — improve tests)
 *   3. Medium-coverage files (harness-quality — push to target)
 *   4. TODOs/FIXMEs in source (orchestrator — implement features)
 *
 * Generates bounded TaskManifest specs and writes them to corpus JSON.
 * Each spec has a clear file allowlist, verify command, and scoring criteria.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import type { TaskManifest, TaskClass, FileCoverage, SourceAnnotation } from './types.js';

// ─── Configuration ──────────────────────────────────────────────────

/** Modules deferred from task generation (GUI/TUI — per check-coverage-gaps.ts) */
const DEFERRED_MODULES = ['src/gui/', 'src/tui/', 'src/tui-bridge/', 'src/chat/'];

/** Directories excluded from annotation scanning (contains regex patterns that false-positive) */
const ANNOTATION_EXCLUDE_DIRS = ['src/ledger/', 'src/test/', 'test/', 'dist/', 'node_modules/'];

/** Priority modules from CLAUDE.md */
const PRIORITY_MODULES = ['src/generators/', 'src/config/', 'src/music/', 'src/plugins/'];

/** Task ID prefix per class */
const CLASS_PREFIX: Record<TaskClass, string> = {
  leaf: 'L',
  wiring: 'W',
  'harness-quality': 'H',
  orchestrator: 'O',
};

/** Statement count threshold for leaf classification */
const LEAF_MAX_STMTS = 50;

// ─── TaskIntake ─────────────────────────────────────────────────────

export interface TaskIntakeOptions {
  /** Path to vitest JSON result with coverageMap (default: coverage/vitest-result.json) */
  coveragePath?: string;
  /** Root directory for source scanning (default: cwd) */
  rootDir?: string;
  /** Minimum tasks to generate before warning (default: 20) */
  minTasks?: number;
}

export class TaskIntake {
  private rootDir: string;

  constructor(private options: TaskIntakeOptions = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
  }

  // ─── Public API ─────────────────────────────────────────────────

  /** Run the full intake pipeline: coverage + annotations → task specs */
  run(): TaskManifest[] {
    const coverage = this.loadCoverage();
    const annotations = this.scanAnnotations();
    const specs = this.generateSpecs(coverage, annotations);

    // Sort by class priority, then by coverage gap (largest gap first)
    const classOrder: Record<TaskClass, number> = { leaf: 0, wiring: 1, 'harness-quality': 2, orchestrator: 3 };
    specs.sort((a, b) => {
      const classDiff = classOrder[a.taskClass] - classOrder[b.taskClass];
      if (classDiff !== 0) return classDiff;
      return a.lane - b.lane;
    });

    return specs;
  }

  /** Load coverage data from vitest JSON result file */
  loadCoverage(): FileCoverage[] {
    const coveragePath = resolve(this.rootDir, this.options.coveragePath ?? 'coverage/vitest-result.json');
    if (!existsSync(coveragePath)) {
      console.warn(`  WARN: Coverage file not found at ${coveragePath}. Run 'pnpm vitest run --coverage --reporter=json --outputFile=coverage/vitest-result.json' first.`);
      return [];
    }

    const data = JSON.parse(readFileSync(coveragePath, 'utf-8'));
    const covMap = data.coverageMap as Record<string, { s: Record<string, number>; b: Record<string, number[]>; f: Record<string, number> }>;
    if (!covMap) return [];

    const results: FileCoverage[] = [];
    for (const [absPath, fileCov] of Object.entries(covMap)) {
      const relPath = relative(this.rootDir, absPath);
      if (!relPath.startsWith('src/')) continue;
      if (relPath.endsWith('.d.ts') || relPath.endsWith('.test.ts') || relPath.endsWith('.test.js')) continue;
      if (DEFERRED_MODULES.some(d => relPath.startsWith(d))) continue;

      const stmts = Object.values(fileCov.s);
      const branches = Object.values(fileCov.b).flat();
      const fns = Object.values(fileCov.f);

      results.push({
        path: relPath,
        statementPct: stmts.length ? (stmts.filter(v => v > 0).length / stmts.length * 100) : 100,
        branchPct: branches.length ? (branches.filter(v => v > 0).length / branches.length * 100) : 100,
        functionPct: fns.length ? (fns.filter(v => v > 0).length / fns.length * 100) : 100,
        statementTotal: stmts.length,
      });
    }

    return results.sort((a, b) => a.statementPct - b.statementPct);
  }

  /** Scan source files for TODO/FIXME/HACK annotations */
  scanAnnotations(): SourceAnnotation[] {
    const results: SourceAnnotation[] = [];
    const srcDir = join(this.rootDir, 'src');
    if (!existsSync(srcDir)) return results;

    const files = this.collectTsFiles(srcDir, ANNOTATION_EXCLUDE_DIRS);
    const annotationRe = /\b(TODO|FIXME|HACK)\b[:\s]+(.+)/;

    for (const file of files) {
      const relPath = relative(this.rootDir, file);
      const lines = readFileSync(file, 'utf-8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        // Skip lines that are string literals containing the regex pattern itself
        const trimmed = lines[i].trim();
        if (trimmed.startsWith("'") || trimmed.startsWith('"') || trimmed.startsWith('`')) continue;
        if (trimmed.includes('RegExp') || trimmed.includes('annotationRe') || trimmed.includes('TODO') && trimmed.includes('FIXME') && trimmed.includes('HACK') && trimmed.includes('|')) continue;
        const match = lines[i].match(annotationRe);
        if (match && match[2].trim().length > 5) {
          results.push({
            file: relPath,
            line: i + 1,
            kind: match[1] as 'TODO' | 'FIXME' | 'HACK',
            text: match[2].trim().slice(0, 120),
          });
        }
      }
    }

    return results;
  }

  /** Generate task specs from coverage gaps and source annotations */
  generateSpecs(coverage: FileCoverage[], annotations: SourceAnnotation[]): TaskManifest[] {
    const specs: TaskManifest[] = [];
    const counters: Record<TaskClass, number> = { leaf: 0, wiring: 0, 'harness-quality': 0, orchestrator: 0 };
    const now = new Date().toISOString();

    // 1. Coverage-gap tasks
    for (const file of coverage) {
      if (file.statementPct >= 70) continue; // Already at target
      if (file.statementTotal < 3) continue; // Too small to be meaningful

      const spec = this.specFromCoverageGap(file, counters, now);
      if (spec) {
        specs.push(spec);
        counters[spec.taskClass]++;
      }
    }

    // 2. TODO/FIXME tasks (only for items not already covered by a coverage-gap task)
    // Track source file paths (not test files) for deduplication
    const coveredFiles = new Set(coverage.map(f => f.path));
    for (const anno of annotations) {
      if (coveredFiles.has(anno.file)) continue;
      if (DEFERRED_MODULES.some(d => anno.file.startsWith(d))) continue;

      const spec = this.specFromAnnotation(anno, counters, now);
      if (spec) {
        specs.push(spec);
        counters[spec.taskClass]++;
      }
    }

    return specs;
  }

  // ─── Spec Generation ────────────────────────────────────────────

  private specFromCoverageGap(file: FileCoverage, counters: Record<TaskClass, number>, now: string): TaskManifest | null {
    const taskClass = this.classifyCoverageGap(file);
    const id = `${CLASS_PREFIX[taskClass]}${String(counters[taskClass] + 1).padStart(3, '0')}`;
    const testFile = this.inferTestFile(file.path);
    const isPriority = PRIORITY_MODULES.some(p => file.path.startsWith(p));
    const lane = isPriority ? 1 : (taskClass === 'leaf' ? 2 : 3);

    const title = this.buildTitle(file, taskClass);
    const description = this.buildDescription(file, taskClass, testFile);

    return {
      id,
      title,
      description,
      taskClass,
      status: 'pending',
      files: {
        allowlist: [testFile],
        denylist: ['src/core/RalphLoop.ts', 'src/fs/LiminalFS.ts', 'src/llm/LLMClient.ts'],
      },
      verifyCommand: `pnpm vitest run ${testFile} --no-coverage`,
      scoringCriteria: this.buildScoringCriteria(taskClass),
      lane,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    };
  }

  private specFromAnnotation(anno: SourceAnnotation, counters: Record<TaskClass, number>, now: string): TaskManifest | null {
    // TODOs are orchestrator tasks by default — they usually require understanding context
    const taskClass: TaskClass = 'orchestrator';
    const id = `${CLASS_PREFIX[taskClass]}${String(counters[taskClass] + 1).padStart(3, '0')}`;
    const testFile = this.inferTestFile(anno.file);

    return {
      id,
      title: `Implement: ${anno.text.slice(0, 60)}${anno.text.length > 60 ? '...' : ''}`,
      description: `${anno.kind} at ${anno.file}:${anno.line}: ${anno.text}\n\nImplement the described functionality and add tests. The source file is ${anno.file}. Create or update the test file at ${testFile}. Ensure the existing test suite still passes after changes.`,
      taskClass,
      status: 'pending',
      files: {
        allowlist: [anno.file, testFile],
        denylist: ['src/core/RalphLoop.ts', 'src/fs/LiminalFS.ts'],
      },
      verifyCommand: `pnpm vitest run ${testFile} --no-coverage`,
      scoringCriteria: [
        'Implements the described functionality',
        'Adds at least 2 behavioral tests',
        'Existing tests still pass',
        'TypeScript compiles clean',
      ],
      lane: 4,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ─── Classification ─────────────────────────────────────────────

  private classifyCoverageGap(file: FileCoverage): TaskClass {
    // Zero coverage → leaf (write new test file)
    if (file.statementPct === 0) return 'leaf';

    // Very low coverage (<20%) with small files → leaf
    if (file.statementPct < 20 && file.statementTotal <= LEAF_MAX_STMTS) return 'leaf';

    // Low coverage (1-50%) → wiring (improve/add tests)
    if (file.statementPct < 50) return 'wiring';

    // Medium coverage (50-70%) → harness-quality (push to target)
    return 'harness-quality';
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /** Map src/foo/Bar.ts → test/unit/foo/Bar.test.ts */
  private inferTestFile(srcPath: string): string {
    const relPath = srcPath.replace(/^src\//, '');
    const parts = relPath.split('/');
    const basename = parts[parts.length - 1].replace(/\.ts$/, '');
    // Preserve subdirectory structure
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    return dir ? `test/unit/${dir}/${basename}.test.ts` : `test/unit/${basename}.test.ts`;
  }

  private buildTitle(file: FileCoverage, taskClass: TaskClass): string {
    const shortName = file.path.replace(/^src\//, '').replace(/\.ts$/, '');
    switch (taskClass) {
      case 'leaf':
        return `Write tests for ${shortName} (${file.statementPct.toFixed(0)}% coverage)`;
      case 'wiring':
        return `Improve test coverage for ${shortName} (${file.statementPct.toFixed(0)}% → 70%)`;
      case 'harness-quality':
        return `Push ${shortName} to coverage target (${file.statementPct.toFixed(0)}% → 70%)`;
      default:
        return `Add tests for ${shortName}`;
    }
  }

  private buildDescription(file: FileCoverage, taskClass: TaskClass, testFile: string): string {
    const shortName = file.path.replace(/^src\//, '').replace(/\.ts$/, '');
    const gap = 70 - file.statementPct;
    const uncovered = file.statementTotal - Math.round(file.statementTotal * file.statementPct / 100);

    const lines: string[] = [
      `Coverage gap: ${shortName} is at ${file.statementPct.toFixed(1)}% statement coverage (${gap.toFixed(0)}pp below target).`,
      `${uncovered} of ${file.statementTotal} statements need coverage.`,
      '',
    ];

    if (taskClass === 'leaf') {
      lines.push(
        `Create a new test file at ${testFile}.`,
        `Import the module and write behavioral tests for all exported functions.`,
        'Focus on: constructor/initialization, main public methods, error paths, edge cases.',
        'Do NOT mock the module under test. Mock only external dependencies (LLM, filesystem, network).',
        `Use vi.hoisted() for any mock factories referenced in vi.mock() blocks.`,
      );
    } else {
      lines.push(
        `Improve coverage in the existing test file at ${testFile}.`,
        `Current gaps: ${file.statementPct.toFixed(1)}% statements, ${file.branchPct.toFixed(1)}% branches, ${file.functionPct.toFixed(1)}% functions.`,
        'Read the source file first to identify uncovered branches and functions.',
        'Add targeted tests for uncovered paths — do NOT refactor the source file.',
        'Assert specific expected values, not just toBeDefined/toBeTruthy.',
      );
    }

    lines.push('', 'Anti-patterns to avoid:', '- toBeDefined/toBeTruthy as sole assertions', '- Mocking the module under test', '- More than 5% toBeDefined per file');

    return lines.join('\n');
  }

  private buildScoringCriteria(taskClass: TaskClass): string[] {
    switch (taskClass) {
      case 'leaf':
        return [
          'All exported functions have at least 1 test',
          'Error paths covered (null, undefined, thrown errors)',
          'No toBeDefined/toBeTruthy as sole assertions',
          'vi.hoisted() used for mock factories',
          'TypeScript compiles clean',
        ];
      case 'wiring':
        return [
          'Statement coverage increased by at least 10pp',
          'New tests assert specific expected values',
          'Existing tests still pass unchanged',
          'vi.hoisted() used for mock factories',
          'TypeScript compiles clean',
        ];
      case 'harness-quality':
        return [
          'Statement coverage reaches ≥70% for the target file',
          'Branch coverage increased by at least 5pp',
          'New tests exercise real data flow, not just constructor calls',
          'Existing tests still pass unchanged',
          'TypeScript compiles clean',
        ];
      default:
        return [
          'Implements described functionality',
          'Adds behavioral tests',
          'Existing tests still pass',
          'TypeScript compiles clean',
        ];
    }
  }

  /** Recursively collect .ts files from a directory, excluding specified dirs */
  private collectTsFiles(dir: string, excludeDirs: string[] = []): string[] {
    const results: string[] = [];
    if (!existsSync(dir)) return results;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const relDir = relative(this.rootDir, fullPath) + '/';
        if (excludeDirs.some(d => relDir.startsWith(d) || fullPath.includes(d))) continue;
        results.push(...this.collectTsFiles(fullPath, excludeDirs));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.ts')) {
        results.push(fullPath);
      }
    }
    return results;
  }
}
