import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { WriteFileTool } from '../../../src/harness/tools/WriteFileTool.js';

const TMP_DIR = join(process.cwd(), 'test', '_writefile_tmp');

describe('WriteFileTool', () => {
  let tool: WriteFileTool;

  beforeEach(async () => {
    tool = new WriteFileTool();
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('has correct name and description', () => {
    expect(tool.name).toBe('writeFile');
    expect(tool.description).toContain('file');
  });

  it('writes content to a new file', async () => {
    const filePath = join(TMP_DIR, 'new.ts');
    const result = await tool.execute({
      path: filePath,
      content: 'console.log("hello")',
    });

    expect(result.success).toBe(true);
    expect(result.data?.bytesWritten).toBeGreaterThan(0);

    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('console.log("hello")');
  });

  it('overwrites existing file content by default', async () => {
    const filePath = join(TMP_DIR, 'overwrite.ts');
    await writeFile(filePath, 'old content', 'utf-8');

    await tool.execute({
      path: filePath,
      content: 'new content',
    });

    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('new content');
  });

  it('appends content when mode=append', async () => {
    const filePath = join(TMP_DIR, 'append.ts');
    await writeFile(filePath, 'line1\n', 'utf-8');

    await tool.execute({
      path: filePath,
      content: 'line2\n',
      mode: 'append',
    });

    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('line1\nline2\n');
  });

  it('creates nested directories automatically', async () => {
    const filePath = join(TMP_DIR, 'deep', 'nested', 'file.ts');

    const result = await tool.execute({
      path: filePath,
      content: 'nested content',
    });

    expect(result.success).toBe(true);
    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('nested content');
  });

  it('rejects paths outside allowed directories', async () => {
    const result = await tool.execute({
      path: '/etc/passwd',
      content: 'hacked',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('outside allowed');
  });

  it('returns error for invalid file paths', async () => {
    const result = await tool.execute({
      path: 'src/\0invalid',
      content: 'content',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns bytesWritten matching content length', async () => {
    const filePath = join(TMP_DIR, 'sized.ts');
    const content = 'x'.repeat(42);

    const result = await tool.execute({
      path: filePath,
      content,
    });

    expect(result.success).toBe(true);
    expect(result.data?.bytesWritten).toBe(42);
  });
});
