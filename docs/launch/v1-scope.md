# V1 Scope

_Last updated from live repo state: 2026-04-09_

## V1 product definition
A closed-source creative-coding product for generating, previewing, and iterating **code-native generative visuals**.

## Strategic wedge
Do **not** position v1 as a generic AI art app or broad video platform.

Position it as:
> a creative-coding copilot for generative visuals, motion prototypes, and live-coded media.

## Keep in v1
### Core workflow
- prompt → code → preview → iterate
- saved outputs / archive / remix
- evaluation / quality loop
- gallery/demoable outputs

### Core domains to emphasize
- p5
- GLSL / shader workflows
- Three.js
- Hydra
- Strudel
- HTML / ASCII where useful

### Product strengths already reflected in repo direction
- multi-domain creative generation
- iterative quality/evaluation mindset
- code-native outputs instead of flattened media only
- creative tooling / TUI / runtime experimentation

## Keep but treat carefully
### p5
Keep only with an explicit compliance posture because it remains a direct LGPL dependency and is actively used in wrappers/previews.

## Cut, postpone, or isolate from launch v1
### Remotion-heavy launch messaging or mandatory dependency path
Remotion remains active in the codebase, but it should not be treated as a frictionless default for the first proprietary launch until the licensing/business decision is settled.

### Optional audio feature path that depends on `pitchfinder`
Do not make any `pitchfinder`-backed feature part of the critical launch story unless the package is replaced.

### Broad enterprise surface area
Delay unless needed for a paying design partner:
- heavy compliance/governance positioning
- large team admin workflows
- broad enterprise platform messaging

## Suggested launch architecture
Preferred:
- hosted or hybrid-first

Avoid if possible for first launch:
- desktop-first with the full feature surface bundled

## V1 success criteria
- users can generate compelling code-native visuals quickly
- users can preview/edit/remix results
- the product can be explained in one sentence
- the dependency/licensing surface is understandable and intentional
- the brand is not blocked by obvious naming conflict risk
