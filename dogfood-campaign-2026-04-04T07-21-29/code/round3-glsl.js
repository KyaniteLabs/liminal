#version 300 es
precision highp float;

uniform float u_time;
uniform vec2  u_resolution;

out vec4 fragColor;

// --- Noise utilities ---
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; ++i) {
        sum += amp * valueNoise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return sum;
}

// --- Plasma effect ---
vec3 plasma(vec2 uv, float t) {
    float v = 0.0;
    // sine wave composition
    v += sin(uv.x * 10.0 + t);
    v += sin(uv.y * 10.0 + t * 0.7);
    v += sin((uv.x + uv.y) * 8.0 + t * 1.3);
    // add radial component
    float r = length(uv - 0.5);
    v += sin(r * 15.0 - t * 2.0);
    // blend in noise
    v += fbm(uv * 3.0 + t * 0.4) * 2.0 - 1.0;
    // normalize roughly to [0,1]
    v = 0.5 + 0.5 * sin(v);
    return vec3(v, v * 0.7, 1.0 - v);
}

void mainImage(out vec4 color, in vec2 fragCoord) {
    vec2 uv = fragCoord / u_resolution.xy;
    vec3 col = plasma(uv, u_time);
    color = vec4(col, 1.0);
}