precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  uv = uv * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;

  float t = u_time * 0.5;

  float v1 = sin(uv.x * 10.0 + t);
  float v2 = sin(10.0 * (uv.x * sin(t / 2.0) + uv.y * cos(t / 3.0)) + t);
  float v3 = sin(sqrt(100.0 * ((uv.x - 0.5) * (uv.x - 0.5) + (uv.y - 0.5) * (uv.y - 0.5))) + t);

  float v = (v1 + v2 + v3);
  vec3 base = vec3(v, v, v);
  float n = normalize(base).x;

  vec3 col = vec3(
    0.5 + 0.5 * sin(n * 3.14159),
    0.5 + 0.5 * sin(n * 3.14159 + 2.094),
    0.5 + 0.5 * sin(n * 3.14159 + 4.188)
  );

  gl_FragColor = vec4(col, 1.0);
}
