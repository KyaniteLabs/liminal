/**
 * Validation Layer - Schema Enforcement
 * 
 * Validates LLM outputs against expected schemas.
 */

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export type SchemaDefinition = {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  required?: boolean;
  properties?: Record<string, SchemaDefinition>;
  items?: SchemaDefinition;
  minLength?: number;
  minItems?: number;
};

/**
 * Simple schema validator (JSON Schema-like)
 */
export class SchemaValidator {
  private schemas: Map<string, SchemaDefinition> = new Map();

  registerSchema(name: string, schema: SchemaDefinition): void {
    this.schemas.set(name, schema);
  }

  validate<T>(schemaName: string, data: unknown): ValidationResult<T> {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      return {
        success: false,
        errors: [{ path: '', message: `Schema '${schemaName}' not found`, code: 'SCHEMA_NOT_FOUND' }],
      };
    }

    const result = this.validateValue(schema, data, '');
    return result as ValidationResult<T>;
  }

  private validateValue(schema: SchemaDefinition, data: unknown, path: string): ValidationResult {
    const errors: ValidationError[] = [];

    // Check required
    if (schema.required !== false && data === undefined) {
      return {
        success: false,
        errors: [{ path, message: 'Required field missing', code: 'REQUIRED' }],
      };
    }

    if (data === undefined || data === null) {
      return { success: true, errors: [] };
    }

    // Type validation
    const actualType = Array.isArray(data) ? 'array' : typeof data;
    if (schema.type && actualType !== schema.type) {
      return {
        success: false,
        errors: [{ path, message: `Expected ${schema.type}, got ${actualType}`, code: 'TYPE_MISMATCH' }],
      };
    }

    // Object validation
    if (schema.type === 'object' && schema.properties) {
      const obj = data as Record<string, unknown>;
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const result = this.validateValue(propSchema, obj[key], `${path}.${key}`);
        if (!result.success) {
          errors.push(...result.errors);
        }
      }
    }

    // Array validation
    if (schema.type === 'array' && schema.items) {
      const arr = data as unknown[];
      if (schema.minItems && arr.length < schema.minItems) {
        errors.push({ path, message: `Array too short (min ${schema.minItems})`, code: 'MIN_ITEMS' });
      }
      arr.forEach((item, i) => {
        const result = this.validateValue(schema.items!, item, `${path}[${i}]`);
        if (!result.success) {
          errors.push(...result.errors);
        }
      });
    }

    // String validation
    if (schema.type === 'string' && schema.minLength) {
      const str = data as string;
      if (str.length < schema.minLength) {
        errors.push({ path, message: `String too short (min ${schema.minLength})`, code: 'MIN_LENGTH' });
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  validateJSON<T>(schemaName: string, jsonString: string): ValidationResult<T> {
    try {
      const parsed = JSON.parse(jsonString);
      return this.validate<T>(schemaName, parsed);
    } catch (error) {
      return {
        success: false,
        errors: [{ path: '', message: `Invalid JSON: ${error}`, code: 'INVALID_JSON' }],
      };
    }
  }
}

// Global validator
let globalValidator: SchemaValidator | null = null;

export function initializeValidator(): SchemaValidator {
  globalValidator = new SchemaValidator();
  
  // Register common schemas
  globalValidator.registerSchema('codeGeneration', {
    type: 'object',
    required: true,
    properties: {
      code: { type: 'string', required: true, minLength: 1 },
      explanation: { type: 'string', required: false },
      dependencies: { type: 'array', required: false, items: { type: 'string' } },
    },
  });
  
  globalValidator.registerSchema('testResult', {
    type: 'object',
    required: true,
    properties: {
      passed: { type: 'boolean', required: true },
      testName: { type: 'string', required: true },
      error: { type: 'string', required: false },
    },
  });
  
  return globalValidator;
}

export function getValidator(): SchemaValidator | null {
  return globalValidator;
}
