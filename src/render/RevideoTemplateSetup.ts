/**
 * RevideoTemplateSetup - Manages a persistent Revideo template project
 *
 * Creates and maintains a template at ~/.liminal/revideo-template/ with
 * pre-installed node_modules. This amortizes the npm install cost across
 * all renders by copying the template instead of creating from scratch.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { Logger } from '../utils/Logger.js';

const TEMPLATE_DIR = path.join(os.homedir(), '.liminal', 'revideo-template');

/** Status of the template */
interface TemplateStatus {
  exists: boolean;
  hasNodeModules: boolean;
  hasPackageJson: boolean;
  hasTsConfig: boolean;
}

/** Content for package.json */
const PACKAGE_JSON = JSON.stringify(
  {
    name: 'revideo-template',
    version: '1.0.0',
    private: true,
    type: 'module',
    dependencies: {
      '@revideo/core': '^0.10.0',
      '@revideo/2d': '^0.10.0',
      '@revideo/renderer': '^0.10.0',
    },
    devDependencies: {
      typescript: '^5.3.0',
    },
  },
  null,
  2
);

/** Content for tsconfig.json */
const TSCONFIG_JSON = JSON.stringify(
  {
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      jsxImportSource: '@revideo/2d',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      allowSyntheticDefaultImports: true,
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
  },
  null,
  2
);

/** Placeholder scene.ts content */
const SCENE_PLACEHOLDER = `import { makeScene2D } from '@revideo/2d';

export default makeScene2D(function* (view) {
  // Placeholder scene - will be replaced during render
});
`;

/** Placeholder project.ts content */
const PROJECT_PLACEHOLDER = `import { makeProject } from '@revideo/core';
import Scene from './scene';

export default makeProject({
  scenes: [Scene],
  settings: {
    shared: {
      size: { width: 1920, height: 1080 },
    },
  },
});
`;

class RevideoTemplateSetup {
  private templateDir: string;

  constructor() {
    this.templateDir = TEMPLATE_DIR;
  }

  /**
   * Get the template directory path.
   */
  getTemplateDir(): string {
    return this.templateDir;
  }

  /**
   * Check the current status of the template.
   */
  async getStatus(): Promise<TemplateStatus> {
    try {
      await fs.access(this.templateDir);
    } catch {
      return {
        exists: false,
        hasNodeModules: false,
        hasPackageJson: false,
        hasTsConfig: false,
      };
    }

    const checks = await Promise.all([
      this.pathExists(path.join(this.templateDir, 'package.json')),
      this.pathExists(path.join(this.templateDir, 'tsconfig.json')),
      this.pathExists(path.join(this.templateDir, 'node_modules')),
    ]);

    return {
      exists: true,
      hasPackageJson: checks[0],
      hasTsConfig: checks[1],
      hasNodeModules: checks[2],
    };
  }

  /**
   * Ensure the template exists and is ready to use.
   * Returns true if template is ready, false otherwise.
   */
  async ensureTemplate(): Promise<boolean> {
    const status = await this.getStatus();

    if (status.exists && status.hasNodeModules && status.hasPackageJson && status.hasTsConfig) {
      Logger.debug('RevideoTemplateSetup', 'Template already exists and is ready');
      return true;
    }

    Logger.info('RevideoTemplateSetup', 'Creating Revideo template...');

    try {
      // Create template directory
      await fs.mkdir(this.templateDir, { recursive: true });

      // Create src directory
      const srcDir = path.join(this.templateDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Write package.json
      await fs.writeFile(
        path.join(this.templateDir, 'package.json'),
        PACKAGE_JSON,
        'utf-8'
      );

      // Write tsconfig.json
      await fs.writeFile(
        path.join(this.templateDir, 'tsconfig.json'),
        TSCONFIG_JSON,
        'utf-8'
      );

      // Write placeholder scene.ts
      await fs.writeFile(
        path.join(srcDir, 'scene.ts'),
        SCENE_PLACEHOLDER,
        'utf-8'
      );

      // Write placeholder project.ts
      await fs.writeFile(
        path.join(srcDir, 'project.ts'),
        PROJECT_PLACEHOLDER,
        'utf-8'
      );

      // Run npm install
      Logger.info('RevideoTemplateSetup', 'Running npm install (this may take a while)...');
      const installSuccess = await this.runNpmInstall();

      if (installSuccess) {
        Logger.info('RevideoTemplateSetup', 'Template created successfully');
      } else {
        Logger.error('RevideoTemplateSetup', 'npm install failed');
      }

      return installSuccess;
    } catch (error) {
      Logger.error('RevideoTemplateSetup', 'Failed to create template:', error);
      return false;
    }
  }

  /**
   * Copy the template to a work directory, excluding cache directories.
   */
  async copyToWorkDir(workDir: string): Promise<void> {
    const status = await this.getStatus();

    if (!status.exists) {
      throw new Error('Template does not exist. Call ensureTemplate() first.');
    }

    Logger.debug('RevideoTemplateSetup', `Copying template to ${workDir}`);

    // Create work directory
    await fs.mkdir(workDir, { recursive: true });

    // Copy template contents, excluding node_modules/.cache
    await fs.cp(this.templateDir, workDir, {
      recursive: true,
      filter: (src) => {
        // Exclude node_modules/.cache
        if (src.includes('node_modules/.cache')) {
          return false;
        }
        // Exclude .git if present
        if (src.includes('.git')) {
          return false;
        }
        return true;
      },
    });

    Logger.debug('RevideoTemplateSetup', 'Template copied successfully');
  }

  /**
   * Run npm install in the template directory.
   */
  private async runNpmInstall(): Promise<boolean> {
    return new Promise((resolve) => {
      const npm = spawn('npm', ['install'], {
        cwd: this.templateDir,
        stdio: 'pipe',
      });

      let stderr = '';

      npm.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      npm.on('close', (code) => {
        if (code !== 0) {
          Logger.error('RevideoTemplateSetup', `npm install exited with code ${code}`);
          Logger.debug('RevideoTemplateSetup', 'stderr:', stderr);
          resolve(false);
        } else {
          resolve(true);
        }
      });

      npm.on('error', (error) => {
        Logger.error('RevideoTemplateSetup', 'Failed to spawn npm:', error);
        resolve(false);
      });
    });
  }

  /**
   * Check if a path exists.
   */
  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const revideoTemplate = new RevideoTemplateSetup();
