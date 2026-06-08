/**
 * SessionResumer — Phase 12 Increment 4
 *
 * Lists and loads session manifests. Provides session history for the TUI
 * `/sessions` command and restores SessionGraph state when resuming.
 *
 * Sessions registered during the live process are tracked in memory; sessions
 * from prior processes are hydrated from SinterFS via {@link hydrate}, so
 * `/sessions` accumulates across restarts instead of resetting each session.
 */

import { SessionGraph } from './SessionGraph.js';
import type { SinterFS } from '../fs/SinterFS.js';

export interface SessionEntry {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
  lastIntent?: string;
}

export class SessionResumer {
  private graphs = new Map<string, SessionGraph>();

  /**
   * Register a SessionGraph for tracking.
   */
  register(sessionId: string, graph: SessionGraph): void {
    this.graphs.set(sessionId, graph);
  }

  /**
   * Hydrate previously-persisted sessions from SinterFS into the in-memory
   * tracking map, so `/sessions` and resume see history from prior processes.
   * Idempotent: sessions already registered (this process) are left untouched.
   * Returns the number of sessions newly loaded. Empty store → loads nothing,
   * never throws.
   */
  hydrate(fs: SinterFS): number {
    let loaded = 0;
    for (const name of fs.listManifests('session')) {
      const match = name.match(/^session\/(.+)\/manifest$/);
      if (!match) continue; // skip per-turn manifests
      const sessionId = match[1];
      if (this.graphs.has(sessionId)) continue;
      const graph = SessionGraph.load(fs, sessionId);
      if (graph) {
        this.graphs.set(sessionId, graph);
        loaded++;
      }
    }
    return loaded;
  }

  /**
   * List all registered sessions as summaries.
   */
  listSessions(): SessionEntry[] {
    const entries: SessionEntry[] = [];
    for (const [, graph] of this.graphs) {
      const manifest = graph.getManifest();
      entries.push({
        sessionId: manifest.sessionId,
        createdAt: manifest.createdAt,
        updatedAt: manifest.updatedAt,
        turnCount: manifest.turnCount,
        lastIntent: manifest.lastIntent,
      });
    }
    return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /**
   * Get a specific session's graph.
   */
  getSession(sessionId: string): SessionGraph | undefined {
    return this.graphs.get(sessionId);
  }

  /**
   * Remove a session from tracking.
   */
  remove(sessionId: string): boolean {
    return this.graphs.delete(sessionId);
  }

  /**
   * Get count of tracked sessions.
   */
  get sessionCount(): number {
    return this.graphs.size;
  }
}
