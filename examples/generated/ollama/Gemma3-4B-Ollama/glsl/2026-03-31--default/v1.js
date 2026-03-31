precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265358979323846

#define NUM_PARTICLES 200
#define MAX_ITERATIONS 200

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); float a = hash(i); float b = hash(i + vec2(1.0, 0.0)); float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0)); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }

float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }

vec3 plasmaColor(float t) {
    float colorOffset = sin(t * 10.0 + u_mouse.x * 5.0) * 0.2;
    return vec3(
        1.0 + 0.5 * fbm(vec2(t + colorOffset, u_time * 2.0 + colorOffset)),
        1.0 + 0.3 * fbm(vec2(t + colorOffset * 0.5, u_time * 3.0 + colorOffset * 0.5)),
        0.8 + 0.1 * fbm(vec2(t + colorOffset * 0.75, u_time * 4.0 + colorOffset * 0.75))
    );
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float timeFactor = u_time * 0.1;
    float noiseFactor = fbm(vec2(uv.x * 0.01, uv.y * 0.01)) * 0.5;

    vec3 color = plasmaColor(u_time + noiseFactor);

    // Distortion effect using noise
    vec2 distortion = vec2(noise(uv * 5.0), noise(uv * 10.0));
    uv += distortion * 0.01;

    // Apply color
    color = color * (1.0 + sin(u_time * 3.0) * 0.3);
    color = pow(color, vec3(0.7));
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
}