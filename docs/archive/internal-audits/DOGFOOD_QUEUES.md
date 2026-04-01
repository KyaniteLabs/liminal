# Dogfood Test Queues - 2 Agent Split

**Goal:** Every landing page example must be generated through Liminal with no hand-coding.

---

## AGENT A QUEUE (18 tests)

**Models:** MiniMax-M2.7, MiniMax-M2.5, LM-Studio-qwen3-coder-40b, LM-Studio-qwen3.5-9b
**Domains:** All 9 (p5, glsl, three, strudel, hydra, tone, html, ascii, remotion)

### Run Order:

| # | Command | Domain | Model | Output |
|---|---------|--------|-------|--------|
| 1 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.7 LIMINAL_LLM_API_KEY=$MINIMAX_API_KEY npx tsx scripts/dogfood-all-domains.ts --domain p5 --model minimax-m27` | p5 | MiniMax-M2.7 | landing-live/p5-minimax-m27.html |
| 2 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.5 npx tsx scripts/dogfood-run.ts p5 minimax-m25 "Create a calming blue particle system with flowing movement" ./landing-live/p5-minimax-m25.html` | p5 | MiniMax-M2.5 | landing-live/p5-minimax-m25.html |
| 3 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3-coder-next-reap-40b-a3b-i1 npx tsx scripts/dogfood-run.ts p5 lm-coder "Create a calming blue particle system with flowing movement" ./landing-live/p5-lm-coder.html` | p5 | LM-Coder-40b | landing-live/p5-lm-coder.html |
| 4 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3.5-9b npx tsx scripts/dogfood-run.ts p5 lm-qwen "Create a calming blue particle system with flowing movement" ./landing-live/p5-lm-qwen.html` | p5 | LM-Qwen-9b | landing-live/p5-lm-qwen.html |
| 5 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.7 npx tsx scripts/dogfood-run.ts glsl minimax-m27 "Create an abstract plasma shader with animated colors" ./landing-live/glsl-minimax-m27.html` | glsl | MiniMax-M2.7 | landing-live/glsl-minimax-m27.html |
| 6 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.5 npx tsx scripts/dogfood-run.ts glsl minimax-m25 "Create an abstract plasma shader with animated colors" ./landing-live/glsl-minimax-m25.html` | glsl | MiniMax-M2.5 | landing-live/glsl-minimax-m25.html |
| 7 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3-coder-next-reap-40b-a3b-i1 npx tsx scripts/dogfood-run.ts glsl lm-coder "Create an abstract plasma shader with animated colors" ./landing-live/glsl-lm-coder.html` | glsl | LM-Coder-40b | landing-live/glsl-lm-coder.html |
| 8 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3.5-9b npx tsx scripts/dogfood-run.ts glsl lm-qwen "Create an abstract plasma shader with animated colors" ./landing-live/glsl-lm-qwen.html` | glsl | LM-Qwen-9b | landing-live/glsl-lm-qwen.html |
| 9 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.7 npx tsx scripts/dogfood-run.ts three minimax-m27 "Create a rotating 3D cube with interesting lighting" ./landing-live/three-minimax-m27.html` | three | MiniMax-M2.7 | landing-live/three-minimax-m27.html |
| 10 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.5 npx tsx scripts/dogfood-run.ts three minimax-m25 "Create a rotating 3D cube with interesting lighting" ./landing-live/three-minimax-m25.html` | three | MiniMax-M2.5 | landing-live/three-minimax-m25.html |
| 11 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3-coder-next-reap-40b-a3b-i1 npx tsx scripts/dogfood-run.ts three lm-coder "Create a rotating 3D cube with interesting lighting" ./landing-live/three-lm-coder.html` | three | LM-Coder-40b | landing-live/three-lm-coder.html |
| 12 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3.5-9b npx tsx scripts/dogfood-run.ts three lm-qwen "Create a rotating 3D cube with interesting lighting" ./landing-live/three-lm-qwen.html` | three | LM-Qwen-9b | landing-live/three-lm-qwen.html |
| 13 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.7 npx tsx scripts/dogfood-run.ts strudel minimax-m27 "Create a simple techno beat pattern with drums" ./landing-live/strudel-minimax-m27.html` | strudel | MiniMax-M2.7 | landing-live/strudel-minimax-m27.html |
| 14 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.5 npx tsx scripts/dogfood-run.ts strudel minimax-m25 "Create a simple techno beat pattern with drums" ./landing-live/strudel-minimax-m25.html` | strudel | MiniMax-M2.5 | landing-live/strudel-minimax-m25.html |
| 15 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3-coder-next-reap-40b-a3b-i1 npx tsx scripts/dogfood-run.ts strudel lm-coder "Create a simple techno beat pattern with drums" ./landing-live/strudel-lm-coder.html` | strudel | LM-Coder-40b | landing-live/strudel-lm-coder.html |
| 16 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3.5-9b npx tsx scripts/dogfood-run.ts strudel lm-qwen "Create a simple techno beat pattern with drums" ./landing-live/strudel-lm-qwen.html` | strudel | LM-Qwen-9b | landing-live/strudel-lm-qwen.html |
| 17 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.7 npx tsx scripts/dogfood-run.ts hydra minimax-m27 "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-minimax-m27.html` | hydra | MiniMax-M2.7 | landing-live/hydra-minimax-m27.html |
| 18 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.5 npx tsx scripts/dogfood-run.ts hydra minimax-m25 "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-minimax-m25.html` | hydra | MiniMax-M2.5 | landing-live/hydra-minimax-m25.html |
| 19 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3-coder-next-reap-40b-a3b-i1 npx tsx scripts/dogfood-run.ts hydra lm-coder "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-lm-coder.html` | hydra | LM-Coder-40b | landing-live/hydra-lm-coder.html |
| 20 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3.5-9b npx tsx scripts/dogfood-run.ts hydra lm-qwen "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-lm-qwen.html` | hydra | LM-Qwen-9b | landing-live/hydra-lm-qwen.html |
| 21 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.7 npx tsx scripts/dogfood-run.ts tone minimax-m27 "Create an ambient drone synthesizer with reverb" ./landing-live/tone-minimax-m27.html` | tone | MiniMax-M2.7 | landing-live/tone-minimax-m27.html |
| 22 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.5 npx tsx scripts/dogfood-run.ts tone minimax-m25 "Create an ambient drone synthesizer with reverb" ./landing-live/tone-minimax-m25.html` | tone | MiniMax-M2.5 | landing-live/tone-minimax-m25.html |
| 23 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3-coder-next-reap-40b-a3b-i1 npx tsx scripts/dogfood-run.ts tone lm-coder "Create an ambient drone synthesizer with reverb" ./landing-live/tone-lm-coder.html` | tone | LM-Coder-40b | landing-live/tone-lm-coder.html |
| 24 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3.5-9b npx tsx scripts/dogfood-run.ts tone lm-qwen "Create an ambient drone synthesizer with reverb" ./landing-live/tone-lm-qwen.html` | tone | LM-Qwen-9b | landing-live/tone-lm-qwen.html |
| 25 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.7 npx tsx scripts/dogfood-run.ts html minimax-m27 "Create a landing page with hero section and call to action" ./landing-live/html-minimax-m27.html` | html | MiniMax-M2.7 | landing-live/html-minimax-m27.html |
| 26 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.5 npx tsx scripts/dogfood-run.ts html minimax-m25 "Create a landing page with hero section and call to action" ./landing-live/html-minimax-m25.html` | html | MiniMax-M2.5 | landing-live/html-minimax-m25.html |
| 27 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3-coder-next-reap-40b-a3b-i1 npx tsx scripts/dogfood-run.ts html lm-coder "Create a landing page with hero section and call to action" ./landing-live/html-lm-coder.html` | html | LM-Coder-40b | landing-live/html-lm-coder.html |
| 28 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3.5-9b npx tsx scripts/dogfood-run.ts html lm-qwen "Create a landing page with hero section and call to action" ./landing-live/html-lm-qwen.html` | html | LM-Qwen-9b | landing-live/html-lm-qwen.html |
| 29 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.7 npx tsx scripts/dogfood-run.ts ascii minimax-m27 "Create ASCII art of a mountain landscape" ./landing-live/ascii-minimax-m27.html` | ascii | MiniMax-M2.7 | landing-live/ascii-minimax-m27.html |
| 30 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.5 npx tsx scripts/dogfood-run.ts ascii minimax-m25 "Create ASCII art of a mountain landscape" ./landing-live/ascii-minimax-m25.html` | ascii | MiniMax-M2.5 | landing-live/ascii-minimax-m25.html |
| 31 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3-coder-next-reap-40b-a3b-i1 npx tsx scripts/dogfood-run.ts ascii lm-coder "Create ASCII art of a mountain landscape" ./landing-live/ascii-lm-coder.html` | ascii | LM-Coder-40b | landing-live/ascii-lm-coder.html |
| 32 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3.5-9b npx tsx scripts/dogfood-run.ts ascii lm-qwen "Create ASCII art of a mountain landscape" ./landing-live/ascii-lm-qwen.html` | ascii | LM-Qwen-9b | landing-live/ascii-lm-qwen.html |
| 33 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.7 npx tsx scripts/dogfood-run.ts remotion minimax-m27 "Create a typing text animation video component" ./landing-live/remotion-minimax-m27.html` | remotion | MiniMax-M2.7 | landing-live/remotion-minimax-m27.html |
| 34 | `LIMINAL_LLM_BASE_URL=https://api.minimax.io/v1 LIMINAL_LLM_MODEL=MiniMax-M2.5 npx tsx scripts/dogfood-run.ts remotion minimax-m25 "Create a typing text animation video component" ./landing-live/remotion-minimax-m25.html` | remotion | MiniMax-M2.5 | landing-live/remotion-minimax-m25.html |
| 35 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3-coder-next-reap-40b-a3b-i1 npx tsx scripts/dogfood-run.ts remotion lm-coder "Create a typing text animation video component" ./landing-live/remotion-lm-coder.html` | remotion | LM-Coder-40b | landing-live/remotion-lm-coder.html |
| 36 | `LIMINAL_LLM_BASE_URL=http://localhost:1234/v1 LIMINAL_LLM_MODEL=qwen3.5-9b npx tsx scripts/dogfood-run.ts remotion lm-qwen "Create a typing text animation video component" ./landing-live/remotion-lm-qwen.html` | remotion | LM-Qwen-9b | landing-live/remotion-lm-qwen.html |

