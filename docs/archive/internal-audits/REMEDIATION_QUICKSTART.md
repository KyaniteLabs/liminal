# Remediation Quick Start Guide

**For:** Developer picking up remediation work  
**Time to first fix:** 15 minutes  
**Full remediation:** 2-4 weeks  

---

## 🚨 IMMEDIATE ACTION REQUIRED (Do These First)

### Step 1: Fix Audio Dependencies (5 minutes)

**Problem:** Tests failing because `meyda` and `pitchfinder` not installed

**Quick Fix:**
```bash
npm install meyda pitchfinder
npm test  # Verify audio tests pass
```

**Or if removing audio:**
```bash
# Remove audio exports from src/index.ts
# Remove audio documentation from README.md
# Delete src/audio/ directory
```

**Verify:**
```bash
npm test -- test/unit/audio/  # Should pass (or be gone)
```

---

### Step 2: Fix ESLint Error (5 minutes)

**Problem:** `src/security/PathSanitizer.ts` line 19

**Quick Fix:**
```typescript
// BEFORE:
const CONTROL_CHAR_REGEX = /[\x00-\x1f]/g;

// AFTER:
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_REGEX = /[\x00-\x1f]/g; // Control char filtering required for path security
```

**Verify:**
```bash
npm run lint  # Should pass
```

---

### Step 3: Remove Duplicate Code (5 minutes)

**Problem:** `src/core/RalphLoop.ts` lines 446-450 are duplicate

**Quick Fix:**
```bash
# Open RalphLoop.ts
# Go to line 446
# Delete the entire if-statement block (lines 446-450)
# It's identical to lines 439-443 and never reached
```

**Verify:**
```bash
npm test -- test/unit/ralph-loop.test.ts
```

---

## 📊 After Immediate Fixes

Run full test suite:
```bash
npm test
```

**Expected Result:** 9 failing tests → 3-4 failing tests

**Remaining failures will be:**
1. CSRF test (P1.3) — needs test strategy decision
2. Sandbox timeout test (P1.4) — needs investigation
3. Lint test — should pass now
4. Audio tests — should pass if you installed deps

---

## 🗓️ Week 1 Plan

### Day 1-2: P0 Critical (Complete All)
- [ ] Fix audio dependencies (decide: install or remove)
- [ ] Fix ESLint error
- [ ] Remove duplicate promise detection
- [ ] Verify all tests pass except known issues

### Day 3-4: P1 Documentation
- [ ] Fix "7 personas" → "5" in README
- [ ] Fix test count in README
- [ ] Run `npm test` to get exact count

### Day 5: P1 Tests
- [ ] Fix CSRF test or decide strategy
- [ ] Investigate sandbox timeout test

---

## 🗓️ Week 2-3 Plan

### Orphaned Features Decision
For each of: `AestheticModel`, `MetaMode`, `ArchiveLearning`, `DNAExtractor`:

```
Decision Tree:
├── Is it useful?
│   ├── NO → Remove exports, keep code
│   └── YES → Continue
├── Can we wire it quickly?
│   ├── YES → Wire it
│   └── NO → Document as "experimental"
└── Update README accordingly
```

### Silent Failures Audit
```bash
# Find all silent catches
grep -r "catch\s*{" src/ --include="*.ts" -A1 | grep -E "(console|return|null)"

# Fix each one to use Logger + event bus
```

---

## 🔍 Daily Verification

Every day before committing:

```bash
# 1. Tests pass
npm test

# 2. Lint passes  
npm run lint

# 3. Type check passes
npm run typecheck

# 4. Manual smoke test
./bin/liminal --prompt "blue circle" --max-iterations 1
```

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module 'meyda'"
**Solution:** `npm install meyda` or remove audio imports

### Issue: "Control character in regex"
**Solution:** Add `// eslint-disable-next-line no-control-regex`

### Issue: "Promise detection test fails"
**Solution:** You didn't remove the duplicate block (lines 446-450)

### Issue: "Preview server test 403"
**Solution:** Normal - CSRF protection working. Fix in P1.3.

### Issue: "Sandbox test times out"
**Solution:** Normal - needs investigation in P1.4

---

## 📁 Key Files Reference

| Issue | File | Line(s) |
|-------|------|---------|
| Missing audio deps | `package.json` | dependencies |
| ESLint error | `src/security/PathSanitizer.ts` | 19 |
| Duplicate code | `src/core/RalphLoop.ts` | 446-450 |
| Persona count doc | `README.md` | ~209 |
| Test count doc | `README.md` | ~768 |
| CSRF test | `test/integration/preview-server-api.test.js` | 172 |
| Sandbox test | `test/unit/sandbox.test.ts` | 55 |
| Orphaned exports | `src/index.ts` | 415, 418, 538, 578 |

---

## ✅ Definition of Done

For each atomic task:
1. Code changed and tested
2. PR reviewed by 1 person
3. All CI checks pass
4. Task checked off in ATOMIC_TASKS.md
5. Sign with initials/date

For full remediation:
- [ ] All P0 complete
- [ ] All P1 complete
- [ ] Tests: 100% pass
- [ ] Lint: 0 errors
- [ ] TypeScript: 0 errors
- [ ] Manual smoke test: passes
- [ ] Documentation: updated
- [ ] CHANGELOG.md: updated

---

## 🆘 Need Help?

**If stuck on:**
- **Audio deps** → Decide: install (quick) or remove (cleaner)
- **ESLint** → Just add the disable comment with explanation
- **Duplicate code** → Delete lines 446-450, nothing else needed
- **Orphaned features** → Default to "document as experimental"
- **Silent failures** → Use Logger.warn() + eventBus.emit()

---

## 📈 Progress Tracking

Update this section daily:

```
Date: 2026-03-XX
P0 Complete: X/3
P1 Complete: X/4
P2 Complete: X/6
Tests Passing: X/2502
Lint Errors: X
Blockers: [list any]
```

---

**Start here:** `ATOMIC_TASKS.md` for full task list  
**Details:** `REMEDIATION_PLAN.md` for full context  
**Silent failures:** `SILENT_FAILURES_AUDIT.md` for error handling  

**Good luck! The core system works, this is all polish.**
