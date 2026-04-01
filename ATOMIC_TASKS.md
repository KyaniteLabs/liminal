# Atomic Task Tracker

**Format:** Each task is atomic (single action), independently verifiable  
**Tracking:** Check off [ ] when complete, sign with initials/date  

---

## Legend

- `[ ]` — Not started
- `[/]` — In progress
- `[x]` — Complete (verified)
- `[~]` — Skipped/Won't fix (document why)

**Verification Required For:**
- Code changes: PR review + test pass
- Docs changes: Review by second person
- Config changes: Test in clean environment

---

## P0.1: Missing Audio Dependencies

### Discovery Phase
- [ ] **P0.1.1.1** — Search for all "meyda" references in codebase
- [ ] **P0.1.1.2** — Search for all "pitchfinder" references in codebase
- [ ] **P0.1.1.3** — List all files importing audio modules
- [ ] **P0.1.1.4** — Document graceful degradation behavior

### Decision Phase
- [ ] **P0.1.2.1** — Create decision document: Integrate/Remove/Optional
- [ ] **P0.1.2.2** — Get approval on decision
- [ ] **P0.1.2.3** — Document rationale in ADR (Architecture Decision Record)

### Integration Path (if chosen)
- [ ] **P0.1.3.1** — Add "meyda": "^5.6.3" to package.json dependencies
- [ ] **P0.1.3.2** — Add "pitchfinder": "^3.0.1" to package.json dependencies
- [ ] **P0.1.3.3** — Run `npm install` and verify lockfile updated
- [ ] **P0.1.3.4** — Run `npm test` and verify audio tests pass
- [ ] **P0.1.3.5** — Verify no TypeScript compilation errors

### Optional Path (if chosen)
- [ ] **P0.1.4.1** — Move dependencies to "optionalDependencies"
- [ ] **P0.1.4.2** — Create feature detection function
- [ ] **P0.1.4.3** — Add warning on first audio feature use
- [ ] **P0.1.4.4** — Update types to reflect optional availability
- [ ] **P0.1.4.5** — Document optional feature in README

### Removal Path (if chosen)
- [ ] **P0.1.5.1** — Remove audio imports from all files
- [ ] **P0.1.5.2** — Remove audio exports from index.ts
- [ ] **P0.1.5.3** — Remove audio tests
- [ ] **P0.1.5.4** — Remove audio documentation from README
- [ ] **P0.1.5.5** — Add note to CHANGELOG about removal

---

## P0.2: ESLint Error

- [ ] **P0.2.1.1** — Read current regex: `/[\\x00-\\x1f]/g`
- [ ] **P0.2.1.2** — Verify security requirement for control char filtering
- [ ] **P0.2.2.1** — Choose fix approach (unicode escape / eslint-disable / whitelist)
- [ ] **P0.2.2.2** — Document chosen approach
- [ ] **P0.2.3.1** — Implement fix in PathSanitizer.ts line 19
- [ ] **P0.2.3.2** — Add explanatory comment with security note
- [ ] **P0.2.4.1** — Run `npm run lint`
- [ ] **P0.2.4.2** — Verify no errors
- [ ] **P0.2.5.1** — Test PathSanitizer still rejects null bytes
- [ ] **P0.2.5.2** — Test normal paths still accepted
- [ ] **P0.2.5.3** — Run PathSanitizer unit tests

---

## P0.3: Duplicate Promise Detection

- [ ] **P0.3.1.1** — Open RalphLoop.ts
- [ ] **P0.3.1.2** — Identify line 421-428 (first check + onProgress)
- [ ] **P0.3.1.3** — Identify line 439-443 (second check + break)
- [ ] **P0.3.1.4** — Identify line 446-450 (third check - DEAD CODE)
- [ ] **P0.3.2.1** — Delete lines 446-450
- [ ] **P0.3.3.1** — Verify remaining flow: detect → emit → break
- [ ] **P0.3.3.2** — Add comment explaining promise detection flow
- [ ] **P0.3.4.1** — Trace through logic mentally
- [ ] **P0.3.4.2** — Verify no duplicate checks remain
- [ ] **P0.3.5.1** — Run `npm test -- test/unit/ralph-loop.test.ts`
- [ ] **P0.3.5.2** — Verify all promise detection tests pass

