# Harness Task: Convert P5Generator to Plugin Format

**Task ID:** convert-p5-to-plugin  
**Priority:** HIGH  
**Estimated Effort:** 2-3 hours  
**Dependencies:** Plugin system (already implemented)  

---

## Objective

Convert the existing `P5GeneratorV2` from a static class to a dynamic plugin format. This involves:
1. Creating a plugin manifest (`plugin.json`)
2. Refactoring the generator to export plugin-compatible functions
3. Ensuring backward compatibility with existing code
4. Registering the plugin with the PluginLoader

---

## Current State Analysis

**Existing Files:**
- `src/generators/p5/P5GeneratorV2.ts` - Main generator class (59 lines)
- `src/generators/p5/P5GeneratorLLM.ts` - LLM wrapper (48 lines)
- `src/generators/TierBasedGenerator.ts` - Base class
- `src/generators/registerGenerators.ts` - Static registration

**Current Architecture:**
```typescript
// Static class approach
class P5GeneratorV2 extends TierBasedGenerator {
  constructor(llmOrConfig?) { super('p5', llmOrConfig); }
  async generate(prompt, options?) { /* ... */ }
  protected validateOutput(code) { /* ... */ }
}
```

**Target Architecture:**
```typescript
// Plugin-based approach
// plugin.json - Manifest
// index.ts - Exports generate(), canHandle(), initialize()
```

---

## Implementation Steps

### Step 1: Create Plugin Directory Structure

**Create:** `src/generators/P5Generator/` (new directory)

```
src/generators/P5Generator/
├── plugin.json          # Plugin manifest
├── index.ts             # Main entry point
└── README.md            # Documentation (optional but recommended)
```

### Step 2: Create Plugin Manifest

**File:** `src/generators/P5Generator/plugin.json`

```json
{
  "id": "p5",
  "name": "P5.js Generator",
  "version": "2.0.0",
  "description": "Generates p5.js creative coding sketches with canvas-based animations and interactive art",
  "entry": "index.js",
  "domains": ["p5", "p5.js", "processing", "canvas"],
  "keywords": [
    "canvas",
    "animation",
    "sketch",
    "circle",
    "particles",
    "ellipse",
    "rect",
    "color",
    "draw",
    "setup",
    "creative coding",
    "generative art"
  ],
  "author": "Liminal Team",
  "minLiminalVersion": "2.0.0"
}
```

**Validation Criteria:**
- [ ] All required fields present (id, name, version, description, entry, domains, keywords)
- [ ] ID is "p5" (matches existing domain)
- [ ] Keywords include common p5 terms (circle, canvas, animation, etc.)
- [ ] JSON is valid and parseable

### Step 3: Create Plugin Entry Point

**File:** `src/generators/P5Generator/index.ts`

**Requirements:**

1. **Import dependencies:**
   - `TierBasedGenerator` from `../TierBasedGenerator.js`
   - `LLMClient` from `../../llm/LLMClient.js`
   - `PluginManifest` from `../../plugins/types.js`

2. **Export required functions:**
   - `generate(prompt: string, options?: GenerateOptions): Promise<string>`
   - `canHandle(prompt: string): number` (optional but recommended)
   - `initialize(): Promise<void>` (optional)

3. **Implementation details:**
   - Create a `TierBasedGenerator` instance internally
   - Use domain 'p5' 
   - Preserve all existing validation logic (`validateOutput`)
   - Preserve sound detection logic (`promptSuggestsSound`)
   - Support the `signal` option for cancellation
   - Support `bypassCache` option

**Template:**

