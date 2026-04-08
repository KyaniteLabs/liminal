/**
 * P5Generator (deprecated wrapper) unit tests.
 * Covers normalizeInput and delegation to P5GeneratorLLM.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock('../../../src/generators/p5/P5GeneratorLLM.js', () => ({
  P5GeneratorLLM: vi.fn(function(this: any) {
    this.generate = mockGenerate;
  }),
}));

import { P5Generator } from '../../../src/generators/p5/P5Generator.js';

describe('P5Generator', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it('delegates to P5GeneratorLLM and returns result', async () => {
    mockGenerate.mockResolvedValue('function setup() { createCanvas(400, 400); }');
    const result = await P5Generator.generate('draw a circle');
    expect(result).toBe('function setup() { createCanvas(400, 400); }');
  });

  it('passes string prompts through to P5GeneratorLLM', async () => {
    mockGenerate.mockResolvedValue('// generated');
    await P5Generator.generate('draw a spiral');
    expect(mockGenerate).toHaveBeenCalledWith('draw a spiral');
  });

  it('propagates errors from P5GeneratorLLM', async () => {
    mockGenerate.mockRejectedValue(new Error('LLM not configured'));
    await expect(P5Generator.generate('test')).rejects.toThrow('LLM not configured');
  });

  it('normalizes null input to empty string', async () => {
    mockGenerate.mockResolvedValue('// ok');
    await P5Generator.generate(null);
    expect(mockGenerate).toHaveBeenCalledWith('');
  });

  it('normalizes undefined input to empty string', async () => {
    mockGenerate.mockResolvedValue('// ok');
    await P5Generator.generate(undefined);
    expect(mockGenerate).toHaveBeenCalledWith('');
  });

  it('normalizes number input to string', async () => {
    mockGenerate.mockResolvedValue('// ok');
    await P5Generator.generate(42);
    expect(mockGenerate).toHaveBeenCalledWith('42');
  });

  it('normalizes boolean input to string', async () => {
    mockGenerate.mockResolvedValue('// ok');
    await P5Generator.generate(true);
    expect(mockGenerate).toHaveBeenCalledWith('true');
  });

  it('normalizes object input to JSON string', async () => {
    mockGenerate.mockResolvedValue('// ok');
    await P5Generator.generate({ key: 'value' });
    expect(mockGenerate).toHaveBeenCalledWith('{"key":"value"}');
  });
});
