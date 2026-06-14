# Zero-Debt Campaign — Handoff (2026-06-14)

State after the audit → triple-check → Tier-0 execution. Drives the remaining work to
"zero integration debt + zero technical debt." Verified register:
`docs/validation/organism-audit-triplecheck-2026-06-14.md` (+ `organism-audit-2026-06-13.md`).

## Done

- **Audit + triple-check** merged (PR #90). 56-Opus verification: of 19 prior HIGH findings,
  12 confirmed (all downgraded MED/LOW — dead code is real but unreachable), 5 partial, 2
  refuted (L3, G4). **179 new findings → ~40 unique**, 6 systemic patterns.
- **Tier 0 (3 of 4)** — PR #91 (`fix/tier0-debt`):
  - 0.4 / E1 — `BaseProvider.withTimeout`: provider timeout always bounds the call (15 sites). Kills the multi-minute stall class.
  - 0.2 / E2,E3 — `src/utils/atomicWrite.ts`: tmp+rename for every JSON-state writer; guarded SinterFS reads.
  - 0.3 / H1,H2 — `src/core/fitnessHonesty.ts`: archive admits only honest scores (confidence>0 ∧ failureClass∈{none,render}); degraded scores marked in LoopResult + bin/sinter.

## Next: Tier 0.1 — Domain consolidation (the deferred quarter) — **do this first, carefully**

The "L"-effort, highest-regression-risk item, deliberately NOT rushed into the Tier-0 PR.
**9 incompatible `Domain` definitions** (canonical `src/types/domains.ts:5` has GLSL/SHADER/WEBGL
+ TONE/MUSIC; `RoutingData` uses a disjoint union; `BehaviorVectors` uses `glsl` where others use
`shader`; typo `REVIEWD='revideo'` propagated to 8 sites). Root cause of ~6 downstream findings
(D3/D4/D7 + the routing keyspace mismatch + behavior-vector zeroing). Plan: one source of truth,
collapse synonyms via a **total mapping** (not duplication), replace `as`-casts. Reserve the domain-type
files for this PR (the overnight watchman is told to avoid them). Dedicated PR, full test sweep.

## Tier 1 — close live feed-forward loops (some need YOUR decision)

| Item | Effort | Decision? |
|---|---|---|
| **1.1 Routing bandit** (B1/G2/G3) — WIRE (`getOptimalModelBandit` into dispatch + persist + record real model/domain) **or DELETE** the bandit+recorder | M | **Yes — wire vs delete** |
| **1.2 IntuitionEngine** (B2) — hoist one persisted instance **or** remove `--intuition` | M | **Yes** |
| 1.3 MetaHarness wrong-model (B4) — drop the `providerFields` spread; `new LLMClient({role:'harness'})` so the harness runs on MiniMax not GLM | S | No |
| 1.4 MetaHarness insight + aesthetic-hint feed-forward (B3/B5) — consume `thinking-analysis`; route hints via `ContextAccumulation` | M | No |
| 1.5 EmergenceHooks silent catch → `Logger.warn` (B6) | S | No |
| 1.6 Autonomous loop consumes AestheticCritic + GuidanceEngine + novelty (B7/B8/B11) — pass `--aesthetic`, build GuidanceEngine in `run()`, persistent noveltyArchive | M | No |
| 1.7 Live-music arg fix + strudel `pattern` misroute (D1/D2) | S | No |

## Tier 2 — security + reliability

2.1 Deny-by-default network in renderers + JS-domain security screen + route through `getChromeArgs` (F1/F3/F4) · 2.2 decide `runInSandbox`/`ImportValidator` fate (**decision**) · 2.3 init-race + reentrancy guards, embedding batch, interval unref (E4/E5/E6/E7) · 2.4 engagement sensorium repair-vs-defer (**decision**).

## Tier 3 — retire/rehome dead subsystems (one batch PR per group; **mostly YOUR decisions**)

3.1 Guardrails framework (~5k LOC inert) ADOPT vs RETIRE · 3.2 music theory engines + ArtKnowledgeGraph + brain modules wire vs rehome · 3.3 model-assimilation + promotion/rollback + fabricated proofs (H3-H7) implement real gates vs relabel fixture-only + tighten Level-6/`market status` to receipt-backed · 3.4 plugins compile-to-dist vs delete (9 fail to load every cold start) · 3.5 config-system consolidation + swarm provider injection + orphan batch.

## Overnight autonomy

`com.sinter.fable-watchman` (launchd, ~every 2h: 22:15/00:15/02:15/04:15) runs a bounded `kimi`
pass on `scripts/quality/watchman-prompt.md`. Reconfigured this session to: keep its daemon-diagnosis
role, and — only when no daemon failure needs it — advance the campaign with ONE strictly-eligible
fix per pass (≤30 lines, no decision, test-first, not touching the Tier-0 or domain-type files),
filing handoffs for anything bigger or decision-gated. **It will NOT do 0.1, the wire-vs-delete /
retire-vs-rehome decisions, or the security work** — those are for a supervised session.

**Honest scope note:** "finish everything overnight" is not achievable unsupervised — the campaign
has ~40 defects, several gated on Simon's product decisions and one large refactor (0.1). The watchman
makes safe incremental progress; the judgment-heavy remainder is queued here for a human.
