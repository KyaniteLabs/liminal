import { describe, expect, it } from 'vitest';
import { localizeBoundedSelfImprovement } from '../../../src/runtime-core/RepoIndexLite.js';

describe('RepoIndexLite', () => {
  it('produces deterministic bounded startup context for checkpoint-resume work', () => {
    const description = 'Add a checkpoint resume proof for workspace fingerprint drift';

    const first = localizeBoundedSelfImprovement(description);
    const second = localizeBoundedSelfImprovement(description);

    expect(first).toEqual(second);
    expect(first.fileHint).toBe('src/harness/RunStateStore.ts');
    expect(first.workingSet).toEqual([
      'src/harness/RunStateStore.ts',
      'src/harness/agent/LLMModeAgent.ts',
      'test/unit/LLMModeAgent.test.ts',
      'test/harness/RunStateStore.test.ts',
    ]);
    expect(first.workingSet).toHaveLength(4);
  });

  it('keeps non-resume runtime work inside the default bounded runtime-core set', () => {
    const context = localizeBoundedSelfImprovement('Tighten the bounded runtime-core self-improvement facade');

    expect(context.fileHint).toBe('src/runtime-core/SelfImprovementRuntime.ts');
    expect(context.workingSet).toEqual([
      'src/runtime-core/SelfImprovementRuntime.ts',
      'src/harness/agent/LLMModeAgent.ts',
      'src/harness/RunStateStore.ts',
      'test/unit/LLMModeAgent.test.ts',
    ]);
    expect(context.workingSet).toHaveLength(4);
  });
});
