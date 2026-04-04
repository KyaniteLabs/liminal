#version 330 소
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_camera_pos;

// Simple pseudo-random hash function
float hash(float n) {
    return fract(sin(n) * 43758.5453);
}

// 2D noise function (basic value noise)
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Smooth step interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i.x) + hash(i.y + 1.0) * 50.0;
    float b = hash(i.x + 1.0) + hash(i.y) * 50.0;
    float c = hash(i.x + 1.0) + hash(i.y + 1.0) * 50.0;
    float d = hash(i.x) + hash(i.y + 2.0) * 50.0;
    
    return mix(mix(a, b, u.x), mix(d, c, u.x), u.y);
}

// Fractional Brownian Motion (FBM) for layered noise
float fbm(vec2 p) {
    float f = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 4; ++i) {
        f += noise(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return f;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = uv * 1.5 + vec2(0.0); // Initial offset

    // Time-based flow and animation
    float time_offset = u_time * 0.1;
    vec2 animated_p = p * 2.0 + vec2(time_offset, time_offset * 0.5);

    // --- Plasma Core Noise ---
    // Layer 1: Low frequency, large scale flow
    float noise1 = fbm(animated_p * 0.1);

    // Layer 2: Mid frequency, ripple effect
    float noise2 = fbm(animated_p * 0.5 + vec2(0.0, 5.0));
    
    // Layer 3: High frequency, detail and turbulence
    float noise3 = fbm(animated_p * 2.0);

    // Combine noise layers to create structure
    float plasma_intensity = (noise1 * 0.5 + noise2 * 0.4 + noise3 * 0.1);
    
    // Normalize and smooth the intensity
    float plasma_factor = pow(max(0.0, plasma_intensity) * 0.5 + 0.5, 1.5);
    
    // --- Color Mapping and Shift ---
    
    // Use the noise structure to drive color
    vec3 color_base = 0.5 + 0.5 * cos(animated_p.x * 0.3 + time_offset * 0.5);
    vec3 color_detail = 0.5 + 0.5 * sin(animated_p.y * 0.2 + time_offset * 0.8);
    
    // Blend the base color with the noise structure
    vec3 final_color = mix(vec3(0.0, 0.2, 1.0), vec3(0.8, 0.5, 1.0), plasma_factor);
    
    // Apply the animated color shift (cyan -> purple -> magenta)
    float color_shift = sin(u_time * 0.8) * 0.5 + 0.5;
    
    // Mix the final color with a pulsating gradient based on time
    final_color *= (0.7 + 0.3 * color_shift);
    
    // Add a glow/bloom effect based on the noise peaks
    float glow = pow(plasma_factor, 3.0) * 1.5;
    final_color += vec3(1.0 - glow) * 0.1; // Subtle ambient glow

    gl_FragColor = vec4(final_color, 1.0);
}