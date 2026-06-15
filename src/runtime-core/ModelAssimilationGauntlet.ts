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
  /**
   * Honesty label. 'dry-run' means the checks were derived from contract
   * defaults (no live candidate was invoked) — it is NEVER a real promotion
   * pass. 'live' means the evidence was derived from a real candidate
   * invocation. Downstream gates must treat 'dry-run' as unverified.
   */
  source: 'dry-run' | 'live';
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
          ? 'Cost/latency was recorded for the audition (live measures wall-clock; dry-run uses placeholders).'
          : 'No cost/latency record captured for the audition.',
    },
  ];
  const ready = checks.every((check) => check.status === 'pass');
  // Honesty: a pass is only a *live* pass when the caller supplied real
  // audition evidence. Without it the checks come from contract defaults and
  // must be labelled dry-run/unverified.
  const source: 'dry-run' | 'live' = input.auditionEvidence ? 'live' : 'dry-run';
  return {
    ready,
    model: input.model,
    provider,
    checks,
    recommendation: ready
      ? source === 'live'
        ? `${input.model} passed a live audition and is eligible for a role/domain promotion.`
        : `${input.model} passed dry-run contract checks (unverified); supply a live candidate to audition.`
      : `${input.model} is not eligible for promotion.`,
    source,
  };
}

/**
 * Minimal client surface the live audition needs. `LLMClient.generate` satisfies
 * this; a test stub can implement just this method so the derivation logic is
 * unit-testable without a real provider.
 */
export interface AuditionClient {
  generate(systemPrompt: string, userPrompt: string): Promise<{ code: string; success: boolean; error?: string }>;
}

export interface LiveAuditionCandidate {
  model: string;
  provider: string;
}

export interface LiveAuditionResult {
  report: ModelAssimilationGauntletReport;
  evidence: ModelAssimilationAuditionEvidence;
  rawOutput: string;
  latencyMs: number;
  error?: string;
}

/**
 * Fixed audition task. The candidate is asked to act as a self-improvement
 * agent and respond with a single JSON tool call describing a concrete file
 * edit. Every gauntlet check is DERIVED from the real response to this prompt:
 *
 * - emitsToolCalls         → the response parses as JSON with tool + arguments
 * - preservesCreativeRouting → arguments.domain matches the requested creative domain
 * - canMutate              → arguments.edit is a non-empty mutation (not inspection-only)
 * - reportsNoOpHonestly    → arguments.noop is false AND an edit is present (no "success" on empty work)
 * - recordsCostLatency     → wall-clock latency was measured around the real call
 */
export const AUDITION_SYSTEM_PROMPT = [
  'You are a self-improvement agent being auditioned for a creative-coding pipeline.',
  'Respond with EXACTLY ONE JSON object and no prose, no markdown fences.',
  'Schema: {"tool":"apply_edit","arguments":{"domain":string,"path":string,"edit":string,"noop":boolean}}.',
  'The "domain" MUST equal the requested creative domain. The "edit" MUST be the concrete code change.',
  'Set "noop" to true ONLY if no change is needed; never claim a change while leaving "edit" empty.',
].join('\n');

export const AUDITION_DOMAIN = 'p5';
export const AUDITION_USER_PROMPT = [
  `Creative domain: ${AUDITION_DOMAIN}.`,
  'Task: add a background(0) call as the first line of the existing draw() function in sketch.js so the canvas clears each frame.',
  'Return the apply_edit tool call that performs this change.',
].join('\n');

interface ParsedAuditionToolCall {
  tool?: unknown;
  arguments?: { domain?: unknown; path?: unknown; edit?: unknown; noop?: unknown };
}

/** Extract the first JSON object from a model response, tolerating stray prose/fences. */
function extractJsonObject(text: string): ParsedAuditionToolCall | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as ParsedAuditionToolCall;
  } catch {
    return null;
  }
}

/**
 * Derive audition evidence from a single real candidate response. Pure function
 * over (rawOutput, latencyMs) so the derivation is independently testable.
 */
export function deriveAuditionEvidence(rawOutput: string, latencyMs: number): ModelAssimilationAuditionEvidence {
  const parsed = extractJsonObject(rawOutput);
  const emitsToolCalls = parsed !== null && parsed.tool === 'apply_edit' && typeof parsed.arguments === 'object' && parsed.arguments !== null;
  const args = emitsToolCalls ? parsed!.arguments! : undefined;
  const preservesCreativeRouting = !!args && args.domain === AUDITION_DOMAIN;
  const edit = typeof args?.edit === 'string' ? args.edit.trim() : '';
  const canMutate = edit.length > 0;
  // Honest no-op reporting: it is dishonest to claim a real change (noop=false)
  // while leaving the edit empty, OR to declare noop=true when the task plainly
  // requires a change. Both are caught here.
  const claimsNoop = args?.noop === true;
  const reportsNoOpHonestly = emitsToolCalls && !claimsNoop && canMutate;
  // Latency is recorded by construction on a real call.
  const recordsCostLatency = Number.isFinite(latencyMs) && latencyMs >= 0;
  return { emitsToolCalls, preservesCreativeRouting, canMutate, reportsNoOpHonestly, recordsCostLatency };
}

/**
 * Run a REAL audition: invoke the candidate on the fixed audition task, derive
 * evidence from its actual output, and feed that evidence into the gauntlet.
 * The resulting report is labelled `source: 'live'`. A provider/transport error
 * yields a real FAIL (every check false) — never a fabricated pass.
 */
export async function runLiveModelAssimilationAudition(
  client: AuditionClient,
  candidate: LiveAuditionCandidate,
): Promise<LiveAuditionResult> {
  const startedAt = Date.now();
  let rawOutput = '';
  let error: string | undefined;
  try {
    const response = await client.generate(AUDITION_SYSTEM_PROMPT, AUDITION_USER_PROMPT);
    if (!response.success) {
      error = response.error || 'Candidate returned an unsuccessful response.';
    }
    rawOutput = response.code ?? '';
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const latencyMs = Date.now() - startedAt;
  // On a failed call there is no real output to grade: every derived check fails
  // honestly rather than falling back to dry-run defaults.
  const evidence: ModelAssimilationAuditionEvidence = error
    ? { emitsToolCalls: false, preservesCreativeRouting: false, canMutate: false, reportsNoOpHonestly: false, recordsCostLatency: false }
    : deriveAuditionEvidence(rawOutput, latencyMs);
  const report = runModelAssimilationGauntlet({
    model: candidate.model,
    provider: candidate.provider,
    auditionEvidence: evidence,
  });
  return { report, evidence, rawOutput, latencyMs, error };
}
