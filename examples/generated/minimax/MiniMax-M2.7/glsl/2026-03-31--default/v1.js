precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
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
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    
    return a + b * cos(TAU * (c * t + d));
}

float plasma(vec2 uv, float t) {
    float v1 = sin(uv.x * 10.0 + t);
    float v2 = sin(uv.y * 10.0 - t * 1.3);
    float v3 = sin(uv.x * 8.0 + uv.y * 8.0 + t * 0.7);
    float v4 = sin(length(uv) * 15.0 - t * 2.0);
    
    float n = fbm(uv * 2.0 + t * 0.2) * 2.0 - 1.0;
    float v5 = sin(n * 8.0 + t);
    
    float p = v1 + v2 + v3 + v4 + v5;
    p = p * 0.2;
    
    return p;
}

void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 uv0 = uv;
    
    float t = u_time * 0.8;
    
    float p1 = plasma(uv * 1.0, t);
    float p2 = plasma(uv * 1.5 + 2.0, t * 1.2 + 10.0);
    float p3 = plasma(uv * 0.8 - 1.5, t * 0.7 - 5.0);
    
    float finalPlasma = p1 * 0.5 + p2 * 0.3 + p3 * 0.2;
    
    float brightness = sin(finalPlasma * PI) * 0.5 + 0.5;
    
    float hueShift = t * 0.1 + length(uv) * 0.3 + finalPlasma * 0.2;
    vec3 color = palette(hueShift);
    
    color *= brightness;
    
    float vignette = 1.0 - length(uv0) * 0.3;
    color *= vignette;
    
    float scanline = sin(gl_FragCoord.y * 0.5 + t * 5.0) * 0.03 + 1.0;
    color *= scanline;
    
    color = pow(color, vec3(0.9));
    
    gl_FragColor = vec4(color, 1.0);
}