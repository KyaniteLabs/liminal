/**
 * HeapMonitor — monitors heap size and auto-triggers digestion.
 */

import { CompostMill } from './CompostMill.js';
import { Logger } from '../utils/Logger.js';

export class HeapMonitor {
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private digesting = false;

  constructor(intervalMs: number = 60000) {
    this.intervalMs = intervalMs;
  }

  start(mill: CompostMill): void {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      if (this.digesting) return; // debounce

      try {
        const shouldDigest = await mill.shouldAutoDigest();
        if (shouldDigest) {
          this.digesting = true;
          await mill.digest();
          this.digesting = false;
        }
      } catch (err) {
        Logger.warn('HeapMonitor', 'auto-digest failed:', err);
        this.digesting = false;
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
