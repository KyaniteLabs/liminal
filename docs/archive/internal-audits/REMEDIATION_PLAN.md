# Liminal Remediation Plan

**Version:** 1.0  
**Date:** 2026-03-30  
**Scope:** Full remediation of all audit findings, blindspots, and silent failures  

---

## Critical Severity (P0) — Fix Immediately

### P0.1: Missing Audio Dependencies
**Issue:** Audio pipeline depends on `meyda` and `pitchfinder` which are not in package.json  
**Impact:** 4 tests fail, all audio features return zeroed defaults silently  
**Silent Failure:** Yes — gracefully degrades to zeros without warning  

- [ ] **P0.1.1** — Audit all audio-related imports across codebase
  - Files: `src/audio/AudioExtractor.ts`, `src/audio/PitchExtractor.ts`, `src/audio/AudioAnalyzer.ts`
  - Check: `import`, `require()`, `createRequire()` patterns
  - Document: All audio dependency touchpoints

- [ ] **P0.1.2** — Decide: Integrate vs Remove vs Make Optional
  - Option A: Add `meyda` and `pitchfinder` to dependencies
  - Option B: Move to `optionalDependencies` with feature detection
  - Option C: Remove audio features entirely
  - Decision required before proceeding

- [ ] **P0.1.3** — If integrating: Add dependencies to package.json
  ```json
  "meyda": "^5.6.3",
  "pitchfinder": "^3.0.1"
  ```

- [ ] **P0.1.4** — Add runtime feature detection with user-visible warnings
  - Location: `src/audio/index.ts` export initialization
  - Warn once on first use if dependencies missing
  - Do not silently fail

- [ ] **P0.1.5** — If making optional: Update types to reflect optional availability
  - `AudioFeatures` may be null/undefined when audio unavailable
  - Update all consumers to handle missing audio

### P0.2: ESLint Error in Production Code
**Issue:** `src/security/PathSanitizer.ts` line 19 has control character regex  
**Impact:** Lint test fails, potential security review blocker  

- [ ] **P0.2.1** — Analyze the control character regex pattern
  - Current: `/[\x00-\x1f]/g`
  - Purpose: Sanitize null bytes and control characters from paths
  - Security requirement: Must preserve this protection

- [ ] **P0.2.2** — Choose fix approach:
  - Option A: Escape characters: `/[\u0000-\u001f]/g` (unicode escape)
  - Option B: Add eslint-disable with security justification comment
  - Option C: Refactor to use explicit character whitelist

- [ ] **P0.2.3** — Implement fix with explanatory comment
  - Must include: Why control character filtering is necessary
  - Must include: Security implication note

- [ ] **P0.2.4** — Verify lint passes
  ```bash
  npm run lint
  ```

- [ ] **P0.2.5** — Verify functionality preserved
  - Check: PathSanitizer still rejects paths with null bytes
  - Check: Normal paths still accepted

### P0.3: Duplicate Code in RalphLoop
**Issue:** Promise detection logic duplicated 3 times (lines 421, 439, 446)  
**Impact:** Code quality, maintainability  

- [ ] **P0.3.1** — Identify all three duplicate blocks
  - Block 1: Lines 421-428 (sets up onProgress callback)
  - Block 2: Lines 439-443 (breaks if promise detected)
  - Block 3: Lines 446-450 (identical break - DEAD CODE)

- [ ] **P0.3.2** — Remove Block 3 (lines 446-450)
  - This is unreachable code — promise detection already handled

- [ ] **P0.3.3** — Refactor Blocks 1-2 for clarity
  - Keep: Promise detection at line 421
  - Keep: Event emission at line 430
  - Keep: Break logic at line 439
  - Remove: Second identical if-statement

- [ ] **P0.3.4** — Verify logic flow
  - Promise detected → emit event → break loop
  - No duplicate checks

- [ ] **P0.3.5** — Run RalphLoop tests
  ```bash
  npm test -- test/unit/ralph-loop.test.ts
  ```

---

## High Severity (P1) — Fix This Week

### P1.1: Documentation Accuracy - Persona Count
**Issue:** README claims "7 personas" but only 5 exist  
**Impact:** User confusion, credibility damage  