---

## P1.1: Persona Count Documentation

- [ ] **P1.1.1.1** — Search README.md for "7 Personas"
- [ ] **P1.1.1.2** — Search PRD.md for persona count claims
- [ ] **P1.1.1.3** — Search all .md files for persona references
- [ ] **P1.1.1.4** — Create list of all files needing updates
- [ ] **P1.1.2.1** — Update README.md line ~209: "7" → "5"
- [ ] **P1.1.2.2** — Update PRD.md if needed
- [ ] **P1.1.2.3** — Update any other docs
- [ ] **P1.1.3.1** — Open test/swarm/personas.test.ts
- [ ] **P1.1.3.2** — Add test: DEFAULT_PERSONAS.length === 5
- [ ] **P1.1.3.3** — Run test and verify passes
- [ ] **P1.1.4.1** — Open src/swarm/personas.ts
- [ ] **P1.1.4.2** — Add comment explaining why 5 personas

---

## P1.2: Test Count Documentation

- [ ] **P1.2.1.1** — Search README.md for "2365"
- [ ] **P1.2.1.2** — Search all docs for test count references
- [ ] **P1.2.2.1** — Run `npm test` and note exact passing count
- [ ] **P1.2.2.2** — Update README.md with correct count
- [ ] **P1.2.3.1** — Create script to extract test count from output
- [ ] **P1.2.3.2** — Create CI check comparing doc count to actual
- [ ] **P1.2.3.3** — Test CI check fails when counts mismatch

---

## P1.3: CSRF Test Failures

- [ ] **P1.3.1.1** — Open src/render/PreviewServer.ts
- [ ] **P1.3.1.2** — Find CSRF middleware
- [ ] **P1.3.1.3** — Understand token generation mechanism
- [ ] **P1.3.1.4** — Understand token validation mechanism
- [ ] **P1.3.2.1** — Choose approach: disable in test / extract token / bypass header
- [ ] **P1.3.2.2** — Document chosen approach
- [ ] **P1.3.3.1** — Implement chosen approach
- [ ] **P1.3.3.2** — Verify implementation doesn't affect production
- [ ] **P1.3.4.1** — Run `npm test -- test/integration/preview-server-api.test.js`
- [ ] **P1.3.4.2** — Verify all tests pass

---

## P1.4: Sandbox Timeout Test

- [ ] **P1.4.1.1** — Open src/sandbox/SandboxRunner.ts
- [ ] **P1.4.1.2** — Find timeout implementation
- [ ] **P1.4.1.3** — Verify timeout mechanism exists
- [ ] **P1.4.2.1** — Run failing test with debug output
- [ ] **P1.4.2.2** — Determine if timeout is longer than test timeout
- [ ] **P1.4.2.3** — Identify exact cause of hang
- [ ] **P1.4.3.1** — Implement fix for timeout mechanism
- [ ] **P1.4.3.2** — Verify worker/iframe terminates on timeout
- [ ] **P1.4.4.1** — Adjust test timeout if needed
- [ ] **P1.4.4.2** — Adjust sandbox timeout if needed
- [ ] **P1.4.5.1** — Run `npm test -- test/unit/sandbox.test.ts`
- [ ] **P1.4.5.2** — Verify timeout test passes

---

## P2.1: AestheticModel Orphan

- [ ] **P2.1.1.1** — Open src/evolution/AestheticModel.ts
- [ ] **P2.1.1.2** — Document prediction capabilities
- [ ] **P2.1.1.3** — Check for training data requirements
- [ ] **P2.1.2.1** — Create decision: Wire/Remove/Document
- [ ] **P2.1.2.2** — Get approval
- [ ] **P2.1.3.1** — If wiring: Add useAestheticModel option
- [ ] **P2.1.3.2** — If wiring: Implement in scoring pipeline
- [ ] **P2.1.3.3** — If wiring: Add persistence
- [ ] **P2.1.3.4** — If wiring: Add tests
- [ ] **P2.1.4.1** — If removing: Add @deprecated JSDoc
- [ ] **P2.1.4.2** — If removing: Add deprecation warning
- [ ] **P2.1.5.1** — Update README to reflect status

