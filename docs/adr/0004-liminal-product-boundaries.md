# ADR 0004: Liminal Product Boundaries

Date: 2026-05-25
Status: Accepted for consolidation Phase 1

## Context

Phase 0 selected `KyaniteLabs/liminal` as the consolidation baseline. The next
risk is importing useful work from personal branches, Studio PR lanes, Sites, and
Sing/Instrument surfaces without first naming the product boundaries.

The document pack and local audit show three real product directions:

- Liminal Core/Studio.
- Liminal Sites.
- Liminal Instrument.

Those directions should not be collapsed into one catch-all app. They should also
not be split before the contracts and preservation criteria exist.

## Decision

Use these product boundaries:

```text
Liminal Core/Studio
= conversational aesthetic authoring workshop

Liminal Sites
= aesthetic webpage evolution sibling product

Liminal Instrument
= live performance sibling product
```

`KyaniteLabs/liminal` remains the canonical Core/Studio repository for the
consolidation. `KyaniteLabs/liminal-sites` is a sibling product repository.
Instrument/Sing work remains a preservation lane until its source files, source
commits, runtime behavior, and split criteria are verified.

## Core/Studio Responsibilities

Core/Studio owns the authoring workshop:

- conversational authoring
- prompt-to-artifact generation
- preview and revision
- evaluation and receipts
- aesthetic guardrails
- taste learning
- provider and model routing
- artifact memory
- export
- session ingestion
- authoring of Sites and Instrument artifacts

Core/Studio should feel like a natural language creative workbench. Harness,
proof, and evaluator details may exist as receipts and operator tools, but they
should not become the artist-facing mental model.

## Sites Responsibilities

Sites is an aesthetic webpage evolution product:

- living website visual systems
- runtime skins
- source-code patch proposals
- site profiles
- aesthetic variants
- visual direction generation
- owner taste learning
- safe preview
- human-reviewed evolution
- optional aesthetic telemetry

Sites is not a gallery export layer and not a generic publishing afterthought.
It has equal product dignity with Core/Studio.

### Sites Non-Goals

Sites must not optimize for:

- SEO
- conversion
- revenue
- funnel analytics
- lead capture
- click-through
- generic product analytics dashboards
- growth hacking
- business KPI maximization

Those terms may appear in docs only as non-goals, warnings, or historical context.

## Instrument Responsibilities

Instrument is a live performance product:

- deterministic performance runtime
- voice and singing input
- movement and camera input
- controller input
- stage cues
- visual/audio mappings
- phrase or lyric teleprompter sidecars
- recording
- telemetry
- offline render
- post-session ingestion into Core/Studio

Instrument is not a thin singing demo. The rescued Sing work is important because
it is evidence for Instrument, but the product boundary is broader than singing.

## Realtime Rule

The realtime performance path is deterministic:

```text
sensor input
-> feature extraction
-> deterministic mapping
-> rendering/audio output
```

AI belongs in a soft sidecar:

```text
context
-> local or remote model
-> suggestions/proposals
-> optional performer use
```

The sidecar may fail without breaking audio, camera, controller, render, or stage
control loops.

## Shared Contract Requirement

Core/Studio, Sites, and Instrument must exchange versioned artifacts with shared
provenance, receipts, files, controls, review actions, and product-specific
extensions. The first durable contract is
`docs/contracts/liminal-shared-artifact-contracts.md`.

The Phase 1 contract is enforceable through fixtures and
`pnpm check:liminal-contracts`. It is not yet a published npm package or generated
TypeScript package, but it is a merge gate for future imports that claim shared
artifact compatibility.

Any mutation to a user repo, deployed site, or saved canonical artifact requires
a review action. Silent mutation is not allowed.

## Repository Implications

- New Core/Studio consolidation work branches from `kyanite/main`.
- `KyaniteLabs/liminal-sites` remains a sibling repo and must be aligned through
  a separate Sites lane.
- Personal-main and Mac mini Sing/Instrument work are import sources until a
  preservation phase verifies exact files and commits.
- Package paths such as `packages/sing` are not present on current Kyanite main.
  They are preservation/import candidates only when source evidence proves them.
- A future `KyaniteLabs/liminal-instrument` repository is possible but not
  authorized by this ADR.

## Alternatives Considered

### Treat Sites as a downstream gallery or publishing layer

Rejected because the product direction is an aesthetic webpage evolution sibling,
not an export target.

### Let Sites optimize normal business analytics

Rejected because it would pull Sites away from aesthetic evolution and into SEO,
conversion, revenue, funnel, and growth work.

### Treat Instrument as only Sing

Rejected because singing is one input class inside a broader performance product
that also includes movement, camera, controllers, stage cues, mappings, recording,
and ingestion.

### Split all repos immediately

Rejected for now because shared contracts, import provenance, and Instrument
runtime verification are not complete.

## Consequences

- Phase 2 can focus on Studio as the conversational authoring workshop.
- Phase 3 can rescue Sing without shrinking Instrument to Sing.
- Phase 4 can align Sites without importing growth/product-analytics goals.
- Future code imports must cite source branch, source commit, and product boundary.
- Shared contracts become the integration gate for sibling products, with fixture
  validation as the Phase 1 enforcement layer.

## Verification

Phase 1 should pass:

- `git diff --check`
- `pnpm check:doc-links`
- `pnpm check:script-targets`
- `pnpm check:liminal-contracts`
- `pnpm audit --audit-level moderate`
- Sites-boundary keyword audit proving SEO/conversion/revenue/funnel/growth terms
  appear only as non-goals, warnings, or historical context.
