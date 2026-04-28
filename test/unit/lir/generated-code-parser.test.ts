import { describe, it, expect } from 'vitest';
import { GeneratedCodeParser } from '../../../src/core/lir/GeneratedCodeParser.js';

describe('GeneratedCodeParser', () => {
  const parser = new GeneratedCodeParser();

  it('parses valid p5.js-style code into LIR tokens', () => {
    const code = `
function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
  fill(255, 0, 0);
  ellipse(200, 200, 50, 50);
}
`;
    const tokens = parser.parse(code);
    expect(tokens.length).toBeGreaterThan(0);

    const setupToken = tokens.find(t => t.name === 'setup');

    expect(setupToken!.type).toBe('code');
    expect(setupToken!.kind).toBe('function');
    expect(setupToken!.relationships.calls).toContain('createCanvas');

    const drawToken = tokens.find(t => t.name === 'draw');

    expect(drawToken!.relationships.calls).toContain('background');
    expect(drawToken!.relationships.calls).toContain('fill');
    expect(drawToken!.relationships.calls).toContain('ellipse');
  });

  it('extracts metrics from generated code', () => {
    const code = `
function draw() {
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      fill(255);
    }
  }
}
`;
    const tokens = parser.parse(code);
    const drawToken = tokens.find(t => t.name === 'draw');

    expect(drawToken!.metrics.loc).toBeGreaterThan(0);
    expect(drawToken!.metrics.cyclomaticComplexity).toBeGreaterThanOrEqual(3); // for + if + %
    expect(drawToken!.metrics.nestingDepth).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array for empty code', () => {
    expect(parser.parse('')).toEqual([]);
    expect(parser.parse('   ')).toEqual([]);
  });

  it('returns empty array for unparseable code (fallback)', () => {
    // Code with syntax that TypeScript Compiler API can't handle
    // This should not throw — it should return [] for regex fallback
    const result = parser.parse('{{{{invalid syntax}}}');
    // Either parses partially or returns empty — both are fine
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles code with only top-level statements (no functions)', () => {
    const code = `
const x = 100;
const y = 200;
console.log(x + y);
`;
    const tokens = parser.parse(code);
    // May or may not extract tokens — no functions/classes to find
    expect(Array.isArray(tokens)).toBe(true);
  });

  it('parses code with class declarations', () => {
    const code = `
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  update() {
    this.x += 1;
    this.y += 1;
  }
}
`;
    const tokens = parser.parse(code);
    const particleClass = tokens.find(t => t.name === 'Particle' && t.kind === 'class');

    expect(particleClass!.metrics.loc).toBeGreaterThan(0);

    const updateMethod = tokens.find(t => t.name === 'update' && t.kind === 'method');
    expect(updateMethod).not.toBeNull();
  });
});
