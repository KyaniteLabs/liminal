# Harness Role - Model Requirements Analysis

**Role Definition:** The Harness is a self-improving outer loop that detects patterns in failures and applies targeted fixes to the system itself.

## What a Harness Agent Actually Does

Based on Sinter's Meta-Harness architecture:

1. **Failure Analysis**
   - Read failure logs from generators
   - Identify patterns across multiple failures
   - Classify error types

2. **Root Cause Detection**
   - Determine WHY failures happen
   - Trace to source (prompt, validation, routing)
   - Distinguish transient vs systematic issues

3. **System Improvement**
   - Fix prompts based on failure patterns
   - Update validation rules
   - Adjust routing logic
   - Modify generator configurations

4. **Tool Use**
   - Read files (to understand codebase)
   - Write/Edit files (to apply fixes)
   - Run builds/tests (to verify fixes)
   - Create backups (for safety)

5. **Decision Making**
   - Decide which fix to apply
   - Risk assessment (low/medium/high)
   - Rollback if fix fails

## Critical Model Requirements for Harness Agents

### 1. **Native Function Calling** (CRITICAL)

The Harness uses 7 tools:
- `readFile` - Read file contents
- `writeFile` - Write entire file  
- `applyEdit` - Targeted string replacement
- `runBuild` - Run `npm run build`
- `runTests` - Run test suite
- `createBackup` - Create file backup
- `restoreBackup` - Restore from backup

**Why it matters:** The Harness is an AGENT, not just a generator. It must autonomously decide which tool to use when.

**Gemma 4 advantage:** Native function calling trained into the model (not prompt-engineered).

### 2. **Reasoning/Thinking Mode** (CRITICAL)

Must handle complex multi-step logic:
```
1. See failure pattern
2. Analyze root cause
3. Plan fix strategy
4. Execute fix (tool call)
5. Verify fix worked
6. If not, rollback and retry
```

**Why it matters:** Harness fixes are complex and require planning.

**Gemma 4 advantage:** `<|think|>` token for explicit reasoning.
**Qwen 3.5 advantage:** `enable_thinking` flag for reasoning mode.

### 3. **Large Context Window** (CRITICAL)

Must hold:
- Multiple failure logs
- Source code of generators
- Validation rules
- Prompt templates
- Build output

**Minimum:** 128K  
**Optimal:** 256K+

**Why it matters:** Understanding patterns requires seeing many examples.

**Gemma 4 26B:** 256K context  
**Qwen 3.5 27B:** 262K-1M context

### 4. **Code Understanding at Scale**

Must:
- Read and understand entire generator implementations
- Parse complex TypeScript/JavaScript
- Understand build systems
- Navigate codebase structure

**Why it matters:** Fixes require understanding the system being fixed.

### 5. **Multimodal (Vision)** (IMPORTANT)

Can analyze:
- Screenshots of errors
- Visual logs
- Diagrams of architecture

**Why it matters:** Some debugging is visual (UI errors, layout issues).

**Gemma 4 advantage:** Native image understanding.

### 6. **Instruction Following with Constraints**

Must follow complex instructions like:
- "Only modify files in src/ directory"
- "Max 50 lines changed per edit"
- "Run build after every change"
- "Create backup before editing"

**Why it matters:** Safety constraints prevent catastrophic changes.

### 7. **Structured Output for Risk Assessment**

Must output:
```json
{
  "risk": "low/medium/high",
  "files_to_modify": [...],
  "rollback_plan": "...",
  "confidence": 0.85
}
```

**Why it matters:** The harness decides whether to proceed based on risk.

## What Does NOT Matter for Harness

| Feature | Why It's NOT Important |
|---------|------------------------|
| **Generation creativity** | Harness fixes code, doesn't create from scratch |
| **Speed** | Quality over speed (fixes are infrequent) |
| **Cost efficiency** | One good fix is worth the cost |
| **Small size** | Large context requires large model |
| **Audio input** | Not relevant for debugging code |

## Model Suitability Ranking

