precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash13(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
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

float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n = mix(
        mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
            mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
            mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y),
        f.z
    );
    return n;
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for(int i = 0; i < 6; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

float fbm3D(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for(int i = 0; i < 5; i++) {
        value += amplitude * noise3D(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

float domainWarp(vec2 p, float t) {
    vec2 q = vec2(
        fbm(p + vec2(0.0, 0.0)),
        fbm(p + vec2(5.2, 1.3))
    );
    
    vec2 r = vec2(
        fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t),
        fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.126 * t)
    );
    
    return fbm(p + 4.0 * r);
}

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.00, 0.33, 0.67);
    return a + b * cos(TAU * (c * t + d));
}

vec3 palette2(float t) {
    vec3 a = vec3(0.6, 0.2, 0.8);
    vec3 b = vec3(0.4, 0.6, 0.2);
    vec3 c = vec2(2.0, 1.0, 0.0);
    vec3 d = vec2(0.5, 0.2, 0.25);
    return a + b * cos(TAU * (c * t + d));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
    
    float t = u_time * 0.3;
    
    uv *= 3.0;
    
    vec2 mouseInfluence = (u_mouse - 0.5) * 2.0;
    uv += mouseInfluence * 0.2 * sin(t * 0.5);
    
    float warp1 = domainWarp(uv * 0.8, t);
    float warp2 = domainWarp(uv * 1.2 + vec2(100.0), t * 1.3);
    
    vec2 distortedUV = uv + vec2(warp1, warp2) * 0.5;
    
    float n1 = fbm(distortedUV * 2.0 + t * 0.2);
    float n2 = fbm3D(vec3(distortedUV * 3.0, t * 0.4));
    
    float final = n1 * 0.6 + n2 * 0.4;
    final = pow(final, 1.2);
    
    vec3 col1 = palette(final + t * 0.1);
    vec3 col2 = palette2(final * 1.5 - t * 0.15);
    vec3 col3 = palette(final * 0.5 + warp1);
    
    vec3 color = mix(col1, col2, sin(final * PI * 2.0) * 0.5 + 0.5);
    color = mix(color, col3, cos(warp2 * TAU) * 0.3 + 0.3);
    
    float edge = fwidth(final);
    color *= 1.0 + edge * 2.0;
    
    color += vec3(0.05, 0.02, 0.08) * warp1 * warp2;
    
    color = pow(color, vec3(0.85));
    
    float vignette = 1.0 - length(uv * 0.4);
    color *= smoothstep(0.0, 0.7, vignette);
    
    gl_FragColor = vec4(color, 1.0);
}