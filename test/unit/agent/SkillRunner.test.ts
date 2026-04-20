import { describe, it, expect, vi } from 'vitest';
import { SkillRunner } from '../../../src/agent/SkillRunner.js';
import type { LoadedSkill } from '../../../src/harness/skills/SkillLoader.js';

function mockSkillLoader(skill: LoadedSkill | null) {
  return { loadSkill: vi.fn().mockResolvedValue(skill) } as any;
}

describe('SkillRunner', () => {
  const makeSkill = (overrides: Partial<LoadedSkill> = {}): LoadedSkill => ({
    name: 'test-skill',
    content: 'Hello {{input}}, today is {{date}}',
    mode: 'ask',
    profile: 'creative',
    ...overrides,
  });

  it('returns null when skill is not found', async () => {
    const runner = new SkillRunner(mockSkillLoader(null));
    const result = await runner.resolve('nonexistent');
    expect(result).toBeNull();
  });

  it('expands {{input}} and {{date}} template variables', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill()));
    const result = await runner.resolve('test-skill', { input: 'world' });
    expect(result).not.toBeNull();
    expect(result!.prompt).toContain('world');
    expect(result!.prompt).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('returns the skill name in the result', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill()));
    const result = await runner.resolve('test-skill');
    expect(result!.skillName).toBe('test-skill');
  });

  it('routes to creative for make mode skills', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill({ mode: 'make' })));
    const result = await runner.resolve('test-skill');
    expect(result!.target).toBe('creative');
  });

  it('routes to creative for remix mode skills', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill({ mode: 'remix' })));
    const result = await runner.resolve('test-skill');
    expect(result!.target).toBe('creative');
  });

  it('routes to creative for creative profile skills', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill({ mode: 'ask', profile: 'creative' })));
    const result = await runner.resolve('test-skill');
    expect(result!.target).toBe('creative');
  });

  it('routes to engineering for improve mode with engineering profile', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill({ mode: 'improve', profile: 'engineering' })));
    const result = await runner.resolve('test-skill');
    expect(result!.target).toBe('engineering');
  });

  it('routes to engineering for engineering profile skills', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill({ mode: 'ask', profile: 'engineering' })));
    const result = await runner.resolve('test-skill');
    expect(result!.target).toBe('engineering');
  });

  it('routes to chat as default', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill({ mode: 'ask', profile: 'hybrid' })));
    const result = await runner.resolve('test-skill');
    expect(result!.target).toBe('chat');
  });

  it('expands custom user variables', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill({ content: 'Language: {{lang}}, Style: {{style}}' })));
    const result = await runner.resolve('test-skill', { lang: 'GLSL', style: 'minimal' });
    expect(result!.prompt).toBe('Language: GLSL, Style: minimal');
  });

  it('leaves unknown template variables unexpanded', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill({ content: 'Hello {{unknown}}' })));
    const result = await runner.resolve('test-skill');
    expect(result!.prompt).toBe('Hello {{unknown}}');
  });

  it('reports duration in the result', async () => {
    const runner = new SkillRunner(mockSkillLoader(makeSkill()));
    const result = await runner.resolve('test-skill');
    expect(typeof result!.durationMs).toBe('number');
    expect(result!.durationMs).toBeGreaterThanOrEqual(0);
  });
});
