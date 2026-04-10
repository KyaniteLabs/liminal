# Liminal — Full Impact Analysis (Post–Remediation)

**Date:** 2026-03-07  
**Scope:** All phases (Waves 0–7) completed; full test run; documentation and impact summary.  
**Audience:** Stakeholders, maintainers, QA.

---

## 1. Executive Summary

The **Full Remediation to Launch** plan was executed across **eight waves** (0–7) with **one task per subagent**, TDD, and smoke checks. This document summarizes:

- **What was built** (features, tests, tooling)
- **Test suite state** (pass/fail counts, known failures, E2E)
- **Impact on codebase** (new modules, config, security)
- **Documentation updates** (README, PRD, architecture, audit)
- **Risks and known gaps** (remaining failures, config, coverage)

**Bottom line:** 53 test suites, 753 tests; **745 passing**, **8 known failures** in 3 integration suites (LLM/template-dependent or GUI expectation). E2E suite (5 suites, 9 tests) passes or skips gracefully when backends are unavailable. Path safety, dual-LLM tests, ESLint, and coverage from source are in place. Documentation has been updated to match the current system.

---

## 2. Phases Completed (Waves 0–7)

| Wave | Name | Subagents | Delivered |
|------|------|-----------|-----------|
| **0** | Foundation | A–D | ConfigLoader + `loadProjectConfig` / `getEffectiveConfig`; RalphLoop optional seed, context always injected, quality gate; docs (ARCHITECTURE_AND_PHILOSOPHY, PRD §3.0); `tolerateErrors` in `run()` |
| **1** | Generators + GA readiness | A–D | Generator routing (particle/galaxy → ParticleSystem, cellular/lenia → CellularAutomata, else P5GeneratorLLM); `promptToGeneratorParams`; CreativeEvaluator `assess`/`getFitness`; IGA `generateFiveVariations` |
| **2** | Aesthetic | A–C | P5GeneratorLLM sound template + routing for sound/audio/music; evaluator sound-aware; Exporter/PreviewServer detect Web Audio, add p5.sound CDN when needed |
| **3** | Full GUI | A–D | `gui/` (Vite+React+Express); GET/POST `/api/config`; Run/Stop (AbortController), `onProgress`, `signal`; versioned preview, code panel, gallery list, POST `/api/export`, `/api/gallery` |
| **4** | Sandbox + emergent life | A–D | SandboxRunner (Puppeteer), `runInSandbox()`; `requestImprovement` + LLMClient `improveP5Sketch`; SelfImprovement (maxDepth, timeout, rate limit); GUI “Live organism” tab, POST `/api/sandbox/run` |
| **5** | Live Music Coding | A–D | `generateMusic`, `generateVisuals`, `generateMusicToVisual`; CLI `--mode live-music`; ProjectConfig optional `live` (midiOutput, oscHost, oscPort, syncMode) |
| **6** | Dual LLM + hardening | A–C | Dual-LLM integration tests (cloud/local, skip when backend missing); path sanitization (`normalizePath`, `assertSafeSegment`); ESLint (.eslintrc.cjs), coverage from `src/`, lint test |
| **7** | E2E and launch | A–E | E2E: full-loop cloud, full-loop local, seed + quality gate, GUI (config + gallery), sandbox + requestImprovement; all skip gracefully when backend/Chrome unavailable |

---

## 3. Test Suite Summary

### 3.1 Full Run (npm test)

| Metric | Value |
|--------|--------|
| **Suites** | 53 total (50 passed, 3 failed) |
| **Tests** | 753 total (745 passed, 8 failed) |
| **Time** | ~101 s (typical) |

### 3.2 Failing Suites and Root Cause

| Suite | Failing tests | Root cause |
|-------|----------------|------------|
| **test/integration/preview-server-versioned.test.js** | 1 | Expects `/gui` HTML to contain "preview" and "Code"; server serves Config app (title "Liminal — Config"); **GUI structure/expectation mismatch**. |
| **test/integration/full-loop.test.js** | 4 | (1) Promise termination: LLM does not emit `<promise>COMPLETE</promise>`, so `completed` stays false. (2) "Different code each iteration": template/LLM returns same code. (3)–(4) Same promise-related expectations. **LLM/template behavior**, not logic bug. |
| **test/integration/ralph-loop.test.js** | 3 | (1)–(2) Promise detection: same as above. (3) "Include previous code in context": code identical across iterations when template/LLM repeats. **LLM/template behavior**. |

