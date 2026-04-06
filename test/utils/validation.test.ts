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
} from '../../src/utils/validation.js';
import { ValidationError } from '../../src/errors/ValidationError.js';

describe('validation utilities', () => {
  describe('validateString', () => {
    it('returns a valid non-empty string', () => {
      expect(validateString('hello', 'field')).toBe('hello');
    });

    it('throws on null', () => {
      expect(() => validateString(null, 'field')).toThrow(ValidationError);
    });

    it('throws on undefined', () => {
      expect(() => validateString(undefined, 'field')).toThrow(ValidationError);
    });

    it('throws on empty string', () => {
      expect(() => validateString('', 'field')).toThrow(ValidationError);
    });

    it('throws on number', () => {
      expect(() => validateString(42, 'field')).toThrow(ValidationError);
    });

    it('includes field name in error message', () => {
      expect(() => validateString(null, 'MyField')).toThrow('MyField');
    });
  });

  describe('validateNonEmptyString', () => {
    it('returns a valid string', () => {
      expect(validateNonEmptyString('hello', 'field')).toBe('hello');
    });

    it('throws on whitespace-only string', () => {
      expect(() => validateNonEmptyString('   ', 'field')).toThrow(ValidationError);
    });

    it('throws on null', () => {
      expect(() => validateNonEmptyString(null, 'field')).toThrow(ValidationError);
    });

    it('accepts strings with leading/trailing whitespace but real content', () => {
      expect(validateNonEmptyString('  hello  ', 'field')).toBe('  hello  ');
    });
  });

  describe('validateCode', () => {
    it('returns valid code string', () => {
      expect(validateCode('function foo() {}')).toBe('function foo() {}');
    });

    it('throws on empty string', () => {
      expect(() => validateCode('')).toThrow(ValidationError);
    });

    it('throws on whitespace-only', () => {
      expect(() => validateCode('   ')).toThrow(ValidationError);
    });

    it('includes "Code" in error message', () => {
      expect(() => validateCode(null)).toThrow('Code');
    });
  });

  describe('validateOutputPath', () => {
    it('returns valid path', () => {
      expect(validateOutputPath('/tmp/output.html')).toBe('/tmp/output.html');
    });

    it('throws on empty string', () => {
      expect(() => validateOutputPath('')).toThrow(ValidationError);
    });

    it('uses custom message when provided', () => {
      expect(() => validateOutputPath('', 'Custom error')).toThrow('Custom error');
    });

    it('uses default message when custom not provided', () => {
      expect(() => validateOutputPath(null)).toThrow('Output path');
    });
  });

  describe('validatePrompt', () => {
    it('returns valid prompt', () => {
      expect(validatePrompt('make a cool shader')).toBe('make a cool shader');
    });

    it('throws on empty string', () => {
      expect(() => validatePrompt('')).toThrow(ValidationError);
    });

    it('throws on whitespace-only', () => {
      expect(() => validatePrompt('   ')).toThrow(ValidationError);
    });

    it('throws on null', () => {
      expect(() => validatePrompt(null)).toThrow(ValidationError);
    });
  });

  describe('validateOptionalString', () => {
    it('returns undefined for null', () => {
      expect(validateOptionalString(null, 'field')).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(validateOptionalString(undefined, 'field')).toBeUndefined();
    });

    it('returns the string when provided', () => {
      expect(validateOptionalString('hello', 'field')).toBe('hello');
    });

    it('throws on non-string value like a number', () => {
      expect(() => validateOptionalString(42, 'field')).toThrow(ValidationError);
    });

    it('throws on boolean', () => {
      expect(() => validateOptionalString(true, 'field')).toThrow(ValidationError);
    });
  });

  describe('validateNumber', () => {
    it('returns a valid number', () => {
      expect(validateNumber(42, 'amount')).toBe(42);
    });

    it('returns zero as valid', () => {
      expect(validateNumber(0, 'amount')).toBe(0);
    });

    it('returns negative as valid', () => {
      expect(validateNumber(-5, 'amount')).toBe(-5);
    });

    it('throws on NaN', () => {
      expect(() => validateNumber(NaN, 'amount')).toThrow(ValidationError);
    });

    it('throws on string', () => {
      expect(() => validateNumber('42', 'amount')).toThrow(ValidationError);
    });

    it('throws on null', () => {
      expect(() => validateNumber(null, 'amount')).toThrow(ValidationError);
    });

    it('includes name in error', () => {
      expect(() => validateNumber(NaN, 'MyNum')).toThrow('MyNum');
    });
  });

  describe('validateProjectName', () => {
    it('returns valid project name', () => {
      expect(validateProjectName('my-project')).toBe('my-project');
    });

    it('throws on empty string', () => {
      expect(() => validateProjectName('')).toThrow(ValidationError);
    });

    it('throws on null', () => {
      expect(() => validateProjectName(null)).toThrow(ValidationError);
    });

    it('throws on whitespace-only', () => {
      expect(() => validateProjectName('   ')).toThrow(ValidationError);
    });
  });
});
