glsl
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265359
#define TWO_PI 6.28318530718

// Simple hash function for noise
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth noise
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

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);
    
    // Chromatic aberration offsets
    float aberrationStrength = 0.02 + 0.01 * sin(u_time);
    vec2 uvR = uv * (1.0 + aberrationStrength);
    vec2 uvG = uv;
    vec2 uvB = uv * (1.0 - aberrationStrength);
    
    // Distance with aberration for each channel
    float distR = length(uvR);
    float distG = length(uvG);
    float distB = length(uvB);
    
    // Pulsing rings with different frequencies
    float ringsR = sin(distR * 20.0 - u_time * 2.0 + noise(uvR * 3.0 + u_time * 0.5) * 2.0);
    float ringsG = sin(distG * 20.0 - u_time * 2.0 + noise(uvG * 3.0 + u_time * 0.5) * 2.0);
    float ringsB = sin(distB * 20.0 - u_time * 2.0 + noise(uvB * 3.0 + u_time * 0.5) * 2.0);
    
    // Convert to color channels with pulsing
    vec3 color = vec3(
        0.5 + 0.5 * ringsR,
        0.5 + 0.5 * ringsG,
        0.5 + 0.5 * ringsB
    );
    
    gl_FragColor = vec4(color, 1.0);
}