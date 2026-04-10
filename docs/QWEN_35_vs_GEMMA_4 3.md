# Qwen 3.5 vs Gemma 4: The Real Comparison

**Important Discovery**: The `qwen3.5-0.8b` we tested is NOT the full Qwen 3.5. It's a tiny distilled variant.

## The Qwen 3.5 Family (What We Missed)

| Model | Params | Context | Modalities | Notes |
|-------|--------|---------|------------|-------|
| **Qwen3.5-397B-A17B** | 397B / 17B active | 1M tokens | Text + Image + Video | **Flagship** - MoE architecture |
| **Qwen3.5-Plus** | 397B / 17B active | 1M tokens | Text + Image + Video | Hosted version |
| **Qwen3.5-32B** | 32B | 128K | Text + Image + Video | Mid-size |
| **Qwen3.5-0.8B** | 0.8B | 32K | **Text only** | **What we tested** |

**Key Point**: The 0.8B model is a distilled text-only variant. The **real** Qwen 3.5 multimodal models are 32B+.

## True Comparison: Gemma 4 vs Qwen 3.5

| Feature | Gemma 4 26B A4B | Qwen 3.5 397B |
|---------|-----------------|---------------|
| **Total Parameters** | 26B | 397B |
| **Active Parameters** | 3.8B | 17B |
| **Context Window** | 256K | **1M tokens** |
| **Modalities** | Text + Image + Video | Text + Image + Video |
| **Audio Input** | ✅ E2B/E4B only | ⚠️ Unclear |
| **Audio Output** | ❌ | ❌ |
| **Video Length** | 60s @ 1fps | **2 hours** |
| **Languages** | 140+ | **201** |
| **Function Calling** | ✅ Native | ✅ Native |
| **Agentic** | ✅ | ✅ Visual agentic |
| **License** | Apache 2.0 | Apache 2.0 |
| **Size Classes** | 4 (E2B, E4B, 26B, 31B) | Many (0.8B to 397B) |

## Where Each Wins

### Gemma 4 Wins
- **Audio input on edge** (E2B/E4B have native audio encoders)
- **Smaller deployment footprint** (E2B runs on Raspberry Pi)
- **Efficient MoE** (26B with 3.8B active vs 397B/17B)
- **Google ecosystem** (LiteRT-LM, Android AI Core)
- **More size options** for different hardware

### Qwen 3.5 Wins
- **Larger context** (1M vs 256K)
- **Longer video** (2 hours vs 60s)
- **More languages** (201 vs 140)
- **Visual agentic** (can operate UI, click buttons)
- **Largest model** (397B vs 31B)

## For Liminal's Use Case

### Current Setup
| Role | Model | Why |
|------|-------|-----|
| Fast generation | LFM 2.5 1.2B | Proven, fast |
| Evaluation | Qwen 0.8B | Small, reliable |
| Harness agent | **Gemma 4 26B** | Native tools, 256K context |

### Potential Upgrade Path

**Option A: Stay Gemma 4**
- Use E4B for audio input capabilities
- Use 26B/31B for harness agent
- Good ecosystem support (Google/NVIDIA)

**Option B: Add Qwen 3.5 32B+**
- Better for very long context (1M tokens)
- Better video understanding (2 hours)
- Visual agentic for UI automation
- But: No audio input like E2B/E4B

**Option C: Hybrid**
- **Gemma 4 E4B**: Audio + vision + edge deployment
- **Qwen 3.5 32B**: Long context, video analysis
- **Gemma 4 26B**: Harness agent with tools

## Critical Difference: Audio

**Gemma 4 E2B/E4B**: Native audio encoder (~300M params)
- Can take audio input directly
- ASR, speech translation
- 30 second clips

**Qwen 3.5**: Unclear on native audio
- Some mentions of audio understanding
- Not as clearly documented as Gemma 4

**For music coding**: Gemma 4 E4B has clearer audio input story.

## The Real Qwen 3.5 We Should Test

Instead of 0.8B, we should test:
- **Qwen3.5-32B**: Comparable to Gemma 4 26B/31B
- **Qwen3.5-VL**: Vision-language variant
- **Qwen3.5-Plus**: 1M context, API access

## Summary

| For This Use Case | Winner |
|-------------------|--------|
| Audio input → code | **Gemma 4 E4B** |
| Long video → code | **Qwen 3.5 397B** |
| Tool-calling agent | Tie (both native) |
| Edge deployment | **Gemma 4 E2B** |
| Long context (1M) | **Qwen 3.5** |
| UI automation | **Qwen 3.5** (visual agentic) |
| Code quality | **Gemma 4 31B** (livecodebench 80%) |

**Bottom Line**: 
- **Qwen 0.8B** we tested is a tiny text-only model
- **Real Qwen 3.5** (32B+) is competitive with Gemma 4
- **Gemma 4** has clearer audio story for music
- **Qwen 3.5** has longer context and video

Want me to test actual Qwen 3.5 32B if available in LM Studio?
