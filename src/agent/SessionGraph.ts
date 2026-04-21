/**
 * SessionGraph — Phase 11 Increment 3
 *
 * Persists every chat turn, delegation decision, and artifact reference
 * as LiminalFS manifests. Sessions are resumable: each session stores
 * a manifest and individual turn records.
 *
 * Design: accepts LiminalFS optionally. When no FS is provided,
 * operates in memory-only mode (graceful degradation for tests
 * and environments without a project root).
 */

import type { LiminalFS } from '../fs/index.js';

// ── Types ──

/** A single turn in a session (flattened for persistence) */
export interface SessionTurnRecord {
  turnId: string;
  input: string;
  intent: string;
  delegatedTo: string;
  response: string;
  durationMs: number;
  artifactRefs?: string[];
  taskRefs?: string[];
  model?: string;
  timestamp: string;
}

/** Session manifest metadata */
export interface SessionManifest {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
  lastIntent?: string;
  lastDelegatedTo?: string;
}

// ── SessionGraph ──

export class SessionGraph {
  private turns: SessionTurnRecord[] = [];
  private manifest: SessionManifest;

  constructor(
    private readonly sessionId: string,
    private readonly fs?: LiminalFS,
  ) {
    const now = new Date().toISOString();
    this.manifest = {
      sessionId,
      createdAt: now,
      updatedAt: now,
      turnCount: 0,
    };
  }

  /**
   * Record a completed turn.
   * Persists to LiminalFS if available, otherwise stores in memory.
   */
  recordTurn(turn: Omit<SessionTurnRecord, 'timestamp'>): SessionTurnRecord {
    const fullTurn: SessionTurnRecord = {
      ...turn,
      timestamp: new Date().toISOString(),
    };

    this.turns.push(fullTurn);

    // Update manifest
    this.manifest.turnCount = this.turns.length;
    this.manifest.updatedAt = fullTurn.timestamp;
    this.manifest.lastIntent = fullTurn.intent;
    this.manifest.lastDelegatedTo = fullTurn.delegatedTo;

    // Persist to LiminalFS if available
    if (this.fs) {
      this.persistTurn(fullTurn);
      this.persistManifest();
    }

    return fullTurn;
  }

  /** Get all recorded turns */
  getTurns(): SessionTurnRecord[] {
    return [...this.turns];
  }

  /** Get the session manifest */
  getManifest(): SessionManifest {
    return { ...this.manifest };
  }

  /** Get a specific turn by ID */
  getTurn(turnId: string): SessionTurnRecord | undefined {
    return this.turns.find(t => t.turnId === turnId);
  }

  /** Get turns filtered by intent */
  getTurnsByIntent(intent: string): SessionTurnRecord[] {
    return this.turns.filter(t => t.intent === intent);
  }

  /** Get turns filtered by delegation target */
  getTurnsByDelegation(target: string): SessionTurnRecord[] {
    return this.turns.filter(t => t.delegatedTo === target);
  }

  /** Get all artifact references across all turns */
  getAllArtifactRefs(): string[] {
    return this.turns.flatMap(t => t.artifactRefs ?? []);
  }

  /** Get all task references across all turns */
  getAllTaskRefs(): string[] {
    return this.turns.flatMap(t => t.taskRefs ?? []);
  }

  // ── Persistence ──

  private persistTurn(turn: SessionTurnRecord): void {
    if (!this.fs) return;
    const name = `session/${this.sessionId}/turn/${turn.turnId}`;
    this.fs.writeManifest(name, turn as unknown as Record<string, unknown>);
  }

  private persistManifest(): void {
    if (!this.fs) return;
    const name = `session/${this.sessionId}/manifest`;
    this.fs.writeManifest(name, this.manifest as unknown as Record<string, unknown>);
  }
}
