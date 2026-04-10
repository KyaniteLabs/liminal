# Liminal — Full Repository Audit

**Date:** 2026-03-31 | **Scope:** All source, tests, CI, security, docs, presentation, platform, operations
**Total findings: 38 categories, ~250 individual issues across 6 severity tiers**

---

## Table of Contents
1. [Swallowed Errors & Silent Failures](#1-swallowed-errors--silent-failures)
2. [Dead Code & Orphaned Modules](#2-dead-code--orphaned-modules)
3. [Stub & Incomplete Implementations](#3-stub--incomplete-implementations)
4. [CLI Wiring Gaps](#4-cli-wiring-gaps)
5. [Generator Issues](#5-generator-issues)
6. [Config Loading Gaps](#6-config-loading-gaps)
7. [LLM Client Robustness](#7-llm-client-robustness)
8. [Compost Pipeline Integrity](#8-compost-pipeline-integrity)
9. [RalphLoop Issues](#9-ralphloop-issues)
10. [Type Safety Gaps](#10-type-safety-gaps)
11. [Missing Error Handling](#11-missing-error-handling)
12. [Console.log Leaks](#12-consolelog-leaks)
13. [Race Conditions](#13-race-conditions)
14. [Hardcoded Values](#14-hardcoded-values)
15. [TODO/FIXME/HACK Comments](#15-todofixmehack-comments)
16. [Missing Tests](#16-missing-tests)
17. [Barrel Export Gaps](#17-barrel-export-gaps)
18. [CI Pipeline Issues](#18-ci-pipeline-issues)
19. [Test Quality Issues](#19-test-quality-issues)
20. [Security Findings](#20-security-findings)
21. [Documentation Gaps](#21-documentation-gaps)
22. [TypeScript & Build Config](#22-typescript--build-config)
23. [Prompt Template Issues](#23-prompt-template-issues)
24. [Package.json Issues](#24-packagejson-issues)
25. [Gitignore Gaps](#25-gitignore-gaps)
26. [GitHub Presentation Audit](#26-github-presentation-audit)
27. [Landing Page Issues](#27-landing-page-issues)
28. [Severity Summary](#28-severity-summary)
29. [Dependency Vulnerabilities](#29-dependency-vulnerabilities)
30. [Git History Secrets](#30-git-history-secrets)
31. [Repo Size & Bloat](#31-repo-size--bloat)
32. [Platform Compatibility](#32-platform-compatibility)
33. [Signal Handling & Graceful Shutdown](#33-signal-handling--graceful-shutdown)
34. [Disk Exhaustion & Resource Exhaustion](#34-disk-exhaustion--resource-exhaustion)
35. [npm Publishability](#35-npm-publishability)
36. [Generator Output Correctness](#36-generator-output-correctness)
37. [GitHub Settings & Branch Protection](#37-github-settings--branch-protection)
38. [Landing Page Accessibility](#38-landing-page-accessibility)

---

## 1. Swallowed Errors & Silent Failures

34 catch blocks silently discard errors or return empty defaults without meaningful propagation.

### Bare `catch {}` with zero logging (worst offenders)

| # | File | Line | What's lost |
|---|------|------|-------------|
| 1 | `src/tui/index.tsx` | 63 | `loadProjects()` failure — user sees empty list, no error |
| 2 | `src/chat/GuidanceEngine.ts` | 148 | Unknown operation — no logging at all |
| 3 | `src/chat/GuidanceEngine.ts` | 338 | Unknown operation — no logging at all |
| 4 | `src/core/RalphLoop.ts` | 255 | LIR parsing failure — regex fallback used silently |
| 5 | `src/core/lir/GeneratedCodeParser.ts` | 31 | Code parsing failure — silent |
| 6 | `src/audio/AudioExtractor.ts` | 112 | Audio extraction failure — silent |
| 7 | `src/utils/normalizePath.ts` | 24 | realpath failure — falls through silently |
| 8 | `src/evolution/MapElites.ts` | 98 | State load failure — starts fresh with no warning |

### `console.warn`-only catch blocks (error not propagated)

| # | File | Context |
|---|------|---------|
| 1 | `src/compost/CompostSoup.ts:134` | Cycle failure — loop continues |
| 2 | `src/compost/HeapMonitor.ts:29` | Digestion failure — doesn't propagate |
| 3 | `src/compost/DigestScheduler.ts:20` | Scheduled digest failure |
| 4 | `src/compost/CompostHeap.ts:89` | walkDir failure — halts scanning |
| 5 | `src/core/OrganismLoop.ts:73` | Compost seed injection failure |
| 6 | `src/core/PromptEnhancer.ts:41,71` | Compost seed/DNA injection failure |
| 7 | `src/core/ContextAccumulation.ts:108` | State load failure — returns null |
| 8 | `src/core/GenerationOrchestrator.ts:118,129` | Swarm session save / mining failure |
| 9 | `src/core/RalphLoop.ts:407` | Auto-compost failure during loop |
| 10 | `src/config/ConfigLoader.ts:197` | Legacy config migration — ALL errors swallowed |
| 11 | `src/scavenger/DNAExtractor.ts` | 14 instances throughout |
| 12 | `src/swarm/SwarmOrchestrator.ts:548` | Session save failure |
| 13 | `src/render/PreviewServer.ts:62` | SSE write failure |
| 14 | `src/core/parsing/ParsingCache.ts` | 3 instances (load, init, clear) |
| 15 | `src/sandbox/SandboxRunner.ts:79` | Browser close failure |

### Silent default returns

| # | File:Line | Returns | What's lost |
|---|-----------|---------|-------------|
| 1 | `src/config/ConfigLoader.ts:232,252` | `null` | Config load failure |
| 2 | `src/config/PromptHistory.ts:34` | `{ recent: [], favorites: [] }` | User history lost |
| 3 | `src/routing/RoutingData.ts:69` | `[]` | Routing data unavailable |
| 4 | `src/compost/SoupStateManager.ts:38` | Default state | Previous state lost |
| 5 | `src/compost/SeedBank.ts:38` | `[]` | Seeds lost |
| 6 | `src/compost/FragmentScorer.ts:63` | `5` (neutral) | LLM scoring failure masked |
| 7 | `src/compost/CollisionEngine.ts:238` | Placeholder string | LLM merge failure |
| 8 | `src/compost/ModelRouter.ts:252` | `{ code: '', success: false }` | Route failure |
| 9 | `src/generateVisuals.ts:103` | `''` | Visuals generation failure |
| 10 | `src/security/JsonSchemas.ts:145` | `null` | Validation failure |
| 11 | `src/aesthetic/critics/LayoutCritic.ts:31` | `null` | Layout analysis failure |
| 12 | `src/swarm/VotingEngine.ts:122` | Empty vote | Voting failure |

---

## 2. Dead Code & Orphaned Modules

### Completely orphaned files (zero imports from anywhere)

| # | File | Contents |
|---|------|----------|
| 1 | `src/gui/previewState.ts` | `getPreviewState()` function — unused |
| 2 | `src/gui/liveOrganismState.ts` | `liveOrganismReducer()` — unused |
| 3 | `src/gui/exportSelected.ts` | `exportSelectedIterationAsHTML()` — unused |
| 4 | `src/generators/effects/GlitchEffects.ts` | Entire generator — not registered, not exported, not in CLI |
| 5 | `src/tui/B64END` | Unknown artifact file |

### Duplicate definitions

| # | Files | What's duplicated |
|---|-------|-------------------|
| 1 | `src/gui/exportSelected.ts:7` + `src/gui/previewState.ts:5` | `GuiIteration` interface defined identically in both |
| 2 | `src/utils/htmlWrapper.ts:18-23` + `src/constants.ts:7-31` | CDN URLs hardcoded independently — can drift out of sync |

### Duplicate modules

| # | Files | Issue |
|---|-------|------|
| 1 | `src/core/PromptEnhancer.ts` + `src/brain/PromptEnhancer.ts` | Two files with same purpose, neither exported from barrel |

---

## 3. Stub & Incomplete Implementations

| # | File:Line | What's stubbed |
|---|-----------|----------------|
| 1 | `src/compost/SemanticExtractor.ts:79-80` | `extractImage()` — "multimodal extraction requires vision-capable LLM" |
| 2 | `src/compost/SemanticExtractor.ts:87-88` | `extractAudio()` — placeholder, marked `@deprecated` |
| 3 | `src/compost/SemanticExtractor.ts:95-96` | `extractVideo()` — placeholder, marked `@deprecated` |
| 4 | `src/compost/MetadataExtractor.ts:44` | Image dimensions hardcoded to `{ width: 0, height: 0 }` |
| 5 | `src/compost/MetadataExtractor.ts:51` | Audio duration hardcoded to `0` |
| 6 | `src/compost/ModelRouter.ts:142-146` | `speculativeDecode()` — entirely unimplemented, delegates immediately |
| 7 | `src/chat/ChatCLI.tsx:14-17` | `GuidanceEngineStub` — empty interface instantiated as `{}` |
| 8 | `src/chat/GuidanceEngine.ts:30,52` | `swarmOrchestrator` — TODO, parameter accepted then discarded |
| 9 | `src/musicToVisual/generateMusicToVisual.ts:34` | FFT analysis — synthetic sine wave placeholder, not real FFT |
| 10 | `src/swarm/VotingEngine.ts:74-88` | No Ollama caller — hardcoded fallback, first output wins |
| 11 | `src/tui/components/XRayPanel.tsx:46` | `void 0; // placeholder for scroll-into-view` |

---

## 4. CLI Wiring Gaps

| # | Issue | Impact |
|---|-------|--------|
| 1 | `--aesthetic` / `--aesthetic-config` flags parsed but **silently ignored** by `run()` — function type signature doesn't include these props | Aesthetic guardrails are dead code from CLI |
| 2 | `--voice` / `--voice-file` flags parsed but **never consumed** by any code path | Voice flags are dead |
| 3 | `composite` command imports from `dist/` — crashes if build hasn't run | Runtime failure for unbuilt repo |
| 4 | `list`/`ls` command only searches `~/.liminal/output/`, not configured `--output` path | Inconsistent file discovery |
| 5 | No `help` or `version` subcommand — only `--help`/`--version` flags | Minor UX gap |

---

## 5. Generator Issues

### Unregistered generator
- **`GlitchEffects`** (`src/generators/effects/GlitchEffects.ts`) — exists but not registered, not exported, not in CLI

### Inconsistent LLM injection patterns
- **Good:** `P5GeneratorLLM`, `ShaderGenerator`, `ThreeGenerator`, `StrudelGenerator`, `RemotionGenerator` accept either `LLMClient` or `LLMConfig`
- **Bad:** `HTMLWebGenerator`, `ASCIIArtGenerator`, `ToneGenerator`, `HydraGenerator` accept only `LLMClient`, defaulting to `new LLMClient()` — cannot receive config overrides

### Fragile registry guard
- `registerAllGenerators()` skips ALL built-in generators if `entries.length > 0` — registering any custom generator first prevents all built-ins from loading

### Template generators lack error handling
- `ParticleSystem`, `CellularAutomata`, `FlowField` return strings directly — no validation, no error paths

---

## 6. Config Loading Gaps

| # | Issue | Impact |
|---|-------|--------|
| 1 | Malformed JSON config returns same as missing config (`null`) | User doesn't know their config is broken |
| 2 | `ProjectConfig.creative.defaultFramework` — defined, never consumed | Dead config field |
| 3 | `ProjectConfig.renderer.port` — never merged into runtime | Dead config field |
| 4 | `ProjectConfig.gallery.maxHistoryPerProject` — never consumed | Dead config field |
| 5 | `ProjectConfig.swarm.streamDir` — never consumed | Dead config field |
| 6 | Legacy `~/.atelier/` migration copies but never deletes old dir | Confusion from dual configs |
| 7 | Default model `qwen2.5-coder-7b-instruct` at `localhost:1234` — undocumented | Users don't know what to install |

---

## 7. LLM Client Robustness

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Timeout bypass bug:** `signal || AbortSignal.timeout(...)` — custom signal replaces timeout instead of combining with `AbortSignal.any()` | HIGH |
| 2 | **Ollama 429 not classified** as `LLMRateLimitError` — won't be retried under load | MEDIUM |
| 3 | **No circuit breaker** — RalphLoop can retry 5x per iteration indefinitely against a dead upstream | MEDIUM |
| 4 | **No token counting** — prompts can exceed context limits silently, Ollama truncates with heuristic | MEDIUM |
| 5 | **Regex response parser** `/"content"\s*:\s*"([^"]*)"/ ` fails on escaped quotes, newlines, multiline strings | MEDIUM |
| 6 | **Auth failure returns comment-code** `// LLM generation failed: ...` that passes validation as valid JS — loop continues uselessly | HIGH |
| 7 | `JSON.parse(content) as ProjectConfig` — no validation of parsed shape | LOW |

---

## 8. Compost Pipeline Integrity

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Concurrent `add()` race condition:** `path.basename(srcPath)` causes overwrites for same-named files | MEDIUM |
| 2 | **Crash between scoring and purge:** Next digest re-processes same files, creates duplicate seeds | MEDIUM |
| 3 | **Data loss path:** `heap.purge()` called after digest — if seed saving fails, original heap data is gone | HIGH |
| 4 | **SeedBank TOCTOU:** `load → push → save` with no locking — concurrent digests cause data loss | MEDIUM |
| 5 | **Soup never reloads evolved population:** `CompostSoup.run()` passes original `fragments` array to every cycle instead of reloaded state | HIGH |
| 6 | **`EpisodicMemory.load()` has no try/catch** around `JSON.parse` — malformed file crashes | MEDIUM |

---

## 9. RalphLoop Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Single iteration hang:** If LLM call has no timeout, neither `maxIterations` nor `timeoutMinutes` will save it | MEDIUM |
| 2 | **SIGKILL loses data:** `qualityArchive.save()` and `aestheticModel.save()` only called after loop | LOW |
| 3 | **`isCodeComplete()` fooled by braces in comments/strings** — `// { }` counts as balanced | LOW |
| 4 | **StagnationDetector** can reset at most twice, then stagnation is permanent | LOW |

---

## 10. Type Safety Gaps

### `any` usage in production code (29 instances)

Key locations:

| # | File | Count | Context |
|---|------|-------|---------|
| 1 | `src/tui/index.tsx` | 12 | Props, keys, events, errors all typed as `any` |
| 2 | `src/core/LoopConfig.ts` | 4 | `onSuggestion`, `guidanceEngine`, duplicated interfaces |
| 3 | `src/brain/EpisodicMemory.ts` | 3 | Episode/conversation deserialization |
| 4 | `src/core/RalphLoop.ts` | 3 | visualMappingParams, aestheticConfig, guidanceEngine |
| 5 | `src/audio/AudioExtractor.ts` | 3 | Dynamic require of Meyda |
| 6 | `src/export/Exporter.ts` | 1 | Domain cast |
| 7 | `src/chat/ConversationManager.ts` | 1 | Domain cast |
| 8 | `src/render/RemotionRenderer.ts` | 1 | Codec cast |
| 9 | `src/chat/InterviewPhase.ts` | 1 | Answers map |

### Non-null assertions (19 instances)

Key locations: `src/compost/CollisionEngine.ts` (6), `src/aesthetic/` (5), `src/brain/` (3), `src/scavenger/FragmentArchive.ts` (5)

### Zero `@ts-ignore` or `@ts-expect-error` — this is good.

---

## 11. Missing Error Handling

### Async operations without try/catch

| # | File | Operation |
|---|------|-----------|
| 1 | `src/compost/DigestScheduler.ts:17-24` | Recursive setTimeout with async callback |
| 2 | `src/compost/DigestGenerator.ts` | `save()` — fs.writeFile and fs.mkdir |
| 3 | `src/compost/SoupStateManager.ts:43-46` | `save()` — fs.mkdir and fs.writeFile |
| 4 | `src/compost/RawByteProcessor.ts:21-43` | `process()` — fs.readFile and crypto |
| 5 | `src/compost/SeedBank.ts` | Multiple async operations |
| 6 | `src/compost/MetadataExtractor.ts:21` | `extract()` — fs.stat and fs.readFile |
| 7 | `src/musicToVisual/generateMusicToVisual.ts:59-72` | generateMusic + generateVisuals |

### `Promise.all` without individual error isolation (7 locations)

`src/compost/ModelRouter.ts:160`, `src/compost/CompostMill.ts:372`, `src/evolution/IGA.ts:17`, `src/collab/CollaborativeClient.ts:336,369`, `src/collab/DeepCollaboration.ts:302`, `src/swarm/SwarmOrchestrator.ts:395`

---

## 12. Console.log Leaks

**80+ instances** of `console.log`/`console.warn`/`console.error` in production code that should use the structured `Logger` utility. Worst offenders:

| Module | Count |
|--------|-------|
| `src/compost/*` | ~20 (excluding cli.ts which is acceptable) |
| `src/scavenger/DNAExtractor.ts` | 14 |
| `src/core/*` | 8 |
| `src/security/*` | 4 |
| `src/config/*` | 4 |
| `src/tui/index.tsx` | 5 |

---

## 13. Race Conditions

| # | File | Description |
|---|------|-------------|
| 1 | `src/compost/CollisionEngine.ts` | 6 non-null assertion `.get()!.push()` calls — crash if map entries removed concurrently |
| 2 | `src/compost/CompostSoup.ts:131-146` | `stop()` nulls controller while `cycle()` may reference it |
| 3 | `src/compost/HeapMonitor.ts:10,19-32` | `digesting` flag has gap between check and set — double digest possible |
| 4 | `src/render/PreviewServer.ts:56-66` | SSE client deleted during `for...of` iteration — skipped entries |
| 5 | `src/render/PreviewServer.ts:372-376` | `stop()` called twice — second access on closing server |
| 6 | `src/brain/EpisodicMemory.ts:242-263` | `load()` mutates state without locking |
| 7 | `src/swarm/SwarmOrchestrator.ts:395` | Multiple promises race to write error content to shared Map |

---

## 14. Hardcoded Values

### URLs duplicated between files
- `src/utils/htmlWrapper.ts` hardcodes CDN URLs independently from `src/constants.ts` — p5 `1.9.0` vs `SERVICE_DEFAULTS.P5_VERSION`, Three.js `0.160.0` vs `SERVICE_DEFAULTS.THREE_VERSION`
- `src/compost/defaults.ts:46,51` duplicates `localhost:1234/v1` from constants

### URLs not configurable anywhere
- `LOCAL_LLM_URL` (`http://localhost:1234/v1`)
- `OLLAMA_URL` (`http://localhost:11434`)
- `REASONING_URL` (`http://localhost:8000`)
- `MINIMAX_URL` (`https://api.minimax.io/v1`)
- Preview port `3456`

### Magic numbers (at least named in most cases)
- Sandbox timeout: `30_000` ms
- Collision window: `60 * 60 * 1000` ms
- Circuit breaker reset: `30_000` ms
- HeapMonitor interval: `60000` ms
- Various template constants in `src/generators/remotion/RemotionTemplates.ts`

---

## 15. TODO/FIXME/HACK Comments

| # | File:Line | Comment |
|---|-----------|---------|
| 1 | `src/compost/ModelRouter.ts:143` | `TODO: Implement true speculative decoding` |
| 2 | `src/compost/ModelRouter.ts:262` | `TODO: Replace with more sophisticated semantic similarity` |
| 3 | `src/chat/GuidanceEngine.ts:30` | `TODO: Use swarmOrchestrator for swarm-based suggestions` |
| 4 | `src/chat/GuidanceEngine.ts:52` | `TODO: Store swarmOrchestratorwhen implementing swarm suggestions` |
| 5 | `src/core/parsing/DocParser.ts:321` | `TODO: Track line numbers from AST` |
| 6 | `src/security/SecurityLogger.ts:56` | `TODO: Send to SIEM/security monitoring service in production` |
| 7 | `src/compost/SemanticExtractor.ts:76` | `@todo Implement when LLMclient supports multimodal` |
| 8 | `src/compost/SemanticExtractor.ts:84` | `@todo Implement using Whisper API` |
| 9 | `src/compost/SemanticExtractor.ts:92` | `@todo Implement using frame sampling + vision model` |
| 10 | `src/compost/MetadataExtractor.ts:41` | `@todo Extract actual dimensions` |
| 11 | `src/compost/MetadataExtractor.ts:48` | `@todo Extract actual duration` |

---

## 16. Missing Tests

**30+ source modules have zero test coverage.** Critical gaps:

| Module | Tests? |
|--------|--------|
| `src/core/RalphLoop.ts` | No (indirect integration only) |
| `src/core/CodeValidator.ts` | No |
| `src/core/ContextBuilder.ts` | No |
| `src/core/GenerationOrchestrator.ts` | No |
| `src/core/AmbiguityDetector.ts` | No |
| `src/core/OrganismLoop.ts` | No |
| `src/core/PromptEnhancer.ts` | No |
| `src/core/EvolutionIntegration.ts` | No |
| `src/core/EventBus.ts` | No |
| `src/config/ConfigLoader.ts` | No |
| `src/llm/LLMClient.ts` | Only error hierarchy tested |
| `src/llm/CacheManager.ts` | No |
| `src/security/*` | No |
| `src/render/Renderer.ts` | No |
| `src/render/PreviewServer.ts` | No |
| `src/export/Exporter.ts` | No |
| `src/composite/Compositor.ts` | No |
| `src/chat/*` | No |
| All generators (except registry) | No |
| `src/gui/*` | No |

---

## 17. Barrel Export Gaps

12+ modules exist in their directories but are NOT exported from any barrel `index.ts`:

`GlitchEffects`, `IGA`, `CrossDomainCrossover`, `ProgressiveDesignTiers`, `FitnessCombiner`, `ModelRouter`, `CreativeBoard`, `EvaluationMemo`, `Scoring`, `AmbiguityDetector`, `ContextBuilder`, `LoopPersistence`, `GenerationOrchestrator`, `PromptEnhancer` (both copies), `OrganismLoop`, `Compositor`

---

## 18. CI Pipeline Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | `pr-review.yml` missing `pnpm install` — script fails if it imports anything | HIGH |
| 2 | PR review depends on `GLM_API_KEY` secret — silently fails if missing | MEDIUM |
| 3 | No pnpm store caching between runs | LOW |
| 4 | Ubuntu-only — no macOS/Windows matrix | LOW |
| 5 | **All 5 recent CI runs failing** — TypeScript build errors (missing `mdast`, `zod` types) | CRITICAL |

### CI build errors (current)
```
src/compost/SoupStateManager.ts:35 — Type '{}' missing properties from 'SoupState'
src/core/parsing/DocParser.ts:10 — Cannot find module 'mdast'
src/core/parsing/DocParser.ts:244 — Parameter 'child' implicitly has 'any' type
src/learning/QualityArchive.ts:126 — Property 'archives' does not exist on type '{}'
src/security/JsonSchemas.ts:8 — Cannot find module 'zod'
src/security/JsonSchemas.ts:141,165 — Type errors with 'unknown' and generics
```

---

## 19. Test Quality Issues

| # | Issue | File |
|---|-------|------|
| 1 | Tests that test mocks, not code — `resolves.not.toThrow()` with everything mocked | `test/integration/chat-command.test.ts` |
| 2 | Weak "does not throw" assertions — no output/state verification | `test/chat/ChatCLI.test.ts`, `test/chat/integration.test.ts` |
| 3 | E2E tests `return` instead of `it.skip()` — silently passes instead of reporting skip | `test/e2e/full-loop-local.test.ts` |
| 4 | Pre-existing flaky tests under parallel load | `test/unit/sandbox.test.ts`, `test/integration/run-merge-approve-api.test.js` |

---

## 20. Security Findings

### Good (doing right)
- No `eval()`, `new Function()`, or `vm` module usage
- `execFile` (not `exec`) with path sanitization via `validateFilePath`
- Dedicated `PathSanitizer`, `ImportValidator`, `UrlValidator` modules
- SSRF protection in LLM client with configurable policies
- Helmet middleware, CSRF protection, rate limiting on preview server
- Security logging module exists
- No hardcoded secrets in source
- `.env` properly gitignored

### Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | `innerHTML` with unsanitized `err.message` in `htmlWrapper.ts:533` — XSS vector in generated HTML | MEDIUM |
| 2 | User input reaches LLM prompts without sanitization — prompt injection risk (inherent to domain) | MEDIUM |
| 3 | `csurf` package is **deprecated and archived** — no security patches | MEDIUM |
| 4 | Landing page iframes load LLM-generated code — if malicious, runs in iframe context | LOW |
| 5 | `@playwright/test` in production `dependencies` — unnecessary attack surface in prod installs | MEDIUM |

---

## 21. Documentation Gaps

| # | Issue | Severity |
|---|-------|----------|
| 1 | No `CONTRIBUTING.md` | HIGH |
| 2 | No `CODE_OF_CONDUCT.md` | MEDIUM |
| 3 | No `LICENSE` file (package.json says MIT, but no license text) | CRITICAL |
| 4 | README is 934 lines — too long for a landing README | MEDIUM |
| 5 | README line 550 has broken markdown (stray backtick) | LOW |
| 6 | Swarm persona count contradiction — README says 7, table shows 5 | MEDIUM |
| 7 | `"2500+ tests passing"` — unverifiable claim, may be stale | LOW |
| 8 | No `.github/ISSUE_TEMPLATE/` | MEDIUM |
| 9 | No `.github/PULL_REQUEST_TEMPLATE.md` | LOW |
| 10 | Version inconsistency: `VERSION` says `0.2.0.0`, package.json says `1.0.0`, bin says `v1.0.0` | MEDIUM |

---

## 22. TypeScript & Build Config

| # | Issue | Severity |
|---|-------|----------|
| 1 | `strict: true` is set | GOOD |
| 2 | Missing `noUncheckedIndexedAccess` flag | LOW |
| 3 | `moduleResolution: "bundler"` used without actual bundler | LOW |
| 4 | No bundling, minification, or tree-shaking — `dist/` mirrors `src/` | LOW |
| 5 | `postinstall` runs `npm run build` — fails in production installs where devDeps are absent | MEDIUM |

---

## 23. Prompt Template Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | p5 prompt has contradictory instructions: "NO markdown fences" vs "wrapped in a markdown code block" | MEDIUM |
| 2 | User input interpolated without sanitization — prompt injection risk | MEDIUM |
| 3 | Prompt versioning and validation exist | GOOD |

---

## 24. Package.json Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | `@playwright/test` in `dependencies` instead of `devDependencies` | MEDIUM |
| 2 | `p5` in `dependencies` — browser library, should be dev/peer | LOW |
| 3 | No `"exports"` field — deep imports not formally supported | LOW |
| 4 | `"author"` field is empty string `""` | LOW |
| 5 | Missing `ffmpeg` peer dependency (used by Compositor) | LOW |

---

## 25. Gitignore Gaps

| # | Issue | Severity |
|---|-------|----------|
| 1 | Dogfood result files tracked (`agent-b-results.json`, `dogfood-*.json`) | LOW |
| 2 | Test artifact dirs tracked (`test-results/`, `test-stream/`, `test-comparison/`, etc.) | LOW |
| 3 | `landing-assets/` mixes production showcase with test/debug artifacts | LOW |
| 4 | `landing-archive/` and `landing-live/` build artifacts tracked | LOW |

---

## 26. GitHub Presentation Audit

### Repo metadata (as seen by visitors)

| Field | Current State | Fix |
|-------|---------------|-----|
| Description | **Empty** | Add: "Creative coding agent — LLM-powered generative art, music, video, and interactive visuals" |
| Homepage URL | **Empty** | Add link to landing page or demo |
| Topics/tags | **None** | Add: `generative-art`, `creative-coding`, `p5js`, `llm`, `agent`, `typescript` |
| Wiki | Enabled (likely empty) | Disable if unused |
| Issues | Enabled | Good — add templates |
| License | **No LICENSE file** | Must add MIT LICENSE file |

### Files that should NOT be public (tracked in git)

~40 internal documents, test logs, and development debris are tracked:

**Internal audit/analysis reports:**
`AGENTS.md`, `AGENT_A_RESULTS.md`, `AGENT_B_README.md`, `ATOMIC_TASKS.md`, `AUDIT_FINDINGS.md`, `BROKEN_EXAMPLES_ANALYSIS.md`, `DOGFOOD_QUEUES.md`, `FUNCTIONAL_ADVERSARIAL_AUDIT.md`, `GITHUB_GUARDIAN_AUDIT.md`, `LANDING_PAGE_SPEC.md`, `LIMINAL_IMPROVEMENTS_SUMMARY.md`, `PRD.md`, `PREEXISTING_ISSUES_LOG.md`, `RED_TEAM_AUDIT_REPORT.md`, `REMEDIATION_PLAN.md`, `REMEDIATION_QUICKSTART.md`, `SECURITY_AUDIT_CHECKLIST.md`, `SILENT_FAILURES_AUDIT.md`

**Dogfood/test artifacts:**
`agent-b-results.json`, `dogfood-*.json`, `dogfood-*.md`, `dogfood-*.log`, `regeneration.log`, `test-*.log`, `landing-validation-report.json`

**Test screenshots:**
`test-crystal.png`, `test-jellyfish.png`, `test-neon.png`, `test-ocean.png`, `test-plasma.png`, `landing-*.png` (30+ files)

**Bloated directories:**
`landing-assets/` (144 entries, many test/debug), `landing-archive/`, `landing-live/` (build outputs), `test-comparison/`, `test-results/`, `output/`, `dogfood-temp/`

**Stale helper scripts:**
`capture-screenshot.cjs`, `capture-screenshot.js`, `capture.cjs`, `generate-all-examples.ts`, `generate-example.ts`, `generate-examples.cjs`, `record-animation.cjs`, `record-video.cjs`, `run-agent-a-tests.sh`, `run-dogfood.mjs`

---

## 27. Landing Page Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | GitHub SVG icon is broken — path data truncated/malformed | MEDIUM |
| 2 | Claims "v2.0 — The Unification" — contradicts v1.0 everywhere else | MEDIUM |
| 3 | Shows internal dev stats ("20 Tasks Completed", "8 Files Modified") — meaningless to visitors | MEDIUM |
| 4 | "View Full Impact Report" links to internal `docs/IMPACT_REPORT.html` | MEDIUM |
| 5 | Quick Start says `npm install` — README says `pnpm install` | MEDIUM |
| 6 | `c` variable undefined in p5 sketch — uses `c.width`/`c.height` outside scope | LOW |
| 7 | No favicon file — uses inline SVG data URL | LOW |

---

## 28. Severity Summary

### CRITICAL (blocks public launch) — 6 issues
1. **No LICENSE file** — default copyright applies, contradicting MIT claim
2. **CI is red** — 5 consecutive failures, TS build errors with missing deps (`mdast`, `zod`)
3. **~40 internal documents tracked** — audit reports, security findings, red team reports all publicly visible
4. **No GitHub description, topics, or homepage** — repo is invisible to discovery
5. **CompostSoup never reloads evolved population** — soup feature is fundamentally broken
6. **Compost heap data loss** — purge after digest with no seed save guarantee

### HIGH (functional bugs) — 12 issues
7. `--aesthetic` and `--voice` flags are dead — silently ignored at runtime
8. LLM auth failure returns comment-code that passes validation — loop runs uselessly
9. LLM timeout bypass — custom signal replaces built-in timeout
10. `pr-review.yml` missing pnpm install — PR review CI fails
11. 30+ modules have zero tests including ConfigLoader, LLMClient, all security modules
12. `GlitchEffects` generator completely orphaned
13. `registerAllGenerators()` fragile guard — any prior registration skips all built-ins
14. **1 critical CVE:** `loader-utils` prototype pollution (CVSS 9.8) via @remotion/bundler
15. RemotionRenderer temp projects never cleaned up — unbounded disk growth
16. npm postinstall fails for consumers (typescript is devDependency)
17. npm pack would publish 4,519 files / 13.1 MB with internal docs
18. 26/98 generated examples broken (67% valid rate)

### MEDIUM (degraded quality/reliability) — 34 issues
19. 8 bare `catch {}` blocks with zero logging
20. 80+ `console.log`/`console.warn` bypassing structured Logger
21. 29 `any` types in production code
22. 19 non-null assertions that mask undefined access
23. 7 `Promise.all` without individual error isolation
24. CDN URLs duplicated between `htmlWrapper.ts` and `constants.ts` — sync risk
25. `csurf` package deprecated — no security patches
26. `innerHTML` with unsanitized error message — XSS vector
27. Prompt injection — user input reaches LLM without sanitization
28. p5 prompt has contradictory markdown instructions
29. Ollama 429 responses not retried
30. No circuit breaker on LLM retry
31. SeedBank TOCTOU — concurrent access data loss
32. `postinstall` runs build — fails without devDeps
33. `@playwright/test` in production dependencies
34. Swarm persona count contradiction (5 vs 7)
35. Version mismatch (`VERSION` says 0.2.0.0, rest says 1.0.0)
36. No CONTRIBUTING.md or CODE_OF_CONDUCT.md
37. Landing page claims v2.0, shows internal stats, broken GitHub icon
38. E2E tests silently pass instead of proper skip
39. Soup cycle fragments never evolve from original population
40. 5 HIGH CVEs: `picomatch` ReDoS via eslint/vitest chains
41. 7 Windows compatibility issues (hardcoded `/`, `process.env.HOME`)
42. No graceful shutdown handlers (SIGTERM, SIGINT, state preservation)
43. No disk space checks anywhere; RemotionRenderer temp unbounded
44. Generator validation too weak — most generators only check non-empty string
45. Admin bypass on branch protection (`enforce_admins: false`)
46. ci.yml has no `permissions:` block
47. PR diffs sent to external LLM service (Zhipu AI) — data governance
48. No `prefers-reduced-motion` on landing page animations
49. Purple accent (#8b5cf6) contrast ~3.8:1 fails WCAG AA
50. No `<main>` landmark, no skip-to-content, no focus-visible
51. p5 prompt contradiction (no fences vs markdown block)
52. RemotionRenderer temp never cleaned; ParsingCache no eviction

### LOW (polish/optimization) — 14 issues
53. 11 TODO/FIXME comments indicating incomplete features
54. 5 stub implementations returning placeholder data
55. `moduleResolution: "bundler"` without bundler
56. Missing `noUncheckedIndexedAccess` tsconfig flag
57. No macOS/Windows CI matrix
58. No `exports` field in package.json
59. Empty `author` field in package.json
60. Test artifact directories tracked in git
61. No favicon on landing page
62. `p5` library in production dependencies
63. Git history is clean — no leaked secrets (GOOD finding)
64. 116 binary files tracked without LFS (90 ZIPs, 25 PNGs, 1 MP4)
65. `git lfs` not configured
66. No releases or tags exist

### GOOD (patterns worth replicating) — 8 items
67. Strict TypeScript mode enabled
68. No `eval()` or `vm` module usage
69. Proper `execFile` with path sanitization
70. Dedicated security modules (PathSanitizer, ImportValidator, UrlValidator)
71. SSRF protection with configurable policies
72. Helmet + CSRF + rate limiting on preview server
73. Prompt versioning and validation
74. No hardcoded secrets in source

---

## 29. Dependency Vulnerabilities

`pnpm audit` found **12 vulnerabilities** across 4 packages:

| Severity | Package | Issue | Advisory |
|----------|---------|-------|----------|
| **CRITICAL** | `loader-utils` | Prototype pollution (CVSS 9.8) | GHSA-76p3-8jx3-jpfq |
| **HIGH** | `loader-utils` | ReDoS via url variable | GHSA-3rfm-jhwj-7488 |
| **HIGH** | `loader-utils` | ReDoS | GHSA-hhq3-ff78-jv3g |
| **HIGH** | `picomatch` (via eslint/vitest) | ReDoS via extglob | GHSA-c2c7-rcm5-vvqj |
| **HIGH** | `picomatch` (via eslint/vitest) | Method Injection in POSIX Character Classes | GHSA-3v7f-55p6-f55p |
| **HIGH** | `picomatch` (via vitest) | Method Injection in POSIX Character Classes | GHSA-3v7f-55p6-f55p |
| **MODERATE** | `picomatch` (multiple paths) | Method Injection / ReDoS | Same as above |
| **MODERATE** | `path-to-regexp` (via express) | ReDoS via multiple wildcards | GHSA-27v5-c462-wpq7 |
| **LOW** | `cookie` (via csurf) | OOB characters in name/path/domain | GHSA-pxg6-pf52-xh8x |

**Breakdown: 1 critical, 5 high, 5 moderate, 1 low.**

The critical `loader-utils` issue comes through `@remotion/bundler > loader-utils`. The `overrides` in package.json claims it was fixed, but the transitive dependency was not actually bumped.

---

## 30. Git History Secrets

**CLEAN.** No leaked secrets found:
- No `.env`, `.key`, `.pem`, or `.secret` files ever deleted from git history
- No `sk-` (OpenAI key pattern) found in git history
- No `API_KEY=` hardcoded assignments found
- `.env.example` was created with placeholder values only

---

## 31. Repo Size & Bloat

| Metric | Value |
|--------|-------|
| `.git` directory | **37 MiB** |
| Loose objects | 6,659 (34.49 MiB) |
| `node_modules/` | **956 MiB** |
| `src/` | 2.0 MiB |
| `landing-assets/` | 2.1 MiB |

### Largest blobs in git history
| Size | File |
|------|------|
| 1.04 MiB | `landing-real-scores.png` |
| 0.99 MiB | `landing-final.png` |
| 0.91 MiB | `landing-true-dogfood-clean.png` |
| 0.88 MiB | `compost/seeds/seeds.json` |
| 0.58 MiB | `test-plasma.png` |

### Binary files tracked (without LFS)
- **90 `.zip` files** (mostly `landing-assets/`)
- **25 `.png` files**
- **1 `.mp4` file** (`landing-assets/dogfood-remotion-title.mp4`)

### Git LFS: **Not configured.** No `.gitattributes` file exists.

---

## 32. Platform Compatibility

| # | File | Issue |
|---|------|-------|
| 1 | `src/compost/SoupStateManager.ts:44` | Hardcoded `'/'` in `lastIndexOf` — fails on Windows |
| 2 | `src/compost/CompostHeap.ts:96` | Hardcoded `'/'` in path construction |
| 3 | `src/core/lir/CompatibilityAdapter.ts:170,211` | Hardcoded `'/'` in `split('/')` |
| 4 | `src/routing/RoutingData.ts:37`, `src/learning/QualityArchive.ts:93`, `src/core/RalphLoop.ts:122,127` | `` `${process.env.HOME}/...` `` — `HOME` undefined on Windows |
| 5 | `bin/liminal` | Falls back to `/tmp` on missing HOME — Unix-only |
| 6 | `src/export/VideoExporter.ts:22`, `src/composite/Compositor.ts:222` | `ffmpeg` invoked without cross-platform resolution |
| 7 | Zero `process.platform` checks | Entire codebase assumes Unix |

---

## 33. Signal Handling & Graceful Shutdown

| # | Issue |
|---|-------|
| 1 | **No SIGTERM handler** — process cannot be gracefully stopped by process managers |
| 2 | **Only 1 SIGINT handler** — in `ChatCLI.tsx:285`, just closes readline and exits with no state preservation |
| 3 | **No state preservation on forced exit** — QualityArchive, AestheticModel, EpisodicMemory data lost |
| 4 | **PreviewServer never calls `stop()` on signals** — SSE clients disconnected without notification |
| 5 | **RemotionRenderer temp projects never cleaned up** — accumulate indefinitely in `os.tmpdir()` |

### Ctrl+C behavior
- **During LLM generation:** Process terminates immediately, in-flight HTTP request abandoned, no state saved
- **During compost digest:** Process terminates, digest file may be partially written (corrupted)
- **During soup cycle:** Process terminates, soup state may or may not be saved
- **With preview server:** Express server stops, `server.close()` never called, SSE clients disconnected

---

## 34. Disk Exhaustion & Resource Exhaustion

| # | Issue |
|---|-------|
| 1 | **Zero disk space checks** before any write operation |
| 2 | **RemotionRenderer temp projects** — creates new temp dirs per render, never deletes |
| 3 | **ParsingCache** — no size limit, no eviction policy, grows unbounded |
| 4 | **No log rotation** exists anywhere |
| 5 | **CanvasRecorder** can consume GB of temp space for long recordings |

---

## 35. npm Publishability

| # | Issue | Impact |
|---|-------|--------|
| 1 | **`postinstall: npm run build`** — fails for consumers because `typescript` is devDependency | Consumers can't install |
| 2 | **No `files` field, no `.npmignore`** — 4,519 files / 13.1 MB published | Bloated package |
| 3 | **~40 internal docs would be published** — audit reports, remediation plans, dogfood results | Embarrassing |
| 4 | **No LICENSE file** despite `"license": "MIT"` | Legal risk |
| 5 | **`bin/liminal` depends on `dist/`** existing at runtime | Circular dependency with postinstall |

---

## 36. Generator Output Correctness

**98 generated files analyzed: 67% valid rate (66/98)**

| Category | Count |
|----------|-------|
| Clearly broken (error comments) | 26 |
| Partially broken (error + fragment) | 3 |
| Template-quality (code but poor) | 3 |
| **Valid output** | **66** |

### Best-performing domains
- **Tone.js:** 1/1 valid (100%)
- **Three.js:** 11/12 valid (92%)
- **GLSL:** 10/13 valid (77%)
- **P5:** 10/14 valid (71%)

### Worst-performing domains
- **ASCII:** 2/8 valid (25%)
- **HTML:** 6/11 valid (55%)
- **Strudel:** 8/12 valid (67%)

### Validation gaps by generator
- **P5GeneratorLLM:** Only checks non-empty — no p5 API verification
- **ThreeGenerator:** Only checks non-empty — no THREE.Scene verification
- **RemotionGenerator:** Only checks non-empty — no Composition/Sequence verification
- **HTMLWebGenerator:** Checks for `<!DOCTYPE html>` or `<html` — no structure validation
- **ASCIIArtGenerator:** Checks non-empty, strips code blocks — no density/quality check
- **ShaderGenerator:** Best validation — checks `void main`, `gl_FragColor`, truncation, brace balance
- **HydraGenerator:** Second best — filters explanation lines, auto-appends `.out(o0)`
- **ToneGenerator:** Checks for `Tone` keyword — but too broad (matches "subtone", "tone-deaf")

---

## 37. GitHub Settings & Branch Protection

| # | Setting | Value | Issue |
|---|---------|-------|------|
| 1 | Admin bypass | **Enabled** (`enforce_admins: false`) | Any admin can push directly to main, bypassing all checks |
| 2 | Required reviews | 1 approval | Good, but `require_last_push_approval: false` — pusher can self-approve |
| 3 | Conversation resolution | **Not required** | Unresolved threads don't block merge |
| 4 | CI `permissions:` block | **Missing** in `ci.yml` | Runs with default write token |
| 5 | Action version pinning | Major-only (`@v4`) | Should pin to full SHA |
| 6 | PR review diffs | Sent to external LLM (Zhipu AI) | Data governance concern |
| 7 | CODEOWNERS | **Missing** | No required code owner reviews |
| 8 | GitHub Pages | **Not enabled** | Landing page not hosted |
| 9 | Releases/Tags | **None** | No versioned releases |
| 10 | Repo topics | **None** | Invisible to GitHub search |

---

## 38. Landing Page Accessibility

| # | Issue | WCAG Level |
|---|-------|------------|
| 1 | No `prefers-reduced-motion` support | Fails 2.3.3 |
| 2 | Purple `#8b5cf6` contrast ~3.8:1 on dark bg | Fails AA (needs 4.5:1) |
| 3 | No `<main>` landmark element | Fails 1.3.1 |
| 4 | No skip-to-content link | Fails 2.4.1 |
| 5 | No `:focus-visible` styles | Fails 2.4.7 |
| 6 | No ARIA labels on sections | Fails 1.3.1 |
| 7 | Iframes lack `sandbox` attribute | Security concern |
| 8 | Gallery cards not keyboard-interactive | Fails 2.1.1 |
| 9 | Pulse dot not `aria-hidden` | Fails 4.1.2 |
| 10 | No `<nav>` element for GitHub links | Fails 1.3.1 |

**Good:** Proper heading hierarchy ( h1→h2→h3), `<html lang="en">`, viewport meta, iframe titles present.

---

## DELTA AUDIT — Commits After Original Audit

**Commits audited:** `aa469b9`, `f03b05e`, `6d4dbc4` (3 commits, +4229/-540 lines)
**Date:** 2026-03-31 → 2026-04-01

### What changed

| Area | Change | Impact |
|------|--------|--------|
| **Meta-Harness** | 4 new files in `src/harness/` | Failure logging, pattern detection, adaptation system |
| **P5Generator** | Gutted: -335 lines, removed all template generation | All p5 now goes through LLM, sync→async breaking change |
| **CodeValidator** | +156 lines: size validation, GLSL semantics, Tone.js API whitelist | Substantial quality improvement |
| **RegisterGenerators** | Removed ParticleSystem/CellularAutomata/FlowField routing | Template generators no longer dispatched |
| **LLMClient** | Qwen thinking trap mitigation, Ollama options, timeout increase | Model-specific fixes |
| **Generators** | ASCIIArtGenerator, StrudelGenerator, ToneGenerator prompt hardening | Validation improvements |
| **Tests** | New `scripts/test-qwen-models.ts`, Qwen3.5-0.8b model added | Broader model coverage |
| **Docs** | New architecture docs, README update, CHANGELOG 0.3.0.0 | Documentation expansion |

---

### 39. Meta-Harness — New Module (DEAD CODE)

**Files:** `src/harness/FailureLogger.ts`, `PatternDetector.ts`, `HarnessUpdater.ts`, `index.ts`

The Meta-Harness is a self-improving infrastructure that logs failures, detects patterns, and applies adaptations. It is architecturally coherent but **completely inert**:

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Nothing imports the harness** — zero references outside `src/harness/`. Not in `src/index.ts`, not in `bin/liminal`, not in any generator. | CRITICAL |
| 2 | **HarnessUpdater is performative no-op** — all `apply*` methods log `applied: true` but don't modify any prompts or configs. The "adaptations" are theater. | HIGH |
| 3 | **PatternDetector.analyzeRecentFailures() is misleading async** — declared `async` but does no async work | LOW |
| 4 | **FailureLogger.getRecentFailures() crashes on corrupted JSON** — `JSON.parse` without try/catch. One bad `.json` file prevents reading all failures. | HIGH |
| 5 | **FailureLogger.log() has no try/catch** around `writeFileSync` — disk-full or permission error crashes caller | MEDIUM |
| 6 | **Unvalidated type assertion** `as FailureRecord` on parsed JSON | MEDIUM |
| 7 | **Singleton side effects** — module-level instantiation creates `~/.liminal/failures/` directory at import time | LOW |
| 8 | **10 new `console.log` leaks** in production code (should use Logger) | MEDIUM |
| 9 | **Deprecated `substr` usage** in FailureLogger (should use `substring`) | LOW |

---

### 40. CodeValidator Improvements

**+156 lines** of new validation logic. Addresses several original audit findings:

| Check | What it does | Issue Status |
|-------|--------------|--------------|
| Size validation (Check 4) | Per-domain minimum sizes (p5=500b, shader=800b, etc.) | **Fixed** — catches 66b/74b empty "successes" |
| Quality validation (Check 5) | GLSL noise/animation, Three.js import mixing | **Partially fixed** |
| GLSL semantics (Check 5.5) | Regex-based function call validation, undefined function detection | **Partially fixed** — has false positives |
| Tone.js API (Check 5.6) | Whitelist of ~70 valid `Tone.*` classes, hallucination patterns | **Partially fixed** — wrong gating condition |

**Remaining issues:**

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Tone.js validation only fires on `domain === 'unknown'`** — should fire on `domain === 'tone'`. Defeats the purpose. | HIGH |
| 2 | **GLSL semantic regex matches ANY identifier + `(`** — catches preprocessor macros, struct constructors. False positives. | MEDIUM |
| 3 | **GLSL builtin set includes `noise`/`hash`/`fbm`/`snoise`** — these are NOT GLSL builtins. They're library functions that may or may not be defined. Inconsistent: sometimes passes missing functions. | MEDIUM |
| 4 | **`%` operator check is GLSL ES 1.0 only** — GLSL ES 3.0 supports `%` on integers. False positives on modern shaders. | LOW |

---

### 41. P5Generator Breaking Change

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Sync→async breaking change** — `generate()` now returns `Promise<string>`. Callers using `P5Generator.generate(prompt)` without `await` silently get `[object Promise]`. | HIGH |
| 2 | **Template generators removed** — ParticleSystem, CellularAutomata, FlowField no longer dispatched. System requires LLM for ALL p5 generation. Offline capability lost. | MEDIUM |
| 3 | **Old classes still exported** from `src/index.ts` but not registered — confusing API surface | LOW |
| 4 | **`_context` parameter silently dropped** — iteration history from RalphLoop never reaches the LLM generator | MEDIUM |

---

### 42. LLMClient Changes

**Partially fixed, partially worsened:**

| # | Issue | Status |
|---|-------|--------|
| 1 | **Timeout bypass bug** — `signal || AbortSignal.timeout(timeoutMs)` still present. **NOT FIXED.** | Still HIGH |
| 2 | **Qwen thinking trap** — `isQwenModel()` + `extractCodeFromThinking()` added for p5. Only in `generateP5Sketch()`, not general `generate()`. | Partially fixed |
| 3 | **`extractCodeFromThinking` regex too greedy** — `[\s\S]*` matches from first `{` to LAST `}`, producing malformed code from multi-function thinking. Should be `[\s\S]*?` | MEDIUM |
| 4 | **Redundant model check** — `model.includes('qwen') || model.includes('qwen3.5')` — second condition always redundant since `'qwen3.5'` contains `'qwen'` | LOW |
| 5 | **Hardcoded Qwen prompt** in `generateP5Sketch()` — bypasses PromptLibrary, can't be versioned | MEDIUM |
| 6 | **Ollama options added** — `num_predict`, `num_ctx`, temperature pass-through. `numCtx` capped at 32768. | GOOD |
| 7 | **Timeout increased to 300s** — reasonable for local models. | GOOD |
| 8 | **Default maxTokens reduced to 4096** — prevents OOM on 8GB GPUs. | GOOD |

---

### 43. Generator Validation Changes

**ASCIIArtGenerator:**
- Dead `typeof response === 'string'` check — `LLMClient.generate()` always returns `LLMResponse`, never a string
- Any LLM response is silently padded/truncated to fit dimensions — garbage in, "valid" ASCII art out

**StrudelGenerator:**
- Overly aggressive filtering — requires every line to contain specific Strudel keywords. Valid supporting code (`const bpm = 120`, `if`, `for`) gets stripped
- New throw on no sound source — good, but runs AFTER aggressive filtering that may have removed the sound source

**ToneGenerator:**
- Prompt hardening only (system prompt text changes). No code logic changes. Clean improvement.

---

### 44. New Generated Examples Quality

**10 of 11 new examples are broken or degenerate:**

| Example | Status | Issue |
|---------|--------|-------|
| Granite4-1b/glsl | BROKEN | Calls `fbm()` without defining it |
| Granite4-1b/html | POOR | Placeholder content, `via.placeholder.com` (404s) |
| Granite4-1b/tone | BROKEN | Invalid Tone.js API (`Oscillator('sine', 'noteA').frequency(440)`) |
| Granite4-1b/strudel | BROKEN | Garbled mini-notation, neither valid Strudel nor TidalCycles |
| Granite4-1b/ascii | DEGENERATE | Only `@#` (2 bytes) |
| Granite4-1b/p5 | BROKEN | Uses non-existent `smooth()` function, wrong `fill()` args |
| Granite4-1b/three | BROKEN | `THREE.ParametricGeometry` with wrong signature, undefined variables |
| Granite4-1b/remotion | BROKEN | Non-existent Remotion API (`frame.value`, invalid AbsoluteFill props) |
| Granite4-1b/hydra | QUESTIONABLE | `beat()` is not standard Hydra |
| Gemma3-4B/ascii | FAILED | Timeout error comment |
| Qwen3.5-0.8b/p5 | DEGENERATE | 337 lines of repeated `var x/y/z` declarations — model fell into degenerate loop |

**Note:** The Granite4-1b model produces unusable output across ALL domains. This contradicts the Meta-Harness narrative — the harness should be detecting this pattern but is dead code.

---

### 45. Documentation Accuracy Issues

| # | Doc | Issue |
|---|-----|-------|
| 1 | `docs/AGENT_GENERATOR_ARCHITECTURE.md` | Labeled "Proposal" but claims Phase 1-2 complete. Phase 3-4 reference files/classes that don't exist (`HarnessRegistry.ts`, `MetaHarness`). Config format is aspirational. |
| 2 | `docs/PROMPTS.md` | Claims 27 prompts, but there are 38 `PromptLibrary.register` calls. Missing: compost.ts (7), remotion.ts (2), audio.ts (1), specialized/chat.ts (1). |
| 3 | README usage example | Import `from 'liminal'` is incorrect — actual import is `from './src/harness/index.js'`. |
| 4 | CHANGELOG 0.3.0.0 | Version not reflected in `package.json` (still `1.0.0`) or `VERSION` file (still `0.2.0.0`). Three inconsistent versions. |
| 5 | `GAPS_AND_IMPROVEMENTS.md` | Internal contradictions — section 3.1 still describes old state while section 6 says "REMOVED". |

---

### Original Audit Finding Status Update

| # | Finding | Original Severity | New Status |
|---|---------|-------------------|------------|
| 1 | No LICENSE file | CRITICAL | **UNFIXED** |
| 2 | CI is red | CRITICAL | **UNFIXED** — same 6 TypeScript build errors persist |
| 3 | ~40 internal docs tracked | CRITICAL | **WORSENED** — new docs added (AGENT_GENERATOR_ARCHITECTURE.md, ARCHITECTURE_AND_PHILOSOPHY.md, PROMPTS.md) |
| 4 | No GitHub description/topics | CRITICAL | **UNFIXED** |
| 5 | CompostSoup never reloads population | CRITICAL | **UNFIXED** |
| 6 | Compost heap data loss | CRITICAL | **UNFIXED** |
| 7 | `--aesthetic`/`--voice` dead flags | HIGH | **UNFIXED** |
| 8 | LLM auth failure returns comment-code | HIGH | **UNFIXED** |
| 9 | LLM timeout bypass bug | HIGH | **UNFIXED** |
| 10 | `pr-review.yml` missing pnpm install | HIGH | **UNFIXED** |
| 11 | 30+ untested modules | HIGH | **WORSENED** — 4 new harness modules added with zero tests |
| 12 | GlitchEffects orphaned | HIGH | **UNFIXED** |
| 13 | RegisterGenerators fragile guard | HIGH | **UNFIXED** — same `entries.length > 0` guard |
| 14 | 1 critical CVE (loader-utils) | HIGH | **UNFIXED** |
| 15 | No console.log→Logger migration | MEDIUM | **WORSENED** — 10 new console.log in harness |
| 16 | 80+ console.log leaks | MEDIUM | **NOW 90+** |
| 17 | P5 prompt contradiction | MEDIUM | **FIXED** — template code removed |
| 18 | Empty/undersized outputs pass validation | MEDIUM | **FIXED** — CodeValidator size checks |
| 19 | GLSL undefined functions not caught | MEDIUM | **PARTIALLY FIXED** — semantic validation added but has false positives |
| 20 | Tone.js API hallucinations | MEDIUM | **PARTIALLY FIXED** — whitelist added but wrong gating condition |

### New issues introduced by post-audit commits

| # | Finding | Severity |
|---|---------|----------|
| N1 | **Meta-Harness is dead code** — nothing imports it | CRITICAL |
| N2 | **HarnessUpdater is performative no-op** — logs adaptations that don't actually happen | HIGH |
| N3 | **FailureLogger.getRecentFailures() crashes on corrupted JSON** | HIGH |
| N4 | **Tone.js validation gates on wrong domain** (`unknown` instead of `tone`) | HIGH |
| N5 | **P5Generator sync→async breaking change** | HIGH |
| N6 | **`extractCodeFromThinking` regex too greedy** — produces malformed code | MEDIUM |
| N7 | **StrudelGenerator over-filtering strips valid code** | MEDIUM |
| N8 | **Hardcoded Qwen prompt bypasses PromptLibrary** | MEDIUM |
| N9 | **Granite4-1b model produces 100% broken output** — contradicts Meta-Harness narrative | MEDIUM |
| N10 | **Qwen3.5-0.8b degenerate repetition loop** — 337 lines of repeated declarations | MEDIUM |
| N11 | **3 version numbers now inconsistent** (VERSION=0.2.0.0, package.json=1.0.0, CHANGELOG=0.3.0.0) | LOW |
| N12 | **10 new console.log leaks** in harness | MEDIUM |
| N13 | **PROMPTS.md claims 27 prompts, actually 38** | LOW |
| N14 | **README import example incorrect** (`from 'liminal'`) | LOW |
| N15 | **test-qwen-models.ts creates untracked output dir** | LOW |

---

### Updated Severity Summary

**CRITICAL: 7** (was 6, +1 new)
**HIGH: 17** (was 12, +5 new)
**MEDIUM: 44** (was 34, +10 new)
**LOW: 18** (was 14, +4 new)
**GOOD: 9** (was 8, +1 new — Ollama options + timeout)

---

*End of audit. Updated 2026-04-01 with delta findings from 3 post-audit commits.*
