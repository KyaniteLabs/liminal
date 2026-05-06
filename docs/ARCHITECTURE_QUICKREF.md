# Architecture Quick Reference

This quick reference is the lightweight map for people trying to understand Liminal without reading the full philosophy document first.

## User Surfaces

- Studio GUI: the artist-facing workbench for prompt-to-art generation, preview, polish, receipts, and visible failure states.
- Bubble Tea TUI: the operator surface for provider setup, bridge sessions, controls, and run visibility.
- CLI: the scriptable front door for generation, market status, proof commands, and release gates.

## Runtime Spine

1. Input enters through Studio, TUI bridge, or CLI.
2. Intent routing selects the creative domain and preview path.
3. The generator creates a domain artifact through the configured provider.
4. Validators and proof scripts check artifact shape, provenance, receipts, previews, and command-to-claim truth.
5. Receipts record what actually happened so launch claims can cite evidence instead of intention.

## Launch-Proof Rule

Implementation status is not enough for public launch copy. A public claim needs a current command, a live receipt, or an explicit caveat in `docs/launch/feature-claim-ledger-2026-05-06.md`.

## Deeper References

- `docs/ARCHITECTURE_AND_PHILOSOPHY.md`
- `docs/USER_SURFACE_CONTRACT.md`
- `docs/GENERATOR_ARCHITECTURE_V2.md`
- `docs/launch/test-ci-truth-matrix-2026-05-01.md`
