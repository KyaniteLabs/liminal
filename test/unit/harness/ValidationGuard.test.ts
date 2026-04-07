import { describe, it, expect, vi, beforeEach } from 'vitest';
/**
 * Tests for ValidationGuard - Safety checks for file paths, content, and changes
 *
 * ValidationGuard enforces three types of constraints:
 * - validatePath(): file must be within allowed directories (src/, test/, docs/, scripts/)
 * - validateContent(): file must not exceed line limits or contain forbidden patterns
 * - validateChange(): diffs must not exceed size limits or contain suspicious patterns
 *
 * Minimal mocking: only validateContent() needs fs.readFile mocked since it reads a real file.
 */

import path from 'node:path';
import { ValidationGuard } from '../../../src/harness/tools/ValidationGuard.js';

// ---------------------------------------------------------------------------
// Mock fs.readFile for validateContent tests (top-level as required by Vitest)
// ---------------------------------------------------------------------------
const { mockReadFile } = vi.hoisted(() => ({ mockReadFile: vi.fn() }));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mockReadFile,
  },
  readFile: mockReadFile,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a ValidationGuard whose allowed prefixes resolve against the real cwd
 * so relative path resolution matches the guard's internal behavior.
 */
function makeGuardWithCwd(): ValidationGuard {
  const cwd = process.cwd();
  const guard = new ValidationGuard();
  // Use the actual cwd so path.resolve('src/...') in validatePath matches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (guard as any).allowedPrefixes = [
    path.join(cwd, 'src'),
    path.join(cwd, 'test'),
  ];
  return guard;
}

/**
 * Build a ValidationGuard with completely custom absolute prefixes.
 */
function makeGuard(prefixes: string[]): ValidationGuard {
  const guard = new ValidationGuard();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (guard as any).allowedPrefixes = prefixes.map(p => path.resolve(p));
  return guard;
}

