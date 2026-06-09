import { describe, it, expect } from 'vitest';
import { sanitizeTerminalText } from '../../../src/tui/sanitizeTerminalText.js';

describe('sanitizeTerminalText', () => {
  it('returns clean text unchanged', () => {
    expect(sanitizeTerminalText('hello world')).toBe('hello world');
  });

  it('strips ANSI color codes', () => {
    const input = '\x1B[31mred text\x1B[0m normal';
    expect(sanitizeTerminalText(input)).toBe('red text normal');
  });

  it('strips ANSI escape sequences', () => {
    const input = '\x1B[1mbold\x1B[0m';
    expect(sanitizeTerminalText(input)).toBe('bold');
  });

  it('strips OSC sequences', () => {
    const input = 'before\x1B]0;window-title\x07after';
    expect(sanitizeTerminalText(input)).toBe('beforeafter');
  });

  it('strips carriage returns', () => {
    const input = 'line1\r\nline2\r\nline3';
    expect(sanitizeTerminalText(input)).toBe('line1\nline2\nline3');
  });

  it('strips control characters', () => {
    const input = 'hello\x00world\x07end';
    expect(sanitizeTerminalText(input)).toBe('helloworldend');
  });

  it('redacts prompt preview lines', () => {
    const input = 'some text\nprompt: secret api key here\nmore text';
    const result = sanitizeTerminalText(input);
    expect(result).not.toContain('secret api key');
    expect(result).toContain('[redacted]');
  });

  it('redacts prompt= format', () => {
    const input = 'prompt= sensitive data';
    const result = sanitizeTerminalText(input);
    expect(result).not.toContain('sensitive data');
    expect(result).toContain('[redacted]');
  });

  it('collapses trailing whitespace before newlines', () => {
    const input = 'line1   \nline2';
    expect(sanitizeTerminalText(input)).toBe('line1\nline2');
  });

  it('collapses multiple consecutive newlines', () => {
    // The sanitization pipeline collapses trailing whitespace and excess newlines
    const input = 'line1\n\n\n\nline2';
    const result = sanitizeTerminalText(input);
    // Should not have 3+ consecutive newlines
    expect(result).not.toMatch(/\n{3,}/);
    expect(result).toContain('line1');
    expect(result).toContain('line2');
  });

  it('trims leading and trailing whitespace', () => {
    const input = '  hello  ';
    expect(sanitizeTerminalText(input)).toBe('hello');
  });

  it('truncates to maxLength with ellipsis', () => {
    const input = 'a'.repeat(200);
    const result = sanitizeTerminalText(input, { maxLength: 50 });
    expect(result.length).toBe(50);
    expect(result.endsWith('…')).toBe(true);
  });

  it('uses default maxLength of 160', () => {
    const input = 'a'.repeat(170);
    const result = sanitizeTerminalText(input);
    expect(result.length).toBe(160);
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not truncate short text', () => {
    const input = 'short';
    expect(sanitizeTerminalText(input, { maxLength: 100 })).toBe('short');
  });

  it('singleLine option collapses newlines to spaces', () => {
    const input = 'line1\nline2\nline3';
    expect(sanitizeTerminalText(input, { singleLine: true })).toBe('line1 line2 line3');
  });

  it('singleLine option collapses multiple spaces', () => {
    const input = 'word1   word2   word3';
    expect(sanitizeTerminalText(input, { singleLine: true })).toBe('word1 word2 word3');
  });

  it('singleLine with leading/trailing whitespace', () => {
    const input = '  hello\nworld  ';
    expect(sanitizeTerminalText(input, { singleLine: true })).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(sanitizeTerminalText('')).toBe('');
  });

  it('handles text with only ANSI codes', () => {
    const input = '\x1B[31m\x1B[0m';
    expect(sanitizeTerminalText(input)).toBe('');
  });

  it('maxLength=0 produces just ellipsis for non-empty', () => {
    const input = 'hello';
    const result = sanitizeTerminalText(input, { maxLength: 0 });
    expect(result).toBe('…');
  });

  it('combines singleLine and maxLength', () => {
    const input = 'a\n'.repeat(100);
    const result = sanitizeTerminalText(input, { singleLine: true, maxLength: 30 });
    expect(result).not.toContain('\n');
    expect(result.length).toBe(30);
    expect(result.endsWith('…')).toBe(true);
  });
});