**Total Agent A:** 36 tests (9 domains × 4 models)

---

## AGENT B QUEUE (63 tests)

**Models:** 
- Ollama Local (6): granite4:1b, granite4:350m, qwen3.5:2b, phi4-mini, gemma3:4b, lfm2.5-thinking:1.2b
- Ollama Cloud (1): kimi-k2.5:cloud

**Note:** Excluding qwen3.5:cloud, gemini, deepseek per requirements

### Run Order:

| # | Command | Domain | Model | Output |
|---|---------|--------|-------|--------|
| 1 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:1b npx tsx scripts/dogfood-run.ts p5 granite-1b "Create a calming blue particle system with flowing movement" ./landing-live/p5-granite-1b.html` | p5 | granite4:1b | landing-live/p5-granite-1b.html |
| 2 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:350m npx tsx scripts/dogfood-run.ts p5 granite-350m "Create a calming blue particle system with flowing movement" ./landing-live/p5-granite-350m.html` | p5 | granite4:350m | landing-live/p5-granite-350m.html |
| 3 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=qwen3.5:2b npx tsx scripts/dogfood-run.ts p5 qwen35 "Create a calming blue particle system with flowing movement" ./landing-live/p5-qwen35.html` | p5 | qwen3.5:2b | landing-live/p5-qwen35.html |
| 4 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=phi4-mini:latest npx tsx scripts/dogfood-run.ts p5 phi4 "Create a calming blue particle system with flowing movement" ./landing-live/p5-phi4.html` | p5 | phi4-mini | landing-live/p5-phi4.html |
| 5 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemma3:4b npx tsx scripts/dogfood-run.ts p5 gemma "Create a calming blue particle system with flowing movement" ./landing-live/p5-gemma.html` | p5 | gemma3:4b | landing-live/p5-gemma.html |
| 6 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=lfm2.5-thinking:1.2b npx tsx scripts/dogfood-run.ts p5 lfm "Create a calming blue particle system with flowing movement" ./landing-live/p5-lfm.html` | p5 | lfm2.5 | landing-live/p5-lfm.html |
| 7 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=kimi-k2.5:cloud npx tsx scripts/dogfood-run.ts p5 kimi "Create a calming blue particle system with flowing movement" ./landing-live/p5-kimi.html` | p5 | kimi-k2.5 | landing-live/p5-kimi.html |
| 8 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemini-3-flash-preview:latest npx tsx scripts/dogfood-run.ts p5 gemini "Create a calming blue particle system with flowing movement" ./landing-live/p5-gemini.html` | p5 | gemini-flash | landing-live/p5-gemini.html |
| 9 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=deepseek-v3.2:cloud npx tsx scripts/dogfood-run.ts p5 deepseek "Create a calming blue particle system with flowing movement" ./landing-live/p5-deepseek.html` | p5 | deepseek-v3.2 | landing-live/p5-deepseek.html |
| 10 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:1b npx tsx scripts/dogfood-run.ts glsl granite-1b "Create an abstract plasma shader with animated colors" ./landing-live/glsl-granite-1b.html` | glsl | granite4:1b | landing-live/glsl-granite-1b.html |
| 11 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:350m npx tsx scripts/dogfood-run.ts glsl granite-350m "Create an abstract plasma shader with animated colors" ./landing-live/glsl-granite-350m.html` | glsl | granite4:350m | landing-live/glsl-granite-350m.html |
| 12 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=qwen3.5:2b npx tsx scripts/dogfood-run.ts glsl qwen35 "Create an abstract plasma shader with animated colors" ./landing-live/glsl-qwen35.html` | glsl | qwen3.5:2b | landing-live/glsl-qwen35.html |
| 13 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=phi4-mini:latest npx tsx scripts/dogfood-run.ts glsl phi4 "Create an abstract plasma shader with animated colors" ./landing-live/glsl-phi4.html` | glsl | phi4-mini | landing-live/glsl-phi4.html |
| 14 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemma3:4b npx tsx scripts/dogfood-run.ts glsl gemma "Create an abstract plasma shader with animated colors" ./landing-live/glsl-gemma.html` | glsl | gemma3:4b | landing-live/glsl-gemma.html |
| 15 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=lfm2.5-thinking:1.2b npx tsx scripts/dogfood-run.ts glsl lfm "Create an abstract plasma shader with animated colors" ./landing-live/glsl-lfm.html` | glsl | lfm2.5 | landing-live/glsl-lfm.html |
| 16 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=kimi-k2.5:cloud npx tsx scripts/dogfood-run.ts glsl kimi "Create an abstract plasma shader with animated colors" ./landing-live/glsl-kimi.html` | glsl | kimi-k2.5 | landing-live/glsl-kimi.html |
| 17 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemini-3-flash-preview:latest npx tsx scripts/dogfood-run.ts glsl gemini "Create an abstract plasma shader with animated colors" ./landing-live/glsl-gemini.html` | glsl | gemini-flash | landing-live/glsl-gemini.html |
| 18 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=deepseek-v3.2:cloud npx tsx scripts/dogfood-run.ts glsl deepseek "Create an abstract plasma shader with animated colors" ./landing-live/glsl-deepseek.html` | glsl | deepseek-v3.2 | landing-live/glsl-deepseek.html |
| 19 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:1b npx tsx scripts/dogfood-run.ts three granite-1b "Create a rotating 3D cube with interesting lighting" ./landing-live/three-granite-1b.html` | three | granite4:1b | landing-live/three-granite-1b.html |
| 20 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:350m npx tsx scripts/dogfood-run.ts three granite-350m "Create a rotating 3D cube with interesting lighting" ./landing-live/three-granite-350m.html` | three | granite4:350m | landing-live/three-granite-350m.html |
| 21 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=qwen3.5:2b npx tsx scripts/dogfood-run.ts three qwen35 "Create a rotating 3D cube with interesting lighting" ./landing-live/three-qwen35.html` | three | qwen3.5:2b | landing-live/three-qwen35.html |
| 22 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=phi4-mini:latest npx tsx scripts/dogfood-run.ts three phi4 "Create a rotating 3D cube with interesting lighting" ./landing-live/three-phi4.html` | three | phi4-mini | landing-live/three-phi4.html |
| 23 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemma3:4b npx tsx scripts/dogfood-run.ts three gemma "Create a rotating 3D cube with interesting lighting" ./landing-live/three-gemma.html` | three | gemma3:4b | landing-live/three-gemma.html |
| 24 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=lfm2.5-thinking:1.2b npx tsx scripts/dogfood-run.ts three lfm "Create a rotating 3D cube with interesting lighting" ./landing-live/three-lfm.html` | three | lfm2.5 | landing-live/three-lfm.html |
| 25 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=kimi-k2.5:cloud npx tsx scripts/dogfood-run.ts three kimi "Create a rotating 3D cube with interesting lighting" ./landing-live/three-kimi.html` | three | kimi-k2.5 | landing-live/three-kimi.html |
| 26 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemini-3-flash-preview:latest npx tsx scripts/dogfood-run.ts three gemini "Create a rotating 3D cube with interesting lighting" ./landing-live/three-gemini.html` | three | gemini-flash | landing-live/three-gemini.html |
| 27 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=deepseek-v3.2:cloud npx tsx scripts/dogfood-run.ts three deepseek "Create a rotating 3D cube with interesting lighting" ./landing-live/three-deepseek.html` | three | deepseek-v3.2 | landing-live/three-deepseek.html |
| 28 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:1b npx tsx scripts/dogfood-run.ts strudel granite-1b "Create a simple techno beat pattern with drums" ./landing-live/strudel-granite-1b.html` | strudel | granite4:1b | landing-live/strudel-granite-1b.html |
| 29 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:350m npx tsx scripts/dogfood-run.ts strudel granite-350m "Create a simple techno beat pattern with drums" ./landing-live/strudel-granite-350m.html` | strudel | granite4:350m | landing-live/strudel-granite-350m.html |
| 30 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=qwen3.5:2b npx tsx scripts/dogfood-run.ts strudel qwen35 "Create a simple techno beat pattern with drums" ./landing-live/strudel-qwen35.html` | strudel | qwen3.5:2b | landing-live/strudel-qwen35.html |
| 31 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=phi4-mini:latest npx tsx scripts/dogfood-run.ts strudel phi4 "Create a simple techno beat pattern with drums" ./landing-live/strudel-phi4.html` | strudel | phi4-mini | landing-live/strudel-phi4.html |
| 32 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemma3:4b npx tsx scripts/dogfood-run.ts strudel gemma "Create a simple techno beat pattern with drums" ./landing-live/strudel-gemma.html` | strudel | gemma3:4b | landing-live/strudel-gemma.html |
| 33 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=lfm2.5-thinking:1.2b npx tsx scripts/dogfood-run.ts strudel lfm "Create a simple techno beat pattern with drums" ./landing-live/strudel-lfm.html` | strudel | lfm2.5 | landing-live/strudel-lfm.html |
| 34 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=kimi-k2.5:cloud npx tsx scripts/dogfood-run.ts strudel kimi "Create a simple techno beat pattern with drums" ./landing-live/strudel-kimi.html` | strudel | kimi-k2.5 | landing-live/strudel-kimi.html |

