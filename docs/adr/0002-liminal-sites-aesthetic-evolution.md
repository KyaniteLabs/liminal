# ADR 0002 - Sinter Sites Aesthetic Evolution

## Status

Accepted for this branch.

## Date

2026-05-24

## Context

The document pack corrected the product definition for Sinter Sites:

```text
Sinter Sites = Sinter tuned for living aesthetic webpages.
```

Sites is a sibling product, not a downstream gallery and not a generic website
builder optimized for business metrics.

## Decision

Sinter Sites exists to deepen a webpage's aesthetic life through generated,
previewed, reversible, human-reviewed visual evolution.

It specializes in:

- visual identity
- color systems
- composition
- typography as aesthetic material
- motion and atmosphere
- interaction feel
- runtime skins
- aesthetic variants
- owner preference memory
- safe preview before publication
- source-code patch proposals

## Explicit Non-Goals

Sinter Sites is not:

- SEO software
- conversion optimization software
- funnel analytics software
- revenue optimization software
- growth hacking software
- generic product analytics
- an A/B winner machine

Those terms are acceptable only when naming non-goals, warnings, or historical
context.

## Runtime Skin Mode

```text
site profile
-> prompt / aesthetic direction
-> generated CSS/JS skin
-> preview
-> owner chooses
-> runtime injection
-> reversible deployment
```

Runtime skins must be reversible and must expose reduced-motion behavior.

## Repo-Native Patch Mode

```text
site repo
-> inspect stack/design system
-> generate aesthetic patch plan
-> preview
-> run verification
-> branch/PR proposal
-> human review
```

Repo-native patches require explicit review before mutation or publication.

## PostHog Boundary

PostHog may be used only as an optional aesthetic sensorium. It can record how
people experience a variant, but it must not become the objective function and
must not auto-publish changes.

## Acceptance Checks

The current keyword audit is captured in:

```text
docs/audits/sites-keyword-audit-2026-05-24.md
```

Future checks should verify that Sites-facing surfaces frame analytics as
aesthetic feedback, not objective optimization.
