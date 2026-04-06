import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock boundary deps: ModelTier functions and fs/promises readFile.
// PromptBuilder imports detectModelTier + getModelProfile from ModelTier
// and readFile from 'fs/promises' (via loadContext).
// ---------------------------------------------------------------------------

const { mockDetectModelTier, mockGetModelProfile } = vi.hoisted(() => ({
  mockDetectModelTier: vi.fn(),
  mockGetModelProfile: vi.fn(),
}));

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock('../../../src/llm/ModelTier.js', () => ({
  detectModelTier: mockDetectModelTier,
  getModelProfile: mockGetModelProfile,
}));

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
}));

// We mock Logger to avoid noisy output during tests
vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { PromptBuilder } from '../../../src/llm/PromptBuilder.js';
import type { PromptContext } from '../../../src/llm/PromptBuilder.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a PromptBuilder that pretends to be the given tier. */
function makeBuilder(tier: 'flagship' | 'medium' | 'local' | 'tiny', contextWindow = 200_000): PromptBuilder {
  mockDetectModelTier.mockReturnValue(tier);
  mockGetModelProfile.mockReturnValue({ tier, contextWindow });
  return new PromptBuilder({ baseUrl: 'https://example.com', model: 'test-model' });
}

/** Minimal valid PromptContext for build() calls. */
function makeContext(overrides?: Partial<PromptContext>): PromptContext {
  return {
    userRequest: 'Create a bouncing ball animation',
    domain: 'p5',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PromptBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: act as flagship
    mockDetectModelTier.mockReturnValue('flagship');
    mockGetModelProfile.mockReturnValue({ tier: 'flagship', contextWindow: 200_000 });
    mockReadFile.mockRejectedValue(new Error('file not found'));
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('calls detectModelTier with the provided config', () => {
      const config = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' };
      new PromptBuilder(config);
      expect(mockDetectModelTier).toHaveBeenCalledWith(config);
    });

    it('calls getModelProfile with the detected tier', () => {
      mockDetectModelTier.mockReturnValue('local');
      mockGetModelProfile.mockReturnValue({ tier: 'local', contextWindow: 16000 });

      new PromptBuilder({ baseUrl: 'http://localhost:1234/v1', model: 'qwen2.5' });
      expect(mockGetModelProfile).toHaveBeenCalledWith('local');
    });
  });

  // -------------------------------------------------------------------------
  // build() — flagship tier
  // -------------------------------------------------------------------------
  describe('flagship tier', () => {
    it('builds a system prompt with soul and rules in XML tags', () => {
      const builder = makeBuilder('flagship');
      const result = builder.build(makeContext({
        soul: 'You are Liminal.',
        rules: 'Output valid p5.js code.',
      }));

      expect(result.system).toContain('<rules>');
      expect(result.system).toContain('Output valid p5.js code.');
      expect(result.system).toContain('</rules>');
      expect(result.system).toContain('You are Liminal.');
    });

    it('builds a user prompt with <request> and <instruction> tags', () => {
      const builder = makeBuilder('flagship');
      const result = builder.build(makeContext());

      expect(result.user).toContain('<request>');
      expect(result.user).toContain('Create a bouncing ball animation');
      expect(result.user).toContain('</request>');
      expect(result.user).toContain('Generate p5 code');
    });

    it('includes domainDocs in the system prompt when provided', () => {
      const builder = makeBuilder('flagship');
      const result = builder.build(makeContext({
        domainDocs: 'p5.js is a JavaScript library for creative coding.',
      }));

      expect(result.system).toContain('<p5_docs>');
      expect(result.system).toContain('p5.js is a JavaScript library');
    });

    it('includes userPreferences when provided', () => {
      const builder = makeBuilder('flagship');
      const result = builder.build(makeContext({
        userPreferences: 'Dark theme preferred',
      }));

      expect(result.system).toContain('<user_prefs>');
      expect(result.system).toContain('Dark theme preferred');
    });

    it('uses defaults when soul and rules are omitted', () => {
      const builder = makeBuilder('flagship');
      const result = builder.build(makeContext());

      expect(result.system).toContain('You are a creative coding assistant.');
      expect(result.system).toContain('Output valid code only.');
    });

    it('does not include a combined field', () => {
      const builder = makeBuilder('flagship');
      const result = builder.build(makeContext());
      expect(result.combined).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // build() — medium tier
  // -------------------------------------------------------------------------
  describe('medium tier', () => {
    it('builds a system prompt with numbered rules', () => {
      const builder = makeBuilder('medium');
      const result = builder.build(makeContext({
        soul: 'You are Liminal.',
        rules: 'Output valid code.',
      }));

      expect(result.system).toContain('RULES:');
      expect(result.system).toContain('1. Output valid code.');
      expect(result.system).toContain('2. No explanations outside code comments.');
      expect(result.system).toContain('3. Include all necessary imports/setup.');
      expect(result.system).toContain('You are Liminal.');
    });

    it('builds a user prompt with REQUEST / OUTPUT format', () => {
      const builder = makeBuilder('medium');
      const result = builder.build(makeContext());

      expect(result.user).toContain('REQUEST:');
      expect(result.user).toContain('Create a bouncing ball animation');
      expect(result.user).toContain('OUTPUT: Valid p5 code.');
    });

    it('includes domain docs as DOMAIN KNOWLEDGE when provided', () => {
      const builder = makeBuilder('medium');
      const result = builder.build(makeContext({
        domainDocs: 'Shader documentation here.',
      }));

      expect(result.system).toContain('DOMAIN KNOWLEDGE (p5):');
      expect(result.system).toContain('Shader documentation here.');
    });

    it('uses default soul when omitted', () => {
      const builder = makeBuilder('medium');
      const result = builder.build(makeContext());
      expect(result.system).toContain('You are a creative coding assistant.');
    });

    it('does not include a combined field', () => {
      const builder = makeBuilder('medium');
      const result = builder.build(makeContext());
      expect(result.combined).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // build() — local tier
  // -------------------------------------------------------------------------
  describe('local tier', () => {
    it('builds a system prompt with explicit rules and domain', () => {
      const builder = makeBuilder('local');
      const result = builder.build(makeContext());

      expect(result.system).toContain('You generate code.');
      expect(result.system).toContain('Output ONLY code');
      expect(result.system).toContain('Valid p5 code');
    });

    it('includes a few-shot example in the user prompt', () => {
      const builder = makeBuilder('local');
      const result = builder.build(makeContext({ domain: 'p5' }));

      expect(result.user).toContain('EXAMPLE:');
      expect(result.user).toContain('function setup()');
      expect(result.user).toContain('NOW GENERATE:');
    });

    it('provides p5 example for p5 domain', () => {
      const builder = makeBuilder('local');
      const result = builder.build(makeContext({ domain: 'p5' }));

      expect(result.user).toContain('createCanvas(400, 400)');
      expect(result.user).toContain('circle(200, 200, 50)');
    });

    it('provides shader example for shader domain', () => {
      const builder = makeBuilder('local');
      const result = builder.build(makeContext({ domain: 'shader' }));

      expect(result.user).toContain('void main()');
      expect(result.user).toContain('gl_FragColor');
    });

    it('provides three example for three domain', () => {
      const builder = makeBuilder('local');
      const result = builder.build(makeContext({ domain: 'three' }));

      expect(result.user).toContain('THREE.Scene');
      expect(result.user).toContain('THREE.PerspectiveCamera');
    });

    it('provides a generic fallback for unknown domains', () => {
      const builder = makeBuilder('local');
      const result = builder.build(makeContext({ domain: 'unknown-domain' }));

      expect(result.user).toContain('// Code here');
    });

    it('summarizes long domain docs to 500 chars', () => {
      const builder = makeBuilder('local');
      const longDocs = 'A'.repeat(800);
      const result = builder.build(makeContext({
        domainDocs: longDocs,
      }));

      // The system should include the truncated version
      expect(result.system).toContain('ABOUT P5:');
      // Should be truncated with marker
      expect(result.system).toContain('[... docs truncated ...]');
    });

    it('does not truncate short domain docs', () => {
      const builder = makeBuilder('local');
      const shortDocs = 'Short docs under 500 chars.';
      const result = builder.build(makeContext({
        domainDocs: shortDocs,
      }));

      expect(result.system).toContain('Short docs under 500 chars.');
      expect(result.system).not.toContain('[... docs truncated ...]');
    });
  });

  // -------------------------------------------------------------------------
  // build() — tiny tier
  // -------------------------------------------------------------------------
  describe('tiny tier', () => {
    it('returns empty system prompt', () => {
      const builder = makeBuilder('tiny', 8000);
      const result = builder.build(makeContext());

      expect(result.system).toBe('');
    });

    it('combines everything into user/combined fields', () => {
      const builder = makeBuilder('tiny', 8000);
      const result = builder.build(makeContext());

      expect(result.user).toContain('Generate p5 code for:');
      expect(result.user).toContain('Create a bouncing ball animation');
      expect(result.user).toContain('RULES: code only, no explanations.');
    });

    it('sets combined to the same value as user', () => {
      const builder = makeBuilder('tiny', 8000);
      const result = builder.build(makeContext());

      expect(result.combined).toBe(result.user);
    });

    it('does not include soul, rules, or domainDocs', () => {
      const builder = makeBuilder('tiny', 8000);
      const result = builder.build(makeContext({
        soul: 'Should not appear',
        rules: 'Should not appear',
        domainDocs: 'Should not appear',
      }));

      expect(result.user).not.toContain('Should not appear');
    });
  });

  // -------------------------------------------------------------------------
  // getTierInfo()
  // -------------------------------------------------------------------------
  describe('getTierInfo', () => {
    it('returns the tier and context window from the profile', () => {
      mockDetectModelTier.mockReturnValue('flagship');
      mockGetModelProfile.mockReturnValue({ tier: 'flagship', contextWindow: 200_000 });

      const builder = new PromptBuilder({ baseUrl: 'https://example.com', model: 'test' });
      const info = builder.getTierInfo();

      expect(info.tier).toBe('flagship');
      expect(info.contextWindow).toBe(200_000);
    });

    it('reflects local tier context window correctly', () => {
      mockDetectModelTier.mockReturnValue('local');
      mockGetModelProfile.mockReturnValue({ tier: 'local', contextWindow: 16_000 });

      const builder = new PromptBuilder({ baseUrl: 'http://localhost:1234/v1', model: 'qwen2.5' });
      const info = builder.getTierInfo();

      expect(info.tier).toBe('local');
      expect(info.contextWindow).toBe(16_000);
    });
  });

  // -------------------------------------------------------------------------
  // loadContext() (static, async, reads files)
  // -------------------------------------------------------------------------
  describe('loadContext', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns a context with defaults when files are not found', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const ctx = await PromptBuilder.loadContext('p5', 'Draw a circle');

      expect(ctx.userRequest).toBe('Draw a circle');
      expect(ctx.domain).toBe('p5');
      expect(ctx.soul).toBe('You are Liminal, a creative coding assistant.');
      expect(ctx.rules).toBe('Output valid, working code only.');
      expect(ctx.domainDocs).toBeUndefined();
    });

    it('loads SOUL.md when it exists', async () => {
      mockReadFile.mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('SOUL.md')) {
          return Promise.resolve('I am Liminal, spirit of creative code.');
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const ctx = await PromptBuilder.loadContext('p5', 'Draw a circle');
      expect(ctx.soul).toBe('I am Liminal, spirit of creative code.');
    });

    it('loads PROJECT_RULES.md when it exists', async () => {
      mockReadFile.mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('PROJECT_RULES.md')) {
          return Promise.resolve('Rule 1: Always use strict mode.');
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const ctx = await PromptBuilder.loadContext('p5', 'Draw a circle');
      expect(ctx.rules).toBe('Rule 1: Always use strict mode.');
    });

    it('loads domain docs when the file exists', async () => {
      mockReadFile.mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('docs/domains/shader.md')) {
          return Promise.resolve('Shaders run on the GPU via GLSL.');
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const ctx = await PromptBuilder.loadContext('shader', 'Create a fragment shader');
      expect(ctx.domainDocs).toBe('Shaders run on the GPU via GLSL.');
    });

    it('passes memory options through to the context', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const ctx = await PromptBuilder.loadContext('p5', 'Draw a circle', {
        recentAdaptations: ['adaptation-1', 'adaptation-2'],
        userPreferences: ' prefers dark mode',
      });

      expect(ctx.recentAdaptations).toEqual(['adaptation-1', 'adaptation-2']);
      expect(ctx.userPreferences).toBe(' prefers dark mode');
    });

    it('does not set memory fields when memoryOptions is omitted', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const ctx = await PromptBuilder.loadContext('p5', 'Draw a circle');
      expect(ctx.recentAdaptations).toBeUndefined();
      expect(ctx.userPreferences).toBeUndefined();
    });

    it('loads all three files successfully when all exist', async () => {
      mockReadFile.mockImplementation((path: string) => {
        if (typeof path === 'string') {
          if (path.includes('SOUL.md')) return Promise.resolve('Custom soul');
          if (path.includes('PROJECT_RULES.md')) return Promise.resolve('Custom rules');
          if (path.includes('docs/domains/p5.md')) return Promise.resolve('p5 domain docs');
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const ctx = await PromptBuilder.loadContext('p5', 'Draw a circle');
      expect(ctx.soul).toBe('Custom soul');
      expect(ctx.rules).toBe('Custom rules');
      expect(ctx.domainDocs).toBe('p5 domain docs');
    });
  });
});
