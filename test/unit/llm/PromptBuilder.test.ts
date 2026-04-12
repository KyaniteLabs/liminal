import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// vi.hoisted() — mandatory for all mock variables referenced in vi.mock()
// ═══════════════════════════════════════════════════════════════════════════

const { mockDetectModelTier, mockGetModelProfile, mockLoggerDebug, mockReadFile } = vi.hoisted(
  () => ({
    mockDetectModelTier: vi.fn(),
    mockGetModelProfile: vi.fn(),
    mockLoggerDebug: vi.fn(),
    mockReadFile: vi.fn(),
  }),
);

// ═══════════════════════════════════════════════════════════════════════════
// Mocks
// ═══════════════════════════════════════════════════════════════════════════

vi.mock('../../../src/llm/ModelTier.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/llm/ModelTier.js')>();
  return {
    ...actual,
    detectModelTier: mockDetectModelTier,
    getModelProfile: mockGetModelProfile,
  };
});

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    debug: mockLoggerDebug,
  },
}));

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
}));

// ═══════════════════════════════════════════════════════════════════════════
// Imports (after mocks)
// ═══════════════════════════════════════════════════════════════════════════

import { PromptBuilder } from '../../../src/llm/PromptBuilder.js';
import type { PromptContext } from '../../../src/llm/PromptBuilder.js';
import type { LLMConfig } from '../../../src/llm/LLMClient.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════════════════

const FULL_CONTEXT: PromptContext = {
  soul: 'You are Liminal, a creative spirit.',
  rules: 'Always output valid code.',
  domainDocs: 'p5.js is a JavaScript library for creative coding.',
  recentAdaptations: ['adaptation-1', 'adaptation-2'],
  userPreferences: 'prefer dark themes',
  userRequest: 'Create a bouncing ball animation',
  domain: 'p5',
};

const MINIMAL_CONTEXT: PromptContext = {
  userRequest: 'Make something cool',
  domain: 'unknown',
};

function makeConfig(): LLMConfig {
  return { baseUrl: 'http://localhost:11434/v1', model: 'test-model' };
}

function setupTier(tier: 'flagship' | 'medium' | 'local' | 'tiny', contextWindow: number) {
  mockDetectModelTier.mockReturnValue(tier);
  mockGetModelProfile.mockReturnValue({
    tier,
    contextWindow,
    recommendedContextTokens: 2000,
    supportsSystemPrompt: tier !== 'tiny',
    needsExplicitInstructions: tier !== 'flagship',
    fewShotExamples: 1,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Constructor ──────────────────────────────────────────────────────────

describe('PromptBuilder constructor', () => {
  it('calls detectModelTier with the provided config', () => {
    const config = makeConfig();
    setupTier('flagship', 200000);

    new PromptBuilder(config);

    expect(mockDetectModelTier).toHaveBeenCalledExactlyOnceWith(config);
  });

  it('calls getModelProfile with the detected tier', () => {
    setupTier('local', 16000);

    new PromptBuilder(makeConfig());

    expect(mockGetModelProfile).toHaveBeenCalledExactlyOnceWith('local');
  });
});

// ── build() — flagship tier ──────────────────────────────────────────────

describe('PromptBuilder.build() — flagship tier', () => {
  it('wraps soul in system prompt', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toContain('You are Liminal, a creative spirit.');
  });

  it('wraps rules in XML <rules> tags', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toContain('<rules>');
    expect(result.system).toContain('</rules>');
    expect(result.system).toContain('Always output valid code.');
  });

  it('wraps domainDocs in XML tags named after the domain', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toContain('<p5_docs>');
    expect(result.system).toContain('</p5_docs>');
    expect(result.system).toContain('p5.js is a JavaScript library for creative coding.');
  });

  it('wraps userPreferences in XML <user_prefs> tags', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toContain('<user_prefs>');
    expect(result.system).toContain('</user_prefs>');
    expect(result.system).toContain('prefer dark themes');
  });

  it('wraps user request in XML <request> tags', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.user).toContain('<request>');
    expect(result.user).toContain('</request>');
    expect(result.user).toContain('Create a bouncing ball animation');
  });

  it('includes domain-specific instruction in XML', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.user).toContain('<instruction>');
    expect(result.user).toContain('</instruction>');
    expect(result.user).toContain('Generate p5 code. Output ONLY code, no explanations.');
  });

  it('uses default soul when context has no soul', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(MINIMAL_CONTEXT);

    expect(result.system).toContain('You are a creative coding assistant.');
  });

  it('uses default rules when context has no rules', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(MINIMAL_CONTEXT);

    expect(result.system).toContain('Output valid code only.');
    expect(result.system).toContain('<rules>');
  });

  it('omits domain docs section when context has no domainDocs', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(MINIMAL_CONTEXT);

    expect(result.system).not.toContain('_docs>');
  });

  it('omits user prefs section when context has no userPreferences', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(MINIMAL_CONTEXT);

    expect(result.system).not.toContain('<user_prefs>');
  });

  it('does not set combined field', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.combined).toBeUndefined();
  });
});

