# Documentation vs. Code Comparison

This document compares the main documentation (README.md, PRD.md) to the current implementation. **Doc** = what the docs say; **Code** = what the code does.

---

## 1. Configuration

| Topic | Doc | Code | Match? |
|-------|-----|------|--------|
| **Project config file** | README: "Create `config/liminal.json` for project-wide settings" with loop, creative, gallery, renderer. | No code path loads `config/liminal.json`. ConfigLoader only reads `~/.liminal/config.json`. Loop/creative/gallery/renderer come from in-code `defaultConfig` in `src/index.ts`. | **No** — documented file is never used. |
| **User config** | README does not describe `~/.liminal/config.json`. | CLI uses `~/.liminal/config.json` (and env) for LLM provider/model/baseUrl/apiKey via ConfigLoader. | Doc **missing** — user config exists in code but is not explained. |
| **LLM / provider options** | README does not list `--provider`, `--model`, `--configure`. | bin/liminal supports `--provider`, `--model`, `--configure`; help text documents them. | Doc **missing** — CLI has more options than README. |

---

## 2. CLI options and defaults

| Option / default | Doc | Code | Match? |
|------------------|-----|------|--------|
| **--project, -j** | README: "--project, -j: Project name for gallery (default: auto-generated)". | No `--project` or `-j` in bin/atelier. Generate command uses hardcoded `project: 'cli-project'`. | **No** — option and short flag are not implemented. |
| **--output default** | README: "Output directory (default: ./output)". | index.ts `run()` default is `./output`. bin/liminal uses `~/.liminal/output` when `--output` is omitted (line 250). | **No** — CLI default differs from README and from programmatic default. |
| **--max-iterations default** | README: "Maximum iterations (default: 20)". | index.ts default is 20. bin/liminal initial value is 3 (line 35) and help says "default: 3" (line 92). | **No** — CLI default is 3, not 20. |
| **Commands** | README: --prompt, --max-iterations, --output, --project; examples use liminal --prompt "…". | bin/liminal also has: generate/gen/g, serve/s, list/ls, --provider, --model, --configure, --recent, --favorite, --favorites, --interactive/-i, --completions. | Doc **incomplete** — many CLI features (serve, list, configure, interactive, completions, recent, favorites) not in README. |

---

## 3. Programmatic API (`run()` and options)

| Topic | Doc | Code | Match? |
|-------|-----|------|--------|
| **run() options** | README example: `run('…', { maxIterations: 10, output: './my-art', project: 'my-experiment', tolerateErrors: true, minQualityScore: 0.8 })`. | `run()` in index.ts accepts: maxIterations, timeoutMinutes, output, project, minQualityScore, galleryDir. It does **not** accept `tolerateErrors`; it always passes `tolerateErrors: false` to RalphLoop (line 135). | **No** — `tolerateErrors` is documented but not part of the public `run()` options and has no effect. |
| **Return shape** | README: result has iterations, finalScore, completed, reason. | Code returns code, iterations, completed, reason, timestamp, duration, finalScore, project, outputDir, prompt, htmlPath, jsPath, zipPath. | **Yes** — documented fields exist; code adds more. |

---

## 4. Live Music Coding (README & PRD)

| Topic | Doc | Code | Match? |
|-------|-----|------|--------|
| **Feature** | README/PRD: "Live Music Coding" — Strudel, Hydra, Sonic Pi, FoxDot, p5.js + Web Audio. Example: `liminal --prompt "…" --mode live-music --output ./set`. | No `--mode` flag in bin/liminal. No live-music mode. | **No** — feature not implemented. |
| **generateMusic()** | README/PRD: `atelier.generateMusic({ prompt, bpm, duration, platform: "strudel" })`. | No `generateMusic` on export or default export in index.ts. | **No** — API does not exist. |
| **generateVisuals()** | README/PRD: `atelier.generateVisuals({ prompt, audioInput, platform: "hydra" })`. | No `generateVisuals` in codebase. | **No** — API does not exist. |
| **Music-to-visual bridge** | README: "Generate synchronized audio and visual outputs" with the above APIs. | Not implemented. | **No** — entire subsection is unimplemented. |

