# Real Lyric Sidecar Integration - 2026-05-24

## Status

Implemented as an optional local OpenAI-compatible sidecar in `packages/sing`.

The sidecar is not required for performance. The mock teleprompter remains the
default.

## Selected Model

```text
/Users/simongonzalezdecruz/.lmstudio/models/LiquidAI/LFM2.5-350M-MLX-4bit
```

Selection evidence:

```text
docs/audits/sing-lfm2_5-350m-mlx-local-benchmark-2026-05-24.md
docs/audits/sing-lfm2_5-350m-mlx-local-benchmark-2026-05-24.json
```

## Runtime Files

```text
packages/sing/src/teleprompter/lfm.ts
packages/sing/src/main.ts
packages/sing/index.html
test/unit/sing/lfm-sidecar.test.ts
```

## How It Is Enabled

The LFM sidecar is off unless a local endpoint and model are provided:

```text
?lyricEndpoint=http://127.0.0.1:18081/v1/chat/completions
&lyricModel=/Users/simongonzalezdecruz/.lmstudio/models/LiquidAI/LFM2.5-350M-MLX-4bit
```

To start with LFM enabled:

```text
&lyricSidecar=lfm
```

The UI also exposes a `Use LFM` / `Use mock` toggle. If no local endpoint is
configured, the button is disabled and the mock sidecar remains active.

## Safety Rules

- The render/audio loop never waits for the sidecar.
- Requests are timeout-protected.
- Bad output is filtered to 1-6 word fragments.
- Verse/chorus output is discarded.
- The performer can dismiss phrases.
- The sidecar can be disabled live by switching back to mock.

## Verification

Focused verification run:

```bash
pnpm vitest run test/unit/sing/lfm-sidecar.test.ts test/unit/sing/teleprompter-benchmark.test.ts --coverage=false
pnpm --filter sing typecheck
```

Result:

```text
2 test files passed
11 tests passed
sing typecheck passed
```
