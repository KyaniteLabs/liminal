# Operator Journey Matrix

Real execution required — no static inspection substitutes for this table.

| Journey | Command / Path | Expected User-Visible Behavior | Actual Result | Evidence | Status | Finding |
|---|---|---|---|---|---|---|
| Studio prompt → artifact | Launch Electron Studio, enter a creative prompt | Generation starts, progress visible, artifact shown | _not yet run_ | — | pending | — |
| Shader prompt | Enter a GLSL shader prompt in Studio | Shader domain detected, artifact renders | _not yet run_ | — | pending | — |
| Slow generation | Submit a prompt with a provider that is slow | Progress indicator visible throughout; no silent hang | _not yet run_ | — | pending | — |
| Timeout visibility | Let a generation exceed the timeout | User sees timeout message with recourse (retry/cancel) | _not yet run_ | — | pending | — |
| Retry / continue | After timeout or error, use retry action | Generation restarts; previous state not corrupted | _not yet run_ | — | pending | — |
| Provider failure | Disconnect provider mid-generation | User sees actionable error (not blank screen or crash) | _not yet run_ | — | pending | — |
| Stop / cancel | Click stop during active generation | Run stops cleanly; UI reflects stopped state | _not yet run_ | — | pending | — |
| Preview visibility | Complete a generation | Artifact preview obvious and accessible | _not yet run_ | — | pending | — |
| Proof receipt freshness | Check `.omx/proof/domain-gauntlet-live.json` | `gitCommit` matches current HEAD; all 12 domains pass | _blocked — credentials required_ | — | blocked | — |
| TUI bridge (launch-relevant) | Run CLI / TUI with same provider config | Launch-relevant TUI paths behave as documented | _not yet run_ | — | pending | — |
| Bubble Tea launch relevance | Identify any Bubble Tea paths affecting launch | Non-launch paths recorded as non-material with rationale | _not yet run_ | — | pending | — |
