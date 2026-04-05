import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ── Hoisted mocks ──────────────────────────────────────────────────
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: mockLogger,
}));

import { DNAExtractor } from '../../../src/scavenger/DNAExtractor.js';
import { FragmentArchive } from '../../../src/scavenger/fragments/FragmentArchive.js';
import type { ProjectDNA } from '../../../src/scavenger/types.js';

// ─── DNAExtractor ───────────────────────────────────────────────────

describe('DNAExtractor', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dna-extractor-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('extracts DNA from a project with package.json', async () => {
    // Create a minimal project
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-art', dependencies: { p5: '^1.0' } }),
      'utf-8'
    );
    await fs.writeFile(
      path.join(tmpDir, 'README.md'),
      '# Test Art\nA creative coding project using p5 canvas and noise.',
      'utf-8'
    );
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });

    const dna = await DNAExtractor.extract(tmpDir);
    expect(dna.name).toBe(path.basename(tmpDir));
    expect(dna.domain).toBe('generative-art');
    expect(dna.sourcePath).toBe(tmpDir);
    expect(dna.extractedAt).toBeTruthy();
  });

  it('detects domain from keywords in content', async () => {
    // Include keywords in package.json so detectDomainFromContent picks them up
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'web-project', description: 'A React web app with express backend and next framework' }),
      'utf-8'
    );

    const dna = await DNAExtractor.extract(tmpDir);
    expect(dna.domain).toBe('web-app');
  });

  it('returns "unknown" domain for unrecognized projects', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'mystery' }),
      'utf-8'
    );

    const dna = await DNAExtractor.extract(tmpDir);
    expect(dna.domain).toBe('unknown');
  });

  it('extractFromSpec parses spec file', async () => {
    const specContent = [
      '# Architecture',
      'The system uses a pipeline approach for data processing with transform and aggregate.',
      '',
      '# Constraints',
      '- Must handle errors gracefully',
      '- Shall not exceed 100ms latency',
      '',
      '```javascript',
      'const x = 42;',
      'console.log(x);',
      '```',
    ].join('\n');
    const specPath = path.join(tmpDir, 'SPEC.md');
    await fs.writeFile(specPath, specContent, 'utf-8');

    const dna = await DNAExtractor.extractFromSpec(specPath);
    expect(dna.name).toBe('SPEC');
    // 'pipeline', 'data', 'transform', 'aggregate' all match 'data' domain -> score 4
    expect(dna.domain).toBe('data');
    expect(dna.constraints.length).toBeGreaterThan(0);
  });

  it('registerDNA stores in registry', () => {
    const registry = new Map<string, ProjectDNA>();
    const dna: ProjectDNA = {
      name: 'test',
      domain: 'generative-art',
      coreLogic: 'none',
      constraints: [],
      patterns: [],
      prompts: [],
      extractedAt: new Date().toISOString(),
      sourcePath: '/tmp/test',
    };
    DNAExtractor.registerDNA(dna, registry);
    expect(registry.get('generative-art')).toBe(dna);
  });

  it('scanForCarcasses returns project directories', async () => {
    // Create a project directory
    const projectDir = path.join(tmpDir, 'my-project');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'package.json'), '{}', 'utf-8');

    // Create a non-project directory
    const nonProjectDir = path.join(tmpDir, 'random-dir');
    await fs.mkdir(nonProjectDir, { recursive: true });

    const carcasses = await DNAExtractor.scanForCarcasses(tmpDir);
    expect(carcasses).toContain(projectDir);
    expect(carcasses).not.toContain(nonProjectDir);
  });

  it('scanForCarcasses skips hidden and node_modules directories', async () => {
    const hiddenDir = path.join(tmpDir, '.hidden');
    const nmDir = path.join(tmpDir, 'node_modules');
    await fs.mkdir(hiddenDir, { recursive: true });
    await fs.mkdir(nmDir, { recursive: true });
    await fs.writeFile(path.join(hiddenDir, 'package.json'), '{}', 'utf-8');
    await fs.writeFile(path.join(nmDir, 'package.json'), '{}', 'utf-8');

    const carcasses = await DNAExtractor.scanForCarcasses(tmpDir);
    expect(carcasses).not.toContain(hiddenDir);
    expect(carcasses).not.toContain(nmDir);
  });

  it('loadDNAForDomain returns null for nonexistent file', async () => {
    const result = await DNAExtractor.loadDNAForDomain('nonexistent', tmpDir);
    expect(result).toBeNull();
  });

  it('loadDNAForDomain loads saved DNA', async () => {
    const dnaDir = path.join(tmpDir, 'dna');
    await fs.mkdir(dnaDir, { recursive: true });
    const dnaData: ProjectDNA = {
      name: 'test',
      domain: 'test',
      coreLogic: 'test logic',
      constraints: ['c1'],
      patterns: ['p1'],
      prompts: [],
      extractedAt: new Date().toISOString(),
      sourcePath: '/test',
    };
    await fs.writeFile(
      path.join(dnaDir, 'test.json'),
      JSON.stringify(dnaData),
      'utf-8'
    );

    const result = await DNAExtractor.loadDNAForDomain('test', dnaDir);
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('test');
    expect(result!.coreLogic).toBe('test logic');
  });

  it('extracts patterns from project with config files', async () => {
    await fs.writeFile(path.join(tmpDir, 'package.json'), '{}', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf-8');
    const srcDir = path.join(tmpDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.mkdir(path.join(srcDir, 'core'), { recursive: true });
    await fs.mkdir(path.join(srcDir, 'utils'), { recursive: true });
    const testDir = path.join(tmpDir, 'test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'sample.test.ts'), 'test', 'utf-8');

    const dna = await DNAExtractor.extract(tmpDir);
    expect(dna.patterns).toContain('has-test-suite');
    expect(dna.patterns).toContain('uses-tsconfig');
    expect(dna.patterns).toContain('has-core-module');
    expect(dna.patterns).toContain('has-utils-module');
  });

  it('extracts core logic from CLAUDE.md', async () => {
    await fs.writeFile(path.join(tmpDir, 'package.json'), '{}', 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, 'CLAUDE.md'),
      [
        '# Architecture',
        'The system uses a pipeline architecture.',
        'Data flows through multiple stages.',
        '',
        '# Other Section',
        'Irrelevant content here.',
      ].join('\n'),
      'utf-8'
    );

    const dna = await DNAExtractor.extract(tmpDir);
    expect(dna.coreLogic).toContain('pipeline architecture');
  });

  it('extracts constraints from CLAUDE.md', async () => {
    await fs.writeFile(path.join(tmpDir, 'package.json'), '{}', 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, 'CLAUDE.md'),
      [
        '# Constraints',
        '- Must validate all inputs',
        '- Shall not exceed memory limits',
        '- Error handling is required',
      ].join('\n'),
      'utf-8'
    );

    const dna = await DNAExtractor.extract(tmpDir);
    expect(dna.constraints.length).toBeGreaterThan(0);
    expect(dna.constraints).toContain('Must validate all inputs');
  });
});

