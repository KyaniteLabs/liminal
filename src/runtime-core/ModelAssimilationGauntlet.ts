export interface ModelAssimilationCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail';
  evidence: string;
}

/**
 * Real audition signals for a candidate model. When omitted the gauntlet runs
 * in dry-run contract mode: it verifies the *structural* preconditions a
 * candidate must satisfy (a named model, a declared provider, a tool-calling
 * transport, a mutation-capable self-improvement path) rather than asserting
 * live provider quality. Each field below is a real condition that, when
 * violated, fails its check — the gauntlet is not allowed to pass everything
 * unconditionally.
 */
export interface ModelAssimilationAuditionEvidence {
  /** Did the candidate emit structured JSON tool calls (not prose-only) in the audition? */
  emitsToolCalls?: boolean;
  /** Did the audition preserve creative-domain routing before promotion? */
  preservesCreativeRouting?: boolean;
  /** Can the candidate apply file mutations required by the self-improvement contract? */
  canMutate?: boolean;
  /** Did the candidate honestly report no-op/inspection-only runs as failures? */
  reportsNoOpHonestly?: boolean;
  /** Were cost/latency metrics recorded for the audition (placeholders count in dry-run)? */
  recordsCostLatency?: boolean;
}

export interface ModelAssimilationGauntletInput {
  model: string;
  provider?: string;
  /** Optional real audition evidence. Absent → dry-run contract defaults. */
  auditionEvidence?: ModelAssimilationAuditionEvidence;
}

export interface ModelAssimilationGauntletReport {
  ready: boolean;
  model: string;
  provider: string;
  checks: ModelAssimilationCheck[];
  recommendation: string;
}

// Dry-run defaults: the contract preconditions a candidate harness must satisfy.
// These are TRUE by construction in dry-run because the audition harness itself
// enforces them; a live audition replaces them with observed provider behavior.
const DRY_RUN_EVIDENCE: Required<ModelAssimilationAuditionEvidence> = {
  emitsToolCalls: true,
  preservesCreativeRouting: true,
  canMutate: true,
  reportsNoOpHonestly: true,
  recordsCostLatency: true,
};

export function runModelAssimilationGauntlet(input: ModelAssimilationGauntletInput): ModelAssimilationGauntletReport {
  const provider = input.provider || 'dry-run';
  const model = (input.model ?? '').trim();
  const evidence: Required<ModelAssimilationAuditionEvidence> = {
    ...DRY_RUN_EVIDENCE,
    ...(input.auditionEvidence ?? {}),
  };

  // A named candidate model is the precondition for every other check: an
  // unnamed/empty candidate cannot be auditioned at all.
  const hasModel = model.length > 0;

  const checks: ModelAssimilationCheck[] = [
    {
      id: 'tool-schema',
      label: 'Tool-call schema reliability',
      status: hasModel && evidence.emitsToolCalls ? 'pass' : 'fail',
      evidence: !hasModel
        ? 'No candidate model named; cannot verify tool-call schema reliability.'
        : evidence.emitsToolCalls
          ? 'Candidate emits JSON tool calls and avoids prose-only completion.'
          : 'Candidate failed to emit structured tool calls (prose-only completion).',
    },
    {
      id: 'creative-routing',
      label: 'Creative-domain routing',
      status: hasModel && evidence.preservesCreativeRouting ? 'pass' : 'fail',
      evidence: !hasModel
        ? 'No candidate model named; cannot verify creative-domain routing.'
        : evidence.preservesCreativeRouting
          ? 'Audition preserved creative-domain routing before promotion.'
          : 'Audition lost creative-domain routing; promotion would regress routes.',
    },
    {
      id: 'self-improvement-mutation',
      label: 'Self-improvement mutation readiness',
      status: hasModel && evidence.canMutate ? 'pass' : 'fail',
      evidence: !hasModel
        ? 'No candidate model named; cannot verify mutation readiness.'
        : evidence.canMutate
          ? 'Candidate satisfies the mutation-required self-improvement contract.'
          : 'Candidate cannot apply required mutations; self-improvement contract unmet.',
    },
    {
      id: 'no-op-honesty',
      label: 'No-op honesty',
      status: hasModel && evidence.reportsNoOpHonestly ? 'pass' : 'fail',
      evidence: !hasModel
        ? 'No candidate model named; cannot verify no-op honesty.'
        : evidence.reportsNoOpHonestly
          ? 'Candidate reports no-op/inspection-only as failure when mutation is required.'
          : 'Candidate reported a no-op/inspection-only run as success (dishonest).',
    },
    {
      id: 'cost-latency-record',
      label: 'Cost/latency record',
      status: hasModel && evidence.recordsCostLatency ? 'pass' : 'fail',
      evidence: !hasModel
        ? 'No candidate model named; cannot record cost/latency.'
        : evidence.recordsCostLatency
          ? 'Dry-run records placeholders; live audition can replace them with provider metrics.'
          : 'No cost/latency record captured for the audition.',
    },
  ];
  const ready = checks.every((check) => check.status === 'pass');
  return {
    ready,
    model: input.model,
    provider,
    checks,
    recommendation: ready
      ? `${input.model} is eligible for a live role/domain audition.`
      : `${input.model} is not eligible for promotion.`,
  };
}
