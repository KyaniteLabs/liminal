import { describe, it, expect } from 'vitest';
import { CellularAutomata } from '../../../src/generators/p5/CellularAutomata.js';

// ---------------------------------------------------------------------------
// Output type and basic structure
// ---------------------------------------------------------------------------
describe('CellularAutomata.generate', () => {
  it('returns a string', () => {
    const result = CellularAutomata.generate();
    expect(typeof result).toBe('string');
  });

  it('returns a non-empty string by default', () => {
    const result = CellularAutomata.generate();
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns a string when called with empty object', () => {
    const result = CellularAutomata.generate({});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns a string when called with null', () => {
    const result = CellularAutomata.generate(null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns a string when called with undefined', () => {
    const result = CellularAutomata.generate(undefined);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns a string when called with invalid type (number)', () => {
    const result = CellularAutomata.generate(42);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// p5.js structural patterns
// ---------------------------------------------------------------------------
describe('CellularAutomata output contains p5.js structure', () => {
  it('contains function setup()', () => {
    const result = CellularAutomata.generate();
    expect(result).toMatch(/function\s+setup\s*\(/);
  });

  it('contains function draw()', () => {
    const result = CellularAutomata.generate();
    expect(result).toMatch(/function\s+draw\s*\(/);
  });

  it('contains createCanvas()', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('createCanvas');
  });

  it('contains colorMode()', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('colorMode');
  });

  it('contains grid variable declarations', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('let grid');
    expect(result).toContain('let nextGrid');
  });

  it('contains resolution variable', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('resolution');
  });

  it('contains createGrid function', () => {
    const result = CellularAutomata.generate();
    expect(result).toMatch(/function\s+createGrid/);
  });

  it('contains updateGrid function', () => {
    const result = CellularAutomata.generate();
    expect(result).toMatch(/function\s+updateGrid/);
  });

  it('contains a render function', () => {
    const result = CellularAutomata.generate();
    expect(result).toMatch(/function\s+render/);
  });
});

// ---------------------------------------------------------------------------
// Cellular automata domain-specific content
// ---------------------------------------------------------------------------
describe('CellularAutomata output contains CA-specific code', () => {
  it('contains cols and rows computed from canvas size', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('cols');
    expect(result).toContain('rows');
  });

  it('contains background() call in draw', () => {
    const result = CellularAutomata.generate();
    expect(result).toMatch(/background\s*\(/);
  });

  it('contains grid swap logic (temp variable)', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('let temp = grid');
  });

  it('contains noStroke() for cell rendering', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('noStroke()');
  });

  it('contains rect() call for cell drawing', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('rect(');
  });
});

// ---------------------------------------------------------------------------
// Default parameters embed correct values
// ---------------------------------------------------------------------------
describe('CellularAutomata default config values', () => {
  it('uses 600x600 canvas by default', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('createCanvas(600, 600)');
  });

  it('uses resolution 5 by default', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('let resolution = 5');
  });

  it('uses radius 15 by default', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('let radius = 15');
  });

  it('uses RGB colorMode by default', () => {
    const result = CellularAutomata.generate();
    expect(result).toContain('colorMode(RGB)');
  });
});

// ---------------------------------------------------------------------------
// Type: lenia (default)
// ---------------------------------------------------------------------------
describe('CellularAutomata lenia type', () => {
  it('includes kernelWeight function for lenia type', () => {
    const result = CellularAutomata.generate({ type: 'lenia' });
    expect(result).toMatch(/function\s+kernelWeight/);
  });

  it('includes computeNeighborhood for lenia type', () => {
    const result = CellularAutomata.generate({ type: 'lenia' });
    expect(result).toMatch(/function\s+computeNeighborhood/);
  });

  it('includes applyGrowthFunction for lenia type', () => {
    const result = CellularAutomata.generate({ type: 'lenia' });
    expect(result).toMatch(/function\s+applyGrowthFunction/);
  });

  it('includes sigmoid activation by default', () => {
    const result = CellularAutomata.generate({ type: 'lenia' });
    expect(result).toContain('1 / (1 + exp(');
  });

  it('includes lerp for smooth transitions when smoothing is true', () => {
    const result = CellularAutomata.generate({ type: 'lenia', smoothing: true });
    expect(result).toContain('lerp(state, newState');
  });

  it('uses direct update when smoothing is false', () => {
    const result = CellularAutomata.generate({ type: 'lenia', smoothing: false });
    expect(result).toContain('Direct update');
    expect(result).not.toContain('lerp(state, newState');
  });

  it('contains Lenia comment in header', () => {
    const result = CellularAutomata.generate({ type: 'lenia' });
    expect(result).toContain('Lenia-style continuous CA');
  });
});

