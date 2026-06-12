import React from 'react';
import type { SystemStatus } from './hooks';

interface CompostSummaryProps {
  status: SystemStatus | null;
}

export function CompostSummary({ status }: CompostSummaryProps) {
  if (!status) {
    return (
      <div className="sinter-panel" style={{ padding: 16 }}>
        <h3 className="sinter-heading">Compost Stats</h3>
        <p style={{ color: 'var(--sinter-muted)', fontSize: 13, margin: 0 }}>
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="sinter-panel" style={{ padding: 16 }}>
      <h3 className="sinter-heading">Compost Stats</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--sinter-muted)' }}>Heap files</span>
          <span>{status.heapFileCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--sinter-muted)' }}>Heap size</span>
          <span>{formatBytes(status.heapSize)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--sinter-muted)' }}>Seeds</span>
          <span style={{ fontWeight: 600, color: 'var(--sinter-green)' }}>{status.seedCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--sinter-muted)' }}>Soup running</span>
          <span style={{ color: status.soupRunning ? 'var(--sinter-green)' : 'var(--sinter-dim)' }}>
            {status.soupRunning ? 'yes' : 'no'}
          </span>
        </div>
        {status.loopProgress && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--sinter-muted)' }}>Loop</span>
            <span>
              iter {status.loopProgress.iteration}
              {status.loopProgress.maxIterations ? ` / ${status.loopProgress.maxIterations}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
