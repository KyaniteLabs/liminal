import { describe, expect, it } from 'vitest';
import { localizeBoundedSelfImprovement } from '../../../src/runtime-core/RepoIndexLite.js';

describe('RepoIndexLite', () => {
  it('keeps bounded packet contracts internally consistent across runtime-core and runstate lanes', () => {
    const cases = [
      {
        description: 'Tighten the bounded runtime-core self-improvement facade',
        expectedDomain: 'runtime-core',
        expectedConfidence: 'medium',
      },
      {
        description: 'Resume checkpoint state after WORKSPACE fingerprint drift',
        expectedDomain: 'runstate',
        expectedConfidence: 'high',
      },
    ] as const;

    for (const testCase of cases) {
      const context = localizeBoundedSelfImprovement(testCase.description);
      expect(context.domain).toBe(testCase.expectedDomain);
      expect(context.localizationConfidence).toBe(testCase.expectedConfidence);
      expect(context.fileHint).toBe(context.primaryFiles[0]);
      expect(context.workingSet).toEqual([...context.primaryFiles, ...context.secondaryFiles]);
      expect(context.workingSet.length).toBe(context.primaryFiles.length + context.secondaryFiles.length);
      expect(new Set(context.workingSet).size).toBe(context.workingSet.length);
      expect(context.primaryFiles.every((file) => !context.secondaryFiles.includes(file))).toBe(true);
      expect(context.secondaryFiles.every((file) => !context.deferredSecondaryFiles.includes(file))).toBe(true);
      expect(context.workingSet.includes(context.fileHint)).toBe(true);
      expect(context.secondaryFiles.length).toBeLessThanOrEqual(context.expansionBudget);
      expect(context.expansionStatus).toBe(context.deferredSecondaryFiles.length > 0 ? 'allowed' : 'exhausted');
      expect(context.verificationTargets.length).toBeGreaterThan(0);
      expect(context.verificationTargets[0].priority).toBe(1);
      expect(Array.isArray(context.creativeDomains)).toBe(true);
      expect(context.creativeDomains.length).toBeGreaterThan(0);
      expect(context.preservationClause).toBeTruthy();
      expect(typeof context.preservationClause).toBe('string');
    }
  });

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
    expect(first.primaryFiles).toEqual([
      'src/harness/RunStateStore.ts',
      'src/harness/agent/LLMModeAgent.ts',
    ]);
    expect(first.secondaryFiles).toEqual([
      'test/unit/LLMModeAgent.test.ts',
      'test/harness/RunStateStore.test.ts',
    ]);
    expect(first.deferredSecondaryFiles).toEqual([]);
    expect(first.expansionBudget).toBe(2);
    expect(first.expansionStatus).toBe('exhausted');
    expect(first.localizationConfidence).toBe('high');
    expect(first.verificationTargets).toEqual([
      {
        tool: 'runTests',
        pattern: 'LLMModeAgent|RunStateStore',
        reason: 'Checkpoint/resume regressions should hit focused runtime tests first',
        priority: 1,
      },
      {
        tool: 'runBuild',
        reason: 'Full TypeScript build after resume/checkpoint changes',
        priority: 2,
      },
    ]);
    expect(first.secondaryFiles.length).toBe(first.expansionBudget);
    expect(first.workingSet).toEqual([...first.primaryFiles, ...first.secondaryFiles]);
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
    expect(context.primaryFiles).toEqual([
      'src/runtime-core/SelfImprovementRuntime.ts',
      'src/harness/agent/LLMModeAgent.ts',
    ]);
    expect(context.secondaryFiles).toEqual([
      'src/harness/RunStateStore.ts',
      'test/unit/LLMModeAgent.test.ts',
    ]);
    expect(context.deferredSecondaryFiles).toEqual([]);
    expect(context.expansionBudget).toBe(2);
    expect(context.expansionStatus).toBe('exhausted');
    expect(context.localizationConfidence).toBe('medium');
    expect(context.verificationTargets).toEqual([
      {
        tool: 'typeCheck',
        reason: 'Fast first-pass verification for runtime-core TypeScript changes',
        priority: 1,
      },
      {
        tool: 'runBuild',
        reason: 'Full TypeScript build after runtime-core edits',
        priority: 2,
      },
    ]);
    expect(context.secondaryFiles.length).toBe(context.expansionBudget);
    expect(context.workingSet).toEqual([...context.primaryFiles, ...context.secondaryFiles]);
    expect(context.workingSet).toHaveLength(4);
  });

  it('selects a RepoIndexLite-first bounded packet for localization-oriented prompts', () => {
    const context = localizeBoundedSelfImprovement('Tighten RepoIndexLite task packet shaping and working set localization confidence');

    expect(context.domain).toBe('runtime-core');
    expect(context.fileHint).toBe('src/runtime-core/RepoIndexLite.ts');
    expect(context.primaryFiles).toEqual([
      'src/runtime-core/RepoIndexLite.ts',
      'src/runtime-core/SelfImprovementRuntime.ts',
    ]);
    expect(context.secondaryFiles).toEqual([
      'test/unit/runtime-core/RepoIndexLite.test.ts',
      'test/unit/runtime-core/SelfImprovementRuntime.test.ts',
    ]);
    expect(context.deferredSecondaryFiles).toEqual([
      'src/harness/agent/LLMModeAgent.ts',
    ]);
    expect(context.workingSet).toEqual([...context.primaryFiles, ...context.secondaryFiles]);
    expect(new Set(context.workingSet).size).toBe(context.workingSet.length);
    expect(context.secondaryFiles.length).toBe(context.expansionBudget);
    expect(context.expansionStatus).toBe('allowed');
    expect(context.workingSet).not.toContain('src/harness/agent/LLMModeAgent.ts');
    expect(context.localizationConfidence).toBe('high');
    expect(context.verificationTargets).toEqual([
      {
        tool: 'runFocusedTests',
        pattern: 'RepoIndexLite',
        reason: 'RepoIndexLite packet-shaping changes should hit focused runtime tests first',
        priority: 1,
      },
      {
        tool: 'runBuild',
        reason: 'Full TypeScript build after packet-shaping edits',
        priority: 2,
      },
    ]);
  });

  it('routes broad agent/harness self-improvement prompts to packet localization instead of the generic runtime facade', () => {
    const prompts = [
      'Make the prompt to Liminal acts to Liminal improves itself loop concrete for the agent',
      'Improve harness self-improvement without narrowing the creative surface',
      'Tighten TUI self-improvement routing so broad requests become bounded repo work',
    ];

    for (const prompt of prompts) {
      const context = localizeBoundedSelfImprovement(prompt);

      expect(context.fileHint).toBe('src/runtime-core/RepoIndexLite.ts');
      expect(context.primaryFiles).toEqual([
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
      ]);
      expect(context.verificationTargets[0]).toMatchObject({
        tool: 'runFocusedTests',
        pattern: 'RepoIndexLite',
      });
    }
  });

  it('routes cognitive-organ self-improvement to memory compost dreaming and intuition files', () => {
    const context = localizeBoundedSelfImprovement('Improve the way memory compost dreaming and intuition feed the self-improvement loop');

    expect(context.domain).toBe('cognitive-loop');
    expect(context.fileHint).toBe('src/reporting/CognitiveArchitectureAtlas.ts');
    expect(context.primaryFiles).toEqual([
      'src/reporting/CognitiveArchitectureAtlas.ts',
      'src/runtime-core/SelfImprovementRuntime.ts',
    ]);
    expect(context.workingSet).toContain('src/compost/CompostMill.ts');
    expect(context.workingSet).toContain('src/dreaming/DreamPlanner.ts');
    expect(context.deferredSecondaryFiles).toContain('src/intuition/IntuitionEngine.ts');
    expect(context.preservationClause).toContain('Preserve all creative domains');
  });

  it('routes model assimilation requests to provider/model evaluation surfaces', () => {
    const context = localizeBoundedSelfImprovement('Make yourself get better every time a new model or provider comes out');

    expect(context.domain).toBe('model-assimilation');
    expect(context.fileHint).toBe('src/harness/MultiProviderConfig.ts');
    expect(context.primaryFiles).toEqual([
      'src/harness/MultiProviderConfig.ts',
      'src/config/RoleConfig.ts',
    ]);
    expect(context.verificationTargets[0]).toMatchObject({
      tool: 'runFocusedTests',
      pattern: 'MultiProviderConfig|RoleConfig',
    });
  });

  it('routes creative-domain improvement requests to the generator registry without dropping domains', () => {
    const context = localizeBoundedSelfImprovement('Improve Strudel Tone Revideo SVG and Hydra capability without narrowing the creative surface');

    expect(context.domain).toBe('creative-domain-runtime');
    expect(context.fileHint).toBe('src/generators/GeneratorRegistry.ts');
    expect(context.workingSet).toEqual([
      'src/generators/GeneratorRegistry.ts',
      'src/generators/registerGenerators.ts',
      'src/generators/strudel/StrudelGenerator.ts',
      'src/generators/tone/ToneGenerator.ts',
      'src/generators/revideo/RevideoGenerator.ts',
      'src/generators/svg/SVGGenerator.ts',
    ]);
    expect(context.deferredSecondaryFiles).toContain('src/generators/hydra/HydraGenerator.ts');
    expect(context.creativeDomains).toEqual(expect.arrayContaining(['Strudel', 'Tone.js', 'Revideo', 'SVG', 'Hydra']));
  });

  it('keeps localization expansion overflow deterministic across repeated similar prompts', () => {
    const first = localizeBoundedSelfImprovement('Tighten RepoIndexLite task packet shaping and expansion budget determinism');
    const second = localizeBoundedSelfImprovement('Improve localization confidence and packet shaping in SelfImprovementRuntime');

    expect(first.primaryFiles).toEqual([
      'src/runtime-core/RepoIndexLite.ts',
      'src/runtime-core/SelfImprovementRuntime.ts',
    ]);
    expect(second.primaryFiles).toEqual(first.primaryFiles);
    expect(second.secondaryFiles).toEqual(first.secondaryFiles);
    expect(second.deferredSecondaryFiles).toEqual(first.deferredSecondaryFiles);
    expect(second.expansionStatus).toBe('allowed');
  });
});
