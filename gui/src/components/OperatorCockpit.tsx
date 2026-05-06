import React, { useEffect, useMemo, useRef, useState } from 'react';

import { deriveCockpit, type BridgeEvent } from '../gui/cockpitDerivation';
import { latestCognitiveReceipt, latestRunReceipt } from '../gui/workbenchTelemetry';

export { deriveCockpit } from '../gui/cockpitDerivation';

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

export function buildOperatorPromptRequest(prompt: string) {
  return {
    text: prompt,
    mode: 'chat' as const,
    clientIntent: 'creative' as const,
    executionMode: 'draft' as const,
  };
}

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
      body: JSON.stringify(buildOperatorPromptRequest(prompt)),
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
  const runReceipt = useMemo(() => latestRunReceipt(events, session), [events, session]);
  const cognitiveReceipt = useMemo(() => latestCognitiveReceipt(events), [events]);
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

        {runReceipt && (
          <section className="cockpit-card cockpit-card--wide cockpit-run-receipt">
            <h3 className="atelier-heading">Run Receipt</h3>
            <div className="cockpit-metrics">
              <span>Phase: {runReceipt.phase}</span>
              <span>Domain: {runReceipt.creativeDomain}</span>
              <span>Provider/model: {runReceipt.providerModel}</span>
            </div>
            {runReceipt.artifact && <div className="cockpit-artifact"><span>{runReceipt.artifact.label}</span><code>{runReceipt.artifact.path || 'path pending'}</code></div>}
            {runReceipt.preview && <div className="cockpit-artifact"><span>{runReceipt.preview.type} preview {runReceipt.preview.inline ? 'inline' : 'pending'}</span><code>{runReceipt.preview.path || runReceipt.preview.label}</code></div>}
            {runReceipt.failure && <div className="cockpit-artifact"><span>Failure</span><code>{runReceipt.failure.message}</code></div>}
            {runReceipt.prior?.artifact && <div className="cockpit-artifact"><span>Prior {runReceipt.prior.revisionKind}</span><code>{runReceipt.prior.artifact.path || runReceipt.prior.artifact.label}</code></div>}
          </section>
        )}

        {cognitiveReceipt && (
          <section className="cockpit-card cockpit-card--wide cockpit-cognitive-receipt">
            <h3 className="atelier-heading">Cognitive Loop Receipt</h3>
            <div className="cockpit-metrics">
              <span>Loop: {cognitiveReceipt.loop}</span>
              <span>Write-back: {cognitiveReceipt.writeBackStatus}</span>
            </div>
            <div className="cockpit-muted">{cognitiveReceipt.writeBackSummary}</div>
            <div className="cockpit-failure-receipts">
              {cognitiveReceipt.writeBackItems.map((item) => (
                <div className="cockpit-failure-receipt" key={item.organ}>
                  <strong>{item.organ}</strong>
                  <span>{item.status}</span>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="cockpit-card cockpit-card--wide">
          <h3 className="atelier-heading">Failure Receipts</h3>
          {derived.failureReceipts.length === 0 && <div className="cockpit-muted">No provider failures yet.</div>}
          <div className="cockpit-failure-receipts">
            {derived.failureReceipts.map((receipt, index) => (
              <div className="cockpit-failure-receipt" key={`${index}-${receipt.title}`}>
                <strong>{receipt.title}</strong>
                <span>{receipt.message}</span>
                {receipt.summary && <small>{receipt.summary}</small>}
                {receipt.responseBody && <code>{receipt.responseBody}</code>}
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
                <small>{String(event.message || event.domain || event.artifactLabel || event.model || '')}</small>
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
