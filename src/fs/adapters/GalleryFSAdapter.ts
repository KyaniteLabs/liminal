import { Gallery } from '../../gallery/Gallery.js';
import { LiminalFS } from '../LiminalFS.js';
import type { LiminalObjectRef } from '../types.js';

export class GalleryFSAdapter {
  private gallery: Gallery;
  private fs: LiminalFS;

  constructor(gallery: Gallery, fs: LiminalFS) {
    this.gallery = gallery;
    this.fs = fs;
  }

  async saveGalleryVersion(
    project: string,
    version: number,
    code: string,
  ): Promise<LiminalObjectRef> {
    await this.gallery.saveIteration(project, version, code);

    const ref = this.fs.writeArtifact({
      kind: 'gallery-version',
      content: code,
      filename: `v${version}.js`,
      metadata: { project, version, savedAt: new Date().toISOString() },
    });

    this.fs.writeRef(`gallery/${project}/v${version}`, ref);
    this.fs.writeRef(`gallery/${project}/latest`, ref);

    return ref;
  }

  async saveOrganism(
    project: string,
    version: number,
    musicCode: string,
    visualCode: string,
  ): Promise<LiminalObjectRef> {
    await this.gallery.saveOrganism(project, version, musicCode, visualCode);

    const payload = {
      type: 'organism',
      musicCode: musicCode.trim() || musicCode,
      visualCode: visualCode.trim() || visualCode,
    };

    const ref = this.fs.writeArtifact({
      kind: 'organism',
      content: JSON.stringify(payload),
      filename: `v${version}.json`,
      metadata: { project, version, type: 'organism', savedAt: new Date().toISOString() },
    });

    this.fs.writeRef(`gallery/${project}/v${version}`, ref);
    this.fs.writeRef(`gallery/${project}/latest`, ref);

    return ref;
  }

  getGallery(): Gallery {
    return this.gallery;
  }
}
