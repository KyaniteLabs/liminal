# Findings Ledger

New findings from this audit only. Prefix: `FCQA-`.

Status values: `new` | `confirmed` | `duplicate` | `non-material` | `fixed` | `verified` | `accepted-risk`

Material launch blockers may not remain `accepted-risk` unless fixing them would require changing the product promise.

Prior `FQA-*` findings from [docs/audits/final-qa-2026-05-06/](../final-qa-2026-05-06/) remain closed unless current execution disproves them.

---

## Open Findings

### FCQA-001 — Actual timeout-expiry recourse not validated

- **Status:** new
- **Severity:** material validation gap
- **Evidence:** `operator-journey-matrix.md` records countdown/budget visibility during a slow generation, but the run did not exceed the timeout budget.
- **Why it matters:** The expected launch behavior is post-timeout user recourse (retry/cancel/actionable error), which can regress independently of countdown visibility.
- **Required verification:** Force or configure a generation to exceed its timeout, then record the resulting user-visible timeout message and recourse path.

### FCQA-002 — Real provider disconnect handling not validated

- **Status:** new
- **Severity:** material validation gap
- **Evidence:** `operator-journey-matrix.md` records an empty-code/model-output failure, not a transport/provider disconnect while generation is active.
- **Why it matters:** A provider disconnect can fail through different code paths than an empty response and may expose blank, hanging, or non-actionable UX.
- **Required verification:** Disconnect, kill, or otherwise make the active provider unreachable mid-generation, then record the user-visible error and recourse path.

## Closed Findings

_None yet._
