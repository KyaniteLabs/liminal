# Liminal Workspace — Full System Audit Report

**Date:** 2026-03-07  
**Scope:** Index with jcodemunch + full system audit (no gaps, no blindspots)  
**Method:** jcodemunch `index_folder` + 6 subagents (entry points, config, source modules, tests, security, scripts/tooling).

---

## Post-remediation update (2026-03-07)

After the Full Remediation to Launch (Waves 0–7), the following items from the original audit were addressed:

- **Path traversal:** Output, project, gallery, SeedArchive, and POST `/api/export` now use `normalizePath()` and `assertSafeSegment()` from `src/utils/normalizePath.ts`; paths outside the base or containing `..`/separators are rejected.
- **ESLint:** `.eslintrc.cjs` added at repo root; `npm run lint` runs `eslint src/` with project config.
- **Coverage:** Jest `collectCoverageFrom` now targets **source** (`src/**/*.ts`, `src/**/*.tsx`) instead of dist; coverage is collected from src without requiring a build.
- **E2E tests:** `test/e2e/` added (full-loop cloud/local, seed+quality, GUI, sandbox+requestImprovement); E2E tests skip gracefully when backends are unavailable.
- **Dual-LLM tests:** `test/integration/dual-llm.test.ts` exercises cloud LLM and local (Ollama) paths with clear skip messages when backends are missing.

See **IMPACT_ANALYSIS.md** for full impact summary, test counts, and remaining known gaps.

---

## 1. Jcodemunch index result

- **Tool:** `user-jcodemunch` → `index_folder`
- **Path:** `/Users/simongonzalezdecruz/liminal`
- **Options:** `extra_ignore_patterns`: gallery, node_modules, dist, test-output, benchmark-output; `use_ai_summaries`: false; `incremental`: false
- **Result:** Success. Repo id: `local/liminal`. Indexed **39 files**, **249 symbols**, **38 file summaries**. Languages: JS 11, TS 24, TSX 4.
- **Discovery skip counts:** skip_pattern 17263, gitignore 87, extra_ignore 1306, wrong_extension 31; no path_traversal/symlink/secret issues.
- **No-symbols files (23):** All under `test/` (unit + integration + generators) plus `jest.config.js` — test files are not parsed for symbols by design.

---

## 2. Entry points and control flow

| Entry point | File | Invocation | Config source | Call graph |
|-------------|------|------------|---------------|------------|
| **CLI** | `bin/liminal` | `liminal` (npm bin) or `node bin/liminal` | ConfigLoader → `~/.liminal/config.json` + env; bin sets `process.env.LIMINAL_LLM_*`; flags override | dotenv → initializeConfig → getEffectiveConfig → set env; generate → `run(prompt, opts)`; serve → PreviewServer; list → read ~/.liminal/output; configure → saveConfig; interactive → InteractiveMode.run() → run(); completions → generateCompletions(shell) |
| **run / Liminal** | `src/index.ts` | Programmatic only | In-code `defaultConfig` + options; no ConfigLoader; LLM from process.env when LLMClient is created | run() → RalphLoop.run() → P5GeneratorLLM → LLMClient(env); run() → Exporter (HTML/JS/ZIP), Gallery.loadHistory(); Liminal.run() → same run() with merged config |
| **TUI** | `src/tui/index.tsx` | `npm run tui` → `node --import tsx src/tui/index.tsx` | Env only (dotenv); no ConfigLoader; run options hardcoded in handleGenerate | main() → loadGallery() → render(App); handleGenerate → import(dist/index.js) → run(prompt, { maxIterations: 10, ... }) |
| **Benchmark** | `scripts/benchmark.js` | `npm run benchmark` → `node scripts/benchmark.js` | Env only; no dotenv, no ConfigLoader | runBenchmarks() → benchmarkIteration(prompt) → run(prompt, { output: './benchmark-output', project: benchmark-${Date.now()} }) |

**Note:** Benchmark imports `run` from `../src/index.js`; with plain `node scripts/benchmark.js` this requires either a build (dist) or resolution that serves `src/index.ts` (e.g. tsx).

---

## 3. Config and environment

### 3.1 Config source → reader

| Config source | Read by (file : function) |
|---------------|---------------------------|
| `~/.liminal/config.json` | `src/config/ConfigLoader.ts` : loadConfig(), getEffectiveConfig() |
| Env: LIMINAL_LLM_PROVIDER | ConfigLoader.getEffectiveConfig(); LLMClient constructor |
| Env: LIMINAL_LLM_BASE_URL | ConfigLoader.getEffectiveConfig(); LLMClient constructor, isConfigured() |
| Env: LIMINAL_LLM_MODEL | ConfigLoader.getEffectiveConfig(); LLMClient constructor |
| Env: LIMINAL_LLM_API_KEY | ConfigLoader.getEffectiveConfig(); LLMClient constructor, isConfigured() |
| Env: CLOUD_LLM_API_KEY | ConfigLoader.getEffectiveConfig() (apiKey fallback); LLMClient constructor, isConfigured() |
| Env: HOME | bin/liminal (output dir, serve search dirs, list) — fallback `/tmp` |

