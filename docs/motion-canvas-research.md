# Motion Canvas Research

**Date:** 2026-04-09
**Status:** Research — No implementation
**Replacement for:** Remotion (removed from active product surface)

## What is Motion Canvas?

Motion Canvas is a TypeScript library for programmatic animation, built around async generators and a reactive pipeline. Unlike Remotion (React-based), Motion Canvas uses a Node.js/TypeScript-first approach.

**Repository:** https://github.com/motion-canvas/motion-canvas

## Key Differences from Remotion

| Aspect | Remotion | Motion Canvas |
|--------|----------|---------------|
| Paradigm | React components | TypeScript async generators |
| Component model | React FC + hooks | `makeScene()` + coroutines |
| Timeline | useCurrentFrame() | `yield*` keyword + signal graphs |
| Ecosystem | Large, well-documented | Smaller but actively maintained |
| Video export | Bundler + renderer binary | CEF-based or ffmpeg |
| React dependency | Required | None (fully Node-compatible) |

## Pros
- **Node.js-native rendering** — no browser/React required at render time
- **Coroutines for sequencing** — `yield*` is more intuitive than frame counting
- **Signal graph** — reactive updates without React reconciliation
- **Smaller bundle** — no React runtime in the renderer

## Cons
- **Smaller ecosystem** — fewer third-party integrations, templates, community examples
- **Less mature video export** — Remotion's `@remotion/renderer` has broader codec support
- **Community size** — ~8k GitHub stars vs Remotion's ~30k

## Decision Criteria for Future Evaluation

1. **Render parity** — can it produce equivalent quality MP4/WebM at similar bitrates?
2. **Prompt routing** — does the canHandle confidence logic need changes for `motion-canvas` keywords?
3. **Composition adapter** — does the existing `LayerAdapter` interface map cleanly to Motion Canvas scenes?
4. **Bundle size impact** — does it reduce the installed size vs current Remotion deps?
5. **Licensing** — MIT license, same as Liminal.

## No-Implementation Note

This file is research only. No code has been written toward Motion Canvas integration.
