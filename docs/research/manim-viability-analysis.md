# Manim Domain Viability Analysis

**Project:** Liminal Meta-Harness  
**Target Domain:** `manim` — Mathematical Animation Engine  
**Analyst:** Kimi Code CLI  
**Date:** 2026-04-13  
**Verdict:** 🔴 **CONDITIONAL NO-GO** — Viable only if Liminal accepts a JS-port subset (manim-web TS). The canonical Python Manim path is architecturally incompatible with Liminal's browser-first, zero-backend-runtime generator philosophy.

---

## 1. Executive Summary

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Technical Fit** | 3/10 | Language/runtime mismatch. Canonical Manim = Python + FFmpeg. Liminal = browser-executable JS/HTML. |
| **LLM Familiarity** | 8/10 | Python Manim is heavily represented in training data (3Blue1Brown viral content). TS Manim-web is not. |
| **User Demand** | 6/10 | Niche but passionate. Math edu/creative coding crossover is real but smaller than p5/Three.js. |
| **Infrastructure Overhead** | 9/10 | Would require either a Python execution backend or adoption of an immature TS port. |
| **Validation Ease** | 4/10 | Structural validation possible; semantic/runtime validation requires actual rendering engine. |
| **Maintenance Burden** | 8/10 | High. Two ecosystems (Python packaging vs. immature JS bindings) both create long-tail support debt. |

**Bottom Line:** Adding "real" Manim breaks Liminal's core invariant that generated artifacts are self-contained and previewable without a server-side build step. A **manim-web** (TypeScript/WebGL) integration is the only viable path, but it trades the "real" Manim ecosystem for a community port with incomplete API coverage.

---

## 2. What Manim Actually Is

### 2.1 Canonical Python Manim (3b1b/manim & ManimCommunity)
- **Language:** Python 3.8+
- **Output:** Video files (`.mp4`) written frame-by-frame via Cairo/OpenGL, then stitched with FFmpeg.
- **Paradigm:** Imperative scene graph. `Scene.construct()` defines mobjects and sequences `self.play()` calls.
- **Runtime Requirements:** Python interpreter, LaTeX (for `MathTex`), Pango (for `Text`), FFmpeg, GPU optional but recommended.
- **Key APIs:** `Scene`, `Mobject`, `VMobject`, `Circle`, `Square`, `MathTex`, `Create`, `Transform`, `FadeIn`, `self.play()`, `self.wait()`.

### 2.2 Browser Ports (The Only Liminal-Compatible Options)

| Port | Maturity | Tech Stack | API Fidelity | Notes |
|------|----------|------------|--------------|-------|
| **maloyan/manim-web** | Early but active | TypeScript, WebGL (Three.js) | ~60% of ManimCE | React/Vue bindings, KaTeX for math, async `scene.play()`. MIT license. |
| **MathItYT/manim-web** (Pyodide) | Experimental | Pyodide + micropip | High (runs actual ManimCE) | Requires ~100MB Pyodide WASM download per session. `Text` unsupported. No `Tex` (only `MathTex` via MathJax). |

**Critical insight:** There is no "native" browser Manim. The TS port is a reimplementation. The Pyodide port is a Python VM in the browser. Both are compromises.

---

## 3. Liminal Domain Integration Checklist

To add a new domain to Liminal, the following touchpoints must be modified or created:

1. `src/types/domains.ts` — `Domain` enum + type guards + domain category arrays.
2. `src/generators/manim/ManimGenerator.ts` — `TierBasedGenerator` subclass.
3. `src/generators/registerGenerators.ts` — `canHandle` prompt routing + registry entry.
4. `src/prompts/manim.ts` — PromptLibrary registration (system/user prompts).
5. `src/core/validators/ManimValidator.ts` — Structural validation gate.
6. `src/core/CodeValidator.ts` — Domain detection heuristics + min-size mapping + switch cases.
7. `src/generators/GeneratorHarnessTools.ts` — Skeleton, API vocab, hardening hints, wrapper contract, repair prompts.
8. `src/routing/RoutingData.ts` — `DomainType`, keywords, AB test placeholders.
9. `src/tui/preview/PreviewRouter.ts` — Browser preview type detection.
10. `docs/domains/manim.md` — Domain documentation for PromptBuilder context loading.
11. Dogfood test suite integration.

---

## 4. Deep-Dive: Technical Fit per Touchpoint

