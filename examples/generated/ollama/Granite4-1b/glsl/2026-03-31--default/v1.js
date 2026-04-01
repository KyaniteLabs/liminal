precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265358979323846

void main() {
vec2 uv = gl_FragCoord.xy / u_resolution;
float t = u_time * 0.5;
vec2 mouse = u_mouse * u_resolution;

float timeNoise = sin(u_time + mouse.x) * 0.05;
float noiseScale = 0.02;
float distortion = fbm(uv * noiseScale);
uv += vec2(distortion, distortion);

float colorShift = mix(1.0, 0.5, sin(t));
vec3 baseColor = vec3(0.2, 0.4, 0.7) + vec3(sin(u_time * 10.0), cos(u_time * 10.0), 1.0);
vec3 color = mix(vec3(0.8, 0.6, 0.0), vec3(0.2, 0.4, 0.7) + baseColor, sin(u_time * 12.0));

gl_FragColor = vec4(color, 1.0);
}