| 37 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:1b npx tsx scripts/dogfood-run.ts hydra granite-1b "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-granite-1b.html` | hydra | granite4:1b | landing-live/hydra-granite-1b.html |
| 38 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:350m npx tsx scripts/dogfood-run.ts hydra granite-350m "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-granite-350m.html` | hydra | granite4:350m | landing-live/hydra-granite-350m.html |
| 39 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=qwen3.5:2b npx tsx scripts/dogfood-run.ts hydra qwen35 "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-qwen35.html` | hydra | qwen3.5:2b | landing-live/hydra-qwen35.html |
| 40 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=phi4-mini:latest npx tsx scripts/dogfood-run.ts hydra phi4 "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-phi4.html` | hydra | phi4-mini | landing-live/hydra-phi4.html |
| 41 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemma3:4b npx tsx scripts/dogfood-run.ts hydra gemma "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-gemma.html` | hydra | gemma3:4b | landing-live/hydra-gemma.html |
| 42 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=lfm2.5-thinking:1.2b npx tsx scripts/dogfood-run.ts hydra lfm "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-lfm.html` | hydra | lfm2.5 | landing-live/hydra-lfm.html |
| 43 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=kimi-k2.5:cloud npx tsx scripts/dogfood-run.ts hydra kimi "Create a geometric video synth pattern with kaleidoscope effect" ./landing-live/hydra-kimi.html` | hydra | kimi-k2.5 | landing-live/hydra-kimi.html |

| 46 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:1b npx tsx scripts/dogfood-run.ts tone granite-1b "Create an ambient drone synthesizer with reverb" ./landing-live/tone-granite-1b.html` | tone | granite4:1b | landing-live/tone-granite-1b.html |
| 47 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:350m npx tsx scripts/dogfood-run.ts tone granite-350m "Create an ambient drone synthesizer with reverb" ./landing-live/tone-granite-350m.html` | tone | granite4:350m | landing-live/tone-granite-350m.html |
| 48 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=qwen3.5:2b npx tsx scripts/dogfood-run.ts tone qwen35 "Create an ambient drone synthesizer with reverb" ./landing-live/tone-qwen35.html` | tone | qwen3.5:2b | landing-live/tone-qwen35.html |
| 49 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=phi4-mini:latest npx tsx scripts/dogfood-run.ts tone phi4 "Create an ambient drone synthesizer with reverb" ./landing-live/tone-phi4.html` | tone | phi4-mini | landing-live/tone-phi4.html |
| 50 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemma3:4b npx tsx scripts/dogfood-run.ts tone gemma "Create an ambient drone synthesizer with reverb" ./landing-live/tone-gemma.html` | tone | gemma3:4b | landing-live/tone-gemma.html |
| 51 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=lfm2.5-thinking:1.2b npx tsx scripts/dogfood-run.ts tone lfm "Create an ambient drone synthesizer with reverb" ./landing-live/tone-lfm.html` | tone | lfm2.5 | landing-live/tone-lfm.html |
| 52 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=kimi-k2.5:cloud npx tsx scripts/dogfood-run.ts tone kimi "Create an ambient drone synthesizer with reverb" ./landing-live/tone-kimi.html` | tone | kimi-k2.5 | landing-live/tone-kimi.html |

