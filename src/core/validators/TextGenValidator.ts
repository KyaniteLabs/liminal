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

    // Reject flat-list output: text art (concrete poetry, cascades, typographic
    // compositions) needs varied line lengths to produce a visible silhouette.
    // A receipt where every line is the same length looks like a code snippet,
    // not a composition. Require at least 3 distinct line lengths among the
    // non-empty lines so the generator retries with a more compositional shape.
    if (lines.length >= 3) {
      const distinctLengths = new Set(lines.map((line) => line.length));
      if (distinctLengths.size < 3) {
        errors.push(
          `TextGen receipt has too-uniform line lengths (${distinctLengths.size} distinct); text art needs varied line lengths to compose a shape`,
        );
      }
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
