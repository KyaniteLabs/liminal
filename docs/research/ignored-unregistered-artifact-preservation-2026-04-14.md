# Ignored Unregistered Artifact Preservation — 2026-04-14

This document preserves the mining map for ignored/unregistered local artifacts that were not safe to delete but were also not tracked by git.

## Preservation summary

- Created at: `2026-04-14T17:13:15Z`
- Preserved file count: `1108`
- Preserved byte count: `18250457` bytes (~17.4 MiB before compression)
- Local archive: `.omx/artifact-preservation/2026-04-14Tartifact-preservation/ignored-unregistered-artifacts-2026-04-14.tar.gz`
- Archive SHA-256: `2a160a85be62e69a6a6140bd98afc11862c2a10c65f97f2e81e9359dbc94d4f9`
- Archive size: `12184103` bytes (~11.6 MiB)
- Full tracked manifest: `docs/research/ignored-unregistered-artifacts-manifest-2026-04-14.json`
- Local archive file list: `.omx/artifact-preservation/2026-04-14Tartifact-preservation/archive-file-list.txt`
- Local per-file checksum list: `.omx/artifact-preservation/2026-04-14Tartifact-preservation/manifest.sha256`

## Preserved roots

- `.claude/worktrees/launch-plan`
- `.claude/worktrees/agent-a88f46ec`
- `.claude/worktrees/kinetic-build-20260410`
- `.claude/plans`
- `.claude/projects`

## File counts by root

| Root | Files |
| --- | ---: |
| `.claude/worktrees/launch-plan` | 1099 |
| `.claude/worktrees/agent-a88f46ec` | 5 |
| `.claude/plans` | 2 |
| `.claude/worktrees/kinetic-build-20260410` | 1 |
| `.claude/projects` | 1 |

## Top file extensions

| Extension | Files |
| --- | ---: |
| `.ts` | 446 |
| `.js` | 274 |
| `.html` | 206 |
| `.json` | 49 |
| `.png` | 42 |
| `.zip` | 36 |
| `.md` | 19 |
| `.go` | 14 |
| `[no-ext]` | 7 |
| `.jsonl` | 6 |
| `.mjs` | 3 |
| `.yaml` | 1 |
| `.cjs` | 1 |
| `.sh` | 1 |
| `.mod` | 1 |
| `.sum` | 1 |
| `.tsx` | 1 |


## Why this was preserved instead of deleted

The largest ignored/unregistered area was `.claude/worktrees/launch-plan`, which is not registered in `git worktree list` but contains dogfood, launch-plan, report, screenshot, gallery, and model-comparison artifacts. Because those artifacts may contain historical evaluation evidence, deleting them would destroy future mining value.

The archive also includes small Claude local-state/context directories:

- `.claude/worktrees/agent-a88f46ec`
- `.claude/worktrees/kinetic-build-20260410`
- `.claude/plans`
- `.claude/projects`

## How to verify the archive

```bash
cd /Users/simongonzalezdecruz/workspaces/liminal
shasum -a 256 -c .omx/artifact-preservation/2026-04-14Tartifact-preservation/ignored-unregistered-artifacts-2026-04-14.tar.gz.sha256
tar -tzf .omx/artifact-preservation/2026-04-14Tartifact-preservation/ignored-unregistered-artifacts-2026-04-14.tar.gz | head
```

## How to mine later without restoring everything

List archive contents:

```bash
tar -tzf .omx/artifact-preservation/2026-04-14Tartifact-preservation/ignored-unregistered-artifacts-2026-04-14.tar.gz | rg 'dogfood|landing|evaluation|report|model|screenshot|gallery'
```

Extract to a temporary mining directory:

```bash
mkdir -p /tmp/liminal-preserved-artifacts-2026-04-14
tar -xzf .omx/artifact-preservation/2026-04-14Tartifact-preservation/ignored-unregistered-artifacts-2026-04-14.tar.gz -C /tmp/liminal-preserved-artifacts-2026-04-14
```

Search the tracked manifest without extracting:

```bash
jq -r '.files[].path' docs/research/ignored-unregistered-artifacts-manifest-2026-04-14.json | rg 'dogfood|landing|evaluation|report|model|screenshot|gallery'
```

## Cleanup status

After archiving, the original ignored/unregistered directories were intentionally left in place. The archive makes it safe to clean them later, but deletion should be a separate explicit cleanup step after verifying the archive still exists and the checksum passes.

## Notes

- The archive itself is intentionally untracked because it is a binary artifact (~11.6 MiB compressed).
- The full manifest is tracked so future agents can identify what was preserved even if the ignored artifact area is moved or deleted later.
- This preservation does not imply all artifacts are high-value; it preserves them so future mining can separate signal from residue without risking data loss.
