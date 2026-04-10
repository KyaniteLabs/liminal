# p5.js Compliance Posture

Date: 2026-04-09
Package: p5.js
Version: 1.9.0 (CDN), 1.11.12 (npm)
License: LGPL-2.1
Status: COMPLIANT

## 1. How p5.js is Used

Runtime: Loaded dynamically via CDN
CDN: cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js
Files: P5Wrapper.ts, generateHTML.ts, P5Adapter.ts, SandboxRunner.ts
npm package: Used primarily for TypeScript definitions at build time; runtime uses CDN

## 2. Is p5.js Modified?

NO. No source modifications, forks, or bundling.

## 3. Bundled vs CDN-Loaded

CDN-loaded: PRIMARY
Bundled: No
npm: Types only
CDN loading represents a low-risk posture similar to dynamic linking.

## 4. Provenance Review

Generated examples are LLM-generated original works.
No p5.js tutorial/reference content copied.

## 5. Required Notices

Copyright: p5.js contributors, LGPL-2.1
License: gnu.org/licenses/old-licenses/lgpl-2.1.html
Source: github.com/processing/p5.js

## 6. Risk Assessment

License: LGPL-2.1
Usage: Dynamic CDN - lowest risk
Modification: None
Risk: LOW

## 7. Launch Readiness

READY for proprietary launch. No changes needed.

## 8. Files Reviewed

P5Wrapper.ts, generateHTML.ts, P5Adapter.ts, SandboxRunner.ts
gui/server.js, constants.ts, prompts/p5.ts, P5GeneratorV2.ts
plugins/p5/index.ts, landing-assets/, package.json
