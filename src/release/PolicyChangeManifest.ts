/**
 * PolicyChangeManifest — Phase 16
 *
 * Tracks provenance for policy changes: what triggered the change,
 * which experiment justified it, which metrics improved, and
 * what rollback target exists.
 */

export interface PolicyChangeRecord {
  id: string;
  policyKind: string;
  changeDescription: string;
  triggerWeakness?: string;
  experimentId?: string;
  metricsBefore: Record<string, number>;
  metricsAfter: Record<string, number>;
  rollbackTargetId?: string;
  promotedAt: string;
  status: 'staged' | 'promoted' | 'rolled-back';
}

export class PolicyChangeManifest {
  private readonly records = new Map<string, PolicyChangeRecord>();
  private recordCount = 0;

  /**
   * Stage a new policy change before promotion.
   */
  stage(
    policyKind: string,
    changeDescription: string,
    metricsBefore: Record<string, number>,
    opts?: { triggerWeakness?: string; experimentId?: string; rollbackTargetId?: string },
  ): PolicyChangeRecord {
    const id = `change-${++this.recordCount}`;
    const record: PolicyChangeRecord = {
      id,
      policyKind,
      changeDescription,
      triggerWeakness: opts?.triggerWeakness,
      experimentId: opts?.experimentId,
      metricsBefore,
      metricsAfter: {},
      rollbackTargetId: opts?.rollbackTargetId,
      promotedAt: new Date().toISOString(),
      status: 'staged',
    };
    this.records.set(id, record);
    return record;
  }

  /**
   * Promote a staged change with measured results.
   */
  promote(id: string, metricsAfter: Record<string, number>): boolean {
    const record = this.records.get(id);
    if (!record || record.status !== 'staged') return false;

    record.metricsAfter = metricsAfter;
    record.status = 'promoted';
    return true;
  }

  /**
   * Roll back a promoted change.
   */
  rollback(id: string): string | null {
    const record = this.records.get(id);
    if (!record || record.status !== 'promoted') return null;

    record.status = 'rolled-back';
    return record.rollbackTargetId ?? null;
  }

  /**
   * Get changes by status.
   */
  getByStatus(status: PolicyChangeRecord['status']): PolicyChangeRecord[] {
    return [...this.records.values()].filter(r => r.status === status);
  }

  /**
   * Get the most recent promoted change for a policy kind.
   */
  getLatest(policyKind: string): PolicyChangeRecord | undefined {
    const records = [...this.records.values()]
      .filter(r => r.policyKind === policyKind && r.status === 'promoted')
      .sort((a, b) => b.promotedAt.localeCompare(a.promotedAt));
    return records[0];
  }

  getRecord(id: string): PolicyChangeRecord | undefined {
    return this.records.get(id);
  }

  getAll(): PolicyChangeRecord[] {
    return [...this.records.values()];
  }

  getRecordCount(): number {
    return this.recordCount;
  }
}
