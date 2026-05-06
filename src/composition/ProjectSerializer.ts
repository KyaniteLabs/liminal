/**
 * ProjectSerializer - Import/Export v2.0
 *
 * Handles serialization and deserialization of Liminal projects
 * with support for:
 * - v2.0 format with groups, animations, and masks
 * - Backward compatibility with v1.0
 * - ZIP export/import with assets
 * - Import from URL
 */

import type { CompositionEngine } from './CompositionEngine.js';
import { Logger } from '../utils/Logger.js';
import {
  LiminalProject,
  LiminalProjectV1,
  Composition,
  Animation,
  LayerMask,
  Asset,
  AssetType,
} from './types.js';
import { validateUrl, getAllowedHostsFromEnv } from '../security/UrlValidator.js';

/** Minimal JSZip interface for optional dynamic import */
interface JSZipLike {
  new (): {
    file(name: string, data: string | Uint8Array): void;
    generateAsync(options: { type: 'blob'; compression: 'DEFLATE' }): Promise<Blob>;
  };
  loadAsync(data: Blob): Promise<{
    file(name: string): {
      async(type: 'string'): Promise<string>;
      async(type: 'uint8array'): Promise<Uint8Array>;
    } | null;
  }>;
}

/** Export options for project serialization */
export interface ExportOptions {
  /** Include external assets as base64 data */
  includeAssets?: boolean;

  /** Compress output (for ZIP export) */
  compress?: boolean;

  /** Animations to include */
  animations?: Animation[];

  /** Assets to include */
  assets?: Asset[];
}

/** Import result containing loaded data */
export interface ImportResult {
  /** Loaded animations */
  animations: Animation[];

  /** Loaded masks */
  masks: LayerMask[];

  /** Loaded assets */
  assets: Asset[];
}

/** Validation result */
export interface ValidationResult {
  /** Whether project is valid */
  valid: boolean;

  /** Validation errors if invalid */
  errors?: string[];
}

/**
 * ProjectSerializer - Handles import/export of Liminal projects
 */
export class ProjectSerializer {
  private supportedVersions = ['1.0', '2.0'];

  /**
   * Export a composition engine's state to Liminal project format.
   */
  exportProject(
    engine: CompositionEngine,
    options?: ExportOptions
  ): LiminalProject {
    const layers = engine.getLayers();
    const settings = engine.getSettings();

    const composition: Composition = {
      id: `comp_${Date.now()}`,
      layers,
      globalSettings: settings,
      metadata: {
        name: 'Exported Project',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        tags: [],
      },
    };

    const project: LiminalProject = {
      version: '2.0',
      composition,
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      },
    };

    // Include animations if provided
    if (options?.animations && options.animations.length > 0) {
      project.animations = options.animations;
    }

    // Include masks from mask manager
    const maskManager = engine.getMaskManager();
    const masks = maskManager.getAllMasks();
    if (masks.length > 0) {
      project.masks = masks;
    }

    // Include assets if provided
    if (options?.assets && options.assets.length > 0) {
      project.assets = options.assets;
    }

