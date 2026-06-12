# Fable Watchman Log

## 2026-06-11T14:17:39Z
- Cycles seen: 31 (`2026-06-10T08:37:42.965Z` through `2026-06-11T14:09:30.114Z`).
- Completion rate: 70/89 (78.7%); archive 78 -> 169 (+91); health 84.3 -> 84.4; mean score 0.698; last-five mean 0.441.
- Failures diagnosed: repeated ASCII validation failures at 10:51, 13:00, and 14:09 UTC (`U+25C8`, `U+25E1`, `U+25C9`, `U+25AE`). Current head had ASCII generator sanitation, but revised candidates can bypass generator formatting and reach `CodeValidator` directly. Single Hydra proof too-dark failure at 14:09 UTC was not repeated in this watch window.
- Archive check: measured 52 recent visual entries with the F19 production screenshot style; 45 ok, 2 high-score p5 too-dark admissions, 2 hydra washout/fog hits, 3 hydra render timeouts. Recorded `FAB-023`; no archive mutation.
- Action taken: validation-entry ASCII sanitation fix in `CodeValidator` plus finding `FAB-023`.
- Next watch item: confirm post-fix cycles have zero ASCII invalid-character failures; track high-score p5 too-dark admissions and Hydra proof brightness failures without reopening closed `FAB-019`..`FAB-022`.

## 2026-06-12T05:22:00Z
- Cycles seen: 29 (`2026-06-11T15:15:24.581Z` through `2026-06-12T04:58:20.206Z`).
- Completion rate: 64/87 (73.6%); archive 169 -> 200 (+31); health 84.4 -> 84.4; mean score 0.676; last-five cycle means 0.750, 0.583, 0.817, 0.850, 0.820.
- Failures diagnosed: 21 total. Breakdown: 10 `All generation candidates failed`, 7 SVG bounded direct-attempt failures (`SVG output must...` / provider invalid), 2 kinetic HTML mismatch validation retries, 1 Hydra proof too-dark failure, 1 kinetic LLM timeout. The repeated classes do not have a safe <=30-line deterministic fix from the available log evidence; the broad `All generation candidates failed` bucket needs sharper per-candidate naming before a causal fix.
- Render-infra check: exact `0.68` clumped 3x during the known FAB-028 window (`2026-06-11T22:33:15.981Z`, `22:55:14.591Z`, `23:17:48.072Z`). A live HeadlessRenderer p5 probe produced a screenshot in 4820ms with no current infra failure; no browser reinstall or daemon restart.
- Archive check: measured 41 archive entries created after the previous watch window with the F19-style rendered-pixel path; 23 ok, 3 washout, 15 too-dark, 0 render failures. Recorded `FAB-029` for SVG black-frame admissions plus Hydra washouts; textgen too-dark hits are noted as calibration-sensitive. No archive mutation.
- Action taken: finding `FAB-029`; no code change.
- Next watch item: prioritize SVG black-frame admissions (`svg_8f6582e5`, `svg_2b3e0a57`, `svg_08a9a9fe`) and repeated SVG bounded-attempt failures; keep watching for any new post-FAB-028 `0.68` clumps.

## 2026-06-12T07:20:38Z
- Cycles seen: 4 (`2026-06-12T05:24:32.551Z` through `2026-06-12T06:46:53.287Z`).
- Completion rate: 9/12 (75.0%); archive 200 -> 200 (+0); health 84.4 -> 84.3; mean score 0.731; cycle means 0.680, 0.693, 0.800, 0.750.
- Failures diagnosed: 3 total. Breakdown: 1 SVG bounded direct-attempt failure at 05:24 UTC (`SVG output must...`) and 2 `All generation candidates failed` at 06:19 and 06:46 UTC. The repeated class is the broad candidate-exhaustion bucket; the daemon evidence did not name a deterministic validator, prompt-contract, or timeout cause, so no <=30-line fix was safe.
- Render-infra check: exact `0.68` clumped 2x in the 05:24 UTC cycle (kinetic + hydra). A live HeadlessRenderer p5 probe produced screenshot and late screenshot in 3029ms with `infraUnavailable:false`; no browser reinstall and no daemon restart.
- Archive check: archive delta stayed 0 across completed rows; no new admissions needed F19-style measurement and no finding was appended.
- Action taken: watchman log only; no code change and no finding.
- Next watch item: keep watching broad candidate-exhaustion until per-candidate `lastError` or generator/domain evidence makes it fixable; also check the in-progress 07:15 UTC cycle after it lands for renewed `0.68` or `infra` symptoms.

## 2026-06-12T11:27:09Z
- Cycles seen: 8 (`2026-06-12T07:41:45.609Z` through `2026-06-12T10:54:07.621Z`; the `07:15:46.595Z` cycle predates the previous watchman entry and is not double-counted).
- Completion rate: 7/24 (29.2%); archive 200 -> 200 (+0); health 84.3 -> 84.3; completed-cycle mean score 0.720.
- Failures diagnosed: 17 generation failures across the window.
  - 4 Kinetic HTML head-balance failures: validation retry reported `HTML document has mismatched <head> tags` (07:41, 08:09, 08:57) or single-round repair failed with the same mismatch (09:27).
  - 5 SVG bounded direct-attempt failures: `SVGGenerator: provider returned no valid SVG after 2 bounded direct attempts` (08:09, 08:57, 09:27, 09:59, 10:29). The log truncates the validator detail, so a deterministic prompt/validator fix is not available from this evidence.
  - 4 broad `All generation candidates failed` buckets (07:41 third target, 09:27 second target, 10:29 first target, 10:54 third target). Per-candidate `lastError` is not yet named in the log; the bucket needs sharper instrumentation before a causal fix.
  - 1 RalphLoop high-priority ambiguity rejection: pronoun "that" flagged as missing_context (10:54 second target).
  - 1 provider rate-limit stop: `RATE-LIMITED — stopping cycle early` at 08:36, aborting the remaining 2 generation slots.
- Render-infra check: no exact `0.68` score clumps in this window (last known clump was 05:24 UTC in the previous window). A live HeadlessRenderer textgen probe scored 0.78 with `failureClass:none`; no browser cache reinstall or daemon restart.
- Archive check: archive delta stayed 0 across all 8 cycles; no new admissions required F19-style measurement and no finding was appended.
- Action taken: implemented a ≤30-line deterministic fix for the repeated Kinetic `<head>` mismatch class in `src/generators/kinetic/KineticGenerator.ts` (inject missing `</head>` before `<body>` and add a minimal `<head>` when absent), with regression tests in `test/unit/generators/KineticGenerator.test.ts`. Committed as `96824bc6`. No finding appended because no archive admissions occurred.
- Merge hygiene: local `main` was behind Forgejo `origin/main` by 9 commits (PRs #30-#33) at the start of the pass. After stashing pre-existing uncommitted codex/rubric-climbing changes, `origin/main` was merged into `main` and the Kinetic fix was pushed. The stashed changes were restored after the push so no work was lost.
- Next watch item: confirm the Kinetic head-mismatch class disappears in the next cycles; continue watching SVG bounded-attempt failures for a reproducible validator/prompt cause; monitor for renewed `0.68` clumps or `infra` failureClass; if rate-limit stops repeat, consider a bounded backoff policy.
