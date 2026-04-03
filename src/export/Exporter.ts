/**
 * Exporter - Export functionality for HTML, JS, and ZIP files
 *
 * Provides export capabilities for p5.js sketches and projects:
 * - exportHTML(code, path) - exports code as standalone HTML
 * - exportJS(code, path) - exports just the JS code
 * - exportZIP(project, path) - creates a ZIP of the project
 */

import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { HTMLWrapper } from '../utils/htmlWrapper.js';
import { CodeValidator } from '../core/CodeValidator.js';
import {
  validateCode,
  validateOutputPath,
  validateProjectName,
} from '../utils/validation.js';
import { RemotionRenderer } from '../render/RemotionRenderer.js';
import { ValidationError } from '../errors/ValidationError.js';
import { CanvasRecorder } from '../render/CanvasRecorder.js';

export interface ProjectIteration {
  version: number;
  code: string;
  timestamp: string;
}

export interface Project {
  name: string;
  iterations: ProjectIteration[];
}

export interface VideoExportOptions {
  domain: string;
  fps?: number;      // default 30
  duration?: number; // default 10 (seconds)
  width?: number;    // default 1920
  height?: number;   // default 1080
}

export class Exporter {
  /**
   * Export p5.js code as a standalone HTML file
   * @param code - p5.js code (must be non-empty string)
   * @param outputPath - Path where HTML file will be saved
   * @throws Error if validation fails or file system error occurs
   */
  async exportHTML(code: string, outputPath: string): Promise<void> {
    // Validate inputs
    validateCode(code);
    validateOutputPath(outputPath);

    // Structural validation before wrapping
    const validation = CodeValidator.validate(code);
    if (!validation.valid) {
      throw new ValidationError('Code validation failed', validation.errors);
    }
    code = validation.cleanedCode;

    // Generate standalone HTML with p5.js CDN and embedded code
    const html = this.generateHTML(code);

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Write HTML file
    try {
      await fs.writeFile(outputPath, html, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to export HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export p5.js code as a JavaScript file
   * @param code - p5.js code (must be non-empty string)
   * @param outputPath - Path where JS file will be saved
   * @throws Error if validation fails or file system error occurs
   */
  async exportJS(code: string, outputPath: string): Promise<void> {
    // Validate inputs
    validateCode(code);
    validateOutputPath(outputPath);

    // Structural validation before saving
    const validation = CodeValidator.validate(code);
    if (!validation.valid) {
      throw new Error(`Code validation failed: ${validation.errors.join('; ')}`);
    }
    code = validation.cleanedCode;

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Write JavaScript file
    // If code is HTML-wrapped (e.g., Three.js), extract script content for .js file
    let jsContent = code;
    if (code.trim().startsWith('<!DOCTYPE') || code.trim().startsWith('<html')) {
      // Extract content between <script> tags, excluding importmap and application/json
      const scriptMatch = code.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
      if (scriptMatch) {
        const scripts = scriptMatch
          .filter(s => !/<script[^>]*type\s*=\s*["']importmap["']/.test(s.split('>')[0]))
          .filter(s => !/<script[^>]*type\s*=\s*["']application\/json["']/.test(s.split('>')[0]))
          .map(s => s.replace(/<script[^>]*>/, '').replace(/<\/script>/, ''))
          .filter(s => s.trim().length > 0);
        if (scripts.length > 0) {
          jsContent = scripts.join('\n\n');
        }
      }
    }

    try {
      await fs.writeFile(outputPath, jsContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to export JS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export a project as a ZIP file
   * @param project - Project object with name and iterations
   * @param outputPath - Path where ZIP file will be saved
   * @throws Error if validation fails or file system error occurs
   */
  async exportZIP(project: Project, outputPath: string): Promise<void> {
    // Validate project
    if (!project || typeof project !== 'object') {
      throw new Error('Project is required');
    }

    // Validate inputs
    validateProjectName(project.name);
    validateOutputPath(outputPath);

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Create ZIP archive
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Handle archive errors
      archive.on('error', (err) => {
        reject(new Error(`Failed to create ZIP: ${err.message}`));
      });

      // Handle output stream errors
      output.on('error', (err) => {
        reject(new Error(`Failed to write ZIP: ${err.message}`));
      });

      // Finalize the archive when done
      output.on('close', () => {
        resolve();
      });

      // Pipe archive data to the file
      archive.pipe(output);

      // Add project metadata
      const metadata = {
        name: project.name,
        exportDate: new Date().toISOString(),
        iterationsCount: project.iterations?.length || 0
      };
      archive.append(JSON.stringify(metadata, null, 2), { name: 'project.json' });

      // Add iterations if they exist
      if (project.iterations && Array.isArray(project.iterations)) {
        for (const iteration of project.iterations) {
          const filename = `${iteration.version}.js`;
          archive.append(iteration.code, { name: `iterations/${filename}` });
        }
      }

      // Add HTML export of the latest version
      const latestIteration = this.getLatestIteration(project);
      if (latestIteration) {
        const html = this.generateHTML(latestIteration.code);
        archive.append(html, { name: 'index.html' });
      }

      // Add JS export of the latest version
      if (latestIteration) {
        archive.append(latestIteration.code, { name: 'sketch.js' });
      }

      // Finalize the archive
      archive.finalize().catch(reject);
    });
  }

  /**
   * Export creative code as a video file.
   * Uses RemotionRenderer for the 'remotion' domain, CanvasRecorder for all others.
   * @param code - Creative code to render (must be non-empty string)
   * @param outputPath - Path where video file will be saved
   * @param options - Video export options including domain, fps, duration, width, height
   * @throws Error if validation fails or rendering fails
   */
  async exportVideo(code: string, outputPath: string, options: VideoExportOptions): Promise<void> {
    // Validate inputs
    validateCode(code);
    validateOutputPath(outputPath, 'Output path is required');

    // Validate domain
    if (!options?.domain) {
      throw new Error('VideoExportOptions domain is required');
    }

    const {
      domain,
      fps = 30,
      duration = 10,
      width = 1920,
      height = 1080,
    } = options;

    // Create output directory if it doesn't exist
    const dir = path.dirname(outputPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (domain === 'remotion') {
      const renderer = new RemotionRenderer();
      const projectDir = await renderer.writeEntryPoint(code);
      await renderer.renderToVideo({ projectDir, outputPath, codec: 'h264' });
    } else {
      const recorder = new CanvasRecorder({ fps, duration, width, height });
      await recorder.record(code, domain as any, outputPath);
    }
  }

  /**
   * Generate standalone HTML with p5.js CDN and embedded code
   * When code uses Web Audio (AudioContext, createOscillator) or p5.sound,
   * includes p5.sound script if needed and a comment about user gesture.
   * @param code - p5.js code to embed
   * @returns Complete HTML string
   */
  private generateHTML(code: string): string {
    const usesP5Sound = /p5\.sound/i.test(code);
    return HTMLWrapper.wrap(code, { includeP5Sound: usesP5Sound });
  }

  /**
   * Get the latest iteration from a project
   * @param project - Project object
   * @returns Latest iteration or undefined if no iterations exist
   */
  private getLatestIteration(project: Project): ProjectIteration | undefined {
    if (!project.iterations || !Array.isArray(project.iterations) || project.iterations.length === 0) {
      return undefined;
    }

    // Find iteration with highest version number
    return project.iterations.reduce((latest, current) => {
      return current.version > latest.version ? current : latest;
    });
  }
}