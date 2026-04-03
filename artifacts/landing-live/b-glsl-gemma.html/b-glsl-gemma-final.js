precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_center;

#define MAX_ITERATIONS 256
#define SCALE 100.0
#define AMPLITUDE 0.5
#define FREQUENCY 2.0

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv *= 2.0 - u_mouse.xy; // Distortion based on mouse

    float timeFactor = u_time * FREQUENCY;
    float dist = length(uv);
    float noiseFactor = noise(uv * SCALE + timeFactor);
    float fbmFactor = fbm(uv * SCALE + timeFactor) * AMPLITUDE;
    float colorFactor = hash(uv * SCALE + timeFactor) * 0.8;
    float warpFactor = fbm(uv * SCALE + timeFactor) * 0.4;

    vec3 color = vec3(0.0);

    for (int i = 0; i < MAX_ITERATIONS; i++) {
        float term = noiseFactor * colorFactor;
        color += term;
        noiseFactor *= 0.7;
        if (noiseFactor < 0.01) break;
    }

    color += fbmFactor;
    color += warpFactor;

    color = mix(vec3(0.1, 0.3, 0.6), vec3(0.6, 0.2, 0.1), colorFactor);

    gl_FragColor = vec4(color, 1.0);
}

// Helper noise function (simplex noise adaptation)
float noise(vec2 p) {
    float x = floor(p.x);
    float y = floor(p.y);
    float x0 = x;
    float y0 = y;

    float x1 = x + 1.0;
    float y1 = y + 1.0;

    vec2 ixy = vec2(x, y);
    vec2 ixy1 = vec2(x1, y);

    vec2 uv = p - ixy;
    vec2 uv1 = p - ixy1;

    float a = dot(uv, vec2(1.0, 1.0));
    float b = dot(uv, vec2(1.0, 0.0));
    float c = dot(uv, vec2(0.0, 1.0));

    float e1 = clamp(a, 0.0, 1.0);
    float e2 = clamp(b, 0.0, 1.0);
    float e3 = clamp(c, 0.0, 1.0);

    float d = e1 + e2 + e3;
    float d_inv = 1.0 / d;

    vec3 h = vec3(d_inv, d_inv, d_inv);

    float total = h.x + h.y + h.z;

    return mix(mix(h.x, h.y, uv.x), mix(h.z, total, uv.y), uv.z);
}

// Hash function - adapted from various sources
float hash(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float total = 0.0;
    for (int j = 0; j < 8; j++) {
        vec2 ij = vec2(i.x + float(j), i.y + float(j));
        float mix = mix(f.x, f.y, float(j));
        total += dot(ij, vec2(mix, mix));
    }
    return total;
}