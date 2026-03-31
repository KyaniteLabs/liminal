precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define ITER 8
#define SCALE 1.5

vec3 palette(float t) {
    return 0.5 + 0.5 * cos(6.283185 * (vec3(0.5, 0.33, 0.17) * t + vec3(0.0, 0.33, 0.67)));
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = frac(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    float f = 1.0;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p * f);
        a *= 0.5;
        f *= SCALE;
    }
    return v;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 m = u_mouse / u_resolution;
    float t = u_time * 0.6;

    vec2 p = uv * 1.2 + vec2(m.x - 0.5, 0.3 * sin(t * 0.7));

    float f = fbm(p + vec2(fbm(p * 0.7), fbm(p * 0.8 + t)));
    
    float c1 = sin(f + t);
    float c2 = cos(f - t * 0.8);
    float c3 = sin(f + t * 1.3);

    vec3 col = palette(0.5 + 0.5 * (c1 + c2 + c3));

    float dist = length(uv);
    float glow = exp(-dist * 2.5) * 0.8;
    
    gl_FragColor = vec4(col + vec3(glow), 1.0);
}