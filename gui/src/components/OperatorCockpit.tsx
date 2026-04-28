import React, { useEffect, useMemo, useRef, useState } from 'react';

type BridgeEvent = {
  type: string;
  sessionId?: string;
  message?: string;
  domain?: string;
  domains?: string[];
  attempt?: number;
  attemptTotal?: number;
  iteration?: number;
  score?: number;
  codeSize?: number;
  artifactLabel?: string;
  artifactPath?: string;
  imageUrl?: string;
  model?: string;
  duration?: number;
  finalScore?: number;
  reason?: string;
  qualityState?: 'scored' | 'unscored';
  error?: string;
  startedAt?: string;
  timeoutMinutes?: number;
  executionMode?: 'draft' | 'prove';
  stageTimings?: Array<{ label: 'Generate' | 'Evaluate'; durationMs: number }>;
  requirements?: string[];
  questions?: string[];
  willClarify?: boolean;
  phase?: string;
  thought?: string;
  source?: string;
  toolName?: string;
  displayLabel?: string;
  argsSummary?: string;
  resultSummary?: string;
  success?: boolean;
  receivedAt?: number;
  action?: { id: string; title: string };
  receipts?: Array<{ organ?: string; status?: string; detail?: string }>;
};

type SessionStatus = {
  sessionId: string;
  provider?: string;
  model?: string;
  roles?: Record<string, {
    role: string;
    provider: string;
    model: string;
    source: string;
    multimodal: 'yes' | 'no' | 'unknown';
    purpose: string;
  }>;
  evaluation?: {
    renderedEvidence: boolean;
    screenshotInput: boolean;
    multimodal: 'yes' | 'no' | 'unknown';
    note: string;
  };
  pendingAction?: { id: string; title: string };
};

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASEURL)
  ? import.meta.env.VITE_API_BASEURL
  : '/api';