// ── build() — medium tier ───────────────────────────────────────────────

describe('PromptBuilder.build() — medium tier', () => {
  it('includes soul at the top of system prompt', () => {
    setupTier('medium', 100000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toContain('You are Liminal, a creative spirit.');
  });

  it('uses numbered rules format', () => {
    setupTier('medium', 100000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toContain('<rules>');
    expect(result.system).toContain('</rules>');
    expect(result.system).toContain('1. Always output valid code.');
    expect(result.system).toContain('2. Output code only unless the caller explicitly asks for explanation.');
    expect(result.system).toContain('3. Include necessary imports and setup.');
  });

  it('includes domain docs under DOMAIN KNOWLEDGE header', () => {
    setupTier('medium', 100000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toContain('<domain_knowledge name="p5">');
    expect(result.system).toContain('</domain_knowledge>');
    expect(result.system).toContain('p5.js is a JavaScript library for creative coding.');
  });

  it('includes REQUEST and OUTPUT sections in user prompt', () => {
    setupTier('medium', 100000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.user).toContain('<request>');
    expect(result.user).toContain('</request>');
    expect(result.user).toContain('Create a bouncing ball animation');
    expect(result.user).toContain('<instruction>');
    expect(result.user).toContain('Generate valid p5 code.');
    expect(result.user).toContain('Return code only.');
    expect(result.user).toContain('</instruction>');
  });

  it('uses default soul when absent', () => {
    setupTier('medium', 100000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(MINIMAL_CONTEXT);

    expect(result.system).toContain('You are a creative coding assistant.');
  });

  it('uses default rules as rule #1 when absent', () => {
    setupTier('medium', 100000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(MINIMAL_CONTEXT);

    expect(result.system).toContain('1. Output valid code only.');
  });

  it('omits DOMAIN KNOWLEDGE when no domainDocs', () => {
    setupTier('medium', 100000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(MINIMAL_CONTEXT);

    expect(result.system).not.toContain('<domain_knowledge');
  });

  it('does not set combined field', () => {
    setupTier('medium', 100000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.combined).toBeUndefined();
  });
});

// ── build() — local tier ─────────────────────────────────────────────────

describe('PromptBuilder.build() — local tier', () => {
  it('includes concise identity in system prompt', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toContain('You generate code.');
  });

  it('includes bullet-point rules', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toContain('<rules>');
    expect(result.system).toContain('- Output ONLY code');
    expect(result.system).toContain('- No explanations');
    expect(result.system).toContain('- Valid p5 code');
    expect(result.system).toContain('</rules>');
  });

  it('includes domain docs under ABOUT header (summarized)', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toContain('<domain_summary name="p5">');
    expect(result.system).toContain('</domain_summary>');
    expect(result.system).toContain('p5.js is a JavaScript library for creative coding.');
  });

  it('includes few-shot EXAMPLE in user prompt', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.user).toContain('<example>');
    expect(result.user).toContain('function setup()');
    expect(result.user).toContain('function draw()');
    expect(result.user).toContain('</example>');
  });

  it('includes NOW GENERATE section in user prompt', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.user).toContain('<request>');
    expect(result.user).toContain('Create a bouncing ball animation');
    expect(result.user).toContain('</request>');
    expect(result.user).toContain('<instruction>');
    expect(result.user).toContain('Return executable code only.');
    expect(result.user).toContain('</instruction>');
  });

  it('omits ABOUT section when no domainDocs', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(MINIMAL_CONTEXT);

    expect(result.system).not.toContain('<domain_summary');
  });

  it('uses default code example for unknown domain', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(MINIMAL_CONTEXT);

    expect(result.user).toContain('// Code here');
  });

  it('does not set combined field', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.combined).toBeUndefined();
  });
});

// ── build() — tiny tier ──────────────────────────────────────────────────

