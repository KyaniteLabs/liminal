import { Status } from '../types/status.js';
import { localizeBoundedSelfImprovement, PRESERVED_CREATIVE_DOMAINS } from './RepoIndexLite.js';

export type CognitiveOrgan =
  | 'reflexes'
  | 'memory'
  | 'compost'
  | 'dreaming'
  | 'intuition'
  | 'harness'
  | 'creative-domains'
  | 'model-assimilation';

export type SelfImprovementFailureClass =
  | 'none'
  | 'no-mutation'
  | 'tool-schema-drift'
  | 'verification-mismatch'
  | 'rolled-back'
  | 'unknown';

export type SelfImprovementReflexAction =
  | 'record-procedural-memory'
  | 'shrink-and-force-mutation'
  | 'repair-tool-json'
  | 'select-focused-verification'
  | 'compost-failed-patch'
  | 'suspend-and-summarize';

export interface ReflexSessionLike {
  status: Status | string;
  exitReason?: string;
  lastPlanError?: string;
  mutatedFiles?: string[];
  successfulMutatedFiles?: string[];
  messages?: Array<{ role: string; content: string }>;
}

export interface SelfImprovementReflex {
  failureClass: SelfImprovementFailureClass;
  nextAction: SelfImprovementReflexAction;
  organs: CognitiveOrgan[];
  retryPrompt: string;
  memoryNote: string;
}

export interface GauntletPrompt {
  id: string;
  prompt: string;
  organs: CognitiveOrgan[];
}

export interface GauntletPromptResult {
  id: string;
  prompt: string;
  domain: string;
  fileHint: string;
  workingSet: string[];
  organs: CognitiveOrgan[];
  status: 'pass' | 'fail';
  checks: {
    selfImprovementIntent: boolean;
    domainPreservation: boolean;
    boundedWorkingSet: boolean;
    hasVerification: boolean;
  };
  recommendedReflex: SelfImprovementReflex;
}

export interface SelfImprovementGauntletResult {
  level: 'below-3.5' | '3.5-candidate';
  total: number;
  passed: number;
  failed: number;
  organsTouched: CognitiveOrgan[];
  results: GauntletPromptResult[];
}

export const SELF_IMPROVEMENT_GAUNTLET_PROMPTS: readonly GauntletPrompt[] = [
  {
    id: 'prompt-to-action-loop',
    prompt: 'Make the prompt to Liminal acts to Liminal improves itself loop concrete for the agent',
    organs: ['reflexes', 'harness', 'intuition'],
  },
  {
    id: 'no-proof-drift',
    prompt: 'Improve yourself without drifting into proof cockpit work or narrowing the creative app',
    organs: ['reflexes', 'memory', 'intuition'],
  },
  {
    id: 'creative-domain-preservation',
    prompt: 'Improve Strudel Tone Revideo SVG and Hydra capability without narrowing the creative surface',
    organs: ['creative-domains', 'reflexes'],
  },
  {
    id: 'cognitive-organs',
    prompt: 'Improve the way memory compost dreaming and intuition feed the self-improvement loop',
    organs: ['memory', 'compost', 'dreaming', 'intuition'],
  },
  {
    id: 'model-assimilation',
    prompt: 'Make yourself get better every time a new model or provider comes out',
    organs: ['model-assimilation', 'intuition', 'memory'],
  },
  {
    id: 'checkpoint-resume',
    prompt: 'Make suspended self-improvement runs resume safely after workspace fingerprint drift',
    organs: ['harness', 'memory', 'reflexes'],
  },
] as const;

