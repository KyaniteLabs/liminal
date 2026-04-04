#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;

out vec4 fragColor;

// Hash function for pseudo-random values
float hash( vec2 p ) {
    p *= 12.9898;
    p *= 78.233;
    return fract(sin(p.x) * p.y);
}

// Simple 2D pseudo-random noise (based on hash)
float noise( vec2 p ) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Smooth interpolation (smootherstep)
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash( i + vec2(0.0, 0.0) );
    float b = hash( i + vec2(1.0, 0.0) );
    float c = hash( i + vec2(0.0, 1.0) );
    float d = hash( i + vec2(1.0, 1.0) );

    return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

// Fractal Brownian Motion (FBM) for detailed noise
float fbm( vec2 p ) {
    float f = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 4; i++) {
        f += noise(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return f;
}

void main() {
    // Normalized UV coordinates
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    // Center the coordinates and scale them for effect
    vec2 p = (uv - 0.5) * 2.0;
    
    // Incorporate time into the noise input for animation
    float time_offset = u_time * 0.15;
    p.x += time_offset * 0.8;
    p.y += time_offset * 0.6;

    // --- Noise Layers ---

    // Layer 1: Primary Swirl (Low frequency, large scale)
    float noise1 = fbm(p * 0.3 + vec2(0.0, u_time * 0.2));

    // Layer 2: Detail/Turbulence (Medium frequency)
    float noise2 = fbm(p * 1.5 - vec2(u_time * 0.5, u_time * 0.3));

    // Layer 3: High Frequency Detail (Small scale, rapid change)
    float noise3 = fbm(p * 5.0 + vec2(u_time * 1.0, u_time * 0.8));

    // Combine noise layers to create a complex, swirling pattern
    float plasma_intensity = pow(noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2, 1.2);
    
    // --- Color Mapping and Animation ---

    // Map the intensity to control the color shift (using sine waves for smooth chromatic shifts)
    float t = u_time * 0.5;
    
    // Red channel: Based on combined noise and time
    float r = sin(plasma_intensity * 10.0 + t * 0.5) * 0.5 + 0.5;
    
    // Green channel: Shifted phase and different frequency
    float g = cos(plasma_intensity * 8.0 + t * 0.8) * 0.5 + 0.5;
    
    // Blue channel: Heavily time and space dependent
    float b = sin(plasma_intensity * 12.0 + t * 1.2 - p.x * 0.5) * 0.5 + 0.5;

    // Final color output (adjusting contrast/brightness)
    vec3 final_color = vec3(r * 1.2, g * 1.0, b * 1.2);
    
    // Apply a subtle darkening/saturation effect
    final_color *= (1.0 + 0.1 * sin(u_time * 0.3));

    fragColor = vec4(final_color, 1.0);
}