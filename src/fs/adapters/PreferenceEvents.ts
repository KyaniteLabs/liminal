/**
 * PreferenceEvents FS adapter — Phase 13E
 *
 * Persists preference events through LiminalFS for session-linked
 * manifest tracking.
 */

import type { LiminalFS } from '../LiminalFS.js';
import type { LiminalObjectRef } from '../types.js';
import type { PreferenceRecord } from '../../emergence/types.js';

export class PreferenceEventsFSAdapter {
  private fs: LiminalFS;

  constructor(fs: LiminalFS) {
    this.fs = fs;
  }

  writePreferenceEvent(record: PreferenceRecord): LiminalObjectRef {
    const content = JSON.stringify(record, null, 2);

    const ref = this.fs.writeArtifact({
      kind: 'preference-event',
      content,
      filename: `pref-${record.action}-${record.artifactId}.json`,
      metadata: {
        action: record.action,
        artifactId: record.artifactId,
        comparedTo: record.comparedTo,
        sessionId: record.sessionId,
      },
    });

    this.fs.writeRef(`preference/${record.artifactId}/${record.action}`, ref);
    return ref;
  }

  writeSessionPreferences(sessionId: string, records: PreferenceRecord[]): LiminalObjectRef {
    const content = JSON.stringify({
      sessionId,
      events: records,
      exportedAt: new Date().toISOString(),
    }, null, 2);

    const ref = this.fs.writeArtifact({
      kind: 'preference-event',
      content,
      filename: `pref-session-${sessionId}.json`,
      metadata: { sessionId, eventCount: records.length },
    });

    this.fs.writeRef(`preference/session/${sessionId}`, ref);
    return ref;
  }
}
