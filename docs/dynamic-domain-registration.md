# Dynamic Domain Registration

## Overview

The GeneratorRegistry now supports dynamic domain registration at runtime. This allows you to extend Sinter's creative capabilities without modifying the core codebase.

## Features

- **Register new creative domains** at runtime with custom keywords and generation logic
- **Automatic keyword detection** - prompts are matched against domain keywords
- **Confidence-based routing** - specify how confident your domain is in handling prompts
- **SmartRouter integration** - dynamic domains are automatically recognized for routing
- **Domain management** - list, unregister, and check domain existence

## Basic Usage

### Registering a Domain

```typescript
import { generatorRegistry } from './src/generators/GeneratorRegistry.js';

generatorRegistry.registerDomain({
  name: 'lyrics',
  keywords: ['lyrics', 'poem', 'song words', 'verse'],
  confidence: 0.8,
  generate: async (prompt: string, context?: Record<string, unknown>) => {
    // Your generation logic here
    return `Generated lyrics for: ${prompt}`;
  },
});
```

### Using the Registry

Once registered, the domain is automatically available for dispatch:

```typescript
const dispatch = generatorRegistry.dispatch('write some lyrics');
if (dispatch) {
  console.log(`Domain: ${dispatch.entry.name}`);
  console.log(`Confidence: ${dispatch.confidence}`);
  const result = await dispatch.entry.generate('write some lyrics');
  console.log(result);
}
```

### SmartRouter Integration

Register domains with SmartRouter for routing awareness:

```typescript
import { SmartRouter } from './src/routing/SmartRouter.js';

const router = new SmartRouter();

// Register domain keywords with the router
router.registerDynamicDomain(
  'lyrics',           // domain name
  ['lyrics', 'poem'], // keywords
  'local',            // preferred model
  0.8                 // confidence
);

// Router will now recognize and route to your domain
const decision = router.routeByPrompt('generate lyrics');
console.log(decision.domain); // 'lyrics'
console.log(decision.model);  // 'local'
```

## API Reference

### GeneratorRegistry.registerDomain()

Register a new creative domain.

```typescript
interface DynamicDomainConfig {
  name: string;           // Unique domain name
  keywords: string[];     // Keywords that trigger this domain
  confidence: number;     // Confidence score (0-1)
  language?: string;      // Optional language identifier
  generate: (
    prompt: string,
    context?: Record<string, unknown>
  ) => string | Promise<string> | { code: string; language?: string };
}
```

**Parameters:**
- `name`: Unique identifier for this domain
- `keywords`: Array of keywords that trigger this domain (case-insensitive)
- `confidence`: Base confidence score (0-1) for keyword matching
- `generate`: Async function that generates content

**Returns:** Nothing

**Throws:** Error if domain with same name already exists

### GeneratorRegistry.unregisterDomain()

Remove a dynamically registered domain.

```typescript
const removed = generatorRegistry.unregisterDomain('lyrics');
// Returns: true if removed, false if not found
```

### GeneratorRegistry.hasDomain()

Check if a domain exists.

```typescript
const exists = generatorRegistry.hasDomain('lyrics');
// Returns: true if domain exists
```

### GeneratorRegistry.getDynamicDomains()

Get all dynamically registered domain names.

```typescript
const domains = generatorRegistry.getDynamicDomains();
// Returns: ['lyrics', 'joke', ...]
```

### SmartRouter.registerDynamicDomain()

Register a domain with the SmartRouter for routing awareness.

```typescript
router.registerDynamicDomain(
  'lyrics',           // domain name
  ['lyrics', 'poem'], // keywords
  'local',            // optimal model (optional)
  0.8                 // confidence (optional)
);
```

### SmartRouter.unregisterDynamicDomain()

Unregister a domain from the SmartRouter.

```typescript
const removed = router.unregisterDynamicDomain('lyrics');
// Returns: true if removed, false if not found
```

### SmartRouter.getAllDomainKeywords()

Get all domain keywords (built-in + dynamic).

```typescript
const keywords = router.getAllDomainKeywords();
// Returns: { music: [...], code: [...], lyrics: [...], ... }
```

## Confidence Scoring

The registry uses confidence scores to select the best generator for a prompt:

- **0.0**: Cannot handle (will never be selected)
- **0.1-0.3**: Low confidence (fallback)
- **0.4-0.6**: Medium confidence
- **0.7-0.9**: High confidence (specific patterns)
- **1.0**: Perfect confidence (exact match)

When multiple domains match, the highest confidence wins.

## Keyword Matching

Keywords are matched case-insensitively using substring matching:

```typescript
keywords: ['lyrics', 'poem']

// These prompts will match:
'write lyrics about love'      // contains 'lyrics'
'Create a POEM for me'         // contains 'poem' (case-insensitive)
'song lyrics and poetry'       // contains both keywords

// These will not match:
'write a story'                // no matching keywords
'lyrical'                      // substring match, not exact word
```

## Best Practices

### 1. Choose Specific Keywords

```typescript
// Good: specific, unambiguous keywords
{
  keywords: ['shader', 'glsl', 'fragment shader'],
  confidence: 0.8
}

// Avoid: overly generic keywords
{
  keywords: ['create', 'make', 'generate'],  // Too broad!
  confidence: 0.5
}
```

### 2. Use Appropriate Confidence Levels

```typescript
// High confidence for specific technical terms
{
  name: 'raymarching',
  keywords: ['ray march', 'sdf', 'signed distance'],
  confidence: 0.9  // Very specific
}

// Medium confidence for broader terms
{
  name: '3d',
  keywords: ['3d', 'three dimensional', 'scene'],
  confidence: 0.5  // More general
}
```

### 3. Handle Edge Cases

```typescript
generate: async (prompt: string, context?: Record<string, unknown>) => {
  try {
    // Your generation logic
    return result;
  } catch (error) {
    // Fallback to a default response
    return `Could not generate content for: ${prompt}`;
  }
}
```

### 4. Clean Up When Done

```typescript
// Unregister when no longer needed
generatorRegistry.unregisterDomain('temp-domain');

// Or clear all dynamic domains
generatorRegistry.clear();
```

## Examples

See `examples/dynamic-domain-registration.ts` for complete working examples.

## Testing

Dynamic domains are fully tested. Run tests with:

```bash
npm test -- test/unit/generator-registry-dynamic.test.ts
```

## Limitations

- Dynamic domains are not persisted across restarts
- Keywords are simple substring matches (no regex or NLP)
- Confidence scores are static (not learned from usage)
- Dynamic domains don't have A/B test data (use default routing)

## Future Enhancements

Possible future improvements:

- Persistent domain registration (save to config)
- Learned confidence scores from usage
- Regex and advanced keyword patterns
- Domain composition (combine multiple domains)
- Automatic keyword suggestion from examples

## Migration Guide

If you were previously modifying `registerGenerators.ts` to add domains:

### Before (modifying core files)

```typescript
// In src/generators/registerGenerators.ts
const myEntry: GeneratorEntry = {
  name: 'my-domain',
  canHandle: (prompt) => /my keyword/i.test(prompt) ? 0.8 : 0,
  generate: async (prompt) => { /* ... */ }
};

generatorRegistry.register(myEntry);
```

### After (dynamic registration)

```typescript
// In your application code
generatorRegistry.registerDomain({
  name: 'my-domain',
  keywords: ['my keyword'],
  confidence: 0.8,
  generate: async (prompt) => { /* ... */ }
});
```

Benefits:
- No need to modify core files
- Can be done at runtime
- Easier to test and maintain
- Works with plugin architectures
