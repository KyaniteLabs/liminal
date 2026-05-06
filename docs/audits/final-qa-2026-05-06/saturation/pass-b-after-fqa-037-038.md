# Saturation Pass B After FQA-037/FQA-038

Date: 2026-05-06

Personas: Nate B. Jones, Alex Hormozi, Andy Warhol, David Isler, Liz the Developer

Scope: Customer Fury and Agentic Reality pass over public launch/security docs, Studio-facing trust claims, GUI security behavior, docs-to-proof wiring, and launch-claim truth.

Result: one new material finding, FQA-039.

Finding:
- `docs/SECURITY.md` claimed all HTTP responses include CSP, `X-Frame-Options: DENY`, nosniff, HSTS, and Referrer-Policy.
- `gui/server.js` Studio preview and SSE/API routes had route-specific headers instead.
- `test/security/security-headers.test.ts` proved the stronger `PreviewServer` path, not the Studio GUI path.
- `docs/launch/feature-claim-ledger-2026-05-06.md` did not yet include `docs/SECURITY.md` as an audited public claim surface.

Remediation:
- Added Studio common security headers in `gui/server.js`: nosniff, no-referrer, HSTS, and `X-Frame-Options: SAMEORIGIN`.
- Kept Studio `/preview` same-origin iframe compatible, and added `frame-ancestors 'self'` to the preview CSP.
- Rewrote `docs/SECURITY.md` to distinguish `PreviewServer`, Studio GUI/API/SSE, and Studio `/preview`.
- Added `docs/SECURITY.md` to the feature claim ledger and locked the route-specific claim in regression tests.

Verification:
- `node --check gui/server.js`
- `pnpm vitest run test/integration/gui-security-regression.test.js test/security/security-headers.test.ts test/unit/launch-claim-ledger.test.ts --coverage=false --reporter=dot` passed 40/40.

Saturation implication: because this pass found a material issue, saturation is not achieved. Two fresh independent passes are required after FQA-039.
