# Taste Preference Loop Design

## Goal

Wire Sinter's existing preference and taste-model scaffolding into a real product loop:
capture user taste actions, persist them in the project store, train a local taste model
from persisted archive entries plus preference events, and hydrate the autonomous gardener
with that model so replay/branch choices can be biased by observed operator taste.

## Current Gap

The repository already has `PreferenceEventLogger`, `PreferenceEventsFSAdapter`,
`PreferenceDatasetBuilder`, `TasteModelTrainer`, `TasteModelRuntime`, and
`ReplayBiasPolicy`. The live path does not connect them:

- `/pin` in `TuiBridgeService` only updates `ReviewManager` memory.
- `PreferenceEventsFSAdapter.writePreferenceEvent` is not called by product code.
- `TasteModelTrainer.train()` is not called by product code.
- `AutonomousGardener.loadTasteModel()` exists, but no product path loads weights.

## Recommended Scope

Implement both automatic runtime wiring and an explicit CLI handle in one PR.

The automatic path makes taste learning real during TUI use. The CLI path keeps it
operator-debuggable without depending on a running TUI session. This is still a small
feature because it reuses existing learning primitives and avoids new ML dependencies.

## Architecture

Add `src/learning/TasteLearningService.ts`.

Responsibilities:

- Resolve project-local preference storage under `.sinter/preferences`.
- Record preference actions through `PreferenceEventLogger`.
- Mirror each record through `PreferenceEventsFSAdapter` so SinterFS refs/artifacts
  also carry the signal.
- Read persisted archive entries via `ArchiveEntriesFSAdapter`.
- Join preference records onto archive entries for training.
- Build a dataset with `PreferenceDatasetBuilder`.
- Train weights with `TasteModelTrainer`.
- Persist the latest weights as a SinterFS artifact/ref.
- Load latest weights back from SinterFS for gardener hydration.

Do not make `AutonomousGardener` know about filesystems. It should remain a runtime
orchestrator that accepts already-trained weights through `loadTasteModel()`.

## Data Flow

### Capture

`/pin <candidate-id>`:

1. `ReviewManager.pin(candidateId)` remains the source of truth for candidate lifecycle.
2. On success, `TuiBridgeService` calls `TasteLearningService.recordPreference({ action: 'pin', artifactId: candidateId, sessionId })`.
3. The command response confirms the pin and notes whether preference persistence happened.

`/reject <candidate-id>`:

1. `ReviewManager.reject(candidateId)` remains unchanged.
2. On success, record a `reject` preference event.

The first PR should not infer taste from `/accept`; acceptance can mean "execute this"
rather than "I aesthetically prefer this."

### Persistence

Each preference event is written to:

- project-local `.sinter/preferences/*.json` through `PreferenceEventLogger`
- SinterFS artifact/ref through `PreferenceEventsFSAdapter`

If SinterFS is unavailable, TUI commands should still work and report that preference
storage was unavailable. No fake fallback should pretend the signal was persisted.

### Training

`TasteLearningService.trainFromProject()`:

1. Reads archive entries from SinterFS.
2. Reads preference events from `.sinter/preferences`.
3. Creates training entries by applying preference records to matching archive entries.
4. Builds a dataset with `PreferenceDatasetBuilder`.
5. Trains weights with `TasteModelTrainer`.
6. Persists weights to `taste/model/latest`.
7. Returns a summary with event count, archive entry count, pair count, agreement, and
   whether weights were persisted.

For the first PR, only train when there are usable preference pairs. Empty inputs should
produce an honest "not enough data" summary instead of storing empty weights.

### Hydration

`TuiBridgeService` should try to load latest taste weights before each gardener cycle or
once during gardener initialization plus after new training. The simplest safe design is:

- Try once during service construction after creating `AutonomousGardener`.
- Try again after a successful preference record and training run if the dataset has pairs.

This avoids filesystem reads on every cycle while still making newly captured taste useful
inside the active session.

### CLI

Extend `sinter preferences` with:

- `sinter preferences train`
- `sinter preferences model`

`train` calls `TasteLearningService.trainFromProject()` and prints a compact summary.
`model` loads latest weights and prints metadata. Existing `export` and `stats` should use
the same project-local preference directory so TUI and CLI observe the same events.

## Error Handling

- Missing project/SinterFS: command returns a clear unavailable message.
- No archive entries: train returns no-model summary.
- No matching preference pairs: train returns no-model summary.
- Corrupt preference event files: continue using existing logger behavior.
- Corrupt model artifact/ref: ignore and report no usable model.

No provider fallback, evaluator fallback, or score fabrication belongs in this PR.

## Testing

Add tests that prove the product loop, not just isolated scaffolding:

- `TasteLearningService` records a pin into both project-local preferences and SinterFS.
- `TasteLearningService` trains weights from persisted archive entries plus a pin/reject
  signal and loads the latest model.
- `TuiBridgeService` persists `/pin` after the review manager accepts the candidate.
- CLI `preferences train` and `preferences model` have contract coverage in the bin file.
- Gardener hydration test proves loaded taste weights bias replay selection.

Verification commands:

- `pnpm vitest run test/unit/learning/TasteLearningService.test.ts`
- `pnpm vitest run test/tui-bridge/tui-bridge-commands.test.ts`
- `pnpm vitest run test/unit/autonomy/AutonomousGardener.test.ts`
- `pnpm build`
- `pnpm test:quality`

## Out Of Scope

- Re-enabling the self-improve cron.
- Repointing evaluator provider config.
- Training from implicit text preferences.
- Changing model/provider routing.
- New ML libraries or cloud model calls.
- Visual quality trend claims.