describe('PromptBuilder.build() — tiny tier', () => {
  it('sets system to empty string', () => {
    setupTier('tiny', 8000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.system).toBe('');
  });

  it('combines everything into user prompt', () => {
    setupTier('tiny', 8000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.user).toContain('<task domain="p5">');
    expect(result.user).toContain('Create a bouncing ball animation');
    expect(result.user).toContain('</task>');
    expect(result.user).toContain('<rules>code only; no explanations</rules>');
  });

  it('sets combined field equal to user field', () => {
    setupTier('tiny', 8000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(FULL_CONTEXT);

    expect(result.combined).toBe(result.user);
  });

  it('includes domain name in the combined prompt', () => {
    setupTier('tiny', 8000);
    const builder = new PromptBuilder(makeConfig());

    const result = builder.build(MINIMAL_CONTEXT);

    expect(result.user).toContain('<task domain="unknown">');
  });
});

// ── getTierInfo() ────────────────────────────────────────────────────────

describe('PromptBuilder.getTierInfo()', () => {
  it('returns the detected tier and context window', () => {
    setupTier('flagship', 200000);
    const builder = new PromptBuilder(makeConfig());

    const info = builder.getTierInfo();

    expect(info.tier).toBe('flagship');
    expect(info.contextWindow).toBe(200000);
  });

  it('returns local tier info with 16000 context window', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const info = builder.getTierInfo();

    expect(info.tier).toBe('local');
    expect(info.contextWindow).toBe(16000);
  });

  it('returns tiny tier info with 8000 context window', () => {
    setupTier('tiny', 8000);
    const builder = new PromptBuilder(makeConfig());

    const info = builder.getTierInfo();

    expect(info.tier).toBe('tiny');
    expect(info.contextWindow).toBe(8000);
  });
});

// ── getExample() (tested indirectly via build with local tier) ───────────

describe('getExample() via local tier build', () => {
  it('returns p5 example with setup and draw functions', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const ctx: PromptContext = { ...MINIMAL_CONTEXT, domain: 'p5' };
    const result = builder.build(ctx);

    expect(result.user).toContain('function setup()');
    expect(result.user).toContain('createCanvas(400, 400)');
    expect(result.user).toContain('function draw()');
    expect(result.user).toContain('background(220)');
    expect(result.user).toContain('circle(200, 200, 50)');
  });

  it('returns shader example with void main', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const ctx: PromptContext = { ...MINIMAL_CONTEXT, domain: 'shader' };
    const result = builder.build(ctx);

    expect(result.user).toContain('void main()');
    expect(result.user).toContain('gl_FragCoord.xy / u_resolution.xy');
    expect(result.user).toContain('gl_FragColor = vec4(uv, 0.5, 1.0)');
  });

  it('returns three.js example with THREE.Scene', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const ctx: PromptContext = { ...MINIMAL_CONTEXT, domain: 'three' };
    const result = builder.build(ctx);

    expect(result.user).toContain('THREE.Scene');
    expect(result.user).toContain('THREE.PerspectiveCamera(75, width / height)');
    expect(result.user).toContain('THREE.WebGLRenderer()');
    expect(result.user).toContain('renderer.render(scene, camera)');
  });

  it('returns default placeholder for unknown domain', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const ctx: PromptContext = { ...MINIMAL_CONTEXT, domain: 'processing' };
    const result = builder.build(ctx);

    expect(result.user).toContain('// Code here');
    expect(result.user).not.toContain('function setup()');
    expect(result.user).not.toContain('void main()');
    expect(result.user).not.toContain('THREE.Scene');
  });
});

// ── summarizeDocs() (tested indirectly via build with local tier) ────────

describe('summarizeDocs() via local tier build', () => {
  it('includes full docs when under 500 chars', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const shortDocs = 'A'.repeat(200);
    const ctx: PromptContext = {
      ...MINIMAL_CONTEXT,
      domain: 'p5',
      domainDocs: shortDocs,
    };
    const result = builder.build(ctx);

    expect(result.system).toContain(shortDocs);
    expect(result.system).not.toContain('[... docs truncated ...]');
  });

  it('truncates docs and adds truncation marker when over 500 chars', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const longDocs = 'A'.repeat(800);
    const ctx: PromptContext = {
      ...MINIMAL_CONTEXT,
      domain: 'p5',
      domainDocs: longDocs,
    };
    const result = builder.build(ctx);

    // The first 500 chars should be present
    expect(result.system).toContain('A'.repeat(500));
    expect(result.system).toContain('[... docs truncated ...]');
    // The truncated portion should NOT be present
    expect(result.system).not.toContain('A'.repeat(501));
  });

  it('keeps docs exactly at 500 chars unchanged', () => {
    setupTier('local', 16000);
    const builder = new PromptBuilder(makeConfig());

    const exactDocs = 'B'.repeat(500);
    const ctx: PromptContext = {
      ...MINIMAL_CONTEXT,
      domain: 'p5',
      domainDocs: exactDocs,
    };
    const result = builder.build(ctx);

    expect(result.system).toContain(exactDocs);
    expect(result.system).not.toContain('[... docs truncated ...]');
  });
});

