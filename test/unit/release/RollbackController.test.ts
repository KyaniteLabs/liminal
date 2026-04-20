import { describe, it, expect } from 'vitest';
import { GardenRollbackController } from '../../../src/release/GardenRollbackController.js';
import { PolicyChangeManifest } from '../../../src/release/PolicyChangeManifest.js';

describe('GardenRollbackController', () => {
  function createPromotedManifest(): { manifest: PolicyChangeManifest; changeId: string } {
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage(
      'loop-mix',
      'Increase exploration fraction to 0.6',
      { diversity: 0.3, novelty: 0.5 },
      { rollbackTargetId: 'change-0' },
    );
    manifest.promote(record.id, { diversity: 0.5, novelty: 0.7 });
    return { manifest, changeId: record.id };
  }

  it('rolls back a promoted change', () => {
    const { manifest, changeId } = createPromotedManifest();
    const controller = new GardenRollbackController(manifest);
    const result = controller.rollback(changeId, 'Regressions detected');
    expect(result.rolledBack).toBe(true);
    expect(result.changeId).toBe(changeId);
    expect(result.reason).toBe('Regressions detected');
  });

  it('returns rollbackTargetId from manifest', () => {
    const { manifest, changeId } = createPromotedManifest();
    const controller = new GardenRollbackController(manifest);
    const result = controller.rollback(changeId, 'test');
    expect(result.rollbackTargetId).toBe('change-0');
  });

  it('returns rolledBack=false for non-existent change', () => {
    const manifest = new PolicyChangeManifest();
    const controller = new GardenRollbackController(manifest);
    const result = controller.rollback('nonexistent', 'test');
    expect(result.rolledBack).toBe(false);
    expect(result.reason).toBe('Change not found');
  });

  it('returns rolledBack=false for staged (non-promoted) change', () => {
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage('test', 'desc', {});
    const controller = new GardenRollbackController(manifest);
    const result = controller.rollback(record.id, 'test');
    expect(result.rolledBack).toBe(false);
    expect(result.reason).toContain('staged');
  });

  it('returns rolledBack=false for already rolled-back change', () => {
    const { manifest, changeId } = createPromotedManifest();
    const controller = new GardenRollbackController(manifest);
    controller.rollback(changeId, 'first rollback');
    const second = controller.rollback(changeId, 'second rollback');
    expect(second.rolledBack).toBe(false);
    expect(second.reason).toContain('rolled-back');
  });

  it('rollbackSince rolls back all promoted changes after timestamp', () => {
    const manifest = new PolicyChangeManifest();
    const r1 = manifest.stage('a', 'first', {}, { rollbackTargetId: 'change-0' });
    manifest.promote(r1.id, { score: 0.8 });
    const r2 = manifest.stage('b', 'second', {}, { rollbackTargetId: 'change-0' });
    manifest.promote(r2.id, { score: 0.9 });
    const controller = new GardenRollbackController(manifest);
    const results = controller.rollbackSince('2000-01-01T00:00:00Z', 'batch rollback');
    expect(results).toHaveLength(2);
    expect(results.every(r => r.rolledBack)).toBe(true);
  });

  it('rollbackSince skips changes before the timestamp', () => {
    const manifest = new PolicyChangeManifest();
    const r1 = manifest.stage('a', 'first', {});
    manifest.promote(r1.id, { score: 0.8 });
    const controller = new GardenRollbackController(manifest);
    const results = controller.rollbackSince('2099-01-01T00:00:00Z', 'future rollback');
    expect(results).toHaveLength(0);
  });

  it('canRollback returns true for promoted change', () => {
    const { manifest, changeId } = createPromotedManifest();
    const controller = new GardenRollbackController(manifest);
    expect(controller.canRollback(changeId)).toBe(true);
  });

  it('canRollback returns false for staged change', () => {
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage('test', 'desc', {});
    const controller = new GardenRollbackController(manifest);
    expect(controller.canRollback(record.id)).toBe(false);
  });

  it('canRollback returns false for non-existent change', () => {
    const manifest = new PolicyChangeManifest();
    const controller = new GardenRollbackController(manifest);
    expect(controller.canRollback('nonexistent')).toBe(false);
  });

  it('getHistory returns all rollback results', () => {
    const manifest = new PolicyChangeManifest();
    const r1 = manifest.stage('a', 'first', {}, { rollbackTargetId: 'c-0' });
    manifest.promote(r1.id, { score: 0.8 });
    const r2 = manifest.stage('b', 'second', {}, { rollbackTargetId: 'c-0' });
    manifest.promote(r2.id, { score: 0.9 });
    const controller = new GardenRollbackController(manifest);
    controller.rollback(r1.id, 'reason 1');
    controller.rollback(r2.id, 'reason 2');
    const history = controller.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].reason).toBe('reason 1');
    expect(history[1].reason).toBe('reason 2');
  });

  it('getHistory returns empty array when no rollbacks performed', () => {
    const manifest = new PolicyChangeManifest();
    const controller = new GardenRollbackController(manifest);
    expect(controller.getHistory()).toEqual([]);
  });
});
