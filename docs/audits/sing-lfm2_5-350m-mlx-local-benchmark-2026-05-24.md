# Sing LFM2.5 350M MLX Local Benchmark - 2026-05-24

## Verdict

Select `LFM2.5-350M-MLX-4bit` as the first optional local lyric sidecar
candidate.

This benchmark passed the Phase 7 gate that the earlier 1.2B MLX run failed:

```text
samples_completed: 5 / 5
warmup_samples: 1
average_first_phrase_ms: 37.73
tokens_per_second: 79.59
peak_memory_mb: 77
dropped_render_frames: 0
audio_glitches: 0
recommendation: selected
```

## Command

```bash
pnpm --filter sing bench:phrases \
  --model /Users/simongonzalezdecruz/.lmstudio/models/LiquidAI/LFM2.5-350M-MLX-4bit \
  --backend openai \
  --endpoint http://127.0.0.1:18081/v1/chat/completions \
  --warmup-samples 1 \
  --samples 5 \
  --request-timeout-ms 30000 \
  --pretty \
  --out docs/audits/sing-lfm2_5-350m-mlx-local-benchmark-2026-05-24.json
```

Server used:

```bash
/Users/simongonzalezdecruz/.lmstudio/extensions/backends/vendor/_amphibian/app-mlx-generate-mac14-arm64@26/bin/python \
  -m mlx_lm server \
  --model /Users/simongonzalezdecruz/.lmstudio/models/LiquidAI/LFM2.5-350M-MLX-4bit \
  --host 127.0.0.1 \
  --port 18081 \
  --temp 0.9 \
  --top-p 0.9 \
  --max-tokens 48 \
  --log-level INFO
```

## Caveat

The model repeated the same valid fragment in this short run:

```text
Violet light hum
```

That is acceptable for the first Phase 8 optional integration because the
sidecar is off by default, constrained to phrase fragments, and dismissable.
Future benchmarking should add prompt-variety scoring before treating it as a
final creative-quality choice.

Raw JSON report:

```text
docs/audits/sing-lfm2_5-350m-mlx-local-benchmark-2026-05-24.json
```
