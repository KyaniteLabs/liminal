# Diagnose & Fix Campaign — Handoff for the Remaining Tasks

> Written 2026-06-13 after the high-value phases landed. This is a **self-contained**
> handoff: a fresh agent should be able to finish the campaign from this doc alone.
> Master plan: `docs/fable-handoffs/2026-06-12/diagnose-and-fix-plan.md` (ralplan-approved).
> Live memory: `~/.claude/projects/.../memory/diagnose-fix-campaign-2026-06-12.md`.

Repo: `~/workspaces/liminal` (product = **Sinter**). Forgejo (`git.kyanitelabs.tech`) is the
source of truth; **main is branch-protected** — everything lands via branch → PR → merge.

---

## HARD RULES (non-negotiable)

1. **Model constraint (Simon):** NO Anthropic, NO Codex for the work. Generation + evaluation
   already run on GLM / MiniMax (compliant). If you delegate implementation, use a
   **non-Anthropic CLI worker** via `pnpm dispatch:worker -w <worktree> -p <prompt-file>`
   (kimi, Moonshot). The orchestrator (you) may write fixes directly — Simon approved that.
2. **Daemon safety:** `com.sinter.self-improve` runs the **root worktree on `main`** and rebuilds
   `dist` when HEAD moves. **NEVER checkout a feature branch in the root worktree** — always
   `git worktree add` an isolated copy off `origin/main`. `pnpm install` each new worktree.
3. **Forge PR recipe** (token never printed):
   ```
   TOKEN=$(printf 'protocol=https\nhost=git.kyanitelabs.tech\n\n' | git credential fill | awk -F= '/^password=/{print $2}')
   PR=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" \
     https://git.kyanitelabs.tech/api/v1/repos/KyaniteLabs/liminal/pulls \
     -d '{"head":"<branch>","base":"main","title":"...","body":"..."}' | python3 -c "import json,sys; print(json.load(sys.stdin)['number'])")
   curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" \
     "https://git.kyanitelabs.tech/api/v1/repos/KyaniteLabs/liminal/pulls/$PR/merge" -d '{"Do":"merge"}'
   ```
   After merge: `git worktree remove <path> --force`, delete the branch, `git -C <root> pull --ff-only origin main`.
4. **Verify before claiming done:** `pnpm exec tsc --noEmit` + the focused `vitest` suite + (for
   generation fixes) a seeded `pnpm reliability:probe --domain <d> --n 10`. Never weaken a gate.
