# Provenance Review

_Initial draft created from live repo state on 2026-04-09._

## Objective
Track provenance risks that matter for a proprietary launch:
- copied third-party source code
- vendored snippets/templates
- imported examples with unclear licensing
- stale or conflicting licensing assumptions in docs

## Current state
No full provenance audit has been completed yet.

## Known caution areas

### 1. Stale licensing assumptions in docs
Some planning/internal docs do not match the current live package surface.

Examples observed during review:
- older voice-aesthetic docs describe `pitchfinder` as MIT
- older docs simplify Remotion licensing in a way that should not be relied on for launch decisions

### 2. Generated examples and fixtures
The repo contains many examples, generated outputs, test fixtures, and archived audit artifacts. These should be reviewed to ensure they do not embed copied third-party source beyond intended/allowed usage.

### 3. Prompt/template lineage
The project includes prompts, templates, and mined research artifacts. These should be reviewed for:
- direct copying from third-party repositories or tutorials
- inclusion of externally licensed examples
- unclear attribution/provenance

## Audit checklist

### Code
- [ ] Search for obvious copied snippets from external repositories
- [ ] Search for vendored third-party source files
- [ ] Confirm whether any LGPL/GPL/MPL source was copied into project-owned files

### Docs / examples / fixtures
- [ ] Review generated examples committed to the repo
- [ ] Review archived audit docs that may include copied snippets
- [ ] Review tutorials and code samples for external provenance

### Prompt / template assets
- [ ] Review prompt packs and template files
- [ ] Check whether any examples were adapted from external licensed materials

## Recommended search passes
- search for embedded license headers
- search for “copied from”, “adapted from”, “source:”
- search for large unusual blocks matching third-party examples
- search for vendored minified or bundled code checked into the repo

## Initial conclusion
The highest immediate legal risks still appear to be dependency/license related, but provenance remains an open workstream and should be closed before commercial launch.

## Next actions
1. complete a copied-snippet audit
2. reconcile stale licensing notes in older docs
3. record findings here with per-file decisions