| Model | Params | Context | Harness Suitability | Why |
|-------|--------|---------|---------------------|-----|
| **Gemma 4 26B A4B** | 26B (3.8B active) | 256K | ✅ **OPTIMAL** | Native tools, reasoning, vision, proven |
| **Qwen 3.5 27B** | 27B | 262K-1M | ✅ **GOOD** | Dense, good reasoning, 1M context |
| **Qwen 3.5 35B A3B** | 35B | 262K | ✅ **GOOD** | MoE variant, efficient |
| **Gemma 4 31B** | 31B | 256K | ✅ **MAX QUALITY** | Dense, best benchmarks |
| **LFM 2.5 1.2B** | 1.2B | ~8K | ❌ **INSUFFICIENT** | Context too small, no tool calling |
| **Qwen 3.5 0.8B** | 0.8B | 32K | ❌ **INSUFFICIENT** | No tool calling, small context |

## Test Results

### Gemma 4 26B Harness Role Tests (from our testing)
```
Code fix:         ✅ (reasoning quality: good)
Pattern detect:   ✅ (reasoning quality: good)
Prompt improve:   ✅ (reasoning quality: good)
→ Overall: 3/3 passed
```

### Key Capabilities Verified
- ✅ Can analyze failures
- ✅ Can suggest code fixes
- ✅ Can improve prompts

## The Gemma 4 Advantage for Harness

### 1. Native Function Calling
```javascript
// Tools defined as JSON schema
const tools = [
  {
    name: "applyEdit",
    parameters: { filePath, search, replace }
  },
  // ...
];

// Model decides which to call and when
const response = await gemma4.chat.completions.create({
  messages,
  tools,
  tool_choice: "auto"
});
```

### 2. Multimodal Debugging
```javascript
// Can analyze screenshots of errors
messages.push({
  role: "user",
  content: [
    { type: "image_url", image_url: errorScreenshot },
    { type: "text", text: "Fix this error" }
  ]
});
```

### 3. 256K Context
Can read:
- Entire generator source files
- Multiple failure logs
- Full prompt templates
- Build configuration

## Verdict

**For Harness role, capability over cost.**

The ideal Harness model is:
- ✅ **Native function calling** - autonomous tool use
- ✅ **Reasoning mode** - complex planning
- ✅ **Large context** (256K+) - pattern detection
- ✅ **Multimodal** - visual debugging
- ✅ **Reliable** - deterministic output

**Recommendation:**
- **Primary:** Gemma 4 26B A4B (native tools, vision, 256K, efficient MoE)
- **Alternative:** Qwen 3.5 27B (dense, 1M context, good reasoning)
- **Max quality:** Gemma 4 31B (if cost not a concern)

**Why not smaller models?**
- No native tool calling
- Context window too small
- Can't hold enough failure examples
- Insufficient reasoning for complex fixes

## Three-Role Summary

| Aspect | Generator (Ralph) | Evaluator | Harness |
|--------|-------------------|-----------|---------|
| **Primary task** | Create code | Judge quality | Fix system |
| **Model size** | Small (1-4B) | Small (0.8-4B) | Large (26B+) |
| **Context** | Minimal | Minimal | Large (256K+) |
| **Tool use** | Bash | None | Native function calling |
| **Multimodal** | No | No | Yes (vision) |
| **Reasoning** | No | No | Yes |
| **Speed priority** | Yes | Yes | No |
| **Cost priority** | Yes | Yes | No |
| **Best model** | LFM 1.2B | Qwen 0.8B | Gemma 4 26B |

## Current Fleet Recommendation

| Role | Model | Why |
|------|-------|-----|
| **Generator** | LFM 2.5 1.2B | Fast, 8/10 generators, cheap iterations |
| **Evaluator** | Qwen 3.5 0.8B | 3/3 validation, fastest, cheapest |
| **Harness** | Gemma 4 26B A4B | Native tools, vision, reasoning, 256K |

**Total coverage:** Fast generation, reliable validation, autonomous fixing.
