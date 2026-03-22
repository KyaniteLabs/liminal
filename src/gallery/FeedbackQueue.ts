/**
 * FeedbackQueue - JSONL-based human rating storage
 *
 * Stores and retrieves human feedback ratings for gallery creations.
 * Uses JSONL (one JSON object per line) for append-friendly persistence.
 */

import fs from 'fs/promises';

export interface Feedback {
  id: string;
  creationId: string;
  rating: number; // 0-5 stars
  timestamp: string;
  processed: boolean;
}

export class FeedbackQueue {
  private path: string;
  private feedbacks: Feedback[];

  constructor(path?: string) {
    this.path = path ?? 'gallery/feedback.jsonl';
    this.feedbacks = [];
  }

  /** Add a new feedback entry. Auto-generates id and timestamp. */
  add(feedback: Omit<Feedback, 'id' | 'timestamp'> & { timestamp?: string }): Feedback {
    const entry: Feedback = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...feedback,
      timestamp: feedback.timestamp ?? new Date().toISOString(),
    };
    this.feedbacks.push(entry);
    return entry;
  }

  /** Get unprocessed feedback entries */
  pending(): Feedback[] {
    return this.feedbacks.filter(f => !f.processed);
  }

  /** Mark a feedback entry as processed */
  markProcessed(id: string): void {
    const entry = this.feedbacks.find(f => f.id === id);
    if (entry) {
      entry.processed = true;
    }
  }

  /** Get all feedback entries */
  getAll(): Feedback[] {
    return this.feedbacks;
  }

  /** Save current state to JSONL file */
  async save(): Promise<void> {
    const lines = this.feedbacks.map(f => JSON.stringify(f)).join('\n');
    await fs.writeFile(this.path, lines + '\n', 'utf-8');
  }

  /** Load state from JSONL file */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.path, 'utf-8');
      this.feedbacks = content
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => JSON.parse(line) as Feedback);
    } catch (loadError) {
      this.feedbacks = [];
    }
  }
}
