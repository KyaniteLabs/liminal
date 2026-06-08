# 🗿 Sinter Launch Masterplan — Set In Stone

> **Canonical launch reference.** Every worker reads this before starting a lane.
> Owner: Orchestrator. Established 2026-06-08 at `main @ 01b4f451`.
> Updated 2026-06-08 16:38 PDT after the domain-wave orchestration stint:
> `main @ a08f4523`; PRs #627-#633 merged; 0 open PRs.
> This file defines *what "launched" means*, *who owns which files*, and *how the
> work converges*. Lanes map to **directories** so multiple workers run in
> parallel with zero file collisions.

---

## 1. Definition of Done

**Launch = all 9 Green-Board categories green.**
Launch gate = **M1–M4 + M7 green · M5 showing a credible upward trend · M6 alpha-tested by real users.**

### The Green Board

| # | Category | Green-gate (measurable "done") | Status @ establish |
|---|----------|--------------------------------|--------------------|
| 1 | Generation engine | operator-path real-LLM verification re-runs green | 🟢 |
| 2 | Creative Body maturity | a CORE set (Simon: **all** domains) each pass a headless **gauntlet** in CI; rest labeled beta | 🟡 ratchet green for expected domains; full all-12 lock still needs SVG/Kinetic follow-up + human vision audit |
| 3 | SI – accumulation | regression-locked | 🟢 |
| 4 | SI – **actually improving** | vision-audit **trend log** over ≥10 cron cycles shows rising quality, main-agent-graded (anti-Goodhart) | 🟡 cron live |
| 5 | Evaluator | `evaluator` role reachable; real run returns **non-degraded** confidence; cron runs on it | 🟢 (GLM) |
| 6 | Output quality | vision audit: **0 broken gens**, 0 too-dark in core set, **no seam / no washout** | 🟡 seam fixed (#619); GLSL/Hydra/Three/HTML visual failures materially improved (#629, #633) |
| 7 | Surfaces (Studio/TUI) | e2e UX smoke (brief→generate→preview→revise→cancel→confirm) + ≥1 **real-user** alpha session | ⬜ |
| 8 | Release trust | clean package install + startup smoke + graceful failure messages + **no plaintext secrets** | 🟡 provider-routing/proof-server fixes landed (#628, #630); secrets hardening still open |
| 9 | Eng hygiene | 11 HIGH design-debt closed; coverage ≥70 all metrics; 0 hygiene violations | ⬜ |

---

## 2. Standing Lane Ownership (the stone)

Lanes are **directories**. A worker edits ONLY its lane; the Orchestrator owns shared seams.

| Worker | Lane | Owns | Never touches |
|--------|------|------|---------------|
| **C — Codex** | Core & Generation | `src/core/*` (CodeValidator/validators), `src/generators/*`, codegen | composition, scripts/*, bin startup |
| **U — Ultracode Claude** | Composition & Visual Quality | `src/composition/*` | core, generators, scripts/*, bin |
| **K — Kimi** | Domain Reliability & Testing | `scripts/domains/*`, integration tests | src/*, bin, package.json |
| **G — Gemini Flash** | Release Trust & DX | `scripts/release/*`, `docs/launch/*`, `bin/sinter` top-level errors | src/*, scripts/domains, package.json |
| **Orchestrator** | Glue & Proof | `package.json`/CI wiring, `~/.sinter` config + **secrets**, vision audits + #4 trend, merges, escalations | — |

---

## 3. Milestones → owners

- **M1 Foundations** (#1 engine, #3 accumulation, #5 evaluator) — ✅ **DONE** (evaluator repointed→GLM, cron live).
- **M2 Quality** (#6) — seam ✅ (#619) · broken-gen gate **(C)** · screen-blend washout **(U)** · `[object Arguments]` color-codegen **(C, next)**.
- **M3 Reliability** (#2, all domains) — gauntlets **(K)** → reveal true per-domain state → fix lanes for failures.
- **M4 Trust** (#8) — release/install/startup smoke **(G)** · secrets hardening **(Orchestrator/C)**.
- **M5 Proof** (#4) — cron live; **Orchestrator** runs periodic vision audits + trend log. *Long pole; accrues over days in background.*
- **M6 Surfaces** (#7) — Studio/TUI e2e smoke (later lane) + **real users (Simon)**.
- **M7 Polish** (#9) — design-debt HIGHs (distributed to C + idle workers).

## 4. Critical path

```
M1 ✅ ──► M2 (C+U) ─┐
          M3 (K) ───┼─ parallel, dir-disjoint ──► merge ──► M7 ──► M6 (needs Simon) ──► LAUNCH
          M4 (G) ───┘
M5 (#4 cron + vision trend) runs in background the whole time — the slow gate
```

## 5. Active dispatch (2026-06-08)

Current live state at 2026-06-08 16:38 PDT: **0 open PRs**. The domain-wave PR stack landed through #633.

| Worker | Branch/PR | Lane result |
|--------|-----------|-------------|
| Orchestrator | #627 | persistent domain-wave handoff/runbook landed |
| C / provider routing | #628, #630 | role/provider routing and runtime endpoint override fixes landed |
| U / visual quality | #629 | GLSL/Hydra/Three M3 visual-quality fixes landed |
| G / ratchet | #631 | TextGen validator + gauntlet ratchet + proof-model CI wrapper landed |
| Kinetic lane | #632 | Kinetic validator landed |
| V / visual render stabilization | #633 | Hydra full-frame render, Three brightness guard, HTML inline-script validation landed |

Next dispatch should be Wave 2, not more Wave 1 merging:

| Priority | Lane task | Owner suggestion |
|----------|-----------|------------------|
| 1 | Make `pnpm domain:ratchet:ci` and `node scripts/domains/gauntlet.mjs --all` honest for **all 12 printed rows**, not only expected domains | Orchestrator/G |
| 2 | SVG intermittent `generate timed out after 120000ms` after empty-tool-loop retry | generator/provider lane |
| 3 | Kinetic recovery still prints invalid HTML in ratchet even after #632 | kinetic generator lane |
| 4 | Human/vision audit of the 12 latest domain artifacts; mark weak-but-passing domains for aesthetic depth | Orchestrator + Simon |
| 5 | Resume #7 Surfaces, #8 secrets hardening, #9 design debt, and M5 trend audits | distribute after domain lock |

## 6. Orchestrator cadence & doctrine

Monitor all branches → on each PR: **CI-green + in-lane assert + verify** → Orchestrator does the **vision grading** → squash-merge → prune → Green-Board delta. Escalate only true Simon-calls (secrets policy, core-domain lock, real-user timing, NUCBOX).

Hard rules (full doctrine in `docs/agent-law/orchestrator-handoff.md`): branch→PR→squash→prune; never commit to main; karpathy (simplest sufficient, surgical, verification-first); integration-first; test-quality (concrete assertions, vi.hoisted, error paths, ≥2-module integration tests); NEVER-used prompts for any generation; **vision grading only in the Orchestrator**; **NO fake fallbacks** (honest degraded scoring; clean failure messages, never masked success).

## 7. Open escalations (Simon-owned)

- **NUCBOX evaluator** — `tailscaled` offline 12h (`tx/rx` one-way); restart at the box (`sudo systemctl restart tailscaled && sudo tailscale up`). Then the Orchestrator can repoint `evaluator` back to qwen if preferred over GLM.
- **Secrets** — `~/.sinter/config.json` holds plaintext API keys; must be hardened before public launch (part of #8).
- **Core-domain lock (#2)** — Simon chose "all"; final lock decision per-domain depends on K's gauntlet results.
- **Real-user alpha (#6/#7)** — needs Simon's testers.
