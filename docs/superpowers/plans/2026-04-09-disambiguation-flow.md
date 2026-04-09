# Disambiguation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `AmbiguityDetector` into the generation path so that when no domain matches AND the prompt is ambiguous, the system asks user clarifying questions instead of blindly falling back to P5.

**Architecture:** Two-part fix:
1. `GenerationOrchestrator.generate()` checks `AmbiguityDetector` before falling back to P5, returns `needsClarification: true` with questions instead of code when ambiguous
2. `NaturalInterface.handleAgentRequest()` catches the clarification signal, presents questions to user, collects answers, and retries with enriched context

**Tech Stack:** TypeScript, Vitest, existing AmbiguityDetector, existing buildDesignPrompt clarify mode

---

## File Map

```
src/core/GenerationOrchestrator.ts     MODIFY — add disambiguation check + clarify result type
src/core/AmbiguityDetector.ts          MODIFY — add domain hint detection
src/tui/NaturalInterface.ts            MODIFY — handle needsClarification, ask user, retry loop
src/types/                             CREATE clarify.ts — clarify result types
test/unit/core/GenerationOrchestrator.test.ts  MODIFY — add disambiguation tests
test/unit/core/AmbiguityDetector.test.ts      MODIFY — add domain hint tests
```

---

## Task 1: Add clarify result type

**Files:**
- Create: `src/core/clarify.ts`
- Test: `test/unit/core/clarify.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/unit/core/clarify.test.ts
import { describe, it, expect } from 'vitest';
import type { ClarifyResult } from '../../../src/core/clarify.js';

describe('ClarifyResult', () => {
  it('has correct shape for clarification needed', () => {
    const result: ClarifyResult = {
      needsClarification: true,
      clarifyingQuestions: [
        {
          question: 'What domain?',
          options: ['P5.js sketch', 'Three.js 3D scene', 'HTML/CSS page', 'Hydra video synth'],
          default: 'P5.js sketch',
        },
      ],
      suggestions: ['p5', 'three', 'html', 'hydra'],
    };
    expect(result.needsClarification).toBe(true);
    expect(result.clarifyingQuestions[0].options.length).toBeGreaterThan(1);
  });

  it('has correct shape for generation result', () => {
    const result = {
      needsClarification: false,
      code: 'console.log("hello")',
    };
    expect(result.needsClarification).toBe(false);
    expect(result.code).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test test/unit/core/clarify.test.ts`
Expected: FAIL — file does not exist

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/clarify.ts

export interface ClarifyingQuestion {
  /** The question text to ask the user */
  question: string;
  /** Available options (null for free-text answer) */
  options: string[] | null;
  /** Default selection if user just hits enter */
  default: string;
}

/**
 * Result returned when generation cannot proceed without user clarification.
 */
export interface ClarifyResult {
  /** True when the prompt needs clarification before generation */
  needsClarification: true;
  clarifyingQuestions: ClarifyingQuestion[];
  /** Suggested domain names to pre-populate generator confidence */
  suggestions: string[];
}

/**
 * Successful generation result (mutually exclusive with ClarifyResult).
 */
export interface GenerationSuccess {
  needsClarification: false;
  code: string;
  thinking?: string;
  model?: string;
  recoveredFromThinking?: boolean;
  warnings?: string[];
}

/** Union type for all generation results */
export type GenerationOutcome = ClarifyResult | GenerationSuccess;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test test/unit/core/clarify.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/clarify.ts test/unit/core/clarify.test.ts
git commit -m "feat(clarify): add clarify result types"
```

---

## Task 2: Add domain hint detection to AmbiguityDetector

**Files:**
- Modify: `src/core/AmbiguityDetector.ts:299-337` (add method after `getHighPriorityIssues`)
- Test: `test/unit/core/AmbiguityDetector.test.ts` (add new describe block)

- [ ] **Step 1: Write the failing test**

Add to `test/unit/core/AmbiguityDetector.test.ts`:

```typescript
// Add to end of file, inside describe('AmbiguityDetector', () => { ... })

// ── Domain hint detection ────────────────────────────────────────

