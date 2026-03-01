/**
 * Atelier - Creative Coding Agent
 *
 * Main entry point for the creative coding agent with internal Ralph-Wiggum Loop
 * for generating emergent generative art.
 */

// Core Ralph-Wiggum Loop components
import { RalphLoop } from './core/RalphLoop.js';
import { CreativeEvaluator } from './core/CreativeEvaluator.js';
import { PromiseDetector } from './core/PromiseDetector.js';
import { PromptStore } from './core/PromptStore.js';
import { ContextAccumulation } from './core/ContextAccumulation.js';

// Generators
import { P5Generator } from './generators/p5/P5Generator.js';
import { ParticleSystem } from './generators/p5/ParticleSystem.js';
import { CellularAutomata } from './generators/p5/CellularAutomata.js';

// Rendering and export
import { Renderer } from './render/Renderer.js';
import { PreviewServer } from './render/PreviewServer.js';
import { Exporter, Project } from './export/Exporter.js';
import { Gallery, Iteration } from './gallery/Gallery.js';
import { SeedArchive, SeedMetadata } from './gallery/SeedArchive.js';

import fs from 'fs/promises';
import path from 'path';

export const ATELIER_VERSION = '1.0.0';

export interface AtelierConfig {
  name: string;
  version: string;
  loop: {
    maxIterations: number;
    timeoutMinutes: number;
    completionPromise: string;
  };
  creative: {
    defaultFramework: 'p5.js';
    evaluationCriteria: string[];
    minQualityScore: number;
  };
  gallery: {
    autoSave: boolean;
    maxHistoryPerProject: number;
  };
  renderer: {
    port: number;
    screenshotOnIteration: boolean;
  };
}

export const defaultConfig: AtelierConfig = {
  name: 'atelier',
  version: ATELIER_VERSION,
  loop: {
    maxIterations: 20,
    timeoutMinutes: 30,
    completionPromise: 'COMPLETE',
  },
  creative: {
    defaultFramework: 'p5.js',
    evaluationCriteria: ['aesthetic', 'technical', 'novelty'],
    minQualityScore: 0.7,
  },
  gallery: {
    autoSave: true,
    maxHistoryPerProject: 50,
  },
  renderer: {
    port: 3456,
    screenshotOnIteration: true,
  },
};

/**
 * Main run function for Atelier
 *
 * @param prompt - The creative prompt to generate from
 * @param options - Configuration options
 * @returns Result object with code, iterations, metadata
 */
