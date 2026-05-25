# Liminal Consolidation Phase 0 Audit

Date: 2026-05-25
Branch: `codex/consolidation-phase0-audit-20260525`
Base: `kyanite/main` at `94ceb80a58521e4a1d033ffa8a801a36aa0d4808`
Scope: read-only inventory and baseline decision for consolidation planning.

## Safety Boundary

No destructive commands were used in this audit. The audit did not run `git pull`, `git merge`, `git rebase`, `git reset`, `git clean`, `git push`, or `rm -rf`.

Allowed operations used: status, branch/worktree inventory, remote ref lookup, diff/log summaries, GitHub PR readback, Mac mini SSH read-only status, and Downloads pack listing/checksum.

## Canonical Baseline Decision

Use `KyaniteLabs/liminal` `main` at `94ceb80a58521e4a1d033ffa8a801a36aa0d4808` as the consolidation PR baseline.

Rationale:

- It is the target organizational repo named by the consolidation plan.
- It is the base of open PR #552.
- It matches the clean current Mac mini clone at `/Users/simongonzalezdecruz/Desktop/the-factory/.omc/repos/liminal`.
- It contains recent final-audit, proof, security-floor, and hosted-repo commits that are missing from personal `origin/main`.
- Personal `origin/main` at `129bfb0699ecfc90941e4317edf6b939d1ea7c2b` is valuable import source material, not the baseline, because it is 31 commits ahead and 33 commits behind `kyanite/main`.

This decision does not discard personal-main, Sing, Studio, or Sites work. It classifies them as preservation/import lanes.

## Local Laptop Inventory

Host: `Mac-302.lan`, Simon's MacBook Air.

Primary checkout:

| Path | Branch | HEAD | Status | Disposition |
| --- | --- | --- | --- | --- |
| `/Users/simongonzalezdecruz/workspaces/liminal` | `main` | `129bfb0699ec` | clean | Preserve as personal-main import source |

Remotes:

| Name | URL | Role |
| --- | --- | --- |
| `origin` | `https://github.com/simongonzalezdc/liminal.git` | Personal source/import remote |
| `kyanite` | `https://github.com/KyaniteLabs/liminal.git` | Canonical organization remote |

Active worktrees:

| Path | Branch | HEAD | Status | Initial disposition |
| --- | --- | --- | --- | --- |
| `.claude/worktrees/consolidation-phase0-audit-20260525` | `codex/consolidation-phase0-audit-20260525` | `94ceb80a5852` | clean before audit edits | Phase 0 audit branch |
| `.claude/worktrees/df3-vip-p3` | `feat/df3-vip-p3` | `62e082f2284d` | clean | Preserve/defer; needs lane-specific disposition |
| `.claude/worktrees/launch-hardening-456` | `feat/launch-hardening-456` | `7f4784aee978` | clean | Preserve; likely launch/test-hardening import source |
| `.claude/worktrees/rescue-sing-20260524` | `codex/rescue-sing-into-current-20260524` | `35e4164ce571` | clean | Preserve; Sing cadence import source |
| `.claude/worktrees/studio-conversation-ux-20260524` | `codex/studio-conversation-ux-20260524` | `121676033440` | clean | Active PR #552 lane |

Branch divergence from current laptop `main`:

| Ref | Left/right count vs `HEAD` | Meaning |
| --- | --- | --- |
| `origin/main` | `0 / 0` | Laptop main matches personal origin main |
| `kyanite/main` | `33 / 31` | Material divergence; do not fast-forward blindly |
| `codex/studio-conversation-ux-20260524` | `19 / 0` | Studio PR branch contains laptop main lineage plus newer work |
| `codex/rescue-sing-into-current-20260524` | `8 / 8` | Diverged rescue lane |
| `feat/df3-vip-p3` | `6 / 8` | Diverged VIP/default-eval lane |
| `feat/launch-hardening-456` | `7 / 8` | Diverged launch-hardening lane |

## Remote Evidence

Remote heads read from the laptop:

| Repo/ref | HEAD |
| --- | --- |
| `KyaniteLabs/liminal main` | `94ceb80a58521e4a1d033ffa8a801a36aa0d4808` |
| `KyaniteLabs/liminal codex/studio-conversation-ux-20260524` | `1216760334401215a2fed25346e0f4c82e335e02` |
| `simongonzalezdc/liminal main` | `129bfb0699ecfc90941e4317edf6b939d1ea7c2b` |
| `simongonzalezdc/liminal codex/studio-conversation-ux-20260524` | `1216760334401215a2fed25346e0f4c82e335e02` |
| `KyaniteLabs/liminal-sites main` | `0077659a879dfd9559b42fbb54631986f2a8164f` |

