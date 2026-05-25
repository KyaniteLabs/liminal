# Sing Lyric Sidecar Runtime

Last updated: 2026-05-25

The Sing lyric sidecar is optional runtime assistance for live phrase
suggestions. It must never own the render loop, audio loop, recording flow, or
instrument state.

## URL Controls

By default, Sing uses the deterministic mock phrase generator:

```text
?lyricBackend=mock
```

To keep the sidecar off at load:

```text
?lyricBackend=off
```

To test a local OpenAI-compatible server after a benchmark has passed:

```text
?lyricBackend=openai-compatible&lyricModel=LFM2.5-350M&lyricEndpoint=http://127.0.0.1:1234/v1
```

The local backend is opt-in. Do not make it the default until the benchmark
report in `.omx/proof/sing-phrase-benchmark.json` accepts the model on the
target machine.

## Runtime Contract

- timeout returns no phrases and logs `request_timeout`
- backend failure returns no phrases and logs `request_failed`
- disabled mode logs `request_skipped` with reason `disabled`
- hidden mode logs `request_skipped` with reason `hidden`
- accepted model output is filtered to 1-6 word phrase fragments
- Pin and Dismiss remain local controls; bad output can be dismissed without
  affecting render or audio

The performer-facing page exposes an Off/On control so a sidecar can be killed
immediately during performance.
