precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
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
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(TAU * (c * t + d + u_time * 0.1));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;
    
    float t = u_time * 0.2;
    vec2 m = (u_mouse * 2.0 - 1.0) * 0.5;
    
    vec2 p = uv;
    
    float n1 = fbm(p + t + fbm(p * 2.0 + t * 0.5));
    float n2 = fbm(p * 1.5 - t * 0.3 + vec2(n1 * 0.5));
    
    float d = length(uv - m * 0.5);
    float wave1 = sin(p.x * 3.0 + t + n2 * 2.0);
    float wave2 = sin(p.y * 2.5 - t * 0.7 + n1 * 1.5);
    float wave3 = sin((p.x + p.y) * 2.5 + t * 0.5 + d * 3.0);
    
    float pattern = (wave1 + wave2 + wave3) * 0.3 + n1 * 0.4 + n2 * 0.3;
    
    vec3 col = palette(pattern + t * 0.3);
    
    col += vec3(0.1, 0.05, 0.15) / (abs(pattern) + 0.1);
    
    float vig = 1.0 - length(uv) * 0.25;
    col *= vig;
    
    gl_FragColor = vec4(col, 1.0);
}