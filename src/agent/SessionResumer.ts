/**
 * SessionResumer — Phase 12 Increment 4
 *
 * Lists and loads session manifests from in-memory SessionGraph
 * instances. Provides session history for the TUI `/sessions` command
 * and restores SessionGraph state when resuming.
 *
 * Session manifests are ephemeral (in-memory) for now.
 * Future: scan LiminalFS for persisted manifests.
 */

import { SessionGraph } from './SessionGraph.js';

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
