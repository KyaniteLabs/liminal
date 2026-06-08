import { describe, it, expect } from 'vitest';
import { TextGenValidator } from '../../../src/core/validators/TextGenValidator.js';

describe('TextGenValidator', () => {
  it('validates a proper text output', () => {
    const code = `
Line 1: A threshold machine
Line 2: learning its own name
Line 3: in the dark
` + 'A'.repeat(100);
    const result = TextGenValidator.validate(code);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails if under 100 characters', () => {
    const code = `
Line 1
Line 2
Line 3
    `;
    const result = TextGenValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('TextGen receipt is under 100 characters');
  });

  it('fails if fewer than 3 non-empty lines', () => {
    const code = `Line 1
` + 'A'.repeat(100);
    const result = TextGenValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('TextGen receipt has fewer than 3 non-empty lines');
  });

  it('fails if output is an HTML document', () => {
    const code = `<!DOCTYPE html>
<html>
  <body>
    Hello World
  </body>
</html>
` + 'A'.repeat(100);
    const result = TextGenValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('TextGen output should be raw text, not an HTML document');
  });
});
