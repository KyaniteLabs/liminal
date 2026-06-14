import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic, writeFileAtomicSync } from '../../../src/utils/atomicWrite.js';

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'atomicwrite-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('writeFileAtomic (async)', () => {
  it('writes the exact content to the target path', async () => {
    const p = join(tmp(), 'state.json');
    await writeFileAtomic(p, '{"a":1}');
    expect(readFileSync(p, 'utf-8')).toBe('{"a":1}');
  });

  it('overwrites an existing file with the new content', async () => {
    const dir = tmp();
    const p = join(dir, 'state.json');
    writeFileSync(p, 'OLD');
    await writeFileAtomic(p, 'NEW');
    expect(readFileSync(p, 'utf-8')).toBe('NEW');
  });

  it('leaves no temp file behind after a successful write', async () => {
    const dir = tmp();
    await writeFileAtomic(join(dir, 'state.json'), 'x');
    expect(readdirSync(dir)).toEqual(['state.json']);
  });

  it('preserves the prior file (no corrupt truncation) when the write target dir is gone', async () => {
    const dir = tmp();
    const p = join(dir, 'sub', 'state.json'); // sub/ does not exist → write fails
    await expect(writeFileAtomic(p, 'x')).rejects.toThrow();
    expect(existsSync(p)).toBe(false);
    // no stray temp file in the existing parent
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe('writeFileAtomicSync', () => {
  it('writes the exact content synchronously', () => {
    const p = join(tmp(), 'ref.json');
    writeFileAtomicSync(p, 'hello');
    expect(readFileSync(p, 'utf-8')).toBe('hello');
  });

  it('applies the requested file mode (secrets stay 0o600)', () => {
    const p = join(tmp(), 'config.json');
    writeFileAtomicSync(p, '{}', { mode: 0o600 });
    expect(statSync(p).mode & 0o777).toBe(0o600);
  });

  it('leaves no temp file behind after a successful write', () => {
    const dir = tmp();
    writeFileAtomicSync(join(dir, 'ref.json'), 'x');
    expect(readdirSync(dir)).toEqual(['ref.json']);
  });
});