- [ ] **P1.1.1** — Audit all persona references in docs
  - README.md line ~209: "The 7 Personas"
  - README.md table: Lists 5 personas
  - PRD.md: May have similar claim
  - Any marketing/promo materials

- [ ] **P1.1.2** — Update all references to correct count
  - Change: "The 7 Personas" → "The 5 Personas"
  - Verify: Table content matches actual code

- [ ] **P1.1.3** — Add persona count validation test
  - Test: `test/swarm/personas.test.ts`
  - Assert: `DEFAULT_PERSONAS.length` matches documented count

- [ ] **P1.1.4** — Document why 5 (not 7)
  - Comment in personas.ts explaining selection criteria
  - Or: Create issue to add 2 more personas if desired

### P1.2: Documentation Accuracy - Test Count
**Issue:** README claims "2365 tests" but actual is 2487  
**Impact:** Stale documentation, trust erosion  

- [ ] **P1.2.1** — Find all test count references
  - README.md line 768: "2365 tests passing"
  - Any other docs mentioning specific numbers

- [ ] **P1.2.2** — Update to current count
  - Verify: `npm test` output for exact passing count
  - Update: README with correct number

- [ ] **P1.2.3** — Add automated test count check to CI
  - Script: Extract count from test output
  - Compare: Against documented count
  - Fail: CI if mismatch (prevents future drift)

### P1.3: CSRF Test Failures
**Issue:** Preview server tests fail with 403 due to CSRF protection  
**Impact:** Cannot verify preview server functionality  

- [ ] **P1.3.1** — Analyze CSRF implementation
  - Location: PreviewServer.ts middleware
  - Check: How tokens are generated and validated

- [ ] **P1.3.2** — Determine test strategy:
  - Option A: Disable CSRF in test environment
  - Option B: Extract and send CSRF token in tests
  - Option C: Add test-specific bypass header

- [ ] **P1.3.3** — Implement chosen approach
  - If Option A: `process.env.NODE_ENV === 'test'` check
  - If Option B: Parse HTML for token, include in requests
  - If Option C: Add `X-Test-Bypass` header validation

- [ ] **P1.3.4** — Verify tests pass
  ```bash
  npm test -- test/integration/preview-server-api.test.js
  ```

### P1.4: Sandbox Timeout Test
**Issue:** `sandbox.test.ts` infinite loop test times out  
**Impact:** Unclear if timeout protection actually works  

- [ ] **P1.4.1** — Investigate current sandbox implementation
  - File: `src/sandbox/SandboxRunner.ts`
  - Check: How timeouts are enforced

- [ ] **P1.4.2** — Identify why test hangs:
  - Does `while(true){}` not trigger timeout?
  - Is timeout longer than test timeout (10s)?
  - Is sandbox not actually sandboxed?

- [ ] **P1.4.3** — Fix sandbox timeout mechanism
  - Ensure: Worker/iframe termination on timeout
  - Ensure: Promise resolves/rejects within timeout window

- [ ] **P1.4.4** — Adjust test timeout if needed
  - Current: 10s test timeout
  - Sandbox timeout: Should be less than test timeout
  - Or: Increase test timeout to allow sandbox timeout to fire

- [ ] **P1.4.5** — Verify test passes
  ```bash
  npm test -- test/unit/sandbox.test.ts
  ```

---

## Medium Severity (P2) — Fix This Sprint

### P2.1: Orphaned Features — AestheticModel
**Issue:** Exported but not wired into RalphLoop  
**Impact:** Dead code, maintenance burden, user confusion  

- [ ] **P2.1.1** — Audit AestheticModel capabilities
  - File: `src/evolution/AestheticModel.ts`
  - Check: What does it predict? How accurate?
  - Check: Training data requirements

- [ ] **P2.1.2** — Decide: Wire vs Remove vs Document
  - Option A: Wire into RalphLoop as optional feature
  - Option B: Remove from exports (keep in codebase)
  - Option C: Document as "experimental/library only"

- [ ] **P2.1.3** — If wiring: Add to RalphLoop options
  - Add: `useAestheticModel` option
  - Implement: Model prediction in scoring pipeline
  - Add: Persistence for model state

