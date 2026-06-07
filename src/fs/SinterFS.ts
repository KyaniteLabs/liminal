import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ProjectStore } from '../compost/ProjectStore.js';
import type { SinterObjectRef, WriteArtifactInput, SinterRunRecord } from './types.js';

export class SinterFS {
  private projectStore: ProjectStore;
  private projectRoot: string;

  private constructor(projectStore: ProjectStore, projectRoot: string) {
    this.projectStore = projectStore;
    this.projectRoot = projectRoot;
  }

  static open(projectRoot: string): SinterFS {
    const store = new ProjectStore({ projectRoot });
    store.init();
    return new SinterFS(store, projectRoot);
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getProjectStore(): ProjectStore {
    return this.projectStore;
  }

  writeArtifact(input: WriteArtifactInput): SinterObjectRef {
    const stored = this.projectStore.storeAssetContent(input.content, input.filename, input.kind);
    const ref: SinterObjectRef = {
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

  readArtifact(ref: SinterObjectRef): Buffer | null {
    if (ref.hash) {
      return this.projectStore.getAssetContent(ref.hash);
    }
    return null;
  }

  recordRun(record: SinterRunRecord): void {
    const eventStore = this.projectStore.getEventStore();
    eventStore.append('run_record', { ...record });
  }

  writeRef(name: string, ref: SinterObjectRef): void {
    this.validateRefName(name);
    const path = join(this.projectRoot, '.sinter', 'refs', `${name}.json`);
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(ref, null, 2));

    const eventStore = this.projectStore.getEventStore();
    eventStore.append('config_change', {
      action: 'ref_write',
      name,
      uri: ref.uri,
    });
  }

  readRef(name: string): SinterObjectRef | null {
    this.validateRefName(name);
    const path = join(this.projectRoot, '.sinter', 'refs', `${name}.json`);
    if (!existsSync(path)) {
      return null;
    }
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as SinterObjectRef;
  }

  writeManifest(name: string, data: Record<string, unknown>): void {
    this.validateRefName(name);
    const path = join(this.projectRoot, '.sinter', 'manifests', `${name}.json`);
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2));
  }

  readManifest(name: string): Record<string, unknown> | null {
    this.validateRefName(name);
    const path = join(this.projectRoot, '.sinter', 'manifests', `${name}.json`);
    if (!existsSync(path)) {
      return null;
    }
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  }

  close(): void {
    this.projectStore.close();
  }

  private validateRefName(name: string): void {
    if (name.includes('..')) {
      throw new Error(`Invalid ref name: path traversal not allowed ("${name}")`);
    }
    if (name.startsWith('/')) {
      throw new Error(`Invalid ref name: absolute paths not allowed ("${name}")`);
    }
  }
}
