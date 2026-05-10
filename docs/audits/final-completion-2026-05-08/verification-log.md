# Verification Log

Every command run during this audit. Format per entry:

```
Date:    <ISO date>
Commit:  <git sha>
Command: <exact command>
Exit:    <0 or non-zero>
Result:  <one-line summary>
Links:   <PR URL or proof file path if applicable>
```

---

## 2026-05-07

### PR 1 — Strict test-quality gate

```
Date:    2026-05-07
Commit:  366d1c5062714cd321f9d42c5501c270b8bbc5e0
Command: pnpm vitest run test/unit/core/ScoringEngine.test.ts test/unit/generators/registerGenerators.test.ts --coverage=false
Exit:    0
Result:  120 tests passed
Links:   https://github.com/KyaniteLabs/liminal/pull/525
```

```
Date:    2026-05-07
Commit:  366d1c5062714cd321f9d42c5501c270b8bbc5e0
Command: pnpm final-qa:test-quality
Exit:    0
Result:  All test quality checks passed (0 new warnings)
Links:   https://github.com/KyaniteLabs/liminal/pull/525
```

```
Date:    2026-05-07
Commit:  366d1c5062714cd321f9d42c5501c270b8bbc5e0
Command: pnpm typecheck
Exit:    0
Result:  Clean
Links:   https://github.com/KyaniteLabs/liminal/pull/525
```

### Gate and static analysis pass (2026-05-07/08, commits 366d1c50–5cf647c8)

```
Date:    2026-05-07
Commit:  1c7d07b6 (audit-docs branch)
Command: pnpm check:script-targets
Exit:    0
Result:  Package script target check passed
Links:   —
```

```
Date:    2026-05-07
Commit:  1c7d07b6
Command: pnpm check:orphans
Exit:    0
Result:  No orphaned files found
Links:   —
```

```
Date:    2026-05-07
Commit:  1c7d07b6
Command: pnpm build
Exit:    0
Result:  TypeScript compilation clean
Links:   —
```

```
Date:    2026-05-07
Commit:  366d1c5062714cd321f9d42c5501c270b8bbc5e0
Command: pnpm final-qa:surface
Exit:    1
Result:  BLOCKED — stale proof receipt (resolved by PR #529)
Links:   —
```

### PR 2 — Live creative-domain proof refresh

```
Date:    2026-05-08
Commit:  5cf647c8353d3444fe95288e5957d9a021400021
Command: pnpm proof:live-creative-domains -- --timeout-ms=180000
Exit:    0
Result:  12/12 domains pass via glm/GLM-5v-turbo
Links:   https://github.com/KyaniteLabs/liminal/pull/529
```

```
Date:    2026-05-08
Commit:  5cf647c8
Command: pnpm final-qa:surface
Exit:    0
Result:  Clean — proof receipt commit matches HEAD
Links:   https://github.com/KyaniteLabs/liminal/pull/529
```

```
Date:    2026-05-08
Commit:  5cf647c8
Command: pnpm qa:creative-domains:static
Exit:    0
Result:  Static QA cockpit bundle written, 12/12 domains covered
Links:   https://github.com/KyaniteLabs/liminal/pull/529
```

### Full gate pass (2026-05-08, live-domain-proof branch)

```
Date:    2026-05-08
Commit:  8abc1ff6 (live-domain-proof branch)
Command: pnpm gui:build
Exit:    0
Result:  Electron GUI production build clean
Links:   —
```

```
Date:    2026-05-08
Commit:  8abc1ff6
Command: pnpm bubbletea:test
Exit:    0
Result:  Go tests pass (internal/app, internal/bridge)
Links:   —
```

```
Date:    2026-05-08
Commit:  8abc1ff6
Command: pnpm verify:integration
Exit:    0
Result:  Integration verification clean
Links:   —
```

```
Date:    2026-05-08
Commit:  8abc1ff6
Command: pnpm test:e2e
Exit:    0
Result:  E2E suite clean
Links:   —
```

```
Date:    2026-05-08
Commit:  8abc1ff6
Command: pnpm test:ci:slow
Exit:    0
Result:  Slow CI suite clean
Links:   —
```

### Static analysis (2026-05-07, commit 366d1c50)

Areas checked via `rg`:
- Empty catch blocks: all intentional (abort-controller loop, cleanup fs ops, JSON parse fallbacks in GUI)
- Skipped tests: all `skipIf(condition)` with env-var guards; no unguarded `.skip()`
- Hardcoded stale commits: none found in source
- Timeout paths: `createModes.ts` + `cockpitDerivation.ts` expose timeout to UI; comment confirms recourse requirement
- Recovery paths: `WorkbenchShell.tsx` has explicit `recourseState`, stop button, and user-facing messages
- Provider fallback: `LLMClient.ts` fallback chain is explicit; no silent swallowing detected

No material FCQA findings from static pass.

---

### Operator journey pass (2026-05-08, Electron Studio + computer-use)

Provider: glm/GLM-5v-turbo (Studio restarted with updated local provider config).
Initial run used lmstudio/repo-pipeline-qwen35-q8-prod for slow-generation and stop/cancel observations.

```
Date:    2026-05-08
Command: Electron Studio — "a GLSL fragment shader: plasma waves with electric neon colors, animated over time"
Exit:    0 (generation completed)
Result:  Plasma shader rendered in ~18s (PLAN 3ms, GENERATE 13s, RENDER 3.9s). All 5 pipeline stages green.
Links:   operator-journey-matrix.md
```

```
Date:    2026-05-08
Command: Electron Studio — Stop button during active lmstudio generation
Exit:    0
Result:  Generation stopped cleanly. "Generation stopped by operator." READY stage: "stopped by operator". Recourse shown.
Links:   operator-journey-matrix.md
```

```
Date:    2026-05-08
Command: Electron Studio — "Try again" after stop; "Switch medium" (glsl→p5)
Exit:    0
Result:  Retry fired server-side (log: shader tool loop retried). Switch medium reformulated prompt. State preserved.
Links:   operator-journey-matrix.md
```

```
Date:    2026-05-08
Command: node bin/liminal --help && node bin/liminal provider status
Exit:    0
Result:  CLI runs cleanly. Full TUI/bridge command set exposed. Config reads from local provider config.
Links:   operator-journey-matrix.md
```

```
Date:    2026-05-08
Command: pnpm bubbletea:test (re-run for journey evidence)
Exit:    0
Result:  ok internal/app (cached), ok internal/bridge (cached). No launch-affecting paths.
Links:   operator-journey-matrix.md
```

**Operator journey result: 8 PASS, 2 NOT VALIDATED, 1 NON-MATERIAL (Bubble Tea). FCQA-001 tracks actual timeout-expiry recourse; FCQA-002 tracks real provider disconnect handling.**
