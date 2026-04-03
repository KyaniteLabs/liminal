/**
 * Input validation utilities
 *
 * Centralized validation functions to replace duplicate patterns
 * found across the codebase.
 */

/**
 * Validates that input is a non-empty string
 * @param input - Value to validate
 * @param name - Name of the field for error messages
 * @returns The validated string
 * @throws Error if input is null, undefined, not a string, or empty
 */
export function validateString(input: unknown, name: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error(`${name} is required and must be a non-empty string`);
  }
  return input;
}

/**
 * Validates that input is a non-empty string after trimming
 * @param input - Value to validate
 * @param name - Name of the field for error messages
 * @returns The validated string (untrimmed)
 * @throws Error if input is null, undefined, not a string, or empty/whitespace-only
 */
export function validateNonEmptyString(input: unknown, name: string): string {
  if (!input || typeof input !== 'string' || input.trim() === '') {
    throw new Error(`${name} is required and must be a non-empty string`);
  }
  return input;
}

/**
 * Validates that input is a non-empty string after trimming (with custom error message)
 * @param input - Value to validate
 * @param name - Name of the field for error messages
 * @returns The validated string (untrimmed)
 * @throws Error with custom message based on field name
 */
export function validateCode(input: unknown): string {
  if (!input || typeof input !== 'string' || input.trim() === '') {
    throw new Error('Code is required and must be a non-empty string');
  }
  return input;
}

/**
 * Validates output path parameter
 * @param outputPath - Path to validate
 * @param customMessage - Optional custom error message
 * @returns The validated path
 * @throws Error if outputPath is invalid
 */
export function validateOutputPath(
  outputPath: unknown,
  customMessage?: string
): string {
  if (!outputPath || typeof outputPath !== 'string' || outputPath.trim() === '') {
    throw new Error(customMessage || 'Output path is required and must be a non-empty string');
  }
  return outputPath;
}

/**
 * Validates prompt input
 * @param prompt - Prompt to validate
 * @returns The validated prompt
 * @throws Error if prompt is null, undefined, not a string, or empty/whitespace-only
 */
export function validatePrompt(input: unknown): string {
  if (!input || typeof input !== 'string' || input.trim().length === 0) {
    throw new Error('Prompt is required and must be a non-empty string');
  }
  return input;
}

/**
 * Validates an optional string value
 * @param input - Value to validate
 * @param name - Name of the field for error messages
 * @returns The string value, or undefined if input is null/undefined
 * @throws Error if input is provided but not a string
 */
export function validateOptionalString(
  input: unknown,
  name: string
): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'string') {
    throw new Error(`${name} must be a string if provided`);
  }
  return input;
}

/**
 * Validates that input is a number
 * @param input - Value to validate
 * @param name - Name of the field for error messages
 * @returns The validated number
 * @throws Error if input is not a number or is NaN
 */
export function validateNumber(input: unknown, name: string): number {
  if (typeof input !== 'number' || isNaN(input)) {
    throw new Error(`${name} is required and must be a number`);
  }
  return input;
}

/**
 * Validates project name
 * @param name - Project name to validate
 * @returns The validated name
 * @throws Error if name is invalid
 */
export function validateProjectName(name: unknown): string {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('Project name is required');
  }
  return name;
}