---

## P2.2: MetaMode Orphan

- [ ] **P2.2.1.1** — Open src/evolution/MetaMode.ts
- [ ] **P2.2.1.2** — Document experiment tracking
- [ ] **P2.2.2.1** — Create decision: Wire/Remove/Document
- [ ] **P2.2.2.2** — Get approval
- [ ] **P2.2.3.1** — Implement chosen path
- [ ] **P2.2.3.2** — Update documentation

---

## P2.3: ArchiveLearning Partial Wire

- [ ] **P2.3.1.1** — Find ArchiveLearning usage in RalphLoop.ts
- [ ] **P2.3.1.2** — Verify instantiation (lines 114-118)
- [ ] **P2.3.1.3** — Verify storage (lines 325-331)
- [ ] **P2.3.1.4** — Check if retrieval is implemented
- [ ] **P2.3.2.1** — Determine if we're storing but not retrieving
- [ ] **P2.3.3.1** — Implement retrieval if needed
- [ ] **P2.3.3.2** — Implement example injection if needed
- [ ] **P2.3.4.1** — Remove "@library" comment if wired

---

## P2.4: DNAExtractor Orphan

- [ ] **P2.4.1.1** — Open src/scavenger/DNAExtractor.ts
- [ ] **P2.4.1.2** — Document extraction capabilities
- [ ] **P2.4.2.1** — Create decision: Wire/Remove/Document
- [ ] **P2.4.2.2** — Get approval
- [ ] **P2.4.3.1** — Implement chosen path
- [ ] **P2.4.3.2** — Update documentation

---

## P2.5: Silent Async Failures

- [ ] **P2.5.1.1** — Grep for "catch.*console.warn" in src/
- [ ] **P2.5.1.2** — Grep for empty catch blocks
- [ ] **P2.5.1.3** — Create list of all silent catches
- [ ] **P2.5.2.1** — Categorize each: best-effort / user-report / fail
- [ ] **P2.5.3.1** — Fix Category A (keep logging, use Logger)
- [ ] **P2.5.3.2** — Fix Category B (add to onProgress/event bus)
- [ ] **P2.5.3.3** — Fix Category C (propagate error)
- [ ] **P2.5.4.1** — Add EventTypes.ERROR_OCCURRED
- [ ] **P2.5.4.2** — Emit errors to event bus

---

## P2.6: Validation Failure Handling

- [ ] **P2.6.1.1** — Review RalphLoop.ts lines 196-203
- [ ] **P2.6.1.2** — Document current behavior
- [ ] **P2.6.2.1** — Choose behavior: skip/fail-fast/continue
- [ ] **P2.6.2.2** — Get approval
- [ ] **P2.6.3.1** — Add failOnValidationError option
- [ ] **P2.6.3.2** — Implement chosen behavior
- [ ] **P2.6.3.3** — Log validation failures clearly
- [ ] **P2.6.4.1** — Track validation failure rate
- [ ] **P2.6.4.2** — Report in result metadata

---

## P3.1: Hardware MIDI/OSC Docs

- [ ] **P3.1.1.1** — Find live.midiOutput config
- [ ] **P3.1.1.2** — Check for actual implementation
- [ ] **P3.1.2.1** — Remove or mark as roadmap
- [ ] **P3.1.2.2** — Create GitHub issue if keeping as roadmap

---

## P3.2: Live Preview Claims

- [ ] **P3.2.1.1** — Test actual preview capabilities
- [ ] **P3.2.1.2** — Document actual behavior
- [ ] **P3.2.2.1** — Update README with accurate description

---

## P3.3: RalphLoop Extraction

