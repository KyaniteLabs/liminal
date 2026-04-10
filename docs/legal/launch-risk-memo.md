# Launch Risk Memo

_Date:_ 2026-04-09

## Objective
Assess whether `liminal-ai` can launch as a proprietary / closed-source product given the current live repository state.

## Live repo snapshot used for this memo
- Branch: `liminal/sess-1775786525942-f19gzr`
- Working tree at snapshot time:
  - modified: `src/core/RalphLoop.ts`
  - deleted: `test/integration/test-evaluator-gallery/2026-04-09--quality-filter-test/v1.js`
- Package manifest: `liminal-ai@2.1.0`, license `MIT`
- Dependency surface at snapshot time:
  - 35 `dependencies`
  - 4 `optionalDependencies`
  - 21 `devDependencies`
- Recent work as of 2026-04-09 includes quality pipeline, CI/security, loop/runtime, and evaluator changes.

## Executive summary
### Recommendation
**Go only with conditions.**

A proprietary launch still looks feasible, but the current repo has three launch-sensitive licensing/business-risk areas:
1. `pitchfinder` remains present as an **optional dependency** under `GNU v3`
2. `remotion` and related `@remotion/*` packages remain **direct dependencies** with custom/commercial licensing implications
3. `p5` remains a **direct LGPL-2.1 dependency** and is used in generated wrappers / previews

None of those automatically force the whole product open-source, but they do create pre-launch diligence and product-scope decisions.

## Product model assumptions
This memo assumes the company wants:
- a closed-source core product
- commercial launch readiness
- flexibility to sell hosted and/or packaged offerings

### Best-fit near-term product model
**Hosted or hybrid-first** is lower-friction than a downloadable desktop-first launch because it narrows the compliance surface and makes risky features easier to gate.

## Current dependency risk summary

### Red
#### 1. `pitchfinder` (optional dependency)
- Manifest location: `optionalDependencies.pitchfinder`
- Runtime reference: `src/audio/PitchExtractor.ts`
- Local installed metadata: `GNU v3`
- Risk: strong copyleft / high diligence burden if shipped as part of a commercial product distribution
- Notes:
  - This package is **not mandatory** for baseline install/runtime
  - The repo still references it and encourages install in logs/docs
- Proposed action: **replace or remove from launch-critical feature set**

#### 2. `remotion`, `@remotion/bundler`, `@remotion/cli`, `@remotion/renderer`
- Manifest location: direct `dependencies`
- Live code usage:
  - `src/render/RemotionRenderer.ts`
  - `src/generators/remotion/*`
  - `src/composition/adapters/RemotionAdapter.ts`
- Local installed metadata: `SEE LICENSE IN LICENSE.md`
- Business risk: vendor-specific/commercial licensing obligations likely apply for company use
- Proposed action: **make an explicit keep-vs-cut decision for v1**

### Yellow → Green (Completed)
#### 3. `p5` — COMPLIANCE REVIEW COMPLETE ✅
- Manifest location: direct `dependencies`
- Local installed metadata: `LGPL-2.1`
- Live usage:
  - `src/core/wrappers/P5Wrapper.ts`
  - `src/composition/adapters/P5Adapter.ts`
  - generated wrapper HTML and previews
- **Compliance status:** Review complete. See `docs/legal/p5-compliance-posture.md`
- **Finding:** CDN-based usage (dynamic linking equivalent); no modification; no bundled source
- **Risk:** LOW — proper notices documented
- **Action:** **KEEP** — notices added to `docs/legal/third-party-notices.md`

#### 4. Transitive MPL / binary-license packages
Observed previously in local license scans:
- `lightningcss`, `mediabunny`, related encoder packages
- sharp/libvips binaries

These are lower-priority than the three issues above, but they should remain in the formal inventory and notices process.

### Green
The majority of the first-order manifest remains commercially friendly:
- MIT
- BSD-2-Clause
- ISC
- Apache-2.0

Examples include `express`, `react`, `react-dom`, `zod`, `puppeteer`, `better-sqlite3`, `archiver`, `remark`, `unified`, `meyda`, and `sharp`.

## Provenance status
Not yet fully audited.

Current caution points:
- docs contain stale licensing assumptions for some packages
- the repo includes many generated examples, prompt templates, and mined/researched docs
- no full copied-snippet / vendored-source audit has been completed yet

## Documentation quality note
Some internal docs/plans do **not** reflect the current live package reality.
Examples:
- older voice-aesthetic docs describe `pitchfinder` as MIT
- older docs describe Remotion more simply than the current package/vendor reality warrants

For legal and launch work, prefer:
1. live `package.json`
2. current installed package metadata
3. current code references
4. then older plans/docs

## Brand / trademark status
### Current mark under consideration
`Liminal`

### Preliminary risk call
**High naming risk / likely poor launch choice without formal clearance.**

Reason:
- current market already contains multiple adjacent software/AI businesses using “Liminal”
- that increases likelihood-of-confusion risk and branding friction
- even if registration were possible in a narrower class, it looks expensive and collision-prone

## Launch recommendation
### Recommended path
1. **Replace or drop `pitchfinder` from launch scope**
2. **Decide whether Remotion is core enough to pay/license for**
3. **Keep p5 only with explicit compliance plan**
4. **Rebrand away from `Liminal` before public launch**
5. Launch with a narrower v1 wedge focused on:
   - p5 / GLSL / Three / Hydra / Strudel / HTML
   - prompt → code → preview → iterate
   - code-native generative visuals

## Pre-launch blockers
Before calling the product launch-ready, complete:
- [ ] dependency inventory
- [ ] provenance review
- [ ] third-party notices draft
- [ ] Remotion keep/cut decision
- [ ] `pitchfinder` replacement or removal plan
- [ ] trademark/name shortlist and preliminary clearance

## Outside counsel questions
1. Given the current direct + optional dependency surface, can the product ship closed-source as planned?
2. Does the current `p5` usage pattern create extra obligations for a packaged/commercial product?
3. What exact commercial/license obligations apply to the current Remotion usage model?
4. Is keeping `pitchfinder` in optionalDependencies acceptable if the related feature is disabled by default?
5. Is `Liminal` too risky to adopt as the commercial brand for software/AI tooling?
