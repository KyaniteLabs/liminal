import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SkillLoader } from '../../../src/harness/skills/SkillLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.resolve(__dirname, '../../fixtures/skills');

describe('SkillLoader', () => {
  it('loads a skill from configured roots', async () => {
    const loader = new SkillLoader([FIXTURES_ROOT]);

    const skill = await loader.loadSkill('sample-skill');

    expect(skill?.name).toBe('sample-skill');
    expect(skill?.description).toBe('Sample harness skill');
    expect(skill?.content).toContain('Use searchCode before editing.');
    expect(skill?.path.endsWith(path.join('sample-skill', 'SKILL.md'))).toBe(true);
  });

  it('returns null when the skill does not exist', async () => {
    const loader = new SkillLoader([FIXTURES_ROOT]);

    const skill = await loader.loadSkill('missing-skill');

    expect(skill).toBeNull();
  });

  it('lists available skills from configured roots', async () => {
    const loader = new SkillLoader([FIXTURES_ROOT]);

    const skills = await loader.listSkills();

    expect(skills.map(skill => skill.name)).toContain('sample-skill');
  });
});
