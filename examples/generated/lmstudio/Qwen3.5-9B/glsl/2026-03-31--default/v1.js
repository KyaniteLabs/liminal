precision highp float;

#define PI 3.14159265359
#define MAX_STEPS 100
#define MIN_DIST 0.001

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

// Pseudo-random hash function for deterministic chaos
float hash(vec2 p) { 
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); 
}

// Smooth value noise interpolation
float noise(vec2 p) { 
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    // Avoid division by zero if f is very close to integer boundaries
    if (length(f) < 0.01) return hash(i + vec2(0.5, 0.5)); 
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian Motion for detailed texture generation
float fbm(vec2 p) { 
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0); // High frequency detail
    
    for (int i = 0; i < 6; i++) { 
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

// Domain warping function to distort space based on time and position
float domainWarp(vec2 pos, float t) {
    vec2 warped = pos * 1.2 + sin(pos.yx * 2.0 + t * 0.5) * 0.3;
    return fbm(warped);
}

// Generate a single plasma layer at specific frequency and amplitude
float getPlasmaLayer(vec2 uv, float freq, float amp, float timeOffset) {
    vec2 p = uv * freq + vec2(timeOffset);
    
    // Domain warping creates the fluid motion
    p.x += sin(p.y * 3.0 + u_time * 1.5);
    p.y += cos(p.x * 3.0 - u_time * 1.0);
    
    return fbm(p) * amp;
}

// Color palette function using HSL-like conversion for vibrant plasma colors
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(PI * (c * t + d));
}

void main() {
    // Normalize coordinates to center of screen (-1 to 1)
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    
    // Mouse influence on animation speed and color shift
    float mouseInfluence = length(u_mouse - vec2(0.5)) * 3.0;
    float globalTime = u_time + mouseInfluence * 0.1;
    
    // Base FBM for overall background texture
    float baseNoise = fbm(uv * 1.5);
    
    // Generate multiple plasma layers with different frequencies and speeds
    float layer1 = getPlasmaLayer(uv, 3.0, 0.8, globalTime * 0.5) + sin(globalTime * 2.0) * 0.2;
    float layer2 = getPlasmaLayer(uv, 6.0, 0.6, globalTime * 1.3);
    float layer3 = getPlasmaLayer(uv, 12.0, 0.4, globalTime * 2.5);
    
    // Combine layers with domain warping for complex flow
    float combined = (layer1 + layer2) * 0.5 + layer3;
    combined += sin(combined * 2.0 - u_time * 1.0) * 0.1;
    
    // Add mouse interaction distortion
    vec2 distortedUV = uv + normalize(uv - u_mouse.xyx) * (combined * 0.2);
    float finalValue = fbm(distortedUV * 3.0);
    
    // Color transformation using dynamic palette
    vec3 colorA = vec3(0.5, 0.0, 0.6);   // Magenta base
    vec3 colorB = vec3(0.0, 1.0, 0.8);   // Cyan accent
    vec3 colorC = vec3(0.0, 1.0, 0.5);   // Green highlight
    vec3 colorD = vec3(0.2, 0.1, 0.4);   // Purple depth
    
    vec3 paletteColor = palette(finalValue * 4.0 + globalTime * 0.3, colorA, colorB, colorC, colorD);
    
    // Enhance contrast and add glow effect based on value intensity
    float intensity = smoothstep(0.2, 1.0, finalValue);
    paletteColor *= (intensity * 2.5 + 0.5);
    
    // Add secondary interference pattern for complexity
    float interference = sin(uv.x * 10.0 + globalTime) * cos(uv.y * 10.0 - globalTime * 0.8);
    paletteColor += interference * 0.2;
    
    // Final tone mapping and output
    gl_FragColor = vec4(paletteColor, 1.0);
}