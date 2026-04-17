import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

import { ApplyEditTool } from '../../../src/harness/tools/ApplyEditTool.js';

async function withFixture(name: string, content: string, run: (file: string) => Promise<void>): Promise<void> {
  const file = path.join(process.cwd(), 'src', name);
  await fs.writeFile(file, content);
  try {
    await run(file);
  } finally {
    await fs.rm(file, { force: true });
  }
}

describe('ApplyEditTool', () => {
  it('applies oldString/newString replacements', async () => {
    const tool = new ApplyEditTool();

    await withFixture('__apply_edit_old_new_fixture__.txt', 'hello old world', async (file) => {
      const result = await tool.execute({
        path: file,
        oldString: 'old',
        newString: 'new',
        createBackup: false,
      });

      expect(result.success).toBe(true);
      await expect(fs.readFile(file, 'utf8')).resolves.toBe('hello new world');
    });
  });

  it('accepts search/replace aliases emitted by model planners', async () => {
    const tool = new ApplyEditTool();

    await withFixture('__apply_edit_search_replace_fixture__.txt', 'hello old world', async (file) => {
      const result = await tool.execute({
        path: file,
        search: 'old',
        replace: 'new',
        createBackup: false,
      });

      expect(result.success).toBe(true);
      await expect(fs.readFile(file, 'utf8')).resolves.toBe('hello new world');
    });
  });

  it('returns an actionable hint when old string params are missing', async () => {
    const tool = new ApplyEditTool();

    const result = await tool.execute({
      path: 'src/nope.ts',
      newString: 'new',
      createBackup: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('params.oldString or params.search');
  });

  it('allows empty replacement strings', async () => {
    const tool = new ApplyEditTool();

    await withFixture('__apply_edit_empty_replace_fixture__.txt', 'hello removable world', async (file) => {
      const result = await tool.execute({
        path: file,
        search: 'removable ',
        replace: '',
        createBackup: false,
      });

      expect(result.success).toBe(true);
      await expect(fs.readFile(file, 'utf8')).resolves.toBe('hello world');
    });
  });
});
