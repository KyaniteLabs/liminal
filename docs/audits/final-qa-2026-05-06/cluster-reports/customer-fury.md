# Customer Fury Cluster Report

Personas: Nate B. Jones, Alex Hormozi, Andy Warhol

Lens: customer anger, value clarity, product potency, public promise mismatch, product weirdness, missed wow.

Status: first-pass white-box review complete. This cluster found release-blocking public-surface and promise-to-proof mismatches.

## Findings

### CF-001: Market readiness can report ready from narrower evidence than the public claim

- Severity: P1
- Material: yes
- Evidence: `README.md:59`, `README.md:88`, `src/market/MarketReadinessStatus.ts:33`, `src/market/MarketReadinessStatus.ts:70`, `src/market/LiveProviderSmokeReceipt.ts:40`
- Failure mode: `liminal market status` can report READY from static checks plus a narrow p5 live-provider receipt while public copy implies broader product readiness.
- Customer impact: launch claim dishonesty and angry evaluators who trust the readiness language.
- Recommended proof: map every readiness label to a required command and receipt with freshness, commit, provider, and artifact checks.

### CF-002: Public feature docs mark systems complete while launch truth files still caveat them

- Severity: P1
- Material: yes
- Evidence: `docs/features.html:36`, `docs/features.html:127`, `docs/launch/ml-feature-value-matrix.md:3`, `docs/launch/skipped-test-ledger.md:9`, `docs/launch/launch-candidate-2026-04-30.md:45`
- Failure mode: public-facing docs state stronger completion than the launch matrix and skipped-test ledger support.
- Customer impact: users see a product promise that the repo itself does not prove.
- Recommended proof: public claim ledger where each feature claim points to a current command or live smoke.

### CF-003: Provider setup copy and CLI help expose stale provider expectations

- Severity: P1
- Material: yes
- Evidence: `README.md:10`, `README.md:68`, `README.md:117`, `bin/liminal:194`, `bin/liminal:512`, `src/harness/MultiProviderConfig.ts:4`
- Failure mode: README promises broad provider freedom, but CLI configure/help and env diagnostics still teach old provider names and incomplete `--base-url` setup.
- Customer impact: first-run setup fails or sends users down the wrong provider path.
- Recommended proof: credential-free setup smoke across documented provider labels and env diagnostics.

### CF-004: Stop control is hidden during the moment users need it most

- Severity: P2
- Material: yes
- Evidence: `docs/USER_SURFACE_CONTRACT.md:21`, `gui/src/components/WorkbenchShell.tsx:239`, `gui/src/App.tsx:1023`, `gui/src/gui/createModes.ts:78`
- Failure mode: stop/cancel exists, but the visible control can be buried in collapsed details or inspector state while a run is active.
- Customer impact: a stuck or slow generation feels uncontrollable.
- Recommended proof: browser/UI smoke that starts a slow run and asserts a visible, enabled stop affordance.

### CF-005: Revideo/video/timeline intent is advertised but not detected

- Severity: P2
- Material: yes
- Evidence: `README.md:61`, `README.md:88`, `README.md:105`, `docs/USER_SURFACE_CONTRACT.md:26`, `gui/src/gui/createModes.ts:26`
- Failure mode: public copy offers Revideo/video outputs, but intent detection does not recognize common user terms like `revideo`, `video`, or `timeline`.
- Customer impact: users ask for a promised output and get routed to the wrong experience.
- Recommended proof: natural-language routing tests for common video prompts.

### CF-006: Route performance proof command is broken

- Severity: P2
- Material: yes
- Evidence: `package.json:69`, `docs/audits/final-qa-2026-05-06/verification/pnpm-proof-route-performance.log`
- Failure mode: `pnpm proof:route-performance` points to a missing `scripts/proof/route-performance-budget.ts` file.
- Customer impact: the repo claims a proof gate that cannot run.
- Recommended proof: package-script target integrity check plus real route performance command execution.

### CF-007: First-time user guide still teaches internal harness-era flows

- Severity: P2
- Material: yes
- Evidence: `docs/WHAT_TO_EXPECT.md:1`, `docs/WHAT_TO_EXPECT.md:42`, `docs/WHAT_TO_EXPECT.md:103`, `docs/USER_SURFACE_CONTRACT.md:1`
- Failure mode: docs aimed at new users still mention old `/run M1` style harness flows instead of the current Studio/workbench promise.
- Customer impact: first-time users learn the wrong product.
- Recommended proof: doc claim audit against current first-run CLI and Studio flows.

### CF-008: Image preview failures disappear instead of becoming visible errors

- Severity: P2
- Material: yes
- Evidence: `gui/src/App.tsx:906`, `gui/src/App.tsx:916`, `docs/USER_SURFACE_CONTRACT.md:36`
- Failure mode: image preview `onError` hides the image with `display:none`, giving no visible failure state.
- Customer impact: generated output appears missing with no explanation.
- Recommended proof: browser test with broken preview URL and visible recovery/error state assertion.

### CF-009: Live Music/Hydra copy contradicts launch-ready prompt-to-preview copy

- Severity: P3
- Material: no
- Evidence: `gui/src/App.tsx:305`, `docs/marketing/launch-thread-ready.md:11`, `docs/marketing/launch-thread-ready.md:48`
- Failure mode: product-side copy says preview disabled or coming soon while launch copy says prompt-to-preview.
- Customer impact: confusing, but not independently release-blocking once the stronger docs claim mismatch is fixed.
- Recommended proof: public copy review after feature-claim ledger is updated.