// ---------------------------------------------------------------------------
// validatePath
// ---------------------------------------------------------------------------
describe('ValidationGuard.validatePath', () => {
  const guard = makeGuardWithCwd();

  it('allows paths within src/', () => {
    const result = guard.validatePath('src/index.ts');

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('allows paths within test/', () => {
    const result = guard.validatePath('test/unit/foo.test.ts');

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects paths outside allowed directories', () => {
    const result = guard.validatePath('/etc/passwd');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain('outside allowed directories');
  });

  it('rejects paths with directory traversal (..)', () => {
    const result = guard.validatePath('../secret/keys.pem');

    expect(result.valid).toBe(false);
    const traversalError = result.errors.find(e => e.includes("'..'"));
    expect(traversalError).toBeDefined();
  });

  it('warns about absolute paths when allowAbsolute is not set', () => {
    const result = guard.validatePath('/absolute/path/file.ts', { allowAbsolute: false });

    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('absolute');
  });

  it('does not warn about absolute paths when allowAbsolute is true', () => {
    const cwd = process.cwd();
    const result = guard.validatePath(path.join(cwd, 'src', 'file.ts'), { allowAbsolute: true });

    expect(result.warnings).toEqual([]);
  });

  it('accepts custom allowedPrefixes via options', () => {
    const result = guard.validatePath('/custom/dir/file.ts', {
      allowedPrefixes: ['/custom/dir'],
    });

    expect(result.valid).toBe(true);
  });

  it('blocks path traversal via nested .. segments', () => {
    const result = guard.validatePath('src/../../../etc/shadow');

    expect(result.valid).toBe(false);
    const traversalError = result.errors.find(e => e.includes("'..'"));
    expect(traversalError).toBeDefined();
  });

  it('rejects paths in disallowed project directories', () => {
    const result = guard.validatePath('node_modules/package/index.js');

    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateContent
// ---------------------------------------------------------------------------
describe('ValidationGuard.validateContent', () => {
  let guard: ValidationGuard;

  beforeEach(() => {
    guard = new ValidationGuard();
    mockReadFile.mockReset();
  });

  it('returns valid for a small clean file', async () => {
    mockReadFile.mockResolvedValue('const x = 1;\nconst y = 2;\n');

    const result = await guard.validateContent('/project/src/clean.ts');

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('flags files exceeding maxLines', async () => {
    const lines = Array.from({ length: 1010 }, (_, i) => `line ${i}`);
    mockReadFile.mockResolvedValue(lines.join('\n'));

    const result = await guard.validateContent('/project/src/big.ts', { maxLines: 1000 });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('1010 lines');
    expect(result.errors[0]).toContain('max allowed is 1000');
  });

  it('warns about long lines exceeding maxLineLength', async () => {
    const longLine = 'x'.repeat(600);
    mockReadFile.mockResolvedValue(`short line\n${longLine}\nanother short\n`);

    const result = await guard.validateContent('/project/src/wide.ts', { maxLineLength: 500 });

    expect(result.valid).toBe(true); // long lines are warnings, not errors
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('Line 2');
    expect(result.warnings[0]).toContain('600 chars');
  });

  it('rejects files containing eval()', async () => {
    mockReadFile.mockResolvedValue('const result = eval(userInput);\n');

    const result = await guard.validateContent('/project/src/danger.ts');

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('eval'))).toBe(true);
  });

  it('rejects files containing new Function()', async () => {
    mockReadFile.mockResolvedValue('const fn = new Function("a", "return a");\n');

    const result = await guard.validateContent('/project/src/dynamic.ts');

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Function'))).toBe(true);
  });

  it('rejects files containing child_process', async () => {
    mockReadFile.mockResolvedValue('import { exec } from "child_process";\n');

    const result = await guard.validateContent('/project/src/spawn.ts');

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('child_process'))).toBe(true);
  });

  it('accepts custom forbiddenPatterns that match', async () => {
    mockReadFile.mockResolvedValue('console.log("clean code");\n');

    const result = await guard.validateContent('/project/src/clean.ts', {
      forbiddenPatterns: [/console\.log/],
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('console');
  });

  it('returns error when file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await guard.validateContent('/nonexistent/file.ts');

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('ENOENT');
  });

  it('returns valid for empty file', async () => {
    mockReadFile.mockResolvedValue('');

    const result = await guard.validateContent('/project/src/empty.ts');

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts files that are exactly at maxLines (boundary)', async () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `line ${i}`);
    mockReadFile.mockResolvedValue(lines.join('\n'));

    const result = await guard.validateContent('/project/src/exact.ts', { maxLines: 1000 });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateChange
// ---------------------------------------------------------------------------
describe('ValidationGuard.validateChange', () => {
  const guard = new ValidationGuard();

  it('accepts small changes within line limit', () => {
    const oldContent = 'line 1\nline 2\nline 3';
    const newContent = 'line 1\nline 2 modified\nline 3';

    const result = guard.validateChange(oldContent, newContent, 50);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects changes that exceed maxLinesChanged', () => {
    const oldLines = Array.from({ length: 10 }, (_, i) => `old ${i}`);
    const newLines = Array.from({ length: 100 }, (_, i) => `new ${i}`);

    const result = guard.validateChange(oldLines.join('\n'), newLines.join('\n'), 50);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Too many lines changed');
    expect(result.errors[0]).toContain('90');
    expect(result.errors[0]).toContain('max allowed is 50');
  });

  it('warns about large byte-size changes', () => {
    const oldContent = 'x'.repeat(100);
    const newContent = 'y'.repeat(11000); // 10900 byte diff

    const result = guard.validateChange(oldContent, newContent, 100);

    expect(result.warnings.some(w => w.includes('Large size change'))).toBe(true);
    expect(result.warnings.some(w => w.includes('10900 bytes'))).toBe(true);
  });

  it('does not warn when size change is below threshold', () => {
    const oldContent = 'short';
    const newContent = 'slightly longer';

    const result = guard.validateChange(oldContent, newContent, 50);

    expect(result.warnings.some(w => w.includes('Large size change'))).toBe(false);
  });

  it('rejects new content with SQL injection patterns', () => {
    const oldContent = 'SELECT * FROM users;';
    const newContent = 'DELETE FROM users WHERE 1=1; DROP TABLE users;';

    const result = guard.validateChange(oldContent, newContent, 50);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('SQL injection'))).toBe(true);
  });

  it('rejects new content with dangerous shell commands', () => {
    const oldContent = 'echo hello';
    const newContent = 'rm -rf /';

    const result = guard.validateChange(oldContent, newContent, 50);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Dangerous shell command'))).toBe(true);
  });

  it('rejects new content with process.exit(0)', () => {
    const oldContent = 'function run() {}';
    const newContent = 'function run() { process.exit(0); }';

    const result = guard.validateChange(oldContent, newContent, 50);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Process termination'))).toBe(true);
  });

  it('accepts identical content (zero diff)', () => {
    const content = 'unchanged\nlines\nhere';

    const result = guard.validateChange(content, content, 50);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts content with process.exit(non-zero) -- only exit(0) is flagged', () => {
    const oldContent = 'function cleanup() {}';
    const newContent = 'function cleanup() { process.exit(1); }';

    const result = guard.validateChange(oldContent, newContent, 50);

    expect(result.valid).toBe(true);
  });

  it('uses default maxLinesChanged of 50', () => {
    const oldLines = Array.from({ length: 10 }, (_, i) => `old ${i}`);
    const newLines = Array.from({ length: 70 }, (_, i) => `new ${i}`);

    const result = guard.validateChange(oldLines.join('\n'), newLines.join('\n'));

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('max allowed is 50');
  });
});

// ---------------------------------------------------------------------------
// isPathAllowed (convenience wrapper)
// ---------------------------------------------------------------------------
describe('ValidationGuard.isPathAllowed', () => {
  const guard = makeGuardWithCwd();

  it('returns true for allowed paths', () => {
    expect(guard.isPathAllowed('src/foo.ts')).toBe(true);
  });

  it('returns false for disallowed paths', () => {
    expect(guard.isPathAllowed('/etc/passwd')).toBe(false);
  });
});