export async function run(prompt: string, options: {
  maxIterations?: number;
  timeoutMinutes?: number;
  output?: string;
  project?: string;
  minQualityScore?: number;
  galleryDir?: string;
} = {}): Promise<{
  code: string;
  iterations: number;
  completed: boolean;
  reason: string;
  timestamp: string;
  duration: number;
  finalScore: number;
  project?: string;
  outputDir: string;
  prompt: string;
  htmlPath?: string;
  jsPath?: string;
  zipPath?: string;
}> {
  const startTime = Date.now();

  const {
    maxIterations = 20,
    timeoutMinutes = 30,
    output = './output',
    project = 'default',
    minQualityScore = 0.7,
    galleryDir = 'gallery'
  } = options;

  try {
    // Validate input
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt is required and must be a non-empty string');
    }

    // Create output directory if it doesn't exist
    await fs.mkdir(output, { recursive: true });

    // Run the Ralph-Wiggum Loop with all sophisticated components
    const loopResult = await RalphLoop.run(prompt, {
      maxIterations,
      timeoutMinutes,
      galleryDir,
      project,
      tolerateErrors: false,
      minQualityScore
    });

    // Initialize Exporter
    const exporter = new Exporter();

    // Export final code as HTML
    const htmlPath = path.join(output, `${project}-final.html`);
    await exporter.exportHTML(loopResult.code, htmlPath);

    // Export final code as JS
    const jsPath = path.join(output, `${project}-final.js`);
    await exporter.exportJS(loopResult.code, jsPath);

    // Load project history from gallery for ZIP export
    const gallery = new Gallery(galleryDir);
    let zipPath: string | undefined;

    try {
      const history = await gallery.loadHistory(project);

      // Create project object for ZIP export
      const projectData: Project = {
        name: project,
        iterations: history.map((iteration, index) => ({
          version: index + 1,
          code: iteration.code,
          timestamp: iteration.timestamp
        }))
      };

      // Export as ZIP
      zipPath = path.join(output, `${project}-archive.zip`);
      await exporter.exportZIP(projectData, zipPath);
    } catch (error) {
      // If gallery loading fails, create a simple ZIP with just the final code
      const simpleProject: Project = {
        name: project,
        iterations: [
          {
            version: 1,
            code: loopResult.code,
            timestamp: loopResult.timestamp
          }
        ]
      };

      zipPath = path.join(output, `${project}-archive.zip`);
      await exporter.exportZIP(simpleProject, zipPath);
    }

    const duration = Date.now() - startTime;

    return {
      code: loopResult.code,
      iterations: loopResult.iterations,
      completed: loopResult.completed,
      reason: loopResult.reason,
      timestamp: loopResult.timestamp,
      duration,
      finalScore: loopResult.finalScore,
      project: loopResult.project,
      outputDir: output,
      prompt,
      htmlPath,
      jsPath,
      zipPath
    };

  } catch (error) {
    throw new Error(`Atelier run failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convenience function to run Atelier with CLI-style arguments
 *
 * @param args - Command line arguments
 * @returns Result object
 */
export async function runFromArgs(args: {
  prompt: string;
  maxIterations?: number;
  output?: string;
  project?: string;
}) {
  const {
    prompt,
    maxIterations = 20,
    output = './output',
    project = 'default'
  } = args;

  return run(prompt, {
    maxIterations,
    output,
    project
  });
}

/**
 * Main Atelier class - entry point for the creative coding agent
 */
export class Atelier {
  private config: AtelierConfig;

  constructor(config: Partial<AtelierConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  getConfig(): AtelierConfig {
    return this.config;
  }

  /**
   * Run the Ralph-Wiggum Loop with the configured settings
   */
  async run(prompt: string, options?: {
    maxIterations?: number;
    timeoutMinutes?: number;
    output?: string;
    project?: string;
    minQualityScore?: number;
  }) {
    return run(prompt, {
      ...options,
      maxIterations: options?.maxIterations || this.config.loop.maxIterations,
      timeoutMinutes: options?.timeoutMinutes || this.config.loop.timeoutMinutes,
      minQualityScore: options?.minQualityScore || this.config.creative.minQualityScore
    });
  }
}

// ============================================================================
// CORE COMPONENT EXPORTS - Programmatic Access
// ============================================================================

// Core Ralph-Wiggum Loop Engine
export { RalphLoop };

// Creative Evaluation and Quality Control
export { CreativeEvaluator };

// Promise Detection for Loop Termination
export { PromiseDetector };

// Prompt Management
export { PromptStore };

// Context and State Management
export { ContextAccumulation };

// p5.js Generators
export { P5Generator };
export { ParticleSystem };
export { CellularAutomata };

// Rendering and Preview
export { Renderer };
export { PreviewServer };

// Export and Persistence
export { Exporter, Project };

// Gallery and Seed Management
export { Gallery, Iteration };
export { SeedArchive, SeedMetadata };

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Main functions
  run,
  runFromArgs,

  // Main class
  Atelier,

  // Core components
  RalphLoop,
  CreativeEvaluator,
  PromiseDetector,
  PromptStore,
  ContextAccumulation,

  // Generators
  P5Generator,
  ParticleSystem,
  CellularAutomata,

  // Rendering and export
  Renderer,
  PreviewServer,
  Exporter,
  Gallery,
  SeedArchive,

  // Configuration
  ATELIER_VERSION,
  defaultConfig
};
