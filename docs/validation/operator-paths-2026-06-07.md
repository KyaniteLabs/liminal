# Sinter Operator-Path Validation — 2026-06-07 (end-to-end, real LLM)

Goal: validate the **entire** application end-to-end through **actual execution** — every operator path, with **real LLM calls** — and repair what's broken. Run against `main` (post Liminal→Sinter rebrand, post compose-gallery #597) with live providers.

**Live providers (real):** `glm` (active, `glm-5v-turbo` @ z.ai) · `minimax` (`MiniMax-M3`) · `openai` · `ollama` · `lmstudio` all ready. Evaluator role points at a local NUCBOX box (`qwen3.6-35b @ 100.113.174.74:4000`) which was **powered off** during this run (HTTP 000) — Sinter degraded gracefully; the scoring path was proven separately against a reachable evaluator.

Legend: ✅ verified by execution · 🔧 defect found+fixed · ⚙️ by-design exit.

## Defects found by execution & fixed (6)

1. 🔧 **Market readiness check broken by rename** — `src/market/MarketReadinessStatus.ts` read `bin/liminal` (renamed to `bin/sinter`) and searched for the token `liminal "natural language prompt"` (now `sinter`). The natural-CLI check failed against an empty file. Fixed both → `market status` now **READY** (all 7 checks pass).
2. 🔧 **`serve` gallery API always empty** — `sinter serve` constructed `new PreviewServer()` with no `galleryDir`, so `/api/gallery` short-circuited to `{projects:[]}` for *all* works (generations + compositions). Wired it to `cwd/gallery`. Verified: `/api/gallery` now lists 17 projects incl. the composition; `/api/gallery/<project>` returns the composition iteration.
3. 🔧 **`--gallery` flag dead** — the override was referenced by `compose`/`serve` but never parsed. Added it to the flag parser.
4. 🔧 **Go TUI bridge env var** — `bubbletea/main.go` read only `LIMINAL_BRIDGE_URL`; the Node env-mirror can't reach a separate Go process. Now reads `SINTER_BRIDGE_URL` first with `LIMINAL_BRIDGE_URL` fallback; `bin/sinter` hint + `tui` spawn updated. Rebuilt + Go tests pass.
5. 🔧 **`Liminal ` brand strings (38 files) incl. the `Liminal` class + 2 broken checks** — the phase-1.5 brand sweep covered `src/docs/gui` but not `scripts/`/`electron/`/`plugins/`. Swept `Liminal `→`Sinter `. This also fixed two **functionally broken** checks: `git-ci-install.mjs` grepped version output for `Liminal v` (now `Sinter v`); `smoke-composition-examples.mjs` required the composite HTML to contain `Liminal Composition` (orchestrator emits `Sinter Composition`). The unused public `Liminal` class → `Sinter` with a deprecated back-compat alias.
6. 🔧 **`LIMINAL` all-caps brand banners (11 files)** — TUI logos ("◆ LIMINAL", "LIMINAL CHAT", "LIMINAL TUI v2.0") etc. Swept `\bLIMINAL\b`→`SINTER` (does not touch `LIMINAL_` env vars).

Final residual brand scan across all code dirs: **0** non-intentional `liminal/Liminal/LIMINAL`. Intentionally preserved: `LIMINAL_*` env mirror, `~/.liminal`→`~/.sinter` migration, `liminal.json`/`atelier.json` config fallbacks, the `Liminal` deprecated alias, the repo dir + Go module path (`Pastorsimon1798/liminal`), and the internal `window.__liminalAudio`/`__liminalLayers` runtime-sensor globals (consistent contract; renaming would break already-generated gallery artifacts — same infra-name rationale as the repo dir).

## Real-LLM execution proofs