- [ ] **P3.3.1.1** — Identify extractable logic in RalphLoop.ts
- [ ] **P3.3.1.2** — List: Compost, Guidance, Routing
- [ ] **P3.3.2.1** — Create CompostIntegration.ts
- [ ] **P3.3.2.2** — Create GuidanceIntegration.ts
- [ ] **P3.3.2.3** — Create RoutingAnalytics.ts
- [ ] **P3.3.3.1** — Refactor RalphLoop to use new modules
- [ ] **P3.3.3.2** — Verify RalphLoop < 300 lines

---

## P3.4: E2E Tests

- [ ] **P3.4.1.1** — Identify critical E2E scenarios
- [ ] **P3.4.1.2** — List: full loop, swarm, chat, compost
- [ ] **P3.4.2.1** — Implement full loop E2E test
- [ ] **P3.4.2.2** — Implement swarm mode E2E test
- [ ] **P3.4.2.3** — Implement chat mode E2E test
- [ ] **P3.4.2.4** — Implement compost E2E test

---

## B1: Execution Validation

- [ ] **B1.1.1** — Design sandbox execution validation
- [ ] **B1.1.2** — Implement runtime error detection
- [ ] **B1.2.1** — Add to technical score calculation
- [ ] **B1.2.2** — Add tests for execution validation

---

## B2: Input Validation

- [ ] **B2.1.1** — Add prompt length limit
- [ ] **B2.1.2** — Add character whitelist
- [ ] **B2.1.3** — Strip control characters
- [ ] **B2.2.1** — Log prompt modifications
- [ ] **B2.2.2** — Alert on suspicious patterns

---

## B3: Cache Key Fix

- [ ] **B3.1.1** — Open LLMClient.ts cache implementation
- [ ] **B3.1.2** — Add model to cache key
- [ ] **B3.2.1** — Add cache invalidation on config change
- [ ] **B3.2.2** — Add TTL-based expiration

---

## B4: Rate Limiting

- [ ] **B4.1.1** — Add express-rate-limit middleware
- [ ] **B4.1.2** — Set default: 100 req/15min
- [ ] **B4.1.3** — Make configurable via options

---

## B5: EventBus Error Handling

- [ ] **B5.1.1** — Wrap listener calls in try-catch
- [ ] **B5.1.2** — Log listener errors
- [ ] **B5.2.1** — Add EventTypes.LISTENER_ERROR
- [ ] **B5.2.2** — Emit on listener failure

---

## B6: Gallery Validation

- [ ] **B6.1.1** — Add JSON structure validation
- [ ] **B6.1.2** — Add required fields check
- [ ] **B6.1.3** — Handle corrupted files gracefully

---

## B7: Graceful Shutdown

- [ ] **B7.1.1** — Add SIGTERM handler
- [ ] **B7.1.2** — Add SIGINT handler
- [ ] **B7.1.3** — Close servers gracefully
- [ ] **B7.1.4** — Save state before exit
- [ ] **B7.1.5** — Add timeout for forced exit

---

## B8: Config Validation

- [ ] **B8.1.1** — Choose validation library (Zod/JSON Schema)
- [ ] **B8.1.2** — Create CompostMill config schema
- [ ] **B8.1.3** — Validate on construction
- [ ] **B8.1.4** — Fail fast with clear errors

---

## B9: CrossDomainCrossover Decision

- [ ] **B9.1.1** — Review CrossDomainCrossover.ts
- [ ] **B9.1.2** — Determine integration approach
- [ ] **B9.2.1** — Wire into prompt generation OR
- [ ] **B9.2.2** — Remove if not useful

---

## B10: Telemetry

- [ ] **B10.1.1** — Design opt-in telemetry system
- [ ] **B10.1.2** — Implement feature usage tracking
- [ ] **B10.1.3** — Implement success/failure tracking
- [ ] **B10.1.4** — Add privacy controls

---

## Final Verification

### Before Merge
- [ ] **FV1** — All P0 items complete
- [ ] **FV2** — `npm test` passes 100%
- [ ] **FV3** — `npm run lint` passes
- [ ] **FV4** — `npm run typecheck` passes
- [ ] **FV5** — No new silent failures introduced

