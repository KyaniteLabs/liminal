# Creative Domain Types

Type-first creative ideation, inspired by SEED.

## Current Domains

| Type | Domain | Rigor | Best For | Output |
|------|--------|-------|----------|--------|
| **Sketch** | p5.js | Tight | Quick visuals, particles, generative art | `.js` + HTML wrapper |
| **Shader** | GLSL | Standard | GPU effects, post-processing, math beauty | `.glsl` or `.js` wrapper |
| **Scene** | Three.js | Deep | 3D worlds, spatial experiences | `.html` (self-contained) |
| **Pattern** | Strudel | Standard | Live coding, algorithmic music | `.txt` (Strudel REPL) |
| **Visuals** | Hydra | Tight | Video feedback, live performance | `.js` (Hydra syntax) |
| **Video** | Remotion | Deep | Animated content, motion graphics | `.tsx` + video render |

## Proposed Expansions

### Vector Graphics
| Type | Domain | Rigor | Best For | Output |
|------|--------|-------|----------|--------|
| **Vector** | SVG | Tight | Line art, data viz, scalable graphics | `.svg` standalone |
| **Plotter** | SVG + G-code | Standard | Pen plotter ready, physical art | `.svg` + `.gcode` |

### Raw Graphics
| Type | Domain | Rigor | Best For | Output |
|------|--------|-------|----------|--------|
| **Canvas** | HTML5 Canvas API | Tight | Direct pixel manipulation, games | `.js` + HTML |
| **Compute** | WebGL Compute | Deep | GPU compute, particle systems, simulation | `.js` (advanced) |

### Audio Domains
| Type | Domain | Rigor | Best For | Output |
|------|--------|-------|----------|--------|
| **Pattern** | Strudel | Standard | Live coding patterns, algorithmic music | `.txt` |
| **Visuals** | Hydra | Tight | Video feedback, live performance | `.js` |
| **Synth** | Tone.js | Standard | Web Audio synthesis, instruments | `.js` |
| **Synesthesia** | p5 + Tone.js | Deep | Audio-reactive visuals, VJ tools | `.js` |

### Text/Code Aesthetics
| Type | Domain | Rigor | Best For | Output |
|------|--------|-------|----------|--------|
| **Text** | ASCII/ANSI | Tight | Terminal art, code poetry, text viz | `.txt` or `.js` |
| **Type** | CSS Animation | Tight | Kinetic typography, web layouts | `.html` + CSS |
| **Code** | Self-modifying | Deep | Quines, emergent code structures | `.js` (sandboxed) |

### Specialized
| Type | Domain | Rigor | Best For | Output |
|------|--------|-------|----------|--------|
| **Data** | D3.js | Deep | Data-driven generative art, info viz | `.js` + data |
| **Immersive** | WebXR | Deep | VR/AR experiences, spatial computing | `.js` (WebXR) |
| **ShaderToy** | GLSL Single-file | Tight | Portable shader demos, quick FX | `.glsl` (Shadertoy compat) |
| **Node** | NodeCanvas | Standard | Server-side generation, batch renders | `.js` (Node.js) |

## Domain Selection Logic

```typescript
// Pseudo-code for domain matching
function matchDomain(intent: CreativeIntent): Domain[] {
  const signals = {
    '3d': ['three', 'immersive'],
    'vr': ['immersive'],
    'ar': ['immersive'],
    'music': ['pattern', 'synth', 'synesthesia'],
    'audio': ['synth', 'synesthesia'],
    'video': ['visuals', 'video'],
    'live': ['visuals', 'pattern'],
    'feedback': ['visuals'],
    'shader': ['shader', 'shadertoy'],
    'gpu': ['shader', 'compute', 'shadertoy'],
    'plotter': ['plotter'],
    'pen': ['plotter'],
    'svg': ['vector', 'plotter'],
    'text': ['text', 'type'],
    'code': ['code'],
    'data': ['data'],
    'terminal': ['text'],
    'typography': ['type'],
    'particles': ['sketch', 'compute'],
    'simulation': ['sketch', 'compute'],
    'game': ['sketch', 'canvas'],
  };
  
  // Match intent keywords to domains
  // Return ranked list with confidence scores
}
```

## Rigor Levels

| Level | Iterations | Depth | Use When |
|-------|------------|-------|----------|
| **Tight** | 3-5 | Surface | Quick sketches, performance, one-offs |
| **Standard** | 5-10 | Balanced | Most creative work, exploration |
| **Deep** | 10-20 | Thorough | Complex scenes, productions, portfolios |

## Integration with SeedIdeator

```typescript
const brief = await ideate("Something like Kid A", {
  domainHint: undefined, // Let SEED choose
  depth: 'standard'
});

// Returns multiple domain options:
// - Pattern (Strudel) - "Glitch techno beats"
// - Synesthesia (p5+Tone) - "Audio-reactive anxiety visuals"  
// - Visuals (Hydra) - "Feedback loop paranoia"

// User selects or runs all
```

## Future Considerations

1. **Multi-domain fusion**: Single prompt → multiple domains that interact
2. **Physical output**: Plotter, CNC, laser cutter integrations
3. **Networked/Shared**: Multi-user collaborative creative sessions
4. **Temporal**: Time-based evolution, long-running generative systems
5. **AI-AI**: Liminal generates prompt → Liminal evaluates → loop
