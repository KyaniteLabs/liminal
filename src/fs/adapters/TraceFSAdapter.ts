import type { LiminalFS } from '../LiminalFS.js';
import type { LiminalObjectRef } from '../types.js';

export interface LinkedTrace {
  traceId: string;
  runId: string;
  artifactRefs: LiminalObjectRef[];
}

export class TraceFSAdapter {
  private fs: LiminalFS;

  constructor(fs: LiminalFS) {
    this.fs = fs;
  }

  linkReasoningTrace(traceId: string, runId: string, metadata?: Record<string, unknown>): LinkedTrace {
    const content = JSON.stringify({ traceId, runId, linkedAt: new Date().toISOString(), ...metadata }, null, 2);

    const ref = this.fs.writeArtifact({
      kind: 'trace',
      content,
      filename: `trace-${traceId}.json`,
      metadata: { traceId, runId, traceType: 'reasoning' },
    });

    this.fs.writeRef(`trace/${traceId}`, ref);

    return { traceId, runId, artifactRefs: [ref] };
  }

  linkThinkingTrace(traceId: string, runId: string, source: string, metadata?: Record<string, unknown>): LinkedTrace {
    const content = JSON.stringify({ traceId, runId, source, linkedAt: new Date().toISOString(), ...metadata }, null, 2);

    const ref = this.fs.writeArtifact({
      kind: 'trace',
      content,
      filename: `thinking-${traceId}.json`,
      metadata: { traceId, runId, traceType: 'thinking', source },
    });

    this.fs.writeRef(`trace/${traceId}`, ref);

    return { traceId, runId, artifactRefs: [ref] };
  }
}
