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
});
