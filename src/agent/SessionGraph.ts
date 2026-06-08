/**
 * SessionGraph — Phase 11 Increment 3
 *
 * Persists every chat turn, delegation decision, and artifact reference
 * as SinterFS manifests. Sessions are resumable: each session stores
 * a manifest and individual turn records.
 *
 * Design: accepts SinterFS optionally. When no FS is provided,
 * operates in memory-only mode (graceful degradation for tests
 * and environments without a project root).
 */

import type { SinterFS } from '../fs/index.js';

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
    private readonly fs?: SinterFS,
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
   * Reconstruct a SessionGraph from manifests previously persisted to SinterFS
   * (the read counterpart to {@link persistTurn}/{@link persistManifest}). Reads
   * the session manifest plus all of its turn records, ordered by timestamp.
   * Returns `null` when no manifest exists for the session. The returned graph
   * keeps `fs` attached, so subsequent turns continue to persist.
   */
  static load(fs: SinterFS, sessionId: string): SessionGraph | null {
    const manifestData = fs.readManifest(`session/${sessionId}/manifest`);
    if (!manifestData) return null;

    const graph = new SessionGraph(sessionId, fs);
    graph.manifest = manifestData as unknown as SessionManifest;

    const turns: SessionTurnRecord[] = [];
    for (const name of fs.listManifests(`session/${sessionId}/turn`)) {
      const data = fs.readManifest(name);
      if (data) turns.push(data as unknown as SessionTurnRecord);
    }
    turns.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    graph.turns = turns;

    return graph;
  }

  /**
   * Record a completed turn.
   * Persists to SinterFS if available, otherwise stores in memory.
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

    // Persist to SinterFS if available
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
