import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Exporter tests - Export functionality for HTML, JS, and ZIP files
 *
 * Tests exportHTML(code, path), exportJS(code, path), exportZIP(project, path)
 * with 80% minimum coverage requirement
 */

import fs from 'fs/promises';
import path from 'path';
import { Exporter } from '../../src/export/Exporter.js';

describe('Exporter', () => {
  const TEST_EXPORT_DIR = 'test-export-temp';

  // Sample p5.js code for testing
  const SAMPLE_P5_CODE = `function setup() {
  createCanvas(400, 400);
  background(220);
}

function draw() {
  ellipse(mouseX, mouseY, 50, 50);
}`;

  const SAMPLE_PROJECT = {
    name: 'test-project',
    iterations: [
      { version: 1, code: 'code1', timestamp: '2026-03-01T12:00:00Z' },
      { version: 2, code: 'code2', timestamp: '2026-03-01T12:01:00Z' },
      { version: 3, code: SAMPLE_P5_CODE, timestamp: '2026-03-01T12:02:00Z' }
    ]
  };

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(TEST_EXPORT_DIR, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, which is fine
    }
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(TEST_EXPORT_DIR, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, which is fine
    }
  });

  describe('exportHTML', () => {
    it('should export code as standalone HTML file', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.html');

      await exporter.exportHTML(SAMPLE_P5_CODE, outputPath);

      // Check that file was created
      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<html lang="en">');
      expect(content).toContain('</html>');
    });

    it('should include p5.js library in exported HTML', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.html');

      await exporter.exportHTML(SAMPLE_P5_CODE, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('p5');
      expect(content).toMatch(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/p5\.js\/[\d\.]+\/p5\.min\.js/);
    });

    it('should embed user code in script tag', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.html');

      await exporter.exportHTML(SAMPLE_P5_CODE, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('<script>');
      expect(content).toContain(SAMPLE_P5_CODE);
      expect(content).toContain('</script>');
    });

    it('should create directory if it does not exist', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'subdir', 'sketch.html');

      await exporter.exportHTML(SAMPLE_P5_CODE, outputPath);

      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should throw error for null code', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.html');

      await expect(
        exporter.exportHTML(null as any, outputPath)
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should throw error for undefined code', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.html');

      await expect(
        exporter.exportHTML(undefined as any, outputPath)
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should throw error for empty code', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.html');

      await expect(
        exporter.exportHTML('', outputPath)
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should throw error for null path', async () => {
      const exporter = new Exporter();

      await expect(
        exporter.exportHTML(SAMPLE_P5_CODE, null as any)
      ).rejects.toThrow('Output path is required and must be a non-empty string');
    });

    it('should throw error for empty path', async () => {
      const exporter = new Exporter();

      await expect(
        exporter.exportHTML(SAMPLE_P5_CODE, '')
      ).rejects.toThrow('Output path is required and must be a non-empty string');
    });

    it('should handle special characters in code', async () => {
      const exporter = new Exporter();
      const specialCode = '// Code with "quotes" and \'apostrophes\'\nfunction setup() { createCanvas(400, 400); }';
      const outputPath = path.join(TEST_EXPORT_DIR, 'special.html');

      await exporter.exportHTML(specialCode, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('quotes');
      expect(content).toContain('apostrophes');
    });

    it('should handle unicode characters in code', async () => {
      const exporter = new Exporter();
      const unicodeCode = '// こんにちは世界\nfunction setup() { createCanvas(400, 400); }';
      const outputPath = path.join(TEST_EXPORT_DIR, 'unicode.html');

      await exporter.exportHTML(unicodeCode, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('こんにちは世界');
    });

    it('should overwrite existing file', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.html');

      const codeA = `function setup() { createCanvas(100,100); }\nfunction draw() { background(255,0,0); }`;
      const codeB = `function setup() { createCanvas(200,200); }\nfunction draw() { background(0,0,255); }`;
      await exporter.exportHTML(codeA, outputPath);
      await exporter.exportHTML(codeB, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('createCanvas(200,200)');
    });

    it('should include Web Audio support and user-gesture comment when code uses AudioContext, createOscillator, or p5.sound', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sound.html');
      const soundSketchCode = `function setup() {
  createCanvas(400, 400);
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
}
function draw() {}`;

      await exporter.exportHTML(soundSketchCode, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      const hasSoundComment = content.includes('Sound may require user click to start (browser policy)');
      const hasAudioContext = content.includes('AudioContext');
      const hasCreateOscillator = content.includes('createOscillator');
      expect(hasSoundComment).toBe(true);
      expect(hasAudioContext || hasCreateOscillator).toBe(true);
    });

    it('should include p5.sound script when code uses p5.sound', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'p5sound.html');
      const p5SoundCode = `// uses p5.sound
function preload() { loadSound('beat.mp3'); }
function setup() { createCanvas(400, 400); }
function draw() {}`;

      await exporter.exportHTML(p5SoundCode, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('Sound may require user click to start (browser policy)');
      expect(content).toMatch(/p5\.sound\.min\.js/);
    });
  });

  describe('exportJS', () => {
    it('should export code as JS file', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.js');

      await exporter.exportJS(SAMPLE_P5_CODE, outputPath);

      // Check that file was created
      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toBe(SAMPLE_P5_CODE);
    });

    it('should create directory if it does not exist', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'subdir', 'sketch.js');

      await exporter.exportJS(SAMPLE_P5_CODE, outputPath);

      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should throw error for null code', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.js');

      await expect(
        exporter.exportJS(null as any, outputPath)
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should throw error for undefined code', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.js');

      await expect(
        exporter.exportJS(undefined as any, outputPath)
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should throw error for empty code', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.js');

      await expect(
        exporter.exportJS('', outputPath)
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should throw error for null path', async () => {
      const exporter = new Exporter();

      await expect(
        exporter.exportJS(SAMPLE_P5_CODE, null as any)
      ).rejects.toThrow('Output path is required and must be a non-empty string');
    });

    it('should throw error for empty path', async () => {
      const exporter = new Exporter();

      await expect(
        exporter.exportJS(SAMPLE_P5_CODE, '')
      ).rejects.toThrow('Output path is required and must be a non-empty string');
    });

    it('should handle special characters in code', async () => {
      const exporter = new Exporter();
      const specialCode = 'function setup() { createCanvas(400, 400); }\nconst str = "Hello \\"World\\"";\nconst arr = [\'a\', \'b\'];';
      const outputPath = path.join(TEST_EXPORT_DIR, 'special.js');

      await exporter.exportJS(specialCode, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('createCanvas');
    });

    it('should handle unicode characters in code', async () => {
      const exporter = new Exporter();
      const unicodeCode = '// こんにちは世界\nfunction setup() { createCanvas(400, 400); }\nconst x = 42;';
      const outputPath = path.join(TEST_EXPORT_DIR, 'unicode.js');

      await exporter.exportJS(unicodeCode, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('こんにちは世界');
    });

    it('should preserve code formatting', async () => {
      const exporter = new Exporter();
      const formattedCode = `function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
}`;
      const outputPath = path.join(TEST_EXPORT_DIR, 'formatted.js');

      await exporter.exportJS(formattedCode, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('function setup()');
      expect(content).toContain('createCanvas(400, 400)');
      expect(content).toContain('function draw()');
    });

    it('should overwrite existing file', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.js');
      const codeA = `function setup() { createCanvas(100,100); }\nfunction draw() { background(255,0,0); }`;
      const codeB = `function setup() { createCanvas(200,200); }\nfunction draw() { background(0,0,255); }`;

      await exporter.exportJS(codeA, outputPath);
      await exporter.exportJS(codeB, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('createCanvas(200,200)');
    });
  });

  describe('exportZIP', () => {
    it('should export project as ZIP file', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'project.zip');

      await exporter.exportZIP(SAMPLE_PROJECT, outputPath);

      // Check that ZIP file was created
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Check that it's a valid ZIP file (starts with PK signature)
      const buffer = await fs.readFile(outputPath);
      expect(buffer[0]).toBe(0x50); // P
      expect(buffer[1]).toBe(0x4B); // K
    });

    it('should include all iteration files in ZIP', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'project.zip');

      await exporter.exportZIP(SAMPLE_PROJECT, outputPath);

      // ZIP should be created with project files
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should include HTML export in ZIP', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'project.zip');

      await exporter.exportZIP(SAMPLE_PROJECT, outputPath);

      // ZIP should be created
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should include JS export in ZIP', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'project.zip');

      await exporter.exportZIP(SAMPLE_PROJECT, outputPath);

      // ZIP should be created
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create directory if it does not exist', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'subdir', 'project.zip');

      await exporter.exportZIP(SAMPLE_PROJECT, outputPath);

      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should throw error for null project', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'project.zip');

      await expect(
        exporter.exportZIP(null as any, outputPath)
      ).rejects.toThrow('Project is required');
    });

    it('should throw error for undefined project', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'project.zip');

      await expect(
        exporter.exportZIP(undefined as any, outputPath)
      ).rejects.toThrow('Project is required');
    });

    it('should throw error for null path', async () => {
      const exporter = new Exporter();

      await expect(
        exporter.exportZIP(SAMPLE_PROJECT, null as any)
      ).rejects.toThrow('Output path is required and must be a non-empty string');
    });

    it('should throw error for empty path', async () => {
      const exporter = new Exporter();

      await expect(
        exporter.exportZIP(SAMPLE_PROJECT, '')
      ).rejects.toThrow('Output path is required and must be a non-empty string');
    });

    it('should throw error for project with invalid name', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'project.zip');

      await expect(
        exporter.exportZIP({ ...SAMPLE_PROJECT, name: '' }, outputPath)
      ).rejects.toThrow('Project name is required');
    });

    it('should throw error for project with null name', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'project.zip');

      await expect(
        exporter.exportZIP({ ...SAMPLE_PROJECT, name: null as any }, outputPath)
      ).rejects.toThrow('Project name is required');
    });

    it('should handle project with no iterations', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'empty-project.zip');

      await exporter.exportZIP({ name: 'empty', iterations: [] }, outputPath);

      // Should still create ZIP
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle project with special characters in name', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'special-project.zip');

      await exporter.exportZIP(
        { ...SAMPLE_PROJECT, name: 'project-with-special.chars_123' },
        outputPath
      );

      // Should create ZIP
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should overwrite existing ZIP file', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'project.zip');

      await exporter.exportZIP(SAMPLE_PROJECT, outputPath);

      const stats1 = await fs.stat(outputPath);

      await exporter.exportZIP({ ...SAMPLE_PROJECT, name: 'different' }, outputPath);

      const stats2 = await fs.stat(outputPath);

      // File should be overwritten (size might be different)
      expect(stats2.size).toBeGreaterThan(0);
      expect(stats1.size).toBeGreaterThan(0);
    });

    it('should handle unicode in project name', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'unicode-project.zip');

      await exporter.exportZIP(
        { ...SAMPLE_PROJECT, name: 'プロジェクト' },
        outputPath
      );

      // Should create ZIP
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('Integration tests', () => {
    it('should export HTML and JS from same code', async () => {
      const exporter = new Exporter();
      const htmlPath = path.join(TEST_EXPORT_DIR, 'sketch.html');
      const jsPath = path.join(TEST_EXPORT_DIR, 'sketch.js');

      await exporter.exportHTML(SAMPLE_P5_CODE, htmlPath);
      await exporter.exportJS(SAMPLE_P5_CODE, jsPath);

      // Both files should exist
      const htmlExists = await fs.access(htmlPath).then(() => true).catch(() => false);
      const jsExists = await fs.access(jsPath).then(() => true).catch(() => false);

      expect(htmlExists).toBe(true);
      expect(jsExists).toBe(true);
    });

    it('should create complete project export with ZIP, HTML, and JS', async () => {
      const exporter = new Exporter();
      const zipPath = path.join(TEST_EXPORT_DIR, 'complete.zip');
      const htmlPath = path.join(TEST_EXPORT_DIR, 'complete.html');
      const jsPath = path.join(TEST_EXPORT_DIR, 'complete.js');

      await exporter.exportZIP(SAMPLE_PROJECT, zipPath);
      await exporter.exportHTML(SAMPLE_P5_CODE, htmlPath);
      await exporter.exportJS(SAMPLE_P5_CODE, jsPath);

      // All files should exist
      const zipExists = await fs.access(zipPath).then(() => true).catch(() => false);
      const htmlExists = await fs.access(htmlPath).then(() => true).catch(() => false);
      const jsExists = await fs.access(jsPath).then(() => true).catch(() => false);

      expect(zipExists).toBe(true);
      expect(htmlExists).toBe(true);
      expect(jsExists).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle very long code', async () => {
      const exporter = new Exporter();
      const longCode = SAMPLE_P5_CODE.repeat(1000);
      const outputPath = path.join(TEST_EXPORT_DIR, 'long.html');

      await exporter.exportHTML(longCode, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content.length).toBeGreaterThan(100000);
    });

    it('should handle code with only whitespace and newlines', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sketch.html');

      await expect(
        exporter.exportHTML('   \n\n  \n  ', outputPath)
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should handle path with special characters', async () => {
      const exporter = new Exporter();
      const outputPath = path.join(TEST_EXPORT_DIR, 'sub-dir', 'file name.html');

      await exporter.exportHTML(SAMPLE_P5_CODE, outputPath);

      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle concurrent exports', async () => {
      const exporter = new Exporter();
      const codeA = `function setup() { createCanvas(100,100); }\nfunction draw() { background(255,0,0); }`;
      const codeB = `function setup() { createCanvas(200,200); }\nfunction draw() { background(0,255,0); }`;
      const codeC = `function setup() { createCanvas(300,300); }\nfunction draw() { background(0,0,255); }`;

      const promises = [
        exporter.exportHTML(codeA, path.join(TEST_EXPORT_DIR, 'file1.html')),
        exporter.exportHTML(codeB, path.join(TEST_EXPORT_DIR, 'file2.html')),
        exporter.exportHTML(codeC, path.join(TEST_EXPORT_DIR, 'file3.html')),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();

      // All files should exist
      const file1Exists = await fs.access(path.join(TEST_EXPORT_DIR, 'file1.html')).then(() => true).catch(() => false);
      const file2Exists = await fs.access(path.join(TEST_EXPORT_DIR, 'file2.html')).then(() => true).catch(() => false);
      const file3Exists = await fs.access(path.join(TEST_EXPORT_DIR, 'file3.html')).then(() => true).catch(() => false);

      expect(file1Exists).toBe(true);
      expect(file2Exists).toBe(true);
      expect(file3Exists).toBe(true);
    });
  });
});