# Sing LFM2.5 Phrase Benchmark

Last verified: 2026-05-25

This benchmark gates any real lyric sidecar before it can enter the Sing
instrument. The hard realtime render/audio loop stays primary; model work is a
sidecar that must prove it does not cause render drops, audio glitches, or slow
phrase delivery.

## Command

```bash
pnpm sing:bench:phrases -- --model LFM2.5-350M --backend mock --samples 50
```

The default `mock` backend is CI-safe and performs no model call. For a local
LM Studio, Ollama, or llama.cpp server that exposes an OpenAI-compatible chat
endpoint:

```bash
pnpm sing:bench:phrases -- \
  --model LFM2.5-350M-GGUF \
  --backend openai-compatible \
  --endpoint http://127.0.0.1:1234/v1 \
  --samples 50
```

Use `--all-candidates` to generate a suite report across the known candidate
labels. Reports are written to `.omx/proof/sing-phrase-benchmark.json` unless
`--out` is supplied.

The OpenAI-compatible backend is intentionally non-streaming for the first
gated pass, so `time_to_first_token_ms` and `time_to_first_phrase_ms` are the
same until a streaming provider adapter lands.

## Candidate Set

The candidate set is intentionally explicit and current-source verified before
integration work:

| Candidate | Runtime target | Source |
| --- | --- | --- |
| `LFM2.5-350M` | smallest text baseline | <https://docs.liquid.ai/lfm/models/lfm25-350m> |
| `LFM2.5-350M-GGUF` | llama.cpp/local GGUF | <https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF> |
| `LFM2.5-1.2B-Instruct` | stronger instruction following | <https://docs.liquid.ai/lfm/models/lfm25-1.2b-instruct> |
| `LFM2.5-1.2B-Instruct-GGUF` | llama.cpp/local GGUF | <https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF> |
| `LFM2.5-1.2B-Instruct-MLX` | Apple Silicon MLX family | <https://huggingface.co/collections/LiquidAI/lfm25> |

## Acceptance Gates

The benchmark report records:

- `time_to_first_token_ms`
- `time_to_first_phrase_ms`
- `tokens_per_second`
- `memory_mb` and `peak_memory_mb`
- `cpu_percent`
- `gpu_percent`
- `dropped_render_frames`
- `audio_glitches`
- `performer_score`

A model is recommended only when:

- first phrase latency is at or below 1500 ms
- dropped render frames are zero
- audio glitches are zero
- performer score is at least 3/5

Published model claims are useful for selecting candidates, but not for
accepting a sidecar. The target machine benchmark is the authority.
