# Liminal Operator-Path Validation — 2026-06-06

Goal: validate the **entire** application end-to-end through actual execution — every operator path — and repair what's broken until all pass. Validated against `main` (`b523e3ca`) with the GLM provider (reachable; the default). Network/generation commands run with the sandbox disabled.

Legend: ✅ verified by execution · 🔧 defect found+fixed · ⏳ pending · 🔒 owner-gated (browser/mic).

## Defects found & fixed
1. 🔧 **Evaluator unauthenticated (401)** — `roles.evaluator` pointed at `openrouter` with no API key → scoring fell back to legacy, quality capped 0.50, "evidence degraded." Fixed in `~/.liminal/config.json` (evaluator → GLM, which works). Verified: generation now scores 1.00 "excellent quality achieved." *(config fix, machine-local)*
2. 🔧 **`serve`/`studio` crash on launch** — `PreviewServer` threw `CSRF_SECRET environment variable is required`. Fixed in `src/render/PreviewServer.ts`: production still requires it; local dev gets an ephemeral random secret + warning. Verified: `serve` → HTTP 200 with no env. *(repo fix — commit a1a31536, PR pending)*

## Build / toolchain
- ✅ `pnpm build` (tsc) — clean, 0 errors
- ✅ `pnpm sing:build`, `sing:typecheck` — clean
- ✅ Go TUI: `bubbletea && go test ./...` — app + bridge tests `ok` (go 1.26)

## CLI operator paths
| Path | Status | Evidence |
|---|---|---|
| `--help`, `--version` | ✅ | usage / `Liminal v2.1.0` |
| `provider status` / `list` | ✅ | readiness table |
| `list` | ✅ | sketches list |
| `report cognition` | ✅ | cognitive architecture atlas |
| `git status` | ✅ | runs |
| `compost status` / `seeds` | ✅ | compost mill status |
| `ledger status` / `list` | ✅ | "No tasks found" |
| `archive list` | ✅ | "0 cells" |
| `preferences stats` / `export` | ✅ | stats / dataset export |
| `improve scan` | ✅ | self-healing harden report |
| `model audition auto --dry-run` | ✅ | audition report |
| `market status` / `readiness` | ✅ | "NOT READY" (exit 2 by design) |
| `quality gate` | ✅ | requires `--spec` (by design) |
| **`generate` / `--prompt` (core loop)** | ✅ | real p5 artifact, score 1.00, memory+compost+dream write-back fired |
| **`serve`** (preview server) | 🔧→✅ | HTTP 200 after CSRF fix |
| **`studio`** (GUI backend) | ✅ | backend on :5174, full API surface |
| `tui` / `bubbletea` (Go) | ✅ | go tests pass |
| **`domains gauntlet`** | ✅ | **12/12 domains PASS** (p5, GLSL, Three, SVG, Hydra, Strudel, Tone, Revideo, HyperFrames, ASCII, Kinetic, TextGen) |
| `consolidate` | ✅ | memory consolidation runs |
| `composite` | ✅ | requires `--spec` (by design) |
| `release gate` | ✅ | runs gate, reports not-ready (exit 1 by design) |
| Studio frontend (`gui:build`) | ✅ | React bundles clean (vite) |
| `chat` | ⏳ | piped prompt; LLM generation in flight |

## Findings (paths that need correct args or don't fully wire from a plain call)
- `garden status`, `emergence score`, `fs artifacts`/`refs`, `taste`, `dream` — a plain invocation falls through to the help banner (exit 1). Either they need specific flags or are partially wired; exact invocation TBD. **Not crashes**, but not verified-functional.
- `ship`, `demo` — ask to "configure LM Studio" instead of using the configured GLM default provider → likely don't honor `defaultProvider` (a config-routing gap).

## Pending (to validate by execution)
⏳ `improve run` · `self-improve gauntlet` · `fix <file>` · `model audition <model>` (live) · `dream run` · `garden`/`emergence`/`taste`/`fs` (correct args) · `site evolve` · `live-music` · `bridge` · `operator` · `quality run` (needs `--spec`)

🔒 Owner-gated visual/audio: Studio GUI in-browser, Sing instrument (mic + COOP/COEP) — server/build paths verified here; visual/feel is the owner's test.

## Notes / further findings
- `creative.minQualityScore: 0.99` in config is punishingly high; the accept gate that fired used `>= 0.90`. Worth confirming which threshold governs multi-iteration loops (a 0.99 gate with a working evaluator could still loop to max iterations).
- Generation requires output paths **inside the repo root** (path-traversal guard rejects `/tmp/...`) — by design.