// ---------------------------------------------------------------------------
// Type: game-of-life
// ---------------------------------------------------------------------------
describe('CellularAutomata game-of-life type', () => {
  it('includes countNeighbors function', () => {
    const result = CellularAutomata.generate({ type: 'game-of-life' });
    expect(result).toMatch(/function\s+countNeighbors/);
  });

  it('includes Game of Life rules (neighbors === 3)', () => {
    const result = CellularAutomata.generate({ type: 'game-of-life' });
    expect(result).toContain('neighbors === 3');
  });

  it('includes Game of Life rules (neighbors < 2 or > 3)', () => {
    const result = CellularAutomata.generate({ type: 'game-of-life' });
    expect(result).toMatch(/neighbors\s*<\s*2/);
    expect(result).toMatch(/neighbors\s*>\s*3/);
  });

  it('does NOT include kernelWeight for game-of-life', () => {
    const result = CellularAutomata.generate({ type: 'game-of-life' });
    expect(result).not.toMatch(/function\s+kernelWeight/);
  });

  it('does NOT contain Lenia comment for game-of-life', () => {
    const result = CellularAutomata.generate({ type: 'game-of-life' });
    expect(result).not.toContain('Lenia-style continuous CA');
  });
});

// ---------------------------------------------------------------------------
// Different configurations produce different outputs
// ---------------------------------------------------------------------------
describe('CellularAutomata different configs produce different code', () => {
  it('lenia and game-of-life produce different outputs', () => {
    const lenia = CellularAutomata.generate({ type: 'lenia' });
    const gol = CellularAutomata.generate({ type: 'game-of-life' });
    expect(lenia).not.toBe(gol);
  });

  it('different resolutions produce different code', () => {
    const low = CellularAutomata.generate({ resolution: 2 });
    const high = CellularAutomata.generate({ resolution: 20 });
    expect(low).toContain('let resolution = 2');
    expect(high).toContain('let resolution = 20');
  });

  it('different canvas sizes produce different code', () => {
    const small = CellularAutomata.generate({ width: 200, height: 200 });
    const large = CellularAutomata.generate({ width: 800, height: 800 });
    expect(small).toContain('createCanvas(200, 200)');
    expect(large).toContain('createCanvas(800, 800)');
  });

  it('different palettes produce different color expressions', () => {
    const bio = CellularAutomata.generate({ palette: 'bioluminescent' });
    const thermal = CellularAutomata.generate({ palette: 'thermal' });
    expect(bio).toContain('state * 50, state * 255, state * 200');
    expect(thermal).toContain('state * 255, state * 100, state * 50');
  });

  it('different activations produce different code', () => {
    const sigmoid = CellularAutomata.generate({ activation: 'sigmoid' });
    const tanh = CellularAutomata.generate({ activation: 'tanh' });
    expect(sigmoid).toContain('1 / (1 + exp(');
    expect(tanh).toContain('tanh(');
  });

  it('different kernels produce different kernel code', () => {
    const ring = CellularAutomata.generate({ type: 'lenia', kernel: 'ring' });
    const gaussian = CellularAutomata.generate({ type: 'lenia', kernel: 'gaussian' });
    expect(ring).toContain('Ring kernel');
    expect(gaussian).toContain('Gaussian kernel');
  });

  it('mouse interaction adds mouseIsPressed code', () => {
    const withMouse = CellularAutomata.generate({ mouseInteraction: true });
    const withoutMouse = CellularAutomata.generate({ mouseInteraction: false });
    expect(withMouse).toContain('mouseIsPressed');
    expect(withoutMouse).not.toContain('mouseIsPressed');
  });

  it('mutation adds random mutation code', () => {
    const withMutation = CellularAutomata.generate({ mutationRate: 0.01, mutationStrength: 0.1 });
    const withoutMutation = CellularAutomata.generate({ mutationRate: 0, mutationStrength: 0 });
    expect(withMutation).toContain('Apply random mutation');
    expect(withoutMutation).not.toContain('Apply random mutation');
  });
});

