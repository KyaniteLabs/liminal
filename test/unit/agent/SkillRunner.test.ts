/**
 * SkillRunner tests — skill template resolution and delegation routing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillRunner } from '../../../src/agent/SkillRunner.js';
import type { LoadedSkill } from '../../../src/harness/skills/SkillLoader.js';

function makeSkill(overrides: Partial<LoadedSkill> = {}): LoadedSkill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    content: 'Generate {{input}} with date {{date}}',
    path: '/test/SKILL.md',
    directory: '/test',
    source: 'repo',
    mode: 'make',
    profile: 'creative',
    ...overrides,
  };
}

describe('SkillRunner', () => {
  describe('resolve()', () => {
    it('resolves a skill and expands template variables', async () => {
      const mockSkill = makeSkill();
      const runner = new SkillRunner({
        loadSkill: async () => mockSkill,
        listSkills: async () => [mockSkill],
      } as any);

      const result = await runner.resolve('test-skill', { input: 'ocean waves' });

      expect(result).not.toBeNull();
      expect(result!.skillName).toBe('test-skill');
      expect(result!.prompt).toContain('ocean waves');
      expect(result!.prompt).toMatch(/\d{4}-\d{2}-\d{2}/); // date
      expect(result!.target).toBe('creative');
    });

    it('returns null for unknown skill', async () => {
      const runner = new SkillRunner({
        loadSkill: async () => null,
        listSkills: async () => [],
      } as any);

      const result = await runner.resolve('nonexistent');
      expect(result).toBeNull();
    });

    it('routes creative mode skills to creative target', async () => {
      const runner = new SkillRunner({
        loadSkill: async () => makeSkill({ mode: 'make', profile: 'creative' }),
        listSkills: async () => [],
      } as any);

      const result = await runner.resolve('test-skill');
      expect(result!.target).toBe('creative');
    });

    it('routes remix mode to creative target', async () => {
      const runner = new SkillRunner({
        loadSkill: async () => makeSkill({ mode: 'remix' }),
        listSkills: async () => [],
      } as any);

      const result = await runner.resolve('test-skill');
      expect(result!.target).toBe('creative');
    });

    it('routes improve mode to engineering target', async () => {
      const runner = new SkillRunner({
        loadSkill: async () => makeSkill({ mode: 'improve', profile: 'engineering' }),
        listSkills: async () => [],
      } as any);

      const result = await runner.resolve('test-skill');
      expect(result!.target).toBe('engineering');
    });

    it('routes ask mode to chat target', async () => {
      const runner = new SkillRunner({
        loadSkill: async () => makeSkill({ mode: 'ask', profile: undefined }),
        listSkills: async () => [],
      } as any);

      const result = await runner.resolve('test-skill');
      expect(result!.target).toBe('chat');
    });

    it('defaults to chat target when no mode/profile set', async () => {
      const runner = new SkillRunner({
        loadSkill: async () => makeSkill({ mode: undefined, profile: undefined }),
        listSkills: async () => [],
      } as any);

      const result = await runner.resolve('test-skill');
      expect(result!.target).toBe('chat');
    });

    it('preserves unmatched template variables', async () => {
      const runner = new SkillRunner({
        loadSkill: async () => makeSkill({ content: 'Hello {{unknown}} and {{input}}' }),
        listSkills: async () => [],
      } as any);

      const result = await runner.resolve('test-skill', { input: 'world' });
      expect(result!.prompt).toContain('{{unknown}}');
      expect(result!.prompt).toContain('world');
    });

    it('tracks resolution duration', async () => {
      const runner = new SkillRunner({
        loadSkill: async () => makeSkill(),
        listSkills: async () => [],
      } as any);

      const result = await runner.resolve('test-skill');
      expect(result!.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