5. **Novel prompts only** in any generation test (the LLM cache returns stale artifacts for reused prompts).
6. **kimi-cli dispatch gotchas** (if delegating): always `--mcp-config-file /tmp/empty-mcp.json`
   (`{"mcpServers":{}}`) or it hangs on MCP load; the worker process is named **"Kimi Code"** not
   "kimi-cli" (don't pgrep by "kimi-cli"); wait on the launched PID, never a self-matching pgrep.

---

## DONE (do NOT redo)

| Area | Result | PR |
|---|---|---|
| Phase 0 | Reliability instrumentation (`classifyFailure`, `failureClasses` ledger field, `pnpm reliability:probe`, `pnpm quality:failures`) + baseline | #52, #54 |
| Phase 1 | All 4 generation-failure classes fixed: glsl undefined-fn (prelude inject), textgen empty-after-strip (preserve non-reasoning text), svg truncation (maxTokens 4000), kinetic truncation (maxTokens 4000/4500) | #57, #58, #60, #64 |
| Instrumentation | `candidate_pool_empty` masking fixed — RalphLoop now surfaces the specific inner failure reason in the error message | #63 |
| Phase 2 D1+D2 | `qualityHealth` axis (mean elite quality, non-saturating) + StagnationDetector rewired to use it; archive-size signal gated on room-to-grow. Loop no longer falsely flags stagnation at a full archive | #67 |
| Phase 4.C | Music phantom-domain quarantine (`readPerDomainCounts` skips untracked-empty domains) | #66 |
| Empower | `pnpm dispatch:worker` (safe kimi dispatch); watchman now branch+PRs instead of diverging main | #59, #62 |

Verification of Phase 1 is via `pnpm reliability:probe` (svg/kinetic went ~0% → near-100%) and the
daemon's `pnpm quality:failures` (glsl_undefined_fn / empty_after_strip now absent; svg_no_raw ≈ 0).

---

## REMAINING TASKS (prioritized; each with the root cause already found)

### 1. Phase 5 — Remove the Go TUI  *(tractable, mechanical, ~10 files; GATE PASSED)*
ADR `docs/adr/0005-tui-maintenance-mode.md` gate is met (GUI Review pin/reject parity shipped, PR #30).
**KEEP `src/tui-bridge/**` — `TuiBridgeServer` backs the user-surface launch-proof gates
(`scripts/proof/user-surface-*.ts`, `mic-preview-browser-smoke.ts`) AND the GUI.** Removable set:
- `bubbletea/` (25 Go files, the cockpit)
- `src/tui/InteractiveMode.*` (the `tui` command's TS impl; imported at `bin/sinter:778`)
- `bin/sinter` commands `tui` (`cmd === 'tui'` ~line 1587) and `bubbletea` (+ their `--help` lines ~395-399)
- `scripts/start-bubbletea-tui.mjs`, `scripts/proof/record-tui-session.sh`, `scripts/proof/automated-bridge-session.ts`
- `package.json` scripts: `tui`, `tui:bridge`, `bubbletea:test`, `tui:ink` (check `tui:ink`/`ink-tui-compat` separately)
- Update ADR 0005 status to "TUI removed".
**Verify:** `pnpm build`, `pnpm typecheck`, run the user-surface proof scripts (they must still pass —
that's why TuiBridgeServer stays), `bin/sinter --help` clean, GUI smoke. Grep for any lingering
`bubbletea` / `start-bubbletea` / `InteractiveMode` references after deletion.

### 2. Phase 3.E — Composition diagnostic  *(verification, low risk, costs 3 composite gens)*
`CompositionOrchestrator.composeFromPrompt` is wired at `bin/sinter:1453`; LayerContract (#619) and
CompositeRenderGate (#43/#694) landed. Run 3 **novel** multi-domain prompts through it, grade the
composite renders (luminance + seam, like `pnpm quality:render-gallery`), commit receipts to
`docs/validation/`. If a seam/washout class appears, it's generation-side layer-contract territory
(per the LayerContract saga) → spawn a sub-plan, don't promise an in-PR fix.

### 3. Phase 4.G2 — Rescore cadence  *(small; note the weekly inference cost)*
`pnpm quality:rescore` (read-only) exists but is never scheduled. Add a weekly cadence (launchd plist
or cron) that writes a dated report to `docs/validation/` and does NOT mutate the archive. ~16 GLM
calls/week — acceptable but state it.

### 4. Phase 4.G1 — Per-domain generator routing  *(needs data first)*
Only `three → MiniMax-M3` is routed today (`self-improve-cycle.mjs:129`). Extend the pattern to other
domains ONLY where the judge-calibration matrix shows a better generator (see memory
`prompt-tiering-and-judge-calibration`). Don't guess — get the per-domain-winner evidence first.

### 5. Kinetic `</head>` intermittent  *(probe already in place)*
The maxTokens raise (#64) fixed kinetic truncation, but there's a rare second mode: a COMPLETE doc
that omits `</head>` and `normalizeKineticHtml` (`src/generators/kinetic/KineticGenerator.ts:243-263`)
fails to add it. A gated `KINETIC_DIAGNOSE` probe is in place — run kinetic gens with
`KINETIC_DIAGNOSE=1` until one fails; the log (`headOpen/headClose/bodyOpen/hasCloseHtml`) pinpoints
which normalization branch misses (suspect: no `<body>` tag, so the `</head>`-before-`<body>` insert
no-ops and the `</html>` fallback should fire — check why it doesn't).

---

## DEEPER FINDINGS — need a decision or a dedicated investigation (do NOT blind-fix)

### A. Phase 2 D3 — Dream queue is permanently empty (`+0 new`)  *(ARCHITECTURAL)*
Root cause (verified, NOT the queue dedup): the **emergence / MAP-Elites archive is starved**.
`garden tend` reads `hooks.getArchive().getAllCells()` (the emergence QD archive, SEPARATE from the
200-entry QualityArchive). It returns ~217 niches but `<2` occupied elites, so `DreamPlanner.plan`
returns 0 tasks (the `entries.length < 2` guard at `src/dreaming/DreamPlanner.ts:53`) and garden-tend
health reads **10%** (vs the QualityArchive's 84%). **The live generation loop populates the
QualityArchive but NOT the emergence archive** — so the entire emergence/dreaming/recombination layer
is dark. Fixing = wire generation outputs into the emergence archive; this touches the core loop and
is risky. **Surface to Simon before doing it.** (A dedup tweak in `bin/sinter` garden-tend was tried
and discarded — it is NOT the cause, and deduping completed dreams is arguably correct once dreams flow.)

### B. Phase 2 D4 — Human taste inlet  *(not a bug)*
The `/taste` pin/reject mechanism exists (#30) but has 0 events — a usage gap, not a wiring gap.
The taste model trains hourly via judge-distillation. No code change; just document / use it.

### C. Phase 3.B — Hydra quality  *(known-intractable generation-side)*
Per memory `hydra-washout-root-cause`: generation-side clamps crush good runs; the cure is
render-measurement, already landed. Don't re-attempt a generation-side fix. Treat as a measurement/
craft-contract task only if the daemon shows a regression.

### D. G3 — Kinetic re-normalization  *(SIMON'S DECISION)*
Kinetic floor is sealed at 0.85. Re-normalizing it is a taste/threshold call for Simon, not an
agent task. Surface the data; await his call.

---

## TOOLING REFERENCE
- `pnpm reliability:probe --domain <d> --n <N>` — seeded generator-path pass-rate (no archive mutation). The Phase-1 gate.
- `pnpm quality:failures --all` — failure-class trend from the daemon ledger (now accurate after #63).
- `pnpm quality:rescore` / `:floors` — read-only re-score of archive tops/floors.
- `pnpm dispatch:worker` — safe non-Anthropic CLI worker dispatch.
- Gated diagnostics already in source (env-gated, zero cost off): `SVG_DIAGNOSE`, `KINETIC_DIAGNOSE`.

## SUGGESTED ORDER
1. Phase 5 TUI removal (clean win, gate passed) → 2. Phase 3.E composition diagnostic →
3. Phase 4.G2 rescore cadence → 4. surface D3 (emergence) + G3 (kinetic renorm) to Simon →
5. Phase 4.G1 routing once you have the calibration data.
