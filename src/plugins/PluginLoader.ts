/**
 * PluginLoader - Dynamic loading and management of generator plugins
 * 
 * Supports:
 * - Loading from plugins/ directory
 * - Runtime plugin registration
 * - Dependency resolution
 * - Event notifications
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  GeneratorPlugin,
  PluginManifest,
  PluginLoadError,
  PluginLoadResult,
  PluginEvent,
  PluginEventHandler,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PluginLoader {
  private pluginsDir: string;
  private loadedPlugins: Map<string, GeneratorPlugin> = new Map();
  private manifests: Map<string, PluginManifest> = new Map();
  private eventHandlers: PluginEventHandler[] = [];

  constructor(pluginsDir?: string) {
    // Default to project-root/plugins or src/plugins
    this.pluginsDir = pluginsDir || path.resolve(__dirname, '../../plugins');
  }

  /**
   * Load all plugins from the plugins directory
   */
  async loadAll(): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];

    try {
      const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(this.pluginsDir, entry.name);
          const result = await this.loadPlugin(pluginPath);
          results.push(result);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is empty - not an error
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return results;
  }

  /**
   * Load a single plugin from a directory
   */
  async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
    const pluginId = path.basename(pluginPath);

    try {
      // Read and validate manifest
      const manifestPath = path.join(pluginPath, 'plugin.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // Validate required fields
      if (!manifest.id || !manifest.entry) {
        throw new Error('Invalid manifest: missing id or entry');
      }

      // Check dependencies
      if (manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          if (!this.loadedPlugins.has(dep)) {
            throw new Error(`Missing dependency: ${dep}`);
          }
        }
      }

      // Load the plugin module
      const entryPath = path.join(pluginPath, manifest.entry);
      const module = await import(entryPath);

      // Create plugin instance
      const plugin: GeneratorPlugin = {
        manifest,
        generate: module.generate.bind(module),
        canHandle: module.canHandle?.bind(module),
        initialize: module.initialize?.bind(module),
        destroy: module.destroy?.bind(module),
      };

      // Initialize if needed
      if (plugin.initialize) {
        await plugin.initialize();
      }

      // Store plugin
      this.loadedPlugins.set(manifest.id, plugin);
      this.manifests.set(manifest.id, manifest);

      // Emit event
      this.emitEvent({
        type: 'plugin:loaded',
        pluginId: manifest.id,
        timestamp: new Date().toISOString(),
      });

      return { success: true, plugin };

    } catch (error) {
      const loadError: PluginLoadError = {
        pluginId,
        path: pluginPath,
        error: error instanceof Error ? error.message : String(error),
      };

      this.emitEvent({
        type: 'plugin:error',
        pluginId,
        timestamp: new Date().toISOString(),
        data: loadError,
      });

      return { success: false, error: loadError };
    }
  }

  /**
   * Register a plugin programmatically (for built-in generators)
   */
  registerPlugin(plugin: GeneratorPlugin): void {
    this.loadedPlugins.set(plugin.manifest.id, plugin);
    this.manifests.set(plugin.manifest.id, plugin.manifest);

    this.emitEvent({
      type: 'plugin:loaded',
      pluginId: plugin.manifest.id,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return false;

    // Call destroy if available
    if (plugin.destroy) {
      await plugin.destroy();
    }

    this.loadedPlugins.delete(pluginId);
    this.manifests.delete(pluginId);

    this.emitEvent({
      type: 'plugin:unloaded',
      pluginId,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Get a loaded plugin by ID
   */
  getPlugin(id: string): GeneratorPlugin | undefined {
    return this.loadedPlugins.get(id);
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): GeneratorPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Get plugin manifest
   */
  getManifest(id: string): PluginManifest | undefined {
    return this.manifests.get(id);
  }

  /**
   * Find best plugin for a prompt
   */
  findPluginForPrompt(prompt: string): GeneratorPlugin | undefined {
    let bestPlugin: GeneratorPlugin | undefined;
    let bestScore = 0;

    for (const plugin of this.loadedPlugins.values()) {
      let score = 0;

      // Use plugin's canHandle if available
      if (plugin.canHandle) {
        score = plugin.canHandle(prompt);
      } else {
        // Fallback to keyword matching
        const lowerPrompt = prompt.toLowerCase();
        for (const keyword of plugin.manifest.keywords) {
          if (lowerPrompt.includes(keyword.toLowerCase())) {
            score = Math.max(score, 0.5);
          }
        }
        for (const domain of plugin.manifest.domains) {
          if (lowerPrompt.includes(domain.toLowerCase())) {
            score = Math.max(score, 0.7);
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPlugin = plugin;
      }
    }

    return bestPlugin;
  }

  /**
   * Check if plugin is loaded
   */
  isLoaded(id: string): boolean {
    return this.loadedPlugins.has(id);
  }

  /**
   * Subscribe to plugin events
   */
  onEvent(handler: PluginEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Unsubscribe from events
   */
  offEvent(handler: PluginEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index >= 0) {
      this.eventHandlers.splice(index, 1);
    }
  }

  private emitEvent(event: PluginEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }
}

export const pluginLoader = new PluginLoader();
