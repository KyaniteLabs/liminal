import type { BridgeEvent } from './bridgeEvents';
export type { BridgeEvent } from './bridgeEvents';

const HUMAN_DOMAIN_CHECKS: Record<string, string[]> = {
  p5: ['motion quality', 'visual taste', 'recognizability'],
  svg: ['shape recognizability', 'composition', 'brand fit'],
  glsl: ['motion quality', 'color/taste', 'shader is not blank'],
  three: ['3D readability', 'camera/lighting', 'motion quality'],
  hydra: ['video-synth motion', 'aesthetic taste', 'not blank'],
  strudel: ['audio groove', 'play affordance', 'timing feel'],
  tone: ['audio feel', 'play affordance', 'mix/timbre'],
  revideo: ['motion/video timing', 'text readability', 'recording usefulness'],
  html: ['layout quality', 'marketing readability', 'responsive fit'],
  ascii: ['intentional composition', 'readability', 'not prose spillover'],
  kinetic: ['animated typography', 'readability', 'motion taste'],
  textgen: ['poetic quality', 'readability', 'not placeholder text'],
};

function humanChecksForDomain(domain: string): string[] {
  return HUMAN_DOMAIN_CHECKS[domain.toLowerCase()] || ['taste', 'domain fit', 'recording usefulness'];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export type FailureReceipt = {
  title: string;
  message: string;
  summary: string;
  provider?: string;
  model?: string;
  endpoint?: string;
  statusCode?: number;
  retryable?: boolean;
  responseBody?: string;
};

function routeSelectionMessage(domain: string | undefined, domains: string[] | undefined): string {
  const selected = domain || domains?.[0] || 'domain';
  const backups = (domains || []).filter((item) => item !== selected);
  return backups.length > 0
    ? `Selected ${selected}; backup domains if needed: ${backups.join(' -> ')}`
    : `Selected ${selected}; no backup domain`;
}

function failureMessage(event: BridgeEvent): string {
  return String(event.error || event.message || 'failure');
}

function formatProviderFailureSummary(event: BridgeEvent): string {
  const providerModel = [event.provider, event.model].filter(Boolean).join(' / ');
  const status = event.statusCode ? `HTTP ${event.statusCode}` : '';
  const retry = event.retryable === true ? 'retryable' : event.retryable === false ? 'not retryable' : '';
  return [providerModel, event.endpoint, status, retry].filter(Boolean).join(' · ');
}

function buildFailureReceipt(event: BridgeEvent): FailureReceipt {
  const title = event.type === 'generation.attempt.failed'
    ? `${event.domain || 'unknown'} attempt ${event.attempt || '?'} / ${event.attemptTotal || '?'} failed`
    : 'Bridge error';
  return {
    title,
    message: failureMessage(event),
    summary: formatProviderFailureSummary(event),
    provider: optionalString(event.provider),
    model: optionalString(event.model),
    endpoint: optionalString(event.endpoint),
    statusCode: optionalNumber(event.statusCode),
    retryable: optionalBoolean(event.retryable),
    responseBody: optionalString(event.responseBody),
  };
}

function attemptFailureDetail(event: BridgeEvent): string {
  const summary = formatProviderFailureSummary(event);
  return summary ? `${failureMessage(event)} · ${summary}` : failureMessage(event);
}

function hasFailureProvenance(event: BridgeEvent): boolean {
  return Boolean(event.provider || event.model || event.endpoint || event.statusCode || event.retryable !== undefined || event.responseBody);
}

export function deriveCockpit(events: BridgeEvent[], now = Date.now()) {
  const planEvent = [...events].reverse().find((event) => event.type === 'generation.domain_plan');
  const plan = Array.isArray(planEvent?.domains) ? planEvent!.domains! : [];
  const attempts = new Map<string, { attempt: number; total: number; domain: string; status: string; detail?: string }>();
  let activeDomain = '';
  let phase = 'idle';
  let latestMessage = '';
  let currentAttempt = 0;
  let attemptTotal = plan.length;
  let timeoutMinutes = planEvent?.timeoutMinutes || 5;
  let candidateCount = planEvent?.candidateCount || 3;
  let executionMode = planEvent?.executionMode || 'prove';
  let generationStartedAt = readEventTime(planEvent);
  let activeAttemptStartedAt = 0;
  let previewCompletedAt = 0;
  let generationCompletedAt = 0;
  let completedDuration = 0;
  let hasGenerationComplete = false;
  let hasCancelled = false;
  let hasMissingPreview = false;
  const latestDisconnectedIndex = events.reduce((latest, event, index) => event.type === 'stream.disconnected' ? index : latest, -1);
  const isDisconnected = events.length > 0 && latestDisconnectedIndex === events.length - 1;
  let selectedArtifactDomain = '';
  let latestIterationStageTimings: Array<{ label: 'Generate' | 'Evaluate'; durationMs: number }> = [];
  const artifacts: Array<{ label: string; path: string }> = [];
  const failures: string[] = [];
  const failureReceipts: FailureReceipt[] = [];
  const receipts: Array<{ organ: string; status: string; detail: string }> = [];

  for (const event of events) {
    if (event.type === 'activity.updated' && event.message) latestMessage = event.message;
    if (event.type === 'generation.intent_brief') {
      phase = event.willClarify ? 'clarifying intent' : 'briefing';
      latestMessage = Array.isArray(event.requirements) && event.requirements[0]
        ? String(event.requirements[0])
        : latestMessage;
    }
    if (event.type === 'generation.clarification_needed') {
      phase = 'clarifying intent';
      latestMessage = Array.isArray(event.questions) && event.questions[0]
        ? String(event.questions[0])
        : event.reason || latestMessage;
    }
    if (event.type === 'generation.reasoning_trace') {
      phase = String(event.phase || 'reasoning');
      latestMessage = String(event.thought || latestMessage);
    }
    if (event.type === 'tool.started') {
      phase = String(event.toolName || 'tool');
      latestMessage = String(event.displayLabel || event.argsSummary || latestMessage);
    }
    if (event.type === 'tool.completed') {
      latestMessage = String(event.resultSummary || latestMessage);
    }
    if (event.type === 'generation.route.selected') {
      activeDomain = event.domain || activeDomain;
      phase = 'route selected';
      latestMessage = Array.isArray(event.domains)
        ? routeSelectionMessage(event.domain, event.domains)
        : latestMessage;
      timeoutMinutes = event.timeoutMinutes || timeoutMinutes;
      candidateCount = event.candidateCount || candidateCount;
      executionMode = event.executionMode || executionMode;
    }
    if (event.type === 'generation.domain_plan') {
      generationStartedAt = readEventTime(event) || generationStartedAt;
      timeoutMinutes = event.timeoutMinutes || timeoutMinutes;
      candidateCount = event.candidateCount || candidateCount;
      executionMode = event.executionMode || executionMode;
      phase = 'planning';
    }
    if (event.type === 'generation.attempt.started') {
      activeDomain = event.domain || '';
      phase = 'waiting on model';
      currentAttempt = event.attempt || currentAttempt;
      attemptTotal = event.attemptTotal || attemptTotal;
      activeAttemptStartedAt = readEventTime(event) || activeAttemptStartedAt;
      timeoutMinutes = event.timeoutMinutes || timeoutMinutes;
      candidateCount = event.candidateCount || candidateCount;
      executionMode = event.executionMode || executionMode;
      attempts.set(`${event.attempt}-${event.domain}`, {
        attempt: event.attempt || 0,
        total: event.attemptTotal || 0,
        domain: event.domain || 'unknown',
        status: 'running',
      });
    }
    if (event.type === 'generation.candidate.generated') {
      activeDomain = event.domain || activeDomain;
      phase = 'validating';
      currentAttempt = event.attempt || currentAttempt;
      attemptTotal = event.attemptTotal || attemptTotal;
      const key = `${event.attempt || 0}-${event.domain}`;
      const previous = attempts.get(key);
      if (previous) attempts.set(key, { ...previous, status: 'candidate', detail: `${event.codeSize || 0} bytes` });
    }
    if (event.type === 'generation.iteration' && Array.isArray(event.stageTimings)) {
      latestIterationStageTimings = event.stageTimings.filter((timing) => typeof timing?.durationMs === 'number');
    }
    if (event.type === 'generation.attempt.failed') {
      phase = 'fallback';
      currentAttempt = event.attempt || currentAttempt;
      attemptTotal = event.attemptTotal || attemptTotal;
      const detail = attemptFailureDetail(event);
      failures.push(`${event.domain || 'unknown'}: ${detail}`);
      failureReceipts.push(buildFailureReceipt(event));
      attempts.set(`${event.attempt}-${event.domain}`, {
        attempt: event.attempt || 0,
        total: event.attemptTotal || 0,
        domain: event.domain || 'unknown',
        status: 'failed',
        detail,
      });
    }
    if (event.type === 'artifact.found' && event.artifactPath) {
      if (!hasGenerationComplete) phase = 'artifact';
      const artifactLabel = event.artifactLabel || 'artifact';
      selectedArtifactDomain = String(artifactLabel).split(' ')[0].toLowerCase() || selectedArtifactDomain;
      artifacts.push({ label: artifactLabel, path: event.artifactPath });
    }
    if (event.type === 'generation.cognitive_receipt' && Array.isArray(event.receipts)) {
      for (const item of event.receipts) {
        receipts.push({ organ: String(item.organ || 'organ'), status: String(item.status || 'unknown'), detail: String(item.detail || '') });
      }
    }
    if (event.type === 'preview.completed') {
      if (!hasGenerationComplete) phase = 'previewed';
      previewCompletedAt = readEventTime(event) || previewCompletedAt;
    }
    if (event.type === 'preview.verified') {
      if (!hasGenerationComplete) phase = 'verified preview';
      previewCompletedAt = readEventTime(event) || previewCompletedAt || now;
      latestMessage = Array.isArray(event.checks) && event.checks.length > 0
        ? `Preview verified: ${event.checks.join(', ')}`
        : 'Preview verified';
    }
    if (event.type === 'preview.missing') {
      hasMissingPreview = true;
      phase = 'preview missing';
      previewCompletedAt = readEventTime(event) || previewCompletedAt || now;
      latestMessage = `Preview unavailable: ${event.reason || event.error || event.message || 'preview artifact missing'}`;
    }
    if (event.type === 'error' && hasFailureProvenance(event)) {
      phase = 'failed';
      latestMessage = failureMessage(event);
      const receipt = buildFailureReceipt(event);
      failureReceipts.push(receipt);
      failures.push(receipt.summary ? `${receipt.message} · ${receipt.summary}` : receipt.message);
    }
    if (event.type === 'generation.cancelled') {
      hasCancelled = true;
      phase = 'stopped';
      latestMessage = 'Generation stopped by operator.';
    }
    if (event.type === 'stream.disconnected' && isDisconnected) {
      phase = 'disconnected';
      latestMessage = String(event.message || 'Workbench event stream disconnected.');
    }
    if (event.type === 'generation.complete') {
      hasGenerationComplete = true;
      phase = 'complete';
      completedDuration = event.duration || 0;
      executionMode = event.executionMode || executionMode;
      generationCompletedAt = readEventTime(event) || generationCompletedAt;
      if (event.qualityState === 'unscored') {
        latestMessage = event.reason || latestMessage;
      }
    }
  }

  const elapsedMs = completedDuration || (generationStartedAt ? Math.max(0, now - generationStartedAt) : 0);
  const timeoutMs = timeoutMinutes * 60_000;
  const boundedTotalMs = Math.max(1, (attemptTotal || plan.length || 1) * timeoutMs);
  const activeElapsedMs = activeAttemptStartedAt ? Math.max(0, now - activeAttemptStartedAt) : 0;
  const spentMs = currentAttempt > 0 ? ((currentAttempt - 1) * timeoutMs) + activeElapsedMs : elapsedMs;
  const isTerminal = hasGenerationComplete || hasCancelled || hasMissingPreview || isDisconnected || phase === 'complete' || phase === 'previewed' || phase === 'verified preview' || phase === 'preview missing' || phase === 'stopped' || phase === 'disconnected';
  const progressPercent = isTerminal
    ? 1
    : currentAttempt > 0
      ? Math.min(0.96, Math.max(0.03, spentMs / boundedTotalMs))
      : 0;
  const remainingMs = isTerminal ? 0 : Math.max(0, boundedTotalMs - spentMs);
  const selectedDomain = selectedArtifactDomain || activeDomain;
  const hasVerifiedPreview = events.some((event) => event.type === 'preview.verified');
  const activeWork = hasCancelled
    ? 'Generation stopped by operator.'
    : isDisconnected
      ? 'Workbench event stream disconnected.'
      : hasMissingPreview
        ? `Preview unavailable${selectedDomain ? ` for ${selectedDomain}` : ''}.`
        : hasVerifiedPreview && !hasGenerationComplete
          ? `Preview verified${selectedDomain ? ` for ${selectedDomain}` : ''}.`
          : hasGenerationComplete && selectedDomain
            ? executionMode === 'draft'
              ? `Preview ready from ${selectedDomain}; no more domains are running.`
              : `Run complete from ${selectedDomain}.`
            : activeDomain
              ? executionMode === 'draft'
                ? `Generating first usable preview in ${activeDomain}.`
                : `Waiting for ${candidateCount} candidates in ${activeDomain}`
              : plan.length
                ? `Planning ${plan.length} domain attempts`
                : 'Idle';
  const stageTimings: Array<{ label: string; durationLabel: string }> = [];
  const renderEndAt = previewCompletedAt || generationCompletedAt;
  if (generationStartedAt && activeAttemptStartedAt > generationStartedAt) {
    stageTimings.push({ label: 'Plan', durationLabel: formatDuration(activeAttemptStartedAt - generationStartedAt) });
  }
  if (latestIterationStageTimings.length > 0) {
    for (const timing of latestIterationStageTimings) {
      stageTimings.push({ label: timing.label, durationLabel: formatDuration(timing.durationMs) });
    }
  } else if (activeAttemptStartedAt && renderEndAt > activeAttemptStartedAt) {
    stageTimings.push({ label: 'Generate', durationLabel: formatDuration(renderEndAt - activeAttemptStartedAt) });
  }
  if (generationCompletedAt && previewCompletedAt > generationCompletedAt) {
    stageTimings.push({ label: 'Render', durationLabel: formatDuration(previewCompletedAt - generationCompletedAt) });
  }

  const attemptedDomains = uniqueStrings([
    ...[...attempts.values()].map((attempt) => attempt.domain),
    ...artifacts.map((artifact) => artifact.label.split(' ')[0]),
    activeDomain,
  ].map((value) => String(value || '').toLowerCase()));
  const humanFocus = uniqueStrings(attemptedDomains.flatMap(humanChecksForDomain));
  const latestArtifact = artifacts.at(-1);
  const humanReviewStatus = failures.length > 0 ? 'blocked' : phase === 'complete' || phase === 'previewed' || artifacts.length > 0 ? 'ready' : 'waiting';
  const humanReview = {
    status: humanReviewStatus as 'waiting' | 'ready' | 'blocked',
    heading: humanReviewStatus === 'blocked' ? 'Fix machine blockers before humans' : humanReviewStatus === 'ready' ? 'Ready for human-only judgment' : 'Not ready for humans yet',
    summary: humanReviewStatus === 'ready'
      ? 'Machine context is collected; humans should judge taste, audio, motion, recognizability, and recording usefulness.'
      : humanReviewStatus === 'blocked'
        ? failures[failures.length - 1]
        : 'Wait for artifact, preview, and receipt context before spending human time.',
    checks: [
      { label: 'Machine blockers', status: failures.length > 0 ? 'blocked' : 'ready', detail: failures.length > 0 ? failures.slice(-2).join(' | ') : 'No attempt failures in this run.' },
      { label: 'Artifact context', status: artifacts.length > 0 ? 'ready' : 'waiting', detail: latestArtifact ? `${latestArtifact.label}: ${latestArtifact.path}` : 'Waiting for artifact path.' },
      { label: 'Human-only focus', status: humanFocus.length > 0 ? 'ready' : 'waiting', detail: humanFocus.length > 0 ? humanFocus.slice(0, 6).join(', ') : 'Waiting for domain route.' },
      { label: 'Cognitive context', status: receipts.length > 0 ? 'ready' : 'waiting', detail: receipts.length > 0 ? receipts.map((item) => `${item.organ}:${item.status}`).join(', ') : 'Waiting for memory/compost/dreaming/intuition receipt.' },
    ],
    issueReport: [
      '# Liminal run review report',
      '',
      `phase: ${phase}`,
      `domains: ${attemptedDomains.join(' -> ') || 'unknown'}`,
      `active work: ${activeWork}`,
      `latest message: ${latestMessage || 'none'}`,
      `artifact: ${latestArtifact ? `${latestArtifact.label} ${latestArtifact.path}` : 'none'}`,
      `machine blockers: ${failures.length ? failures.join(' | ') : 'none'}`,
      `human-only checks: ${humanFocus.join(', ') || 'unknown'}`,
      `cognitive receipts: ${receipts.length ? receipts.map((item) => `${item.organ}:${item.status}`).join(', ') : 'none'}`,
      '',
      'Human finding:',
      '- expected vs actual:',
      '- taste/audio/motion/recognizability issue:',
      '- recording impact: blocks / caveat / cosmetic',
    ].join('\n'),
  };

  return {
    plan,
    attempts: [...attempts.values()],
    activeDomain,
    phase,
    latestMessage,
    elapsedLabel: elapsedMs ? formatDuration(elapsedMs) : '0s',
    etaLabel: isTerminal ? 'done' : `up to ${formatDuration(remainingMs)} left`,
    progressPercent,
    activeWork,
    selectedDomain,
    fallbackRoute: plan,
    artifacts: artifacts.slice(-8),
    failureReceipts: failureReceipts.slice(-6),
    stageTimings,
    humanReview,
  };
}

function readEventTime(event?: BridgeEvent): number {
  if (!event) return 0;
  const startedAt = optionalString(event.startedAt);
  const parsed = startedAt ? Date.parse(startedAt) : NaN;
  if (Number.isFinite(parsed)) return parsed;
  return optionalNumber(event.receivedAt) || 0;
}

function formatDuration(ms: number): string {
  const safeMs = Math.max(0, ms);
  if (safeMs < 1000) return `${Math.round(safeMs)}ms`;
  if (safeMs < 10_000) return `${(safeMs / 1000).toFixed(1).replace(/\.0$/, '')}s`;
  const totalSeconds = Math.round(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
