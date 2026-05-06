# ML Feature Value Matrix

Marketing rule: only `proven` features can be claimed as working product value without an experimental qualifier.

Current launch-truth source: `docs/launch/feature-claim-ledger-2026-05-06.md`.

Receipt rule from final QA: a passing proof command is not enough for a broad launch claim unless the receipt is fresh, commit-bound, provider-identified when live providers are involved, and wide enough for the claim being made. FQA-004 is verified for release gate receipt validation; release candidates still need fresh receipts generated on the release commit.

Public-demo disposition: demo-mitigated. The UI and proof receipts may show experimental ML labels, but the recording must not narrate experimental features as proven product value.

| Feature | Launch Label | Baseline | Enabled Behavior | Metric | Proof |
| --- | --- | --- | --- | --- | --- |
| Taste learning | experimental | creative ranking without preference replay | preference replay and taste alignment | agreement beats baseline | `pnpm test -- TasteModelRuntime PreferenceDatasetBuilder` |
| Emergence garden | experimental | manual gallery curation | garden cycles and archive recombination | novelty and archive-health lift | `pnpm test -- Phase16AutonomousGardener EmergenceAutonomy` |
| Compost | experimental | discarded fragments | fragment digestion and soup replay | reused fragments producing valid outputs | `pnpm test -- CompostMill` |
| Routing | proven | single provider path | role/domain-aware routing | successful route selection with provider labels | `pnpm test -- ModelRouter RoutingData` |
| Aesthetic guardrails | experimental | validator-only generation | aesthetic scoring and guardrails | quality gate catches low-score outputs | `pnpm test -- GuardrailSystem CreativeEvaluator` |
| Failure pattern detection | proven | one-off failure logs | clustered failure patterns | recurring patterns produce repair advice | `pnpm test -- FailureLogger PatternDetector` |
| Prompt enhancement | experimental | raw prompt | domain-aware prompt enhancement | validated prompt contract output | `pnpm test -- prompt-enhancer prompt-validation` |

Any feature without a proof command and metric is `hidden`.
