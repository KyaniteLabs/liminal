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
import { Logger } from '../utils/Logger.js';
import type { SwarmResult } from '../swarm/types.js';

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
  } catch (parseError) {
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
   * Save a swarm session result alongside the final output code.
   * Stores the full JSON session in the project directory for provenance.
   * @param project - Project name
   * @param result - SwarmResult from TokenMillOrchestrator
   */
  async saveSwarmSession(project: string, result: SwarmResult): Promise<void> {
    if (!project || typeof project !== 'string' || project.trim() === '') {
      throw new Error('Project name is required and must be a non-empty string');
    }
    assertSafeSegment(project.trim(), 'Project name');

    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const projectDirName = `${dateStr}--${project.trim()}`;
    const projectDir = normalizePath(this.galleryDir, projectDirName);

    await fs.mkdir(projectDir, { recursive: true });

    // Save the full session JSON
    const sessionPath = normalizePath(projectDir, 'swarm-session.json');
    const sessionData = {
      timestamp: date.toISOString(),
      converged: result.converged,
      convergenceRound: result.convergenceRound,
      mode: result.mode,
      totalDurationMs: result.totalDurationMs,
      rounds: result.rounds.map(round => ({
        roundNum: round.roundNum,
        winnerId: round.winnerId,
        constraint: round.constraint,
        scores: Object.fromEntries(round.scores.entries()),
        outputs: Object.fromEntries(
          [...round.outputs.entries()].map(([id, out]) => [id, {
            personaName: out.personaName,
            content: out.content,
            model: out.model,
          }])
        ),
      })),
    };

    await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');

    // Also save the final output as the latest version
    if (result.finalOutput) {
      const history = await this.loadHistory(project).catch((err) => {
        Logger.debug('Gallery', 'Failed to load history:', err);
        return [];
      });
      const nextVersion = history.length + 1;
      await this.saveIteration(project, nextVersion, result.finalOutput);
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

    try {
      // Find all date-based directories for this project (not just today's)
      const allDirs = await this.listProjectDirs();
      const projectSuffix = `--${project.trim()}`;
      const matchingDirs = allDirs
        .filter(d => d.endsWith(projectSuffix))
        .sort(); // oldest first by name (YYYY-MM-DD)

      if (matchingDirs.length === 0) return [];

      // Load from all matching directories, sorted by date
      const allIterations: GalleryIteration[] = [];
      for (const dirName of matchingDirs) {
        const iterations = await this.loadHistoryFromDir(dirName);
        allIterations.push(...iterations);
      }

      // Sort by version number
      allIterations.sort((a, b) => a.version - b.version);

      // Deduplicate by version (keep latest by timestamp)
      const byVersion = new Map<number, GalleryIteration>();
      for (const iter of allIterations) {
        const existing = byVersion.get(iter.version);
        if (!existing || iter.timestamp > existing.timestamp) {
          byVersion.set(iter.version, iter);
        }
      }

      return Array.from(byVersion.values()).sort((a, b) => a.version - b.version);
    } catch (error) {
      Logger.error('Gallery', `Gallery.loadHistory("${project}") failed:`, error instanceof Error ? error.message : error);
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
    } catch (error) {
      Logger.error('Gallery', 'Gallery.listProjectDirs() failed:', error instanceof Error ? error.message : error);
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
    } catch (normalizeError) {
      return [];
    }
    try {
      await fs.access(projectDir);
    } catch (accessError) {
      return [];
    }
    try {
      const files = await fs.readdir(projectDir);
      const versionFiles = files.filter(f => /^v(\d+)\.js$/.test(f));

      // Read all files and stats in parallel
      const results = await Promise.allSettled(
        versionFiles.map(async (file) => {
          const match = file.match(/^v(\d+)\.js$/)!;
          const version = parseInt(match[1], 10);
          const filepath = normalizePath(projectDir, file);
          const [raw, stat] = await Promise.all([
            fs.readFile(filepath, 'utf-8'),
            fs.stat(filepath),
          ]);
          return { file, version, raw, stat };
        })
      );

      const iterations: GalleryIteration[] = [];
      for (const result of results) {
        if (result.status !== 'fulfilled') {
          Logger.error('Gallery', 'Gallery.loadHistoryFromDir: failed to read:', result.reason instanceof Error ? result.reason.message : result.reason);
          continue;
        }
        const { version, raw, stat } = result.value;
        if (!raw || raw.trim() === '') continue;
        const timestamp = stat.mtime?.toISOString() ?? new Date().toISOString();
        const iter = parseVersionContent(raw, version, timestamp);
        if (iter) iterations.push(iter);
      }
      iterations.sort((a, b) => a.version - b.version);
      return iterations;
    } catch (error) {
      Logger.error('Gallery', `Gallery.loadHistoryFromDir("${projectDirName}") failed:`, error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Archive old projects to keep gallery size manageable.
   * ZIPs projects beyond maxProjects or older than maxAgeDays, then deletes them.
   * @param maxProjects - Maximum number of projects to keep (default 100)
   * @param maxAgeDays - Maximum age in days (default 90)
   * @returns Number of projects archived
   */
  async cleanupOldProjects(maxProjects = 100, maxAgeDays = 90): Promise<number> {
    const dirs = await this.listProjectDirs();
    if (dirs.length <= maxProjects) return 0;

    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const toArchive: string[] = [];

    for (const dirName of dirs) {
      // Extract date from directory name (YYYY-MM-DD--project)
      const dateMatch = dirName.match(/^(\d{4}-\d{2}-\d{2})--/);
      if (!dateMatch) continue;
      const dirDate = new Date(dateMatch[1]).getTime();
      const dirPath = normalizePath(this.galleryDir, dirName);

      let stat;
      try { stat = await fs.stat(dirPath); } catch (statError) { continue; }

      // Archive if too old or beyond maxProjects limit
      if (now - dirDate > maxAgeMs || now - stat.mtimeMs > maxAgeMs) {
        toArchive.push(dirName);
      }
    }

    // If still too many, archive oldest beyond limit
    if (dirs.length - toArchive.length > maxProjects) {
      const remaining = dirs.filter(d => !toArchive.includes(d)).sort(); // oldest first
      const excess = remaining.length - maxProjects;
      for (let i = 0; i < excess; i++) {
        toArchive.push(remaining[i]);
      }
    }

    // Create archive directory
    const archiveDir = normalizePath(this.galleryDir, '_archived');
    await fs.mkdir(archiveDir, { recursive: true });

    for (const dirName of toArchive) {
      try {
        const dirPath = normalizePath(this.galleryDir, dirName);
        // Simple move to _archived (no ZIP dependency needed)
        const destPath = normalizePath(archiveDir, dirName);
        await fs.rename(dirPath, destPath);
      } catch (archiveError) {
        // Skip projects that can't be archived
      }
    }

    return toArchive.length;
  }
}