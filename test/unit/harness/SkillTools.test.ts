import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import { ExecuteSkillTool } from '../../../src/harness/tools/ExecuteSkillTool.js';
import { RunFocusedTestsTool } from '../../../src/harness/tools/RunFocusedTestsTool.js';
import { RunLintTool } from '../../../src/harness/tools/RunLintTool.js';
import { SearchCodeTool } from '../../../src/harness/tools/SearchCodeTool.js';
import { SearchDocsTool } from '../../../src/harness/tools/SearchDocsTool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.resolve(__dirname, '../../fixtures/skills');

describe('ExecuteSkillTool', () => {
  it('returns skill metadata and content for a known skill', async () => {
    const tool = new ExecuteSkillTool([FIXTURES_ROOT]);

    const result = await tool.execute({ name: 'sample-skill' });

    expect(result.success).toBe(true);
    expect(result.data?.skill.name).toBe('sample-skill');
    expect(result.data?.skill.description).toBe('Sample harness skill');
    expect(result.data?.skill.content).toContain('Use searchCode before editing.');
  });

  it('fails cleanly for a missing skill', async () => {
    const tool = new ExecuteSkillTool([FIXTURES_ROOT]);

    const result = await tool.execute({ name: 'missing-skill' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing-skill');
  });
});

describe('SearchCodeTool', () => {
  it('returns parsed jmunch results from the runner', async () => {
    const runner = vi.fn(async () => ({
      stdout: JSON.stringify({ result_count: 1, results: [{ file: 'src/foo.ts', matches: [{ line: 4, text: 'needle' }] }] }),
      stderr: '',
    }));
    const tool = new SearchCodeTool(runner);

    const result = await tool.execute({ query: 'needle', repo: 'local/liminal-7a159bbb' });

    expect(result.success).toBe(true);
    expect(result.data?.resultCount).toBe(1);
    expect(result.data?.results[0]?.file).toBe('src/foo.ts');
  });

  it('fails cleanly when the runner errors', async () => {
    const runner = vi.fn(async () => {
      throw new Error('python missing');
    });
    const tool = new SearchCodeTool(runner);

    const result = await tool.execute({ query: 'needle' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('python missing');
  });
});

describe('SearchDocsTool', () => {
  it('returns parsed doc search results from the runner', async () => {
    const runner = vi.fn(async () => ({
      stdout: JSON.stringify({ result_count: 1, results: [{ doc_path: 'docs/THE_BIBLE.md', title: 'Visual Bible' }] }),
      stderr: '',
    }));
    const tool = new SearchDocsTool(runner);

    const result = await tool.execute({ query: 'visual bible', repo: 'local/liminal' });

    expect(result.success).toBe(true);
    expect(result.data?.resultCount).toBe(1);
    expect(result.data?.results[0]?.doc_path).toBe('docs/THE_BIBLE.md');
  });
});

describe('RunLintTool', () => {
  it('runs project lint when no files are provided', async () => {
    const runner = vi.fn(async () => ({ stdout: 'ok', stderr: '' }));
    const tool = new RunLintTool(runner);

    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(runner).toHaveBeenCalledWith('npm', ['run', 'lint'], expect.any(Object));
    expect(result.data?.command).toBe('npm run lint');
  });

  it('runs eslint directly for specific files', async () => {
    const runner = vi.fn(async () => ({ stdout: 'ok', stderr: '' }));
    const tool = new RunLintTool(runner);

    const result = await tool.execute({ files: ['src/foo.ts', 'test/foo.test.ts'] });

    expect(result.success).toBe(true);
    expect(runner).toHaveBeenCalledWith('npx', ['eslint', 'src/foo.ts', 'test/foo.test.ts'], expect.any(Object));
    expect(result.data?.command).toContain('npx eslint');
  });
});

describe('RunFocusedTestsTool', () => {
  it('requires at least one target', async () => {
    const tool = new RunFocusedTestsTool(vi.fn());

    const result = await tool.execute({ targets: [] });

    expect(result.success).toBe(false);
    expect(result.error).toContain('targets');
  });

  it('runs vitest with the provided targets', async () => {
    const runner = vi.fn(async () => ({ stdout: 'ok', stderr: '' }));
    const tool = new RunFocusedTestsTool(runner);

    const result = await tool.execute({ targets: ['test/unit/harness/SkillLoader.test.ts'] });

    expect(result.success).toBe(true);
    expect(runner).toHaveBeenCalledWith(
      'npx',
      ['vitest', 'run', 'test/unit/harness/SkillLoader.test.ts'],
      expect.any(Object),
    );
    expect(result.data?.command).toContain('vitest run');
  });
});
