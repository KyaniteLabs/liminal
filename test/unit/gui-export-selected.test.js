import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    { id: 1, code: `function setup() {\n  createCanvas(100, 100);\n  background(220);\n  // Initialize particle system\n  particles = [];\n  for (let i = 0; i < 30; i++) {\n    particles.push({\n      x: random(width),\n      y: random(height),\n      size: random(5, 20),\n      speed: random(1, 3)\n    });\n  }\n}\nfunction draw() {\n  background(220, 220, 240, 25);\n  for (let p of particles) {\n    fill(random(255), random(100, 200), random(255), 200);\n    noStroke();\n    ellipse(p.x, p.y, p.size);\n    p.x += random(-p.speed, p.speed);\n    p.y += random(-p.speed, p.speed);\n    if (p.x < 0) p.x = width;\n    if (p.x > width) p.x = 0;\n    if (p.y < 0) p.y = height;\n    if (p.y > height) p.y = 0;\n  }\n}`, timestamp: 1000 },
    { id: 2, code: `function setup() {\n  createCanvas(200, 200);\n  background(240);\n  // Initialize bubble system\n  bubbles = [];\n  for (let i = 0; i < 30; i++) {\n    bubbles.push({\n      x: random(width),\n      y: random(height),\n      size: random(8, 25),\n      speed: random(0.5, 2)\n    });\n  }\n}\nfunction draw() {\n  background(240, 240, 220, 25);\n  for (let b of bubbles) {\n    fill(random(100, 255), random(150, 255), 255, 180);\n    noStroke();\n    ellipse(b.x, b.y, b.size);\n    b.x += random(-b.speed, b.speed);\n    b.y -= b.speed;\n    if (b.y < -b.size) b.y = height + b.size;\n    if (b.x < 0) b.x = width;\n    if (b.x > width) b.x = 0;\n  }\n}`, timestamp: 2000 },
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