    return project;
  }

  /**
   * Import a Liminal project into a composition engine.
   * Returns the imported animations, masks, and assets.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async importProject(
    project: LiminalProject | LiminalProjectV1,
    engine: CompositionEngine
  ): Promise<ImportResult> {
    // Validate project
    const validation = this.validateProject(project);
    if (!validation.valid) {
      throw new Error(`Invalid project: ${validation.errors?.join(', ')}`);
    }

    // Migrate v1.0 to v2.0 if needed
    let v2Project: LiminalProject;
    if (project.version === '1.0') {
      v2Project = this.migrateV1ToV2(project as LiminalProjectV1);
    } else {
      v2Project = project as LiminalProject;
    }

    // Clear existing state
    engine.cleanup();

    // Import layers
    const layerManager = engine.getLayerManager();
    layerManager.clear(); // Clear existing layers first
    for (const layer of v2Project.composition.layers) {
      layerManager.addLayer(layer);
    }

    // Import settings
    engine.updateSettings(v2Project.composition.globalSettings);

    // Import masks
    const maskManager = engine.getMaskManager();
    maskManager.clearMasks();
    if (v2Project.masks) {
      for (const mask of v2Project.masks) {
        maskManager.createMask(mask.sourceLayerId, mask.targetLayerId, mask.mode);
        const created = maskManager.getMasksForLayer(mask.targetLayerId).find(
          m => m.sourceLayerId === mask.sourceLayerId
        );
        if (created) {
          maskManager.updateMask(created.id, {
            invert: mask.invert,
            feather: mask.feather,
          });
        }
      }
    }

    return {
      animations: v2Project.animations || [],
      masks: v2Project.masks || [],
      assets: v2Project.assets || [],
    };
  }

  /**
   * Export project to ZIP format.
   * Returns a Blob containing the ZIP archive.
   */
  async exportToZip(project: LiminalProject): Promise<Blob> {
    // For browser environment, use JSZip if available
    if (typeof window !== 'undefined') {
      try {
        // Dynamic import of optional jszip dependency
        // SECURITY: Module path constructed to avoid compile-time resolution while preventing code injection
        const moduleName = 'js' + 'zip';
        const JSZip = await import(/* webpackIgnore: true */ moduleName)
          .then((m) => (m.default || m) as JSZipLike)
          .catch(() => null);
        if (!JSZip) throw new Error('JSZip not available');
        const zip = new JSZip();

        // Add project.json
        zip.file('project.json', JSON.stringify(project, null, 2));

        // Add embedded assets
        if (project.assets) {
          for (const asset of project.assets) {
            if (asset.data) {
              // Decode base64 and add to ZIP
              const binaryData = Uint8Array.from(atob(asset.data), c => c.charCodeAt(0));
              const extension = this.getAssetExtension(asset.type);
              zip.file(`assets/${asset.id}.${extension}`, binaryData);
            }
          }
        }

        return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      } catch (err) {
        Logger.debug('ProjectSerializer', 'JSZip export failed, using fallback:', err);
      }
    }

    // Node.js or fallback: create a simple ZIP-like structure
    return this.createFallbackZip(project);
  }

  /**
   * Import project from ZIP format.
   */
  async importFromZip(zip: Blob): Promise<LiminalProject> {
    // For browser environment, use JSZip if available
    if (typeof window !== 'undefined') {
      try {
        // Dynamic import of optional jszip dependency
        // SECURITY: Module path constructed to avoid compile-time resolution while preventing code injection
        const moduleName = 'js' + 'zip';
        const JSZip = await import(/* webpackIgnore: true */ moduleName)
          .then((m) => (m.default || m) as JSZipLike)
          .catch(() => null);
        if (!JSZip) throw new Error('JSZip not available');
        const zipContent = await JSZip.loadAsync(zip);

        // Read project.json
        const projectFile = zipContent.file('project.json');
        if (!projectFile) {
          throw new Error('ZIP archive missing project.json');
        }

        const projectJson = await projectFile.async('string');
        const project = JSON.parse(projectJson) as LiminalProject;

        // Load embedded assets
        if (project.assets) {
          for (const asset of project.assets) {
            const extension = this.getAssetExtension(asset.type);
            const assetFile = zipContent.file(`assets/${asset.id}.${extension}`);
            if (assetFile && !asset.data) {
              const binaryData = await assetFile.async('uint8array');
              asset.data = btoa(String.fromCharCode(...binaryData));
            }
          }
        }

        return project;
      } catch (error) {
        if (error instanceof Error && error.message.includes('project.json')) {
          throw error;
        }
        // Fall through to fallback
      }
    }

    // Fallback: try to parse as JSON directly
    const text = await zip.text();
    return JSON.parse(text) as LiminalProject;
  }

  /**
   * Import project from URL.
   */
  async importFromURL(url: string): Promise<LiminalProject> {
    // Validate URL to prevent SSRF attacks
    await validateUrl(url, {
      allowedHosts: getAllowedHostsFromEnv(),
      allowPrivateIPs: false,
      allowLocalhost: process.env.LIMINAL_ALLOW_LOCALHOST_LLM === 'true'
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch project: ${response.status} ${response.statusText}`);
    }

    const project = (await response.json()) as LiminalProject;

    // Validate imported project
    const validation = this.validateProject(project);
    if (!validation.valid) {
      throw new Error(`Invalid project from URL: ${validation.errors?.join(', ')}`);
    }

    return project;
  }

  /**
   * Migrate a v1.0 project to v2.0 format.
   */
  migrateV1ToV2(project: LiminalProjectV1): LiminalProject {
    return {
      version: '2.0',
      composition: project.composition,
      metadata: project.metadata,
      animations: [],
      masks: [],
      assets: [],
    };
  }

  /**
   * Validate a project structure.
   */
  validateProject(project: unknown): ValidationResult {
    const errors: string[] = [];

    if (!project || typeof project !== 'object') {
      return { valid: false, errors: ['Project must be an object'] };
    }

    const p = project as Record<string, unknown>;

    // Check version
    if (!p.version || typeof p.version !== 'string') {
      errors.push('Missing or invalid version');
    } else if (!this.supportedVersions.includes(p.version)) {
      errors.push(`Unsupported version: ${p.version}. Supported: ${this.supportedVersions.join(', ')}`);
    }

    // Check composition
    if (!p.composition || typeof p.composition !== 'object') {
      errors.push('Missing composition');
    } else {
      const comp = p.composition as Record<string, unknown>;

      // Check composition required fields
      if (!comp.id || typeof comp.id !== 'string') {
        errors.push('Composition missing id');
      }

      if (!Array.isArray(comp.layers)) {
        errors.push('Composition missing layers array');
      } else {
        // Validate each layer
        for (let i = 0; i < comp.layers.length; i++) {
          const layerError = this.validateLayer(comp.layers[i], i);
          if (layerError) {
            errors.push(layerError);
          }
        }
      }

      if (!comp.globalSettings || typeof comp.globalSettings !== 'object') {
        errors.push('Composition missing globalSettings');
      }

      if (!comp.metadata || typeof comp.metadata !== 'object') {
        errors.push('Composition missing metadata');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate a layer structure.
   */
  private validateLayer(layer: unknown, index: number): string | null {
    if (!layer || typeof layer !== 'object') {
      return `Layer ${index} must be an object`;
    }

    const l = layer as Record<string, unknown>;

    if (!l.id || typeof l.id !== 'string') {
      return `Layer ${index} missing id`;
    }

    if (!l.type || typeof l.type !== 'string') {
      return `Layer ${index} (${l.id}) missing type`;
    }

    if (typeof l.code !== 'string') {
      return `Layer ${index} (${l.id}) missing code`;
    }

    if (!l.config || typeof l.config !== 'object') {
      return `Layer ${index} (${l.id}) missing config`;
    }

    if (!l.metadata || typeof l.metadata !== 'object') {
      return `Layer ${index} (${l.id}) missing metadata`;
    }

    if (typeof l.enabled !== 'boolean') {
      return `Layer ${index} (${l.id}) missing enabled flag`;
    }

    if (typeof l.locked !== 'boolean') {
      return `Layer ${index} (${l.id}) missing locked flag`;
    }

    return null;
  }

  /**
   * Create a fallback ZIP-like blob for non-browser environments.
   */
  private createFallbackZip(project: LiminalProject): Blob {
    // In Node.js, return JSON as a blob
    // The archiver package could be used for real ZIP support
    const json = JSON.stringify(project, null, 2);
    return new Blob([json], { type: 'application/zip' });
  }

  /**
   * Get file extension for asset type.
   */
  private getAssetExtension(type: AssetType): string {
    switch (type) {
      case 'image':
        return 'png';
      case 'audio':
        return 'mp3';
      case 'font':
        return 'woff2';
      case 'data':
        return 'json';
      default:
        return 'bin';
    }
  }
}

export default ProjectSerializer;
