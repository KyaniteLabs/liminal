# HTML Domain Redesign — Design Spec
**Date:** 2026-04-10
**Status:** Approved

---

## Context

The `html` creative domain conflates two distinct roles:

1. **HTML as infrastructure/support** — the HTMLWrapper class that wraps any output (p5, shader, three, etc.) in a secure iframe-safe HTML shell for preview/export/embedding
2. **HTML as creative domain** — generating full HTML/CSS/JS pages via LLM

Role 1 is working correctly. Role 2 collapses into generic SaaS landing pages (`portfolio`, `landing page`, `dashboard`) and weakens Liminal's creative identity.

The founder's original intent for HTML was role 1 ("help Liminal build its own wrappers so outputs could be displayed in web pages"). Role 2 was never intentionally specced as a creative domain — it grew organically and without a differentiating creative identity.

---

## Goals

1. **Demote HTML as a creative domain** — remove it from creative keyword routing; it is infrastructure only
2. **Preserve HTML as infrastructure/support layer** — wrapper, export, embedding, preview; must not break
3. **Define a future creative browser-native domain** — distinct from generic web/UI generation, aligned with Liminal's creative identity
4. **Keep the diff narrow** — do not implement the replacement domain yet; create only the stub and docs

---

## Two Roles, Clearly Separated

| Role | Name | Status | Description |
|------|------|--------|-------------|
| Support/Infrastructure | `html` (HTMLWrapper) | Preserved | Wraps generated code (p5, three, shader, etc.) in iframe-safe HTML shells. Used by preview server, export, gallery iframe |
| Creative Generation | HTMLGenerator | **Removed from routing** | Was producing generic landing pages. Not a creative domain — infrastructure leaked into creative space |

---

## Immediate Change: HTML Generator Demotion

### What changes in `registerGenerators.ts`

`htmlConfidence` keyword routing is narrowed so it only catches explicit HTML/CSS technical mentions — not creative intent:

**Before:**
```typescript
const htmlConfidence = (prompt: string): number => {
  if (/portfolio|landing\s*page|dashboard|web\s*app/.test(lower)) return 0.95;
  if (/\bhtml\b|\bcss\b|\bweb\s+(component|page|widget)/.test(lower)) return 0.90;
  if (/web\s*page|website|css\s*design/.test(lower)) return 0.75;
  if (/web\s*dev|ui\s*component|form|spa/.test(lower)) return 0.65;
  return 0;
};
```

**After:**
```typescript
const htmlConfidence = (prompt: string): number => {
  // Explicit HTML/CSS technical mentions — used by composition adapters
  if (/\bhtml\b.*\bgenerator\b|\bgenerate\b.*\bhtml\b/.test(lower)) return 0.50;
  // Generic SaaS patterns — NOT creative domains, no confidence
  if (/portfolio|landing\s*page|dashboard|web\s*app|website|css\s*design|web\s*dev|ui\s*component|form|spa/.test(lower)) return 0;
  return 0;
};
```

**Rationale:** Keywords like `portfolio`, `landing page`, `dashboard`, `website` now route to no domain (confidence: 0). The generative `HTMLWebGenerator` is still registered and callable directly, but keyword routing no longer sends creative prompts to it. Wrapping infrastructure remains unaffected.

### What changes in `RoutingData.ts`

`DOMAIN_ROUTING_DATA.html` and `AB_TEST_RESULTS.html` are updated to reflect the infrastructure-only role:

```typescript
html: {
  optimalModel: 'cloud',
  confidence: 0.80,
  advantage: '+16%',
  localFitness: 0.450,
  cloudFitness: 0.520,
}, // NOTE: html domain is infrastructure-only (HTMLWrapper).
// HTMLWebGenerator is no longer in creative routing.
```

`DOMAIN_KEYWORDS` entry for `html` is updated:
```typescript
html: ['html', 'css'], // Narrowed to technical mentions only
```

### What stays the same

- `HTMLWrapper` class in `src/utils/htmlWrapper.ts` — unchanged, `case 'html': return code;` pass-through for wrapping
- `HTMLAdapter` in `src/composition/adapters/HTMLAdapter.ts` — unchanged, handles HTML as a composition layer
- `Exporter` and gallery iframe wiring — unchanged
- `HTMLWebGenerator` class exists and is callable programmatically — not removed

---

## Future Creative Domain: Kinetic

### What it is

**Kinetic** generates browser-native generative art using CSS keyframe animations and SVG. It produces autonomous, perpetually-animated visual compositions — no JavaScript required, no canvas drawing, no Three.js scene graph.

