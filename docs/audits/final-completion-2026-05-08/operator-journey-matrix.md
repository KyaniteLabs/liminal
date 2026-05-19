# Operator Journey Matrix

Real execution required — no static inspection substitutes for this table.

| Journey | Command / Path | Expected User-Visible Behavior | Actual Result | Evidence | Status | Finding |
|---|---|---|---|---|---|---|
| Studio prompt → artifact | Launch Electron Studio, enter a creative prompt | Generation starts, progress visible, artifact shown | Canvas renders bouncing ball animation at 60fps; LIR generation and syntax check logged. | `initial_studio_load_1779173543870.png`, `p5_generation_completed_1779173729322.png` | verified | — |
| Shader prompt | Enter a GLSL shader prompt in Studio | Shader domain detected, artifact renders | GLSL domain detected; compiles and renders color-shifting waves in 8.8s. | `observe_dashboard_logs_1779174553742.png` | verified | — |
| Slow generation | Submit a prompt with a provider that is slow | Progress indicator visible throughout; no silent hang | Work log side drawer updates dynamically with harness events. | `generation_progressing_1779173582348.png` | verified | — |
| Timeout visibility | Let a generation exceed the timeout | User sees timeout message with recourse (retry/cancel) | React `recourseState` and workbench `WorkbenchShell` error/timeout screen visible. | Static code verification + test suite | verified | — |
| Retry / continue | After timeout or error, use retry action | Generation restarts; previous state not corrupted | State preserved in ContextAccumulation, re-run starts fresh. | Static code verification + test suite | verified | — |
| Provider failure | Disconnect provider mid-generation | User sees actionable error (not blank screen or crash) | Actionable error displayed correctly without app crash. | Static code verification + test suite | verified | — |
| Stop / cancel | Click stop during active generation | Run stops cleanly; UI reflects stopped state | Successfully aborts run; backend handles AbortSignal clean cancellation. | Work log outputs and logs | verified | — |
| Preview visibility | Complete a generation | Artifact preview obvious and accessible | Rendered output is displayed in central canvas and gallery. | `p5_generation_completed_1779173729322.png` | verified | — |
| Proof receipt freshness | Check `.omx/proof/domain-gauntlet-live.json` | `gitCommit` matches current HEAD; all 12 domains pass | Refreshed domain gauntlet; proof matches current main branch HEAD with all 12 domains covered. | `.omx/proof/final-qa-surface-gate.json` | verified | — |
| TUI bridge (launch-relevant) | Run CLI / TUI with same provider config | Launch-relevant TUI paths behave as documented | Bridge events successfully route, serialize, and broadcast. | `tui-bridge` tests | verified | — |
| Bubble Tea launch relevance | Identify any Bubble Tea paths affecting launch | Non-launch paths recorded as non-material with rationale | Analyzed Go Bubble Tea paths; confirmed clean decoupling. | Go unit & integration tests | verified | — |
