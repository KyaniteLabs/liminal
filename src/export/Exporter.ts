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

export interface ProjectIteration {
  version: number;
  code: string;
  timestamp: string;
}

export interface Project {
  name: string;
  iterations: ProjectIteration[];
}

export class Exporter {
  /**
   * Export p5.js code as a standalone HTML file
   * @param code - p5.js code (must be non-empty string)
   * @param outputPath - Path where HTML file will be saved
   * @throws Error if validation fails or file system error occurs
   */
  async exportHTML(code: string, outputPath: string): Promise<void> {
    // Validate code
    if (!code || typeof code !== 'string' || code.trim() === '') {
      throw new Error('Code is required and must be a non-empty string');
    }

    // Validate output path
    if (!outputPath || typeof outputPath !== 'string' || outputPath.trim() === '') {
      throw new Error('Output path is required and must be a non-empty string');
    }

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
    // Validate code
    if (!code || typeof code !== 'string' || code.trim() === '') {
      throw new Error('Code is required and must be a non-empty string');
    }

    // Validate output path
    if (!outputPath || typeof outputPath !== 'string' || outputPath.trim() === '') {
      throw new Error('Output path is required and must be a non-empty string');
    }

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Write JavaScript file
    try {
      await fs.writeFile(outputPath, code, 'utf-8');
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

    // Validate project name
    if (!project.name || typeof project.name !== 'string' || project.name.trim() === '') {
      throw new Error('Project name is required');
    }

    // Validate output path
    if (!outputPath || typeof outputPath !== 'string' || outputPath.trim() === '') {
      throw new Error('Output path is required and must be a non-empty string');
    }

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
      archive.finalize();
    });
  }

  /**
   * Generate standalone HTML with p5.js CDN and embedded code
   * When code uses Web Audio (AudioContext, createOscillator) or p5.sound,
   * includes p5.sound script if needed and a comment about user gesture.
   * @param code - p5.js code to embed
   * @returns Complete HTML string
   */
  private generateHTML(code: string): string {
    const usesSound = this.codeUsesWebAudioOrP5Sound(code);
    const usesP5Sound = /p5\.sound/i.test(code);
    const p5Version = '1.9.0';
    const p5Script = `https://cdnjs.cloudflare.com/ajax/libs/p5.js/${p5Version}/p5.min.js`;
    const p5SoundScript = usesP5Sound
      ? `\n    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/${p5Version}/p5.sound.min.js"></script>`
      : '';
    const soundComment = usesSound
      ? '\n    <!-- Sound may require user click to start (browser policy). -->'
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>p5.js Sketch</title>
    <script src="${p5Script}"></script>${p5SoundScript}
    <style>
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f0f0f0;
        }
        main {
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
    </style>
</head>
<body>${soundComment}
    <main>
        <script>
${code}
        </script>
    </main>
</body>
</html>`;
  }

  /**
   * Detect if code uses Web Audio API or p5.sound (requires user gesture note / scripts).
   */
  private codeUsesWebAudioOrP5Sound(code: string): boolean {
    return (
      /AudioContext/i.test(code) ||
      /createOscillator/i.test(code) ||
      /p5\.sound/i.test(code)
    );
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