### 4.1 Domain Enum (`src/types/domains.ts`)
**Effort:** Trivial (5 min).  
**Blockers:** None.  
**Notes:** Would add `MANIM = 'manim'` and likely `MATH = 'math'` aliases. Must decide if Manim belongs in `VIDEO_DOMAINS` (it produces animation, but not via Revideo) or gets its own `MATH_DOMAINS` category.

### 4.2 Generator Class (`src/generators/manim/ManimGenerator.ts`)
**Effort:** Low for scaffold; high for runtime integration.  
**Blockers:** Severe.

If targeting **Python Manim**, the generator would output Python code. This violates Liminal's assumption that `generatorRegistry.dispatch()` returns code that can be wrapped in HTML and dropped into an iframe. No other generator in Liminal produces non-browser-runnable code.

If targeting **manim-web TS**, the generator outputs TypeScript/JSX resembling:

```ts
import { Scene, Circle, Create, Transform, FadeOut } from 'manim-web';

async function squareToCircle(scene: Scene) {
  const square = new Square({ sideLength: 3 });
  const circle = new Circle({ radius: 1.5 });
  await scene.play(new Create(square));
  await scene.play(new Transform(square, circle));
  await scene.play(new FadeOut(square));
}
```

This is browser-runnable, but:
- The API surface is smaller than Python Manim.
- There is no established CDN distribution for `manim-web` (npm install required).
- The library is pre-1.0; breaking changes are likely.

### 4.3 Prompt Routing (`src/generators/registerGenerators.ts`)
**Effort:** Low.  
**Blockers:** None, but ambiguity risk exists.  
**Keywords:** `manim`, `mathematical animation`, `math visualization`, `3blue1brown`, `latex animation`, `geometry proof`, `function graph animation`.

**Risk:** High overlap with `three` (3D geometry), `p5` (generative art), and `revideo` (video composition). Confidence scoring must be aggressive to avoid misrouting "3D math graph" prompts to Manim when the user wanted Three.js.

### 4.4 Prompt Library (`src/prompts/manim.ts`)
**Effort:** Medium.  
**Blockers:** Content divergence.

For **Python Manim**, prompts are easy to write because LLMs know the API well.  
For **TS manim-web**, prompts must explicitly steer the model away from Python-isms (`from manim import *`, `self.play(...)`) toward JS-isms (`await scene.play(...)`, `new Circle(...)`). This is hard for smaller models (local tiers) because training data is Python-skewed.

### 4.5 Validation (`src/core/validators/ManimValidator.ts`)
**Effort:** Medium.  
**Blockers:** Semantic validation requires rendering.

**Structural checks possible:**
- Python path: Class inherits `Scene`, defines `construct(self)`, uses `self.play()`.
- TS path: Imports from `manim-web`, async functions, `scene.play(new Create(...))`.

**Semantic checks impossible without execution:**
- Does the `Transform` target exist in the scene graph?
- Are `MathTex` strings valid LaTeX?
- Do mobject references remain in scope across `await` boundaries?

This is worse than Three.js (where we can at least catch syntax errors in browser devtools) because Manim's scene graph errors are runtime logic errors, not syntax errors.

### 4.6 CodeValidator Integration (`src/core/CodeValidator.ts`)
**Effort:** Low.  
**Blockers:** None.  
**Detection heuristics:**
- `from manim import` or `class .*Scene.*:` → Python Manim
- `import .*manim-web` or `new Scene(` or `new Circle(` → TS manim-web
- `MathTex`, `Mobject`, `VMobject` → Manim (either dialect)

### 4.7 Harness Tools (`src/generators/GeneratorHarnessTools.ts`)
**Effort:** Medium-high.  
**Blockers:** Requires choosing one dialect.

The harness needs:
- **Skeleton hint:** A minimal valid scene.
- **API vocab:** ~20-30 core tokens (`Scene`, `Circle`, `Square`, `Create`, `Transform`, `FadeIn`, `MathTex`, `VGroup`, `Axes`, `NumberPlane`, etc.).
- **Wrapper contract:** For TS path, an HTML shell that loads `manim-web` from a CDN (if one exists) or bundles it.
- **Contamination domains:** Must guard against mixing p5 (`createCanvas`), Three.js (`THREE.Scene`), and Revideo (`makeScene`).

**Problem:** No stable CDN for `manim-web` was found during research. The project is npm-published but unpkg/jsdelivr coverage is unverified.