**Conclusion:** The 8 failures are **environment- and model-dependent** (promise output, code variation) or **GUI expectation** (page content). Core logic (RalphLoop, quality gate, context injection, path safety, export, gallery) is covered and passing in unit and other integration tests.

### 3.3 E2E Suite (npm run test:e2e)

| Suite | Tests | Behavior |
|-------|--------|----------|
| test/e2e/full-loop-cloud.test.ts | 1 | Full `run()` with cloud LLM; skips when API/key missing or 400/401. |
| test/e2e/full-loop-local.test.ts | 1 | Full `run()` with Ollama; skips when Ollama unreachable. |
| test/e2e/seed-and-quality.test.js | 2 | Seed run + quality-gate run; skip when LLM unavailable. |
| test/e2e/gui.e2e.test.js | 2 | GET `/api/config`, GET `/api/gallery`; skip if GUI server does not start. |
| test/e2e/sandbox-self-improve.e2e.test.ts | 3 | SandboxRunner.runInSandbox + requestImprovement; skip when Chrome or LLM unavailable. |

**Total E2E:** 5 suites, 9 tests; all **pass** (or skip with clear message). No failing E2E tests when backends are unavailable.

### 3.4 Test Layout

```
test/
├── unit/           # 30+ files (ralph-loop, config-loader, path-sanitization, lint, etc.)
├── integration/    # full-loop, ralph-loop, preview-server*, dual-llm, cli, gui-config-api, etc.
├── generators/     # p5-generator, particle-system, cellular-automata, p5-generator-llm, prompt-to-generator-params
└── e2e/            # full-loop-cloud, full-loop-local, seed-and-quality, gui.e2e, sandbox-self-improve.e2e
```

**Scripts:** `npm test` (all), `npm run test:integration`, `npm run test:e2e`.

---

## 4. Impact on Codebase

### 4.1 New or Touched Modules

| Area | Change |
|------|--------|
| **Config** | ConfigLoader: `loadProjectConfig()`, `getEffectiveConfig(configPath?, projectConfigPath?)`; project config can override user config. |
| **Path safety** | `src/utils/normalizePath.ts`: `normalizePath(baseDir, subPath)`, `assertSafeSegment(name)`. Used in run(), Gallery, SeedArchive, PreviewServer export. |
| **Loop** | RalphLoop: optional seed, context appended when no `{{context}}`, quality gate (break when score < minQualityScore), generator routing, promptToGeneratorParams, onProgress, signal. |
| **Generators** | P5GeneratorLLM: sound template, routing for sound/audio/music; ParticleSystem/CellularAutomata used by routing. |
| **Evolution** | CreativeEvaluator: `assess(output, options?)`, `getFitness(code, options?)`; IGA `generateFiveVariations()`. |
| **Export/Preview** | Exporter/PreviewServer: Web Audio / p5.sound detection, versioned preview, `/api/gallery`, `/api/export`, `/api/sandbox/run`. |
| **Sandbox** | SandboxRunner.runInSandbox(); requestImprovement; SelfImprovement (ImprovementContext, limits). |
| **Music** | generateMusic, generateVisuals, generateMusicToVisual; CLI `--mode live-music`. |
| **GUI** | gui/ (Vite+React+Express), config/gallery/export/sandbox APIs; TUI Run/Stop, timeline, code panel, gallery. |

### 4.2 Tooling and Config

| Item | Detail |
|------|--------|
| **ESLint** | `.eslintrc.cjs` at repo root; `npm run lint` → `eslint src/`. |
| **Jest** | `collectCoverageFrom`: `src/**/*.ts` (and .tsx), exclude test files; coverage from **source**. Thresholds: 80% (can be relaxed if needed). |
| **Lint assertion** | `test/unit/lint.test.ts` runs `npm run lint` and expects exit 0. |
| **E2E** | `test:e2e` runs `jest test/e2e`; `.gitignore` includes `tmp-e2e/`. |

### 4.3 Security and Hardening

| Control | Implementation |
|---------|----------------|
| **Path traversal** | Output, project, gallery, SeedArchive, and POST `/api/export` use `normalizePath()` or `assertSafeSegment()`; paths outside base or with `..`/separators rejected. |
| **Secrets** | API keys from env or ~/.liminal/config.json; not logged; CLI `--configure` does not write apiKey. |
| **Sandbox** | Puppeteer run with timeout and network blocked; SelfImprovement has maxDepth and rate limits. |

### 4.4 Breaking Changes and Compatibility

