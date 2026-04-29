import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { latestBridgeCodePreview, latestBridgePreview, summarizeWorkbenchBridge, type WorkbenchBridgeEvent } from './workbenchTelemetry';

export type BridgeSessionStatus = {
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
  pendingAction?: { id: string; title: string; description?: string; kind?: string };
};

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASEURL)
  ? import.meta.env.VITE_API_BASEURL
  : '/api';

export function useTuiBridgeSession() {
  const [session, setSession] = useState<BridgeSessionStatus | null>(null);
  const [events, setEvents] = useState<WorkbenchBridgeEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const sourceRef = useRef<EventSource | null>(null);
  const sessionAbortRef = useRef<AbortController | null>(null);

  const disconnectCurrentSource = useCallback(() => {
    if (!sourceRef.current) return;
    sourceRef.current.onmessage = null;
    sourceRef.current.onerror = null;
    sourceRef.current.close();
    sourceRef.current = null;
  }, []);

  const createSession = useCallback(async () => {
    sessionAbortRef.current?.abort();
    const controller = new AbortController();
    sessionAbortRef.current = controller;
    disconnectCurrentSource();
    setEvents([]);
    setError(null);
    try {
      const res = await fetch(`${API}/tui/session`, { method: 'POST', signal: controller.signal });
      const status = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(status.error || res.statusText);
      setSession(status);
      const es = new EventSource(`${API}/tui/session/${status.sessionId}/events`);
      let opened = false;
      sourceRef.current = es;
      es.onopen = () => {
        opened = true;
        setError(null);
      };
      es.onmessage = (event) => {
        try {
          const parsed = { ...(JSON.parse(event.data) as WorkbenchBridgeEvent), receivedAt: Date.now() };
          if (parsed.type === 'status.updated' && parsed.status) {
            setSession(parsed.status as BridgeSessionStatus);
          }
          setEvents((prev) => [...prev.slice(-299), parsed]);
        } catch {
          // Ignore malformed SSE payloads.
        }
      };
      es.onerror = () => {
        if (sourceRef.current !== es || es.readyState !== EventSource.CLOSED || !opened) return;
        const message = 'Workbench event stream disconnected; create a new session.';
        setError(message);
        setEvents((prev) => [...prev.slice(-299), { type: 'stream.disconnected', message, receivedAt: Date.now() }]);
      };
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [disconnectCurrentSource]);

  useEffect(() => {
    void createSession();
    return () => {
      sessionAbortRef.current?.abort();
      disconnectCurrentSource();
    };
  }, [createSession, disconnectCurrentSource]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!session?.sessionId) return;
    const res = await fetch(`${API}/tui/session/${session.sessionId}/status`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSession(data);
  }, [session?.sessionId]);

  async function submitPrompt(
    text: string,
    options: {
      maxIterations?: number;
      candidateCount?: number;
      timeoutMinutes?: number;
      clientIntent?: 'creative' | 'chat' | 'inspect' | 'action';
      executionMode?: 'draft' | 'prove';
    } = {},
  ) {
    if (!session || !text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/tui/session/${session.sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode: 'chat', ...options }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || res.statusText);
      await refreshStatus();
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmPending() {
    if (!session?.pendingAction) return;
    setError(null);
    const res = await fetch(`${API}/tui/session/${session.sessionId}/actions/${session.pendingAction.id}/confirm`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || res.statusText);
    await refreshStatus();
  }

  async function cancelPending() {
    if (!session?.pendingAction) return;
    setError(null);
    const res = await fetch(`${API}/tui/session/${session.sessionId}/actions/${session.pendingAction.id}/cancel`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || res.statusText);
    await refreshStatus();
  }

  async function cancelCurrent() {
    if (!session?.sessionId) return;
    setError(null);
    try {
      const res = await fetch(`${API}/tui/session/${session.sessionId}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || res.statusText);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await refreshStatus().catch(() => undefined);
    }
  }

  const summary = useMemo(() => summarizeWorkbenchBridge(events, now), [events, now]);
  const preview = useMemo(() => latestBridgePreview(events), [events]);
  const codePreview = useMemo(() => latestBridgeCodePreview(events), [events]);

  return {
    session,
    events,
    error,
    submitting,
    summary,
    preview,
    codePreview,
    createSession,
    submitPrompt,
    confirmPending,
    cancelPending,
    cancelCurrent,
  };
}
