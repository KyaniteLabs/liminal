/**
 * CortexSupervisor — Phase 13, Increment 4
 *
 * Tracks active leases on dispatched actions, detecting expired
 * and stuck workers on each Cortex loop tick.
 */

import type { ActiveLease } from './types.js';

export class CortexSupervisor {
  private leases: ActiveLease[] = [];

  grantLease(actionId: string, deadlineMs: number, description: string): ActiveLease {
    const lease: ActiveLease = {
      actionId,
      startedAt: new Date().toISOString(),
      deadlineMs,
      description,
    };
    this.leases.push(lease);
    return lease;
  }

  revokeLease(actionId: string): boolean {
    const idx = this.leases.findIndex((l) => l.actionId === actionId);
    if (idx === -1) return false;
    this.leases.splice(idx, 1);
    return true;
  }

  checkExpired(): ActiveLease[] {
    const now = Date.now();
    const expired: ActiveLease[] = [];
    const remaining: ActiveLease[] = [];

    for (const lease of this.leases) {
      const elapsed = now - new Date(lease.startedAt).getTime();
      if (elapsed > lease.deadlineMs) {
        expired.push(lease);
      } else {
        remaining.push(lease);
      }
    }

    this.leases = remaining;
    return expired;
  }

  getActive(): ActiveLease[] {
    return [...this.leases];
  }

  getStuck(): ActiveLease[] {
    const now = Date.now();
    return this.leases.filter((lease) => {
      const elapsed = now - new Date(lease.startedAt).getTime();
      return elapsed > lease.deadlineMs;
    });
  }

  clear(): void {
    this.leases = [];
  }
}