- [ ] **P2.1.4** — If removing: Deprecate properly
  - Add: JSDoc @deprecated
  - Log: Deprecation warning on use
  - Remove: In next major version

- [ ] **P2.1.5** — Update README to reflect status
  - Remove: From "What Liminal Can Do" if not wired
  - Add: To "Library API" section if keeping

### P2.2: Orphaned Features — MetaMode
**Issue:** Exported but not wired into RalphLoop  
**Impact:** Same as P2.1  

- [ ] **P2.2.1** — Audit MetaMode capabilities
  - File: `src/evolution/MetaMode.ts`
  - Check: What experiments does it track?
  - Check: How does it affect generation?

- [ ] **P2.2.2** — Make decision and implement (same options as P2.1.2)

- [ ] **P2.2.3** — Update documentation

### P2.3: Orphaned Features — ArchiveLearning
**Issue:** Exported but not wired into RalphLoop  
**Impact:** Same as P2.1  
**Note:** Partially wired — archiveLearning is instantiated but not fully utilized  

- [ ] **P2.3.1** — Audit current ArchiveLearning usage in RalphLoop
  - Line ~114-118: Instantiation
  - Line ~325-331: Adding outputs
  - Check: Is retrieval/query used?

- [ ] **P2.3.2** — Determine gap:
  - Are we storing but never retrieving?
  - Should archive examples be injected into prompts?

- [ ] **P2.3.3** — Implement retrieval if needed
  - Query: Archive for similar past prompts
  - Inject: High-scoring examples into context
  - Or: Remove if truly unused

- [ ] **P2.3.4** — Remove "@library" comment if wired

### P2.4: Orphaned Features — DNAExtractor
**Issue:** Exported but not wired into RalphLoop  
**Impact:** Same as P2.1  

- [ ] **P2.4.1** — Audit DNAExtractor capabilities
  - File: `src/scavenger/DNAExtractor.ts`
  - Check: What does it extract?
  - Check: How would it integrate?

- [ ] **P2.4.2** — Make decision and implement (same options as P2.1.2)

- [ ] **P2.4.3** — Update documentation

### P2.5: Silent Failures — Async Error Handling
**Issue:** Many async operations swallow errors or warn to console only  
**Impact:** Silent degradation, hard to debug production issues  

- [ ] **P2.5.1** — Audit all catch blocks that only console.warn
  - Pattern: `} catch (err) { console.warn(...); }`
  - Files to check:
    - `src/core/RalphLoop.ts`
    - `src/swarm/SwarmOrchestrator.ts`
    - `src/compost/*.ts`
    - `src/gallery/*.ts`

- [ ] **P2.5.2** — Categorize each silent catch:
  - Category A: Best-effort operation (logging OK)
  - Category B: Should report to user
  - Category C: Should fail operation

- [ ] **P2.5.3** — Implement proper error handling
  - Category A: Keep logging, add to Logger utility
  - Category B: Add to `onProgress` callback or event bus
  - Category C: Propagate error, fail operation

- [ ] **P2.5.4** — Add error telemetry hook
  - Event: `EventTypes.ERROR_OCCURRED`
  - Payload: Error details, context, recoverable flag
  - Allow: External error tracking integration

### P2.6: Silent Failures — Validation Failures
**Issue:** CodeValidator failures don't stop iteration, just force score to 0  
**Impact:** Might continue iterating on broken code  

- [ ] **P2.6.1** — Review current validation handling in RalphLoop
  - Lines 196-203: Validation failure handling
  - Current: `currentCode = validation.cleanedCode || '// Validation failed'`