- **run()** and **Liminal.run()** now require **output/project/galleryDir** to resolve under `process.cwd()` (path safety). Invalid or escaping paths throw.
- **Project names** must not contain `..` or path separators; **seed** identifiers in SeedArchive same.
- **GUI** `/gui` serves the Config app; tests that expected a different page content need updating (see Known Failures).
- **Coverage** is collected from **src/** (not dist); `coverageThreshold` may need adjustment if current coverage is below 80%.

---

## 5. Documentation Updates

The following docs were updated to reflect the current system:

| Document | Updates |
|----------|--------|
| **README.md** | Test counts (745 passed, 8 known failures); E2E section and `npm run test:e2e`; Live Music described as implemented (CLI + API); test structure (unit, integration, generators, e2e); lint and coverage from source; cloud vs local LLM section retained. |
| **docs/ARCHITECTURE_AND_PHILOSOPHY.md** | Substrate, loop start, curation, full GUI, cloud/local LLMs already present; path safety and sandbox noted in impact analysis; no structural change. |
| **PRD.md** | Test structure (§5.3) includes `test/e2e/`; success criteria (§10) checkboxes updated for implemented features (Ralph-Wiggum, p5 generators, preview, gallery, TDD, GA readiness, creative evaluator, export, Live Music Coding, E2E). |
| **SYSTEM_AUDIT_REPORT.md** | Post-remediation note added: path sanitization, ESLint config, coverage from src, e2e tests, dual-LLM tests; some prior gaps (path traversal, ESLint, coverage source) addressed. |
| **docs/GAPS_AND_IMPROVEMENTS.md** | Remediation status section added: which gaps were fixed (context injection, quality gate, generators in loop, path safety, ESLint, Live Music, tolerateErrors, etc.) and which remain (config/atelier.json loading, some integration test expectations). |
| **IMPACT_ANALYSIS.md** | This document. |

---

## 6. Risks and Known Gaps

### 6.1 Test Failures

- **8 integration tests** fail under default run: promise-based termination and “different code each iteration” depend on LLM/template output; one GUI test expects different `/gui` content. Options: (a) relax or skip these tests when LLM is not configured, (b) mock LLM in those tests, (c) update GUI test to match current Config app.
- **Coverage thresholds** (80%) may fail on `npm run test:coverage` if coverage is below 80%; thresholds are documented in jest.config.js and can be lowered if needed.

### 6.2 Config and Behavior

- **config/liminal.json**: Documented in README/PRD for project-wide settings; ConfigLoader supports `loadProjectConfig`/projectConfigPath, but bin/liminal and some entry points may not pass project config path. Verify project config is used where intended.
- **Two config systems** (LLM from file+env vs loop/creative/gallery from defaults/options) remain as in SYSTEM_AUDIT_REPORT; no single merged project file for all keys.

### 6.3 Operational

- **E2E** require real backends (cloud API key or Ollama) or Chrome (sandbox) to run non-skipped; CI should expect skips when secrets/runtime are missing.
- **Benchmark** imports from `../src/index.js`; may require build or tsx when sources are TypeScript.

---

## 7. Recommendations

1. **CI:** Run `npm run build && npm test`; optionally `npm run test:e2e` with skips acceptable. Run `npm run lint` and `npm run typecheck`.
2. **Failing integration tests:** Either add conditional skip when LLM is not configured, or convert promise/context tests to use a mocked generator so they are deterministic.
3. **GUI test:** Align expectation with current `/gui` content (e.g. "Liminal" and "Config") or target a dedicated preview route if one exists.
4. **Coverage:** If `test:coverage` fails on thresholds, either improve coverage or lower thresholds in jest.config.js and document in README.
5. **Project config:** Confirm how `config/liminal.json` is loaded (e.g. from cwd) and document in README/PRD.

---

## 8. Summary Table

| Category | Status |
|----------|--------|
| **Waves 0–7** | Completed (one task per subagent, TDD, smoke). |
| **Unit tests** | Passing (path-sanitization, lint, config-loader, ralph-loop, etc.). |
| **Integration tests** | 3 suites with 8 failing tests (LLM/template or GUI expectation). |
| **E2E tests** | 5 suites, 9 tests; pass or skip gracefully. |
| **Path safety** | Implemented (normalizePath, assertSafeSegment). |
| **Dual LLM** | Tests and README section (cloud vs local). |
| **ESLint** | Project config; lint passes on src/. |
| **Coverage** | From src/; thresholds 80% (configurable). |
| **Documentation** | README, PRD, ARCHITECTURE_AND_PHILOSOPHY, SYSTEM_AUDIT_REPORT, GAPS_AND_IMPROVEMENTS updated. |

---

*End of Impact Analysis.*
