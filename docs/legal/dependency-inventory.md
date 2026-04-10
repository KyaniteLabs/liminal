# Dependency Inventory

_Last refreshed from live repo state: 2026-04-09_

## Scope
This inventory tracks the current first-order manifest surface for proprietary-launch review.

Legend:
- **Green** = commercially routine / low-friction
- **Yellow** = review/notice/compliance needed
- **Red** = explicit launch decision needed

## Dependencies

| Package | Version | Kind | License | Current use / notes | Risk | Decision status |
|---|---:|---|---|---|---|---|
| @babel/parser | 7.29.2 | direct | MIT | parsing/internals | Green | keep |
| @babel/traverse | 7.29.0 | direct | MIT | parsing/internals | Green | keep |
| @babel/types | 7.29.0 | direct | MIT | parsing/internals | Green | keep |
| @remotion/bundler | 4.0.445 | direct | SEE LICENSE IN LICENSE.md | **Stubbed** — `src/render/RemotionRenderer.ts` throws clear error | Yellow | see motion-canvas-research.md |
| @remotion/cli | 4.0.445 | direct | SEE LICENSE IN LICENSE.md | remotion workflows / generated projects | **Red** | decide keep/cut |
| @remotion/renderer | 4.0.445 | direct | SEE LICENSE IN LICENSE.md | **Stubbed** — throws clear error, not functional | Yellow | see motion-canvas-research.md |
| @types/babel__traverse | 7.28.0 | direct | MIT | typings | Green | keep |
| @xenova/transformers | 2.17.2 | direct | Apache-2.0 | model/runtime support | Green | keep |
| archiver | 7.0.1 | direct | MIT | export/archive support | Green | keep |
| better-sqlite3 | 12.8.0 | direct | MIT | persistence | Green | keep |
| brace-expansion | 2.0.3 | direct | MIT | utility | Green | keep |
| clipboardy | 5.3.1 | direct | MIT | CLI UX | Green | keep |
| cookie-parser | 1.4.7 | direct | MIT | server utilities | Green | keep |
| csrf-csrf | 4.0.3 | direct | ISC | security/server | Green | keep |
| dotenv | 17.4.0 | direct | BSD-2-Clause | config | Green | keep |
| express | 5.2.1 | direct | MIT | server | Green | keep |
| express-rate-limit | 8.3.2 | direct | MIT | security/server | Green | keep |
| helmet | 8.1.0 | direct | MIT | security/server | Green | keep |
| ink | 5.2.1 | direct | MIT | TUI | Green | keep |
| lodash | 4.18.0 | direct | MIT | utility | Green | keep |
| neverthrow | 8.2.0 | direct | MIT | result types | Green | keep |
| open | 11.0.0 | direct | MIT | local OS integration | Green | keep |
| p5 | 1.11.12 | direct | LGPL-2.1 | wrappers/previews/generative p5 workflows | **Green** | keep - compliance review complete, see `docs/legal/p5-compliance-posture.md` |
| path-to-regexp | 8.4.0 | direct | MIT | routing/util | Green | keep |
| picomatch | 4.0.4 | direct | MIT | matching/util | Green | keep |
| puppeteer | 24.40.0 | direct | Apache-2.0 | browser rendering/testing | Green | keep |
| react | 18.3.1 | direct | MIT | UI/remotion | Green | keep |
| react-dom | 18.3.1 | direct | MIT | UI/remotion | Green | keep |
| remark | 15.0.1 | direct | MIT | markdown | Green | keep |
| remark-parse | 11.0.0 | direct | MIT | markdown | Green | keep |
| remotion | 4.0.445 | direct | SEE LICENSE IN LICENSE.md | remotion generation/rendering | **Red** | decide keep/cut |
| simple-git | 3.33.0 | direct | MIT | git integration | Green | keep |
| tsx | 4.21.0 | direct | MIT | ts runtime tooling | Green | keep |
| unified | 11.0.5 | direct | MIT | markdown pipeline | Green | keep |
| zod | 4.3.6 | direct | MIT | validation | Green | keep |

## Optional dependencies

| Package | Version | Kind | License | Current use / notes | Risk | Decision status |
|---|---:|---|---|---|---|---|
| meyda | 5.6.3 | optional | MIT | audio analysis | Green | keep |
| music-metadata | 11.12.3 | optional | MIT | media metadata/audio | Green | keep |
| pitchfinder | — | **removed** | — | **Replaced** with in-repo autocorrelation in `src/audio/PitchDetector.ts` | Green | **Done** |
| sharp | 0.34.5 | optional | Apache-2.0 | image processing | Green | keep |
| @revideo/core | ^0.5.0 | optional | MIT | Video generation via Revideo (Motion Canvas fork) | Green | added as alternative |

## Immediate follow-ups
1. ~~Remove or replace `pitchfinder`~~ — **Done: replaced with in-repo autocorrelation (2026-04-09)**
2. ~~Decide whether Remotion ships in v1~~ — **Done: cut from active surface, stubbed (2026-04-09)**. See `docs/motion-canvas-research.md`
3. Write a compliance posture for `p5`
4. Expand this file with transitive packages that carry yellow/red risk
