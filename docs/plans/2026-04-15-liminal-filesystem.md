# Liminal Filesystem Implementation Plan

**Goal:** Give Liminal a coherent project-owned filesystem abstraction that unifies artifacts, gallery versions, seeds, compost fragments, run records, traces, and evaluations without breaking existing flows.

**Architecture:** Start with a facade over the storage systems that already exist: `ProjectStore`, `EventStore`, `AssetStore`, `Gallery`, `SeedArchive`, and `RunStateStore`. Do not create a competing storage layer first. Establish stable object IDs and refs, then gradually route new writes through the facade while preserving old readers.

**Tech Stack:** TypeScript, Node filesystem APIs, SQLite-backed `EventStore`, content-addressed `AssetStore`, existing gallery/seed/compost/harness modules, Vitest.

---

## Why This Exists

Liminal already has filesystem-backed memory, but it is fragmented:

- project-local `.liminal/`
- `ProjectStore`
- `EventStore`
- `AssetStore`
- `Gallery`
- `SeedArchive`
- `CompostHeap`
- `CompostMill`
- `RunStateStore`
- harness memory
- thinking traces
- reasoning traces
- `.omx` runtime state

The result is many memory organs, but no single nervous system.

Liminal should have a coherent creative object filesystem.

## Current Reality

### Closest Existing Core

`src/compost/ProjectStore.ts`

- creates project-local `.liminal/`
- wraps `EventStore`
- wraps `AssetStore`
- records creative history operations

`src/compost/EventStore.ts`

- SQLite event log in `.liminal/project.liminal`
- branches
- snapshots
- events
- asset registry

`src/compost/AssetStore.ts`

- content-addressed blob storage in `.liminal/objects/`
- deduplication by SHA256
- metadata registered in `EventStore`

These three should become the foundation of LiminalFS.

### Storage Islands To Unify

`src/gallery/Gallery.ts`

- stores versions under `gallery/YYYY-MM-DD--project/vN.js`
- currently separate from `ProjectStore`

`src/gallery/SeedArchive.ts`

- stores seeds under `seeds/<seed>.json`
- currently separate from `ProjectStore`

`src/compost/CompostHeap.ts`

- stores heap files under configured heap dirs
- currently separate from artifact IDs

`src/harness/RunStateStore.ts`

- stores `.omx/run-state.json`
- runtime resume state, not project artifact state

`src/harness/HarnessMemory.ts`

- stores `~/.liminal/memory/harness-memory.json`
- global harness memory

`src/llm/ReasoningCapture.ts`, `src/harness/ThinkingSeparation.ts`

- store reasoning/thinking traces under `~/.liminal`
- not linked to project artifact IDs

## Core Mental Model

> Files are content. Events are meaning. Refs are names.

Therefore:

- `objects/` stores bytes
- `project.liminal` stores metadata/events
- `refs/` gives stable names to changing things
- `manifests/` makes state inspectable by humans and agents

## Target Shape

Project-local storage:

```txt
.liminal/
  project.liminal          # SQLite event index / metadata / timeline
  objects/                 # content-addressed blobs
    ab/cdef...             # artifact bytes
  refs/                    # named pointers
    current
    gallery/latest
    seeds/best
  runs/                    # run records
  traces/                  # thinking/reasoning traces linked to runs
  snapshots/               # materialized state snapshots
  manifests/               # human-readable artifact manifests
```

Object URI shape:

```txt
liminal://artifact/<hash>
liminal://run/<runId>
liminal://seed/<seedId>
liminal://project/<projectName>/version/<n>
liminal://trace/<traceId>
liminal://evaluation/<evaluationId>
```

## Non-Goals

- Do not replace POSIX filesystem APIs globally.
- Do not migrate all existing gallery/seed data in the first PR.
- Do not break `Gallery`, `SeedArchive`, or compost CLIs.
- Do not introduce a new database unless `EventStore` proves insufficient.
- Do not invent a second content-addressed store.
- Do not route `.omx` orchestration state into LiminalFS immediately.

## Phase 1: Facade, No Migration

### Task 1: Create LiminalFS Types

**Files:**

- Create: `src/fs/types.ts`
- Create: `src/fs/index.ts`
- Create: `src/fs/LiminalFS.ts`
- Test: `test/unit/fs/LiminalFS.test.ts`

**Types to add:**

