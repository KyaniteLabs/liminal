import { describe, it, expect } from 'vitest';
import { mergeSketchCode } from '../../src/utils/mergeSketchCode.js';

describe('mergeSketchCode', () => {
  const codeWithSetup = \`
let x = 10;
function setup() {
  createCanvas(400, 400);
}
\`;

  const codeWithDraw = \`
function draw() {
  background(200);
  ellipse(x, y, 50, 50);
}
\`;

  it('merges setup from A and draw from B', () => {
    const result = mergeSketchCode(codeWithSetup, codeWithDraw);
    expect(result).toContain('// Merged sketch');
    expect(result).toContain('function setup()');
    expect(result).toContain('function draw()');
  });

  it('extracts global variables from codeA', () => {
    const result = mergeSketchCode(codeWithSetup, codeWithDraw);
    expect(result).toContain('let x = 10');
  });

  it('falls back to codeB when setup not found in A', () => {
    const result = mergeSketchCode('no setup here', codeWithDraw);
    expect(result).toContain('// merge (fallback to codeB)');
    expect(result).toContain('function draw()');
  });

  it('falls back to codeB when draw not found in B', () => {
    const result = mergeSketchCode(codeWithSetup, 'no draw here');
    expect(result).toContain('// merge (fallback to codeB)');
  });

  it('handles arrow function setup', () => {
    const arrowSetup = 'const setup = () => { createCanvas(400, 400); };';
    const result = mergeSketchCode(arrowSetup, codeWithDraw);
    expect(result).toContain('const setup');
    expect(result).toContain('function draw()');
  });

  it('handles arrow function draw', () => {
    const arrowDraw = 'const draw = () => { background(200); };';
    const result = mergeSketchCode(codeWithSetup, arrowDraw);
    expect(result).toContain('function setup()');
    expect(result).toContain('const draw');
  });

  it('handles both arrow functions', () => {
    const arrowSetup = 'const setup = () => { createCanvas(400, 400); };';
    const arrowDraw = 'const draw = () => { background(200); };';
    const result = mergeSketchCode(arrowSetup, arrowDraw);
    expect(result).toContain('const setup');
    expect(result).toContain('const draw');
  });

  it('handles empty codeA and codeB', () => {
    const result = mergeSketchCode('', '');
    expect(result).toContain('// merge (fallback to codeB)');
  });

  it('handles helper functions from codeB', () => {
    const codeBwithHelper = \`
function draw() {
  background(200);
  myHelper();
}
function myHelper() {
  return 42;
}
\`;
    const result = mergeSketchCode(codeWithSetup, codeBwithHelper);
    expect(result).toContain('myHelper');
  });

  it('handles setup with parameters', () => {
    const paramSetup = 'function setup(p5) { p5.createCanvas(400, 400); }';
    const result = mergeSketchCode(paramSetup, codeWithDraw);
    expect(result).toContain('function setup(p5)');
  });

  it('handles codeA with no globals before first function', () => {
    const noGlobals = 'function setup() { createCanvas(400, 400); }';
    const result = mergeSketchCode(noGlobals, codeWithDraw);
    expect(result).toContain('function setup()');
    expect(result).toContain('function draw()');
    expect(result).not.toContain('undefined');
  });
});