### 3.2 Is `config/liminal.json` loaded?

**No.** The repo file `config/liminal.json` is **never loaded**.

- README (and PRD) say to create `config/liminal.json` for project-wide settings.
- ConfigLoader only uses `DEFAULT_CONFIG_PATH` = `path.join(os.homedir(), '.liminal', 'config.json')`.
- bin/liminal calls getEffectiveConfig() with no arguments → only user config is used.
- **Gap:** Documentation describes project-wide config (loop, creative, gallery, renderer, llm), but the app uses in-memory defaults in `src/index.ts` (defaultConfig) and user config from `~/.liminal/config.json`. ConfigLoader’s shape (defaultProvider, providers) differs from the project config shape.

### 3.3 Two config systems

1. **LLM config:** ~/.liminal/config.json + env (ConfigLoader). Used only by **bin/liminal**; it merges and sets process.env so LLMClient sees it. TUI and benchmark do not call ConfigLoader — they rely on env (and TUI on dotenv).
2. **Loop/creative/gallery/renderer:** In-code defaults in `src/index.ts` (defaultConfig) + options passed to run() / Liminal. No file or env for these keys.

---

## 4. Source modules and dependencies

### 4.1 src/ tree

| Directory | Files |
|-----------|--------|
| core/ | ContextAccumulation.ts, CreativeEvaluator.ts, PromiseDetector.ts, PromptStore.ts, RalphLoop.ts |
| generators/p5/ | P5Generator.ts, P5GeneratorLLM.ts, ParticleSystem.ts, CellularAutomata.ts |
| render/ | Renderer.ts, PreviewServer.ts |
| gallery/ | Gallery.ts, SeedArchive.ts |
| export/ | Exporter.ts |
| config/ | ConfigLoader.ts, PromptHistory.ts |
| cli/ | Completions.ts |
| tui/ | index.tsx, InteractiveMode.ts, types.ts; components: VoiceInput.tsx, PlayerPiano.tsx, XRayPanel.tsx |
| llm/ | LLMClient.ts |
| (root) | index.ts |

### 4.2 Public API (src/index.ts)

- **Defined in index.ts:** LIMINAL_VERSION, LiminalConfig, defaultConfig, run, runFromArgs, Liminal, default export.
- **Re-exports:** RalphLoop, CreativeEvaluator, PromiseDetector, PromptStore, ContextAccumulation; P5Generator, ParticleSystem, CellularAutomata, P5GeneratorLLM; Renderer, PreviewServer; Exporter, Project; Gallery, Iteration; SeedArchive, SeedMetadata.

### 4.3 Internal dependency graph (high level)

