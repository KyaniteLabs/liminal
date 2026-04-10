# Third-Party Notices

_Initial draft generated from live repo/package state on 2026-04-09._

This product includes third-party software components. This file is a working draft for launch/compliance review and should be finalized before public commercial distribution.

## High-priority review items

### Remotion family
- Packages:
  - `remotion`
  - `@remotion/bundler`
  - `@remotion/cli`
  - `@remotion/renderer`
- Installed package metadata: `SEE LICENSE IN LICENSE.md`
- Notes:
  - These packages are actively referenced by the current codebase.
  - Commercial/license terms must be reviewed before launch.

### p5.js
- Package: `p5`
- Version: `1.9.0` (runtime CDN), `1.11.12` (npm types)
- License: **LGPL-2.1** (GNU Lesser General Public License v2.1)
- Copyright: p5.js contributors
- Usage:
  - Loaded dynamically via CDN in generated HTML wrappers and previews
  - Not modified, not bundled into distributed code
  - See `docs/legal/p5-compliance-posture.md` for full compliance analysis
- Source: https://github.com/processing/p5.js
- License text: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html
- Notes:
  - p5.js is used as a runtime library for executing user-generated creative coding sketches.
  - The application generates HTML that loads p5.js from CDN (cdnjs.cloudflare.com).
  - This is equivalent to dynamic linking under LGPL terms.
  - No proprietary code is combined with p5.js source.
  - Compliance posture: LOW RISK for proprietary launch.

### pitchfinder
- Package: `pitchfinder`
- Version: `2.3.4`
- Installed package metadata: `GNU v3`
- Notes:
  - Currently listed under `optionalDependencies`
  - Lazy-required by `src/audio/PitchExtractor.ts`
  - Planned disposition: replace or remove from launch-critical feature set

## Core permissive packages

The following first-order packages currently appear to use commercially routine permissive licenses:

### MIT
- `@babel/parser`
- `@babel/traverse`
- `@babel/types`
- `archiver`
- `better-sqlite3`
- `brace-expansion`
- `clipboardy`
- `cookie-parser`
- `express`
- `express-rate-limit`
- `helmet`
- `ink`
- `lodash`
- `neverthrow`
- `open`
- `path-to-regexp`
- `picomatch`
- `react`
- `react-dom`
- `remark`
- `remark-parse`
- `simple-git`
- `tsx`
- `unified`
- `zod`
- `meyda`
- `music-metadata`

### Apache-2.0
- `@xenova/transformers`
- `puppeteer`
- `sharp`

### Other permissive
- `dotenv` — `BSD-2-Clause`
- `csrf-csrf` — `ISC`

## Status
- This file is **not yet a final legal notice bundle**
- It should be reconciled with:
  - `docs/legal/dependency-inventory.md`
  - transitive dependency review
  - final counsel guidance
