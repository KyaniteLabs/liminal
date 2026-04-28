export const PRESERVED_CREATIVE_DOMAINS: readonly string[] = [
  'p5',
  'GLSL',
  'Three.js',
  'SVG',
  'Hydra',
  'Strudel',
  'Tone.js',
  'Revideo',
  'ASCII',
  'Kinetic',
  'TextGen',
] as const;

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
  creativeDomains: readonly string[];
  preservationClause: string;
}

export interface VerificationTarget {
  tool: 'runBuild' | 'runTests' | 'runFocusedTests' | 'typeCheck';
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
  creativeDomains?: readonly string[];
  preservationClause?: string;
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
    { tool: 'runFocusedTests', pattern: 'RepoIndexLite', reason: 'RepoIndexLite packet-shaping changes should hit focused runtime tests first', priority: 1 },
    { tool: 'runBuild', reason: 'Full TypeScript build after packet-shaping edits', priority: 2 },
  ],
};

const COGNITIVE_LOOP_PROFILE: RepoIndexLiteProfile = {
  domain: 'cognitive-loop',
  intro: 'Start with the cognitive architecture map, then connect the smallest runtime hook to the relevant learning-inspired organs:',
  primaryFiles: [
    'src/reporting/CognitiveArchitectureAtlas.ts',
    'src/runtime-core/SelfImprovementRuntime.ts',
  ],
  secondaryCandidates: [
    'src/compost/CompostMill.ts',
    'src/dreaming/DreamPlanner.ts',
    'src/intuition/IntuitionEngine.ts',
    'src/harness/HarnessMemory.ts',
  ],
  expansionBudget: 2,
  localizationConfidence: 'high',
  verificationTargets: [
    { tool: 'runFocusedTests', pattern: 'CognitiveArchitectureAtlas|SelfImprovementRuntime', reason: 'Cognitive-loop changes should preserve the architecture contract and self-improvement packet shape', priority: 1 },
    { tool: 'runBuild', reason: 'Full TypeScript build after cognitive-loop edits', priority: 2 },
  ],
};

const MODEL_ASSIMILATION_PROFILE: RepoIndexLiteProfile = {
  domain: 'model-assimilation',
  intro: 'Start in provider/model routing surfaces before changing harness execution. Keep model-upgrade work evidence-driven and role-aware:',
  primaryFiles: [
    'src/harness/MultiProviderConfig.ts',
    'src/config/RoleConfig.ts',
  ],
  secondaryCandidates: [
    'src/llm/LLMClient.ts',
    'src/improvement/OpportunityScanner.ts',
    'test/unit/harness/MultiProviderConfig.test.ts',
  ],
  expansionBudget: 2,
  localizationConfidence: 'high',
  verificationTargets: [
    { tool: 'runFocusedTests', pattern: 'MultiProviderConfig|RoleConfig', reason: 'Model-assimilation changes should hit provider and role-routing tests first', priority: 1 },
    { tool: 'runBuild', reason: 'Full TypeScript build after model-assimilation edits', priority: 2 },
  ],
};

const CREATIVE_DOMAIN_RUNTIME_PROFILE: RepoIndexLiteProfile = {
  domain: 'creative-domain-runtime',
  intro: 'Start in the generator registry and the named domain generators. Preserve breadth before optimizing any one domain:',
  primaryFiles: [
    'src/generators/GeneratorRegistry.ts',
    'src/generators/registerGenerators.ts',
  ],
  secondaryCandidates: [
    'src/generators/strudel/StrudelGenerator.ts',
    'src/generators/tone/ToneGenerator.ts',
    'src/generators/revideo/RevideoGenerator.ts',
    'src/generators/svg/SVGGenerator.ts',
    'src/generators/hydra/HydraGenerator.ts',
    'src/generators/three/ThreeGenerator.ts',
    'src/generators/glsl/ShaderGenerator.ts',
    'src/generators/p5/P5Generator.ts',
  ],
  expansionBudget: 4,
  localizationConfidence: 'high',
  verificationTargets: [
    { tool: 'runFocusedTests', pattern: 'GeneratorRegistry|registerGenerators|Strudel|Tone|Revideo|SVG|Hydra', reason: 'Creative-domain runtime changes must preserve registry breadth and named generators', priority: 1 },
    { tool: 'runBuild', reason: 'Full TypeScript build after creative-domain runtime edits', priority: 2 },
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
  const creativeDomains = profile.creativeDomains ?? PRESERVED_CREATIVE_DOMAINS;
  const preservationClause =
    profile.preservationClause ??
    `Preserve all creative domains: ${PRESERVED_CREATIVE_DOMAINS.join(', ')}. Do not build a cockpit or proof theater.`;

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
    creativeDomains,
    preservationClause,
  };
}

export function localizeBoundedSelfImprovement(description: string): RepoIndexLiteContext {
  const normalized = description.toLowerCase();

  if (/checkpoint|resume|fingerprint|workspace drift|suspend|run state/.test(normalized)) {
    return buildContext(CHECKPOINT_RESUME_PROFILE);
  }

  if (/(new model|provider|model.?assimilat|model.?evaluat|model.?upgrade|role.?routing|model comes out|better every time.*model)/i.test(normalized)) {
    return buildContext(MODEL_ASSIMILATION_PROFILE);
  }

  if (/(strudel|tone|revideo|svg|hydra|three|glsl|p5|generator|creative domain)/i.test(normalized)) {
    return buildContext(CREATIVE_DOMAIN_RUNTIME_PROFILE);
  }

  if (/(memory|compost|dream|dreaming|intuition|instinct|reflex|cognitive organ|architecture.*loop|learning-inspired|procedural memory)/i.test(normalized)) {
    return buildContext(COGNITIVE_LOOP_PROFILE);
  }

  if (/repoindexlite|selfimprovementruntime|task packet|working set|bounded self.?improvement|\bloc\b.*(?:confidence|packet|shaping)|\bloc\b.*(?:primary|secondary).*files|packet shaping|\bloc\b(?=.*confidence)(?=.*packet)|agent.?self.?improvement|harness.?self.?improvement|tui.?self.?improvement|self.?improv.*agent|self.?improv.*harness|self.?improv.*tui|improv(?:e|es).*itself.*agent|agent.*improv(?:e|es).*itself|prompt.*liminal.*acts.*improv/i.test(normalized)) {
    return buildContext(LOCALIZATION_PACKET_PROFILE);
  }

  return buildContext(DEFAULT_RUNTIME_PROFILE);
}
