import { ProjectStore } from '../compost/ProjectStore.js';
import type { LiminalObjectRef, WriteArtifactInput, LiminalRunRecord } from './types.js';

export class LiminalFS {
  private projectStore: ProjectStore;
  private projectRoot: string;

  private constructor(projectStore: ProjectStore, projectRoot: string) {
    this.projectStore = projectStore;
    this.projectRoot = projectRoot;
  }

  static open(projectRoot: string): LiminalFS {
    const store = new ProjectStore({ projectRoot });
    store.init();
    return new LiminalFS(store, projectRoot);
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getProjectStore(): ProjectStore {
    return this.projectStore;
  }

  writeArtifact(input: WriteArtifactInput): LiminalObjectRef {
    const stored = this.projectStore.storeAssetContent(input.content, input.filename, input.kind);
    const ref: LiminalObjectRef = {
      uri: `liminal://artifact/${stored.hash}`,
      hash: stored.hash,
      kind: input.kind,
      path: stored.storedPath,
    };

    if (input.metadata) {
      const eventStore = this.projectStore.getEventStore();
      eventStore.append('config_change', {
        action: 'artifact_write',
        hash: stored.hash,
        kind: input.kind,
        filename: input.filename,
        metadata: input.metadata,
      });
    }

    return ref;
  }

  readArtifact(ref: LiminalObjectRef): Buffer | null {
    if (ref.hash) {
      return this.projectStore.getAssetContent(ref.hash);
    }
    return null;
  }

  recordRun(record: LiminalRunRecord): void {
    const eventStore = this.projectStore.getEventStore();
    eventStore.append('run_record', { ...record });
  }

  close(): void {
    this.projectStore.close();
  }
}
