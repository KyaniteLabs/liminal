# TUI Aesthetic Improvement Plan

**Status Date:** 2026-04-09
**Last Updated:** 2026-04-09 — Lip Gloss semantic palette implemented in `theme.go`. Tokyo Night + Dracula inspired. Full semantic color system: cyan=info, green=safe, amber=caution, red=error, purple=code/brand, muted=chrome. Bubble Tea Wave 4 beauty pass pending (only after functional gate passes).

## Shell principles
- pane-first architecture
- explicit mode identity
- active-response pane separate from committed history
- operator-grade status and activity visibility
- strong trust and provenance labeling
- confirmation-first mutation UX

## MVP visual system
- header with mode badge and provider/model badge
- left transcript pane
- center active response pane
- right trust/activity/status pane
- footer input and key hints

## Semantic states
- chat: neutral
- inspect: informational
- action: warning/review-required
- confirm: high-contrast approval lane
- generated code: untrusted by default
