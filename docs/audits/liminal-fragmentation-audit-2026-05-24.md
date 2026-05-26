# Liminal Fragmentation Audit - 2026-05-24

> Historical note (2026-05-26): This audit captured the fragmented pre-consolidation state. Current source-of-truth routing is `KyaniteLabs/liminal` and `KyaniteLabs/liminal-sites`; old personal, local duplicate, and Pushing-Squares references below are preserved only as forensic evidence.

## Purpose

The document pack required a read-only audit of local and remote Liminal,
Sites, and Instrument/Sing work before moving or splitting anything.

## Safety

No destructive commands were used. In particular, this audit did not run
`git pull`, `git merge`, `git rebase`, `git reset`, `git clean`, `git push`, or
directory deletion.

## Audit Caveat And Repair

The full package script and a bounded retry both stalled while inspecting:

```text
/Users/simongonzalezdecruz/Desktop/OMC/liminal
```

The stalled processes were stopped. The partial raw file outside the repo was:

```text
/Users/simongonzalezdecruz/Desktop/liminal-fragmentation-audit-Mac-299-20260524-183744.md
```

Follow-up timeout-bounded inspection confirmed that `git status`,
`git diff --name-status`, and `git ls-files -m` all timed out on that checkout
within five seconds. Sampling showed Git blocked while reading tracked files and
then a loose Git object from the Desktop checkout.

The live path was repaired on 2026-05-24 by preserving the broken physical tree
and rebuilding `/Users/simongonzalezdecruz/Desktop/OMC/liminal` from the
verified current branch:

```text
preserved old tree: /Users/simongonzalezdecruz/Desktop/OMC/liminal.broken-working-tree-20260524-201253
old branch/head: repo-pipeline-fix-20260420-liminal @ 14d39ec2
repaired live path: /Users/simongonzalezdecruz/Desktop/OMC/liminal
repaired branch/head: codex/studio-conversation-ux-20260524 @ d1ce6144
```

Post-repair verification completed successfully with:

```text
git status --short --branch --untracked-files=no
git diff --name-status -- .
git ls-files -m
```

The preserved old tree is still available for forensic recovery of the
local-only `14d39ec2` branch, but it should not be treated as a healthy working
checkout.

## Discovered Local Repositories

| Path | Branch | HEAD | Remotes | Sing/audio evidence |
|---|---|---:|---|---|
| `/Users/simongonzalezdecruz/workspaces/liminal` | `main` | `7f4784ae` | `origin=https://github.com/simongonzalezdc/liminal.git` | Has `packages/sing`, `packages/audio-core`, `gui/src/gui/audioSing.ts`, `gui/public/audio-sing-worklet.js`, and `docs/SING_WORKSHOP_INSTRUMENT_SPLIT_PLAN.md`. |
| `/Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/studio-conversation-ux-20260524` | `codex/studio-conversation-ux-20260524` | `9eea129d` before this doc batch | `origin=https://github.com/simongonzalezdc/liminal.git` | Has the rescued Sing work plus new teleprompter, benchmark, and LFM rejection docs. |
| `/Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/rescue-sing-20260524` | `codex/rescue-sing-into-current-20260524` | `35e4164c` | `origin=https://github.com/simongonzalezdc/liminal.git` | Contains the Mac mini cadence fix and pre-teleprompter Sing rescue state. |
| `/Users/simongonzalezdecruz/workspaces/kyanite-labs/liminal` | `main` | `1acd69e7` | `origin=https://github.com/KyaniteLabs/liminal.git`, `personal=https://github.com/simongonzalezdc/liminal.git` | No tracked `packages/sing` or `packages/audio-core` files found by the bounded scan. |
| `/Users/simongonzalezdecruz/workspaces/personal/liminal-sites` | `main` | `988052b35` | `origin=https://github.com/Pushing-Squares/liminal-sites.git`, `upstream=https://github.com/KyaniteLabs/liminal.git` | No Sing/audio files found. This is the Sites sibling work surface. |
| `/Users/simongonzalezdecruz/Desktop/OMC/liminal` | `codex/studio-conversation-ux-20260524` | `d1ce6144` | `origin=https://github.com/KyaniteLabs/liminal.git` | Rebuilt from the verified current branch after the old Desktop checkout stalled. `git status`, `git diff --name-status`, and `git ls-files -m` now complete. The old local-only `repo-pipeline-fix-20260420-liminal @ 14d39ec2` tree is preserved at `/Users/simongonzalezdecruz/Desktop/OMC/liminal.broken-working-tree-20260524-201253`. |
| `/Users/simongonzalezdecruz/actions-runner/simongonzalezdc-liminal/_work/liminal/liminal` | detached HEAD | `b9dd856` | `origin=https://github.com/simongonzalezdc/liminal` | CI runner checkout with the older Sing/audio package surface. |

Additional candidate directories found by local path search included:

```text
/Users/simongonzalezdecruz/actions-runner/simongonzalezdc-liminal/_work/liminal
/Users/simongonzalezdecruz/Desktop/OMC/projects/liminal
/Users/simongonzalezdecruz/Desktop/liam-private/clawd/liminal
/Users/simongonzalezdecruz/Desktop/liam-private/liminal
/Users/simongonzalezdecruz/workspaces/dev-archaeology-review/projects/liminal
/Users/simongonzalezdecruz/workspaces/.worktrees/ceo-agents-council-chamber/liminal
/Users/simongonzalezdecruz/liminal
/Users/simongonzalezdecruz/.codex/worktrees/3669/workspaces/liminal
```

Those paths were not all promoted to verified repo rows in this branch because
the package audit was deliberately bounded before the later OMC repair.

The timeout-bounded follow-up found no usable git checkout at the other listed
candidate paths in this run.

## Remote Truth Not Yet Fully Reconciled

The active local `origin` for this branch is:

```text
https://github.com/simongonzalezdc/liminal.git
```

The package also references:

```text
https://github.com/KyaniteLabs/liminal
https://github.com/KyaniteLabs/liminal-sites
```

These must be compared as separate remotes. Do not treat the personal origin
and KyaniteLabs target as the same repository.

## Instrument/Sing Inventory From Verified Rows

Current branch tracks:

```text
docs/SING_WORKSHOP_INSTRUMENT_SPLIT_PLAN.md
gui/public/audio-sing-worklet.js
gui/src/gui/audioSing.ts
gui/src/gui/singPreset.ts
gui/src/gui/singPreview.ts
packages/audio-core/*
packages/sing/*
test/integration/sing-package.test.ts
test/unit/sing/*
test/unit/audio/audio-sing-worklet.test.ts
```

The current branch adds:

```text
packages/sing/src/teleprompter/phrases.ts
packages/sing/src/teleprompter/benchmark.ts
packages/sing/src/teleprompter/benchmark-cli.ts
test/unit/sing/teleprompter.test.ts
test/unit/sing/teleprompter-benchmark.test.ts
docs/audits/sing-lfm2_5-mlx-local-benchmark-2026-05-24.*
```

## Recommendation

Do not split or rename Instrument/Sing yet.

Keep `packages/sing` and `packages/audio-core` inside the current Liminal repo
until the preserved old OMC tree and any remaining candidate paths are
classified cleanly. A future `KyaniteLabs/liminal-instrument` repo may still be
justified, but only as a full-history carveout after the machine audit is
complete.

The consolidation proposal for the current branch is:

```text
docs/audits/liminal-consolidation-proposal-2026-05-24.md
```
