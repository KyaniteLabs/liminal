import { describe, it, expect } from 'vitest';
import { DiffRenderer } from '../../../src/agent/DiffRenderer.js';

describe('DiffRenderer', () => {
  const renderer = new DiffRenderer();

  describe('diff', () => {
    it('marks identical inputs as identical', () => {
      const result = renderer.diff('hello\nworld', 'hello\nworld');
      expect(result.identical).toBe(true);
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('detects added lines', () => {
      const result = renderer.diff('a\nb', 'a\nb\nc');
      expect(result.identical).toBe(false);
      expect(result.added).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.lines[result.lines.length - 1]).toEqual({ type: 'added', content: 'c' });
    });

    it('detects removed lines', () => {
      const result = renderer.diff('a\nb\nc', 'a\nb');
      expect(result.removed).toBe(1);
      expect(result.added).toBe(0);
      expect(result.lines[result.lines.length - 1]).toEqual({ type: 'removed', content: 'c' });
    });

    it('detects changed lines as remove + add', () => {
      const result = renderer.diff('a\nold\nc', 'a\nnew\nc');
      expect(result.removed).toBe(1);
      expect(result.added).toBe(1);
    });

    it('handles empty old text (all added)', () => {
      // ''.split('\n') → [''] so LCS diffs [''] vs ['a','b']: 1 removed + 2 added
      const result = renderer.diff('', 'a\nb');
      expect(result.added).toBe(2);
      expect(result.removed).toBe(1);
    });

    it('handles empty new text (all removed)', () => {
      // reverse: ['a','b'] vs [''] → 2 removed + 1 added
      const result = renderer.diff('a\nb', '');
      expect(result.removed).toBe(2);
      expect(result.added).toBe(1);
    });

    it('handles both empty strings', () => {
      const result = renderer.diff('', '');
      expect(result.identical).toBe(true);
      expect(result.lines).toHaveLength(1); // single empty line
    });

    it('preserves unchanged lines', () => {
      const result = renderer.diff('a\nb\nc', 'a\nx\nc');
      const unchanged = result.lines.filter(l => l.type === 'unchanged');
      expect(unchanged).toHaveLength(2);
    });
  });

  describe('render', () => {
    it('renders identical inputs as "(no differences)"', () => {
      const result = renderer.diff('same', 'same');
      expect(renderer.render(result)).toBe('(no differences)');
    });

    it('prefixes added lines with "+ "', () => {
      const result = renderer.diff('', 'new line');
      const rendered = renderer.render(result);
      expect(rendered).toContain('+ new line');
    });

    it('prefixes removed lines with "- "', () => {
      const result = renderer.diff('old line', '');
      const rendered = renderer.render(result);
      expect(rendered).toContain('- old line');
    });

    it('prefixes unchanged lines with two spaces', () => {
      const result = renderer.diff('kept\nchanged', 'kept\nnew');
      const rendered = renderer.render(result);
      expect(rendered).toContain('  kept');
    });

    it('renders a multi-line diff correctly', () => {
      const result = renderer.diff('a\nb\nc', 'a\nx\nc');
      const rendered = renderer.render(result);
      expect(rendered).toContain('  a');
      expect(rendered).toContain('- b');
      expect(rendered).toContain('+ x');
      expect(rendered).toContain('  c');
    });
  });

  describe('large input fallback', () => {
    it('uses sequential diff for inputs exceeding MAX_LCS_LINES', () => {
      // Generate large inputs (6000 lines each, exceeding MAX_LCS_LINES=5000)
      const oldLines = Array.from({ length: 6000 }, (_, i) => `line ${i}`);
      const newLines = Array.from({ length: 6000 }, (_, i) => i === 3000 ? 'CHANGED' : `line ${i}`);
      const result = renderer.diff(oldLines.join('\n'), newLines.join('\n'));
      expect(result.identical).toBe(false);
      expect(result.added).toBe(1);
      expect(result.removed).toBe(1);
    });
  });
});
