import { describe, it, expect } from 'vitest';
import { HTMLWrapper } from '../../src/utils/htmlWrapper.js';

describe('HTMLWrapper Security Headers', () => {
  it('should include X-Frame-Options in all wrappers', () => {
    const p5Html = HTMLWrapper.wrap('function setup() {}', 'p5');
    const shaderHtml = HTMLWrapper.wrap('void main() { gl_FragColor = vec4(1.0); }', 'shader');
    const remotionHtml = HTMLWrapper.wrap('export const MyComp = () => <div />;', 'remotion');
    
    expect(p5Html).toContain('X-Frame-Options');
    expect(p5Html).toContain('DENY');
    expect(shaderHtml).toContain('X-Frame-Options');
    expect(shaderHtml).toContain('DENY');
    expect(remotionHtml).toContain('X-Frame-Options');
    expect(remotionHtml).toContain('DENY');
  });

  it('should include X-Content-Type-Options in all wrappers', () => {
    const p5Html = HTMLWrapper.wrap('function setup() {}', 'p5');
    const shaderHtml = HTMLWrapper.wrap('void main() { gl_FragColor = vec4(1.0); }', 'shader');
    const remotionHtml = HTMLWrapper.wrap('export const MyComp = () => <div />;', 'remotion');
    
    expect(p5Html).toContain('X-Content-Type-Options');
    expect(p5Html).toContain('nosniff');
    expect(shaderHtml).toContain('X-Content-Type-Options');
    expect(shaderHtml).toContain('nosniff');
    expect(remotionHtml).toContain('X-Content-Type-Options');
    expect(remotionHtml).toContain('nosniff');
  });

  it('should include Referrer-Policy in all wrappers', () => {
    const p5Html = HTMLWrapper.wrap('function setup() {}', 'p5');
    const shaderHtml = HTMLWrapper.wrap('void main() { gl_FragColor = vec4(1.0); }', 'shader');
    const remotionHtml = HTMLWrapper.wrap('export const MyComp = () => <div />;', 'remotion');
    
    expect(p5Html).toContain('Referrer-Policy');
    expect(p5Html).toContain('strict-origin-when-cross-origin');
    expect(shaderHtml).toContain('Referrer-Policy');
    expect(shaderHtml).toContain('strict-origin-when-cross-origin');
    expect(remotionHtml).toContain('Referrer-Policy');
    expect(remotionHtml).toContain('strict-origin-when-cross-origin');
  });

  it('should include CSP in all wrappers', () => {
    const p5Html = HTMLWrapper.wrap('function setup() {}', 'p5');
    const shaderHtml = HTMLWrapper.wrap('void main() { gl_FragColor = vec4(1.0); }', 'shader');
    const remotionHtml = HTMLWrapper.wrap('export const MyComp = () => <div />;', 'remotion');
    
    expect(p5Html).toContain('Content-Security-Policy');
    expect(shaderHtml).toContain('Content-Security-Policy');
    expect(remotionHtml).toContain('Content-Security-Policy');
  });

  it('should use strict CSP that blocks external scripts except CDN', () => {
    const p5Html = HTMLWrapper.wrap('function setup() {}', 'p5');
    // Should have restrictive CSP
    expect(p5Html).toContain("default-src 'none'");
    expect(p5Html).toContain("connect-src 'none'");
    expect(p5Html).toContain('cdnjs.cloudflare.com');
  });

  it('should prevent inline script execution with unsafe-eval', () => {
    const html = HTMLWrapper.wrap('function setup() {}', 'p5');
    // CSP should block unsafe-eval
    expect(html).toContain('Content-Security-Policy');
    expect(html).not.toContain('unsafe-eval');
  });

  it('should not allow wildcard script sources', () => {
    const html = HTMLWrapper.wrap('function setup() {}', 'p5');
    // Should not allow scripts from any domain
    expect(html).not.toMatch(/script-src[^;]*\*[^;]*;/);
  });
});
