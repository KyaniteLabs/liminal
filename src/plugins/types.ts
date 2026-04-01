/**
 * Plugin Types - Core interfaces for the generator plugin system
 * 
 * Plugins are self-contained generator modules that can be:
 * - Loaded dynamically at runtime
 * - Hot-reloaded during development
 * - Shared and installed from external sources
 */

export interface PluginManifest {
  /** Unique plugin identifier (e.g., "p5", "shader", "three") */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Semantic version */
  version: string;
  
  /** Brief description */
  description: string;
  
  /** Entry point file (relative to plugin directory) */
  entry: string;
  
  /** Supported creative domains */
  domains: string[];
  
  /** Keywords that trigger this generator */
  keywords: string[];
  
  /** Optional: Author information */
  author?: string;
  
  /** Optional: Dependencies on other plugins */
  dependencies?: string[];
  
  /** Optional: Minimum Liminal version */
  minLiminalVersion?: string;
}

export interface GenerateOptions {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  
  /** Bypass cache for this generation */
  bypassCache?: boolean;
  
  /** Temperature override */
  temperature?: number;
  
  /** Max tokens override */
  maxTokens?: number;
  
  /** Additional context to inject */
  context?: string;
}

export interface GeneratorPlugin {
  /** Plugin manifest */
  manifest: PluginManifest;
  
  /**
   * Generate code for the given prompt
   * @param prompt User's creative coding request
   * @param options Generation options
   * @returns Generated code string
   */
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  
  /**
   * Optional: Check if this plugin can handle the prompt
   * @param prompt User's request
   * @returns Confidence score 0-1 (0 = can't handle, 1 = perfect match)
   */
  canHandle?(prompt: string): number;
  
  /**
   * Optional: Initialize the plugin (called once on load)
   */
  initialize?(): Promise<void>;
  
  /**
   * Optional: Cleanup when plugin is unloaded
   */
  destroy?(): Promise<void>;
}

export interface PluginLoadError {
  pluginId: string;
  path: string;
  error: string;
}

export interface PluginLoadResult {
  success: boolean;
  plugin?: GeneratorPlugin;
  error?: PluginLoadError;
}

/** Plugin event types for hooks */
export type PluginEventType = 
  | 'plugin:loaded'
  | 'plugin:unloaded'
  | 'plugin:error'
  | 'generation:start'
  | 'generation:complete'
  | 'generation:error';

export interface PluginEvent {
  type: PluginEventType;
  pluginId: string;
  timestamp: string;
  data?: unknown;
}

export type PluginEventHandler = (event: PluginEvent) => void;
