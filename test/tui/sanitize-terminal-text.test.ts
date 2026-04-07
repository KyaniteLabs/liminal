import { describe, expect, it } from 'vitest';
import { sanitizeTerminalText } from '../../src/tui/sanitizeTerminalText.js';

describe('sanitizeTerminalText', () => {
  it('strips ANSI escape sequences', () => {
    expect(sanitizeTerminalText('\x1b[31mError\x1b[0m')).toBe('Error');
  });

  it('removes carriage returns and control characters', () => {
    expect(sanitizeTerminalText('hello\rworld\u0007')).toBe('helloworld');
  });

  it('redacts prompt previews', () => {
    expect(sanitizeTerminalText('Prompt: my secret prompt text')).toContain('[redacted]');
  });

  it('truncates overly long text', () => {
    const result = sanitizeTerminalText('x'.repeat(250), { maxLength: 40 });
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result).toContain('…');
  });

  it('can normalize output to a single line', () => {
    expect(sanitizeTerminalText('line 1\nline 2', { singleLine: true })).toBe('line 1 line 2');
  });
});
