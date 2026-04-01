# Generator Architecture V2 - Model-Aware, Context-Driven

**Date:** 2026-04-01  
**Status:** Design Document  
**Context:** Post-2026 prompt engineering best practices

---

## Core Insight: Context Engineering, Not Prompt Engineering

Per Andrej Karpathy (June 2025): *"The LLM is a CPU, the context window is RAM, and your job is to be the operating system, loading working memory with exactly the right code and data for each task."*

**The Generator is the OS loader.**

---

## What a Generator Actually Does

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GENERATOR PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. MODEL DETECTION                                                          │
│     └── Detect provider (OpenAI, Anthropic, Local, etc.)                     │
│     └── Determine prompt format (chat vs completion, XML vs markdown)        │
│                                                                              │
│  2. CONTEXT ASSEMBLY (The "RAM Loading")                                     │
│     ├── Load SOUL.md → personality/context                                   │
│     ├── Load PROJECT_RULES.md → constraints                                  │
│     ├── Load domain docs → technical knowledge                               │
│     ├── Load EpisodicMemory → user preferences                               │
│     └── Load HarnessMemory → recent adaptations                              │
│                                                                              │
│  3. PROMPT CONSTRUCTION (Model-Specific)                                     │
│     ├── System prompt: Role + constraints + domain knowledge                 │
│     ├── User prompt: User request + context                                  │
│     └── Format: XML tags (Claude), Markdown (GPT), etc.                      │
│                                                                              │
│  4. GUARDRAIL PRE-FLIGHT (M1-M8)                                             │
│     ├── M1: Prompt validation (size, toxicity)                               │
│     ├── M2: Domain routing verification                                      │
│     └── M3: Budget/rate limit check                                          │
│                                                                              │
│  5. GENERATION                                                               │
│     └── Call LLM with assembled context                                      │
│                                                                              │
│  6. POST-PROCESSING                                                          │
│     ├── Strip reasoning tags (<think>, etc.)                                 │
│     ├── Validate output structure                                            │
│     └── Detect truncation/incompleteness                                     │
│                                                                              │
│  7. RALPH LOOP INTEGRATION                                                   │
│     ├── Pass to Evaluator for scoring                                        │
│     ├── If failure → Compost/Digest → Retry with context                     │
│     └── If success → Record to EpisodicMemory                                │
│                                                                              │
│  8. GUARDRAIL POST-FLIGHT (M4-M8)                                            │
│     ├── M4: Syntax validation                                                │
│     ├── M5: Safety check (infinite loops, etc.)                              │
│     ├── M6: Anti-hallucination (API validation)                              │
│     ├── M7: Aesthetic scoring                                                │
│     └── M8: Output size validation                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Model-Specific Prompt Formats (2026 Best Practices)

### OpenAI / GPT-5
```typescript
// GPT-5 is a router - conversational, minimal explicit CoT
{
  system: `You are a ${domain} code generator.\n\n` +
          `Constraints:\n${constraints.join('\n')}\n\n` +
          `Output: Valid ${domain} code only. No explanations.`,
  user: prompt  // Simple - GPT-5 infers intent
}
```

### Anthropic / Claude 4.x
```typescript
// Claude needs XML tags, literal instructions
{
  system: `<role>${role}</role>\n` +
          `<constraints>\n${constraints.map(c => `  <rule>${c}</rule>`).join('\n')}\n</constraints>\n` +
          `<domain_knowledge>\n${domainDocs}\n</domain_knowledge>`,
  user: `<request>${prompt}</request>\n` +
        `<context>${assembledContext}</context>`
}
```

