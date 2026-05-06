const COMMON_HEADER = [
  'precision mediump float;',
  'uniform float u_time;',
  'uniform vec2 u_resolution;',
  '',
].join('\n');

const RAYMARCH_TEMPLATE = `${COMMON_HEADER}
float sdSphere(vec3 p, float r) { return length(p) - r; }

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
  vec3 ro = vec3(0.0, 0.0, -3.0);
  vec3 rd = normalize(vec3(uv, 1.0));
  float t = 0.0;
  for (int i = 0; i < 48; i++) {
    vec3 p = ro + rd * t;
    float d = sdSphere(p, 0.8 + 0.1 * sin(u_time));
    if (d < 0.001) break;
    t += d;
  }
  float shade = exp(-0.25 * t);
  gl_FragColor = vec4(vec3(shade), 1.0);
}`;

const FRACTAL_TEMPLATE = `${COMMON_HEADER}
void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution.xy - 0.5) * 2.5;
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (int i = 0; i < 64; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + uv;
    if (length(z) > 2.0) break;
    iter += 1.0;
  }
  gl_FragColor = vec4(vec3(iter / 64.0, 0.3, 1.0 - iter / 64.0), 1.0);
}`;

const VORONOI_TEMPLATE = `${COMMON_HEADER}
vec2 random2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy * 8.0;
  vec2 cell = floor(uv);
  vec2 local = fract(uv);
  float minDist = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = random2(cell + neighbor);
      point = 0.5 + 0.5 * sin(u_time + 6.2831 * point);
      minDist = min(minDist, length(neighbor + point - local));
    }
  }
  gl_FragColor = vec4(vec3(minDist), 1.0);
}`;

const PLASMA_TEMPLATE = `${COMMON_HEADER}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float plasma = sin(uv.x * 12.0 + u_time) + sin(uv.y * 9.0 - u_time * 0.7);
  gl_FragColor = vec4(0.5 + 0.5 * sin(vec3(0.0, 2.1, 4.2) + plasma), 1.0);
}`;

const KALEIDOSCOPE_TEMPLATE = `${COMMON_HEADER}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy - 0.5;
  float angle = atan(uv.y, uv.x);
  float radius = length(uv);
  float segments = 8.0;
  angle = mod(angle, 6.28318 / segments);
  vec3 color = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + radius * 12.0 + angle * segments + u_time);
  gl_FragColor = vec4(color, 1.0);
}`;

const SDF_2D_TEMPLATE = `${COMMON_HEADER}
float sdCircle(vec2 p, float r) { return length(p) - r; }

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy - 0.5;
  float d = sdCircle(uv, 0.2 + 0.05 * sin(u_time));
  float edge = smoothstep(0.01, 0.0, abs(d));
  gl_FragColor = vec4(vec3(edge), 1.0);
}`;

export function selectShaderTemplate(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/\b(fractal|mandelbrot|julia)\b/.test(lower)) return FRACTAL_TEMPLATE;
  if (/\bvoronoi\b/.test(lower)) return VORONOI_TEMPLATE;
  if (/\b(plasma|lava|fire)\b/.test(lower)) return PLASMA_TEMPLATE;
  if (/\b(kaleidoscope|mirror|symmetry)\b/.test(lower)) return KALEIDOSCOPE_TEMPLATE;
  if (/\b(2d\s*sdf|sdf shape|circle)\b/.test(lower)) return SDF_2D_TEMPLATE;
  return RAYMARCH_TEMPLATE;
}
