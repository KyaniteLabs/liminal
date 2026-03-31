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
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = rot * p * 2.0;
        a *= 0.5;
    }
    return v;
}

float pattern(vec2 p, float t) {
    vec2 q = vec2(fbm(p + vec2(0.0, 0.0) + t * 0.1),
                  fbm(p + vec2(5.2, 1.3) + t * 0.12));
    vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.08),
                  fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.09));
    return fbm(p + 4.0 * r);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 plasmaPalette(float t, float variation) {
    float h = fract(t * 0.7 + variation * 0.3);
    float s = 0.7 + 0.3 * sin(t * TAU + variation * PI);
    float v = 0.8 + 0.2 * cos(t * TAU * 1.5 + variation * 2.0);
    return hsv2rgb(vec3(h, s, v));
}

float electricPulse(float x, float t) {
    return sin(x * 10.0 + t * 3.0) * 0.5 + 0.5;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 p = (uv - 0.5) * aspect * 3.0;
    
    float t = u_time * 0.5;
    
    float n1 = noise(p * 2.0 + t * 0.3);
    float n2 = noise(p * 3.0 - t * 0.2 + vec2(100.0));
    float n3 = pattern(p, t);
    
    vec2 warp1 = vec2(fbm(p + t * 0.1), fbm(p + vec2(7.3, 2.1) + t * 0.15));
    vec2 warp2 = vec2(fbm(p + warp1 * 2.0 + t * 0.05), fbm(p + warp1 * 1.5 + vec2(3.3, 7.7)));
    float warpedNoise = fbm(p + warp2 * 3.0);
    
    float plasma1 = sin(p.x * 4.0 + t * 1.5 + sin(p.y * 3.0 + t * 0.8));
    float plasma2 = sin(p.y * 5.0 - t * 1.2 + cos(p.x * 2.5 + t * 0.6));
    float plasma3 = sin((p.x + p.y) * 3.0 + t * 1.0);
    float plasma4 = sin(length(p) * 6.0 - t * 2.0);
    float plasma5 = sin((p.x - p.y) * 4.0 + t * 0.9);
    
    float combinedPlasma = (plasma1 + plasma2 + plasma3 + plasma4 + plasma5) * 0.2;
    
    float ripple1 = sin(length(p - vec2(sin(t * 0.7) * 0.5, cos(t * 0.5) * 0.5)) * 8.0 - t * 3.0);
    float ripple2 = sin(length(p - vec2(cos(t * 0.3) * 0.8, sin(t * 0.4) * 0.6)) * 10.0 + t * 2.5);
    float ripples = (ripple1 + ripple2) * 0.25;
    
    float finalNoise = mix(n1, n2, 0.5);
    finalNoise = mix(finalNoise, warpedNoise, 0.4);
    finalNoise = mix(finalNoise, n3, 0.3);
    finalNoise = mix(finalNoise, combinedPlasma, 0.35);
    finalNoise = mix(finalNoise, ripples, 0.25);
    
    float electric = electricPulse(finalNoise * TAU, t * 2.0);
    finalNoise = mix(finalNoise, electric, 0.15);
    
    float pulse = sin(t * 1.5 + finalNoise * 4.0) * 0.5 + 0.5;
    float pulse2 = sin(t * 0.7 + finalNoise * 2.0 + warp1.x * 3.0) * 0.5 + 0.5;
    
    float colorMix = fract(finalNoise * 2.0 + t * 0.2);
    float colorMix2 = fract(finalNoise * 3.0 - t * 0.15 + pulse);
    float colorMix3 = fract(warpedNoise + t * 0.1);
    
    vec3 col1 = plasmaPalette(colorMix, warp1.x);
    vec3 col2 = plasmaPalette(colorMix2 + 0.33, warp1.y);
    vec3 col3 = plasmaPalette(colorMix3 + 0.66, warp2.x);
    
    vec3 finalColor = mix(col1, col2, pulse * 0.6 + 0.2);
    finalColor = mix(finalColor, col3, pulse2 * 0.5 + 0.2);
    
    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    vec3 processed = finalColor;
    
    float contrast = 1.2 + 0.3 * sin(t * 0.5);
    processed = (processed - 0.5) * contrast + 0.5;
    
    float saturation = 1.0 + 0.5 * sin(finalNoise * TAU + t);
    processed = mix(vec3(luminance), processed, saturation);
    
    float glow = exp(-length(p) * 0.5) * 0.3;
    processed += glow * plasmaPalette(t * 0.1, finalNoise);
    
    float vignette = 1.0 - length(uv - 0.5) * 0.8;
    vignette = smoothstep(0.0, 1.0, vignette);
    processed *= vignette;
    
    float scanline = sin(uv.y * u_resolution.y * 0.5 + t * 10.0) * 0.03;
    processed -= scanline;
    
    float chromatic = 0.02 * sin(t * 3.0);
    vec2 redOffset = vec2(chromatic, 0.0);
    vec2 blueOffset = vec2(-chromatic, 0.0);
    float r = plasmaPalette(colorMix, warp1.x).r;
    float b = plasmaPalette(colorMix, warp1.x).b;
    processed.r = mix(processed.r, r, 0.2);
    processed.b = mix(processed.b, b, 0.2);
    
    processed = clamp(processed, 0.0, 1.0);
    processed = pow(processed, vec3(0.9));
    
    gl_FragColor = vec4(processed, 1.0);
}