---

## 5. Architecture and project structure

| Topic | Doc | Code | Match? |
|-------|-----|------|--------|
| **Core components** | README lists RalphLoop, PromptStore, ContextAccumulation, CreativeEvaluator, PromiseDetector, P5Generator, PreviewServer, Renderer, Gallery, Exporter. | All present. PRD also lists them with correct test file names. | **Yes**. |
| **Project structure** | README: src/core, generators, render, gallery, export; test; config; gallery; output. | Code also has src/config, src/cli, src/tui, src/llm; config/ and config/liminal.json in repo. README omits config, cli, tui, llm under src. | Doc **incomplete** — src tree is missing directories. |
| **Promise tag** | PRD: "<promise>COMPLETE</promise>", exact match. | PromiseDetector uses same string. | **Yes**. |
| **Safety** | README: max-iterations 20, timeout 30 min, quality ≥ 0.7, configurable error tolerance. | RalphLoop has maxIterations, timeout, minQualityScore, tolerateErrors; index.ts defaults match except tolerateErrors not exposed. | **Mostly** — error tolerance is not exposed in public run() options. |

---

## 6. Testing and quality

| Topic | Doc | Code | Match? |
|-------|-----|------|--------|
| **Coverage** | README: "Overall 92.4%", "PromiseDetector 100%", "CreativeEvaluator 99.12%", "RalphLoop 96.29%". | jest.config.js collects coverage from `dist/**/*.js` with 80% thresholds. Actual numbers depend on last run. | **Unverifiable** without running tests; config is consistent with "exceeds 80%". |
| **Test count** | README: "590 tests pass consistently". | 28 test files; exact count depends on run. | **Unverifiable** without running tests. |
| **Commands** | README: npm test, test:coverage, test:watch, typecheck, benchmark. | All exist in package.json. | **Yes**. |

---

## 7. Summary table

| Category | Matches | Gaps / mismatches |
|----------|---------|-------------------|
| **Config** | defaultConfig shape matches documented config/liminal.json | config/liminal.json never loaded; ~/.liminal and LLM options not documented |
| **CLI** | --prompt, -p, --output, -o, --max-iterations, -m, serve, list | --project/-j missing; default output ~/.liminal/output vs doc ./output; default max-iterations 3 vs 20; many options (configure, interactive, completions, recent, favorites) not in README |
| **Programmatic** | run() return shape, main options | tolerateErrors documented but not accepted or forwarded by run() |
| **Live Music** | — | Entire feature (--mode live-music, generateMusic, generateVisuals) not implemented |
| **Architecture** | Core modules and promise tag match PRD/README | README project structure omits src/config, src/cli, src/tui, src/llm |
| **Tests** | Scripts and thresholds | Coverage/test count not re-verified here |

---

## 8. Recommended doc updates

1. **Config:** Either remove or rewrite the "Create config/liminal.json" section. Document that LLM config is from `~/.liminal/config.json` and env (`LIMINAL_LLM_*`), and document `--provider`, `--model`, `--configure`.
2. **CLI:** Align defaults with code (e.g. default output for CLI = `~/.liminal/output`, default max-iterations for CLI = 3) or change code to match README. Add --project/-j if implemented; otherwise remove. Document serve, list, configure, interactive, completions, recent, favorites.
3. **Programmatic:** Remove `tolerateErrors` from the run() example or add it to the run() options type and forward it to RalphLoop in index.ts.
4. **Live Music:** Mark as "Planned" or remove from README/PRD until generateMusic/generateVisuals and --mode live-music exist.
5. **Project structure:** Update README to include src/config, src/cli, src/tui, src/llm.
