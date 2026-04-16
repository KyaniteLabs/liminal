/**
 * GardenRollbackController — Phase 16
 *
 * Manages rollback of promoted policy changes.
 * Tracks rollback history and validates rollback targets.
 */

import { PolicyChangeManifest } from './PolicyChangeManifest.js';

export interface RollbackResult {
  changeId: string;
  rolledBack: boolean;
  rollbackTargetId: string | null;
  reason: string;
}

export class GardenRollbackController {
  private readonly manifest: PolicyChangeManifest;
  private readonly rollbackHistory: RollbackResult[] = [];

  constructor(manifest: PolicyChangeManifest) {
    this.manifest = manifest;
  }

  /**
   * Roll back a promoted change by its ID.
   */
  rollback(changeId: string, reason: string): RollbackResult {
    const record = this.manifest.getRecord(changeId);
    if (!record) {
      return { changeId, rolledBack: false, rollbackTargetId: null, reason: 'Change not found' };
    }

    if (record.status !== 'promoted') {
      return { changeId, rolledBack: false, rollbackTargetId: null, reason: `Change is ${record.status}, not promoted` };
    }

    const targetId = this.manifest.rollback(changeId);
    const result: RollbackResult = {
      changeId,
      rolledBack: true,
      rollbackTargetId: targetId,
      reason,
    };

    this.rollbackHistory.push(result);
    return result;
  }

  /**
   * Roll back all changes from a specific timestamp forward.
   */
  rollbackSince(timestamp: string, reason: string): RollbackResult[] {
    const promoted = this.manifest.getByStatus('promoted')
      .filter(r => r.promotedAt >= timestamp);

    return promoted.map(r => this.rollback(r.id, reason));
  }

  /**
   * Get the rollback history.
   */
  getHistory(): RollbackResult[] {
    return [...this.rollbackHistory];
  }

  /**
   * Check if a change can be rolled back.
   */
  canRollback(changeId: string): boolean {
    const record = this.manifest.getRecord(changeId);
    return record?.status === 'promoted';
  }
}
