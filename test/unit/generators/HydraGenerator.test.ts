import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HydraGenerator } from '../../../src/generators/hydra/HydraGenerator.js';

// Access protected/private methods via a test subclass
class TestableHydraGenerator extends HydraGenerator {
  public testValidate(code: string) {
    return this.validateOutput(code);
  }

  public testSanitize(code: string) {
    return (this as any).sanitizeCode(code);
  }
}

// ---------------------------------------------------------------------------
// validateOutput
// ---------------------------------------------------------------------------
describe('HydraGenerator.validateOutput', () => {
  let gen: TestableHydraGenerator;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    gen = new TestableHydraGenerator();
  });

  it('accepts code with osc() call', () => {
    expect(gen.testValidate('osc(10, 0.1, 0.5).out();').valid).toBe(true);
  });

  it('accepts code with shape() call', () => {
    expect(gen.testValidate('shape(4).rotate(0, 0.1).out();').valid).toBe(true);
  });

  it('accepts code with noise() call', () => {
    expect(gen.testValidate('noise(3).out();').valid).toBe(true);
  });

  it('accepts code with voronoi() call', () => {
    expect(gen.testValidate('voronoi(5, 0.3).out();').valid).toBe(true);
  });

  it('accepts code with src() call', () => {
    expect(gen.testValidate('src(o0).out();').valid).toBe(true);
  });

  it('accepts code with render() call', () => {
    expect(gen.testValidate('render(o0);').valid).toBe(true);
  });

  it('accepts code with .out() call', () => {
    expect(gen.testValidate('osc().out(o0);').valid).toBe(true);
  });

  it('rejects code with no Hydra syntax', () => {
    const result = gen.testValidate('const x = 42; console.log(x);');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('No Hydra syntax found');
  });

  it('rejects empty code', () => {
    const result = gen.testValidate('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('No Hydra syntax found');
  });

  it('is case-sensitive for Hydra keywords', () => {
    expect(gen.testValidate('OSC(10).OUT();').valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeCode
// ---------------------------------------------------------------------------
describe('HydraGenerator.sanitizeCode', () => {
  let gen: TestableHydraGenerator;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    gen = new TestableHydraGenerator();
  });

  it('strips think tags and their content', () => {
    const input = 'osc(10, 0.1, 0.5).out();\n<think\nreasoning\n</think\nnoise(3).out();';
    const result = gen.testSanitize(input);
    expect(result).not.toContain('<think');
    expect(result).toContain('osc(');
    expect(result).toContain('noise(');
  });

  it('strips markdown code fences', () => {
    const input = '```javascript\nosc(10).out();\n```';
    const result = gen.testSanitize(input);
    expect(result).not.toContain('```');
    expect(result).toContain('osc(');
  });

  it('strips HTML comments', () => {
    const input = '<!-- comment -->\nnoise(3).out();';
    const result = gen.testSanitize(input);
    expect(result).not.toContain('<!--');
    expect(result).toContain('noise(');
  });

  it('skips explanation lines without code punctuation', () => {
    const input = 'This is just an explanation\nosc(10, 0.1, 0.5).out();';
    const result = gen.testSanitize(input);
    expect(result).not.toContain('This is just');
    expect(result).toContain('osc(');
  });

  it('appends .out(o0) when no out or render call exists', () => {
    const input = 'osc(10, 0.1, 0.5);\nnoise(3);';
    const result = gen.testSanitize(input);
    expect(result).toContain('.out(o0)');
  });

  it('does not double-append .out(o0) when one already exists', () => {
    const input = 'osc(10).out(o0);';
    const result = gen.testSanitize(input);
    const outCount = (result.match(/\.out\(/g) || []).length;
    expect(outCount).toBe(1);
  });

  it('appends render(o0) when multiple out targets exist without render', () => {
    const input = 'osc(10).out(o0);\nnoise(3).out(o1);';
    const result = gen.testSanitize(input);
    expect(result).toContain('render(o0)');
  });

  it('does not double-append render when one already exists', () => {
    const input = 'osc(10).out(o0);\nnoise(3).out(o1);\nrender(o0);';
    const result = gen.testSanitize(input);
    const renderCount = (result.match(/render\(/g) || []).length;
    expect(renderCount).toBe(1);
  });

  it('strips leading empty lines', () => {
    const input = '\n\n\nosc(10).out();';
    const result = gen.testSanitize(input);
    expect(result.startsWith('osc')).toBe(true);
  });

  it('handles combined contamination', () => {
    const input = '```javascript\n<think\nreasoning\n</think\n<!-- comment -->\nnoise(3).out();\n```';
    const result = gen.testSanitize(input);
    expect(result).not.toContain('```');
    expect(result).not.toContain('<think');
    expect(result).not.toContain('<!--');
    expect(result).toContain('noise(3).out()');
  });
});
