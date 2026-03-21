import React from 'react';
import type { BusEvent } from './hooks';

interface LLMStatusProps {
  events: BusEvent[];
}

interface LLMCall {
  provider: string;
  model: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  timestamp: string;
}

export function LLMStatus({ events }: LLMStatusProps) {
  const calls = extractLLMCalls(events);

  if (calls.length === 0) {
    return (
      <div className="atelier-panel" style={{ padding: 16 }}>
        <h3 className="atelier-heading">LLM Health</h3>
        <p style={{ color: 'var(--atelier-text-muted)', fontSize: 13, margin: 0 }}>
          No LLM calls recorded yet.
        </p>
      </div>
    );
  }

  const last = calls[calls.length - 1];
  const recent = calls.slice(-20);
  const successCount = recent.filter((c) => c.success).length;
  const successRate = recent.length > 0 ? successCount / recent.length : 1;
  const avgLatency = recent.length > 0
    ? Math.round(recent.reduce((sum, c) => sum + c.latencyMs, 0) / recent.length)
    : 0;

  const statusColor = successRate >= 0.9 ? 'var(--atelier-success)' : successRate >= 0.5 ? 'var(--atelier-warn)' : 'var(--atelier-error)';

  return (
    <div className="atelier-panel" style={{ padding: 16 }}>
      <h3 className="atelier-heading">LLM Health</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--atelier-text-muted)' }}>Provider / Model</span>
          <span style={{ fontWeight: 500 }}>{last.provider} / {last.model}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--atelier-text-muted)' }}>Last call</span>
          <span style={{ color: last.success ? 'var(--atelier-success)' : 'var(--atelier-error)' }}>
            {last.latencyMs}ms {last.success ? 'ok' : last.error}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--atelier-text-muted)' }}>Avg latency (20)</span>
          <span>{avgLatency}ms</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--atelier-text-muted)' }}>Success rate (20)</span>
          <span style={{ color: statusColor, fontWeight: 600 }}>
            {(successRate * 100).toFixed(0)}%
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--atelier-text-muted)' }}>Total calls</span>
          <span>{calls.length}</span>
        </div>
      </div>
    </div>
  );
}

function extractLLMCalls(events: BusEvent[]): LLMCall[] {
  const calls: LLMCall[] = [];
  const pending = new Map<string, { provider: string; model: string; start: string }>();

  for (const ev of events) {
    if (ev.type === 'llm:request') {
      pending.set(ev.timestamp, {
        provider: String(ev.data.provider ?? 'unknown'),
        model: String(ev.data.model ?? 'unknown'),
        start: ev.timestamp,
      });
    }
    if (ev.type === 'llm:response') {
      // Match with most recent pending request
      const keys = [...pending.keys()];
      const matchKey = keys.length > 0 ? keys[keys.length - 1] : null;
      const req = matchKey ? pending.get(matchKey) : null;

      calls.push({
        provider: String(ev.data.provider ?? req?.provider ?? 'unknown'),
        model: String(ev.data.model ?? req?.model ?? 'unknown'),
        success: Boolean(ev.data.success),
        latencyMs: Number(ev.data.latencyMs ?? 0),
        error: ev.data.error ? String(ev.data.error) : undefined,
        timestamp: ev.timestamp,
      });

      if (matchKey) pending.delete(matchKey);
    }
  }
  return calls;
}