| 55 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:1b npx tsx scripts/dogfood-run.ts html granite-1b "Create a landing page with hero section and call to action" ./landing-live/html-granite-1b.html` | html | granite4:1b | landing-live/html-granite-1b.html |
| 56 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:350m npx tsx scripts/dogfood-run.ts html granite-350m "Create a landing page with hero section and call to action" ./landing-live/html-granite-350m.html` | html | granite4:350m | landing-live/html-granite-350m.html |
| 57 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=qwen3.5:2b npx tsx scripts/dogfood-run.ts html qwen35 "Create a landing page with hero section and call to action" ./landing-live/html-qwen35.html` | html | qwen3.5:2b | landing-live/html-qwen35.html |
| 58 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=phi4-mini:latest npx tsx scripts/dogfood-run.ts html phi4 "Create a landing page with hero section and call to action" ./landing-live/html-phi4.html` | html | phi4-mini | landing-live/html-phi4.html |
| 59 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemma3:4b npx tsx scripts/dogfood-run.ts html gemma "Create a landing page with hero section and call to action" ./landing-live/html-gemma.html` | html | gemma3:4b | landing-live/html-gemma.html |
| 60 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=lfm2.5-thinking:1.2b npx tsx scripts/dogfood-run.ts html lfm "Create a landing page with hero section and call to action" ./landing-live/html-lfm.html` | html | lfm2.5 | landing-live/html-lfm.html |
| 61 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=kimi-k2.5:cloud npx tsx scripts/dogfood-run.ts html kimi "Create a landing page with hero section and call to action" ./landing-live/html-kimi.html` | html | kimi-k2.5 | landing-live/html-kimi.html |

| 64 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:1b npx tsx scripts/dogfood-run.ts ascii granite-1b "Create ASCII art of a mountain landscape" ./landing-live/ascii-granite-1b.html` | ascii | granite4:1b | landing-live/ascii-granite-1b.html |
| 65 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:350m npx tsx scripts/dogfood-run.ts ascii granite-350m "Create ASCII art of a mountain landscape" ./landing-live/ascii-granite-350m.html` | ascii | granite4:350m | landing-live/ascii-granite-350m.html |
| 66 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=qwen3.5:2b npx tsx scripts/dogfood-run.ts ascii qwen35 "Create ASCII art of a mountain landscape" ./landing-live/ascii-qwen35.html` | ascii | qwen3.5:2b | landing-live/ascii-qwen35.html |
| 67 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=phi4-mini:latest npx tsx scripts/dogfood-run.ts ascii phi4 "Create ASCII art of a mountain landscape" ./landing-live/ascii-phi4.html` | ascii | phi4-mini | landing-live/ascii-phi4.html |
| 68 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemma3:4b npx tsx scripts/dogfood-run.ts ascii gemma "Create ASCII art of a mountain landscape" ./landing-live/ascii-gemma.html` | ascii | gemma3:4b | landing-live/ascii-gemma.html |
| 69 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=lfm2.5-thinking:1.2b npx tsx scripts/dogfood-run.ts ascii lfm "Create ASCII art of a mountain landscape" ./landing-live/ascii-lfm.html` | ascii | lfm2.5 | landing-live/ascii-lfm.html |
| 70 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=kimi-k2.5:cloud npx tsx scripts/dogfood-run.ts ascii kimi "Create ASCII art of a mountain landscape" ./landing-live/ascii-kimi.html` | ascii | kimi-k2.5 | landing-live/ascii-kimi.html |

