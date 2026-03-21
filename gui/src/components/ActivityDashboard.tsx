import React from 'react';
import { useEventStream, useSystemStatus } from './activity/hooks';
import { ProcessCard } from './activity/ProcessCard';
import { LLMStatus } from './activity/LLMStatus';
import { CompostSummary } from './activity/CompostSummary';
import { EventLog } from './activity/EventLog';

export function ActivityDashboard() {
  const { events, connected, clearEvents } = useEventStream();
  const status = useSystemStatus(5000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960 }}>
      {/* Dashboard cards row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
      }}>
        <ProcessCard events={events} />
        <LLMStatus events={events} />
        <CompostSummary status={status} />
      </div>

      {/* Live event log */}
      <div style={{ minHeight: 360 }}>
        <EventLog events={events} connected={connected} onClear={clearEvents} />
      </div>
    </div>
  );
}