| Path | Status | Evidence |
|---|---|---|
| **`--prompt` core loop** (generate) | ✅ | real p5 artifact via `glm-5v-turbo` (`cli-project-final.{js,html,zip}`); graceful degraded scoring (0.76) because the NUCBOX evaluator was offline |
| **dual-model scoring** (generate, evaluator→GLM) | ✅ | with a reachable evaluator: **"excellent quality achieved (score 0.95 ≥ 0.90, code complete)"** — config temporarily repointed then **restored exactly** |
| **`compose`** (layered composition) | ✅ | novel prompt → MiniMax-M3 decomposed into 4 layers → **4/4 generated via GLM** (three 4930c, shader 8081c, p5 8733c, strudel 249c) → standalone HTML (46KB, 4 `sinter-layer` iframes) |
| **compose → gallery** (#597 feature) | ✅ | saved `gallery/2026-06-07--tundra-aurora-resonance/v1.js` (`type:composition`, layers `[three,shader,p5,strudel]`); surfaced by `serve` `/api/gallery` round-trip |
| **`proof:live-creative-domains`** | ✅ | **all 12 domains generated real artifacts via GLM** (p5, svg, glsl, three, hydra, strudel, tone, revideo, hyperframes, ascii, kinetic, textgen) — verified real code in each file; receipt 12/12 |
| **`proof:live-provider-smoke`** | ✅ | "Live provider smoke pass: glm/GLM-5v-turbo"; fresh receipt bound to current commit (unblocked the release gate) |
| **`proof:live-model-assimilation`** | ✅ | live candidate audition; per-role/domain promote/hold decisions vs baseline |
| **`demo creative-codex`** | ✅ | 8-step scenario completed (garden→challenges→taste→dream→self-improve→quality), exit 0 |

## Servers / surfaces

| Path | Status | Evidence |
|---|---|---|
| **`serve`** | ✅ | HTTP 200 on `/` and `/api/gallery`; gallery API lists works (after fix #2) |
| **`studio`** | ✅ | GUI :5173, API :5174, `/api/health` 200, `/api/gallery` 200 |
| **`bridge`** | ✅ | TUI bridge listening, `/health` 200, GLM wired; hint shows `SINTER_BRIDGE_URL` (after fix #4) |
| **`chat`** | ⚙️ | launches (TUI readline, owner/TTY-gated for a full turn) |
| **`tui` / Go bubbletea** | ✅ | `go build` + `go test ./...` pass; bridge env precedence verified |

## Gauntlets / structural

| Path | Status | Evidence |
|---|---|---|
| `domains gauntlet` | ✅ | **12/12 PASS** (routing/impl/verification/preservation; `liveExecution:false` — live coverage via `proof:live-creative-domains`) |
| `self-improve gauntlet` | ✅ | **6/6 PASS** (prompt-to-action, no-proof-drift, domain-preservation, cognitive-organs, model-assimilation, checkpoint-resume) |
| `market status` | ✅ | **READY** — 7/7 checks (after fixes #1, #5 + fresh live-provider receipt) |
| `composite --spec` | ✅ | analyzes layer plan (`[video→p5] confidence=0.75`); the legacy Compositor format (`layer.type`) |
| `emergence score`/`probe` | ✅ | Emergence Scorecard / Perturbation Resilience 0.672 |

## Quick operator paths (executed, exit 0 unless ⚙️ by-design)

`--version` · `--help` · `provider status`/`list` · `list` · `report cognition` · `git status` · `compost status`/`seeds` · `ledger status`/`list` · `archive list` · `preferences stats`/`export` · `improve scan` · `model audition auto --dry-run` · `garden status` · `fs artifacts` · `consolidate` — all ✅.
By-design non-zero (proper messages, not crashes): `market status` (NOT/READY) · `release gate` (not-level-6) · `ship garden` (NOT READY 33%) · `dream run` (archive empty) · `taste train` (need ≥2) · `composite`/`quality gate`/`live-music`/`emergence`/`fs`/`garden` bare (usage requiring args).

## Niche paths exercised

| Path | Status | Evidence |
|---|---|---|
| `fix "<desc>" --dry-run` | ✅ | real LLM; "Fix completed successfully! Build passed: true, Tests passed: true" (dry-run, 0 writes) |
| `quality run --spec <suite>` | ⚠️ runs, stub generation | executes a golden suite (2 cases) but `GoldenSuiteRunner` scores **placeholder candidate code** (`// Generated for: <prompt>`), not real generation — its own source notes "In production, you'd generate". Pre-existing incomplete implementation (not a rename regression); flagged, not fixed (wiring real generation is a feature, out of scope for this verification pass). |

Not exercised (require owner/TTY or specific external state): `chat` full turn (TTY readline), `tui` interactive Go UI (build+bridge proven), `site evolve` (living-site offshoot), `operator`.

## Toolchain

✅ `pnpm build` (tsc) 0 errors · ✅ `sing:build`/`sing:typecheck` 0 · ✅ Go `build`+`test ./...` ok · ✅ full suite `test:ci:fast` **10828 passed** — only the 4 known pre-existing/environmental failures (`sandbox.test.ts` ×3 flaky, `proof-llm-server.test.js` ×1 needs a local LLM at :1234).
