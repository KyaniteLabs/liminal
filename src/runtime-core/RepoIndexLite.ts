export interface RepoIndexLiteContext {
  fileHint: string;
  intro: string;
  workingSet: string[];
}

const DEFAULT_WORKING_SET = [
  'src/runtime-core/SelfImprovementRuntime.ts',
  'src/harness/agent/LLMModeAgent.ts',
  'src/harness/RunStateStore.ts',
  'test/unit/LLMModeAgent.test.ts',
];

const CHECKPOINT_RESUME_WORKING_SET = [
  'src/harness/RunStateStore.ts',
  'src/harness/agent/LLMModeAgent.ts',
  'test/unit/LLMModeAgent.test.ts',
  'test/harness/RunStateStore.test.ts',
];

export function localizeBoundedSelfImprovement(description: string): RepoIndexLiteContext {
  const normalized = description.toLowerCase();

  if (/checkpoint|resume|fingerprint|workspace drift|suspend|run state/.test(normalized)) {
    return {
      fileHint: CHECKPOINT_RESUME_WORKING_SET[0],
      intro: 'Work in these files first before exploring elsewhere:',
      workingSet: CHECKPOINT_RESUME_WORKING_SET,
    };
  }

  return {
    fileHint: DEFAULT_WORKING_SET[0],
    intro: 'Start in these runtime-core files before any broader reconnaissance. Only expand beyond this working set if the requested fix cannot be completed there:',
    workingSet: DEFAULT_WORKING_SET,
  };
}
