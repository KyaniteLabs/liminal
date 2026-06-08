# 🗿 Sinter Launch Masterplan — Set In Stone

> **Canonical launch reference.** Every worker reads this before starting a lane.
> Owner: Orchestrator. Established 2026-06-08 at `main @ 01b4f451`.
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
| 2 | Creative Body maturity | a CORE set (Simon: **all** domains) each pass a headless **gauntlet** in CI; rest labeled beta | ⬜ |
| 3 | SI – accumulation | regression-locked | 🟢 |
| 4 | SI – **actually improving** | vision-audit **trend log** over ≥10 cron cycles shows rising quality, main-agent-graded (anti-Goodhart) | 🟡 cron live |
| 5 | Evaluator | `evaluator` role reachable; real run returns **non-degraded** confidence; cron runs on it | 🟢 (GLM) |
| 6 | Output quality | vision audit: **0 broken gens**, 0 too-dark in core set, **no seam / no washout** | 🟡 seam fixed (#619) |
| 7 | Surfaces (Studio/TUI) | e2e UX smoke (brief→generate→preview→revise→cancel→confirm) + ≥1 **real-user** alpha session | ⬜ |
| 8 | Release trust | clean package install + startup smoke + graceful failure messages + **no plaintext secrets** | ⬜ |
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

| Worker | Branch | Lane task |
|--------|--------|-----------|
| C | `fix/gallery-broken-work-gate` | broken-gen gate (in flight) → then color-codegen bug → #9 core debt |
| U | `fix/composition-screen-blend-washout` | M2 washout fix |
| K | `feat/domain-gauntlets` | M3 per-domain gauntlet + true-state audit |
| G | `feat/release-trust-smoke` | M4 startup/install smoke + failure-message audit |
| Orch | — | #4 vision trend, secrets, merges, package.json/CI wiring |

## 6. Orchestrator cadence & doctrine

Monitor all branches → on each PR: **CI-green + in-lane assert + verify** → Orchestrator does the **vision grading** → squash-merge → prune → Green-Board delta. Escalate only true Simon-calls (secrets policy, core-domain lock, real-user timing, NUCBOX).

Hard rules (full doctrine in `docs/agent-law/orchestrator-handoff.md`): branch→PR→squash→prune; never commit to main; karpathy (simplest sufficient, surgical, verification-first); integration-first; test-quality (concrete assertions, vi.hoisted, error paths, ≥2-module integration tests); NEVER-used prompts for any generation; **vision grading only in the Orchestrator**; **NO fake fallbacks** (honest degraded scoring; clean failure messages, never masked success).

## 7. Open escalations (Simon-owned)

- **NUCBOX evaluator** — `tailscaled` offline 12h (`tx/rx` one-way); restart at the box (`sudo systemctl restart tailscaled && sudo tailscale up`). Then the Orchestrator can repoint `evaluator` back to qwen if preferred over GLM.
- **Secrets** — `~/.sinter/config.json` holds plaintext API keys; must be hardened before public launch (part of #8).
- **Core-domain lock (#2)** — Simon chose "all"; final lock decision per-domain depends on K's gauntlet results.
- **Real-user alpha (#6/#7)** — needs Simon's testers.
