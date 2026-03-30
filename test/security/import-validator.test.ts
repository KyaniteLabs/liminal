import { describe, it, expect } from 'vitest';
import { validateImportPath, ImportValidationError } from '../../src/security/ImportValidator.js';
import path from 'path';

describe('ImportValidator', () => {
  const PROJECT_ROOT = '/home/user/project';

  it('should allow valid imports within project', () => {
    const result = validateImportPath(
      path.join(PROJECT_ROOT, 'dist/index.js'),
      PROJECT_ROOT
    );
    expect(result).toBe(path.resolve(PROJECT_ROOT, 'dist/index.js'));
  });

  it('should reject imports outside project root', () => {
    expect(() => validateImportPath('/etc/passwd', PROJECT_ROOT))
      .toThrow(ImportValidationError);
    expect(() => validateImportPath('/home/other/project/index.js', PROJECT_ROOT))
      .toThrow(ImportValidationError);
  });

  it('should reject path traversal attempts', () => {
    expect(() => validateImportPath('../dist/index.js', PROJECT_ROOT))
      .toThrow(ImportValidationError);
    expect(() => validateImportPath('dist/../../../etc/passwd', PROJECT_ROOT))
      .toThrow(ImportValidationError);
  });
});
