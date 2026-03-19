/**
 * ShaderTemplates - Self-contained GLSL fragment shader templates
 *
 * Each template is a complete fragment shader string with uniforms:
 * - vec2 u_resolution
 * - float u_time
 * - vec2 u_mouse (optional)
 *
 * Selected by prompt keywords in ShaderGenerator.
 */

export type ShaderType = 'raymarch' | 'fractal' | 'plasma' | 'voronoi' | 'kaleidoscope' | 'sdf';

const templates: Record<ShaderType, string> = {
  raymarch: `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) { vec3 d = abs(p) - b; return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)); }
float opSmoothUnion(float d1, float d2, float k) { float h = clamp(0.5 + 0.5*(d2-d1)/k, 0.0, 1.0); return mix(d2, d1, h) - k*h*(1.0-h); }

float scene(vec3 p) {
  float t = u_time * 0.5;
  float d = sdSphere(p - vec3(0.0, sin(t) * 0.5, 0.0), 1.0);
  d = opSmoothUnion(d, sdBox(p - vec3(cos(t * 1.3) * 2.0, sin(t * 0.7) * 0.5, sin(t * 0.9) * 2.0), vec3(0.6)), 0.8);
  d = opSmoothUnion(d, sdSphere(p - vec3(sin(t * 0.8) * 1.5, cos(t * 1.1) * 0.8, cos(t * 0.6) * 1.5), 0.7), 0.6);
  return d;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(scene(p+e.xyy)-scene(p-e.xyy), scene(p+e.yxy)-scene(p-e.yxy), scene(p+e.yyx)-scene(p-e.yyx)));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  vec3 ro = vec3(0.0, 0.0, 4.0);
  vec3 rd = normalize(vec3(uv, -1.5));
  float t = 0.0;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = scene(p);
    if (d < 0.001 || t > 20.0) break;
    t += d;
  }
  vec3 col = vec3(0.05, 0.05, 0.1);
  if (t < 20.0) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 light = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(n, light), 0.0);
    float spec = pow(max(dot(reflect(-light, n), -rd), 0.0), 32.0);
    col = vec3(0.3, 0.5, 0.9) * diff + vec3(1.0) * spec * 0.5 + vec3(0.1, 0.1, 0.15);
    col += vec3(0.2, 0.1, 0.4) * (1.0 + sin(p * 3.0 + u_time)) * 0.3;
  }
  col = pow(col, vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}`,

  fractal: `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  vec2 c = uv * 2.5 - vec2(0.5 + sin(u_time * 0.1) * 0.3, 0.0);
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (int i = 0; i < 128; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 4.0) break;
    iter += 1.0;
  }
  float t = iter / 128.0;
  vec3 col = 0.5 + 0.5 * cos(3.0 + t * 6.2832 * 2.0 + vec3(0.0, 0.6, 1.0));
  col *= smoothstep(0.0, 0.02, t);
  gl_FragColor = vec4(col, 1.0);
}`,

  plasma: `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.5;
  float v = sin(uv.x * 10.0 + t);
  v += sin((uv.y * 10.0 + t) * 0.5);
  v += sin((uv.x * 10.0 + uv.y * 10.0 + t) * 0.3);
  v += sin(sqrt(uv.x * uv.x + uv.y * uv.y) * 10.0 + t);
  vec3 col;
  col.r = sin(v * 3.14159) * 0.5 + 0.5;
  col.g = sin(v * 3.14159 + 2.094) * 0.5 + 0.5;
  col.b = sin(v * 3.14159 + 4.188) * 0.5 + 0.5;
  gl_FragColor = vec4(col, 1.0);
}`,

  voronoi: `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

vec2 random2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  uv *= 4.0;
  vec2 i_st = floor(uv);
  vec2 f_st = fract(uv);
  float m_dist = 1.0;
  vec2 m_point;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = random2(i_st + neighbor);
      point = 0.5 + 0.5 * sin(u_time * 0.5 + 6.2831 * point);
      float dist = length(neighbor + point - f_st);
      if (dist < m_dist) { m_dist = dist; m_point = point; }
    }
  }
  vec3 col = vec3(0.0);
  col += 0.5 + 0.5 * cos(6.2831 * (m_point.x + m_point.y) + vec3(0.0, 0.6, 1.0) + u_time * 0.3);
  col *= 1.0 - 0.5 * m_dist;
  col *= smoothstep(0.0, 0.05, m_dist);
  gl_FragColor = vec4(col, 1.0);
}`,

  kaleidoscope: `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float segments = 8.0;
  a = mod(a, 3.14159 * 2.0 / segments);
  a = abs(a - 3.14159 / segments);
  vec2 p = vec2(cos(a), sin(a)) * r;
  float t = u_time * 0.3;
  float v = sin(p.x * 10.0 + t) + sin(p.y * 10.0 - t) + sin(r * 15.0 + t * 0.5);
  v *= 0.5;
  vec3 col = vec3(
    0.5 + 0.5 * sin(v * 3.0 + 0.0),
    0.5 + 0.5 * sin(v * 3.0 + 2.0),
    0.5 + 0.5 * sin(v * 3.0 + 4.0)
  );
  col *= 1.0 - r * 0.3;
  col = pow(col, vec3(0.8));
  gl_FragColor = vec4(col, 1.0);
}`,

  sdf: `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdHexagon(vec2 p, float r) { const vec3 k = vec3(-0.866025404, 0.5, 0.577350269); p = abs(p); p -= 2.0*min(dot(k.xy,p),0.0)*k.xy; p -= vec2(clamp(p.x, -k.z*r, k.z*r), r); return length(p)*sign(p.y); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  float t = u_time;
  float d = 1e9;
  d = min(d, sdCircle(uv - vec2(cos(t) * 0.5, sin(t * 1.3) * 0.5), 0.3 + sin(t * 2.0) * 0.1));
  d = min(d, sdBox(uv - vec2(sin(t * 0.7) * 0.8, cos(t * 0.9) * 0.8), vec2(0.25)));
  d = min(d, sdHexagon(uv - vec2(cos(t * 1.1) * 0.6, sin(t * 0.8) * 0.6), 0.2 + cos(t * 1.5) * 0.1));
  d = min(d, sdCircle(uv, 1.5));
  vec3 col = vec3(0.05, 0.05, 0.1);
  col = mix(col, vec3(0.3, 0.6, 1.0), smoothstep(0.01, 0.0, d));
  col += vec3(0.9, 0.5, 0.2) * (0.008 / (abs(d) + 0.001));
  col = pow(col, vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}`,
};

/**
 * Select a shader template by prompt keywords.
 */
export function selectShaderTemplate(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (/ray\s*march|raymarch|3d\s*sdf|sdf\s*scene/.test(lower)) return templates.raymarch;
  if (/fractal|mandelbrot|julia/.test(lower)) return templates.fractal;
  if (/plasma|lava|fire\s*shader/.test(lower)) return templates.plasma;
  if (/voronoi|cell|mosaic|tile/.test(lower)) return templates.voronoi;
  if (/kaleidoscope|mirror|symmetry|kaleid/.test(lower)) return templates.kaleidoscope;
  if (/sdf|signed\s*distance|2d\s*shape|shape\s*morph/.test(lower)) return templates.sdf;

  return templates.raymarch; // default
}

export { templates };
