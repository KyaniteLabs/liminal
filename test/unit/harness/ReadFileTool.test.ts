import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ReadFileTool } from '../../../src/harness/tools/ReadFileTool.js';

describe('ReadFileTool', () => {
  it('returns a recovery hint when path is missing', async () => {
    const tool = new ReadFileTool();

    const result = await tool.execute({});

    expect(result.success).toBe(false);
    expect(result.error).toContain('readFile requires params.path');
    expect(result.error).toContain('{"path":"src/index.ts"}');
  });

  it('returns a recovery hint when path is not a string', async () => {
    const tool = new ReadFileTool();

    const result = await tool.execute({ path: ['src/index.ts'] });

    expect(result.success).toBe(false);
    expect(result.error).toContain('readFile requires params.path');
    expect(result.error).toContain('received array');
  });

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

  it('supports numeric-string offset and limit paging', async () => {
    const tool = new ReadFileTool();
    const file = path.join(process.cwd(), 'src', '__readfile_tool_string_offset_fixture__.txt');
    await fs.writeFile(file, ['a', 'b', 'c', 'd', 'e'].join('\n'));

    try {
      const result = await tool.execute({ path: file, offset: '2', limit: '2' });
      expect(result.success).toBe(true);
      expect(result.data?.content).toContain('c\nd');
      expect(result.data?.startLine).toBe(3);
      expect(result.data?.endLine).toBe(4);
      expect(result.data?.truncated).toBe(true);
    } finally {
      await fs.rm(file, { force: true });
    }
  });

  it('normalizes fractional numeric paging params to integer indices', async () => {
    const tool = new ReadFileTool();
    const file = path.join(process.cwd(), 'src', '__readfile_tool_fractional_offset_fixture__.txt');
    await fs.writeFile(file, ['a', 'b', 'c', 'd', 'e'].join('\n'));

    try {
      const result = await tool.execute({ path: file, offset: '2.8', limit: '2.9' });
      expect(result.success).toBe(true);
      expect(result.data?.content).toContain('c\nd');
      expect(result.data?.startLine).toBe(3);
      expect(result.data?.endLine).toBe(4);
      expect(Number.isInteger(result.data?.startLine)).toBe(true);
      expect(Number.isInteger(result.data?.endLine)).toBe(true);
    } finally {
      await fs.rm(file, { force: true });
    }
  });

  it('supports one-based startLine paging', async () => {
    const tool = new ReadFileTool();
    const file = path.join(process.cwd(), 'src', '__readfile_tool_startline_fixture__.txt');
    await fs.writeFile(file, ['a', 'b', 'c', 'd', 'e'].join('\n'));

    try {
      const result = await tool.execute({ path: file, startLine: 3, limit: 2 });
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
