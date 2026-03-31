# AGENT INSTRUCTIONS - LIMINAL

## CRITICAL RULE - NO TEMPLATES

**UNDER NO CIRCUMSTANCES should any generator use template fallbacks.**

### The Rule:
1. EVERYTHING goes through the LLM - no exceptions
2. If the LLM fails, the test FAILS - do not use templates
3. If generation fails, fix the harness/routing/validation - NOT the generator
4. Template fallbacks defeat the entire purpose of dogfood QA

### Why:
- Dogfood QA exists to test the actual system
- Templates hide real problems
- If something breaks, we need to know
- Users won't have templates - they'll have the LLM

### What To Do Instead:
| Problem | Solution |
|---------|----------|
| LLM not configured | Throw error - require configuration |
| LLM returns empty | Throw error - log the issue |
| LLM call fails | Throw error - fix the harness |
| Timeout | Increase timeout or mark as slow |
| Invalid output | Fix validation, not the generator |

### Never:
- Use `selectTemplate()` as fallback
- Return hardcoded examples
- Use "example code" when LLM fails
- Create "fallback modes" that bypass LLM

### Always:
- Let failures surface
- Fix the root cause
- Test the real system
- Report real results

---

## Additional Guidelines

- See README.md for project overview
- See DOGFOOD_QUEUES.md for test procedures
- See LANDING_PAGE_SPEC.md for gallery updates

---

**Last Updated:** 2026-03-31  
**Rule Established By:** User directive  
**Enforcement:** Absolute - no exceptions
