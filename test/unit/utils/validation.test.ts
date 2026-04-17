import { describe, it, expect } from 'vitest';
import {
  validateString,
  validateNonEmptyString,
  validateCode,
  validateOutputPath,
  validatePrompt,
  validateOptionalString,
  validateNumber,
  validateProjectName,
} from '../../../src/utils/validation.js';

describe('validateString', () => {
  it('returns valid strings', () => {
    expect(validateString('hello', 'field')).toBe('hello');
  });

  it('rejects null', () => {
    expect(() => validateString(null, 'f')).toThrow('f is required');
  });

  it('rejects undefined', () => {
    expect(() => validateString(undefined, 'f')).toThrow('f is required');
  });

  it('rejects non-strings', () => {
    expect(() => validateString(123, 'f')).toThrow('f is required');
  });

  it('rejects empty string', () => {
    expect(() => validateString('', 'f')).toThrow('f is required');
  });
});

describe('validateNonEmptyString', () => {
  it('returns valid strings', () => {
    expect(validateNonEmptyString('hello', 'field')).toBe('hello');
  });

  it('rejects whitespace-only strings', () => {
    expect(() => validateNonEmptyString('   ', 'f')).toThrow('f is required');
  });

  it('rejects empty strings', () => {
    expect(() => validateNonEmptyString('', 'f')).toThrow('f is required');
  });

  it('rejects null', () => {
    expect(() => validateNonEmptyString(null, 'f')).toThrow('f is required');
  });
});

describe('validateCode', () => {
  it('returns valid code', () => {
    expect(validateCode('const x = 1;')).toBe('const x = 1;');
  });

  it('rejects empty code', () => {
    expect(() => validateCode('')).toThrow('Code is required');
  });

  it('rejects whitespace-only code', () => {
    expect(() => validateCode('   ')).toThrow('Code is required');
  });

  it('rejects non-string', () => {
    expect(() => validateCode(42)).toThrow('Code is required');
  });
});

describe('validateOutputPath', () => {
  it('returns valid paths', () => {
    expect(validateOutputPath('/tmp/out.mp4')).toBe('/tmp/out.mp4');
  });

  it('rejects empty paths', () => {
    expect(() => validateOutputPath('')).toThrow('Output path is required');
  });

  it('uses custom message when provided', () => {
    expect(() => validateOutputPath('', 'Custom msg')).toThrow('Custom msg');
  });

  it('uses default message without custom', () => {
    expect(() => validateOutputPath(null)).toThrow('Output path is required');
  });
});

describe('validatePrompt', () => {
  it('returns valid prompts', () => {
    expect(validatePrompt('make a circle')).toBe('make a circle');
  });

  it('rejects empty prompts', () => {
    expect(() => validatePrompt('')).toThrow('Prompt is required');
  });

  it('rejects whitespace-only', () => {
    expect(() => validatePrompt('   ')).toThrow('Prompt is required');
  });

  it('rejects null', () => {
    expect(() => validatePrompt(null)).toThrow('Prompt is required');
  });
});

describe('validateOptionalString', () => {
  it('returns undefined for null', () => {
    expect(validateOptionalString(null, 'f')).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(validateOptionalString(undefined, 'f')).toBeUndefined();
  });

  it('returns string for valid strings', () => {
    expect(validateOptionalString('hello', 'f')).toBe('hello');
  });

  it('rejects non-strings', () => {
    expect(() => validateOptionalString(42, 'f')).toThrow('f must be a string');
  });
});

describe('validateNumber', () => {
  it('returns valid numbers', () => {
    expect(validateNumber(42, 'num')).toBe(42);
  });

  it('returns zero', () => {
    expect(validateNumber(0, 'num')).toBe(0);
  });

  it('returns negative numbers', () => {
    expect(validateNumber(-5, 'num')).toBe(-5);
  });

  it('rejects NaN', () => {
    expect(() => validateNumber(NaN, 'num')).toThrow('num is required');
  });

  it('rejects strings', () => {
    expect(() => validateNumber('42', 'num')).toThrow('num is required');
  });

  it('rejects undefined', () => {
    expect(() => validateNumber(undefined, 'num')).toThrow('num is required');
  });
});

describe('validateProjectName', () => {
  it('returns valid names', () => {
    expect(validateProjectName('my-project')).toBe('my-project');
  });

  it('rejects empty', () => {
    expect(() => validateProjectName('')).toThrow('Project name is required');
  });

  it('rejects whitespace-only', () => {
    expect(() => validateProjectName('   ')).toThrow('Project name is required');
  });

  it('rejects null', () => {
    expect(() => validateProjectName(null)).toThrow('Project name is required');
  });
});
