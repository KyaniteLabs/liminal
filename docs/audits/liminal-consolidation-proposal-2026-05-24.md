# Liminal Consolidation Proposal - 2026-05-24

## Recommendation

Use Option C from the document pack for Instrument/Sing:

```text
Keep packages/sing temporarily, rename later.
```

Use the existing sibling repo for Sites:

```text
Keep Liminal Sites separate from Core/Studio.
```

Do not create `KyaniteLabs/liminal-instrument` yet.

## Why

The current branch proved that the Instrument direction can still move inside
the existing workspace:

- mock lyric teleprompter landed inside `packages/sing`
- selected LFM2.5 350M optional sidecar landed inside `packages/sing`
- camera/movement prototype landed inside `packages/sing`
- shared `packages/audio-core` remains usable by Studio and Sing

The local-machine audit found one broken Desktop checkout:

```text
/Users/simongonzalezdecruz/Desktop/OMC/liminal
```

That live path has now been repaired by preserving the broken tree at
`/Users/simongonzalezdecruz/Desktop/OMC/liminal.broken-working-tree-20260524-201253`
and rebuilding `/Users/simongonzalezdecruz/Desktop/OMC/liminal` from the
verified current branch. The preserved old tree still contains the local-only
`repo-pipeline-fix-20260420-liminal @ 14d39ec2` state, so a full history
carveout remains premature until that backup is classified.

## Pros

- avoids losing local-only Instrument/Sing work
- keeps tests/builds in one workspace while the runtime is still evolving
- lets Studio export presets and Sing perform them without cross-repo release
  choreography
- preserves the option of a later full-history split

## Cons

- Liminal remains a larger repo for now
- Instrument package naming stays transitional
- future Sites/Core/Instrument contracts must be kept explicit

## Migration Risk

Main risk is history loss or duplicated work if a split happens before the
preserved old OMC tree, Mac mini evidence, and remaining local candidates are
fully classified.

Secondary risk is product-boundary drift. The ADRs in this branch are the guard:

```text
docs/adr/0001-liminal-product-shape.md
docs/adr/0002-liminal-sites-aesthetic-evolution.md
docs/adr/0003-liminal-instrument-performance-shape.md
docs/contracts/liminal-shared-artifact-contracts.md
```

## Files Impacted If Split Later

Likely carveout roots:

```text
packages/sing/
packages/audio-core/
test/unit/sing/
test/integration/sing-package.test.ts
docs/SING_WORKSHOP_INSTRUMENT_SPLIT_PLAN.md
docs/audits/*sing*
docs/audits/*sidecar*
docs/audits/*camera-movement*
```

Likely shared contracts to keep mirrored or moved to a small shared package:

```text
packages/audio-core/src/PresetSchema.ts
docs/contracts/liminal-shared-artifact-contracts.md
```

## History Preservation Plan

If a split becomes necessary later:

1. Finish timeout-bounded audit of every local candidate checkout, including the
   preserved old OMC tree.
2. Fetch remote refs without merging.
3. Identify local-only commits touching the carveout roots.
4. Use a history-preserving split tool such as `git filter-repo` in a temporary
   clone, not in the working repo.
5. Compare file lists and commit counts before publishing.
6. Keep the original package in Liminal until the new repo builds, tests, and
   imports cleanly.

## Backport Strategy

Until the split is real, land Instrument work in this repo.

After any future split:

- bug fixes to `packages/audio-core` should be backported both ways until the
  shared package boundary is settled
- Studio preset export changes must include an Instrument fixture
- Instrument session changes must include a Studio ingestion fixture
- no runtime dependency from Instrument back to Studio

## Current Decision

Keep building in `packages/sing` inside this branch. Revisit the repo split only
after the preserved old OMC tree and remaining machine evidence are classified.
