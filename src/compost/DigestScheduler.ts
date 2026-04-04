/**
 * DigestScheduler — schedules periodic digestion runs.
 */

import { CompostMill } from './CompostMill.js';
import { Logger } from '../utils/Logger.js';

export class DigestScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;

  schedule(mill: CompostMill, mode: 'manual' | 'daily' | 'weekly'): void {
    if (mode === 'manual') return;

    const ms = mode === 'daily'
      ? 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;

    const run = async () => {
      try {
        await mill.digest();
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures++;
        Logger.warn('DigestScheduler', 'scheduled digest failed:', err);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          Logger.error('DigestScheduler', `${MAX_CONSECUTIVE_FAILURES} consecutive digest failures, stopping scheduler`);
          return;
        }
      }
      // Reschedule
      this.timer = setTimeout(() => void run(), ms);
    };

    this.timer = setTimeout(() => void run(), ms);
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