```typescript
/**
 * P5.js Generator Plugin
 * 
 * Converts creative coding prompts into p5.js JavaScript code.
 */

import { TierBasedGenerator } from '../TierBasedGenerator.js';
import { LLMClient } from '../../llm/LLMClient.js';
import type { GenerateOptions } from '../../plugins/types.js';

// Internal generator instance
let generator: TierBasedGenerator | null = null;

/**
 * Initialize the plugin (called once on load)
 */
export async function initialize(): Promise<void> {
  // Create generator with default LLM config
  generator = new P5GeneratorInternal();
}

/**
 * Generate p5.js code from a prompt
 */
export async function generate(
  prompt: string, 
  options: GenerateOptions = {}
): Promise<string> {
  if (!generator) {
    await initialize();
  }
  
  // Call internal generator
  // Handle options.signal (AbortSignal)
  // Handle options.bypassCache
  
  return generator!.generate(prompt, {
    signal: options.signal,
    bypassCache: options.bypassCache,
  });
}

/**
 * Check if this plugin can handle the prompt
 * Returns confidence score 0-1
 */
export function canHandle(prompt: string): number {
  const lower = prompt.toLowerCase();
  
  // High confidence for explicit p5 mentions
  if (/\bp5\b|p5\.js|processing/i.test(lower)) return 0.95;
  
  // Medium confidence for canvas/visual keywords
  if (/\b(canvas|animation|sketch|creative coding)\b/i.test(lower)) return 0.7;
  
  // Low confidence for shape/color keywords (could be other domains)
  if (/\b(circle|ellipse|rect|particles)\b/i.test(lower)) return 0.4;
  
  // Default fallback
  return 0.1;
}

// Internal implementation preserving existing logic
class P5GeneratorInternal extends TierBasedGenerator {
  constructor() {
    super('p5');
  }

  // Override generate to add sound detection
  async generate(prompt: string, options?: { signal?: AbortSignal; bypassCache?: boolean }): Promise<string> {
    const needsSound = this.promptSuggestsSound(prompt.toLowerCase());
    if (needsSound) {
      console.log('[P5Generator] Sound detected in prompt, will include audio guidance');
    }
    
    return super.generate(prompt, options);
  }

  // Preserve existing validation
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const hasSetup = code.includes('function setup()') || code.includes('setup()');
    
    if (!hasSetup) {
      return {
        valid: false,
        error: 'Generated code missing required setup() function',
      };
    }

    if (!code.includes('createCanvas')) {
      console.warn('[P5Generator] Warning: Code may be missing createCanvas()');
    }

    return { valid: true };
  }

  private promptSuggestsSound(lowerPrompt: string): boolean {
    const soundKeywords = ['sound', 'audio', 'music', 'beep', 'tone'];
    return soundKeywords.some((kw) => lowerPrompt.includes(kw));
  }
}
```

**Validation Criteria:**
- [ ] Exports `generate()` function
- [ ] Exports `canHandle()` function
- [ ] Exports `initialize()` function (optional but good practice)
- [ ] Preserves sound detection logic
- [ ] Preserves validation logic (setup() check, createCanvas warning)
- [ ] Supports AbortSignal for cancellation
- [ ] Supports bypassCache option
- [ ] No hardcoded LLM config - uses default or env vars

### Step 4: Update GeneratorRegistry (if needed)

**File:** `src/generators/GeneratorRegistry.ts`

The registry should already support plugins via `PluginLoader`. Ensure:
- [ ] Registry can load plugins from `src/generators/*/plugin.json`
- [ ] Static fallback exists for built-in generators

### Step 5: Update registerGenerators.ts

**File:** `src/generators/registerGenerators.ts`

Add plugin registration:

```typescript
import { pluginLoader } from '../plugins/PluginLoader.js';
import * as p5Plugin from './P5Generator/index.js';

export function registerAllGenerators(): void {
  // Register P5 as a plugin instead of static entry
  pluginLoader.registerPlugin({
    manifest: {
      id: 'p5',
      name: 'P5.js Generator',
      version: '2.0.0',
      description: 'Generates p5.js creative coding sketches',
      entry: 'index.js',
      domains: ['p5', 'p5.js', 'processing'],
      keywords: ['canvas', 'animation', 'sketch', 'circle', 'particles'],
    },
    generate: p5Plugin.generate,
    canHandle: p5Plugin.canHandle,
    initialize: p5Plugin.initialize,
  });
  
  // ... other generators
}
```

**Alternative:** If PluginLoader auto-discovers from directory, ensure:
- [ ] `src/generators/P5Generator/` is in the discovery path

### Step 6: Maintain Backward Compatibility

**Critical:** Existing code using `P5GeneratorV2` directly must still work.

**File:** `src/generators/p5/P5GeneratorV2.ts`

Keep this file but make it a thin wrapper:

```typescript
/**
 * @deprecated Use P5Generator plugin instead
 * This file is kept for backward compatibility
 */

import { generate } from '../P5Generator/index.js';

export class P5GeneratorV2 {
  async generate(prompt: string, options?: any): Promise<string> {
    return generate(prompt, options);
  }
}
```

---

## Evaluation Criteria

### Functionality Tests

