import React from 'react';
import type { BusEvent } from './hooks';

interface ProcessCardProps {
  events: BusEvent[];
}

interface ActiveProcess {
  source: string;
  process: string;
  stage: string;
  progress: number;
  startTime: string;
  metadata?: Record<string, unknown>;
}

export function ProcessCard({ events }: ProcessCardProps) {
  const active = extractActiveProcesses(events);

  if (active.length === 0) {
    return (
      <div className="sinter-panel" style={{ padding: 16 }}>
        <h3 className="sinter-heading">Active Processes</h3>
        <p style={{ color: 'var(--sinter-muted)', fontSize: 13, margin: 0 }}>
          No processes running.
        </p>
      </div>
    );
  }

  return (
    <div className="sinter-panel" style={{ padding: 16 }}>
      <h3 className="sinter-heading">Active Processes</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {active.map((proc) => (
          <div key={`${proc.source}-${proc.startTime}`} style={{ fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--sinter-cyan)' }}>{proc.process}</span>
              <span style={{ color: 'var(--sinter-dim)', fontSize: 12 }}>{proc.stage}</span>
            </div>
            {proc.progress > 0 && (
              <div style={{
                height: 4,
                background: 'var(--sinter-line)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, proc.progress * 100)}%`,
                  background: 'var(--sinter-cyan)',
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function extractActiveProcesses(events: BusEvent[]): ActiveProcess[] {
  const processes = new Map<string, ActiveProcess>();

  // Walk events backwards to find active processes
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];

    if (ev.type === 'process:start') {
      const key = `${ev.source}-${ev.timestamp}`;
      const existing = processes.get(key);
      if (!existing) {
        processes.set(key, {
          source: ev.source,
          process: String(ev.data.process ?? ev.source),
          stage: String(ev.data.stage ?? 'starting'),
          progress: 0,
          startTime: ev.timestamp,
          metadata: ev.data as Record<string, unknown>,
        });
      }
    }

    if (ev.type === 'process:progress') {
      // Find most recent matching start event
      const source = ev.source;
      for (const [key, proc] of processes) {
        if (proc.source === source && ev.type === 'process:progress') {
          proc.stage = String(ev.data.stage ?? proc.stage);
          const current = Number(ev.data.current ?? 0);
          const total = Number(ev.data.total ?? 1);
          proc.progress = total > 0 ? current / total : 0;
        }
      }
    }

    if (ev.type === 'compost:stage') {
      // Find a compost-digest process
      for (const [, proc] of processes) {
        if (proc.process === 'compost-digest') {
          proc.stage = String(ev.data.stage ?? proc.stage);
        }
      }
    }

    if (ev.type === 'process:end') {
      const source = ev.source;
      // Remove matching processes
      for (const [key, proc] of processes) {
        if (proc.source === source) {
          processes.delete(key);
          break;
        }
      }
    }
  }

  return [...processes.values()];
}