```ts
export type LiminalObjectKind =
  | 'generated-code'
  | 'gallery-version'
  | 'seed'
  | 'compost-fragment'
  | 'run'
  | 'trace'
  | 'evaluation'
  | 'asset';

export interface LiminalObjectRef {
  uri: string;
  hash?: string;
  kind: LiminalObjectKind;
  path?: string;
}

export interface WriteArtifactInput {
  kind: LiminalObjectKind;
  content: string | Buffer;
  filename: string;
  metadata?: Record<string, unknown>;
}

export interface LiminalRunRecord {
  runId: string;
  prompt: string;
  project?: string;
  status: 'started' | 'completed' | 'failed' | 'suspended';
  artifacts?: LiminalObjectRef[];
  metadata?: Record<string, unknown>;
}
```

**Implementation notes:**

- `LiminalFS.open(projectRoot)` initializes `ProjectStore`.
- It must not modify existing gallery or seed behavior yet.
- It should delegate artifact storage to `AssetStore`.

### Task 2: Implement `LiminalFS.open()`

**Files:**

- Modify: `src/fs/LiminalFS.ts`
- Test: `test/unit/fs/LiminalFS.test.ts`

**API:**

```ts
export class LiminalFS {
  static open(projectRoot: string): LiminalFS;
  getProjectRoot(): string;
  getProjectStore(): ProjectStore;
}
```

**Test:**

- creates a temp project
- calls `LiminalFS.open(tempDir)`
- asserts `.liminal/project.liminal` exists
- asserts `.liminal/objects/` exists

**Verification:**

```bash
npx vitest run test/unit/fs/LiminalFS.test.ts --reporter=dot --coverage.enabled=false
npm run build
```

### Task 3: Implement Artifact Writes

**Files:**

- Modify: `src/fs/LiminalFS.ts`
- Test: `test/unit/fs/LiminalFS.test.ts`

**API:**

```ts
writeArtifact(input: WriteArtifactInput): LiminalObjectRef;
readArtifact(ref: LiminalObjectRef): Buffer | null;
```

**Behavior:**

- Store bytes through `ProjectStore.getAssetStore().storeContent()`.
- Return a URI:

```txt
liminal://artifact/<hash>
```

**Test:**

- writes the same content twice
- asserts same hash
- asserts read returns original content

### Task 4: Implement Run Records

**Files:**

- Modify: `src/fs/LiminalFS.ts`
- Test: `test/unit/fs/LiminalFS.test.ts`

**API:**

```ts
recordRun(record: LiminalRunRecord): void;
```

**Behavior:**

- Append an event to `ProjectStore` / `EventStore`.
- If no direct event type exists, use `config_change` or add a new explicit event type only if needed.

Preferred new event type:

```ts
'run_record'
```

If adding this event type:

- update `src/compost/EventStore.ts`
- update timeline formatting if needed
- add tests

### Task 5: Export LiminalFS From Public Index

**Files:**

- Modify: `src/index.ts`
- Modify: `src/fs/index.ts`

**Exports:**

```ts
export { LiminalFS } from './fs/LiminalFS.js';
export type {
  LiminalObjectKind,
  LiminalObjectRef,
  WriteArtifactInput,
  LiminalRunRecord,
} from './fs/types.js';
```

**Verification:**

```bash
npm run build
```

## Phase 2: Stable Refs And Manifests

### Task 6: Add Refs

**Files:**

- Modify: `src/fs/LiminalFS.ts`
- Test: `test/unit/fs/LiminalFS.test.ts`

**API:**

```ts
writeRef(name: string, ref: LiminalObjectRef): void;
readRef(name: string): LiminalObjectRef | null;
```

**Storage:**

```txt
.liminal/refs/<safe-name>.json
```

**Rules:**

- Ref names must reject `..`
- Ref names must reject absolute paths
- Ref names may include `/` only if normalized under `.liminal/refs`

**Examples:**

```ts
fs.writeRef('gallery/latest', artifactRef);
fs.readRef('gallery/latest');
```

### Task 7: Add Human-Readable Manifests

**Files:**

- Modify: `src/fs/LiminalFS.ts`
- Test: `test/unit/fs/LiminalFS.test.ts`

**API:**

```ts
writeManifest(name: string, data: Record<string, unknown>): void;
readManifest(name: string): Record<string, unknown> | null;
```

**Storage:**

```txt
.liminal/manifests/<safe-name>.json
```

