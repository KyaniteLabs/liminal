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

### p5
- Package: `p5`
- Version: `1.11.12`
- Installed package metadata: `LGPL-2.1`
- Notes:
  - Used in wrappers/previews and part of the product story.
  - Requires explicit compliance review before packaged/commercial launch.

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
