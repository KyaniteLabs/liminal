import { describe, it, expect } from 'vitest';
import { generateHTML } from '../../src/utils/generateHTML.js';

describe('generateHTML', () => {
  it('generates a basic HTML page with p5.js CDN', () => {
    const html = generateHTML({ code: 'function setup() {}' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('function setup() {}');
    expect(html).toContain('<title>p5.js Sketch</title>');
    expect(html).toContain('<main>');
  });

  it('escapes closing script tags', () => {
    const html = generateHTML({ code: 'var x = "</script>"' });
    expect(html).not.toContain('var x = "</script>"');
    expect(html).toContain('var x = "<\\/script>"');
  });

  it('includes p5.sound when requested', () => {
    const html = generateHTML({ code: 'function setup() {}', includeP5Sound: true });
    expect(html).toContain('p5.sound');
  });

  it('renders fullscreen mode without main tag', () => {
    const html = generateHTML({ code: 'function setup() {}', fullscreen: true });
    expect(html).not.toContain('<main>');
    expect(html).toContain('canvas { display: block; }');
  });

  it('detects AudioContext and adds sound comment', () => {
    const html = generateHTML({ code: 'new AudioContext()' });
    expect(html).toContain('Sound may require user click');
  });

  it('uses custom title and body style', () => {
    const html = generateHTML({
      code: 'function setup() {}',
      title: 'My Sketch',
      bodyStyle: 'background: red;',
    });
    expect(html).toContain('<title>My Sketch</title>');
    expect(html).toContain('background: red;');
  });
});
