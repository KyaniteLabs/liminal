/**
 * SkillCatalog tests — mode filtering and search
 */
import { describe, it, expect, vi } from 'vitest';
import { SkillCatalog } from '../../../src/agent/SkillCatalog.js';
import type { LoadedSkill } from '../../../src/harness/skills/SkillLoader.js';

function makeSkill(overrides: Partial<LoadedSkill> = {}): LoadedSkill {
  return {
    name: 'p5-seed-explorer',
    description: 'Generate creative p5.js sketches',
    content: 'Skill content',
    path: '/test/SKILL.md',
    directory: '/test',
    source: 'repo',
    mode: 'make',
    profile: 'creative',
    ...overrides,
  };
}

const skills = [
  makeSkill({ name: 'p5-seed-explorer', mode: 'make', description: 'p5.js sketch generator' }),
  makeSkill({ name: 'code-reviewer', mode: 'improve', description: 'Code quality reviewer', source: 'agents' }),
  makeSkill({ name: 'general-helper', mode: undefined, description: 'General purpose helper' }),
];

const mockLoader = {
  listSkills: async () => skills,
  loadSkill: async (name: string) => skills.find(s => s.name === name) ?? null,
};

describe('SkillCatalog', () => {
  describe('list()', () => {
    it('returns all skills without filter', async () => {
      const catalog = new SkillCatalog(mockLoader as any);
      const entries = await catalog.list();
      expect(entries).toHaveLength(3);
    });

    it('filters by product mode (make)', async () => {
      const catalog = new SkillCatalog(mockLoader as any);
      const entries = await catalog.list({ mode: 'make' });
      // make matches p5-seed-explorer (mode=make) and general-helper (no mode)
      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.name)).toContain('p5-seed-explorer');
      expect(entries.map(e => e.name)).toContain('general-helper');
    });

    it('filters by product mode (improve)', async () => {
      const catalog = new SkillCatalog(mockLoader as any);
      const entries = await catalog.list({ mode: 'improve' });
      // improve matches code-reviewer (mode=improve) and general-helper (no mode)
      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.name)).toContain('code-reviewer');
    });

    it('skills without mode are always included', async () => {
      const catalog = new SkillCatalog(mockLoader as any);
      const entries = await catalog.list({ mode: 'ask' });
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('general-helper');
    });

    it('filters by search query', async () => {
      const catalog = new SkillCatalog(mockLoader as any);
      const entries = await catalog.list({ query: 'p5' });
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('p5-seed-explorer');
    });

    it('combines mode and query filters', async () => {
      const catalog = new SkillCatalog(mockLoader as any);
      const entries = await catalog.list({ mode: 'make', query: 'p5' });
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('p5-seed-explorer');
    });

    it('returns empty when no skills match', async () => {
      const catalog = new SkillCatalog(mockLoader as any);
      const entries = await catalog.list({ query: 'nonexistent' });
      expect(entries).toHaveLength(0);
    });
  });

  describe('get()', () => {
    it('returns a single skill by name', async () => {
      const catalog = new SkillCatalog(mockLoader as any);
      const entry = await catalog.get('code-reviewer');
      expect(entry).not.toBeNull();
      expect(entry!.name).toBe('code-reviewer');
      expect(entry!.mode).toBe('improve');
    });

    it('returns null for unknown skill', async () => {
      const catalog = new SkillCatalog(mockLoader as any);
      const entry = await catalog.get('nonexistent');
      expect(entry).toBeNull();
    });
  });

  describe('entry mapping', () => {
    it('preserves all skill metadata', async () => {
      const catalog = new SkillCatalog(mockLoader as any);
      const entries = await catalog.list();
      const p5 = entries.find(e => e.name === 'p5-seed-explorer');

      expect(p5!.mode).toBe('make');
      expect(p5!.profile).toBe('creative');
      expect(p5!.source).toBe('repo');
    });
  });
});
