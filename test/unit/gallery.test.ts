import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
/**
 * Gallery tests - Save/load iteration functionality
 *
 * Tests saveIteration(project, version, code) and loadHistory(project)
 * with 85% minimum coverage requirement
 */

import fs from 'fs/promises';
import path from 'path';
import { Gallery, type Iteration } from '../../src/gallery/Gallery.js';

describe('Gallery', () => {
  const TEST_GALLERY_DIR = 'test-gallery-temp';
  const TEST_DATE = new Date('2026-03-01T12:00:00Z');

  // Mock the current date for consistent testing
  let originalDate: DateConstructor;

  beforeAll(() => {
    originalDate = global.Date;
    // @ts-ignore - Mock Date constructor
    global.Date = class extends Date {
      constructor() {
        super();
        return TEST_DATE as any;
      }
      static now() {
        return TEST_DATE.getTime();
      }
    } as any;
  });

  afterAll(() => {
    global.Date = originalDate;
  });

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(TEST_GALLERY_DIR, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, which is fine
    }
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(TEST_GALLERY_DIR, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, which is fine
    }
  });

  describe('saveIteration', () => {
    it('should save iteration to correct directory structure', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const code = 'function setup() { createCanvas(400, 400); }';

      await gallery.saveIteration('test-project', 1, code);

      const expectedPath = path.join(TEST_GALLERY_DIR, '2026-03-01--test-project', 'v1.js');
      const savedContent = await fs.readFile(expectedPath, 'utf-8');
      expect(savedContent).toBe(code);
    });

    it('should save multiple iterations with correct version numbers', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await gallery.saveIteration('test-project', 1, 'code1');
      await gallery.saveIteration('test-project', 2, 'code2');
      await gallery.saveIteration('test-project', 3, 'code3');

      const v1Content = await fs.readFile(
        path.join(TEST_GALLERY_DIR, '2026-03-01--test-project', 'v1.js'),
        'utf-8'
      );
      const v2Content = await fs.readFile(
        path.join(TEST_GALLERY_DIR, '2026-03-01--test-project', 'v2.js'),
        'utf-8'
      );
      const v3Content = await fs.readFile(
        path.join(TEST_GALLERY_DIR, '2026-03-01--test-project', 'v3.js'),
        'utf-8'
      );

      expect(v1Content).toBe('code1');
      expect(v2Content).toBe('code2');
      expect(v3Content).toBe('code3');
    });

    it('should create directory if it does not exist', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const code = 'test code';

      await gallery.saveIteration('new-project', 1, code);

      const dirExists = await fs.access(
        path.join(TEST_GALLERY_DIR, '2026-03-01--new-project')
      ).then(() => true).catch(() => false);

      expect(dirExists).toBe(true);
    });

    it('should handle project names with special characters', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const code = 'test code';

      await gallery.saveIteration('project-with-special.chars_123', 1, code);

      const expectedPath = path.join(TEST_GALLERY_DIR, '2026-03-01--project-with-special.chars_123', 'v1.js');
      const savedContent = await fs.readFile(expectedPath, 'utf-8');
      expect(savedContent).toBe(code);
    });

    it('should save iterations for different projects separately', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await gallery.saveIteration('project-a', 1, 'code-a');
      await gallery.saveIteration('project-b', 1, 'code-b');

      const projectAContent = await fs.readFile(
        path.join(TEST_GALLERY_DIR, '2026-03-01--project-a', 'v1.js'),
        'utf-8'
      );
      const projectBContent = await fs.readFile(
        path.join(TEST_GALLERY_DIR, '2026-03-01--project-b', 'v1.js'),
        'utf-8'
      );

      expect(projectAContent).toBe('code-a');
      expect(projectBContent).toBe('code-b');
    });

    it('should throw error for null project name', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration(null as any, 1, 'code')
      ).rejects.toThrow('Project name is required and must be a non-empty string');
    });

    it('should throw error for undefined project name', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration(undefined as any, 1, 'code')
      ).rejects.toThrow('Project name is required and must be a non-empty string');
    });

    it('should throw error for empty project name', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration('', 1, 'code')
      ).rejects.toThrow('Project name is required and must be a non-empty string');
    });

    it('should throw error for non-string project name', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration(123 as any, 1, 'code')
      ).rejects.toThrow('Project name is required and must be a non-empty string');
    });

    it('should throw error for invalid version number', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration('test', 0, 'code')
      ).rejects.toThrow('Version must be a positive integer');

      await expect(
        gallery.saveIteration('test', -1, 'code')
      ).rejects.toThrow('Version must be a positive integer');

      await expect(
        gallery.saveIteration('test', 1.5, 'code')
      ).rejects.toThrow('Version must be a positive integer');
    });

    it('should throw error for null code', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration('test', 1, null as any)
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should throw error for undefined code', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration('test', 1, undefined as any)
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should throw error for empty code', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration('test', 1, '')
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should throw error for non-string code', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration('test', 1, 123 as any)
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should handle multiline code correctly', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const multilineCode = `
function setup() {
  createCanvas(400, 400);
  background(220);
}

function draw() {
  ellipse(mouseX, mouseY, 50, 50);
}
      `;

      await gallery.saveIteration('test', 1, multilineCode);

      const savedContent = await fs.readFile(
        path.join(TEST_GALLERY_DIR, '2026-03-01--test', 'v1.js'),
        'utf-8'
      );
      expect(savedContent).toBe(multilineCode);
    });

    it('should handle unicode characters in code', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const unicodeCode = '// こんにちは世界\nfunction setup() { createCanvas(400, 400); }';

      await gallery.saveIteration('test', 1, unicodeCode);

      const savedContent = await fs.readFile(
        path.join(TEST_GALLERY_DIR, '2026-03-01--test', 'v1.js'),
        'utf-8'
      );
      expect(savedContent).toBe(unicodeCode);
    });

    it('should overwrite existing version if saved again', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await gallery.saveIteration('test', 1, 'original code');
      await gallery.saveIteration('test', 1, 'updated code');

      const savedContent = await fs.readFile(
        path.join(TEST_GALLERY_DIR, '2026-03-01--test', 'v1.js'),
        'utf-8'
      );
      expect(savedContent).toBe('updated code');
    });
  });

  describe('loadHistory', () => {
    it('should load empty array for non-existent project', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      const history = await gallery.loadHistory('non-existent-project');

      expect(history).toEqual([]);
    });

    it('should load single iteration', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const code = 'function setup() { createCanvas(400, 400); }';

      await gallery.saveIteration('test-project', 1, code);

      const history = await gallery.loadHistory('test-project');

      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(1);
      expect((history[0] as Iteration).code).toBe(code);
      expect(history[0].timestamp).toBeTruthy();
    });

    it('should load multiple iterations in correct order', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await gallery.saveIteration('test-project', 1, 'code1');
      await gallery.saveIteration('test-project', 2, 'code2');
      await gallery.saveIteration('test-project', 3, 'code3');

      const history = await gallery.loadHistory('test-project');

      expect(history).toHaveLength(3);
      expect(history[0].version).toBe(1);
      expect((history[0] as Iteration).code).toBe('code1');
      expect(history[1].version).toBe(2);
      expect((history[1] as Iteration).code).toBe('code2');
      expect(history[2].version).toBe(3);
      expect((history[2] as Iteration).code).toBe('code3');
    });

    it('should handle gaps in version numbers', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await gallery.saveIteration('test-project', 1, 'code1');
      await gallery.saveIteration('test-project', 5, 'code5');
      await gallery.saveIteration('test-project', 10, 'code10');

      const history = await gallery.loadHistory('test-project');

      expect(history).toHaveLength(3);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(5);
      expect(history[2].version).toBe(10);
    });

    it('should load iterations from correct date-based directory', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await gallery.saveIteration('test-project', 1, 'code1');
      await gallery.saveIteration('test-project', 2, 'code2');

      const history = await gallery.loadHistory('test-project');

      expect(history).toHaveLength(2);
      expect(history[0].timestamp).toBeTruthy();
      expect(history[1].timestamp).toBeTruthy();
    });

    it('should throw error for null project name', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.loadHistory(null as any)
      ).rejects.toThrow('Project name is required and must be a non-empty string');
    });

    it('should throw error for undefined project name', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.loadHistory(undefined as any)
      ).rejects.toThrow('Project name is required and must be a non-empty string');
    });

    it('should throw error for empty project name', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.loadHistory('')
      ).rejects.toThrow('Project name is required and must be a non-empty string');
    });

    it('should throw error for non-string project name', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.loadHistory(123 as any)
      ).rejects.toThrow('Project name is required and must be a non-empty string');
    });

    it('should handle corrupted files gracefully', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      // Save a valid iteration
      await gallery.saveIteration('test-project', 1, 'code1');

      // Create a corrupted file
      const projectDir = path.join(TEST_GALLERY_DIR, '2026-03-01--test-project');
      await fs.writeFile(path.join(projectDir, 'v2.js'), '');

      const history = await gallery.loadHistory('test-project');

      // Should load valid files and skip corrupted ones
      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(1);
    });

    it('should handle project names with special characters', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await gallery.saveIteration('project-with-special.chars_123', 1, 'code1');

      const history = await gallery.loadHistory('project-with-special.chars_123');

      expect(history).toHaveLength(1);
      expect((history[0] as Iteration).code).toBe('code1');
    });

    it('should return empty array for empty project directory', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      // Create project directory but don't save any iterations
      const projectDir = path.join(TEST_GALLERY_DIR, '2026-03-01--test-project');
      await fs.mkdir(projectDir, { recursive: true });

      const history = await gallery.loadHistory('test-project');

      expect(history).toEqual([]);
    });
  });

  describe('Helper methods', () => {
    it('should get project path correctly', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const projectPath = gallery.getProjectPath('test-project');

      expect(projectPath).toContain('test-project');
      expect(projectPath).toContain(TEST_GALLERY_DIR);
      expect(projectPath).toMatch(/\d{4}-\d{2}-\d{2}--test-project$/);
    });

    it('should check if project has iterations', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      expect(await gallery.hasIterations('new-project')).toBe(false);

      await gallery.saveIteration('new-project', 1, 'code');

      expect(await gallery.hasIterations('new-project')).toBe(true);
    });

    it('should return false for hasIterations with non-existent project', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      expect(await gallery.hasIterations('non-existent')).toBe(false);
    });

    it('should get latest version number', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      expect(await gallery.getLatestVersion('new-project')).toBe(0);

      await gallery.saveIteration('new-project', 1, 'code1');
      await gallery.saveIteration('new-project', 3, 'code3');
      await gallery.saveIteration('new-project', 2, 'code2');

      expect(await gallery.getLatestVersion('new-project')).toBe(3);
    });

    it('should return 0 for getLatestVersion with non-existent project', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      expect(await gallery.getLatestVersion('non-existent')).toBe(0);
    });
  });

  describe('Integration tests', () => {
    it('should save and load iterations correctly', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await gallery.saveIteration('integration-test', 1, 'code1');
      await gallery.saveIteration('integration-test', 2, 'code2');
      await gallery.saveIteration('integration-test', 3, 'code3');

      const history = await gallery.loadHistory('integration-test');

      expect(history).toHaveLength(3);
      expect(history[0].version).toBe(1);
      expect((history[0] as Iteration).code).toBe('code1');
      expect(history[0].timestamp).toBeTruthy();
      expect(() => new Date(history[0].timestamp)).not.toThrow();
      expect(history[1].version).toBe(2);
      expect((history[1] as Iteration).code).toBe('code2');
      expect(history[2].version).toBe(3);
      expect((history[2] as Iteration).code).toBe('code3');
    });

    it('should handle multiple projects independently', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await gallery.saveIteration('project-a', 1, 'code-a1');
      await gallery.saveIteration('project-a', 2, 'code-a2');
      await gallery.saveIteration('project-b', 1, 'code-b1');
      await gallery.saveIteration('project-b', 2, 'code-b2');

      const historyA = await gallery.loadHistory('project-a');
      const historyB = await gallery.loadHistory('project-b');

      expect(historyA).toHaveLength(2);
      expect(historyB).toHaveLength(2);
      expect((historyA[0] as Iteration).code).toBe('code-a1');
      expect((historyB[0] as Iteration).code).toBe('code-b1');
    });

    it('should preserve code formatting exactly', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const originalCode = `
function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
  ellipse(mouseX, mouseY, 50, 50);
}
      `;

      await gallery.saveIteration('test', 1, originalCode);
      const history = await gallery.loadHistory('test');

      expect((history[0] as Iteration).code).toBe(originalCode);
    });
  });

  describe('Additional edge cases', () => {
    it('should handle whitespace-only project name', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration('   ', 1, 'code')
      ).rejects.toThrow('Project name is required and must be a non-empty string');
    });

    it('should handle whitespace-only code', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration('test', 1, '   ')
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });

    it('should handle version number as string number', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration('test', '1' as any, 'code')
      ).rejects.toThrow('Version must be a positive integer');
    });

    it('should handle very large version numbers', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await gallery.saveIteration('test', 999999, 'code');

      const history = await gallery.loadHistory('test');
      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(999999);
    });

    it('should handle very long project names', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const longProjectName = 'a'.repeat(200);

      await gallery.saveIteration(longProjectName, 1, 'code');

      const history = await gallery.loadHistory(longProjectName);
      expect(history).toHaveLength(1);
    });

    it('should handle code with only whitespace and newlines', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);

      await expect(
        gallery.saveIteration('test', 1, '   \n\n  \n  ')
      ).rejects.toThrow('Code is required and must be a non-empty string');
    });
  });

  describe('listProjectDirs', () => {
    it('should return list of project directory names', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      await gallery.saveIteration('proj-a', 1, 'code1');
      await gallery.saveIteration('proj-b', 1, 'code2');
      const dirs = await gallery.listProjectDirs();
      expect(dirs).toContain('2026-03-01--proj-a');
      expect(dirs).toContain('2026-03-01--proj-b');
      expect(dirs.length).toBe(2);
    });

    it('should return empty array when gallery dir does not exist', async () => {
      const gallery = new Gallery('nonexistent-gallery-dir');
      const dirs = await gallery.listProjectDirs();
      expect(dirs).toEqual([]);
    });
  });

  describe('loadHistoryFromDir', () => {
    it('should load iterations by project dir name', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      await gallery.saveIteration('my-project', 1, 'code1');
      await gallery.saveIteration('my-project', 2, 'code2');
      const iterations = await gallery.loadHistoryFromDir('2026-03-01--my-project');
      expect(iterations).toHaveLength(2);
      expect(iterations[0].version).toBe(1);
      expect((iterations[0] as Iteration).code).toBe('code1');
      expect(iterations[1].version).toBe(2);
      expect((iterations[1] as Iteration).code).toBe('code2');
    });

    it('should return empty array for unknown project dir', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const iterations = await gallery.loadHistoryFromDir('2026-03-01--nonexistent');
      expect(iterations).toEqual([]);
    });

    it('should reject path traversal', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const iterations = await gallery.loadHistoryFromDir('../../../etc');
      expect(iterations).toEqual([]);
    });
  });

  describe('Gallery organism format', () => {
    it('saveOrganism saves organism payload; loadHistory returns organism iteration', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const musicCode = 'setcps(2)\nn("c3 e3 g3").sound("sawtooth")';
      const visualCode = 'osc().out();';

      await gallery.saveOrganism('organism-project', 1, musicCode, visualCode);

      const history = await gallery.loadHistory('organism-project');
      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(1);
      const first = history[0] as { type?: string; musicCode?: string; visualCode?: string; code?: string };
      expect(first.type).toBe('organism');
      expect(first.musicCode).toBe(musicCode);
      expect(first.visualCode).toBe(visualCode);
    });

    it('saveIteration with plain string still loads as p5 (code only)', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const code = 'function setup() { createCanvas(400, 400); }';

      await gallery.saveIteration('p5-project', 1, code);
      const history = await gallery.loadHistory('p5-project');

      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(1);
      expect((history[0] as { code?: string }).code).toBe(code);
      expect((history[0] as { type?: string }).type).toBeUndefined();
    });

    it('legacy vN.js with plain code (no JSON) loads as p5', async () => {
      const gallery = new Gallery(TEST_GALLERY_DIR);
      const projectDir = path.join(TEST_GALLERY_DIR, '2026-03-01--legacy-project');
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(path.join(projectDir, 'v1.js'), 'legacy p5 code here');

      const history = await gallery.loadHistory('legacy-project');

      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(1);
      expect((history[0] as { code?: string }).code).toBe('legacy p5 code here');
    });
  });
});