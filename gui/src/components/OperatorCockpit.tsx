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
  action?: { id: string; title: string };
};

type SessionStatus = {
  sessionId: string;
  provider?: string;
  model?: string;
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
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    void createSession();
    return () => sourceRef.current?.close();
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
          const parsed = JSON.parse(event.data) as BridgeEvent;
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

  const derived = useMemo(() => deriveCockpit(events), [events]);
  const status = session ? `${session.provider || 'unknown'} / ${session.model || 'unknown'}` : 'No session';

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
      </div>
    </div>
  );
}

function deriveCockpit(events: BridgeEvent[]) {
  const planEvent = [...events].reverse().find((event) => event.type === 'generation.domain_plan');
  const plan = Array.isArray(planEvent?.domains) ? planEvent!.domains! : [];
  const attempts = new Map<string, { attempt: number; total: number; domain: string; status: string; detail?: string }>();
  let activeDomain = '';
  let phase = 'idle';
  let latestMessage = '';
  const artifacts: Array<{ label: string; path: string }> = [];

  for (const event of events) {
    if (event.type === 'activity.updated' && event.message) latestMessage = event.message;
    if (event.type === 'generation.attempt.started') {
      activeDomain = event.domain || '';
      phase = 'generating';
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
      const key = `${event.attempt || 0}-${event.domain}`;
      const previous = attempts.get(key);
      if (previous) attempts.set(key, { ...previous, status: 'candidate', detail: `${event.codeSize || 0} bytes` });
    }
    if (event.type === 'generation.attempt.failed') {
      phase = 'fallback';
      attempts.set(`${event.attempt}-${event.domain}`, {
        attempt: event.attempt || 0,
        total: event.attemptTotal || 0,
        domain: event.domain || 'unknown',
        status: 'failed',
        detail: event.message || '',
      });
    }
    if (event.type === 'artifact.found' && event.artifactPath) {
      phase = 'artifact';
      artifacts.push({ label: event.artifactLabel || 'artifact', path: event.artifactPath });
    }
    if (event.type === 'preview.completed') phase = 'previewed';
    if (event.type === 'generation.complete') phase = 'complete';
  }

  return {
    plan,
    attempts: [...attempts.values()],
    activeDomain,
    phase,
    latestMessage,
    artifacts: artifacts.slice(-8),
  };
}
