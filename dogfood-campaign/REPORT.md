# Dogfood Campaign Report — April 3, 2026

## Models Tested

| Model | Provider | Type | Size | Reasoning |
|-------|----------|------|------|-----------|
| gemma4 | Ollama (local) | Local | 9.6 GB | ✅ `message.thinking` |
| qwen3.5:cloud | Ollama (cloud) | Cloud | — | ✅ `message.thinking` |
| qwen3.5:2b | Ollama (local) | Local | 2.7 GB | ✅ `message.thinking` |
| deepseek-v3.2:cloud | Ollama (cloud) | Cloud | — | ✅ `message.thinking` |
| gemma-4-26b-a4b-it | LM Studio | Local | 26B A4B | ❌ Not exposed |
| qwen3.5-2b | LM Studio | Local | 2B | ❌ Not exposed |
| lfm2.5-1.2b-instruct | LM Studio | Local | 1.2B | N/A |
| minimax-m2.7 | MiniMax API | Cloud | — | ✅ `reasoning_content` |

## Results

### Ollama Models (with reasoning traces)

| Model | Particles | Generative | Physics | Avg Score | Avg Thinking |
|-------|-----------|------------|---------|-----------|-------------|
| gemma4 | 1.00 (67s) | 1.00 (55s) | 0.00 (126s) | **0.67** | 2,819 chars |
| qwen3.5:cloud | 1.00 (8.6s) | 1.00 (5.8s) | 1.00 (7.3s) | **1.00** | 3,094 chars |
| qwen3.5:2b | 1.00 (96s) | 0.00 (96s) | 0.00 (96s) | **0.33** | 6,675 chars |
| deepseek-v3.2:cloud | 1.00 (53s) | 0.67 (187s) | 1.00 (177s) | **0.89** | 3,664 chars |

### LM Studio Models (no reasoning exposed)

| Model | Particles | Generative | Physics | Avg Score |
|-------|-----------|------------|---------|-----------|
| lfm2.5-1.2b | 1.00 (4.3s) | 1.00 (6.3s) | 1.00 (7.5s) | **1.00** |
| gemma-4-26b-a4b | 0.00 (70s) | 0.00 (70s) | 0.00 (70s) | **0.00** |
| qwen3.5-2b | 1.00 (10s) | 1.00 (5.4s) | 1.00 (15s) | **1.00** |

### MiniMax Cloud

| Model | Particles | Generative | Physics | Avg Score | Avg Thinking |
|-------|-----------|------------|---------|-----------|-------------|
| minimax-m2.7 | 0.00* | 0.00* | 0.67 | **0.22** | 6,851 chars |

*Code was in `reasoning_content`, not `content`. Recovery logic in LLMClient handles this.

## Key Findings

### 1. Fastest Quality: qwen3.5:cloud
- Perfect 1.00 on all 3 domains
- 5-8 seconds per test (cloud inference)
- Clean reasoning traces (2-4K chars)

### 2. Best Local Model: lfm2.5-1.2b (surprisingly)
- Perfect 1.00 on all 3 domains via LM Studio
- 4-7 seconds per test
- Tiny model (1.2B params) but generates correct p5.js

### 3. Reasoning Gold Standard: gemma4 via Ollama
- Structured 6-step chain-of-thought
- Physics reasoning with mathematical notation
- 1,289-4,513 chars of thinking per test

### 4. LM Studio Reasoning Gap
- LM Studio strips `reasoning_content` from all models
- Gemma-4-26b produces Java/Processing syntax, not p5.js (0.00 score)
- Same model via Ollama produces valid p5.js (0.67 score)

### 5. MiniMax Code-in-Reasoning Pattern
- MiniMax M2.7 puts code in `reasoning_content` field
- `sanitizeOutputWithReasoning()` recovery logic handles this
- 6.8K chars average reasoning (richest thinking traces)

### 6. Token Budget Matters
- Models with `num_predict < 2000` may exhaust tokens on thinking
- qwen3.5:2b produced 5-7K chars thinking but sometimes no code output
- Cloud models handle this better (server-side budgeting)

## Telemetry for Three-Act Narrative

The reasoning traces across models provide rich material for the marketing narrative:

- **Act 1 (Simon)**: MiniMax's extended reasoning (7K+ chars) shows how models "plan" before coding
- **Act 2 (Agents)**: Gemma4's structured chain-of-thought demonstrates emergent reasoning in local models
- **Act 3 (Liminal)**: qwen3.5:cloud's perfect scores show the system's provider-agnostic architecture working

### Reasoning Trace Statistics

| Metric | Value |
|--------|-------|
| Total tests | 24 |
| Tests with reasoning | 15 (63%) |
| Total reasoning chars | ~70,000 |
| Average reasoning per test | ~4,700 chars |
| Models with reasoning | 5 / 8 |
