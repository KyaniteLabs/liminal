# Evaluator Role - Model Requirements Analysis

**Role Definition:** The Evaluator validates outputs, ranks alternatives, and provides quality judgments on generated code/content.

## What an Evaluator Actually Does

Based on Liminal's architecture, the Evaluator performs:

1. **Code Validation**
   - Syntax checking
   - Runtime verification (execute and check results)
   - Security analysis
   - Style compliance

2. **Output Ranking**
   - Compare multiple generator outputs
   - Select best option based on criteria
   - Explain why one is better than another

3. **Quality Assessment**
   - "Is this good enough?"
   - "Does it meet the spec?"
   - "What are the issues?"

4. **Error Analysis**
   - Parse error messages
   - Identify root causes
   - Suggest specific fixes

## Critical Model Requirements for Evaluators

### 1. **Structured Output Reliability** (CRITICAL)

The Evaluator must output machine-parseable judgments:
```json
{
  "valid": true/false,
  "issues": ["issue1", "issue2"],
  "score": 0.85,
  "recommendation": "accept/reject/fix"
}
```

Or for rankings:
```json
{
  "winner": "option_A",
  "reasoning": "...",
  "confidence": 0.92
}
```

**Why it matters:** The harness acts on these judgments programmatically.

### 2. **Code Execution Understanding**

Must understand:
- What code does without running it (static analysis)
- What errors mean and where they come from
- How to fix common issues
- Language-specific idioms and best practices

**Why it matters:** Evaluators often can't actually run code (sandbox limits), so must simulate execution mentally.

### 3. **Comparative Reasoning**

When ranking outputs, must:
- Hold multiple options in working memory
- Compare against criteria systematically
- Not be swayed by superficial differences
- Explain trade-offs clearly

**Why it matters:** Generator selection depends on accurate ranking.

### 4. **Consistency**

Same input → same judgment (deterministic):
- If code A > code B today, it should be > tomorrow
- Criteria application should be stable
- Scoring should be calibrated

**Why it matters:** Non-deterministic evaluators make the harness unpredictable.

### 5. **Explanation Quality**

Must explain WHY:
- "Invalid because missing semicolon on line 47"
- "Option A is better because it handles edge case X"
- "Score 0.7 because Y and Z issues"

**Why it matters:** Explanations feed back into prompt improvements.

### 6. **False Positive/Negative Rate**

- **False Positive** (says good when it's bad) → BAD, lets bugs through
- **False Negative** (says bad when it's good) → OK, just re-generates

**Why it matters:** False positives are dangerous; false negatives just cost iterations.

## What Does NOT Matter for Evaluators

| Feature | Why It's NOT Important |
|---------|------------------------|
| **Generation capability** | Evaluators don't write code, they judge it |
| **Multimodal input** | Usually evaluating text/code only |
| **Long context** | Evaluating single outputs, not long conversations |
| **Tool calling** | Static analysis, not dynamic tool use |
| **Reasoning/thinking modes** | Quick judgments, not deep reasoning |
| **Creative writing** | Analytical, not creative |

## Model Suitability Ranking

| Model | Params | Evaluator Suitability | Why |
|-------|--------|----------------------|-----|
| **Qwen 3.5 0.8B** | 0.8B | ✅ **OPTIMAL** | Tested 3/3 on validation tasks, fast, cheap, reliable |
| **LFM 2.5 1.2B** | 1.2B | ✅ **GOOD** | Fast, good at code understanding |
| **Qwen 3.5 4B** | 4B | ✅ **GOOD** | More capable, still fast |
| **Gemma 4 26B A4B** | 26B | ⚠️ **OVERKILL** | Unnecessary size for evaluation |
| **Qwen 3.5 27B** | 27B | ❌ **WRONG TOOL** | Overkill, too slow for quick validation |

## Test Results from Our Testing

### Qwen 3.5 0.8B Evaluator Tests
```
Code review:    ✅ 0.6s
Rank outputs:   ✅ 1.6s  
Validate:       ✅ 0.2s
→ Overall: 3/3 passed
```

### Capabilities Needed
- ✅ Code review: Identifies issues correctly
- ✅ Ranking: Can compare and select
- ✅ Validation: YES/NO with explanation

## Verdict

**For Evaluator role, small and fast wins.**

The ideal Evaluator model is:
- ✅ **Small** (0.8-4B) - cheap, fast
- ✅ **Reliable structured output** - consistent JSON
- ✅ **Good code understanding** - knows what good looks like
- ✅ **Consistent** - same judgment every time
- ✅ **Fast** - doesn't slow down the loop

**Recommendation:**
- **Primary:** Qwen 3.5 0.8B (proven 3/3, fastest)
- **Fallback:** LFM 2.5 1.2B (if 0.8B unavailable)

**Why not larger models?**
- Evaluator is called frequently (every generation)
- Must be fast to not bottleneck
- Judgment task is simpler than generation
- False negatives are acceptable (just retry)

## Comparison with Other Roles

| Aspect | Evaluator | Ralph (Generator) | Harness |
|--------|-----------|-------------------|---------|
| **Output** | Judgment/Score | Code | Actions/Fixes |
| **Size** | Small (0.8-4B) | Small (1-4B) | Large (26B+) |
| **Speed** | Fast | Fast | Can be slower |
| **Structured output** | Critical | Nice-to-have | Critical |
| **Creativity** | Not needed | Needed | Somewhat |
| **Tool use** | No | Bash | Native function calling |

## Key Metrics for Evaluator Selection

1. **Validation accuracy** - % of correct judgments
2. **Speed** - judgments per second
3. **Cost** - per evaluation cost
4. **Calibration** - scores match actual quality
5. **Explanation quality** - useful error messages

**Current winner: Qwen 3.5 0.8B**
