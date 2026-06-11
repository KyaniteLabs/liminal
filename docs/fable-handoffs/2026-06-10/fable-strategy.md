# Fable Strategy — 2026-06-10

## What is actually wrong (ranked by leverage)

1. **The source of truth has no automated gate.** Forgejo is primary (Simon, this session); all CI lives in `.github/workflows/` and runs only on the GitHub mirror. Until Forgejo CI lands, every merge rests on local verification + agent review. This is acknowledged infra-in-progress, but it is the single point where one improvement prevents the most future failures: the coverage ratchet, test-quality checker, and orphan gate are the repo's accumulated immune system, and they are currently disconnected from the merge path.
2. **"Merged" and "live" are different states for the self-improvement loop, and the project only tracks the first.** FAB-009: F7 (taste auto-feed, #698) was register-FIXED for ~8 hours while the running daemon executed the pre-merge loop body. Found only because this session demanded runtime evidence (log greps, file mtimes, a manual train run) instead of trusting the register. Any component with a long-running process (daemon, cortex, gardener) can silently be on old code.
3. **Docs truth decays at every migration.** Rebrand (June 7) left intentional back-compat; the forge migration (today) left misleading gate docs (truth matrix, README badge, AGENTS.md). The pattern: infrastructure decisions happen in chat/ops, and the docs that agents *actually consult before making claims* lag by days.
4. The remaining investor-audit items (F5, F10, F19, F20, F12/#637) are well-understood, well-scoped worker tasks — not strategic problems.

## What the repo is trying to become

A self-improving creative studio whose keystone claim — *the system learns without a human in the loop* — became true today in the narrow sense: archive 113→127 in one day, hourly cycles completing at mean scores 0.81–0.94, and (post-restart) hourly taste training from the evaluator's own score ordering (244 pairs, zero human events). The strategic job now is protecting that loop's *integrity* (gates, liveness evidence) rather than adding more loop.

## Highest-leverage architecture moves

1. **Forge CI minimum viable gate** (when infra is ready): port `build-and-test` essentials — install, typecheck, lint, `test:ci:fast` + coverage ratchet, `test:quality`. The ratchet config is already repo-local (`vitest.config.ts`), so this is runner plumbing, not redesign.
2. **Liveness evidence for long-running loops:** each daemon cycle should log the script SHA + dist build stamp it is executing, into the ledger line it already writes. Then "is the merged fix live?" becomes a one-grep question instead of a forensic investigation. (Small; pairs with Handoff 03's re-exec guardrail.)
3. **Consolidate the render-measurement lane (#637):** F12 (hydra washout), F19 (p5 contrast), F16 (composite washout — gate already shipped in #694) all converge on measured-render scoring. Treat them as one lane, not three findings.

## Dynamic workflows/loops to install

- Daemon self-re-exec on script change (Handoff 03) — closes the merged-vs-live gap mechanically.
- Review-agent-as-gate during the CI gap (Handoff 01 is the template: inspect-only, command-reproducing, verdict format).
- Docs-truth sync as a standing migration checklist item: any remote/infra/branding change must touch `test-ci-truth-matrix`, README badges, AGENTS.md in the same change unit (Handoff 02 does the catch-up).

## What to stop doing

- Babysitting GitHub PRs/checks — GitHub is a mirror; PR #699's closure was the system working, not a failure.
- Re-attempting generation-side fixes for washout/SVG presentation (settled root causes; memory rules exist).
- Treating register "FIXED" rows as runtime truth without a liveness check for loop components.

## What to delegate (queue, in priority order)

1. Handoff 01 — code review of F4 (merge gate for the open forge branch).
2. Handoff 02 — forge-era docs truth sync + register closeout.
3. Handoff 03 — daemon staleness guardrail.
4. Handoff 04 — F5 sing MP4 render (or honest relabel).
5. Handoff 05 — F10 revideo render grading.

F20 (TuiBridgeService 3.6k LOC split) stays parked until the above clear; it is architecture-lane work that deserves a design pass first.
