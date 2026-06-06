# Sing Voice→Visual Vocabulary

How singing drives visuals in Sing. The engine extracts a rich feature vector
from the voice, the `SemanticMapper` translates it into normalized perceptual
channels, and presets bind those channels to GLSL uniforms.

Pipeline: `mic → ring buffer → FFT/YIN/enriched features → VibratoTracker → SemanticMapper → binder → shader uniforms`.

## Semantic channels (the binding surface)

Each channel is 0–1 (hue is a normalized turn). Presets bind a channel to a
uniform; if they don't, the **default mapping** binds it to the conventional
uniform name below, so any preset responds richly for free.

| Channel | Default uniform | Driven by (voice) |
|---|---|---|
| `palette.hue` | `u_hue` | pitch-class (each note → a hue) |
| `palette.saturation` | `u_saturation` | voiced-ness |
| `palette.value` | `u_value` | brightness (spectral centroid) |
| `palette.accentHue` | `u_accentHue` | complementary of hue |
| `form.family` | `u_form` | vowel category (ah/ee/oh/oo) |
| `form.complexity` | `u_complexity` | formant openness |
| `form.symmetry` | `u_symmetry` | pitch confidence |
| `form.sharpness` | `u_sharpness` | 1 − vowel roundness |
| `motion.flow` | `u_flow` | loudness/dynamics |
| `motion.turbulence` | `u_turbulence` | breathiness |
| `motion.shimmer` | `u_shimmer` | vibrato (rate × depth) |
| `texture.grain` | `u_grain` | breathiness |
| `texture.glow` | `u_glow` | brightness |
| `texture.softness` | `u_softness` | vowel roundness |
| `density.coverage` | `u_coverage` | loudness (RMS) |
| `density.spawn` | `u_spawn` | onset (consonant/attack) |
| `composition.scale` | `u_scale` | octave |
| `composition.focalY` | `u_focalY` | octave (height) |
| `composition.depth` | `u_depth` | loudness |

The renderer also always provides `u_resolution` and `u_time`, plus the legacy
raw scalars (`u_rms`, `u_pitch`, `u_centroid`, `u_flux`, `u_onset`, `u_voiced`,
`u_confidence`, movement uniforms).

## Authoring a preset

Bind uniforms via `mappings` (see `packages/audio-core/src/PresetSchema.ts`):

```ts
// semantic (recommended): bind a channel to a uniform
{ source: 'semantic', channel: 'palette.hue', target: 'u_hue', curve: 'linear' }
// raw (escape hatch): map a raw feature with an explicit range
{ source: 'raw', feature: 'rms', target: 'u_energy', curve: 'linear', min: 0, max: 1 }
```

A shader only needs to declare `uniform float u_<name>;` for the channels it
uses; the binder feeds them. Semantic uniforms are adaptively smoothed
(one-euro) per uniform in the binder. See `packages/sing/src/presets/moonlitGarden.ts`
for a complete example.

## Running it

`pnpm sing:dev` loads the **Moonlit Garden** showpiece by default (no `?preset=`),
or pass `?preset=<url>` to load a generated preset. Requires a Chromium-class
browser with mic permission and COOP/COEP headers for `SharedArrayBuffer`.
