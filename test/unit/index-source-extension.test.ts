import { describe, expect, it } from 'vitest';
import { getSourceFileExtension } from '../../src/index.js';

describe('generation source file extension', () => {
  it('saves raw SVG artifacts with an .svg extension instead of .js', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" fill="#4A90D9"/></svg>';

    expect(getSourceFileExtension(svg)).toBe('svg');
  });
});
