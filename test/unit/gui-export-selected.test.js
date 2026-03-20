/**
 * Export selected iteration as HTML (reuse Exporter).
 */

import fs from 'fs/promises';
import path from 'path';
import { exportSelectedIterationAsHTML } from '../../src/gui/exportSelected.js';
import { Exporter } from '../../src/export/Exporter.js';

const TEST_EXPORT_DIR = 'test-export-selected-temp';

describe('Export selected iteration as HTML', () => {
  const iterations = [
    { id: 1, code: 'function setup() { createCanvas(100, 100); }', timestamp: 1000 },
    { id: 2, code: 'function setup() { createCanvas(200, 200); }', timestamp: 2000 },
  ];

  beforeEach(async () => {
    try {
      await fs.rm(TEST_EXPORT_DIR, { recursive: true, force: true });
    } catch (_) {}
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_EXPORT_DIR, { recursive: true, force: true });
    } catch (_) {}
  });

  it('exports selected iteration code as HTML via Exporter', async () => {
    const exporter = new Exporter();
    const outputPath = path.join(TEST_EXPORT_DIR, 'selected.html');
    await exportSelectedIterationAsHTML(iterations, 1, outputPath, exporter);

    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('createCanvas(200, 200)');
    expect(content).not.toContain('createCanvas(100, 100)');
  });

  it('exports first iteration when selectedIndex is 0', async () => {
    const exporter = new Exporter();
    const outputPath = path.join(TEST_EXPORT_DIR, 'first.html');
    await exportSelectedIterationAsHTML(iterations, 0, outputPath, exporter);

    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content).toContain('createCanvas(100, 100)');
  });

  it('throws when selectedIndex out of range and no code', async () => {
    const exporter = new Exporter();
    const outputPath = path.join(TEST_EXPORT_DIR, 'out.html');
    await expect(
      exportSelectedIterationAsHTML(iterations, 10, outputPath, exporter)
    ).rejects.toThrow();
  });
});
