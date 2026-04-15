import { describe, it, expect } from 'vitest';

import { KineticWrapper } from '../../../src/generators/kinetic/KineticWrapper.js';

describe('KineticWrapper', () => {
  it('wraps bare HTML body content in full document', () => {
    const result = KineticWrapper.wrap('<div>Hello</div>');
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html lang="en">');
    expect(result).toContain('<div>Hello</div>');
    expect(result).toContain('kinetic-canvas');
  });

  it('uses custom title when provided', () => {
    const result = KineticWrapper.wrap('<div>X</div>', { title: 'My Art' });
    expect(result).toContain('<title>My Art</title>');
  });

  it('defaults title to Kinetic Artwork', () => {
    const result = KineticWrapper.wrap('<div>X</div>');
    expect(result).toContain('<title>Kinetic Artwork</title>');
  });

  it('returns already-wrapped DOCTYPE documents unchanged', () => {
    const html = '<!DOCTYPE html><html><body><div>X</div></body></html>';
    const result = KineticWrapper.wrap(html);
    expect(result).toBe(html.trim());
  });

  it('returns already-wrapped <html>...</html> documents unchanged', () => {
    const html = '<html><head></head><body><div>X</div></body></html>';
    const result = KineticWrapper.wrap(html);
    expect(result).toBe(html.trim());
  });

  it('already-wrapped full HTML documents are returned unchanged', () => {
    const input = '<html><head><style>p{color:red}</style></head><body><p>Content</p></body></html>';
    const result = KineticWrapper.wrap(input);
    expect(result).toContain('<p>Content</p>');
    expect(result).toBe(input.trim());
  });

  it('includes security headers in wrapped output', () => {
    const result = KineticWrapper.wrap('<div>Test</div>');
    expect(result).toContain('X-Frame-Options');
    expect(result).toContain('X-Content-Type-Options');
    expect(result).toContain('Content-Security-Policy');
    expect(result).toContain('Referrer-Policy');
  });

  it('includes base reset styles', () => {
    const result = KineticWrapper.wrap('<div>Test</div>');
    expect(result).toContain('box-sizing: border-box');
    expect(result).toContain('overflow: hidden');
  });
});
