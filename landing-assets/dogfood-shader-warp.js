No markdown, just raw GLSL code starting with precision highp float;
</think>

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265359

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

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

vec2 warp(vec2 p, float t) {
    vec2 q = vec2(
        fbm(p + vec2(0.0, 0.0) + 0.1 * t),
        fbm(p + vec2(5.2, 1.3) + 0.12 * t)
    );
    
    vec2 r = vec2(
        fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t),
        fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.13 * t)
    );
    
    return r;
}

float pattern(vec2 p, float t) {
    vec2 w = warp(p, t);
    float f = fbm(p + 4.0 * w);
    return f;
}

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    
    return a + b * cos(6.28318 * (c * t + d));
}

vec3 palette2(float t) {
    vec3 a = vec3(0.6, 0.2, 0.8);
    vec3 b = vec3(0.4, 0.5, 0.3);
    vec3 c = vec3(1.0, 0.8, 0.4);
    vec3 d = vec3(0.0, 0.15, 0.3);
    
    return a + b * cos(6.28318 * (c * t + d));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 uv0 = uv;
    
    float t = u_time * 0.3;
    
    uv *= 2.0;
    uv = rot(sin(t * 0.2) * 0.5) * uv;
    
    float p1 = pattern(uv, t);
    float p2 = pattern(uv * 1.5 + vec2(10.0), t * 1.1);
    float p3 = pattern(uv * 0.5 - vec2(5.0), t * 0.7);
    
    vec3 col1 = palette(p1);
    vec3 col2 = palette2(p2);
    vec3 col3 = palette(p3 + 0.5);
    
    vec3 finalColor = mix(col1, col2, p2);
    finalColor = mix(finalColor, col3, p3 * 0.5);
    
    float edge = fwidth(p1) * 2.0;
    float highlight = smoothstep(0.4, 0.6 + edge, p1);
    finalColor += highlight * 0.3;
    
    float darkFactor = smoothstep(0.0, 0.7, length(uv0));
    finalColor *= mix(vec3(1.0), vec3(0.3, 0.4, 0.6), darkFactor);
    
    float vignette = 1.0 - dot(uv0, uv0) * 0.5;
    finalColor *= vignette;
    
    float mouseInfluence = smoothstep(0.0, 0.5, 1.0 - length(uv0 - (u_mouse - 0.5)));
    finalColor = mix(finalColor, finalColor * vec3(1.2, 1.1, 0.9), mouseInfluence * 0.3);
    
    finalColor = pow(finalColor, vec3(0.9));
    finalColor = finalColor * 1.1 - 0.1;
    
    gl_FragColor = vec4(finalColor, 1.0);
}