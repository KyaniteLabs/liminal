import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
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
      uri: `sinter://artifact/${stored.hash}`,
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

  /**
   * List every ref name under a prefix directory, recursing into subdirectories.
   * Returns fully-qualified ref names (e.g. `archive/<id>`) for each `<name>.json`
   * under `.sinter/refs/<prefix>/`, or `[]` if the prefix has no refs yet.
   * Recursion is required because ref names can contain `/` (e.g. an artifact URI
   * key like `archive/sinter://artifact/<id>` nests on disk). The returned names
   * round-trip through {@link readRef}. Mirrors how the gallery endpoints
   * enumerate `refs/gallery/`.
   */
  listRefs(prefix: string): string[] {
    this.validateRefName(prefix);
    return this.listJsonNames('refs', prefix);
  }

  /**
   * List every manifest name under a prefix directory, recursing into
   * subdirectories. Returns fully-qualified names (e.g. `session/<id>/manifest`)
   * for each `<name>.json` under `.sinter/manifests/<prefix>/`, or `[]` if the
   * prefix has none. The returned names round-trip through {@link readManifest}.
   * The read counterpart for callers (e.g. SessionResumer, GoalStore) that need
   * to enumerate persisted manifests rather than read one by known id.
   */
  listManifests(prefix: string): string[] {
    this.validateRefName(prefix);
    return this.listJsonNames('manifests', prefix);
  }

  /**
   * Recursively collect prefixed names of every `*.json` file under
   * `.sinter/<kind>/<prefix>/`. Recursion is required because names can contain
   * `/` (refs/manifests nest on disk). Returns `[]` when the prefix dir is absent.
   */
  private listJsonNames(kind: 'refs' | 'manifests', prefix: string): string[] {
    const base = join(this.projectRoot, '.sinter', kind, prefix);
    if (!existsSync(base)) {
      return [];
    }
    const names: string[] = [];
    const walk = (dir: string, rel: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const childRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          walk(join(dir, e.name), childRel);
        } else if (e.isFile() && e.name.endsWith('.json')) {
          names.push(`${prefix}/${childRel.slice(0, -'.json'.length)}`);
        }
      }
    };
    walk(base, '');
    return names;
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
