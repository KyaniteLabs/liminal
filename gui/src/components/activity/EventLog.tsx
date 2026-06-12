import React, { useRef, useEffect, useState } from 'react';
import type { BusEvent } from './hooks';

interface EventLogProps {
  events: BusEvent[];
  connected: boolean;
  onClear: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  RalphLoop: 'var(--sinter-cyan)',
  CompostMill: 'var(--sinter-green)',
  CompostSoup: 'var(--sinter-green)',
  LLMClient: 'var(--sinter-amber)',
  SwarmOrchestrator: 'var(--sinter-orchid)',
};

const TYPE_ICONS: Record<string, string> = {
  'process:start': '▶',
  'process:end': '■',
  'process:progress': '◷',
  'llm:request': '→',
  'llm:response': '←',
  'compost:stage': '⚙',
  'compost:collision': '⚡',
  'compost:score': '★',
  'compost:seed': '✦',
  'loop:iteration': '↻',
  'loop:evaluation': '♥',
  'swarm:round': '☠',
};

export function EventLog({ events, connected, onClear }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, paused]);

  // Only show last 200 events for performance
  const displayEvents = events.slice(-200);

  return (
    <div className="sinter-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 className="sinter-heading" style={{ margin: 0 }}>
          Event Log
          <span style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? 'var(--sinter-green)' : 'var(--sinter-red)',
            marginLeft: 8,
            verticalAlign: 'middle',
          }} />
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            className="sinter-btn sinter-btn--secondary"
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="sinter-btn sinter-btn--secondary"
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 'var(--sinter-radius-sm)',
          padding: 8,
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {displayEvents.length === 0 && (
          <div style={{ color: 'var(--sinter-dim)', padding: 8 }}>
            Waiting for events...
          </div>
        )}
        {displayEvents.map((ev, i) => (
          <div key={`${ev.timestamp}-${i}`}>
            <div
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '2px 4px',
                borderRadius: 3,
                cursor: 'pointer',
                background: expandedIndex === i ? 'rgba(255,255,255,0.05)' : 'transparent',
              }}
            >
              <span style={{ color: 'var(--sinter-dim)', flexShrink: 0, width: 72 }}>
                {ev.timestamp.split('T')[1]?.slice(0, 12) ?? ''}
              </span>
              <span style={{ color: SOURCE_COLORS[ev.source] ?? 'var(--sinter-muted)', flexShrink: 0, width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.source}
              </span>
              <span style={{ flexShrink: 0, width: 18, textAlign: 'center' }}>
                {TYPE_ICONS[ev.type] ?? '·'}
              </span>
              <span style={{ color: 'var(--sinter-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatEventMessage(ev)}
              </span>
            </div>
            {expandedIndex === i && (
              <pre style={{
                margin: '0 0 4px 198px',
                padding: '6px 8px',
                fontSize: 11,
                color: 'var(--sinter-dim)',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 3,
                overflow: 'auto',
                maxHeight: 120,
              }}>
                {JSON.stringify(ev.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatEventMessage(ev: BusEvent): string {
  const d = ev.data;

  switch (ev.type) {
    case 'process:start':
      return `Started: ${d.process ?? 'unknown'}`;
    case 'process:end':
      return `Ended: ${d.process ?? 'unknown'} (${d.success ? 'ok' : 'fail'}, ${d.reason ?? ''})`;
    case 'process:progress':
      return `${d.stage ?? ''} ${d.current}/${d.total}`;
    case 'llm:request':
      return `Request: ${d.provider}/${d.model}`;
    case 'llm:response': {
      const status = d.success ? 'ok' : `err: ${d.error ?? ''}`;
      return `Response: ${d.provider}/${d.model} ${d.latencyMs}ms ${status}`;
    }
    case 'compost:stage':
      return String(d.message ?? d.stage ?? '');
    case 'compost:collision':
      return `${d.strategy}: ${d.fragmentA} × ${d.fragmentB}`;
    case 'compost:score':
      return `${d.fragmentId} → ${d.total} (${d.domain})`;
    case 'compost:seed':
      return `Promoted: ${d.seedId} score=${d.score}`;
    case 'loop:iteration':
      return `Iter ${d.iteration}/${d.maxIterations ?? '?'} score=${Number(d.score).toFixed(2)}${d.promiseDetected ? ' ★PROMISE' : ''}`;
    case 'loop:evaluation':
      return `Eval iter=${d.iteration} overall=${Number(d.overallScore).toFixed(2)}`;
    case 'swarm:round':
      return `Round ${d.round}/${d.totalRounds} winner=${d.winnerId ?? 'none'}${d.converged ? ' converged' : ''}`;
    default:
      return `${ev.type} ${String(d.message ?? '')}`;
  }
}
