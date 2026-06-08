# Strudel Domain Misclassification

## Status

- 2026-06-08: product root-fix DONE on `fix/detect-domain-strudel-audio`.
- PR #616 fixed the vision-audit harness copy only. The canonical product detector now classifies Strudel audio before Hydra when Strudel tokens collide with Hydra-style `.shape()` / `.out()` chains.

## Regression Coverage

- `test/unit/core/CodeValidator.test.ts`: Strudel audio with `bpm(...)`, `s("...")`, `note(...)`, `.shape()`, and `.out()` returns `strudel`.
- The same test verifies unhinted `CodeValidator.validate(...)` calls `StrudelValidator.validate(...)` and does not call `HydraValidator.validate(...)`.
- Real Hydra, p5, shader, and Three snippets remain on their canonical domains.
