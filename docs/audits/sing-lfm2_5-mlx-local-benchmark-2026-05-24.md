# Sing LFM2.5 MLX Local Benchmark — 2026-05-24

## Verdict

Do not wire this model into the runtime lyric sidecar yet.

The local `LFM2.5-1.2B-Instruct-MLX-8bit` run produced valid short phrase
fragments, but the strict Phase 7 gate rejected the run. After one discarded
warmup sample, average first phrase latency was still above target and the
Node-side render probe observed dropped frames.

## Command

```bash
pnpm --filter sing bench:phrases \
  --model /Users/simongonzalezdecruz/.lmstudio/models/lmstudio-community/LFM2.5-1.2B-Instruct-MLX-8bit \
  --backend openai \
  --endpoint http://127.0.0.1:18080/v1/chat/completions \
  --warmup-samples 1 \
  --samples 5 \
  --request-timeout-ms 30000 \
  --pretty \
  --out docs/audits/sing-lfm2_5-mlx-local-benchmark-2026-05-24.json
```

Server used:

```bash
/Users/simongonzalezdecruz/.lmstudio/extensions/backends/vendor/_amphibian/app-mlx-generate-mac14-arm64@26/bin/python \
  -m mlx_lm server \
  --model /Users/simongonzalezdecruz/.lmstudio/models/lmstudio-community/LFM2.5-1.2B-Instruct-MLX-8bit \
  --host 127.0.0.1 \
  --port 18080 \
  --temp 0.9 \
  --top-p 0.9 \
  --max-tokens 48 \
  --log-level INFO
```

## Result

```text
samples_completed: 5 / 5
warmup_samples: 1
average_first_phrase_ms: 1616.76
sample_ms: 1380.04, 1176.19, 1604.88, 1965.48, 1957.17
tokens_per_second: 9.65
dropped_render_frames: 39
audio_glitches: 0
recommendation: rejected
reason: Average first phrase latency is above the 1500ms target.
```

All five samples returned valid 1-6 word phrase fragments. The model appears
usable as a candidate for more benchmarking, but not accepted for Phase 8
runtime integration.

## Next Benchmark

Run a sustained benchmark with a browser-side render/audio probe. The next run
should separate:

- cold first request
- warmed cached requests
- Node event-loop probe drops
- real browser render drops
- physical microphone/audio glitch evidence

Only wire the model into the live sidecar after a sustained run has zero
attributable render/audio degradation.

Raw JSON report:

```text
docs/audits/sing-lfm2_5-mlx-local-benchmark-2026-05-24.json
```
