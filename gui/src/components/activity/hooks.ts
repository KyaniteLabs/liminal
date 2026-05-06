import { useState, useEffect, useCallback, useRef } from 'react';

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASEURL)
  ? import.meta.env.VITE_API_BASEURL
  : '/api';

export interface BusEvent {
  type: string;
  source: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface SystemStatus {
  heapSize: number;
  heapFileCount: number;
  seedCount: number;
  soupRunning: boolean;
  loopProgress: { iteration: number; maxIterations?: number; progress: number } | null;
  recentEvents: BusEvent[];
  error?: string;
}

/** Connect to SSE /api/events, manage reconnection. */
export function useEventStream() {
  const [events, setEvents] = useState<BusEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();

    const es = new EventSource(`${API}/events`);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const event: BusEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev.slice(-499), event]);
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      // Reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, clearEvents };
}

/** Poll /api/status every interval. */
export function useSystemStatus(intervalMs = 5000) {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval>;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API}/status`);
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        // Don't update on error
      }
    };

    fetchStatus();
    timer = setInterval(fetchStatus, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return status;
}