Open PR:

| PR | Base | Head | State | Merge state | Note |
| --- | --- | --- | --- | --- | --- |
| `KyaniteLabs/liminal#552` | `main` at `94ceb80a5852` | `codex/studio-conversation-ux-20260524` at `121676033440` | open | `DIRTY` | Active Studio/document-pack/Sing consolidation lane; needs conflict review before merge |

## Mac Mini Inventory

Host: Simon's Mac mini, reachable over SSH at `simongonzalezdecruz@100.115.175.18`.

| Path | Repo | Branch | HEAD | Status | Stash count | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `/Users/simongonzalezdecruz/Desktop/the-factory/.omc/repos/liminal` | `KyaniteLabs/liminal` | `main` | `94ceb80a5852` | clean | `0` | Current clean canonical clone |
| `/Users/simongonzalezdecruz/Desktop/the-factory/.omc/repos/KyaniteLabs-liminal` | `KyaniteLabs/liminal` | `main` | `912e2fde3680` | clean | `0` | Stale duplicate; archive/delete candidate after explicit approval |
| `/Users/simongonzalezdecruz/Desktop/the-factory/.omc/repos/liminal-sites` | `KyaniteLabs/liminal-sites` | `main` | `0077659a879d` | dirty: `M .github/workflows/blacksmith-probe.yml` | `0` | Preserve dirty workflow patch before any cleanup |

Mac mini caveat: HTTPS GitHub fetch failed there earlier because credentials are not configured. Remote truth was therefore checked from the laptop.

## Downloads Pack Inventory

| Path | Evidence | Disposition |
| --- | --- | --- |
| `/Users/simongonzalezdecruz/Downloads/liminal-codex-master-handoff-all-in-one.md` | 3193 lines, SHA-256 `28f23c1234559eab0d73b19ed9fb74811f40b006ac149c193ed2c73218095b91` | Planning source; convert selected content into repo-local ADR/spec/audit docs, do not bulk-copy blindly |
| `/Users/simongonzalezdecruz/Downloads/liminal-codex-document-pack.zip` | SHA-256 `2b5b0881b71071e6852209eb0b2ac6b00e1bb8552b88492e61479914cc611a16`, 20 files | Planning source; import scripts/specs only through reviewable PRs |

Pack contents include executive summary, repo-risk audit, machine-fragmentation audit, product ADR, Studio conversation spec, Sites aesthetic spec, PostHog sensorium spec, Instrument spec, LFM lyric sidecar spec, camera/movement spec, shared artifact contracts, execution plan, verification matrix, source references, and two audit scripts.

## Preservation Classification

| Surface | Classification | Next safe action |
| --- | --- | --- |
| `KyaniteLabs/liminal main` `94ceb80a` | Canonical baseline | Build consolidation PRs from this base |
| Personal `simongonzalezdc/liminal main` `129bfb06` | Import source | Diff into focused PRs; do not promote wholesale |
| PR #552 `12167603` | Active PR lane | Resolve conflicts against `kyanite/main`; review before merge |
| Mac mini stale `KyaniteLabs-liminal` `912e2fde` | Stale duplicate | Keep until explicit cleanup approval; no unique dirty state found |
| Mac mini `liminal-sites` dirty workflow | Dirty sibling-repo state | Preserve patch before any cleanup or repo sync |
| Downloads handoff pack | Planning/evidence source | Convert into repo docs selectively with provenance |
| Sing branches | Instrument preservation source | Preserve and triage under Instrument/Sing lane |

## Risks

- `origin/main` and `kyanite/main` are both plausible-looking "main" branches but have 33/31 divergent commits. Treating either as automatically dominant would lose work.
- PR #552 is open but `DIRTY`; it should not be merged until conflict and proof review are complete.
- The Mac mini stale duplicate is clean but may still matter as forensic evidence until the baseline decision is fully accepted.
- The dirty `liminal-sites` workflow file is outside core Liminal but still part of the sibling-product consolidation story.
- Bulk-importing the Downloads pack would create documentation sprawl; it should be mined into curated ADR/spec/audit artifacts.

## Phase 0 Result

Phase 0 is complete for read-only inventory and baseline decision. Recommended next step is Phase 1: product-boundary ADRs and shared-contract minimum schema/versioning, while keeping Studio PR #552 and Sing preservation as separate lanes.
