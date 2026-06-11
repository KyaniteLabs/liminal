# Fable Watchman Log

## 2026-06-11T14:17:39Z
- Cycles seen: 31 (`2026-06-10T08:37:42.965Z` through `2026-06-11T14:09:30.114Z`).
- Completion rate: 70/89 (78.7%); archive 78 -> 169 (+91); health 84.3 -> 84.4; mean score 0.698; last-five mean 0.441.
- Failures diagnosed: repeated ASCII validation failures at 10:51, 13:00, and 14:09 UTC (`U+25C8`, `U+25E1`, `U+25C9`, `U+25AE`). Current head had ASCII generator sanitation, but revised candidates can bypass generator formatting and reach `CodeValidator` directly. Single Hydra proof too-dark failure at 14:09 UTC was not repeated in this watch window.
- Archive check: measured 52 recent visual entries with the F19 production screenshot style; 45 ok, 2 high-score p5 too-dark admissions, 2 hydra washout/fog hits, 3 hydra render timeouts. Recorded `FAB-023`; no archive mutation.
- Action taken: validation-entry ASCII sanitation fix in `CodeValidator` plus finding `FAB-023`.
- Next watch item: confirm post-fix cycles have zero ASCII invalid-character failures; track high-score p5 too-dark admissions and Hydra proof brightness failures without reopening closed `FAB-019`..`FAB-022`.
