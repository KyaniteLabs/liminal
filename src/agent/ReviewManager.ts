/**
 * ReviewManager — Phase 12
 *
 * Manages the candidate lifecycle for artifact review:
 *   pending → accepted | rejected
 *
 * Also tracks favorites (pinned artifacts) and provides
 * comparison between two candidate versions.
 *
 * Lives in TuiBridgeService. Candidates are created when
 * generation produces output, and the user accepts/rejects
 * via TUI keyboard shortcuts or commands.
 */

export type CandidateStatus = 'pending' | 'accepted' | 'rejected';

export interface ReviewCandidate {
  /** Unique candidate ID */
  id: string;
  /** Short label for display */
  label: string;
  /** Content (code, text, or artifact ref) */
  content: string;
  /** Score from evaluation (0-1) */
  score: number;
  /** Current status */
  status: CandidateStatus;
  /** ISO timestamp when created */
  createdAt: string;
  /** Session that produced this candidate */
  sessionId: string;
}

export class ReviewManager {
  private readonly candidates = new Map<string, ReviewCandidate>();
  private readonly favorites = new Set<string>();

  /**
   * Add a new candidate from a generation result.
   */
  addCandidate(sessionId: string, label: string, content: string, score: number): ReviewCandidate {
    const id = `candidate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const candidate: ReviewCandidate = {
      id,
      label,
      content,
      score,
      status: 'pending',
      createdAt: new Date().toISOString(),
      sessionId,
    };
    this.candidates.set(id, candidate);
    return candidate;
  }

  /**
   * Accept a candidate — marks it as the chosen output.
   */
  accept(candidateId: string): ReviewCandidate | null {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) return null;
    candidate.status = 'accepted';
    return candidate;
  }

  /**
   * Reject a candidate — marks it as not chosen.
   */
  reject(candidateId: string): ReviewCandidate | null {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) return null;
    candidate.status = 'rejected';
    return candidate;
  }

  /**
   * Pin a candidate as a favorite.
   */
  pin(candidateId: string): boolean {
    if (!this.candidates.has(candidateId)) return false;
    this.favorites.add(candidateId);
    return true;
  }

  /**
   * Unpin a candidate from favorites.
   */
  unpin(candidateId: string): void {
    this.favorites.delete(candidateId);
  }

  /**
   * Get a specific candidate.
   */
  get(candidateId: string): ReviewCandidate | undefined {
    return this.candidates.get(candidateId);
  }

  /**
   * List candidates, optionally filtered by session and status.
   */
  list(filter?: { sessionId?: string; status?: CandidateStatus }): ReviewCandidate[] {
    let results = [...this.candidates.values()];
    if (filter?.sessionId) {
      results = results.filter(c => c.sessionId === filter.sessionId);
    }
    if (filter?.status) {
      results = results.filter(c => c.status === filter.status);
    }
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * List all favorite candidate IDs.
   */
  listFavorites(): string[] {
    return [...this.favorites];
  }

  /**
   * Clear all candidates for a session.
   */
  clearSession(sessionId: string): void {
    for (const [id, c] of this.candidates) {
      if (c.sessionId === sessionId) {
        this.candidates.delete(id);
        this.favorites.delete(id);
      }
    }
  }
}