export class SelfImprovementReflexEngine {
  classify(session: ReflexSessionLike): SelfImprovementReflex {
    if (session.status === Status.SUCCESS && (session.successfulMutatedFiles?.length ?? 0) > 0) {
      return {
        failureClass: 'none',
        nextAction: 'record-procedural-memory',
        organs: ['memory', 'intuition'],
        retryPrompt: 'No retry needed. Record the prompt, bounded packet, mutation, and verification as procedural memory.',
        memoryNote: 'Successful mutation run becomes a reusable self-improvement reflex example.',
      };
    }

    const text = [
      session.exitReason,
      session.lastPlanError,
      ...(session.messages ?? []).map((message) => message.content),
    ].filter(Boolean).join('\n').toLowerCase();

    if (session.exitReason === 'bounded-no-mutation' || /no mutation|did not mutate|inspection-only/.test(text)) {
      return {
        failureClass: 'no-mutation',
        nextAction: 'shrink-and-force-mutation',
        organs: ['reflexes', 'memory', 'intuition'],
        retryPrompt: 'Retry with the smallest safe edit. The next attempt must call writeFile/applyEdit before complete.',
        memoryNote: 'No-mutation failures mean the task was too vague or the mutation gate was not salient enough.',
      };
    }

    if (/parse|json|tool call|tool-call|prose instead/.test(text)) {
      return {
        failureClass: 'tool-schema-drift',
        nextAction: 'repair-tool-json',
        organs: ['reflexes', 'harness'],
        retryPrompt: 'Rewrite the previous prose response into one valid JSON tool call and continue without broadening scope.',
        memoryNote: 'Tool-schema drift should trigger schema repair, not a new proof surface.',
      };
    }

    if (/verification|runfocusedtests|runtests|pattern|target/.test(text)) {
      return {
        failureClass: 'verification-mismatch',
        nextAction: 'select-focused-verification',
        organs: ['reflexes', 'intuition'],
        retryPrompt: 'Choose the first matching focused verification target from the task packet before broader checks.',
        memoryNote: 'Verification mismatch means the packet and completion gate disagreed.',
      };
    }

    if (session.status === Status.ROLLED_BACK) {
      return {
        failureClass: 'rolled-back',
        nextAction: 'compost-failed-patch',
        organs: ['compost', 'memory', 'reflexes'],
        retryPrompt: 'Compost the failed patch into a smaller candidate edit and retry from a clean worktree.',
        memoryNote: 'Rolled-back patches should become compost warnings and smaller future tasks.',
      };
    }

    return {
      failureClass: 'unknown',
      nextAction: 'suspend-and-summarize',
      organs: ['memory', 'intuition'],
      retryPrompt: 'Suspend honestly with the smallest reproducible failure summary and one recommended next target.',
      memoryNote: 'Unknown failures should be remembered as unresolved, not converted into success.',
    };
  }
}

export function runSelfImprovementGauntlet(
  prompts: readonly GauntletPrompt[] = SELF_IMPROVEMENT_GAUNTLET_PROMPTS,
): SelfImprovementGauntletResult {
  const reflexEngine = new SelfImprovementReflexEngine();
  const results = prompts.map((entry): GauntletPromptResult => {
    const context = localizeBoundedSelfImprovement(entry.prompt);
    const checks = {
      selfImprovementIntent: /improv|resume|model|provider/i.test(entry.prompt),
      domainPreservation: PRESERVED_CREATIVE_DOMAINS.every((domain) => context.creativeDomains.includes(domain)),
      boundedWorkingSet: context.workingSet.length > 0 && context.workingSet.length <= context.primaryFiles.length + context.expansionBudget,
      hasVerification: context.verificationTargets.length > 0 && context.verificationTargets[0].priority === 1,
    };
    const status = Object.values(checks).every(Boolean) ? 'pass' : 'fail';

    return {
      id: entry.id,
      prompt: entry.prompt,
      domain: context.domain,
      fileHint: context.fileHint,
      workingSet: context.workingSet,
      organs: entry.organs,
      status,
      checks,
      recommendedReflex: reflexEngine.classify({
        status: Status.FAILED,
        exitReason: 'bounded-no-mutation',
        mutatedFiles: [],
        successfulMutatedFiles: [],
        messages: [],
      }),
    };
  });

  const organsTouched = Array.from(new Set(results.flatMap((result) => result.organs))).sort() as CognitiveOrgan[];
  const passed = results.filter((result) => result.status === 'pass').length;
  const failed = results.length - passed;

  return {
    level: failed === 0 ? '3.5-candidate' : 'below-3.5',
    total: results.length,
    passed,
    failed,
    organsTouched,
    results,
  };
}