- **index.ts** → core/*, generators/p5/*, render/*, export/Exporter, gallery/Gallery, gallery/SeedArchive.
- **RalphLoop** → PromptStore, ContextAccumulation, CreativeEvaluator, PromiseDetector; P5GeneratorLLM; Gallery.
- **P5GeneratorLLM** → LLMClient.
- **tui/index.tsx** → tui/components (PlayerPiano, XRayPanel, VoiceInput).
- **InteractiveMode** → config/PromptHistory.
- No internal src imports: CreativeEvaluator, PromiseDetector, PromptStore, ContextAccumulation, P5Generator, ParticleSystem, CellularAutomata, Renderer, PreviewServer, Exporter, Gallery, SeedArchive, ConfigLoader, PromptHistory, Completions, LLMClient, VoiceInput, types.

---

## 5. Tests and coverage

### 5.1 Test files (28 total)

- **Unit (18):** context-accumulation, completions, config-loader, creative-evaluator, exporter, gallery, index, interactive-mode, llm-client, player-piano, promise-detector, prompt-history, prompt-store, seed-archive, tui-integration, voice-input, xray-panel.
- **Integration (7):** cli, evaluator-gallery, full-loop, generator-renderer, interactive-mode, preview-server, ralph-loop, renderer.
- **Generators (3):** cellular-automata, p5-generator, particle-system.

### 5.2 Coverage config (jest.config.js)

- **collectCoverageFrom:** `src/**/*.ts`, `src/**/*.tsx` (excludes test files, *.d.ts). Coverage is collected from **source**.
- **coverageThreshold (global):** 80% statements, branches, functions, lines.

### 5.3 Gaps

- **P5GeneratorLLM:** Covered indirectly via integration and generator tests (p5-generator-llm.test.js).
- **TUI:** `tui/index.tsx` and React components are exercised by unit tests (player-piano, xray-panel, voice-input, tui-integration) with mock data.
- **E2E:** Full-loop, seed/quality, GUI, and sandbox E2E tests exist in `test/e2e/`; they skip when backends are unavailable.

---

## 6. Security and secrets

### 6.1 Secret usage

| Variable / location | Read/Write | Source |
|---------------------|------------|--------|
| LIMINAL_LLM_API_KEY (env) | Set by bin from config; read by ConfigLoader, LLMClient | ~/.liminal/config.json or env |
| CLOUD_LLM_API_KEY (env) | Read only | User-set env |
| LIMINAL_LLM_BASE_URL, LIMINAL_LLM_MODEL | Set by bin; read by ConfigLoader, LLMClient | File + env |
| config.apiKey / config.baseUrl (file) | Read via getEffectiveConfig; bin copies to env | ~/.liminal/config.json |
| LLMClient Authorization header | Read apiKey from config/env | Bearer token |

- **Persistence:** saveConfig() can write full LiminalConfig (including providers[*].apiKey/baseUrl) to ~/.liminal/config.json. CLI `--configure` writes only baseUrl and model (no apiKey). So apiKey is not written by the CLI but could be in a user-edited config file.

### 6.2 Path injection / traversal

**Remediation (2026-03-07):** Path sanitization is implemented. See `src/utils/normalizePath.ts` (`normalizePath(baseDir, subPath)`, `assertSafeSegment(name)`). Used in:

- **run() / index.ts:** output and galleryDir resolved with normalizePath(cwd, …); project validated with assertSafeSegment.
- **Gallery:** project and version paths built with normalizePath(galleryDir, …); loadHistoryFromDir uses normalizePath.
- **SeedArchive:** saveSeed/loadSeed reject seeds containing `..` or path separators via assertSafeSegment.
- **PreviewServer POST /api/export:** requested path resolved with normalizePath; traversal throws, handler returns 400.

| Location | Risk (before) | Status |
|----------|----------------|--------|
| **--output / output option** | User-controlled; path traversal | Resolved under cwd via normalizePath |
| **project option** | Path traversal if e.g. `../../etc` | assertSafeSegment rejects |
| **serve / findLatestSketch** | readdir + path.join | Gallery/serve paths under allowed base |
| **SeedArchive** | seed in path | assertSafeSegment rejects `..` and separators |
| **POST /api/export** | requestedPath | normalizePath; 400 on escape |

---

## 7. Scripts, build, and tooling

### 7.1 scripts/benchmark.js

- Runs benchmarks for iteration time and memory.
- Imports `run` from `../src/index.js` (note: may require build or tsx for .ts).
- Calls run(prompt, { output: './benchmark-output', project: `benchmark-${Date.now()}` }) per prompt; writes report to ./benchmark-output/report.json; exit 0/1 by pass/fail.

### 7.2 package.json scripts

| Script | Command |
|--------|---------|
| build | tsc |
| test | NODE_OPTIONS='--experimental-vm-modules' jest |
| test:watch | jest --watch |
| test:coverage | jest --coverage |
| lint | eslint src/ |
| typecheck | tsc --noEmit |
| docs | typedoc --out docs src/ |
| benchmark | node scripts/benchmark.js |
| tui | node --import tsx src/tui/index.tsx |

### 7.3 ESLint

- **.eslintrc.cjs** at repo root: extends eslint:recommended and @typescript-eslint/recommended; parser and plugins for TypeScript; `npm run lint` runs `eslint src/`.

### 7.4 tsconfig.json

- include: src/**/*; exclude: node_modules, dist, test. outDir: dist; rootDir: src. Strict, ES2022, declaration/sourceMap; noUnusedLocals/Parameters; ts-node ESM for running TS.

---

## 8. Gaps and blindspots (explicit)

1. **config/liminal.json** — ConfigLoader has loadProjectConfig(); project config path may not be passed from all entry points (e.g. bin/liminal). File: config/liminal.json; document when it is loaded.
2. **Coverage from src** — jest collectCoverageFrom is src/**/*.ts (and .tsx); coverage reflects source. File: jest.config.js.
3. **ESLint** — .eslintrc.cjs present at repo root; lint runs on src/.
4. **P5GeneratorLLM** — Covered by test/generators/p5-generator-llm.test.js and integration tests.
5. **Path traversal** — Addressed by normalizePath and assertSafeSegment (see §6.2).
6. **E2E** — test/e2e/ contains full-loop (cloud/local), seed+quality, GUI, sandbox; skip when backends missing.
7. **Benchmark import** — scripts/benchmark.js imports from ../src/index.js; with .ts sources this may require build or tsx.

---

## 9. Summary

- **Index:** Workspace indexed with jcodemunch (39 files, 249 symbols); optional future runs can use incremental: true.
- **Entry points:** Four (bin/liminal, src/index.ts, src/tui/index.tsx, scripts/benchmark.js); config flow differs (only CLI uses ConfigLoader).
- **Config:** Two systems (LLM from file+env; loop/creative/gallery/renderer from in-code defaults); config/liminal.json is documented but never loaded.
- **Source:** Clear src tree and public API; dependency graph centered on index.ts and RalphLoop → P5GeneratorLLM → LLMClient, plus TUI branch.
- **Tests:** 28 files; coverage from dist at 80% thresholds; P5GeneratorLLM and TUI entry/components lack direct or component-level tests.
- **Security:** Secrets from env and ~/.liminal/config.json; apiKey not written by CLI; path traversal risks on output, project, and readdir-based paths when inputs are untrusted.
- **Tooling:** Benchmark, lint, typecheck, docs, tui scripts documented; eslint config absent in repo.

End of report.
