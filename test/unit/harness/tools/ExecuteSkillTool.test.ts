import { describe, it, expect, beforeEach } from 'vitest';
import { ExecuteSkillTool } from '../../../../src/harness/tools/ExecuteSkillTool.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const TMP_DIR = join(process.cwd(), 'test', '_skill_tmp');

describe('ExecuteSkillTool', () => {
  let tool: ExecuteSkillTool;

  beforeEach(() => {
    tool = new ExecuteSkillTool();
  });

  it('has correct name and description', () => {
    expect(tool.name).toBe('executeSkill');
    expect(tool.description).toContain('SKILL.md');
  });

  it('rejects missing name', async () => {
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-empty skill name');
  });

  it('rejects empty string name', async () => {
    const result = await tool.execute({ name: '   ' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-empty skill name');
  });

  it('rejects non-string name', async () => {
    const result = await tool.execute({ name: 42 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-empty skill name');
  });

  it('rejects null params', async () => {
    const result = await tool.execute(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-empty skill name');
  });

  it('returns error for nonexistent skill', async () => {
    const result = await tool.execute({ name: 'nonexistent-skill-xyz-abc' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Skill not found');
    expect(result.error).toContain('nonexistent-skill-xyz-abc');
  });

  it('loads a real skill from a custom root', async () => {
    // Create a temporary skill directory
    const skillDir = join(TMP_DIR, 'test-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), '# Test Skill\n\nDo the thing.', 'utf-8');

    const localTool = new ExecuteSkillTool([TMP_DIR]);
    const result = await localTool.execute({ name: 'test-skill' });

    expect(result.success).toBe(true);
    expect(result.data?.skill).toBeDefined();
    expect(result.data?.skill.name).toBe('test-skill');
    expect(result.data?.skill.content).toContain('Test Skill');

    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it('trims whitespace from skill name before lookup', async () => {
    const result = await tool.execute({ name: '  nonexistent-trim-test  ' });
    // Even though it fails, the trimmed name is used in the error
    expect(result.error).toContain('nonexistent-trim-test');
  });
});
