/**
 * FlowField generator tests
 */

import { FlowField } from '../../src/generators/p5/FlowField.js';

describe('FlowField', () => {
  it('generate() returns valid p5.js code', () => {
    const code = FlowField.generate();
    expect(code).toContain('function setup()');
    expect(code).toContain('function draw()');
    expect(code).toContain('createCanvas');
  });

  it('generate() uses noise for flow field', () => {
    const code = FlowField.generate();
    expect(code).toContain('noise(');
  });

  it('generate() includes FlowParticle class', () => {
    const code = FlowField.generate();
    expect(code).toContain('class FlowParticle');
  });

  it('generate() accepts custom params', () => {
    const code = FlowField.generate({
      particleCount: 1000,
      scale: 0.01,
      speed: 3,
      trailAlpha: 20,
    });
    expect(code).toContain('1000');
    expect(code).toContain('0.01');
    expect(code).toContain('3');
    expect(code).toContain('20');
  });

  it('generate() applies palette to particle color', () => {
    const coolCode = FlowField.generate({ palette: 'cool' });
    expect(coolCode).toMatch(/random\(50,\s*150\)/);
    expect(coolCode).toMatch(/255/);

    const warmCode = FlowField.generate({ palette: 'warm' });
    expect(warmCode).toMatch(/random\(100,\s*200\)/);
  });

  it('generate() handles null/undefined params', () => {
    const code = FlowField.generate(null);
    expect(code).toContain('function setup()');

    const code2 = FlowField.generate(undefined);
    expect(code2).toContain('function setup()');
  });

  it('generate() handles string params gracefully', () => {
    const code = FlowField.generate('not an object');
    expect(code).toContain('function setup()');
  });
});
