import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ReadFileTool } from '../../../src/harness/tools/ReadFileTool.js';

describe('ReadFileTool', () => {
  it('supports offset and limit paging', async () => {
    const tool = new ReadFileTool();
    const file = path.join(process.cwd(), 'src', '__readfile_tool_fixture__.txt');
    await fs.writeFile(file, ['a', 'b', 'c', 'd', 'e'].join('\n'));

    try {
      const result = await tool.execute({ path: file, offset: 2, limit: 2 });
      expect(result.success).toBe(true);
      expect(result.data?.content).toContain('c\nd');
      expect(result.data?.startLine).toBe(3);
      expect(result.data?.endLine).toBe(4);
      expect(result.data?.truncated).toBe(true);
    } finally {
      await fs.rm(file, { force: true });
    }
  });
});