### 4.8 Routing Data (`src/routing/RoutingData.ts`)
**Effort:** Low.  
**Blockers:** Need dogfood baseline data.  
**Hypothesis:** Cloud models would outperform local models for Manim due to the niche API and need for precise LaTeX/animation reasoning. This is unverified.

### 4.9 Preview Router (`src/tui/preview/PreviewRouter.ts`)
**Effort:** Low for TS path; impossible for Python path.  
**Blockers:** Python path requires server-side video render pipeline.

For the **TS path**, `PreviewRouter` would detect `manim-web` imports and route to `browser` with `browserType: 'manim'`. However, Liminal's preview system would need a new HTML harness that initializes a WebGL canvas and mounts the Manim scene. This is similar to Three.js wrapping but with a more complex initialization sequence (async `scene.play()` loop).

### 4.10 Domain Docs (`docs/domains/manim.md`)
**Effort:** Medium.  
**Blockers:** None.  
**Risk:** Docs must be maintained for whichever dialect is chosen. If the TS port breaks API compatibility, docs rot fast.

---

## 5. LLM Code Generation Suitability

### 5.1 Python Manim
- **Strengths:** Massively overrepresented in training corpora (3Blue1Brown tutorials, GitHub repos, StackOverflow). Models like GPT-4, Claude, and even Qwen produce syntactically valid Python Manim at high rates.
- **Weaknesses:** Models frequently hallucinate deprecated APIs (`ShowCreation` vs `Create` in ManimCE), mix 3b1b and ManimCommunity syntax, and generate LaTeX that requires a full TeXlive installation (not available in browser).

### 5.2 TypeScript Manim-Web
- **Strengths:** Syntax is modern JS/TS; no Python-specific knowledge needed.
- **Weaknesses:** Training data is extremely sparse. Even flagship models struggle with the exact API (`new Create(mobj)` vs `Create(mobj)`). Local models would almost certainly fail.

### 5.3 Tier-Based Implications
| Tier | Python Manim | TS Manim-Web |
|------|--------------|--------------|
| Flagship | ✅ Excellent | ⚠️ Okay with explicit examples |
| Medium | ✅ Good | ⚠️ Fragile |
| Local | ⚠️ Okay (syntax errors in LaTeX) | 🔴 Poor |
| Tiny | 🔴 Poor | 🔴 Unusable |

**Conclusion:** If Liminal uses its standard local-first routing, TS Manim-Web would have a terrible success rate. Python Manim succeeds at generation but fails at execution within Liminal's architecture.

---

## 6. The Runtime/Preview Infrastructure Gap (THE KILLER)

Liminal's generator contract is implicitly:
> "Generated code + HTML wrapper = runnable artifact in browser iframe."

Manim Python breaks this contract. To make it work, Liminal would need one of the following architectural changes:

### Option A: Python Execution Backend
- Spin up a Python environment with ManimCE, LaTeX, FFmpeg.
- Accept generated Python, execute `manim -ql scene.py`, return `.mp4`.
- **Verdict:** Catastrophic scope creep. Liminal is a creative coding CLI, not a video render farm. Security, latency, and cost explode.

### Option B: Pyodide/WASM in Browser
- Wrap generated Python in a Pyodide runtime that `micropip.install("manim-web")`.
- **Verdict:** Feasible in theory. In practice, each preview loads ~100MB of WASM. `Text` mobjects are broken. LaTeX uses MathJax instead of real TeX. This is a degraded experience compared to native Python Manim.

### Option C: TypeScript Manim-Web Port
- Use `maloyan/manim-web` as the rendering engine.
- **Verdict:** The only viable path, but it is not "real" Manim. Feature gaps (no advanced 3D shaders, limited mobject library) mean power users will be disappointed.

---

## 7. Competitive Overlap with Existing Domains

| Existing Domain | Overlap with Manim | Distinction |
|-----------------|-------------------|-------------|
| **Revideo** | Video/animation | Revideo is general-purpose video composition (React-like). Manim is math-specific declarative animation. |
| **Three.js** | 3D geometry, graphs | Three.js is lower-level WebGL. Manim is higher-level scene graph with built-in math primitives. |
| **p5.js** | 2D generative art | p5 is frame-loop imperative. Manim is timeline-based scene animation with LaTeX. |
| **HTML** | Can embed Manim | HTML is static layout. Manim is dynamic mathematical content. |

