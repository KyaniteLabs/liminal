precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = u_time * 0.5;

  vec2 p = uv * 8.0;

  float v1 = sin(p.x + t);
  float v2 = sin((p.y + t) * 0.5);
  float v3 = sin((p.x + p.y + t) * 0.5);
  float v4 = sin(normalize(vec2(p.x, p.y)).x * 10.0 + t);

  float v = (v1 + v2 + v3 + v4) / 4.0;

  vec3 col1 = vec3(0.9, 0.1, 0.3);
  vec3 col2 = vec3(0.1, 0.6, 0.9);
  vec3 col3 = vec3(0.8, 0.9, 0.1);

  vec3 color = mix(col1, col2, 0.5 + 0.5 * sin(v * 3.14159));
  color = mix(color, col3, 0.5 + 0.5 * sin(v * 6.28318 + 2.094));

  gl_FragColor = vec4(color, 1.0);
}
