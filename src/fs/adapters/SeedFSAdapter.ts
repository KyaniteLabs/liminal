import { SeedArchive } from '../../gallery/SeedArchive.js';
import { LiminalFS } from '../LiminalFS.js';
import type { LiminalObjectRef } from '../types.js';

export class SeedFSAdapter {
  private archive: SeedArchive;
  private fs: LiminalFS;

  constructor(archive: SeedArchive, fs: LiminalFS) {
    this.archive = archive;
    this.fs = fs;
  }

  async saveSeed(seed: string, metadata?: Record<string, unknown>): Promise<LiminalObjectRef> {
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
