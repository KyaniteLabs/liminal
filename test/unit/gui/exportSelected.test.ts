import { describe, it, expect, vi } from 'vitest';
import { exportSelectedIterationAsHTML } from '../../../src/gui/exportSelected.js';

describe('exportSelectedIterationAsHTML', () => {
  const mockExporter = { exportHTML: vi.fn().mockResolvedValue(undefined) };
  const iterations = [
    { id: 1, code: 'osc().out()', timestamp: 1000 },
    { id: 2, code: 'noise().out()', timestamp: 2000 },
  ];

  it('exports the selected iteration', async () => {
    await exportSelectedIterationAsHTML(iterations, 0, '/out.html', mockExporter as any);
    expect(mockExporter.exportHTML).toHaveBeenCalledWith('osc().out()', '/out.html');
  });

  it('throws when selectedIndex is out of range', async () => {
    await expect(
      exportSelectedIterationAsHTML(iterations, 99, '/out.html', mockExporter as any)
    ).rejects.toThrow('not found or has no code');
  });

  it('throws when code is empty', async () => {
    const emptyIterations = [{ id: 1, code: '', timestamp: 1000 }];
    await expect(
      exportSelectedIterationAsHTML(emptyIterations, 0, '/out.html', mockExporter as any)
    ).rejects.toThrow('not found or has no code');
  });

  it('throws when code is whitespace-only', async () => {
    const wsIterations = [{ id: 1, code: '   \n  ', timestamp: 1000 }];
    await expect(
      exportSelectedIterationAsHTML(wsIterations, 0, '/out.html', mockExporter as any)
    ).rejects.toThrow('not found or has no code');
  });

  it('throws for negative index', async () => {
    await expect(
      exportSelectedIterationAsHTML(iterations, -1, '/out.html', mockExporter as any)
    ).rejects.toThrow('not found or has no code');
  });

  it('exports second iteration correctly', async () => {
    await exportSelectedIterationAsHTML(iterations, 1, '/out2.html', mockExporter as any);
    expect(mockExporter.exportHTML).toHaveBeenCalledWith('noise().out()', '/out2.html');
  });
});
