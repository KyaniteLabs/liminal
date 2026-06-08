# SinterFS Accumulation Audit — 2026-06-08

Follow-up to #607 (garden archive hydration). Audits the SinterFS persistence
surface for the same pattern: **data written to SinterFS but never read back**,
i.e. silent non-accumulation across sessions/cycles.

Method: enumerate every live `writeArtifact` / `writeRef` / `writeManifest` /
`recordRun` call site in `src/` (excluding Agent B territory), then locate a real
read-back consumer for each. "Accumulates" = a consumer hydrates the data from
disk on a later session/cycle.

## Verdict table

| Write path | Write call site | Read-back consumer | Accumulates? | Severity |
|---|---|---|---|---|
| **Session turns + manifest** | `SessionGraph.persistTurn/persistManifest` (`src/agent/SessionGraph.ts:127,133`) — **but constructed without `fs`** at `src/tui-bridge/TuiBridgeService.ts:321`, so in the live app it is memory-only | `SessionResumer` reads **in-memory `Map` only** (`src/agent/SessionResumer.ts:23,37`); docstring: *"manifests are ephemeral (in-memory) for now. Future: scan SinterFS"* | **NO** — `/sessions` (`TuiBridgeService.ts:1289`) loses all history on restart | **HIGH** → FIXED below |
| Archive entries (QD archive) | `ArchiveEntriesFSAdapter.writeArchiveEntry` (`src/fs/adapters/ArchiveEntries.ts:18`) | `EmergenceHooks.hydrateArchive` → gardener `getCells` (`TuiBridgeService.ts:259`) | **YES** (fixed in #607) | OK |
| Cortex goals | `GoalStore.writeManifest` (`src/cortex/GoalStore.ts:45,99,113`) | `GoalStore.getAll/getActiveGoals` read manifests from disk (`GoalStore.ts:66-71,86`), wired at `TuiBridgeService.ts:232` | **YES** | OK |
| Task ledger (tasks/attempts/candidates/decisions) | `TaskLedger.writeManifest/writeRef/writeArtifact` (`src/ledger/TaskLedger.ts:53,112,156,…`) | `TaskLedger.getTask/getAll/getAttempt/getCandidate/getDecision` read from disk (`TaskLedger.ts:59,75,142,194,242`); `ConveyorRunner.ts:122` reads artifacts | **YES** | OK |
| Gallery versions | `PreviewServer` write + `gallery/<project>/v<n>` refs | `PreviewServer` gallery endpoints read refs/artifacts (`src/render/PreviewServer.ts:280,316`) | **YES** | OK |
| `SinterFS.recordRun` (run_record events) | `RalphLoop.ts:199,1638`, `OrganismLoop.ts:62,159` | **none** — no `run_record` reader anywhere in repo | **NO** | LOW (telemetry/audit log, not behavior-driving experience; adding a reader nobody consumes would be manufacturing) |
| `ArchiveEntriesFSAdapter.writeArchiveState` (`archive/cell/*`) | adapter method (`ArchiveEntries.ts:67`) | none | **N/A** | NONE — **zero callers** (dead path; not an active loop) |
| `PreferenceEventsFSAdapter.writePreferenceEvent/writeSessionPreferences` | adapter methods (`src/fs/adapters/PreferenceEvents.ts:19,38`) | none | **N/A** | NONE — **never called** (only re-exported in `src/fs/index.ts:2`); no active writer |
| Taste model (preferences → train → weights → replay bias) | `TasteModelTrainer.train`, `ReplayBiasPolicy.loadModel`, `PreferenceEventLogger`, `AutonomousGardener.loadTasteModel` | none of these are invoked in the live loop: `train()`, `loadTasteModel()`, `new PreferenceEventLogger()` have **no product call sites**; `/pin` (`TuiBridgeService.ts:1184`) updates in-memory review state only | **N/A** | OUT OF SCOPE — unwired scaffolding on *both* sides, not a "written-but-not-read" gap. Closing it is a multi-joint feature (capture→persist→train→persist-weights→hydrate→wire), not a surgical read-counterpart. Per task guidance ("don't manufacture a fix / simplest sufficient change"), recorded, not fixed here. |

## Conclusion

The one **active, high-value, #607-shaped** gap is **session persistence/resume**:
the persistence code already exists in `SessionGraph` but is handed no `fs` in the
live app, and `SessionResumer` never scans SinterFS — so resumable sessions
silently don't survive a restart. Fixed below using the #607 pattern (enable the
symmetric persistence, add the read counterpart, hydrate at the consumer, wire it).

The taste/preference subsystem is genuinely broken but is **unwired scaffolding**
(no live writer *or* reader), a larger feature than this audit's pattern; it is
documented here as a known gap rather than half-fixed.