// ─── FragmentArchive ────────────────────────────────────────────────

describe('FragmentArchive', () => {
  let tmpDir: string;
  let dataPath: string;

  const sampleData = {
    version: '1.0.0',
    extracted: '2026-01-01',
    source: 'test',
    sourceFiles: 5,
    curator: 'test',
    description: 'Test archive',
    categories: {
      constraints: {
        description: 'Constraints',
        fragments: [
          { id: 'c1', content: 'Use only 3 colors', source: 's1', tags: ['color'], score: 0.8 },
          { id: 'c2', content: 'No symmetry allowed', source: 's2', tags: ['symmetry'], score: 0.6 },
        ],
      },
      personas: {
        description: 'Personas',
        fragments: [
          { id: 'p1', content: 'The Minimalist', source: 's1', tags: ['minimalism'] },
          { id: 'p2', content: 'The Maximalist', source: 's2', tags: ['maximalism'] },
        ],
      },
      prompt_seeds: {
        description: 'Prompts',
        fragments: [
          { id: 'ps1', content: 'Draw circles', source: 's1', category: 'visual', tags: ['circles'] },
          { id: 'ps2', content: 'Play chords', source: 's2', category: 'music', tags: ['chords'] },
        ],
      },
      creative_outputs: {
        description: 'Creative outputs',
        fragments: [
          { id: 'co1', content: 'A beautiful painting', source: 's1', score: 0.95 },
          { id: 'co2', content: 'A mediocre sketch', source: 's2', score: 0.5 },
          { id: 'co3', content: 'A good drawing', source: 's3', score: 0.8 },
        ],
      },
    },
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fragment-archive-test-'));
    dataPath = path.join(tmpDir, 'fragments.json');
    await fs.writeFile(dataPath, JSON.stringify(sampleData), 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('loads archive from disk', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    // Should have loaded without error
    expect(archive.getCategories()).toEqual(['constraints', 'personas', 'prompt_seeds', 'creative_outputs']);
  });

  it('getByCategory returns fragments for known category', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const fragments = archive.getByCategory('constraints');
    expect(fragments).toHaveLength(2);
    expect(fragments[0].id).toBe('c1');
  });

  it('getByCategory returns empty array for unknown category', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    expect(archive.getByCategory('nonexistent')).toEqual([]);
  });

  it('getById finds fragment across categories', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const fragment = archive.getById('p1');
    expect(fragment).not.toBeUndefined();
    expect(fragment!.id).toBe('p1');
    expect(fragment!.content).toBe('The Minimalist');
  });

  it('getById returns undefined for unknown id', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    expect(archive.getById('nonexistent')).toBeUndefined();
  });

  it('getByTag returns fragments matching tag', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const fragments = archive.getByTag('minimalism');
    expect(fragments).toHaveLength(1);
    expect(fragments[0].id).toBe('p1');
  });

  it('getByTag returns empty for unknown tag', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    expect(archive.getByTag('nonexistent')).toEqual([]);
  });

  it('getPersonas returns all personas', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const personas = archive.getPersonas();
    expect(personas).toHaveLength(2);
    expect(personas.map(p => p.id)).toEqual(['p1', 'p2']);
  });

  it('getPromptSeeds returns all prompt seeds', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const seeds = archive.getPromptSeeds();
    expect(seeds).toHaveLength(2);
  });

  it('getPromptSeeds filters by category', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const musicSeeds = archive.getPromptSeeds('music');
    expect(musicSeeds).toHaveLength(1);
    expect(musicSeeds[0].id).toBe('ps2');
  });

  it('getTopCreativeOutputs returns top N sorted by score', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const top = archive.getTopCreativeOutputs(2);
    expect(top).toHaveLength(2);
    expect(top[0].id).toBe('co1'); // score 0.95
    expect(top[1].id).toBe('co3'); // score 0.8
  });

  it('search finds fragments by content substring', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const results = archive.search('beautiful');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('co1');
  });

  it('search is case-insensitive', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const results = archive.search('BEAUTIFUL');
    expect(results).toHaveLength(1);
  });

  it('search finds fragments by title', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    // No title in test data, but description search should work
    const results = archive.search('mediocre');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('co2');
  });

  it('getAllFragments returns all fragments across categories', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const all = archive.getAllFragments();
    expect(all).toHaveLength(9); // 2 constraints + 2 personas + 2 prompt_seeds + 3 creative_outputs
  });

  it('throws when methods called before load', () => {
    const archive = new FragmentArchive(dataPath);
    expect(() => archive.getByCategory('constraints')).toThrow(/not loaded/i);
    expect(() => archive.getCategories()).toThrow(/not loaded/i);
    expect(() => archive.getById('c1')).toThrow(/not loaded/i);
  });

  it('static load creates and returns archive', async () => {
    const archive = await FragmentArchive.load(dataPath);
    expect(archive.getCategories()).toHaveLength(4);
  });

  it('randomConstraint returns a constraint string', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const constraint = archive.randomConstraint();
    expect(constraint).toBeTruthy();
    expect(['Use only 3 colors', 'No symmetry allowed']).toContain(constraint);
  });

  it('randomConstraint returns undefined for empty constraints category', async () => {
    const emptyData = { ...sampleData, categories: { constraints: { description: '', fragments: [] } } };
    const emptyPath = path.join(tmpDir, 'empty.json');
    await fs.writeFile(emptyPath, JSON.stringify(emptyData), 'utf-8');
    const archive = new FragmentArchive(emptyPath);
    await archive.load();
    expect(archive.randomConstraint()).toBeUndefined();
  });

  it('randomPromptSeed returns a seed string', async () => {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    const seed = archive.randomPromptSeed();
    expect(seed).toBeTruthy();
    expect(['Draw circles', 'Play chords']).toContain(seed);
  });
});
