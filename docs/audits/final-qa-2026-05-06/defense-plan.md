# Defense Plan

Status: final defense plan for future agents.

## Agent Operating Rules

- Do not mark launch readiness from one passing root command. Map the exact claim to the exact proof.
- Treat public docs as product surface. A stale public claim is a customer-facing bug.
- Treat proof scripts as product code. A broken proof script is release-blocking if any claim depends on it.
- Treat any proof receipt that is not bound to the current commit as suspect, even if every artifact path exists.
- Treat non-empty artifact files as insufficient proof. Domain artifacts need structural validation and, for visual/audio/video claims, the deeper preview or human-senses proof where applicable.
- Treat empty successful model output as suspicious until the event stream proves content, error state, and provider provenance.
- Treat fallback success as degraded unless the fallback path produces explicit evidence.
- Treat visual proof as false until decoded pixels show meaningful nonblank output.
- Treat cancellation as incomplete until provider work, draft timeout controllers, and retry sleeps actually abort.
- Treat branch protection and CI as live infrastructure, not repo intent. Read the remote state before claiming enforcement.
- Treat public launch docs as mutable evidence, not a one-time fix; re-scan them after remediation commits because old blocker language can become false.
- Treat broken local docs links as customer-facing trust failures and gate them in CI.
- Treat blanket security-header claims as suspect; verify each public header claim against the exact server surface and iframe/product constraints.

## Review Prompts For Future Persona Clusters

- Customer Fury: "What will make a first-time user feel tricked, stuck, or embarrassed for trusting the docs?"
- Codecraft: "Which types, scripts, examples, or tests pass locally but fail for a real consumer?"
- AI Systems: "Where can model/evaluator/proof failures masquerade as confidence?"
- Production Flow: "Which checks are advisory but described as enforced, and which failures disappear from operators?"
- Agentic Reality: "Where do demos, docs, persona stories, or receipts imply machinery that is not actually wired?"

## Durable Defenses

- Keep `findings-ledger.md` alive until every material row is `verified`.
- Require remediation commits to mention the finding ID they close.
- Add regression tests before or with each fix.
- Keep stop/cancel regressions close to the UI, bridge timeout, provider call, and retry-sleep boundaries instead of relying on one broad smoke.
- Rerun saturation only after fixes land, not while known material issues are open.
- Preserve audit artifacts under `docs/audits/final-qa-2026-05-06/` so future agents can compare pass-to-pass deltas.
