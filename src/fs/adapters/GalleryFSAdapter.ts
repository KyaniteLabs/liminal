import { Gallery } from '../../gallery/Gallery.js';
import { SinterFS } from '../SinterFS.js';
import type { SinterObjectRef } from '../types.js';

export class GalleryFSAdapter {
  private gallery: Gallery;
  private fs: SinterFS;

  constructor(gallery: Gallery, fs: SinterFS) {
    this.gallery = gallery;
    this.fs = fs;
  }

  async saveGalleryVersion(
    project: string,
    version: number,
    code: string,
  ): Promise<SinterObjectRef> {
    await this.gallery.saveIteration(project, version, code);
    return this.writeGalleryVersionRef(project, version, code);
  }

  writeGalleryVersionRef(
    project: string,
    version: number,
    code: string,
  ): SinterObjectRef {
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
  ): Promise<SinterObjectRef> {
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
