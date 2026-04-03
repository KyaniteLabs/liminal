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

    const run = async () => {
      try {
        await mill.digest();
      } catch (err) {
        Logger.warn('DigestScheduler', 'scheduled digest failed:', err);
      }
      // Reschedule
      this.timer = setTimeout(run, ms);
    };

    this.timer = setTimeout(run, ms);
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
