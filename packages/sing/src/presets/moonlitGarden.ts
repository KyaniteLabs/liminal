import { createSingPreset, type SingPresetArtifact } from '@sinter/audio-core/PresetSchema.js';

/**
 * Moonlit Garden — the showpiece preset for the voice→visual expression engine.
 *
 * A blue-green nocturnal field that blooms when you sing: hue shifts with
 * pitch-class, the bloom grows with loudness/dynamics, vibrato adds shimmer,
 * onsets fire outward bursts, vowel/timbre shape the form. It consumes the
 * semantic uniforms fed by the binder (explicit mappings below + the default
 * vocabulary for the rest).
 *
 * GLSL ES 1.00 fragment shader (WebGL1).
 */
const MOONLIT_GARDEN_SHADER = `precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;

uniform float u_hue;        // palette.hue (pitch class)
uniform float u_saturation; // palette.saturation
uniform float u_value;      // palette.value (brightness)
uniform float u_accentHue;  // palette.accentHue
uniform float u_complexity; // form.complexity (vowel openness)
uniform float u_sharpness;  // form.sharpness
uniform float u_flow;       // motion.flow (dynamics)
uniform float u_turbulence; // motion.turbulence (breathiness)
uniform float u_shimmer;    // motion.shimmer (vibrato)
uniform float u_glow;       // texture.glow
uniform float u_grain;      // texture.grain
uniform float u_coverage;   // density.coverage (loudness)
uniform float u_spawn;      // density.spawn (onset)
uniform float u_scale;      // composition.scale (octave)
uniform float u_focalY;     // composition.focalY

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  vec2 focal = vec2(0.0, (u_focalY - 0.5) * 0.8);
  vec2 p = uv - focal;
  float r = length(p);
  float ang = atan(p.y, p.x);

  float t = u_time * (0.05 + u_flow * 0.4);
  float detail = 2.0 + u_complexity * 6.0;
  float field = fbm(p * detail + vec2(t, -t) + u_turbulence * fbm(p * 8.0 + t));

  float bloom = 0.15 + u_coverage * 0.6 + u_scale * 0.25;
  float petal = smoothstep(bloom + 0.25, bloom - 0.1, r + field * 0.25);

  float shimmer = 1.0 + u_shimmer * 0.4 * sin(ang * 6.0 + u_time * 8.0);
  petal *= shimmer;

  float burst = u_spawn * exp(-8.0 * abs(r - fract(u_time) * 1.2));
  petal += burst * 0.6;

  float hue = fract(0.45 + (u_hue - 0.5) * 0.5);
  float sat = clamp(0.35 + u_saturation * 0.5, 0.0, 1.0);
  float val = clamp((0.12 + u_value * 0.8) * petal, 0.0, 1.0);
  vec3 col = hsv2rgb(vec3(hue, sat, val));

  vec3 accent = hsv2rgb(vec3(fract(u_accentHue), sat, 1.0));
  col += accent * u_glow * petal * 0.3;

  float g = (hash(gl_FragCoord.xy + u_time) - 0.5) * u_grain * 0.25;
  col += g;

  col = mix(col, smoothstep(0.0, 1.0, col), u_sharpness * 0.5);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function moonlitGardenPreset(): SingPresetArtifact {
  return createSingPreset({
    id: 'moonlit-garden',
    name: 'Moonlit Garden',
    shader: MOONLIT_GARDEN_SHADER,
    mappings: [
      { source: 'semantic', channel: 'palette.hue', target: 'u_hue', curve: 'linear' },
      { source: 'semantic', channel: 'density.coverage', target: 'u_coverage', curve: 'easeOut' },
      { source: 'semantic', channel: 'motion.shimmer', target: 'u_shimmer', curve: 'linear' },
      { source: 'semantic', channel: 'density.spawn', target: 'u_spawn', curve: 'linear' },
      { source: 'semantic', channel: 'composition.scale', target: 'u_scale', curve: 'linear' },
    ],
    metadata: { domain: 'glsl', vibe: 'moonlit blue-green garden that blooms when you sing' },
  });
}