### Output character

- Pure CSS + SVG + HTML
- Perpetually-animated via `@keyframes`
- Zero runtime JavaScript
- No "page" scaffolding (no nav, no footer, no contact form)
- A living, breathing browser-native artwork that runs in HTML

### What it is NOT

- Not a landing page / portfolio / SaaS page
- Not a p5.js sketch (frame-drawn, algorithmic)
- Not a Three.js scene (spatial, scene-graph)
- Not CSS animation demos (purely decorative, not generative)
- Not a website in any conventional sense

### How it complements existing domains

| Domain | Execution model | Motion character |
|--------|----------------|-----------------|
| p5.js | Frame-drawn, algorithmic | Stepwise/discrete |
| Three.js | Scene-graph, spatial | Frame-drawn |
| GLSL | Per-pixel GPU math | Continuous per-pixel |
| Hydra | Video synthesis, feedback | Real-time continuous |
| Strudel | Pattern + time | Event-based |
| Remotion | Frame-by-frame composition | Rendered, not live |
| **Kinetic** | **Declarative CSS + SVG** | **Autonomous CSS keyframes** |

Kinetic fills the gap for CSS-native autonomous motion art — a genuinely different execution model that complements all existing domains.

### Naming: "Kinetic"

Chosen because:
- Evocative of motion without being tied to a specific framework
- Not "css" or "css-art" (too technical, too generic)
- Distinct from "animation" (which is a property, not a domain identity)
- Single word, memorable

### Stub implementation

A single stub file is created now (domain name claimed, future wiring prepared):

**`src/generators/kinetic/KineticGenerator.ts`**
```typescript
import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

/**
 * Kinetic — CSS-native generative art domain (FUTURE, NOT YET WIRED)
 *
 * Generates autonomous, perpetually-animated visual compositions using
 * CSS keyframes and SVG. Zero JavaScript required at runtime.
 *
 * Status: Stub. Generation prompt and routing NOT implemented.
 * See docs/CREATIVE_DOMAIN_TYPES.md for design.
 */
export class KineticGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('kinetic', llmOrConfig);
  }

  async generate(prompt: string, _options?: TierBasedGeneratorOptions): Promise<string> {
    throw new Error('KineticGenerator: generation not yet implemented. See docs/CREATIVE_DOMAIN_TYPES.md');
  }
}
```

**`src/generators/kinetic/index.ts`**
```typescript
export { KineticGenerator } from './KineticGenerator.js';
```

**`src/generators/registerGenerators.ts`:** Add `kineticEntry` (registered, `canHandle: () => 0`, not wired yet — placeholder only).

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/generators/registerGenerators.ts` | Narrow `htmlConfidence`; add `kineticEntry` stub |
| `src/generators/kinetic/KineticGenerator.ts` | **New file** — stub class |
| `src/generators/kinetic/index.ts` | **New file** — barrel export |
| `src/routing/RoutingData.ts` | Update `html` routing entry (note infrastructure-only); narrow `DOMAIN_KEYWORDS.html` |
| `docs/CREATIVE_DOMAIN_TYPES.md` | Document HTML as infrastructure row; add Kinetic to Proposed Expansions |

### Files NOT changed (intentionally)

- `src/utils/htmlWrapper.ts` — unchanged (infrastructure preserved)
- `src/composition/adapters/HTMLAdapter.ts` — unchanged
- `src/export/Exporter.ts` — unchanged
- `src/generators/html/HTMLWebGenerator.ts` — class exists, not removed, callable directly

---

## Spec Self-Review

- [x] No placeholders or TBDs — all changes are specific and actionable
- [x] No internal contradictions — two roles are clearly separated, stub is clearly marked not-yet-wired
- [x] Scope is focused — demotion of one domain + stub for future domain, no broad changes
- [x] Infrastructure preserved — HTMLWrapper, HTMLAdapter, Exporter all untouched
- [x] No implementation of Kinetic generation — stub only, as constrained

---

## Verification

After changes:
1. `htmlConfidence('build me a landing page')` → `0` (not routed to HTML)
2. `htmlConfidence('generate html css')` → `0.50` (technical mention, low confidence)
3. `HTMLWrapper.wrap(code, 'html')` → unchanged pass-through
4. `KineticGenerator` exists in `src/generators/kinetic/`
5. `kineticEntry.canHandle()` returns `0` (stub, never wins routing)
6. `docs/CREATIVE_DOMAIN_TYPES.md` updated with both roles documented