| 73 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:1b npx tsx scripts/dogfood-run.ts remotion granite-1b "Create a typing text animation video component" ./landing-live/remotion-granite-1b.html` | remotion | granite4:1b | landing-live/remotion-granite-1b.html |
| 74 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=granite4:350m npx tsx scripts/dogfood-run.ts remotion granite-350m "Create a typing text animation video component" ./landing-live/remotion-granite-350m.html` | remotion | granite4:350m | landing-live/remotion-granite-350m.html |
| 75 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=qwen3.5:2b npx tsx scripts/dogfood-run.ts remotion qwen35 "Create a typing text animation video component" ./landing-live/remotion-qwen35.html` | remotion | qwen3.5:2b | landing-live/remotion-qwen35.html |
| 76 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=phi4-mini:latest npx tsx scripts/dogfood-run.ts remotion phi4 "Create a typing text animation video component" ./landing-live/remotion-phi4.html` | remotion | phi4-mini | landing-live/remotion-phi4.html |
| 77 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=gemma3:4b npx tsx scripts/dogfood-run.ts remotion gemma "Create a typing text animation video component" ./landing-live/remotion-gemma.html` | remotion | gemma3:4b | landing-live/remotion-gemma.html |
| 78 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=lfm2.5-thinking:1.2b npx tsx scripts/dogfood-run.ts remotion lfm "Create a typing text animation video component" ./landing-live/remotion-lfm.html` | remotion | lfm2.5 | landing-live/remotion-lfm.html |
| 79 | `LIMINAL_LLM_BASE_URL=http://localhost:11434/v1 LIMINAL_LLM_MODEL=kimi-k2.5:cloud npx tsx scripts/dogfood-run.ts remotion kimi "Create a typing text animation video component" ./landing-live/remotion-kimi.html` | remotion | kimi-k2.5 | landing-live/remotion-kimi.html |


**Total Agent B:** 81 tests (9 domains × 9 models)

---

## Summary

| Agent | Models | Tests |
|-------|--------|-------|
| **Agent A** | MiniMax-M2.7, MiniMax-M2.5, LM-Coder-40b, LM-Qwen-9b | 36 tests |
| **Agent B** | granite4:1b, granite4:350m, qwen3.5:2b, phi4-mini, gemma3:4b, lfm2.5, kimi-k2.5, gemini-flash, deepseek-v3.2 | 81 tests |

**Grand Total:** 117 tests across all providers

---

## Telemetry Format

After each test, log:
```
[TIME] Domain: X | Model: Y | Status: ✅/❌ | Duration: Zms | Score: S | Size: B bytes
```

Example:
```
[10:23:45] Domain: p5 | Model: minimax-m27 | Status: ✅ | Duration: 4500ms | Score: 0.85 | Size: 3241 bytes
[10:24:12] Domain: glsl | Model: kimi | Status: ❌ | Duration: 120000ms | Score: 0.00 | Size: 0 bytes | Error: Timeout
```