- [ ] **P2.6.2** — Determine desired behavior:
  - Option A: Skip iteration (don't save, continue to next)
  - Option B: Fail fast (stop loop, report error)
  - Option C: Continue with warning (current behavior)

- [ ] **P2.6.3** — Implement chosen behavior
  - Add: Config option `failOnValidationError`
  - Default: Continue with warning (backward compatible)
  - Log: Validation failure clearly in output

- [ ] **P2.6.4** — Add validation failure metrics
  - Track: Validation failure rate per session
  - Report: In final result metadata

---

## Low Severity (P3) — Fix When Convenient

### P3.1: Documentation — Hardware MIDI/OSC
**Issue:** PRD mentions hardware integration but only config placeholders exist  
**Impact:** User disappointment, false expectations  

- [ ] **P3.1.1** — Audit current hardware support
  - Config: `live.midiOutput`, `live.oscHost` in liminal.json
  - Implementation: Any actual MIDI/OSC code?

- [ ] **P3.1.2** — Remove or document as "roadmap"
  - Option A: Remove from docs until implemented
  - Option B: Document as "future work"
  - Option C: Create GitHub issue for implementation

### P3.2: Documentation — Live Preview Claims
**Issue:** README claims "Live preview renders each iteration"  
**Impact:** User confusion about capabilities  

- [ ] **P3.2.1** — Verify actual preview capabilities
  - Can preview server show iterations in real-time?
  - Is it manual refresh only?

- [ ] **P3.2.2** — Update documentation to match reality
  - Clarify: What "live preview" actually means
  - Or: Implement actual live preview via SSE/WebSocket

### P3.3: Code Quality — RalphLoop Size
**Issue:** RalphLoop.ts is 555 lines, does too much  
**Impact:** Maintainability, testability  
**Note:** Already partially extracted but could go further  

- [ ] **P3.3.1** — Identify remaining extractable logic:
  - Compost auto-feed (lines 335-360)
  - Guidance engine integration (lines 363-380)
  - Routing outcome recording (lines 383-390)

- [ ] **P3.3.2** — Extract to dedicated modules
  - Create: `CompostIntegration.ts`
  - Create: `GuidanceIntegration.ts`
  - Create: `RoutingAnalytics.ts`

- [ ] **P3.3.3** — Verify RalphLoop < 300 lines after extraction

### P3.4: Test Coverage — Missing Integration Tests
**Issue:** Heavy on unit tests, light on end-to-end tests  
**Impact:** Integration bugs may slip through  

- [ ] **P3.4.1** — Identify critical E2E scenarios:
  - Full loop with LLM (mocked)
  - Full loop with swarm mode
  - Chat mode interview flow
  - Compost digestion pipeline

- [ ] **P3.4.2** — Implement E2E tests
  - Use: Testcontainers or mocked services
  - Verify: Full workflow from prompt to output

---

## Blindspots & Missed Opportunities

### B1: No Validation of Generated Code Execution
**Blindspot:** We validate syntax but don't verify code actually runs  
**Risk:** Syntactically valid but semantically broken code passes evaluation  

- [ ] **B1.1** — Add execution validation step
  - Run: Generated code in sandboxed environment
  - Check: No runtime errors in first N seconds
  - Score: Based on successful execution

- [ ] **B1.2** — Add to scoring pipeline
  - Technical score bonus for running code
  - Or: Penalty for code that fails to run

### B2: No Input Validation on Prompts
**Blindspot:** Prompts are passed directly to LLM without sanitization  
**Risk:** Prompt injection, though low risk with local models  

- [ ] **B2.1** — Add prompt validation
  - Check: Length limits (prevent DoS)
  - Check: Character whitelist (prevent injection)
  - Strip: Control characters

- [ ] **B2.2** — Add prompt sanitization logging
  - Log: If prompt was modified before sending
  - Alert: User if prompt contained suspicious patterns

### B3: Cache Invalidation Blindspot
**Blindspot:** LLMClient cache doesn't account for model changes  
**Risk:** Wrong model's response returned from cache  

- [ ] **B3.1** — Include model in cache key
  - Current: `this.cache.get(systemPrompt, userPrompt)`
  - Should: Include `this.config.model` in key

- [ ] **B3.2** — Add cache versioning
  - Invalidate: Cache when model/config changes
  - TTL: Consider adding time-based expiration

### B4: No Rate Limiting on Preview Server
**Blindspot:** PreviewServer has no rate limiting  **Risk:** Could be abused if exposed to internet  

- [ ] **B4.1** — Add rate limiting middleware
  - Use: `express-rate-limit` (already in dependencies)
  - Default: 100 requests per 15 minutes
  - Configurable: Via options

### B5: Swallowed Errors in EventBus
**Blindspot:** EventBus.emit doesn't handle listener errors  **Risk:** One failing listener breaks all subsequent listeners  

- [ ] **B5.1** — Wrap listener calls in try-catch
  - Current: `listener(payload)`
  - Should: `try { listener(payload) } catch (e) { log.error(...) }`

- [ ] **B5.2** — Add listener error event
  - Emit: `EventTypes.LISTENER_ERROR` on failure
  - Allow: Monitoring of failing listeners

### B6: No Validation of Gallery Output
**Blindspot:** Saved iterations aren't validated on load  **Risk:** Corrupted gallery breaks subsequent runs  

- [ ] **B6.1** — Add validation to Gallery.loadHistory
  - Validate: JSON structure
  - Validate: Required fields present
  - Handle: Corrupted files gracefully (skip with warning)

### B7: Missing Cleanup on SIGTERM
**Blindspot:** No graceful shutdown handling  **Risk:** Corrupted state on forced exit  

- [ ] **B7.1** — Add signal handlers
  - Handle: SIGTERM, SIGINT
  - Cleanup: Close servers, save state, flush logs
  - Timeout: Force exit after graceful period

### B8: No Validation of Compost Config
**Blindspot:** CompostMill accepts any config without validation  **Risk:** Runtime errors from bad config  

- [ ] **B8.1** — Add config schema validation
  - Use: Zod or JSON Schema
  - Validate: On CompostMill construction
  - Fail: Fast with clear error message

### B9: Blindspot in Cross-Domain Crossover
**Blindspot:** CrossDomainCrossover exists but isn't used  **Risk:** Dead code, missed creative opportunity  

- [ ] **B9.1** — Evaluate if feature should be wired
  - File: `src/evolution/CrossDomainCrossover.ts`
  - Question: Should this inject cross-domain ideas into prompts?

- [ ] **B9.2** — Either wire it or remove it

### B10: No Telemetry on Feature Usage
**Blindspot:** Don't know which features users actually use  **Risk:** Building features nobody uses  

- [ ] **B10.1** — Add opt-in telemetry
  - Track: Which features are used
  - Track: Success/failure rates
  - Respect: Privacy, make opt-in

---

## Execution Order

### Week 1 (P0 Critical)
1. P0.1.1-1.5 — Fix missing audio dependencies
2. P0.2.1-2.5 — Fix ESLint error
3. P0.3.1-3.5 — Remove duplicate promise detection

### Week 2 (P1 High)
4. P1.1.1-1.4 — Fix persona count documentation
5. P1.2.1-2.3 — Fix test count documentation
6. P1.3.1-3.4 — Fix CSRF tests
7. P1.4.1-4.5 — Fix sandbox timeout test

### Week 3-4 (P2 Medium)
8. P2.1.1-1.5 — Resolve AestheticModel status
9. P2.2.1-2.3 — Resolve MetaMode status
10. P2.3.1-3.4 — Complete ArchiveLearning wiring
11. P2.4.1-4.3 — Resolve DNAExtractor status
12. P2.5.1-5.4 — Fix silent async failures
13. P2.6.1-6.4 — Fix validation failure handling

### Ongoing (P3 + Blindspots)
14. B1-B10 — Address blindspots as prioritized
15. P3.1-3.4 — Polish items

---

## Success Metrics

| Metric | Before | Target | Verification |
|--------|--------|--------|--------------|
| Test pass rate | 99.4% | 100% | `npm test` |
| Lint errors | 1 | 0 | `npm run lint` |
| Missing dependencies | 2 | 0 | `package.json` |
| Orphaned features | 4 | 0 | Code review |
| Silent catch blocks | TBD | < 5 | Grep audit |
| Documentation accuracy | 85% | 98% | Manual review |

---

## Verification Checklist

- [ ] All P0 items complete
- [ ] All tests passing
- [ ] Lint clean
- [ ] No new silent failures introduced
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped if needed
- [ ] Full test run: `npm test`
- [ ] Manual smoke test: `liminal --prompt "test"`

---

**Plan Owner:** TBD  
**Review Date:** Weekly until complete  
**Sign-off Required:** Lead maintainer
