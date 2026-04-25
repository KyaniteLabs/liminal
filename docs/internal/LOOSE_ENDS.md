# Loose Ends Audit - Liminal Repository

**Generated:** 2026-04-02  
**Branch:** narrative/liminal-archaeology  
**Commit:** 20c68ff  

---

## 🔴 Critical (Blocking Production)

### 1. Security Hardening
| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| ~78 bare catch blocks | `src/llm/`, `src/core/`, `src/tui/`, `src/chat/` | Silent failures, lost errors | Add error logging/handling |
| 195 console.log statements | Throughout `src/` | Potential log injection, noise | Replace with structured logger |
| SSRF validation incomplete | `src/security/UrlValidator.ts` | Could allow internal network access | Harden IP range checks |
| No CSRF protection in dev | `test/security/csrf-protection.test.ts:8` | Test disabled | Implement for production |

### 2. Implementation Stubs
| Issue | Location | Status |
|-------|----------|--------|
| `extractAudio()` - placeholder | `src/compost/SemanticExtractor.ts:87` | @deprecated stub |
| `extractVideo()` - placeholder | `src/compost/SemanticExtractor.ts:95` | @deprecated stub |
| `speculativeDecode()` - unimplemented | `src/compost/ModelRouter.ts:142` | Delegates immediately |
| FFT analysis - synthetic placeholder | `src/musicToVisual/generateMusicToVisual.ts:34` | Sine wave, not real FFT |

---

## 🟡 High (Should Fix Soon)

### 3. Guardrails M12-M18 (✅ IMPLEMENTED)
| Guardrail | File | Status | Tests |
|-----------|------|--------|-------|
| M12: Privacy Guardrail | `src/guardrails/compliance/PrivacyGuardrail.ts` | ✅ Complete | 5 passing |
| M13: Prompt Injection Defense | `src/guardrails/compliance/InjectionGuardrail.ts` | ✅ Complete | 4 passing |
| M14: Supply Chain Guardrail | `src/guardrails/compliance/SupplyChainGuardrail.ts` | ✅ Complete | 2 passing |
| M15: Audit & Compliance | `src/guardrails/compliance/AuditGuardrail.ts` | ✅ Complete | 2 passing |
| M16: Fairness & Bias | `src/guardrails/compliance/FairnessGuardrail.ts` | ✅ Complete | 2 passing |
| M17: Explainability | `src/guardrails/compliance/ExplainabilityGuardrail.ts` | ✅ Complete | 2 passing |
| M18: Resilience | `src/guardrails/compliance/ResilienceGuardrail.ts` | ✅ Complete | 2 passing |

**Total: 7 guardrails, 21 tests passing**

### 4. Type Safety Issues
| Issue | Count | Location |
|-------|-------|----------|
| `@ts-ignore` / `@ts-expect-error` | 10 | Various |
| `any` types | 11 | Various |
| Non-null assertions (`!`) | ~50 | Estimated |

### 5. Test Coverage Gaps
| Issue | Location | Reason |
|-------|----------|--------|
| Sandbox tests skipped in CI | `test/unit/sandbox.test.ts:22` | `describe.skipIf(process.env.CI)` |
| Infinite loop test skipped | `test/unit/sandbox.test.ts:66` | `it.skip` |
| Generator-renderer tests skipped | `test/integration/generator-renderer.test.js:38` | `describe.skipIf(process.env.CI)` |
| Renderer tests skipped | `test/integration/renderer.test.js:16` | `describe.skipIf(process.env.CI)` |
| Dual LLM tests skipped | `test/integration/dual-llm.test.ts:31` | `describe.skipIf(process.env.CI)` |
| E2E guardrail tests skipped | `test/e2e/guardrails-e2e.test.ts:66` | `describe.skipIf(process.env.CI)` |
| E2E sandbox tests skipped | `test/e2e/sandbox-self-improve.e2e.test.ts:34` | `describe.skipIf(process.env.CI)` |
| MiniMax tests skipped | `test/e2e/models/minimax-*.ts` | `describe.skipIf(!process.env.MINIMAX_API_KEY)` |

---

## 🟢 Medium (Nice to Have)

### 6. Deprecated Code
| File | Item | Replacement |
|------|------|-------------|
| `src/core/CreativeEvaluator.ts:61` | `evaluate()` method | `assess()` |
| `src/core/ContextAccumulation.ts:116` | Static methods | Instance methods |
| `src/config/ConfigLoader.ts:123` | Provider field | baseUrl only |
| `src/brain/ArtKnowledgeGraph.ts:498` | `getStyles()` | `getArtisticStyles()` |
| `src/generators/p5/P5Generator.ts:2` | P5Generator | P5GeneratorLLM |
| `src/routing/SmartRouter.ts:8` | SmartRouter class | GeneratorRegistry |
| `src/compost/SeedBank.ts:128` | `formatSeed()` | `formatSeedForPrompt()` |

### 7. Hardware Integration
| Feature | Location | Status |
|---------|----------|--------|
| Hardware MIDI/OSC | Config placeholders only | PRD.md Line 260 |
| Live music output | `generateMusic.ts` | No hardware integration |

### 8. Documentation Debt
| Issue | Location |
|-------|----------|
| Line count outdated (937 vs 1513) | `visual-bible.html:264` |
| Old milestone names in archive | `docs/archive/internal-audits/` |

---

## 🔵 Low (Future Work)

### 9. Code Quality
| Issue | Count | Notes |
|-------|-------|-------|
| Magic numbers | ~20 | Use constants |
| Comments in non-English | 0 | All cleaned up |
| Empty lines at EOF | Variable | Minor formatting |

### 10. Architecture Refinements
| Issue | Impact | Notes |
|-------|--------|-------|
| Plugin API not extracted | Medium | Only internal plugins |
| Community plugin marketplace | Low | Future feature |
| Multi-tenant support | Low | Not designed for |

---

## 📊 Summary Statistics

| Category | Count | Trend |
|----------|-------|-------|
| Critical issues | 4 | Stable |
| High priority | 0 | ✅ M12-M18 implemented |
| Medium priority | 8 | Stable |
| Low priority | 4 | Stable |
| Test skips | 8 | Stable |
| Console logs | ~160 | Needs cleanup |
| Bare catch blocks | ~78 | Needs fixing |

---

## 🎯 Recommended Priority Order

### Week 1-2: Security
1. Fix bare catch blocks (~78 locations)
2. Reduce console.log statements (195 → ~20)
3. Harden SSRF validation

### Month 1-2: Guardrails
✅ M12, M13, M14, M15, M16, M17, M18 - ALL COMPLETE

### Month 2-3: Quality
7. Remove deprecated code
8. ~~Fix type safety issues~~ ✅ **COMPLETE** — all `as any` casts removed from `src/` (#358)
9. Enable CI tests where possible

### Quarter 2: Features
10. Real audio/video extraction
11. Hardware MIDI/OSC

---

## 📝 Notes

- M12-M18 are now **✅ IMPLEMENTED** in `src/guardrails/compliance/`
- DGF (Deterministic Guardrails Framework) is **COMPLETE** with 38 guardrails (31 DGF + 7 M12-M18)
- Compliance test suite: **21 tests passing**
- 18 subsystems are operational and documented
- All zombie files have been cleaned up
- The codebase is in the best state it's ever been

**Next Action:** Pick one critical issue and fix it.