export function OperatorCockpit() {
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [events, setEvents] = useState<BridgeEvent[]>([]);
  const [prompt, setPrompt] = useState('Generate a crazy visual: an impossible greenhouse orbiting inside a black hole, with glass flowers, red gravitational rings, and tiny fireflies tracing equations through the air. Save and preview it.');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    void createSession();
    return () => sourceRef.current?.close();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function createSession() {
    sourceRef.current?.close();
    setEvents([]);
    setError(null);
    try {
      const res = await fetch(`${API}/tui/session`, { method: 'POST' });
      const status = await res.json();
      if (!res.ok) throw new Error(status.error || res.statusText);
      setSession(status);
      const es = new EventSource(`${API}/tui/session/${status.sessionId}/events`);
      sourceRef.current = es;
      es.onmessage = (event) => {
        try {
          const parsed = { ...(JSON.parse(event.data) as BridgeEvent), receivedAt: Date.now() };
          setEvents((prev) => [...prev.slice(-299), parsed]);
        } catch {
          // Ignore malformed SSE payloads.
        }
      };
      es.onerror = () => setError('Cockpit event stream disconnected; refresh or create a new session.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitPrompt() {
    if (!session || !prompt.trim()) return;
    setError(null);
    const res = await fetch(`${API}/tui/session/${session.sessionId}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt, mode: 'chat' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || res.statusText);
    await refreshStatus();
  }

  async function confirmPending() {
    if (!session?.pendingAction) return;
    const res = await fetch(`${API}/tui/session/${session.sessionId}/actions/${session.pendingAction.id}/confirm`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || res.statusText);
    await refreshStatus();
  }

  async function refreshStatus() {
    if (!session) return;
    const res = await fetch(`${API}/tui/session/${session.sessionId}/status`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSession(data);
  }

  const derived = useMemo(() => deriveCockpit(events, now), [events, now]);
  const [copiedReport, setCopiedReport] = useState(false);
  const status = session ? `${session.provider || 'unknown'} / ${session.model || 'unknown'}` : 'No session';
  const roles = session?.roles ? Object.values(session.roles) : [];

  return (
    <div className="atelier-panel cockpit-shell">
      <div className="cockpit-header">
        <div>
          <h2 className="atelier-heading" style={{ marginBottom: 4 }}>Operator Cockpit</h2>
          <div className="cockpit-muted">{status}</div>
        </div>
        <button className="atelier-btn atelier-btn--secondary" type="button" onClick={() => void createSession()}>New session</button>
      </div>

      {error && <div className="atelier-alert atelier-alert--error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="cockpit-grid">
        <section className="cockpit-card cockpit-card--wide">
          <label className="atelier-label">Prompt</label>
          <textarea className="atelier-textarea" rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="atelier-btn atelier-btn--primary" type="button" onClick={() => void submitPrompt()} disabled={!session}>Send to bridge</button>
            {session?.pendingAction && <button className="atelier-btn" type="button" onClick={() => void confirmPending()}>Confirm: {session.pendingAction.title}</button>}
          </div>
        </section>

        <section className="cockpit-card">
          <h3 className="atelier-heading">Domain Plan</h3>
          <div className="cockpit-flow">{derived.plan.length ? derived.plan.join(' -> ') : 'waiting'}</div>
          <div className="cockpit-muted">Current: {derived.activeDomain || 'idle'}</div>
        </section>

        <section className="cockpit-card">
          <h3 className="atelier-heading">Phase</h3>
          <div className="cockpit-big">{derived.phase}</div>
          <div className="cockpit-muted">{derived.latestMessage || 'waiting for activity'}</div>
        </section>

        <section className="cockpit-card cockpit-card--wide">
          <h3 className="atelier-heading">Run Progress</h3>
          <div className="cockpit-progress" aria-label={`Generation progress ${Math.round(derived.progressPercent * 100)} percent`}>
            <div className="cockpit-progress__fill" style={{ width: `${Math.round(derived.progressPercent * 100)}%` }} />
          </div>
          <div className="cockpit-metrics">
            <span>Elapsed: {derived.elapsedLabel}</span>
            <span>ETA: {derived.etaLabel}</span>
            <span>{derived.activeWork}</span>
          </div>
        </section>

        <section className="cockpit-card cockpit-card--wide">
          <h3 className="atelier-heading">Model Roles</h3>
          <div className="cockpit-roles">
            {roles.length === 0 && <span className="cockpit-muted">No role map yet.</span>}
            {roles.map((role) => (
              <div className="cockpit-role" key={role.role}>
                <strong>{role.role}</strong>
                <span>{role.provider} / {role.model}</span>
                <small>{role.purpose}</small>
                <small>Vision: {role.multimodal}</small>
              </div>
            ))}
          </div>
          {session?.evaluation && <div className="cockpit-muted" style={{ marginTop: 8 }}>{session.evaluation.note}</div>}
        </section>

        <section className="cockpit-card cockpit-card--wide">
          <h3 className="atelier-heading">Attempts</h3>
          <div className="cockpit-attempts">
            {derived.attempts.length === 0 && <span className="cockpit-muted">No attempts yet.</span>}
            {derived.attempts.map((attempt) => (
              <div key={`${attempt.attempt}-${attempt.domain}`} className={`cockpit-attempt cockpit-attempt--${attempt.status}`}>
                <span>{attempt.attempt}/{attempt.total}</span>
                <strong>{attempt.domain}</strong>
                <span>{attempt.status}</span>
                {attempt.detail && <small>{attempt.detail}</small>}
              </div>
            ))}
          </div>
        </section>

        <section className="cockpit-card cockpit-card--wide">
          <h3 className="atelier-heading">Artifacts</h3>
          {derived.artifacts.length === 0 && <div className="cockpit-muted">No artifacts yet.</div>}
          {derived.artifacts.map((artifact) => (
            <div className="cockpit-artifact" key={`${artifact.label}-${artifact.path}`}>
              <span>{artifact.label}</span>
              <code>{artifact.path}</code>
            </div>
          ))}
        </section>

        <section className="cockpit-card cockpit-card--wide">
          <div className="cockpit-card-heading">
            <h3 className="atelier-heading">Human Review Readiness</h3>
            <button
              className="atelier-btn atelier-btn--secondary"
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(derived.humanReview.issueReport);
                setCopiedReport(true);
                window.setTimeout(() => setCopiedReport(false), 1400);
              }}
            >
              {copiedReport ? 'Copied' : 'Copy report'}
            </button>
          </div>
          <div className={`cockpit-review-status cockpit-review-status--${derived.humanReview.status}`}>
            <strong>{derived.humanReview.heading}</strong>
            <span>{derived.humanReview.summary}</span>
          </div>
          <div className="cockpit-review-checks">
            {derived.humanReview.checks.map((check) => (
              <div className={`cockpit-review-check cockpit-review-check--${check.status}`} key={check.label}>
                <span>{check.label}</span>
                <small>{check.detail}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="cockpit-card cockpit-card--wide">
          <h3 className="atelier-heading">Timeline</h3>
          <div className="cockpit-timeline">
            {events.slice(-24).map((event, index) => (
              <div key={`${index}-${event.type}`} className="cockpit-event">
                <span>{event.type}</span>
                <small>{event.message || event.domain || event.artifactLabel || event.model || ''}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="cockpit-card cockpit-card--wide">
          <h3 className="atelier-heading">System Map</h3>
          <div className="cockpit-system-map">
            <div><strong>Cortex</strong><span>Watches live system state, stuck work, goals, and budget.</span></div>
            <div><strong>Gardener</strong><span>Runs taste-learning and archive recombination cycles in the background.</span></div>
            <div><strong>Evaluator</strong><span>Scores rendered evidence; true visual judgment requires a vision-capable evaluator.</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}


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
  let latestIterationStageTimings: Array<{ label: 'Generate' | 'Evaluate'; durationMs: number }> = [];
  const artifacts: Array<{ label: string; path: string }> = [];
  const failures: string[] = [];
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
      failures.push(`${event.domain || 'unknown'}: ${event.error || event.message || 'attempt failed'}`);
      attempts.set(`${event.attempt}-${event.domain}`, {
        attempt: event.attempt || 0,
        total: event.attemptTotal || 0,
        domain: event.domain || 'unknown',
        status: 'failed',
        detail: event.error || event.message || '',
      });
    }
    if (event.type === 'artifact.found' && event.artifactPath) {
      phase = 'artifact';
      artifacts.push({ label: event.artifactLabel || 'artifact', path: event.artifactPath });
    }
    if (event.type === 'generation.cognitive_receipt' && Array.isArray(event.receipts)) {
      for (const item of event.receipts) {
        receipts.push({ organ: String(item.organ || 'organ'), status: String(item.status || 'unknown'), detail: String(item.detail || '') });
      }
    }
    if (event.type === 'preview.completed') {
      phase = 'previewed';
      previewCompletedAt = readEventTime(event) || previewCompletedAt;
    }
    if (event.type === 'generation.complete') {
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
  const progressPercent = phase === 'complete'
    ? 1
    : currentAttempt > 0
      ? Math.min(0.96, Math.max(0.03, spentMs / boundedTotalMs))
      : 0;
  const remainingMs = phase === 'complete' ? 0 : Math.max(0, boundedTotalMs - spentMs);
  const activeWork = activeDomain
    ? executionMode === 'draft'
      ? `Drafting first preview in ${activeDomain}`
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
    ...plan,
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
    etaLabel: phase === 'complete' ? 'done' : `up to ${formatDuration(remainingMs)} left`,
    progressPercent,
    activeWork,
    artifacts: artifacts.slice(-8),
    stageTimings,
    humanReview,
  };
}

function readEventTime(event?: BridgeEvent): number {
  if (!event) return 0;
  const parsed = event.startedAt ? Date.parse(event.startedAt) : NaN;
  if (Number.isFinite(parsed)) return parsed;
  return event.receivedAt || 0;
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
