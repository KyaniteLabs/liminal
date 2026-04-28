import { describe, it, expect, beforeEach } from 'vitest';
import {
  SchemaValidator,
  initializeValidator,
} from '../../../src/guardrails/validation/SchemaValidator.js';
import type { SchemaDefinition } from '../../../src/guardrails/validation/SchemaValidator.js';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  const objectSchema: SchemaDefinition = {
    type: 'object',
    required: true,
    properties: {
      name: { type: 'string', required: true },
      age: { type: 'number', required: true },
      active: { type: 'boolean', required: false },
    },
  };

  const nestedSchema: SchemaDefinition = {
    type: 'object',
    required: true,
    properties: {
      user: {
        type: 'object',
        required: true,
        properties: {
          email: { type: 'string', required: true },
          profile: {
            type: 'object',
            required: false,
            properties: {
              bio: { type: 'string', required: false },
            },
          },
        },
      },
    },
  };

  const arraySchema: SchemaDefinition = {
    type: 'array',
    required: true,
    items: { type: 'string' },
    minItems: 1,
  };

  const stringSchema: SchemaDefinition = {
    type: 'string',
    required: true,
    minLength: 3,
  };

  const optionalSchema: SchemaDefinition = {
    type: 'object',
    required: true,
    properties: {
      requiredField: { type: 'string', required: true },
      optionalField: { type: 'string', required: false },
    },
  };

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  // ── validate() with valid data ──────────────────────────────────────

  describe('validate() — valid data', () => {
    it('passes when data matches object schema', () => {
      validator.registerSchema('person', objectSchema);
      const result = validator.validate('person', {
        name: 'Ada',
        age: 36,
        active: true,
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes when optional fields are omitted', () => {
      validator.registerSchema('person', objectSchema);
      const result = validator.validate('person', {
        name: 'Grace',
        age: 85,
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes a valid array against array schema', () => {
      validator.registerSchema('tags', arraySchema);
      const result = validator.validate('tags', ['alpha', 'beta']);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes a string meeting minLength', () => {
      validator.registerSchema('name', stringSchema);
      const result = validator.validate('name', 'Ada Lovelace');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes a boolean value', () => {
      const boolSchema: SchemaDefinition = { type: 'boolean', required: true };
      validator.registerSchema('flag', boolSchema);
      const result = validator.validate('flag', true);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes a number value', () => {
      const numSchema: SchemaDefinition = { type: 'number', required: true };
      validator.registerSchema('count', numSchema);
      const result = validator.validate('count', 42);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ── validate() with missing required fields ─────────────────────────

  describe('validate() — missing required fields', () => {
    it('fails when a top-level required field is missing', () => {
      validator.registerSchema('person', objectSchema);
      const result = validator.validate('person', { age: 30 });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('.name');
      expect(result.errors[0].code).toBe('REQUIRED');
      expect(result.errors[0].message).toBe('Required field missing');
    });

    it('fails when multiple required fields are missing', () => {
      validator.registerSchema('person', objectSchema);
      const result = validator.validate('person', {});

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      const paths = result.errors.map(e => e.path);
      expect(paths).toContain('.name');
      expect(paths).toContain('.age');
    });

    it('fails when a nested required field is missing', () => {
      validator.registerSchema('nested', nestedSchema);
      const result = validator.validate('nested', {
        user: { profile: {} },
      });

      expect(result.success).toBe(false);
      const emailError = result.errors.find(e => e.path === '.user.email');

      expect(emailError!.code).toBe('REQUIRED');
    });
  });

  // ── validate() with wrong types ─────────────────────────────────────

  describe('validate() — type mismatches', () => {
    it('fails when string field receives a number', () => {
      validator.registerSchema('person', objectSchema);
      const result = validator.validate('person', { name: 123, age: 30 });

      expect(result.success).toBe(false);
      expect(result.errors[0].path).toBe('.name');
      expect(result.errors[0].code).toBe('TYPE_MISMATCH');
      expect(result.errors[0].message).toContain('Expected string, got number');
    });

    it('fails when number field receives a string', () => {
      validator.registerSchema('person', objectSchema);
      const result = validator.validate('person', { name: 'Ada', age: 'thirty' });

      expect(result.success).toBe(false);
      expect(result.errors[0].path).toBe('.age');
      expect(result.errors[0].message).toContain('Expected number, got string');
    });

    it('fails when object is expected but array given', () => {
      validator.registerSchema('person', objectSchema);
      const result = validator.validate('person', ['not', 'an', 'object']);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('TYPE_MISMATCH');
      expect(result.errors[0].message).toContain('Expected object, got array');
    });

    it('fails when array is expected but object given', () => {
      validator.registerSchema('tags', arraySchema);
      const result = validator.validate('tags', { 0: 'not', 1: 'array' });

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('TYPE_MISMATCH');
      expect(result.errors[0].message).toContain('Expected array, got object');
    });

    it('fails when boolean is expected but string given', () => {
      const boolSchema: SchemaDefinition = { type: 'boolean', required: true };
      validator.registerSchema('flag', boolSchema);
      const result = validator.validate('flag', 'true');

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Expected boolean, got string');
    });
  });

  // ── nested object validation ────────────────────────────────────────

  describe('nested object validation', () => {
    it('validates deeply nested objects', () => {
      validator.registerSchema('nested', nestedSchema);
      const result = validator.validate('nested', {
        user: {
          email: 'ada@example.com',
          profile: { bio: 'Pioneer programmer' },
        },
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('collects errors at every nesting level', () => {
      validator.registerSchema('nested', nestedSchema);
      // user is an object but email (required) is missing; profile has wrong type for bio
      const result = validator.validate('nested', {
        user: { profile: { bio: 123 } },
      });

      expect(result.success).toBe(false);
      const paths = result.errors.map(e => e.path);
      expect(paths).toContain('.user.email');
      expect(paths).toContain('.user.profile.bio');
    });
  });

  // ── array validation ────────────────────────────────────────────────

  describe('array validation', () => {
    it('fails when array length is below minItems', () => {
      validator.registerSchema('tags', arraySchema);
      const result = validator.validate('tags', []);

      expect(result.success).toBe(false);
      const minErr = result.errors.find(e => e.code === 'MIN_ITEMS');

      expect(minErr!.message).toContain('min 1');
    });

    it('validates each array item against items schema', () => {
      const numArraySchema: SchemaDefinition = {
        type: 'array',
        required: true,
        items: { type: 'number' },
      };
      validator.registerSchema('nums', numArraySchema);
      const result = validator.validate('nums', [1, 'two', 3]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('[1]');
      expect(result.errors[0].code).toBe('TYPE_MISMATCH');
    });

    it('reports errors for multiple invalid items', () => {
      const numArraySchema: SchemaDefinition = {
        type: 'array',
        required: true,
        items: { type: 'number' },
      };
      validator.registerSchema('nums', numArraySchema);
      const result = validator.validate('nums', ['a', 'b']);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('passes array with items matching schema', () => {
      validator.registerSchema('tags', arraySchema);
      const result = validator.validate('tags', ['alpha']);

      expect(result.success).toBe(true);
    });
  });

  // ── string validation ───────────────────────────────────────────────

  describe('string validation', () => {
    it('fails when string is shorter than minLength', () => {
      validator.registerSchema('name', stringSchema);
      const result = validator.validate('name', 'ab');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MIN_LENGTH');
      expect(result.errors[0].message).toContain('min 3');
    });

    it('passes when string equals minLength exactly', () => {
      validator.registerSchema('name', stringSchema);
      const result = validator.validate('name', 'abc');

      expect(result.success).toBe(true);
    });

    it('passes when string exceeds minLength', () => {
      validator.registerSchema('name', stringSchema);
      const result = validator.validate('name', 'abcdefgh');

      expect(result.success).toBe(true);
    });
  });

  // ── unknown schema ──────────────────────────────────────────────────

  describe('unknown schema', () => {
    it('returns SCHEMA_NOT_FOUND when schema is not registered', () => {
      const result = validator.validate('nonexistent', { foo: 'bar' });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SCHEMA_NOT_FOUND');
      expect(result.errors[0].message).toContain("Schema 'nonexistent' not found");
    });
  });

  // ── validateJSON() ──────────────────────────────────────────────────

  describe('validateJSON()', () => {
    it('parses and validates a valid JSON string', () => {
      validator.registerSchema('person', objectSchema);
      const json = JSON.stringify({ name: 'Ada', age: 36 });
      const result = validator.validateJSON('person', json);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('parses valid JSON but reports schema violations', () => {
      validator.registerSchema('person', objectSchema);
      const json = JSON.stringify({ name: 42, age: 'wrong' });
      const result = validator.validateJSON('person', json);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('returns INVALID_JSON for malformed JSON', () => {
      validator.registerSchema('person', objectSchema);
      const result = validator.validateJSON('person', '{not valid json}');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_JSON');
    });

    it('returns SCHEMA_NOT_FOUND for unknown schema name', () => {
      const result = validator.validateJSON('ghost', '{"a":1}');

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('SCHEMA_NOT_FOUND');
    });
  });

  // ── edge cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns success for null data on a non-required field', () => {
      validator.registerSchema('opt', optionalSchema);
      const result = validator.validate('opt', { requiredField: 'present' });

      expect(result.success).toBe(true);
    });

    it('returns REQUIRED when root data is undefined and schema is required', () => {
      const rootRequired: SchemaDefinition = { type: 'string', required: true };
      validator.registerSchema('root', rootRequired);
      const result = validator.validate('root', undefined);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('REQUIRED');
    });

    it('returns success for null data when not required', () => {
      const optionalRoot: SchemaDefinition = { type: 'string', required: false };
      validator.registerSchema('optRoot', optionalRoot);
      const result = validator.validate('optRoot', null);

      // null is not undefined, and data !== undefined so it skips the required check,
      // then null !== undefined so it passes through; actualType 'object' != 'string'
      // Actually let's trace: required !== false → true; data === undefined? no.
      // data === undefined || data === null → true → returns success
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('handles empty object against schema with no required children', () => {
      const looseSchema: SchemaDefinition = {
        type: 'object',
        required: true,
        properties: {
          maybe: { type: 'string', required: false },
        },
      };
      validator.registerSchema('loose', looseSchema);
      const result = validator.validate('loose', {});

      expect(result.success).toBe(true);
    });

    it('handles empty array that meets minItems=0', () => {
      const flexibleArray: SchemaDefinition = {
        type: 'array',
        required: true,
        items: { type: 'string' },
      };
      validator.registerSchema('flexArr', flexibleArray);
      const result = validator.validate('flexArr', []);

      // no minItems constraint, so empty array is valid
      expect(result.success).toBe(true);
    });
  });

  // ── initializeValidator() factory ───────────────────────────────────

  describe('initializeValidator()', () => {
    it('registers the codeGeneration schema', () => {
      const v = initializeValidator();
      const result = v.validate('codeGeneration', {
        code: 'console.log("hi")',
        explanation: 'A hello world',
      });

      expect(result.success).toBe(true);
    });

    it('registers the testResult schema', () => {
      const v = initializeValidator();
      const result = v.validate('testResult', {
        passed: true,
        testName: 'should work',
      });

      expect(result.success).toBe(true);
    });

    it('codeGeneration schema rejects missing code field', () => {
      const v = initializeValidator();
      const result = v.validate('codeGeneration', {
        explanation: 'no code',
      });

      expect(result.success).toBe(false);
      const codeError = result.errors.find(e => e.path === '.code');
      expect(codeError).not.toBeNull();
    });

    it('testResult schema rejects wrong type for passed', () => {
      const v = initializeValidator();
      const result = v.validate('testResult', {
        passed: 'yes',
        testName: 'bad type',
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.path === '.passed')).toBe(true);
    });
  });
});
