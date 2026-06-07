/**
 * ArchiveEntries FS adapter — Phase 13E
 *
 * Persists archive entries (elites + near-elites) through SinterFS.
 */

import type { SinterFS } from '../SinterFS.js';
import type { SinterObjectRef } from '../types.js';
import type { ArchiveEntry } from '../../emergence/types.js';

export class ArchiveEntriesFSAdapter {
  private fs: SinterFS;

  constructor(fs: SinterFS) {
    this.fs = fs;
  }

  writeArchiveEntry(entry: ArchiveEntry): SinterObjectRef {
    const content = JSON.stringify(entry, null, 2);

    const ref = this.fs.writeArtifact({
      kind: 'archive-entry',
      content,
      filename: `archive-${entry.id}.json`,
      metadata: {
        archiveId: entry.id,
        cellId: entry.id, // Will be updated by ArchivePlacement
        qualityScore: entry.qualityScore,
        provenance: entry.lineage.provenance,
      },
    });

    this.fs.writeRef(`archive/${entry.id}`, ref);
    return ref;
  }

  writeArchiveState(cellId: string, entries: ArchiveEntry[]): SinterObjectRef {
    const content = JSON.stringify({ cellId, entries, exportedAt: new Date().toISOString() }, null, 2);

    const ref = this.fs.writeArtifact({
      kind: 'archive-entry',
      content,
      filename: `archive-cell-${cellId.replace(/\|/g, '_')}.json`,
      metadata: { cellId, entryCount: entries.length },
    });

    this.fs.writeRef(`archive/cell/${cellId}`, ref);
    return ref;
  }
}
