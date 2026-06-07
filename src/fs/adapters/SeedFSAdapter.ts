import { SeedArchive } from '../../gallery/SeedArchive.js';
import { SinterFS } from '../SinterFS.js';
import type { SinterObjectRef } from '../types.js';

export class SeedFSAdapter {
  private archive: SeedArchive;
  private fs: SinterFS;

  constructor(archive: SeedArchive, fs: SinterFS) {
    this.archive = archive;
    this.fs = fs;
  }

  async saveSeed(seed: string, metadata?: Record<string, unknown>): Promise<SinterObjectRef> {
    await this.archive.saveSeed(seed, metadata ?? {});

    const content = JSON.stringify({ seed, ...metadata }, null, 2);
    const ref = this.fs.writeArtifact({
      kind: 'seed',
      content,
      filename: `${seed}.json`,
      metadata: { seed, savedAt: new Date().toISOString() },
    });

    this.fs.writeRef(`seed/${seed}`, ref);

    return ref;
  }

  getArchive(): SeedArchive {
    return this.archive;
  }
}
