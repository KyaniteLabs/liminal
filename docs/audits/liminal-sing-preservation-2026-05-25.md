# Liminal Sing Preservation Audit - 2026-05-25

> Historical note (2026-05-26): This audit explains how Instrument/Sing work was rescued into the current KyaniteLabs Liminal line. The personal and Mac mini branch names below are source evidence, not current remotes to use.

## Purpose

Preserve the local-only Instrument/Sing work discovered during consolidation without merging the broad `codex/studio-conversation-ux-20260524` rescue branch or deleting current Studio/Core files.

## Source Evidence

- Personal/local line: `origin/main` at `129bfb0699ecfc90941e4317edf6b939d1ea7c2b`
- Mac mini rescue branch: `codex/rescue-sing-macmini-20260524` at `129bfb0699ecfc90941e4317edf6b939d1ea7c2b`
- Current-line rescue branch: `codex/rescue-sing-into-current-20260524` at `35e4164ce571608dd8a3d0fab9a47eb38a90cf01`
- Portable bundle: `/Users/simongonzalezdecruz/Downloads/liminal-sing-rescue-2026-05-24.bundle`
- Prior rescue report: `/Users/simongonzalezdecruz/Downloads/liminal-sing-rescue-report-2026-05-24.md`

## Preserved Files

### Studio-side Sing Helpers

- `gui/public/audio-sing-worklet.js`
- `gui/src/gui/audioBootstrap.ts`
- `gui/src/gui/audioSing.ts`
- `gui/src/gui/singPreset.ts`
- `gui/src/gui/singPreview.ts`

### Standalone Instrument Packages

- `packages/audio-core/**`
- `packages/sing/**`

### Tests

- `test/integration/sing-package.test.ts`
- `test/unit/audio/audio-sing-worklet.test.ts`
- `test/unit/gui-audio-sing.test.ts`
- `test/unit/gui-sing-preset.test.ts`
- `test/unit/gui-sing-preview.test.ts`
- `test/unit/sing/**`

### Product Planning

- `docs/SING_WORKSHOP_INSTRUMENT_SPLIT_PLAN.md`

## Integration Choices

- Imported Sing/Instrument code additively from `origin/main`.
- Kept current `gui/src/gui/audioSync.ts` and `gui/src/gui/syncPreview.ts` in place; they are still part of the Kyanite Studio surface after Phase 2.
- Added `packages/*` to `pnpm-workspace.yaml`.
- Added `@liminal/audio-core` as a root workspace dependency so package contract tests can assert the preserved workspace wiring.
- Added root `sing:*` scripts and a CI `Sing package build` step so the standalone instrument is built on pull requests.

## Still Separate

- Launching Sing from the Studio UI is not wired in this preservation PR.
- End-to-end microphone permission and live performance tests require a browser/runtime pass and are not claimed by this audit.
- A future `KyaniteLabs/liminal-instrument` split is not performed here; this PR only prevents loss and keeps the package buildable.

## Acceptance

- No discovered Sing package/source/test files listed above remain unaccounted for.
- The Mac mini cadence worklet fix is included with an executable unit test.
- The standalone Sing instrument is validated by package build/typecheck and unit tests.
