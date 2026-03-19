/**
 * Gallery - Save/load iteration functionality
 *
 * Manages persistent storage of code iterations with date-based directory structure.
 * Each project gets a directory named YYYY-MM-DD--project/ containing version files.
 *
 * Key behavior:
 * - saveIteration(project, version, code) saves code to gallery/YYYY-MM-DD--project/v{version}.js
 * - loadHistory(project) loads all iterations sorted by version number
 */

import fs from 'fs/promises';
import { normalizePath, assertSafeSegment } from '../utils/normalizePath.js';

export interface Iteration {
  version: number;
  code: string;
  timestamp: string;
}

/** Organism iteration: music + visual code (Strudel + Hydra). */
export interface OrganismIteration {
  version: number;
  type: 'organism';
  musicCode: string;
  visualCode: string;
  timestamp: string;
}

/** Union: p5 (code) or organism (musicCode + visualCode). */
export type GalleryIteration = Iteration | OrganismIteration;

/**
 * Parse raw file content: if valid JSON with type 'organism', return OrganismIteration; else p5 Iteration.
 */
function parseVersionContent(raw: string, version: number, timestamp: string): GalleryIteration | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed);
    if (data && typeof data === 'object' && data.type === 'organism' &&
        data.musicCode != null && data.visualCode != null) {
      return {
        version,
        type: 'organism',
        musicCode: String(data.musicCode),
        visualCode: String(data.visualCode),
        timestamp,
      };
    }
  } catch {
    // Not JSON or invalid — treat as p5 code
  }
  return { version, code: raw, timestamp };
}

export class Gallery {
  private readonly galleryDir: string;

  constructor(galleryDir: string = 'gallery') {
    this.galleryDir = galleryDir;
  }