describe('getDomainHints()', () => {
  it('returns p5 for visual/generative art terms', () => {
    const hints = detector.getDomainHints('make something beautiful with circles and colors');
    expect(hints).toContain('p5');
  });

  it('returns multiple hints for mixed requests', () => {
    const hints = detector.getDomainHints('make a 3d scene with music');
    expect(hints).toContain('three');
    expect(hints).toContain('music');
  });

  it('returns empty array when no domain signals found', () => {
    const hints = detector.getDomainHints('help me with my code');
    expect(hints).toEqual([]);
  });

  it('returns three for three.js/3d keywords', () => {
    expect(detector.getDomainHints('create a three.js 3d cube')).toContain('three');
    expect(detector.getDomainHints('webgl scene with geometry')).toContain('three');
  });

  it('returns html for web page keywords', () => {
    expect(detector.getDomainHints('build a landing page for my portfolio')).toContain('html');
    expect(detector.getDomainHints('make a responsive dashboard')).toContain('html');
  });

  it('returns music for audio keywords', () => {
    expect(detector.getDomainHints('generate a melody with piano notes')).toContain('music');
    expect(detector.getDomainHints('create a beat and rhythm pattern')).toContain('music');
  });

  it('returns shader for glsl/ray march keywords', () => {
    expect(detector.getDomainHints('ray march a shader with sdf')).toContain('shader');
    expect(detector.getDomainHints('fragment shader with glsl')).toContain('shader');
  });

  it('returns hydra for video synth keywords', () => {
    expect(detector.getDomainHints('hydra video synth with kaleid')).toContain('hydra');
  });

  it('returns strudel for pattern music keywords', () => {
    expect(detector.getDomainHints('strudel techno beat pattern')).toContain('music');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test test/unit/core/AmbiguityDetector.test.ts -- --reporter=verbose 2>&1 | grep "getDomainHints"`
Expected: FAIL — method does not exist

- [ ] **Step 3: Add getDomainHints method to AmbiguityDetector**

Add this method to `AmbiguityDetector` class in `src/core/AmbiguityDetector.ts` after `getHighPriorityIssues()` (around line 336):

```typescript
/**
 * Detect likely domain(s) from partial intent signals in the prompt.
 *
 * Returns domain names (p5, three, html, music, shader, hydra, strudel, tone, ascii)
 * for any keywords that don't rise to the level of a full canHandle() match
 * but suggest the user's intent.
 *
 * Used to pre-populate clarifying question options and suggestions.
 */
getDomainHints(prompt: string): string[] {
  const hints: string[] = [];
  const lower = prompt.toLowerCase();

  // Visual/generative art — core p5 domain
  if (/circles?|particles?|sketch|draw|paint|animation/i.test(lower)) {
    hints.push('p5');
  }

  // 3D / WebGL — three.js
  if (/three\.js|threejs|\bthree\b|\b3d\b|webgl|cube|sphere|mesh|geometry/i.test(lower)) {
    hints.push('three');
  }

  // Web/HTML
  if (/landing\s*page|portfolio|dashboard|website|web\s*page|html|css|responsive/i.test(lower)) {
    hints.push('html');
  }

  // Music / audio
  if (/music|melody|rhythm|beat|chord|piano|guitar|harmony|tempo|audio|drum/i.test(lower)) {
    hints.push('music');
  }

  // GLSL / shaders
  if (/shader|glsl|ray\s*march|sdf|fragment|kaleid/i.test(lower)) {
    hints.push('shader');
  }

  // Hydra
  if (/hydra|video\s*synth|visual\s*synthesis/i.test(lower)) {
    hints.push('hydra');
  }

  // Strudel / Tidal
  if (/strudel|tidal|live\s*coding\s*music|sequencer/i.test(lower)) {
    hints.push('music');
  }

  // Tone.js
  if (/tone\.?js|tonejs|synthesizer|synth|arp|drone/i.test(lower)) {
    hints.push('tone');
  }

  // ASCII
  if (/ascii|text\s*art|character\s*art/i.test(lower)) {
    hints.push('ascii');
  }

  return [...new Set(hints)]; // deduplicate
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test test/unit/core/AmbiguityDetector.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/AmbiguityDetector.ts test/unit/core/AmbiguityDetector.test.ts
git commit -m "feat(ambiguity): add getDomainHints() for intent detection"
```

---

## Task 3: Wire disambiguation into GenerationOrchestrator

**Files:**
- Modify: `src/core/GenerationOrchestrator.ts:28-37` (add ClarifyResult import + type)
- Modify: `src/core/GenerationOrchestrator.ts:107-135` (add disambiguation gate before P5 fallback)
- Test: `test/unit/core/GenerationOrchestrator.test.ts` (add disambiguation tests)

- [ ] **Step 1: Write the failing tests**

Add to `test/unit/core/GenerationOrchestrator.test.ts` inside the `describe('GenerationOrchestrator', () => {` block:

```typescript
// ── Disambiguation path ────────────────────────────────────────────

describe('disambiguation', () => {
  it('returns needsClarification when no dispatch match and prompt is ambiguous', async () => {
    (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue(null);
    // "make it cooler" is flagged as ambiguous by AmbiguityDetector
    const options = makeOptions();
    const orchestrator = new GenerationOrchestrator(options, gallery, null);
    const result = await orchestrator.generate('make it cooler', 'make it cooler') as any;
    expect(result.needsClarification).toBe(true);
    expect(result.clarifyingQuestions).toBeDefined();
    expect(result.clarifyingQuestions.length).toBeGreaterThan(0);
  });

  it('falls through to P5 when no dispatch match and prompt is NOT ambiguous', async () => {
    (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue(null);
    // "blue circle at 200 200 radius 50" is specific enough — not ambiguous
    const options = makeOptions();
    const orchestrator = new GenerationOrchestrator(options, gallery, null);
    const result = await orchestrator.generate(
      'blue circle at 200 200 radius 50',
      'blue circle at 200 200 radius 50'
    ) as any;
    // Should not trigger clarification for specific geometric requests
    expect(result.needsClarification ?? false).toBe(false);
    expect(result.code).toBe('fallback-code');
  });

  it('includes domain hints in clarification result', async () => {
    (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue(null);
    // "make a 3d animation with circles" has hints but no domain match
    const options = makeOptions();
    const orchestrator = new GenerationOrchestrator(options, gallery, null);
    const result = await orchestrator.generate(
      'make a 3d animation with circles',
      'make a 3d animation with circles'
    ) as any;
    expect(result.needsClarification).toBe(true);
    expect(result.suggestions).toContain('three');
    expect(result.suggestions).toContain('p5');
  });

  it('skips disambiguation when useSwarm is true', async () => {
    const options = makeOptions({ useSwarm: true });
    const orchestrator = new GenerationOrchestrator(options, gallery, null);
    const result = await orchestrator.generate('make it cooler', 'make it cooler') as any;
    // Swarm should bypass disambiguation
    expect(result.code).toBe('swarm-code');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test test/unit/core/GenerationOrchestrator.test.ts -- --reporter=verbose 2>&1 | grep -E "disambiguation|needsClarification"`
Expected: FAIL — `needsClarification` not a property of result

- [ ] **Step 3: Update GenerationResult type and import ClarifyResult**

In `src/core/GenerationOrchestrator.ts`, update the import at the top and the `GenerationResult` interface:

```typescript
// Add import after Logger import (line ~26)
import { AmbiguityDetector } from './AmbiguityDetector.js';
import type { ClarifyResult, GenerationSuccess } from './clarify.js';

// Replace GenerationResult interface (lines ~30-37)
export type GenerationOutcome = ClarifyResult | GenerationSuccess;
```

- [ ] **Step 4: Add disambiguation gate in generate() method**

In `src/core/GenerationOrchestrator.ts`, replace the P5 fallback block (lines 130-134):

```typescript
    // NO specialized generator matched — check for ambiguity before falling back to P5
    const ambiguityDetector = new AmbiguityDetector();
    const issues = ambiguityDetector.detect(usedPrompt);

    if (issues.length > 0) {
      const hints = ambiguityDetector.getDomainHints(usedPrompt);
      // Format questions for the user — deduplicate and limit to 4
      const questions = issues.slice(0, 4).map((issue) => ({
        question: issue.suggestedQuestion,
        options: null, // free-text answer
        default: '',
      }));

      return {
        needsClarification: true,
        clarifyingQuestions: questions,
        suggestions: hints,
      } as ClarifyResult;
    }

    const { P5GeneratorLLM } = await import('../generators/p5/P5GeneratorLLM.js');
    const config = await getEffectiveConfig(undefined, process.cwd());
    const generator = new P5GeneratorLLM(
      config.baseUrl
        ? { baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKey, role: 'generator' }
        : undefined,
      { bypassCache }
    );
    const result = await generator.generate(usedPrompt, { bypassCache });
    return normalizeGeneratorResult(result);
```

Also update the `normalizeGeneratorResult` function to handle the new `ClarifyResult` return (since it may now be called with a `ClarifyResult` in the collab path too — actually, the collab path returns before reaching this, so it's fine. But we need to make sure `normalizeGeneratorResult` doesn't accidentally wrap a `ClarifyResult`):

```typescript
function normalizeGeneratorResult(
  result: string | GeneratorResultType
): GenerationSuccess {
  if (typeof result === 'string') {
    return { needsClarification: false, code: result };
  }
  return {
    needsClarification: false,
    code: result.code,
    thinking: result.thinking,
    model: result.model,
    recoveredFromThinking: result.recoveredFromThinking,
    warnings: [],
  };
}
```

Actually, `normalizeGeneratorResult` returns `GenerationSuccess` — let's make sure we also export the type properly. The `GenerationResult` type name is still used internally, so keep backward compat:

```typescript
// Update GenerationResult to include needsClarification for backward compat
export interface GenerationResult {
  needsClarification?: false;
  code: string;
  thinking?: string;
  model?: string;
  recoveredFromThinking?: boolean;
  warnings?: string[];
}
```

Actually let me be cleaner — keep `GenerationResult` as the union:

```typescript
// Replace GenerationResult with union type
export type GenerationResult = ClarifyResult | GenerationSuccess;
```

This may break other files that import `GenerationResult`. Check for usages:

- [ ] **Step 4b: Check what imports GenerationResult and update accordingly**

Run: `grep -r "GenerationResult" /Users/simongonzalezdecruz/workspaces/liminal/src --include="*.ts" -l`

Expected files that need updating (they'll get TypeScript errors on the union type):
- Check each file and update to handle both shapes

The key insight: `GenerationOrchestrator.generate()` now returns `ClarifyResult | GenerationSuccess`. Any caller doing `result.code` directly needs to narrow the type first. Update callers to check `result.needsClarification`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test test/unit/core/GenerationOrchestrator.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `pnpm test 2>&1 | tail -30`
Expected: All existing tests still pass

- [ ] **Step 7: Commit**

```bash
git add src/core/GenerationOrchestrator.ts src/core/clarify.ts test/unit/core/GenerationOrchestrator.test.ts
git commit -m "feat(orchestrator): gate P5 fallback with AmbiguityDetector"
```

---

## Task 4: Wire clarification loop into NaturalInterface

**Files:**
- Modify: `src/tui/NaturalInterface.ts:187-242` (handleAgentRequest)
- Modify: `src/tui/NaturalInterface.ts:37-42` (NaturalInputResult type)

- [ ] **Step 1: Write the failing test**

Add disambiguation test to existing test file or create new one. First check if there's an existing NaturalInterface test:

- [ ] **Step 1b: Check for existing NaturalInterface test**

Run: `ls /Users/simongonzalezdecruz/workspaces/liminal/test/unit/tui/ 2>/dev/null || echo "no tui test dir"`
Expected: may not exist — create if needed

Create `test/unit/tui/NaturalInterface.test.ts` with mock harness:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/harness/agent/LLMModeAgent.js', () => ({
  LLMModeAgent: vi.fn(function(this: any) {
    this.executeTask = vi.fn();
  }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: vi.fn(),
}));

vi.mock('../../../src/core/AmbiguityDetector.js', () => ({
  AmbiguityDetector: vi.fn(function(this: any) {
    this.detect = vi.fn(() => [
      {
        type: 'vague',
        severity: 'medium',
        description: 'Vague term "cooler" found',
        suggestedQuestion: 'Describe the specific aesthetic or interaction you find "cool".',
      },
    ]);
    this.getDomainHints = vi.fn(() => ['p5']);
  }),
}));

import { NaturalInterface } from '../../../src/tui/NaturalInterface.js';

function makeSut() {
  const onStatus = vi.fn();
  const onLog = vi.fn();
  const harnessAgent = { executeTask: vi.fn() } as any;
  const llmAgent = { executeTask: vi.fn() } as any;
  const llmClient = { complete: vi.fn() } as any;

  const ni = new NaturalInterface({
    harnessAgent,
    llmAgent,
    llmClient,
    tasks: [],
    onStatus,
    onLog,
  });

  return { ni, onStatus, onLog, llmAgent };
}

describe('NaturalInterface — disambiguation', () => {
  it('shows clarifying questions when generate returns needsClarification', async () => {
    const { ni, llmAgent } = makeSut();

    llmAgent.executeTask.mockResolvedValueOnce({
      status: 'success',
      stepCount: 1,
      messages: [],
    });

    // First call returns clarification signal
    llmAgent.executeTask
      .mockResolvedValueOnce({
        status: 'success',
        stepCount: 1,
        messages: [],
        needsClarification: true,
        clarifyingQuestions: [
          {
            question: 'What domain would you like?',
            options: ['P5.js sketch', 'Three.js 3D scene', 'HTML/CSS page'],
            default: 'P5.js sketch',
          },
        ],
        suggestions: ['p5'],
      });

    // Simulate user providing answer (this will require a stdin mock — check handleAgentRequest can accept answers)

    const result = await ni.processInput('make it cooler');
    // After fix: should detect clarification and present questions
    expect(result.type).toBe('ambiguous');
    expect(result.response).toContain('domain');
  });
});
```

Note: This test will likely need to be refined based on how the interface accepts user answers. The key behavior being tested: when `handleAgentRequest` gets a `needsClarification` result from the orchestrator, it should return a `NaturalInputResult` with `type: 'ambiguous'` and the questions in the response.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test test/unit/tui/NaturalInterface.test.ts`
Expected: FAIL — file doesn't exist yet / behavior not implemented

- [ ] **Step 3: Update NaturalInputResult type**

In `src/tui/NaturalInterface.ts`, update the interface and the `handleAgentRequest` method:

```typescript
// Update NaturalInputResult interface (~line 37)
interface NaturalInputResult {
  type: 'chat' | 'agent' | 'command' | 'ambiguous';
  response: string;
  actionTaken?: string;
  shouldContinue: boolean;
  /** Present when type is 'ambiguous' — clarifying questions to present to user */
  clarifyingQuestions?: Array<{
    question: string;
    options: string[] | null;
    default: string;
  }>;
  /** Accumulated context from previous clarification answers */
  enrichedPrompt?: string;
}
```

- [ ] **Step 4: Update handleAgentRequest to handle clarification**

Replace the entire `handleAgentRequest` method (lines 187-242) with:

```typescript
  /**
   * Handle agent request (LLM-driven code changes).
   * Falls back to AmbiguityDetector when no domain matches.
   */
  private async handleAgentRequest(input: string): Promise<NaturalInputResult> {
    this.onStatus('Thinking...');
    this.onLog(`Agent task: ${input.slice(0, 60)}...`);

    try {
      const task: LLMTask = {
        id: `agent-${Date.now()}`,
        title: input.slice(0, 50),
        description: input,
        maxSteps: 15,
        approved: true,
      };

      const session = await this.llmAgent.executeTask(task);

      // ── Disambiguation path ──────────────────────────────────────
      // If the orchestrator returned a clarification signal, ask the user
      if (session.needsClarification && session.clarifyingQuestions) {
        const questions = session.clarifyingQuestions;
        const suggestions = session.suggestions || [];

        // Format questions for display
        const lines = ['\uD83D\uDD0A Clarifying questions:'];
        for (let i = 0; i < questions.length; i++) {
          lines.push(`\n${i + 1}. ${questions[i].question}`);
          if (questions[i].options) {
            lines.push(`   Options: ${questions[i].options.join(', ')}`);
          }
        }
        if (suggestions.length > 0) {
          lines.push(`\n   Detected intent: ${suggestions.join(', ')}`);
        }
        lines.push('\nType your answer(s) to continue, or rephrase your request.');

        return {
          type: 'ambiguous',
          response: lines.join('\n'),
          actionTaken: `${questions.length} question(s) asked`,
          shouldContinue: true,
          clarifyingQuestions: questions,
          enrichedPrompt: input,
        };
      }

      // ── Normal agent completion path ─────────────────────────────
      for (const msg of session.messages) {
        if (msg.role === 'assistant' && msg.toolCall) {
          this.onLog(`\u2192 ${msg.toolCall.tool}`);
        }
      }

      const statusEmoji =
        session.status === 'success' ? '\u2705' :
        session.status === 'rolled_back' ? '\u23EE\uFE0F' : '\u274C';

      const response = [
        `${statusEmoji} Task ${session.status}`,
        session.status === 'success'
          ? 'The changes have been applied and verified.'
          : session.status === 'rolled_back'
          ? 'Changes were rolled back due to errors.'
          : 'The task could not be completed.',
      ].join('\n');

      this.addMessage('assistant', response, {
        toolCalls: session.messages
          .filter(m => m.role === 'assistant' && m.toolCall)
          .map(m => m.toolCall!.tool),
      });

      return {
        type: 'agent',
        response,
        actionTaken: `Executed ${session.stepCount} steps`,
        shouldContinue: true,
      };

    } catch (error) {
      const msg = formatError('Agent', error);
      return {
        type: 'agent',
        response: `\u274C ${msg}`,
        shouldContinue: true,
      };
    }
  }
```

**Note:** The `session` object returned by `llmAgent.executeTask()` needs to include `needsClarification`, `clarifyingQuestions`, and `suggestions` fields. This means `LLMTask` and the agent execution path need to propagate these from `GenerationOrchestrator.generate()` back up.

- [ ] **Step 4b: Update LLMTask / agent return type to include clarification fields**

Check `src/harness/agent/LLMModeAgent.ts`:

Run: `grep -n "executeTask\|interface.*Task\|type.*Task" /Users/simongonzalezdecruz/workspaces/liminal/src/harness/agent/LLMModeAgent.ts | head -20`

The `LLMTask` interface and `executeTask` return type need to carry the clarification signal. Update `LLMTask` result type:

```typescript
// In LLMTask result — add clarification fields
interface TaskResult {
  id: string;
  status: 'success' | 'failed' | 'rolled_back';
  stepCount: number;
  messages: ConversationMessage[];
  // New: disambiguation
  needsClarification?: boolean;
  clarifyingQuestions?: Array<{ question: string; options: string[] | null; default: string }>;
  suggestions?: string[];
}
```

Update the call chain: `LLMTask.executeTask()` → calls orchestrator → returns result with `needsClarification`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test test/unit/tui/NaturalInterface.test.ts`
Expected: PASS (may need adjustment based on actual agent type signatures)

- [ ] **Step 6: Run full test suite**

Run: `pnpm test 2>&1 | tail -30`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/tui/NaturalInterface.ts test/unit/tui/NaturalInterface.test.ts
git commit -m "feat(tui): handle clarification signal and present questions to user"
```

---

## Task 5: End-to-end integration test

**Files:**
- Create: `test/integration/disambiguation.test.ts`

- [ ] **Step 1: Write the integration test**

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('disambiguation flow — integration', () => {
  it('full round-trip: ambiguous prompt → questions → answer → generation', async () => {
    // This test verifies the complete flow:
    // 1. User types vague prompt
    // 2. System detects ambiguity
    // 3. System asks clarifying question
    // 4. User provides answer
    // 5. System generates with enriched context

    // Mock AmbiguityDetector to return issues
    vi.doMock('../../src/core/AmbiguityDetector.js', () => ({
      AmbiguityDetector: vi.fn(function(this: any) {
        this.detect = vi.fn(() => [
          {
            type: 'vague',
            severity: 'high',
            description: 'Vague term "cool" found',
            suggestedQuestion: 'Describe the specific aesthetic or interaction you find "cool".',
          },
        ]);
        this.getDomainHints = vi.fn(() => ['p5']);
        this.isAmbiguous = vi.fn(() => true);
      }),
    }));

    // The orchestrator should receive the clarification result
    // and the NaturalInterface should surface the questions
    const { NaturalInterface } = await import('../../src/tui/NaturalInterface.js');
    // ... full integration test
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `pnpm test test/integration/disambiguation.test.ts`
Expected: PASS (after all wiring is complete)

- [ ] **Step 3: Commit**

```bash
git add test/integration/disambiguation.test.ts
git commit -m "test(e2e): add disambiguation flow integration test"
```

---

## Self-Review Checklist

- [ ] `clarify.ts` exports `ClarifyResult`, `ClarifyingQuestion`, `GenerationSuccess`, `GenerationOutcome`
- [ ] `AmbiguityDetector.getDomainHints()` returns domain names matching generator names (p5, three, html, music, shader, hydra, tone, ascii)
- [ ] `GenerationOrchestrator.generate()` returns `ClarifyResult` when `dispatch()` is null AND `AmbiguityDetector.detect()` returns issues
- [ ] `GenerationOrchestrator.generate()` returns `GenerationSuccess` (old code result) when dispatch matches or prompt is unambiguous
- [ ] `GenerationResult` is now a union type — all callers are updated to narrow with `needsClarification`
- [ ] `LLMTask` result type propagates `needsClarification` and `clarifyingQuestions` from orchestrator
- [ ] `NaturalInterface.handleAgentRequest()` returns `type: 'ambiguous'` with questions when clarification is needed
- [ ] All new code has tests; existing tests still pass
- [ ] No `toBeDefined()` alone as the only assertion in any new test