**Purpose:**

- Let agents inspect project state without replaying SQLite.
- Keep summaries human-readable.

## Phase 3: Integrate Existing Systems

### Task 8: Gallery Adapter

**Files:**

- Create: `src/fs/adapters/GalleryFSAdapter.ts`
- Test: `test/unit/fs/GalleryFSAdapter.test.ts`

**Goal:**

Do not replace `Gallery`. Wrap it.

**API:**

```ts
saveGalleryVersion(project: string, version: number, code: string): Promise<LiminalObjectRef>;
```

**Behavior:**

- Continue writing through `Gallery.saveIteration()`.
- Also write the code as an artifact through `LiminalFS.writeArtifact()`.
- Write ref:

```txt
gallery/<project>/v<version>
gallery/<project>/latest
```

### Task 9: Seed Adapter

**Files:**

- Create: `src/fs/adapters/SeedFSAdapter.ts`
- Test: `test/unit/fs/SeedFSAdapter.test.ts`

**Goal:**

Wrap `SeedArchive` without breaking current seed paths.

**Behavior:**

- Continue writing `seeds/<seed>.json`.
- Also store seed metadata as an artifact or manifest.
- Write ref:

```txt
seed/<seed>
```

### Task 10: Trace Adapter

**Files:**

- Create: `src/fs/adapters/TraceFSAdapter.ts`
- Test: `test/unit/fs/TraceFSAdapter.test.ts`

**Goal:**

Link reasoning/thinking traces to run IDs and artifact IDs.

**Behavior:**

- Do not move existing global traces yet.
- New traces can be copied or indexed under project `.liminal/traces/`.

## Phase 4: Route New Writes Through LiminalFS

### Task 11: Integrate RalphLoop Persistence

**Files:**

- Modify: `src/core/LoopPersistence.ts`
- Modify: `src/core/RalphLoop.ts` only if necessary
- Test: focused RalphLoop/LoopPersistence tests

**Goal:**

When a loop saves an iteration, also register it in LiminalFS.

**Rule:**

Gallery behavior must remain unchanged.

### Task 12: Integrate CompostMill

**Files:**

- Modify: `src/compost/CompostMill.ts`
- Test: compost integration tests

**Goal:**

Compost fragments and promoted seeds should become first-class artifacts/refs.

**Rule:**

Do not change the compost heap layout in this phase.

## Suggested First PR

Keep PR 1 very small:

- `src/fs/types.ts`
- `src/fs/LiminalFS.ts`
- `src/fs/index.ts`
- export from `src/index.ts`
- `test/unit/fs/LiminalFS.test.ts`
- docs update

No Gallery migration.
No SeedArchive migration.
No CompostMill changes.

## Verification Commands

Minimum for each PR:

```bash
npm run build
npx vitest run test/unit/fs/LiminalFS.test.ts --reporter=dot --coverage.enabled=false
node scripts/analysis/validate-version.js --quiet
node scripts/analysis/verify-file-refs.js --quiet
```

For adapter phases:

```bash
npx vitest run test/unit/fs/GalleryFSAdapter.test.ts --reporter=dot --coverage.enabled=false
npx vitest run test/unit/fs/SeedFSAdapter.test.ts --reporter=dot --coverage.enabled=false
```

## Design Principles

1. Start as a facade, not a migration.
2. Store bytes once, reference them many times.
3. Every artifact should have provenance.
4. Every run should link prompt, model, output, score, and trace.
5. Human-readable manifests are for agents and operators.
6. SQLite event history is the source of truth.
7. Old APIs keep working until LiminalFS proves itself.

## Stop Conditions

Stop and split if:

- `Gallery` behavior changes.
- `SeedArchive` behavior changes.
- existing compost tests require broad rewrites.
- new database schema affects unrelated EventStore callers.
- a PR touches more than one integration adapter.

## Long-Term Destination

LiminalFS should become the project substrate:

```ts
const fs = LiminalFS.open(projectRoot);

const artifact = fs.writeArtifact({
  kind: 'generated-code',
  filename: 'v1.js',
  content: code,
  metadata: { prompt, model, score },
});

fs.recordRun({
  runId,
  prompt,
  project,
  status: 'completed',
  artifacts: [artifact],
});

fs.writeRef('gallery/latest', artifact);
```

The final goal is not just storage. The final goal is memory with provenance.

