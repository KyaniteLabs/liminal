export interface RepoIndexLiteContext {
  domain: string;
  fileHint: string;
  intro: string;
  workingSet: string[];
  primaryFiles: string[];
  secondaryFiles: string[];
  expansionBudget: number;
  localizationConfidence: 'high' | 'medium' | 'low';
}

interface RepoIndexLiteProfile {
  domain: string;
  intro: string;
  primaryFiles: string[];
  secondaryFiles: string[];
  localizationConfidence: 'high' | 'medium' | 'low';
}

const DEFAULT_RUNTIME_PROFILE: RepoIndexLiteProfile = {
  domain: 'runtime-core',
  intro: 'Start in these runtime-core files before any broader reconnaissance. Only expand beyond this working set if the requested fix cannot be completed there:',
  primaryFiles: [
    'src/runtime-core/SelfImprovementRuntime.ts',
    'src/harness/agent/LLMModeAgent.ts',
  ],
  secondaryFiles: [
    'src/harness/RunStateStore.ts',
    'test/unit/LLMModeAgent.test.ts',
  ],
  localizationConfidence: 'medium',
};

const CHECKPOINT_RESUME_PROFILE: RepoIndexLiteProfile = {
  domain: 'runstate',
  intro: 'Work in these checkpoint/resume files first before exploring elsewhere:',
  primaryFiles: [
    'src/harness/RunStateStore.ts',
    'src/harness/agent/LLMModeAgent.ts',
  ],
  secondaryFiles: [
    'test/unit/LLMModeAgent.test.ts',
    'test/harness/RunStateStore.test.ts',
  ],
  localizationConfidence: 'high',
};

const LOCALIZATION_PACKET_PROFILE: RepoIndexLiteProfile = {
  domain: 'runtime-core',
  intro: 'Start with the headless localization packet files. Keep exploration inside this bounded packet before broadening outward:',
  primaryFiles: [
    'src/runtime-core/RepoIndexLite.ts',
    'src/runtime-core/SelfImprovementRuntime.ts',
  ],
  secondaryFiles: [
    'test/unit/runtime-core/RepoIndexLite.test.ts',
    'test/unit/runtime-core/SelfImprovementRuntime.test.ts',
  ],
  localizationConfidence: 'high',
};

function dedupeFiles(files: string[]): string[] {
  return Array.from(new Set(files));
}

function buildContext(profile: RepoIndexLiteProfile): RepoIndexLiteContext {
  const primaryFiles = dedupeFiles(profile.primaryFiles);
  const secondaryFiles = dedupeFiles(profile.secondaryFiles).filter((file) => !primaryFiles.includes(file));
  const workingSet = [...primaryFiles, ...secondaryFiles];

  return {
    domain: profile.domain,
    fileHint: primaryFiles[0],
    intro: profile.intro,
    workingSet,
    primaryFiles,
    secondaryFiles,
    expansionBudget: secondaryFiles.length,
    localizationConfidence: profile.localizationConfidence,
  };
}

export function localizeBoundedSelfImprovement(description: string): RepoIndexLiteContext {
  const normalized = description.toLowerCase();

  if (/checkpoint|resume|fingerprint|workspace drift|suspend|run state/.test(normalized)) {
    return buildContext(CHECKPOINT_RESUME_PROFILE);
  }

  if (/repoindexlite|selfimprovementruntime|task packet|working set|bounded localization|localization confidence|primary files|secondary files|expansion budget|packet shaping|localization/.test(normalized)) {
    return buildContext(LOCALIZATION_PACKET_PROFILE);
  }

  return buildContext(DEFAULT_RUNTIME_PROFILE);
}