// ── loadContext() — static method ────────────────────────────────────────

describe('PromptBuilder.loadContext()', () => {
  it('loads all files successfully when they exist', async () => {
    mockReadFile.mockImplementation((path: string) => {
      if (path.includes('SOUL.md')) return Promise.resolve('I am Liminal soul text.');
      if (path.includes('PROJECT_RULES.md')) return Promise.resolve('Rule: be creative.');
      if (path.includes('docs')) return Promise.resolve('p5 domain documentation.');
      return Promise.reject(new Error('not found'));
    });

    const ctx = await PromptBuilder.loadContext('p5', 'draw a circle');

    expect(ctx.soul).toBe('I am Liminal soul text.');
    expect(ctx.rules).toBe('Rule: be creative.');
    expect(ctx.domainDocs).toBe('p5 domain documentation.');
    expect(ctx.userRequest).toBe('draw a circle');
    expect(ctx.domain).toBe('p5');
  });

  it('falls back to default soul when SOUL.md read fails', async () => {
    mockReadFile.mockImplementation((path: string) => {
      if (path.includes('SOUL.md')) return Promise.reject(new Error('ENOENT'));
      if (path.includes('PROJECT_RULES.md')) return Promise.resolve('rules content');
      if (path.includes('docs')) return Promise.resolve('docs content');
      return Promise.reject(new Error('not found'));
    });

    const ctx = await PromptBuilder.loadContext('p5', 'test request');

    expect(ctx.soul).toBe('You are Liminal, a creative coding assistant.');
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      'PromptBuilder',
      expect.stringContaining('SOUL.md not found'),
      expect.any(Error),
    );
  });

  it('falls back to default rules when PROJECT_RULES.md read fails', async () => {
    mockReadFile.mockImplementation((path: string) => {
      if (path.includes('SOUL.md')) return Promise.resolve('soul content');
      if (path.includes('PROJECT_RULES.md')) return Promise.reject(new Error('ENOENT'));
      if (path.includes('docs')) return Promise.resolve('docs content');
      return Promise.reject(new Error('not found'));
    });

    const ctx = await PromptBuilder.loadContext('p5', 'test request');

    expect(ctx.rules).toBe('Output valid, working code only.');
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      'PromptBuilder',
      expect.stringContaining('PROJECT_RULES.md not found'),
      expect.any(Error),
    );
  });

  it('leaves domainDocs undefined when domain docs read fails', async () => {
    mockReadFile.mockImplementation((path: string) => {
      if (path.includes('SOUL.md')) return Promise.resolve('soul');
      if (path.includes('PROJECT_RULES.md')) return Promise.resolve('rules');
      return Promise.reject(new Error('ENOENT'));
    });

    const ctx = await PromptBuilder.loadContext('shader', 'test');

    expect(ctx.domainDocs).toBeUndefined();
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      'PromptBuilder',
      expect.stringContaining("Domain docs for 'shader' not found"),
      expect.any(Error),
    );
  });

  it('reads domain docs from docs/domains/{domain}.md path', async () => {
    mockReadFile.mockImplementation(() => Promise.resolve('content'));

    await PromptBuilder.loadContext('three', 'test');

    // Extract all paths that were passed to readFile
    const allPaths = mockReadFile.mock.calls.map((call: string[]) => call[0]);
    const docsPath = allPaths.find(
      (p: string) => p.includes('docs') && p.includes('domains'),
    );
    expect(docsPath).toContain('docs');
    expect(docsPath).toContain('domains');
    expect(docsPath).toContain('three.md');
  });

  it('reads SOUL.md and PROJECT_RULES.md from process.cwd()', async () => {
    mockReadFile.mockImplementation(() => Promise.resolve('content'));

    await PromptBuilder.loadContext('p5', 'test');

    const allPaths = mockReadFile.mock.calls.map((call: string[]) => call[0]);
    const soulPath = allPaths.find((p: string) => p.includes('SOUL.md'));
    const rulesPath = allPaths.find((p: string) => p.includes('PROJECT_RULES.md'));
    expect(soulPath).toContain(process.cwd());
    expect(rulesPath).toContain(process.cwd());
  });
});