1. **Basic Generation:**
   ```bash
   ./bin/liminal generate "blue circle on canvas" --output test-p5.html
   ```
   **Pass:** Output contains valid p5.js code with setup() and draw()

2. **Sound Detection:**
   ```bash
   ./bin/liminal generate "circle with sound" --output test-sound.html
   ```
   **Pass:** Console log shows "Sound detected in prompt"

3. **Plugin Loading:**
   ```typescript
   const plugin = pluginLoader.getPlugin('p5');
   console.log(plugin?.manifest.name); // "P5.js Generator"
   ```
   **Pass:** Plugin loads and manifest is accessible

4. **canHandle() Scoring:**
   ```typescript
   import { canHandle } from './src/generators/P5Generator/index.js';
   
   console.log(canHandle("p5.js animation")); // >= 0.9
   console.log(canHandle("canvas sketch"));   // >= 0.5
   console.log(canHandle("shader glsl"));     // < 0.2
   ```
   **Pass:** Returns appropriate confidence scores

5. **Cancellation:**
   ```typescript
   const controller = new AbortController();
   setTimeout(() => controller.abort(), 1000);
   
   try {
     await generate("complex particle system", { signal: controller.signal });
   } catch (e) {
     // Should abort
   }
   ```
   **Pass:** Generation aborts when signal triggered

### Code Quality Checks

- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No `any` types (strict typing)
- [ ] Proper JSDoc comments on exports
- [ ] No console.log in production (use eventBus instead)
- [ ] Error handling for all async operations

### Backward Compatibility

- [ ] Existing `new P5GeneratorV2()` still works
- [ ] Existing imports don't break
- [ ] RalphLoop uses new plugin seamlessly

### Performance

- [ ] Plugin loads in < 100ms
- [ ] Generation time unchanged (< 5% difference)
- [ ] Memory usage unchanged

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Build passes | 100% | `npm run build` exits 0 |
| Tests pass | 1741+ | `npm test` |
| Generation works | 100% | Manual test with 5 prompts |
| Plugin loads | < 100ms | `console.time()` |
| Backward compat | 100% | Old code still runs |

---

## Deliverables

1. ✅ `src/generators/P5Generator/plugin.json` - Valid manifest
2. ✅ `src/generators/P5Generator/index.ts` - Plugin entry point
3. ✅ `src/generators/p5/P5GeneratorV2.ts` - Backward compat wrapper (if needed)
4. ✅ Tests pass - All 1741+ existing tests
5. ✅ Build passes - TypeScript compiles

---

## Common Pitfalls to Avoid

1. **Don't break existing imports** - Keep P5GeneratorV2 export working
2. **Don't hardcode LLM config** - Use env vars or defaults
3. **Don't lose validation** - setup() check must still work
4. **Don't forget sound detection** - It's a key feature
5. **Don't skip error handling** - All async ops need try/catch

---

## Verification Commands

```bash
# 1. Build
npm run build

# 2. Test
npm test

# 3. Manual generation test
export LIMINAL_LLM_BASE_URL=http://localhost:1234/v1
./bin/liminal generate "blue circle" --output test-output.html

# 4. Check plugin loaded
node -e "
const { pluginLoader } = require('./dist/plugins/PluginLoader.js');
pluginLoader.registerPlugin({
  manifest: { id: 'test', name: 'Test', version: '1.0.0', description: 'Test', entry: 'test.js', domains: ['test'], keywords: ['test'] },
  generate: async () => 'test'
});
console.log('Plugins:', pluginLoader.getAllPlugins().map(p => p.manifest.id));
"

# 5. Verify backward compat
node -e "
const { P5GeneratorV2 } = require('./dist/generators/p5/P5GeneratorV2.js');
const gen = new P5GeneratorV2();
console.log('P5GeneratorV2 instantiated successfully');
"
```

---

## Notes for Harness Agent

- This is a **refactoring task**, not new feature development
- Preserve existing behavior exactly
- The plugin system is already implemented (PluginLoader, types, etc.)
- Focus on "adapter" pattern - wrap existing logic in plugin interface
- Test thoroughly - P5 is the primary generator for Liminal

---

## References

- `src/plugins/types.ts` - Plugin interface definitions
- `src/plugins/PluginLoader.ts` - How plugins are loaded
- `src/generators/TierBasedGenerator.ts` - Base class to extend
- `src/generators/p5/P5GeneratorV2.ts` - Original implementation to port
- `docs/dynamic-domain-registration.md` - Plugin architecture docs
