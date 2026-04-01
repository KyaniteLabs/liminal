# Landing Page Specification

**Status:** Fixed Shell - Only Outputs Change

## Structure (DO NOT MODIFY)

```
index.html
├── Hero Section (fixed)
├── Features Grid (fixed)
├── How It Works (fixed)
├── Gallery Section (DYNAMIC - outputs change)
├── Quick Start (fixed)
└── Footer (fixed)
```

## Gallery Section Format

The gallery displays **4 live examples** at a time:
- 2 per row, 2 rows
- Each example is an iframe pointing to `landing-assets/showcase/`
- Metadata: title, model used, score, description

### Current Gallery Slots

| Slot | Domain | Model | File |
|------|--------|-------|------|
| Top-Left | p5.js | Best performer | `p5-{model}.html` |
| Top-Right | GLSL | Best performer | `glsl-{model}.html` |
| Bottom-Left | Three.js | Best performer | `three-{model}.html` |
| Bottom-Right | Alternative | Rotating | `strudel/hydra/tone-{model}.html` |

## Update Process

1. Run dogfood tests
2. Identify best output per domain (highest score, working preview)
3. Copy to `landing-assets/showcase/`
4. Update iframe src in index.html
5. Update metadata (model name, score)

## Model Name Mapping

| Tag | Display Name |
|-----|--------------|
| minimax-m27 | MiniMax M2.7 |
| minimax-m25 | MiniMax M2.5 |
| lm-coder | Qwen3 Coder 40B |
| lm-qwen | Qwen3.5 9B |
| granite-1b | Granite4 1B |
| granite-350m | Granite4 350M |
| qwen35 | Qwen3.5 2B |
| phi4 | Phi4 Mini |
| gemma | Gemma3 4B |
| lfm | LFM2.5 1.2B |
| kimi | Kimi K2.5 |
| gemini | Gemini 3 Flash |
| deepseek | DeepSeek V3.2 |
