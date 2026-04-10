# Model Roles Framework - What to Look For

**Status:** Research phase - these are the requirements, specific models TBD

## The Four Roles (Not Three)

You missed one: **Chat/Interface Model** - the one users actually talk to.

```
┌─────────────────────────────────────────────────────────────┐
│                    LIMINAL ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────┤
│  USER INTERFACE                                              │
│  └── Chat Model ←── User talks to this                      │
├─────────────────────────────────────────────────────────────┤
│  META-HARNESS (Self-Improving)                               │
│  └── Harness Agent ←── Fixes the system                     │
├─────────────────────────────────────────────────────────────┤
│  GENERATION PIPELINE                                         │
│  ├── Generator ←── Creates code                             │
│  └── Evaluator ←── Judges quality                           │
└─────────────────────────────────────────────────────────────┘
```

## Role 1: Generator (Ralph Loop)

**Purpose:** Create code iteratively

**What to Look For:**
- ✅ **Domain expertise** - Good at specific generator type (p5, Tone, etc.)
- ✅ **Instruction following** - Does what the prompt says, consistently
- ✅ **Fast inference** - Many iterations needed
- ✅ **Low cost** - Runs frequently
- ✅ **Stateless-friendly** - Fresh context each iteration

**What Does NOT Matter:**
- ❌ Tool calling (uses bash, not native tools)
- ❌ Multimodal (text→code)
- ❌ Large context (short iterations)
- ❌ Reasoning modes (just generate, not plan)

**Key Metric:** Success rate at specific domain after N iterations

---

## Role 2: Evaluator

**Purpose:** Judge if code is good/valid

**What to Look For:**
- ✅ **Structured output** - Returns machine-parseable judgments
- ✅ **Code understanding** - Knows good code from bad
- ✅ **Consistency** - Same judgment for same input
- ✅ **Fast** - Called on every generation
- ✅ **Calibration** - Scores match actual quality

**What Does NOT Matter:**
- ❌ Generation capability (doesn't write code)
- ❌ Tool calling (static analysis)
- ❌ Creativity (analytical, not creative)
- ❌ Large context (evaluating single outputs)

**Key Metric:** False positive rate (bad code marked good)

---

## Role 3: Harness Agent

**Purpose:** Fix the system itself

**What to Look For:**
- ✅ **Native function calling** - Must use tools autonomously
- ✅ **Reasoning/planning** - Multi-step fix strategies
- ✅ **Large context** - Read multiple files, failure logs
- ✅ **Code understanding** - Navigate and modify codebase
- ✅ **Reliability** - Deterministic tool use

**What Does NOT Matter:**
- ❌ Speed (infrequent runs)
- ❌ Cost (one good fix is worth it)
- ❌ Generation creativity (fixing, not creating)

**Key Metric:** Fix success rate + safety (no breaking changes)

---

## Role 4: Chat/Interface Model (The One You Forgot)

**Purpose:** Talk to the user

**What to Look For:**
- ✅ **Conversational ability** - Natural, helpful dialogue
- ✅ **Personality consistency** - Same voice throughout
- ✅ **Instruction following** - Respects system prompts
- ✅ **Context awareness** - Remembers conversation history
- ✅ **Helpfulness** - Actually useful to users

**What Does NOT Matter:**
- ❌ Tool calling (can be added, but not required)
- ❌ Code generation (generators handle that)
- ❌ Multimodal (nice but not required)

**Key Metric:** User satisfaction, task completion

---

## Should Harness = Chat Model?

**Short Answer:** No, different requirements.

### Chat Model Priorities:
- Responsive (low latency)
- Conversational (engaging)
- Consistent personality
- Helpful explanations

### Harness Priorities:
- Autonomous tool use
- Complex reasoning
- Large context for analysis
- Reliable execution

### The Conflict:
| Aspect | Chat | Harness |
|--------|------|---------|
| **Speed** | Fast response | Can be slower |
| **Tool use** | Optional | Required |
| **Context** | Conversation | Codebase + logs |
| **Reliability** | "Good enough" | Must not break system |
| **Personality** | Important | Irrelevant |

### Recommendation:
**Separate models**, but could be same family:
- Chat: Gemma 4 9B (conversational, fast)
- Harness: Gemma 4 26B (tool use, reasoning)

Or entirely different:
- Chat: LFM 2.5 (fast, chatty)
- Harness: Gemma 4 26B (capable, autonomous)

---

## Do You Need More Roles?

**Potential Additional Roles:**

### 5. Router/Dispatcher
**Purpose:** Decide which generator to use

**What to Look For:**
- Fast classification
- Good at keyword/pattern matching
- Low latency (runs before generation)

**Could be:** Simple model or even heuristics

### 6. Memory/Knowledge Model
**Purpose:** Long-term memory across sessions

**What to Look For:**
- Large context (for RAG)
- Good at summarization
- Embedding quality

**Could be:** Separate embedding model + vector DB

### 7. Security/Guardrail Model
**Purpose:** Check for malicious code

**What to Look For:**
- Code analysis capability
- Security expertise
- Low false negative rate

**Could be:** Same as Evaluator with security focus

### 8. Explanation/Summary Model
**Purpose:** Explain code to users

**What to Look For:**
- Good at simplification
- Teaching ability
- Clear communication

**Could be:** Same as Chat model

---

## Decision Framework

**When evaluating a new model, ask:**

1. **What role will it play?**
   - Generator → Test domain expertise + speed
   - Evaluator → Test structured output + consistency
   - Harness → Test tool use + reasoning
   - Chat → Test conversation + personality

2. **What are the non-negotiables?**
   - Generator: Must be good at specific domain
   - Evaluator: Must output valid JSON
   - Harness: Must use tools reliably
   - Chat: Must be conversational

3. **What can be compromised?**
   - Generator: Context size (short iterations)
   - Evaluator: Creativity (not needed)
   - Harness: Speed (infrequent)
   - Chat: Tool use (can add later)

---

## Current Understanding

| Role | Current Best | Requirements Met | Looking For Alternatives? |
|------|--------------|------------------|---------------------------|
| Generator | LFM 2.5 1.2B | ✅ Fast, 8/10 pass | Yes (test others) |
| Evaluator | Qwen 3.5 0.8B | ✅ 3/3 validation | Yes (test others) |
| Harness | Gemma 4 26B | ✅ 3/3 tool use | Yes (test others) |
| Chat | ??? | ❓ Not tested | Yes (define requirements) |

---

## Open Questions

1. **Should Chat = Harness?**
   - Pro: Simpler architecture
   - Con: Different requirements
   - Verdict: **Probably separate**

2. **Do you need a Router?**
   - Pro: Better generator selection
   - Con: Adds latency
   - Verdict: **Start with heuristics, add model if needed**

3. **Should Evaluator = small model always?**
   - Pro: Fast, cheap
   - Con: May miss subtle issues
   - Verdict: **Small for now, upgrade if false positives high**

4. **Can one model serve multiple roles?**
   - Pro: Simpler deployment
   - Con: Suboptimal for each role
   - Verdict: **Maybe for Chat+Harness if same family**

---

## Next Steps for Research

**For each candidate model, test:**

1. **Generator candidates:**
   - Run against all 10 generators
   - Measure success rate + time
   - Check cost per generation

2. **Evaluator candidates:**
   - Test structured output reliability
   - Measure false positive/negative rates
   - Check consistency across runs

3. **Harness candidates:**
   - Test native function calling
   - Test reasoning on complex fixes
   - Measure fix success rate

4. **Chat candidates:**
   - Test conversational ability
   - Check personality consistency
   - Measure user task completion

**Document everything** - this is the foundation for model selection.
