/**
 * WorkspaceManager — Phase 12 Increment 5
 *
 * Workspace-scoped project management:
 *   - Create/switch/list workspaces
 *   - Each workspace has its own mode config, skill preferences, favorites
 *   - Sessions are tracked per workspace
 *
 * Workspaces are in-memory for now.
 * Future: persist to ~/.liminal/workspaces/<name>/config.json
 */

import type { ProductMode } from './ProductMode.js';

export interface WorkspaceConfig {
  name: string;
  createdAt: string;
  updatedAt: string;
  mode?: ProductMode;
  skillPreferences?: string[];
  favorites?: string[];
  sessionIds?: string[];
}

export class WorkspaceManager {
  private workspaces = new Map<string, WorkspaceConfig>();
  private activeWorkspace: string | null = null;

  /**
   * Create a new workspace with the given name.
   * Returns the config, or undefined if name already exists.
   */
  create(name: string): WorkspaceConfig | undefined {
    if (this.workspaces.has(name)) return undefined;

    const now = new Date().toISOString();
    const config: WorkspaceConfig = {
      name,
      createdAt: now,
      updatedAt: now,
      skillPreferences: [],
      favorites: [],
      sessionIds: [],
    };
    this.workspaces.set(name, config);
    return config;
  }

  /**
   * Get a workspace config by name.
   */
  get(name: string): WorkspaceConfig | undefined {
    return this.workspaces.get(name);
  }

  /**
   * Switch to a workspace. Returns the config or undefined if not found.
   */
  switchTo(name: string): WorkspaceConfig | undefined {
    if (!this.workspaces.has(name)) return undefined;
    this.activeWorkspace = name;
    return this.workspaces.get(name);
  }

  /**
   * Get the active workspace config.
   */
  getActive(): WorkspaceConfig | undefined {
    if (!this.activeWorkspace) return undefined;
    return this.workspaces.get(this.activeWorkspace);
  }

  /**
   * Get the active workspace name.
   */
  get activeName(): string | null {
    return this.activeWorkspace;
  }

  /**
   * List all workspace names.
   */
  list(): string[] {
    return [...this.workspaces.keys()];
  }

  /**
   * List all workspace configs.
   */
  listConfigs(): WorkspaceConfig[] {
    return [...this.workspaces.values()].sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  /**
   * Set the mode preference for a workspace.
   */
  setMode(name: string, mode: ProductMode): boolean {
    const ws = this.workspaces.get(name);
    if (!ws) return false;
    ws.mode = mode;
    ws.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Add a session to a workspace.
   */
  addSession(workspaceName: string, sessionId: string): boolean {
    const ws = this.workspaces.get(workspaceName);
    if (!ws) return false;
    if (!ws.sessionIds) ws.sessionIds = [];
    if (!ws.sessionIds.includes(sessionId)) {
      ws.sessionIds.push(sessionId);
      ws.updatedAt = new Date().toISOString();
    }
    return true;
  }

  /**
   * Add a favorite artifact to a workspace.
   */
  addFavorite(workspaceName: string, artifactRef: string): boolean {
    const ws = this.workspaces.get(workspaceName);
    if (!ws) return false;
    if (!ws.favorites) ws.favorites = [];
    if (!ws.favorites.includes(artifactRef)) {
      ws.favorites.push(artifactRef);
      ws.updatedAt = new Date().toISOString();
    }
    return true;
  }

  /**
   * Get count of workspaces.
   */
  get count(): number {
    return this.workspaces.size;
  }
}