  /**
   * Save an iteration to the gallery
   * @param project - Project name (must be non-empty string)
   * @param version - Version number (must be positive integer)
   * @param code - Code to save (must be non-empty string)
   * @throws Error if validation fails or file system error occurs
   */
  async saveIteration(project: string, version: number, code: string): Promise<void> {
    // Validate project name
    if (!project || typeof project !== 'string' || project.trim() === '') {
      throw new Error('Project name is required and must be a non-empty string');
    }
    assertSafeSegment(project.trim(), 'Project name');

    // Validate version
    if (!version || typeof version !== 'number' || version <= 0 || !Number.isInteger(version)) {
      throw new Error('Version must be a positive integer');
    }

    // Validate code
    if (!code || typeof code !== 'string' || code.trim() === '') {
      throw new Error('Code is required and must be a non-empty string');
    }

    // Create date-based directory name
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const projectDirName = `${dateStr}--${project.trim()}`;
    const projectDir = normalizePath(this.galleryDir, projectDirName);

    // Create directory if it doesn't exist
    try {
      await fs.mkdir(projectDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create project directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Save code to version file
    const filename = `v${version}.js`;
    const filepath = normalizePath(projectDir, filename);

    try {
      await fs.writeFile(filepath, code, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save iteration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save an organism iteration (musicCode + visualCode) as JSON in vN.js.
   * @param project - Project name (must be non-empty string)
   * @param version - Version number (must be positive integer)
   * @param musicCode - Strudel/music code
   * @param visualCode - Hydra/visual code
   */
  async saveOrganism(project: string, version: number, musicCode: string, visualCode: string): Promise<void> {
    if (!project || typeof project !== 'string' || project.trim() === '') {
      throw new Error('Project name is required and must be a non-empty string');
    }
    assertSafeSegment(project.trim(), 'Project name');
    if (!version || typeof version !== 'number' || version <= 0 || !Number.isInteger(version)) {
      throw new Error('Version must be a positive integer');
    }
    if (!musicCode || typeof musicCode !== 'string') {
      throw new Error('musicCode is required and must be a string');
    }
    if (!visualCode || typeof visualCode !== 'string') {
      throw new Error('visualCode is required and must be a string');
    }

    const projectDir = await this.ensureProjectDir(project);
    const payload = {
      type: 'organism',
      musicCode: musicCode.trim() || musicCode,
      visualCode: visualCode.trim() || visualCode,
    };
    const filepath = normalizePath(projectDir, `v${version}.js`);
    await fs.writeFile(filepath, JSON.stringify(payload), 'utf-8');
  }

  /**
   * Get or create project directory path (date-based). Creates directory if needed.
   */
  private async ensureProjectDir(project: string): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const projectDirName = `${dateStr}--${project.trim()}`;
    const projectDir = normalizePath(this.galleryDir, projectDirName);
    await fs.mkdir(projectDir, { recursive: true });
    return projectDir;
  }

  /**
   * Load iteration history for a project
   * @param project - Project name (must be non-empty string)
   * @returns Array of iterations (p5 or organism) sorted by version number
   * @throws Error if validation fails
   */
  async loadHistory(project: string): Promise<GalleryIteration[]> {
    // Validate project name
    if (!project || typeof project !== 'string' || project.trim() === '') {
      throw new Error('Project name is required and must be a non-empty string');
    }
    assertSafeSegment(project.trim(), 'Project name');

    // Try to find the project directory
    // We need to find the most recent date-based directory for this project
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const projectDirName = `${dateStr}--${project.trim()}`;
    const projectDir = normalizePath(this.galleryDir, projectDirName);

    try {
      // Check if directory exists
      await fs.access(projectDir);
    } catch {
      // Directory doesn't exist, return empty history
      return [];
    }

    try {
      // Read all files in the project directory
      const files = await fs.readdir(projectDir);

      // Filter and parse version files
      const iterations: GalleryIteration[] = [];

      for (const file of files) {
        // Match version files (v1.js, v2.js, etc.)
        const match = file.match(/^v(\d+)\.js$/);
        if (!match) continue;

        const version = parseInt(match[1], 10);

        try {
          // Read file content
          const filepath = normalizePath(projectDir, file);
          const raw = await fs.readFile(filepath, 'utf-8');

          // Skip empty files
          if (!raw || raw.trim() === '') continue;

          const timestamp = date.toISOString();
          const iter = parseVersionContent(raw, version, timestamp);
          if (iter) iterations.push(iter);
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      // Sort by version number
      iterations.sort((a, b) => a.version - b.version);

      return iterations;
    } catch (error) {
      // If we can't read the directory, return empty history
      return [];
    }
  }

  /**
   * Get the full path to a project's gallery directory
   * @param project - Project name
   * @returns Full path to the project directory
   */
  getProjectPath(project: string): string {
    assertSafeSegment(project.trim(), 'Project name');
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return normalizePath(this.galleryDir, `${dateStr}--${project.trim()}`);
  }

  /**
   * Check if a project has any saved iterations
   * @param project - Project name
   * @returns True if project has saved iterations
   */
  async hasIterations(project: string): Promise<boolean> {
    const history = await this.loadHistory(project);
    return history.length > 0;
  }

  /**
   * Get the latest version number for a project
   * @param project - Project name
   * @returns Latest version number or 0 if no iterations exist
   */
  async getLatestVersion(project: string): Promise<number> {
    const history = await this.loadHistory(project);
    if (history.length === 0) {
      return 0;
    }
    return Math.max(...history.map(iter => iter.version));
  }

  /**
   * List project directory names in the gallery (e.g. "YYYY-MM-DD--projectName").
   * Used by API and GUI to list projects without relying on today's date.
   * @returns Sorted list of project dir names (newest first by name)
   */
  async listProjectDirs(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.galleryDir, { withFileTypes: true });
      const dirs = entries
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .filter(name => /^\d{4}-\d{2}-\d{2}--.+/.test(name));
      return dirs.sort((a, b) => b.localeCompare(a));
    } catch {
      return [];
    }
  }

  /**
   * Load iteration history from a project directory by its full name (e.g. "2026-03-07--my-project").
   * @param projectDirName - Full directory name under galleryDir
   * @returns Array of iterations (p5 or organism) sorted by version number
   */
  async loadHistoryFromDir(projectDirName: string): Promise<GalleryIteration[]> {
    if (!projectDirName || typeof projectDirName !== 'string' || projectDirName.trim() === '') {
      return [];
    }
    let projectDir: string;
    try {
      projectDir = normalizePath(this.galleryDir, projectDirName.trim());
    } catch {
      return [];
    }
    try {
      await fs.access(projectDir);
    } catch {
      return [];
    }
    try {
      const files = await fs.readdir(projectDir);
      const iterations: GalleryIteration[] = [];
      for (const file of files) {
        const match = file.match(/^v(\d+)\.js$/);
        if (!match) continue;
        const version = parseInt(match[1], 10);
        try {
          const filepath = normalizePath(projectDir, file);
          const raw = await fs.readFile(filepath, 'utf-8');
          if (!raw || raw.trim() === '') continue;
          const stat = await fs.stat(filepath);
          const timestamp = stat.mtime?.toISOString() ?? new Date().toISOString();
          const iter = parseVersionContent(raw, version, timestamp);
          if (iter) iterations.push(iter);
        } catch {
          continue;
        }
      }
      iterations.sort((a, b) => a.version - b.version);
      return iterations;
    } catch {
      return [];
    }
  }
}