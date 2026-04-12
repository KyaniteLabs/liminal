export interface RepoIndexLiteContext {
  domain: string;
  fileHint: string;
  intro: string;
  workingSet: string[];
  primaryFiles: string[];
  secondaryFiles: string[];
  deferredSecondaryFiles: string[];
  expansionBudget: number;
  expansionStatus: 'allowed' | 'exhausted';
  localizationConfidence: 'high' | 'medium' | 'low';
  verificationTargets: VerificationTarget[];
}

export interface VerificationTarget {
  tool: 'runBuild' | 'runTests' | 'typeCheck';
  reason: string;
  pattern?: string;
  priority: number;
}

interface RepoIndexLiteProfile {
  domain: string;
  intro: string;
  primaryFiles: string[];
  secondaryCandidates: string[];
  expansionBudget: number;
  localizationConfidence: 'high' | 'medium' | 'low';
  verificationTargets: VerificationTarget[];
}

const DEFAULT_RUNTIME_PROFILE: RepoIndexLiteProfile = {
  domain: 'runtime-core',
  intro: 'Start in these runtime-core files before any broader reconnaissance. Only expand beyond this working set if the requested fix cannot be completed there:',
  primaryFiles: [
    'src/runtime-core/SelfImprovementRuntime.ts',
    'src/harness/agent/LLMModeAgent.ts',
  ],
  secondaryCandidates: [
    'src/harness/RunStateStore.ts',
    'test/unit/LLMModeAgent.test.ts',
  ],
  expansionBudget: 2,
  localizationConfidence: 'medium',
  verificationTargets: [
    { tool: 'typeCheck', reason: 'Fast first-pass verification for runtime-core TypeScript changes', priority: 1 },
    { tool: 'runBuild', reason: 'Full TypeScript build after runtime-core edits', priority: 2 },
  ],
};

const CHECKPOINT_RESUME_PROFILE: RepoIndexLiteProfile = {
  domain: 'runstate',
  intro: 'Work in these checkpoint/resume files first before exploring elsewhere:',
  primaryFiles: [
    'src/harness/RunStateStore.ts',
    'src/harness/agent/LLMModeAgent.ts',
  ],
  secondaryCandidates: [
    'test/unit/LLMModeAgent.test.ts',
    'test/harness/RunStateStore.test.ts',
  ],
  expansionBudget: 2,
  localizationConfidence: 'high',
  verificationTargets: [
    { tool: 'runTests', pattern: 'LLMModeAgent|RunStateStore', reason: 'Checkpoint/resume regressions should hit focused runtime tests first', priority: 1 },
    { tool: 'runBuild', reason: 'Full TypeScript build after resume/checkpoint changes', priority: 2 },
  ],
};

const LOCALIZATION_PACKET_PROFILE: RepoIndexLiteProfile = {
  domain: 'runtime-core',
  intro: 'Start with the headless localization packet files. Keep exploration inside this bounded packet before broadening outward:',
  primaryFiles: [
    'src/runtime-core/RepoIndexLite.ts',
    'src/runtime-core/SelfImprovementRuntime.ts',
  ],
  secondaryCandidates: [
    'test/unit/runtime-core/RepoIndexLite.test.ts',
    'test/unit/runtime-core/SelfImprovementRuntime.test.ts',
    'src/harness/agent/LLMModeAgent.ts',
  ],
  expansionBudget: 2,
  localizationConfidence: 'high',
  verificationTargets: [
    { tool: 'runTests', pattern: 'runtime-core', reason: 'Runtime-core packet shaping changes should hit focused runtime tests first', priority: 1 },
    { tool: 'runBuild', reason: 'Full TypeScript build after packet-shaping edits', priority: 2 },
  ],
};

function dedupeFiles(files: string[]): string[] {
  return Array.from(new Set(files));
}

function buildContext(profile: RepoIndexLiteProfile): RepoIndexLiteContext {
  const primaryFiles = dedupeFiles(profile.primaryFiles);
  const boundedCandidates = dedupeFiles(profile.secondaryCandidates).filter((file) => !primaryFiles.includes(file));
  const secondaryFiles = boundedCandidates.slice(0, profile.expansionBudget);
  const deferredSecondaryFiles = boundedCandidates.slice(profile.expansionBudget);
  const workingSet = [...primaryFiles, ...secondaryFiles];

  return {
    domain: profile.domain,
    fileHint: primaryFiles[0],
    intro: profile.intro,
    workingSet,
    primaryFiles,
    secondaryFiles,
    deferredSecondaryFiles,
    expansionBudget: profile.expansionBudget,
    expansionStatus: deferredSecondaryFiles.length > 0 ? 'allowed' : 'exhausted',
    localizationConfidence: profile.localizationConfidence,
    verificationTargets: profile.verificationTargets,
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
