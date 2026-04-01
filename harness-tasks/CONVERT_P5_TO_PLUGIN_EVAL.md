# Evaluation Guide: P5Generator Plugin Conversion

## How to Evaluate Harness Performance

### Quick Check (30 seconds)

```bash
# 1. Build check
npm run build 2>&1 | tail -5
# PASS: Should show "> liminal-ai@1.0.0 build" and exit 0

# 2. Test check  
npm test 2>&1 | tail -5
# PASS: Should show "Tests: 1741 passing" or similar

# 3. Plugin manifest check
cat src/generators/P5Generator/plugin.json | head -10
# PASS: Valid JSON with id, name, version, entry, domains, keywords

# 4. Plugin entry check
head -20 src/generators/P5Generator/index.ts
# PASS: Exports generate(), canHandle(), possibly initialize()
```

### Detailed Evaluation (5 minutes)

#### 1. Code Structure (25 points)

| Criterion | Points | Check |
|-----------|--------|-------|
| Plugin manifest exists and is valid | 5 | `plugin.json` present, parses without errors |
| Entry point exports required functions | 5 | `generate()`, `canHandle()` exported |
| Uses TierBasedGenerator internally | 5 | Extends or wraps TierBasedGenerator |
| Preserves validation logic | 5 | Has setup() check, createCanvas warning |
| Preserves sound detection | 5 | `promptSuggestsSound()` logic present |

**Scoring:**
- 25/25 = Excellent
- 20-24/25 = Good (minor issues)
- 15-19/25 = Acceptable (major issues)
- <15/25 = Needs revision

#### 2. Functionality (40 points)

| Test | Points | Command/Check |
|------|--------|---------------|
| Basic generation works | 10 | `./bin/liminal generate "circle" --output test.html` |
| Sound detection works | 10 | Check console for "Sound detected" message |
| Abort signal works | 10 | Generation cancels when signal triggered |
| Bypass cache works | 10 | `bypassCache: true` respected |

**Scoring:**
- 40/40 = All features work
- 30-39/40 = Most features work
- 20-29/40 = Some features broken
- <20/40 = Major functionality missing

#### 3. Backward Compatibility (20 points)

| Criterion | Points | Check |
|-----------|--------|-------|
| P5GeneratorV2 still exports | 10 | `import { P5GeneratorV2 }` works |
| Old instantiation works | 10 | `new P5GeneratorV2()` works |

**Scoring:**
- 20/20 = Full backward compat
- 10-19/20 = Partial compat
- <10/20 = Breaking changes

#### 4. Code Quality (15 points)

| Criterion | Points | Check |
|-----------|--------|-------|
| TypeScript types are correct | 5 | No `any` types, proper interfaces |
| Error handling | 5 | try/catch around async operations |
| No console.log spam | 5 | Uses eventBus or minimal logging |

**Scoring:**
- 15/15 = Production quality
- 10-14/15 = Minor issues
- 5-9/15 = Significant issues
- <5/15 = Poor quality

### Total Score Interpretation

| Score | Grade | Action |
|-------|-------|--------|
| 95-100 | A+ | Merge immediately |
| 85-94 | A | Minor tweaks, then merge |
| 75-84 | B | Address issues, re-evaluate |
| 65-74 | C | Major revision needed |
| <65 | F | Reject, start over |

### Common Failure Modes

1. **Manifest Missing Fields** (5 point deduction)
   - plugin.json missing keywords or domains

2. **Lost Validation** (5 point deduction)
   - No setup() check means invalid p5 code passes

3. **Breaking Changes** (10 point deduction)
   - Existing code `new P5GeneratorV2()` fails

4. **Type Errors** (5 point deduction)
   - TypeScript build fails

5. **Missing Exports** (5 point deduction)
   - `generate()` or `canHandle()` not exported

### Evaluation Script

```bash
#!/bin/bash
# save as: evaluate-p5-plugin.sh

echo "=== P5 Generator Plugin Evaluation ==="
SCORE=0

# 1. Build check
echo -n "Build: "
if npm run build 2>&1 | grep -q "error TS"; then
  echo "FAIL (TypeScript errors)"
else
  echo "PASS (+25)"
  SCORE=$((SCORE + 25))
fi

# 2. Test check
echo -n "Tests: "
if npm test 2>&1 | grep -q "1741 passing"; then
  echo "PASS (+25)"
  SCORE=$((SCORE + 25))
else
  echo "FAIL (some tests failed)"
fi

# 3. Manifest check
echo -n "Manifest: "
if [ -f "src/generators/P5Generator/plugin.json" ]; then
  if jq empty src/generators/P5Generator/plugin.json 2>/dev/null; then
    echo "PASS (+10)"
    SCORE=$((SCORE + 10))
  else
    echo "FAIL (invalid JSON)"
  fi
else
  echo "FAIL (missing)"
fi

# 4. Entry point check
echo -n "Entry point: "
if grep -q "export.*generate" src/generators/P5Generator/index.ts; then
  echo "PASS (+10)"
  SCORE=$((SCORE + 10))
else
  echo "FAIL (no generate export)"
fi

# 5. Backward compat check
echo -n "Backward compat: "
if grep -q "export.*P5GeneratorV2" src/generators/p5/P5GeneratorV2.ts; then
  echo "PASS (+20)"
  SCORE=$((SCORE + 20))
else
  echo "FAIL (P5GeneratorV2 not exported)"
fi

# 6. Quality check
echo -n "Code quality: "
if ! grep -q "console.log" src/generators/P5Generator/index.ts; then
  echo "PASS (+10)"
  SCORE=$((SCORE + 10))
else
  echo "PARTIAL (has console.log)"
  SCORE=$((SCORE + 5))
fi

echo ""
echo "Total Score: $SCORE/100"

if [ $SCORE -ge 85 ]; then
  echo "Grade: A (Ready to merge)"
elif [ $SCORE -ge 75 ]; then
  echo "Grade: B (Minor fixes needed)"
elif [ $SCORE -ge 65 ]; then
  echo "Grade: C (Major revision)"
else
  echo "Grade: F (Reject)"
fi
```

### Manual Verification Checklist

- [ ] `src/generators/P5Generator/plugin.json` exists and is valid JSON
- [ ] `src/generators/P5Generator/index.ts` exports `generate()` function
- [ ] `src/generators/P5Generator/index.ts` exports `canHandle()` function
- [ ] Generation produces valid p5.js code with `setup()` function
- [ ] Sound detection still works (try prompt with "sound" keyword)
- [ ] `new P5GeneratorV2()` still works (backward compat)
- [ ] TypeScript builds without errors
- [ ] All existing tests pass

### Performance Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Plugin load time | < 50ms | `console.time('load')` |
| Generation time | Same as before | Compare with old generator |
| Memory usage | < 10MB increase | `process.memoryUsage()` |

### Final Sign-Off Criteria

Before merging the harness's work:

1. ✅ Score >= 85/100 on evaluation
2. ✅ All 1741 tests pass
3. ✅ Build succeeds
4. ✅ Manual test: 3 generation prompts work
5. ✅ Backward compat verified
6. ✅ Code review: No obvious bugs

If all criteria met: **APPROVE AND MERGE**
If score 75-84: **REQUEST CHANGES**
If score < 75: **REJECT AND RESTART**
