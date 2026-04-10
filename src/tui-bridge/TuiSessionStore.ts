import type { TuiSessionStatus } from './types.js';

export class TuiSessionStore {
  private sessions = new Map<string, TuiSessionStatus>();

  create(status: TuiSessionStatus): TuiSessionStatus {
    this.sessions.set(status.sessionId, status);
    return status;
  }

  get(sessionId: string): TuiSessionStatus | undefined {
    return this.sessions.get(sessionId);
  }

  update(sessionId: string, patch: Partial<TuiSessionStatus>): TuiSessionStatus {
    const current = this.sessions.get(sessionId);
    if (!current) throw new Error(`Unknown TUI session: ${sessionId}`);
    const next = { ...current, ...patch };
    this.sessions.set(sessionId, next);
    return next;
  }

  /** Return all active session IDs. */
  list(): string[] {
    return [...this.sessions.keys()];
  }
}
