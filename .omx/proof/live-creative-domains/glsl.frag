precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 8.0;

  float v1 = sin(p.x + u_time);
  float v2 = sin(p.y + u_time * 0.7);
  float v3 = sin((p.x + p.y) * 0.5 + u_time * 1.3);
  float v4 = sin(length(p - 4.0) + u_time * 0.9);

  float plasma = (v1 + v2 + v3 + v4) / 4.0;

  vec3 color = vec3(
    sin(plasma * 3.14159 + u_time),
    sin(plasma * 3.14159 + u_time + 2.094),
    sin(plasma * 3.14159 + u_time + 4.189)
  );
  color = 0.5 + 0.5 * color;

  gl_FragColor = vec4(color, 1.0);
}
