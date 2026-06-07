# Sinter Instrument Consolidation Proposal

Last updated: 2026-05-25

## Recommendation

Choose Option C now: keep `packages/sing` inside `KyaniteLabs/liminal`
temporarily, then rename or carve out only after the instrument surface has one
stable release.

## Pros

- preserves the working Studio-to-Sing package path already verified in CI
- avoids full-history repo surgery while the API is still moving
- keeps shared preset contracts in `packages/audio-core`
- lets Studio, Sing, lyric sidecar, and movement controls evolve together

## Cons

- `KyaniteLabs/liminal` remains broader than a single creative agent package
- instrument code can still be confused with Studio generation code
- future package naming will require migration docs and import updates

## Migration Risk

Moderate. The current package boundary is real enough to ship, but not stable
enough for a clean full-history split. A premature carveout would risk losing
the rescue trail and making future agents chase stale local copies again.

## Files Impacted

- `packages/audio-core/**`
- `packages/sing/**`
- `test/unit/sing/**`
- `docs/integrations/sing-*.md`
- future Studio launch links that open Sing presets

## History Preservation Plan

Keep all landed rescue commits on `KyaniteLabs/liminal/main`. If a future
`liminal-instrument` repository is created, use `git filter-repo` against
`packages/audio-core`, `packages/sing`, Sing tests, and Sing integration docs.
Tag the source repo before extraction and preserve the tag in the new repo
README.

## Backport Strategy

Treat `simongonzalezdc/liminal` and Mac mini checkouts as historical sources,
not canonical destinations. Backport only through PRs into `KyaniteLabs/liminal`
until the instrument repository exists. Do not force-sync divergent `main`
branches; create explicit rescue branches when a local-only artifact must be
preserved.
