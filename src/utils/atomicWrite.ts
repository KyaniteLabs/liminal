/**
 * Atomic file writes — write to a sibling temp file, then rename over the target.
 *
 * `rename(2)` is atomic on the same filesystem, so a crash or concurrent reader mid-write
 * never observes a partially-written (corrupt) target — it sees either the old bytes or the
 * new bytes, never a truncated mix. The bare `fs.writeFile`/`writeFileSync` that JSON-state
 * writers used (QualityArchive, HarnessMemory, RoutingData, SinterFS refs/manifests, config)
 * could leave a corrupt half-file on interruption — and HarnessMemory's corrupt-read branch
 * then overwrites with empty state, wiping the whole feed-forward memory.
 *
 * The temp file is a sibling of the target (same directory → same filesystem, so rename is
 * truly atomic) and carries a unique suffix so concurrent writers never collide. It does not
 * end in `.json`, so SinterFS manifest/ref enumeration ignores any transient temp file.
 */
import { writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

function tempPath(targetPath: string): string {
  return `${targetPath}.tmp-${process.pid}-${randomUUID()}`;
}

export interface AtomicWriteOptions {
  /** File mode for the created file (e.g. 0o600 for secrets). Preserved across the rename. */
  mode?: number;
}

/** Atomically write `data` to `path` (async). Cleans up the temp file if the write fails. */
export async function writeFileAtomic(
  path: string,
  data: string,
  opts: AtomicWriteOptions = {},
): Promise<void> {
  const tmp = tempPath(path);
  try {
    await writeFile(tmp, data, { encoding: 'utf-8', mode: opts.mode });
    await rename(tmp, path);
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

/** Atomically write `data` to `path` (sync). Cleans up the temp file if the write fails. */
export function writeFileAtomicSync(
  path: string,
  data: string,
  opts: AtomicWriteOptions = {},
): void {
  const tmp = tempPath(path);
  try {
    writeFileSync(tmp, data, { encoding: 'utf-8', mode: opts.mode });
    renameSync(tmp, path);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* temp may not exist; ignore */
    }
    throw err;
  }
}