### Documentation
- [ ] **FV6** — README updated
- [ ] **FV7** — CHANGELOG.md updated
- [ ] **FV8** — ADRs created for decisions

### Manual Testing
- [ ] **FV9** — `liminal --prompt "test"` works
- [ ] **FV10** — `liminal chat` works
- [ ] **FV11** — `liminal --use-swarm` works
- [ ] **FV12** — Preview server works

---

## META: Meta-Harness Implementation (2026-04-01)

**Status:** [x] Complete  
**Assignee:** Kimi Code  

### Deliverables
- [x] **META.1** — FailureLogger implementation (`src/harness/FailureLogger.ts`)
- [x] **META.2** — PatternDetector with 6 known patterns (`src/harness/PatternDetector.ts`)
- [x] **META.3** — HarnessUpdater with adaptations (`src/harness/HarnessUpdater.ts`)
- [x] **META.4** — Meta-harness exports (`src/harness/index.ts`)
- [x] **META.5** — Qwen model detection in LLMClient
- [x] **META.6** — Simplified prompts for Qwen models
- [x] **META.7** — Thinking field extraction fallback
- [x] **META.8** — GLSL semantic validation (undefined functions, invalid operators)
- [x] **META.9** — Tone.js API whitelist validation
- [x] **META.10** — Strudel anti-patterns documentation
- [x] **META.11** — PRD.md Meta-Harness section (11.5)
- [x] **META.12** — README.md Meta-Harness section
- [x] **META.13** — docs/ARCHITECTURE_AND_PHILOSOPHY.md Meta-Harness section
- [x] **META.14** — docs/PROMPTS.md model-specific adaptations section
- [x] **META.15** — CHANGELOG.md v0.3.0.0 entry
- [x] **META.16** — LIMINAL_IMPROVEMENTS_SUMMARY.md Meta-Harness section

### Patterns Implemented
- [x] `qwen-thinking-trap` — Qwen models stuck in thinking mode
- [x] `glsl-undefined-function` — GLSL uses undefined functions
- [x] `tone-hallucinated-api` — Tone.js hallucinates non-existent classes
- [x] `strudel-tidal-confusion` — Models confuse TidalCycles with Strudel
- [x] `ascii-timeout` — ASCII art generation times out
- [x] `html-404-error` — HTML generator endpoint returns 404

### Files Changed
| File | Lines | Status |
|------|-------|--------|
| `src/harness/FailureLogger.ts` | 80 | NEW |
| `src/harness/PatternDetector.ts` | 150 | NEW |
| `src/harness/HarnessUpdater.ts` | 140 | NEW |
| `src/harness/index.ts` | 20 | NEW |
| `src/llm/LLMClient.ts` | +200 | MODIFIED |
| `src/core/CodeValidator.ts` | +100 | MODIFIED |
| `PRD.md` | +120 | MODIFIED |
| `README.md` | +80 | MODIFIED |
| `CHANGELOG.md` | +60 | MODIFIED |
| `docs/ARCHITECTURE_AND_PHILOSOPHY.md` | +60 | MODIFIED |
| `docs/PROMPTS.md` | +80 | MODIFIED |
| `LIMINAL_IMPROVEMENTS_SUMMARY.md` | +80 | MODIFIED |

---

## Statistics

| Category | Total Tasks | Complete | Remaining |
|----------|-------------|----------|-----------|
| P0 Critical | 40 | 0 | 40 |
| P1 High | 35 | 0 | 35 |
| P2 Medium | 50 | 0 | 50 |
| P3 Low | 25 | 0 | 25 |
| Blindspots | 50 | 0 | 50 |
| **META** | **16** | **16** | **0** |
| **TOTAL** | **216** | **16** | **200** |

---

## Task Assignment Log

| Task ID | Assignee | Start Date | Complete Date | Notes |
|---------|----------|------------|---------------|-------|
| | | | | |
| | | | | |
| | | | | |

---

**Last Updated:** 2026-03-30  
**Next Review:** Daily until P0 complete
