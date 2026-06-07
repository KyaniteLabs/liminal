# ADR 0001 - Sinter Product Shape

## Status

Accepted for this branch.

## Date

2026-05-24

## Context

Sinter has grown into several real product directions:

- Core/Studio creative authoring
- Sites aesthetic webpage evolution
- Sing/Instrument live performance

The handoff clarified that treating these as one vague surface is causing
architecture drift. Studio must become conversational. Sites must not drift
into business-metric optimization. Instrument must not be reduced to a thin
singing widget.

## Decision

Sinter has three product-level surfaces:

```text
Sinter / Core / Studio
= conversational aesthetic authoring workshop

Sinter Sites
= aesthetic webpage evolution sibling product

Sinter Instrument
= live performance sibling product
```

Core/Studio authors artifacts. Sites specializes artifacts for living webpages.
Instrument specializes artifacts for performance.

## Core / Studio Responsibilities

- conversational authoring
- prompt-to-artifact generation
- preview and revision
- evaluation and aesthetic guardrails
- provider/model routing
- artifact memory and receipts
- export
- authoring of Sites and Instrument artifacts

## Sites Responsibilities

- living website visual systems
- runtime skins
- source-code patch proposals
- site profiles
- aesthetic variants
- owner taste learning
- safe preview and human-reviewed evolution
- optional PostHog aesthetic telemetry

Sites non-goals:

- SEO optimization
- conversion optimization
- revenue optimization
- funnel analytics
- generic product analytics dashboards
- growth hacking

## Instrument Responsibilities

- deterministic performance runtime
- voice/singing input
- movement/camera input
- controller input
- stage cues
- visual/audio mappings
- phrase/lyric teleprompter sidecar
- recording and session telemetry
- offline render
- post-session ingestion into Studio/Core

Instrument non-goals:

- blocking realtime performance on a model
- making the performer secondary to AI
- requiring network access during performance
- generating complete songs by default

## Realtime Rule

Hard realtime loop:

```text
sensor input
-> feature extraction
-> deterministic mapping
-> rendering/audio output
```

Soft AI sidecar loop:

```text
context
-> small local model
-> suggestions/proposals
-> optional performer use
```

The sidecar may fail without damaging the performance.

## Repository Implication

Do not create or split a future `liminal-instrument` repository until the local
machine audit is complete. Current evidence supports keeping `packages/sing`
inside Sinter while the preservation audit is incomplete.
