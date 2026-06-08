import type { DomainValidationResult } from './types.js';

export class TextGenValidator {
  private static readonly MIN_SIZE = 100;

  static getMinSize(): number {
    return this.MIN_SIZE;
  }

  static validate(code: string): DomainValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (trimmed.length < this.MIN_SIZE) {
      errors.push(`TextGen receipt is under ${this.MIN_SIZE} characters`);
    }

    const lines = trimmed.split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 3) {
      errors.push('TextGen receipt has fewer than 3 non-empty lines');
    }

    // Basic heuristic: check if it's too much like HTML or JS code rather than text/poetry
    // A single HTML tag is fine, but if it's wrapped in <html> or <!DOCTYPE>, that's not raw textgen
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      errors.push('TextGen output should be raw text, not an HTML document');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
