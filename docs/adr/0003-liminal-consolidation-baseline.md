# ADR 0003: Liminal Consolidation Baseline

Date: 2026-05-25
Status: Accepted for consolidation Phase 0

## Context

Liminal currently has multiple plausible source surfaces:

- `KyaniteLabs/liminal` main at `94ceb80a58521e4a1d033ffa8a801a36aa0d4808`.
- `simongonzalezdc/liminal` main at `129bfb0699ecfc90941e4317edf6b939d1ea7c2b`.
- Open Studio consolidation PR branch `codex/studio-conversation-ux-20260524` at `1216760334401215a2fed25346e0f4c82e335e02`.
- Mac mini duplicate `KyaniteLabs-liminal` at `912e2fde3680`.
- Sibling `KyaniteLabs/liminal-sites` main at `0077659a879dfd9559b42fbb54631986f2a8164f`, with a dirty Mac mini workflow patch.

The personal and Kyanite `main` branches are materially divergent. The laptop's `main` matches personal `origin/main`, while `kyanite/main` is 33 commits ahead and 31 commits behind that branch.

## Decision

Use `KyaniteLabs/liminal` main at `94ceb80a58521e4a1d033ffa8a801a36aa0d4808` as the baseline for consolidation PRs.

Classify the other surfaces as follows:

- `simongonzalezdc/liminal` main `129bfb06`: import source, not baseline.
- PR #552 branch `12167603`: active PR lane that must be conflict-reviewed against the Kyanite baseline.
- Mac mini `912e2fde`: stale duplicate and cleanup candidate only after explicit approval.
- `KyaniteLabs/liminal-sites` `0077659a`: sibling repo baseline, not core Liminal baseline.
- Dirty Mac mini `liminal-sites/.github/workflows/blacksmith-probe.yml`: preserve as a sibling-repo patch before cleanup.

## Drivers

- The target consolidation repo is `KyaniteLabs/liminal`.
- The clean Mac mini current clone matches `KyaniteLabs/liminal` main.
- Open PR #552 targets `KyaniteLabs/liminal` main and uses `94ceb80a` as its base.
- `KyaniteLabs/liminal` includes final-audit, proof, and security-floor commits that personal `origin/main` does not include.
- Personal `origin/main` includes important Sing/Instrument and local rescue work, but promoting it wholesale would drop Kyanite-only proof and audit history.

## Alternatives Considered

### Promote personal `origin/main` as canonical

Rejected because it would treat Kyanite-only proof, final-audit, security-floor, and launch-readiness history as secondary. The branch is valuable, but it should be mined through focused preservation PRs.

### Merge PR #552 first and decide later

Rejected because PR #552 is currently `DIRTY` and blends Studio, document-pack, and Sing gates. It should be reviewed against the baseline after the baseline is explicit.

### Split Core, Sites, and Instrument immediately

Rejected for Phase 0 because the shared artifact contracts and Instrument/Sing ownership boundaries are not yet proven enough for repo extraction. Split/no-split criteria are deferred to the Instrument preservation phase.

## Consequences

- New consolidation PRs should branch from `kyanite/main`.
- Personal-main, Sing, Studio, and document-pack work must be imported selectively with source provenance.
- Branch cleanup is not authorized by this ADR.
- Mac mini duplicate cleanup is not authorized by this ADR.
- The next implementation lanes should be small, reversible, and proof-backed.

## Verification

Phase 0 evidence was recorded in `docs/audits/liminal-consolidation-phase0-2026-05-25.md`.

Minimum follow-up checks before merging consolidation work:

- `git diff --check`
- `pnpm check:doc-links`
- `pnpm check:script-targets`
- Targeted tests/proof commands named by each follow-up PR
