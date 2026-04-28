import { describe, it, expect } from 'vitest';
import { HTMLWrapper } from '../../src/utils/htmlWrapper.js';

describe('HTMLWrapper Security Headers', () => {
  it('should produce valid HTML documents for all wrappers', () => {
    const p5Html = HTMLWrapper.wrap('function setup() {}', 'p5');
    const shaderHtml = HTMLWrapper.wrap('void main() { gl_FragColor = vec4(1.0); }', 'shader');
    const revideoHtml = HTMLWrapper.wrap('export const MyComp = () => <div />;', 'revideo');

    expect(p5Html).toContain('<!DOCTYPE html>');
    expect(p5Html).toContain('</html>');
    expect(shaderHtml).toContain('<!DOCTYPE html>');
    expect(shaderHtml).toContain('</html>');
    expect(revideoHtml).toContain('<!DOCTYPE html>');
    expect(revideoHtml).toContain('</html>');
  });

  it('should include charset meta tag in all wrappers', () => {
    const p5Html = HTMLWrapper.wrap('function setup() {}', 'p5');
    const shaderHtml = HTMLWrapper.wrap('void main() { gl_FragColor = vec4(1.0); }', 'shader');
    const revideoHtml = HTMLWrapper.wrap('export const MyComp = () => <div />;', 'revideo');

    expect(p5Html).toContain('charset="UTF-8"');
    expect(shaderHtml).toContain('charset="UTF-8"');
    expect(revideoHtml).toContain('charset="UTF-8"');
  });

  it('should include viewport meta tag in all wrappers', () => {
    const p5Html = HTMLWrapper.wrap('function setup() {}', 'p5');
    const shaderHtml = HTMLWrapper.wrap('void main() { gl_FragColor = vec4(1.0); }', 'shader');
    const revideoHtml = HTMLWrapper.wrap('export const MyComp = () => <div />;', 'revideo');

    expect(p5Html).toContain('viewport');
    expect(shaderHtml).toContain('viewport');
    expect(revideoHtml).toContain('viewport');
  });

  it('should include lang attribute on html element', () => {
    const p5Html = HTMLWrapper.wrap('function setup() {}', 'p5');
    const shaderHtml = HTMLWrapper.wrap('void main() { gl_FragColor = vec4(1.0); }', 'shader');
    const revideoHtml = HTMLWrapper.wrap('export const MyComp = () => <div />;', 'revideo');

    expect(p5Html).toContain('<html lang="en">');
    expect(shaderHtml).toContain('<html lang="en">');
    expect(revideoHtml).toContain('<html lang="en">');
  });

  it('should use trusted CDN for p5.js scripts', () => {
    const p5Html = HTMLWrapper.wrap('function setup() {}', 'p5');
    expect(p5Html).toContain('cdnjs.cloudflare.com');
  });

  it('should not include unsafe-eval in script sources', () => {
    const html = HTMLWrapper.wrap('function setup() {}', 'p5');
    expect(html).not.toContain('unsafe-eval');
  });

  it('should not allow wildcard script sources', () => {
    const html = HTMLWrapper.wrap('function setup() {}', 'p5');
    // Should not allow scripts from any domain
    expect(html).not.toMatch(/script-src[^;]*\*[^;]*;/);
  });
});