// ---------------------------------------------------------------------------
// Initial patterns
// ---------------------------------------------------------------------------
describe('CellularAutomata initial patterns', () => {
  it('random pattern uses random(1)', () => {
    const result = CellularAutomata.generate({ initialPattern: 'random' });
    expect(result).toContain('random(1)');
    expect(result).toContain('Random initialization');
  });

  it('center pattern uses distance-from-center calculation', () => {
    const result = CellularAutomata.generate({ initialPattern: 'center' });
    expect(result).toContain('cols / 2');
    expect(result).toContain('exp(-dist');
  });

  it('symmetric pattern uses angular symmetry', () => {
    const result = CellularAutomata.generate({ initialPattern: 'symmetric', symmetry: 8 });
    expect(result).toContain('8-fold');
    expect(result).toContain('atan2');
  });

  it('custom pattern uses customPattern string when provided', () => {
    const result = CellularAutomata.generate({
      initialPattern: 'custom',
      customPattern: 'grid[0][0] = 1;'
    });
    expect(result).toContain('grid[0][0] = 1;');
  });
});

// ---------------------------------------------------------------------------
// Render modes
// ---------------------------------------------------------------------------
describe('CellularAutomata render modes', () => {
  it('cells mode calls renderCells()', () => {
    const result = CellularAutomata.generate({ renderMode: 'cells' });
    expect(result).toContain('renderCells()');
  });

  it('heatmap mode calls renderHeatmap()', () => {
    const result = CellularAutomata.generate({ renderMode: 'heatmap' });
    expect(result).toContain('renderHeatmap()');
  });

  it('contours mode calls renderContours()', () => {
    const result = CellularAutomata.generate({ renderMode: 'contours' });
    expect(result).toContain('renderContours()');
  });

  it('all render mode outputs contain their respective function definitions', () => {
    const cells = CellularAutomata.generate({ renderMode: 'cells' });
    const heatmap = CellularAutomata.generate({ renderMode: 'heatmap' });
    const contours = CellularAutomata.generate({ renderMode: 'contours' });

    expect(cells).toMatch(/function\s+renderCells/);
    expect(heatmap).toMatch(/function\s+renderHeatmap/);
    expect(contours).toMatch(/function\s+renderContours/);
  });
});

// ---------------------------------------------------------------------------
// Edge cases with bad parameters
// ---------------------------------------------------------------------------
describe('CellularAutomata handles edge cases', () => {
  it('clamps negative resolution to 0 minimum (uses Math.max)', () => {
    const result = CellularAutomata.generate({ resolution: -5 });
    // Math.max(0, -5) = 0, then Math.floor(0) = 0, Math.max(1, 0) = 1
    expect(result).toContain('let resolution = 1');
  });

  it('handles NaN resolution by using default', () => {
    const result = CellularAutomata.generate({ resolution: NaN });
    expect(result).toContain('let resolution = 5');
  });

  it('handles Infinity resolution by using default', () => {
    const result = CellularAutomata.generate({ resolution: Infinity });
    expect(result).toContain('let resolution = 5');
  });

  it('handles string type for numeric fields by using defaults', () => {
    const result = CellularAutomata.generate({ width: 'not-a-number' as unknown });
    expect(result).toContain('createCanvas(600, 600)');
  });

  it('handles description and includes it in output', () => {
    const result = CellularAutomata.generate({ description: 'Test CA simulation' });
    expect(result).toContain('Description: Test CA simulation');
  });

  it('truncates long descriptions to 100 chars', () => {
    const longDesc = 'A'.repeat(200);
    const result = CellularAutomata.generate({ description: longDesc });
    // substring(0, 100) means the description line has exactly 100 A's
    expect(result).toContain('A'.repeat(100));
    expect(result).not.toContain('A'.repeat(101));
  });
});