// ── loadContext() — memoryOptions ────────────────────────────────────────

describe('PromptBuilder.loadContext() — memoryOptions', () => {
  it('passes recentAdaptations from memoryOptions into context', async () => {
    mockReadFile.mockImplementation(() => Promise.resolve('content'));

    const ctx = await PromptBuilder.loadContext('p5', 'test', {
      recentAdaptations: ['adapt-1', 'adapt-2'],
    });

    expect(ctx.recentAdaptations).toEqual(['adapt-1', 'adapt-2']);
  });

  it('passes userPreferences from memoryOptions into context', async () => {
    mockReadFile.mockImplementation(() => Promise.resolve('content'));

    const ctx = await PromptBuilder.loadContext('p5', 'test', {
      userPreferences: 'prefers minimal code',
    });

    expect(ctx.userPreferences).toBe('prefers minimal code');
  });

  it('passes both memoryOptions fields together', async () => {
    mockReadFile.mockImplementation(() => Promise.resolve('content'));

    const ctx = await PromptBuilder.loadContext('p5', 'test', {
      recentAdaptations: ['adapt-a'],
      userPreferences: 'likes dark mode',
    });

    expect(ctx.recentAdaptations).toEqual(['adapt-a']);
    expect(ctx.userPreferences).toBe('likes dark mode');
  });

  it('leaves recentAdaptations and userPreferences undefined when memoryOptions absent', async () => {
    mockReadFile.mockImplementation(() => Promise.resolve('content'));

    const ctx = await PromptBuilder.loadContext('p5', 'test');

    expect(ctx.recentAdaptations).toBeUndefined();
    expect(ctx.userPreferences).toBeUndefined();
  });

  it('handles partial memoryOptions (only recentAdaptations)', async () => {
    mockReadFile.mockImplementation(() => Promise.resolve('content'));

    const ctx = await PromptBuilder.loadContext('p5', 'test', {
      recentAdaptations: ['only-adapt'],
    });

    expect(ctx.recentAdaptations).toEqual(['only-adapt']);
    expect(ctx.userPreferences).toBeUndefined();
  });

  it('handles partial memoryOptions (only userPreferences)', async () => {
    mockReadFile.mockImplementation(() => Promise.resolve('content'));

    const ctx = await PromptBuilder.loadContext('p5', 'test', {
      userPreferences: 'only-pref',
    });

    expect(ctx.recentAdaptations).toBeUndefined();
    expect(ctx.userPreferences).toBe('only-pref');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ModelTier direct tests (kept from original file)
// Uses vi.importActual to bypass the mock for these tests.
// ═══════════════════════════════════════════════════════════════════════════

// The vi.mock for ModelTier replaces detectModelTier and getModelProfile with
// mocks, but keeps trimContext as the real implementation (via importOriginal).
// For the direct tests below, we need the real detectModelTier and
// getModelProfile. We access them through vi.importActual in beforeAll.

describe('detectModelTier', () => {
  let realDetectModelTier: typeof import('../../../src/llm/ModelTier.js').detectModelTier;

  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../../../src/llm/ModelTier.js')>(
      '../../../src/llm/ModelTier.js',
    );
    realDetectModelTier = actual.detectModelTier;
  });

  it('detects flagship from exact model name', () => {
    expect(realDetectModelTier({ model: 'gpt-4' })).toBe('flagship');
  });

  it('detects flagship from partial match "claude-3-5"', () => {
    expect(realDetectModelTier({ model: 'claude-3-5-sonnet-20240620' })).toBe('flagship');
  });

  it('detects medium from exact match "gpt-3.5-turbo"', () => {
    expect(realDetectModelTier({ model: 'gpt-3.5-turbo' })).toBe('medium');
  });

  it('detects medium from "gpt-4o-mini"', () => {
    expect(realDetectModelTier({ model: 'gpt-4o-mini' })).toBe('medium');
  });

  it('detects local from partial match "llama"', () => {
    expect(realDetectModelTier({ model: 'llama-3-70b' })).toBe('local');
  });

  it('detects local from "qwen2.5"', () => {
    expect(realDetectModelTier({ model: 'qwen2.5-coder' })).toBe('local');
  });

  it('detects tiny from "phi-2"', () => {
    expect(realDetectModelTier({ model: 'phi-2' })).toBe('tiny');
  });

  it('detects tiny from "tinyllama"', () => {
    expect(realDetectModelTier({ model: 'tinyllama' })).toBe('tiny');
  });

  it('uses maxTokens > 100000 as flagship', () => {
    expect(realDetectModelTier({ model: 'unknown', maxTokens: 200000 })).toBe('flagship');
  });

  it('uses maxTokens > 50000 as medium', () => {
    expect(realDetectModelTier({ model: 'unknown', maxTokens: 80000 })).toBe('medium');
  });

  it('uses maxTokens < 10000 as tiny', () => {
    expect(realDetectModelTier({ model: 'unknown', maxTokens: 5000 })).toBe('tiny');
  });

  it('defaults to medium for unknown models', () => {
    expect(realDetectModelTier({ model: 'some-random-model' })).toBe('medium');
  });

  it('detects flagship from Anthropic base URL', () => {
    expect(realDetectModelTier({ baseUrl: 'https://api.anthropic.com/v1' })).toBe('flagship');
  });

  it('detects flagship from OpenAI base URL', () => {
    expect(realDetectModelTier({ baseUrl: 'https://api.openai.com/v1' })).toBe('flagship');
  });

  it('detects local from localhost base URL', () => {
    expect(realDetectModelTier({ baseUrl: 'http://localhost:1234/v1' })).toBe('local');
  });

  it('detects local from ollama base URL', () => {
    expect(realDetectModelTier({ baseUrl: 'http://127.0.0.1:11434/v1' })).toBe('local');
  });

  it('prioritizes model name over maxTokens', () => {
    expect(realDetectModelTier({ model: 'gpt-4', maxTokens: 5000 })).toBe('flagship');
  });
});

describe('getModelProfile', () => {
  let realGetModelProfile: typeof import('../../../src/llm/ModelTier.js').getModelProfile;

  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../../../src/llm/ModelTier.js')>(
      '../../../src/llm/ModelTier.js',
    );
    realGetModelProfile = actual.getModelProfile;
  });

  it('returns flagship profile with correct context window', () => {
    const profile = realGetModelProfile('flagship');
    expect(profile.tier).toBe('flagship');
    expect(profile.contextWindow).toBe(200000);
    expect(profile.supportsSystemPrompt).toBe(true);
    expect(profile.needsExplicitInstructions).toBe(false);
  });

  it('returns medium profile', () => {
    const profile = realGetModelProfile('medium');
    expect(profile.tier).toBe('medium');
    expect(profile.contextWindow).toBe(100000);
    expect(profile.needsExplicitInstructions).toBe(true);
  });

  it('returns local profile', () => {
    const profile = realGetModelProfile('local');
    expect(profile.tier).toBe('local');
    expect(profile.contextWindow).toBe(16000);
  });

  it('returns tiny profile', () => {
    const profile = realGetModelProfile('tiny');
    expect(profile.tier).toBe('tiny');
    expect(profile.contextWindow).toBe(8000);
    expect(profile.supportsSystemPrompt).toBe(false);
  });
});

describe('trimContext', () => {
  let realTrimContext: typeof import('../../../src/llm/ModelTier.js').trimContext;

  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../../../src/llm/ModelTier.js')>(
      '../../../src/llm/ModelTier.js',
    );
    realTrimContext = actual.trimContext;
  });

  it('returns short context unchanged', () => {
    const ctx = 'Hello world';
    expect(realTrimContext(ctx, 100)).toBe(ctx);
  });

  it('trims long context preserving start and end', () => {
    const ctx = 'A'.repeat(1000);
    const trimmed = realTrimContext(ctx, 10); // maxChars = 40
    expect(trimmed.length).toBeLessThan(ctx.length);
    expect(trimmed).toContain('context trimmed');
    expect(trimmed.startsWith('A'.repeat(12))).toBe(true); // 30% of 40 = 12
    expect(trimmed.endsWith('A'.repeat(16))).toBe(true);   // 40% of 40 = 16
  });

  it('does not trim when within budget', () => {
    const ctx = 'x'.repeat(400); // 400 chars = ~100 tokens
    expect(realTrimContext(ctx, 200)).toBe(ctx); // 200 tokens = 800 chars budget
  });
});
