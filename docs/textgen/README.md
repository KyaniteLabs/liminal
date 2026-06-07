# TextGenerativeGenerator

**Experimental text-based generative art for Sinter**

## Overview

The `TextGenerativeGenerator` produces freeform text compositions: concrete poetry, word art, experimental typography, and semantic visual compositions. Unlike `ASCIIArtGenerator` which uses character density for visual patterns within a fixed grid, TextGenerative focuses on creative word arrangements without constraints.

## Key Differences from ASCII Art

| Aspect | ASCIIArtGenerator | TextGenerativeGenerator |
|--------|-------------------|------------------------|
| **Output** | Fixed grid (40x20) | Freeform, any dimensions |
| **Characters** | Restricted set (` .-~+=*#%@`) | Any text (Unicode, emoji, symbols) |
| **Intent** | Visual density patterns | Semantic/playful creativity |
| **Models** | Works with all tiers | **Optimized for tiny models (1.2B+)** |
| **Use Case** | "Draw a cat in ASCII" | "Write dripping water poetry" |

## When to Use

### Use TextGenerative when:
- Prompt involves **poetry**, **words**, or **letters as shapes**
- Request mentions **concrete poetry**, **typography**, or **word art**
- You want **fast generation** (text is low token count)
- Output should be **readable text**, not just visual density

### Use ASCII Art when:
- Prompt specifically says "ASCII art"
- You want **character density** to create images
- Fixed grid output is preferred
- Purely visual (not semantic) result needed

## API

```typescript
import { TextGenerativeGenerator } from 'liminal/generators';

const gen = new TextGenerativeGenerator();

// Simple usage
const poem = await gen.generate("dripping water words");

// With options
const art = await gen.generate("neon anxiety in typography", {
  form: 'cascade',
  style: 'chaotic',
  maxLines: 20,
  maxWidth: 40,
  unicode: true,
});
```

## Options

### Forms

| Form | Description | Example Output |
|------|-------------|----------------|
| `concrete` | Visual poetry using word arrangement | Words form shapes |
| `cascade` | Words flow/drip down | Vertical flow |
| `radial` | Words radiate from center | Circular pattern |
| `interwoven` | Overlapping text layers | Dense, overlapping |
| `typographic` | Letter-as-shape compositions | Individual letters |
| `ascii-poem` | ASCII art meets poetry | Hybrid approach |
| `freeform` | No constraints (default) | Pure experimentation |

### Styles

| Style | Effect | Best For |
|-------|--------|----------|
| `minimal` | Sparse, whitespace | Meditation, calm |
| `dense` | Packed, overlapping | Chaos, energy |
| `chaotic` | Random, energetic | Punk, rebellion |
| `meditative` | Slow, rhythmic | Reflection |
| `punk` | Raw, aggressive | Protest, anger |
| `ethereal` | Light, floating | Dreams, transcendence |

## Model Tier Adaptation

The generator automatically adapts constraints based on model capability:

### Tiny Models (1.2B)
```typescript
{
  form: 'concrete',      // Simplest to understand
  style: 'minimal',      // Less complexity
  maxLines: 20,          // Shorter output
  maxWidth: 40,          // Narrower
  unicode: false,        // ASCII only
}
```

### Local Models (7-9B)
```typescript
{
  form: 'freeform',      // Full flexibility
  style: 'minimal',
  maxLines: 30,
  maxWidth: 60,
  unicode: true,         // Full Unicode support
}
```

### Flagship Models (40B+)
```typescript
{
  form: 'freeform',
  style: 'ethereal',     // More creative direction
  maxLines: 40,
  maxWidth: 80,
  unicode: true,
}
```

## Prompt Routing

The generator uses `textgenConfidence()` to determine if it should handle a prompt:

**High Confidence (0.90-0.95)**
- "concrete poetry about rain"
- "word art for NEON"
- "typographic art"
- "experimental poetry"

**Medium Confidence (0.75-0.85)**
- "words arranged like a waterfall"
- "letters forming a heart shape"
- "typography experiment"

**Low/No Confidence (0.0)**
- "ASCII art" (routed to ASCIIArtGenerator)
- "draw a cat" (routed to P5Generator)
- "3D sphere" (routed to ThreeGenerator)

## Examples

### Example 1: Concrete Poetry
```typescript
const gen = new TextGenerativeGenerator();
const result = await gen.generate("concrete poetry: falling leaves");

// Output:
//   l
//    e
//     a
//      v
//       e
//        s
//   f   a   l   l   i   n   g
```

### Example 2: Word Art
```typescript
const result = await gen.generate("word art: ELECTRIC", {
  form: 'typographic',
  style: 'chaotic'
});

// Output:
//   ╔═══════════╗
//   ║  E L E C  ║
//   ║   T R I   ║
//   ║    C      ║
//   ╚═══════════╝
```

### Example 3: Cascade
```typescript
const result = await gen.generate("melting time", {
  form: 'cascade',
  style: 'meditative'
});

// Output:
//   t i m e
//    i m e
//     m e
//      e
//       .
//        .
//         .
```

## Performance

| Model | Typical Latency | Tokens/Output |
|-------|-----------------|---------------|
| lfm2.5-1.2b | 2-4s | ~200-500 |
| qwen3.5-9b | 3-6s | ~300-800 |
| qwen3-coder-40b | 8-15s | ~500-1200 |

**Why fast?** Text output has no code syntax, no validation complexity, and low token count compared to p5.js or GLSL.

## Architecture

```
┌─────────────────────────────────────┐
│  TextGenerativeGenerator            │
│  extends TierBasedGenerator         │
├─────────────────────────────────────┤
│  - tier-based prompt adaptation     │
│  - freeform output (no grid)        │
│  - validates: not code, not empty   │
│  - formats: width/height limits     │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  LLM Client                         │
│  - tiny tier: minimal system prompt │
│  - local tier: standard prompt      │
│  - flagship: creative prompt        │
└─────────────────────────────────────┘
```

## File Structure

```
src/generators/textgen/
├── TextGenerativeGenerator.ts    # Main generator class
└── README.md                     # This documentation

```

## See Also

- `ASCIIArtGenerator` - For character-density visual art
- `TierBasedGenerator` - Base class with model adaptation
- `GeneratorRegistry` - Routing logic for prompt dispatch
