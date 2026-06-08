/**
 * ArchiveEntries FS adapter — Phase 13E
 *
 * Persists archive entries (elites + near-elites) through SinterFS.
 */

import type { SinterFS } from '../SinterFS.js';
import type { SinterObjectRef } from '../types.js';
import type { ArchiveEntry } from '../../emergence/types.js';
import { Logger } from '../../utils/Logger.js';

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

  /**
   * Read every persisted archive entry back from SinterFS. The symmetric
   * counterpart to {@link writeArchiveEntry} — enumerates the `archive/` refs,
   * dereferences each to its artifact, and parses it as an {@link ArchiveEntry}.
   * Malformed or non-entry refs (e.g. `archive/cell/*` bundles written by
   * {@link writeArchiveState}) are skipped, never thrown. Returns `[]` for an
   * empty store.
   */
  readAllArchiveEntries(): ArchiveEntry[] {
    const entries: ArchiveEntry[] = [];
    for (const name of this.fs.listRefs('archive')) {
      try {
        const ref = this.fs.readRef(name);
        if (!ref) continue;
        const content = this.fs.readArtifact(ref);
        if (!content) continue;
        const parsed = JSON.parse(content.toString('utf-8')) as ArchiveEntry;
        // Accept only well-formed single entries (writeArchiveEntry shape).
        if (parsed && typeof parsed.id === 'string' && parsed.descriptor && parsed.lineage
          && typeof parsed.qualityScore === 'number') {
          entries.push(parsed);
        }
      } catch (err) {
        Logger.warn('ArchiveEntriesFSAdapter', `Skipping unreadable archive ref "${name}":`, err);
      }
    }
    return entries;
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
