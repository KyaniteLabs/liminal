/**
 * DiffRenderer tests — LCS-based unified diff
 */
import { describe, it, expect } from 'vitest';
import { DiffRenderer } from '../../../src/agent/DiffRenderer.js';

describe('DiffRenderer', () => {
  describe('diff()', () => {
    it('returns identical for same text', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('hello\nworld', 'hello\nworld');
      expect(result.identical).toBe(true);
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('detects added lines', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('line1\nline2', 'line1\nline2\nline3');
      expect(result.added).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.identical).toBe(false);
      const addedLines = result.lines.filter(l => l.type === 'added');
      expect(addedLines[0].content).toBe('line3');
    });

    it('detects removed lines', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('line1\nline2\nline3', 'line1\nline3');
      expect(result.added).toBe(0);
      expect(result.removed).toBe(1);
      const removedLines = result.lines.filter(l => l.type === 'removed');
      expect(removedLines[0].content).toBe('line2');
    });

    it('detects mixed additions and removals', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('a\nb\nc', 'a\nx\nc');
      expect(result.added).toBe(1);
      expect(result.removed).toBe(1);
    });

    it('handles empty old text', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('', 'new content');
      // ''.split('\n') → [''], so LCS treats as replacing empty line with content
      expect(result.identical).toBe(false);
      expect(result.lines.length).toBeGreaterThanOrEqual(1);
      const addedContent = result.lines.filter(l => l.type === 'added').map(l => l.content);
      expect(addedContent).toContain('new content');
    });

    it('handles empty new text', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('old content', '');
      expect(result.identical).toBe(false);
      expect(result.lines.length).toBeGreaterThanOrEqual(1);
      const removedContent = result.lines.filter(l => l.type === 'removed').map(l => l.content);
      expect(removedContent).toContain('old content');
    });

    it('handles both empty', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('', '');
      // ''.split('\n') → [''], so LCS matches one empty line as unchanged
      expect(result.identical).toBe(true);
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });
  });

  describe('render()', () => {
    it('returns "(no differences)" for identical content', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('same', 'same');
      expect(dr.render(result)).toBe('(no differences)');
    });

    it('prefixes added lines with +', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('a', 'a\nb');
      const rendered = dr.render(result);
      expect(rendered).toContain('+ b');
    });

    it('prefixes removed lines with -', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('a\nb', 'a');
      const rendered = dr.render(result);
      expect(rendered).toContain('- b');
    });

    it('prefixes unchanged lines with spaces', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('a\nb', 'a\nc');
      const rendered = dr.render(result);
      expect(rendered).toContain('  a');
    });

    it('renders full diff output', () => {
      const dr = new DiffRenderer();
      const result = dr.diff('line1\nline2\nline3', 'line1\nchanged\nline3');
      const rendered = dr.render(result);
      expect(rendered).toContain('  line1');
      expect(rendered).toContain('- line2');
      expect(rendered).toContain('+ changed');
      expect(rendered).toContain('  line3');
    });
  });

  describe('size guard', () => {
    it('falls back to sequential diff for large inputs', () => {
      const dr = new DiffRenderer();
      // Generate inputs exceeding MAX_LCS_LINES (5000)
      const oldLines = Array.from({ length: 5001 }, (_, i) => `old-${i}`);
      const newLines = Array.from({ length: 5001 }, (_, i) => `new-${i}`);
      const oldText = oldLines.join('\n');
      const newText = newLines.join('\n');

      const result = dr.diff(oldText, newText);
      // Should not hang or crash; should produce meaningful output
      expect(result.identical).toBe(false);
      expect(result.lines.length).toBeGreaterThan(0);
      // Sequential diff marks first differing line as removed+added
      expect(result.removed).toBeGreaterThanOrEqual(1);
      expect(result.added).toBeGreaterThanOrEqual(1);
    });

    it('still uses LCS for inputs within limit', () => {
      const dr = new DiffRenderer();
      // Small input — should use full LCS
      const result = dr.diff('a\nb\nc', 'a\nx\nc');
      // LCS correctly identifies only 'b' removed, 'x' added
      expect(result.added).toBe(1);
      expect(result.removed).toBe(1);
      const addedLine = result.lines.find(l => l.type === 'added');
      expect(addedLine?.content).toBe('x');
    });
  });
});
