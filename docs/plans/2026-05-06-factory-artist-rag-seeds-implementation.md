# Factory Artist RAG Seed Implementation Plan

Date: 2026-05-06

## Steps

1. Add the docs-only RAG seed root and per-artist folders.
2. Capture public source anchors for code, blogs, video channels, transcripts, talks, and official archives where available.
3. Mark each source with a reuse posture: reusable licensed code, public reference only, or search anchor.
4. Add explicit gaps where no verified code surface or official transcript corpus is available.
5. Validate all JSON manifests and inspect the resulting diff.

## Verification

- `jq` over every `index.json` and `sources.json`.
- Count per-artist manifests against the fourteen imported profiles.
- `git diff --check`.

## Delivery

Merge the docs-only branch back into local `main` after verification. Do not push unless explicitly asked.