### Local Models (Qwen, etc.)
```typescript
// Local models need explicit structure, few-shot examples
{
  system: `### System\n${systemPrompt}`,
  user: `### Examples\n${fewShotExamples}\n\n` +
        `### Request\n${prompt}\n\n` +
        `### Output\n`,
  // Often need stop sequences
  stop: ["###", "Explanation:"]
}
```

---

## Context Assembly from Markdown

All knowledge lives in markdown files. The Generator reads these dynamically:

### 1. SOUL.md → Personality & Voice
```typescript
const soulContext = await loadMarkdown('SOUL.md');
// Injects: "You are Liminal, a creative coding agent..."
```

### 2. PROJECT_RULES.md → Constraints
```typescript
const rulesContext = await loadMarkdown('PROJECT_RULES.md');
// Injects: "Rule 1: Always output valid code..."
```

### 3. Domain Documentation → Technical Knowledge
```typescript
const domainContext = await loadMarkdown(`docs/domains/${domain}.md`);
// Injects: "p5.js uses setup() and draw()..."
```

### 4. EpisodicMemory → User Preferences
```typescript
const preferences = harnessMemory.getRecentEpisodes(10);
// Injects: "User prefers dark themes, abstract shapes..."
```

### 5. HarnessMemory → Recent Adaptations
```typescript
const adaptations = harnessMemory.getSuccessfulAdaptations();
// Injects: "Recent fix: Always include type annotations..."
```

---

## Ralph Loop Integration

The Generator does NOT run in isolation. It's embedded in Ralph Loop:

```typescript
class RalphLoop {
  async run(prompt: string, options: LoopOptions): Promise<LoopResult> {
    // 1. Ambiguity check (pre-flight)
    const issues = ambiguityDetector.detect(prompt);
    
    // 2. Generator selection (based on prompt keywords)
    const generator = selectGenerator(prompt);
    
    // 3. Generation with context
    const code = await generator.generate(prompt, {
      modelFormat: detectModelFormat(),  // <-- Model awareness
      context: assembleContext(),         // <-- Context assembly
      guardrails: activeGuardrails       // <-- M1-M8
    });
    
    // 4. Evaluation (the "scoring")
    const evaluation = await evaluator.evaluate(code, prompt);
    
    // 5. If failure → Compost → Retry with failure context
    if (!evaluation.success) {
      const compostFragment = compost.addFailure(prompt, code, evaluation.errors);
      // Retry with compost context
      return this.run(prompt, { ...options, compostContext: compostFragment });
    }
    
    // 6. Record success
    harnessMemory.recordEpisode({ type: 'generation', prompt, code, score: evaluation.score });
    
    return { code, score: evaluation.score };
  }
}
```

---

## The 18 Guardrails - Where They Live

| Guardrail | Phase | Implementation | Status |
|-----------|-------|----------------|--------|
| M1: Prompt Validation | Pre-flight | `PromptValidator.validate()` | ✅ |
| M2: Domain Routing | Pre-flight | `GeneratorRegistry.dispatch()` | ✅ |
| M3: Budget/Rate Limit | Pre-flight | `SafetyGuardrails.checkAll()` | ✅ |
| M4: Syntax Validation | Post-flight | `CodeValidator.validate()` | ✅ |
| M5: Safety (execution) | Post-flight | `SandboxRunner.check()` | ✅ |
| M6: Anti-Hallucination | Post-flight | `APIValidator.validate()` | ✅ |
| M7: Aesthetic Quality | Evaluation | `AestheticScorer.score()` | ✅ |
| M8: Output Size | Post-flight | `CodeValidator.checkSize()` | ✅ |
| M9: Semantic Alignment | Evaluation | `SemanticValidator.validate()` | ❌ PLANNED |
| M10: Temporal Health | Runtime | `RuntimeHealthMonitor.watch()` | ❌ PLANNED |
| M11: Accessibility | Post-flight | `AccessibilityGuardrails.check()` | ❌ PLANNED |
| M12-M18 | Various | See GUARDRAIL_EXHAUSTIVE.md | ❌ FUTURE |

**Key insight:** Guardrails are NOT in the Generator. They wrap it.

```typescript
// Generator is pure - just assembles context and calls LLM
const generator = new Generator(domain, modelFormat);

// Guardrails wrap the generator
const guardedGenerator = new GuardrailWrapper(generator, {
  pre: [M1, M2, M3],
  post: [M4, M5, M6, M7, M8]
});

// Ralph Loop uses the guarded generator
const result = await guardedGenerator.generate(prompt);
```

---

## Implementation Path

### Phase 1: Model Format Detection (Immediate)
```typescript
// Add to LLMClient or new ModelDetector
function detectModelFormat(config: LLMConfig): 'openai' | 'anthropic' | 'local' {
  if (config.baseUrl?.includes('anthropic')) return 'anthropic';
  if (config.baseUrl?.includes('openai')) return 'openai';
  if (config.model?.includes('claude')) return 'anthropic';
  if (config.model?.includes('gpt')) return 'openai';
  return 'local';
}
```

### Phase 2: Context Assembler (Next)
```typescript
class ContextAssembler {
  async assemble(domain: string): Promise<Context> {
    return {
      soul: await this.loadMarkdown('SOUL.md'),
      rules: await this.loadMarkdown('PROJECT_RULES.md'),
      domain: await this.loadMarkdown(`docs/domains/${domain}.md`),
      preferences: harnessMemory.getRecentEpisodes(10),
      adaptations: harnessMemory.getSuccessfulAdaptations(),
    };
  }
}
```

### Phase 3: Model-Specific Prompt Builder
```typescript
class PromptBuilder {
  build(format: ModelFormat, context: Context, userPrompt: string): Prompt {
    switch (format) {
      case 'anthropic': return this.buildClaudePrompt(context, userPrompt);
      case 'openai': return this.buildOpenAIPrompt(context, userPrompt);
      case 'local': return this.buildLocalPrompt(context, userPrompt);
    }
  }
}
```

### Phase 4: Generator Refactor
Each generator becomes:
```typescript
class P5Generator {
  constructor(
    private llm: LLMClient,
    private contextAssembler: ContextAssembler,
    private promptBuilder: PromptBuilder
  ) {}

  async generate(userPrompt: string): Promise<string> {
    // 1. Detect model format
    const format = detectModelFormat(this.llm.getConfig());
    
    // 2. Assemble context
    const context = await this.contextAssembler.assemble('p5');
    
    // 3. Build model-specific prompt
    const prompt = this.promptBuilder.build(format, context, userPrompt);
    
    // 4. Call LLM
    return this.llm.generate(prompt.system, prompt.user);
  }
}
```

---

## Key Principles

1. **Context > Prompt**: The prompt is just the delivery mechanism. Context is the value.

2. **Model-Aware, Not Model-Dependent**: Detect the model, adapt the format, but the flow stays the same.

3. **Markdown as Source of Truth**: All knowledge lives in `.md` files. Code reads, humans edit.

4. **Guardrails Wrap, Don't Embed**: The Generator should be "pure" - guardrails are cross-cutting concerns.

5. **Ralph Loop Orchestrates**: Generator is a component, not the whole system. Loop handles iteration, compost, evaluation.

6. **Persistent Memory**: Everything recorded (we just implemented this) - preferences, adaptations, failures all persist.

---

## Conclusion

The Generator is not "just an LLM wrapper." It's a **context assembly and formatting engine** that:
- Detects the target model's preferred format
- Gathers relevant context from markdown files and memory
- Constructs model-optimized prompts
- Integrates with Ralph Loop for iterative improvement
- Is wrapped by guardrails for safety

This is how we get the most out of every prompt in April 2026.