**Insight:** Manim occupies a unique niche (mathematical explanatory animation) that no existing Liminal domain serves well. The niche is defensible, but small.

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **API drift in manim-web TS** | High | High | Pin dependency version; accept breakage on upstream updates. |
| **Local model failure rate** | High | Medium | Force cloud/hybrid routing for Manim domain. |
| **LaTeX rendering breakage** | Medium | High | Restrict to `MathTex` only; provide KaTeX-compatible LaTeX hints. |
| **Misrouting to Three.js/p5** | Medium | Medium | Aggressive `canHandle` confidence (0.9+ for explicit "manim" keywords). |
| **User expectation mismatch** | High | Medium | Clear messaging: "Browser-based Manim subset, not full Python Manim." |
| **No stable CDN for manim-web** | Medium | High | Bundle library into Liminal's dist or self-host from npm tarball. |

---

## 9. Effort Estimate

### Path A: Python Manim (Backend Render)
**Effort:** 6-8 engineer-weeks.  
**Verdict:** Rejected. Architecturally incompatible.

### Path B: Pyodide Manim-Web
**Effort:** 2-3 engineer-weeks.  
**Verdict:** Rejected. WASM payload too heavy; degraded UX.

### Path C: TypeScript Manim-Web (Recommended if proceeding)
**Effort:** 1.5-2 engineer-weeks.

**Breakdown:**
| Task | Hours |
|------|-------|
| Scaffold generator, validator, prompts, registry wiring | 4 |
| Build HTML preview harness for manim-web | 6 |
| Write domain docs and harness skeleton/API vocab | 4 |
| Dogfood testing + A/B routing baseline | 6 |
| Fix local model failures (prompt hardening) | 8 |
| CDN/bundling resolution for manim-web | 4 |
| Documentation + Visual Bible update | 4 |
| **Total** | **~36 hours** |

---

## 10. Recommendations

### 🔴 Primary Recommendation: DO NOT PROCEED with Manim as a first-class domain at this time.

**Reasoning:**
1. The canonical Manim experience (Python + LaTeX + FFmpeg) cannot be delivered within Liminal's current browser-first architecture without massive infrastructure investment.
2. The only viable alternative (TS manim-web) is an immature port that would disappoint users expecting "real" Manim.
3. The niche, while defensible, is smaller than several other domains (e.g., React/Next.js components, D3 dataviz, TouchDesigner) that would integrate more cleanly.

### 🟡 Conditional Alternative: Manim-Web Pilot (Experimental Plugin)

If there is strong stakeholder demand, implement Manim as a **plugin** rather than a core domain:
- Use `pluginLoader` to dynamically register the generator.
- Bundle `manim-web` as a plugin dependency.
- Mark it `experimental` in the registry.
- Limit prompt routing to explicit keywords (`manim`, `3blue1brown`) to avoid misrouting.

**Advantages:**
- Isolates maintenance burden.
- Does not pollute core routing/validation with unstable APIs.
- Easy to deprecate if manim-web stagnates.

### 🟢 Future Revisit Triggers

Reopen this analysis if any of the following occur:
- `manim-web` (TS) reaches 1.0 stable with a reliable CDN.
- Liminal adds a generic "backend execution" sandbox for Python (massive architecture shift).
- A WebAssembly Manim port achieves <20MB payload and full ManimCE API parity.
- User demand data shows >10% of prompts would benefit from math animation specifically.

---

## 11. Appendix: Reference Manim-Web TS Scene

```ts
import { Scene, Circle, Square, Create, Transform, FadeOut } from 'manim-web';

async function squareToCircle(scene: Scene) {
  const square = new Square({ sideLength: 3, color: '#FC6255' });
  const circle = new Circle({ radius: 1.5, color: '#58C4DD' });
  
  await scene.play(new Create(square));
  await scene.play(new Transform(square, circle));
  await scene.wait(1);
  await scene.play(new FadeOut(circle));
}
```

**Wrapper harness required for Liminal preview:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Manim Scene</title>
  <style>body{margin:0;overflow:hidden;background:#111}</style>
</head>
<body>
  <div id="scene"></div>
  <script type="module">
    import { Scene, Circle, Square, Create, Transform, FadeOut } from 'https://cdn.jsdelivr.net/npm/manim-web@0.x.x/dist/index.js';
    // ... scene setup and user code injection ...
  </script>
</body>
</html>
```

*Note: The CDN URL above is hypothetical. As of this analysis, no stable unpkg/jsdelivr endpoint for manim-web's ES module build was verified.*

---

**End of Analysis**
