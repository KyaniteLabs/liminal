import { describe, it, expect } from 'vitest';
import { validateImportPath, ImportValidationError } from '../../../src/security/ImportValidator.js';

describe('ImportValidator', () => {
  const projectRoot = '/project/root';

  it('accepts a valid path within project root', () => {
    const result = validateImportPath('/project/root/src/index.ts', projectRoot);
    expect(result).toContain('src/index.ts');
  });

  it('accepts nested paths within project root', () => {
    const result = validateImportPath('/project/root/src/deep/nested/file.ts', projectRoot);
    expect(result).toContain('deep/nested/file.ts');
  });

  it('rejects path escaping project root with ..', () => {
    expect(() => validateImportPath('/project/root/../../../etc/passwd', projectRoot)).toThrow(ImportValidationError);
  });

  it('rejects absolute path outside project root', () => {
    expect(() => validateImportPath('/etc/passwd', projectRoot)).toThrow(ImportValidationError);
  });

  it('rejects traversal path', () => {
    expect(() => validateImportPath('/project/root/../secret', projectRoot)).toThrow(ImportValidationError);
  });

  it('returns resolved absolute path for valid input', () => {
    const result = validateImportPath('/project/root/./src/index.ts', projectRoot);
    expect(result).not.toContain('./');
    expect(result).toContain('src/index.ts');
  });

  it('error message includes the offending path', () => {
    try {
      validateImportPath('/outside/path', projectRoot);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ImportValidationError);
      expect((err as ImportValidationError).name).toBe('ImportValidationError');
      expect((err as Error).message).toContain('/outside/path');
    }
  });

  it('accepts project root itself', () => {
    const result = validateImportPath('/project/root', projectRoot);
    expect(result).toBe(require('path').resolve('/project/root'));
  });
});
