export type CognitiveRunLane = 'creative' | 'self-improvement' | 'model-assimilation';
export type CognitiveRunStatus = 'success' | 'failed' | 'suspended';

export interface CognitiveRunReceiptInput {
  prompt: string;
  lane: CognitiveRunLane;
  status: CognitiveRunStatus;
  artifactPaths: string[];
  failures: string[];
  mutatedFiles: string[];
}

export interface CognitiveOrganReceipt {
  status: 'observed' | 'pending' | 'unavailable';
  detail: string;
}

export interface CognitiveRunReceipt {
  loop: CognitiveRunLane;
  prompt: string;
  status: CognitiveRunStatus;
  artifactPaths: string[];
  mutatedFiles: string[];
  organs: {
    memory: CognitiveOrganReceipt;
    compost: CognitiveOrganReceipt;
    dreaming: CognitiveOrganReceipt;
    intuition: CognitiveOrganReceipt;
  };
  nextAction: {
    kind: 'repeat' | 'repair' | 'ship' | 'investigate';
    reason: string;
  };
}

export function buildCognitiveRunReceipt(input: CognitiveRunReceiptInput): CognitiveRunReceipt {
  const failed = input.status !== 'success' || input.failures.length > 0;
  const changed = input.mutatedFiles.length > 0 || input.artifactPaths.length > 0;
  const failureText = input.failures.length > 0 ? input.failures.join('; ') : 'no explicit failure';

  return {
    loop: input.lane,
    prompt: input.prompt,
    status: input.status,
    artifactPaths: [...input.artifactPaths],
    mutatedFiles: [...input.mutatedFiles],
    organs: {
      memory: {
        status: 'observed',
        detail: `${input.lane} run ${input.status}; artifacts=${input.artifactPaths.length}; mutations=${input.mutatedFiles.length}`,
      },
      compost: {
        status: failed ? 'observed' : 'pending',
        detail: failed ? failureText : 'No failure compost; keep successful motifs as reusable seed material.',
      },
      dreaming: {
        status: 'pending',
        detail: failed
          ? `Dream a smaller repair around: ${failureText}`
          : 'Dream one adjacent variation from the successful run.',
      },
      intuition: {
        status: 'observed',
        detail: changed ? 'Prefer the same bounded lane next; it produced concrete change.' : 'Prefer a smaller bounded task before retrying.',
      },
    },
    nextAction: failed
      ? { kind: 'repair', reason: `Run ${input.status}; repair the failure before broadening: ${failureText}` }
      : { kind: 'ship', reason: 'Run succeeded with concrete output; eligible for product receipt display.' },
  };
}
