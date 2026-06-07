# Sites Keyword Audit - 2026-05-24

## Purpose

Phase 4 required a check for accidental Sites framing around business metrics.
Sinter Sites should be an aesthetic webpage evolution product, not SEO,
conversion, revenue, funnel, or growth software.

## Command

```bash
git grep -n -I -E 'SEO|conversion|revenue|funnel|growth|click-through|lead capture|business KPI' -- README.md docs src gui || true
```

## Result Summary

The command returned many hits across historical docs, archived audits, factory
persona material, code comments, and general Sinter research. Those hits do
not by themselves prove current Sites product framing is wrong.

Examples of expected or unrelated hit classes:

- archived audit material under `docs/archive/` and `docs/audits/final-qa-*`
- factory artist/persona references under `docs/agents/factory-artists/`
- general creative-system uses of organic "growth"
- media format "conversion" references
- old business viability documents that are not Sites product docs

## Corrective Docs Added

This branch adds the current product boundary in:

```text
docs/adr/0002-liminal-sites-aesthetic-evolution.md
docs/integrations/posthog-aesthetic-sensorium.md
```

Those docs explicitly state that Sites is not:

- SEO software
- conversion optimization software
- funnel analytics software
- revenue optimization software
- growth hacking software
- generic product analytics

## Remaining Cleanup Recommendation

Do not bulk-edit archives or factory persona docs just to make a keyword grep
quiet. A safer follow-up is to scope the audit to current Sites-facing surfaces
once the canonical Sites repo path is selected.

Suggested follow-up command after that selection:

```bash
git grep -n -I -E 'SEO|conversion|revenue|funnel|growth|click-through|lead capture|business KPI' -- README.md docs src gui \
  ':!docs/archive/**' \
  ':!docs/audits/final-qa-*/**' \
  ':!docs/audits/final-completion-*/**' \
  ':!docs/agents/factory-artists/**' || true
```

The target result is not zero hits. The target result is that any remaining
Sites-specific hit appears only in non-goals, warnings, or historical context.
