#version 330 소
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;

// Simple pseudo-random noise function (based on sine waves)
float hash(float n) {
    return fract(sin(n) * 43758.5453);
}

// 2D Noise function
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Smoothstep interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i.x * 5.1 + i.y * 2.3);
    float b = hash(i.x * 5.1 + (i.y + 1.0) * 2.3);
    float c = hash((i.x + 1.0) * 5.1 + i.y * 2.3);
    float d = hash((i.x + 1.0) * 5.1 + (i.y + 1.0) * 2.3);

    return mix(mix(a, b, u.y), mix(c, d, u.y), u.x);
}

// Multi-octave noise (FBM)
float fbm(vec2 p, float scale, float octaves) {
    float total = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    for (int i = 0; i < int(octaves); i++) {
        total += noise(p * frequency) * amplitude;
        amplitude *= 0.5; // Decrease amplitude
        frequency *= 2.0; // Increase frequency
    }
    return total;
}

// Main plasma shader function
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y; // Aspect correction

    vec2 p = uv * 0.5;
    float time_factor = u_time * 0.15;

    // --- 1. Core Plasma Noise Field ---
    // Combine multiple noise inputs with movement and scale
    float n1 = fbm(p + vec2(time_factor * 0.8, time_factor * 0.5), 1.0, 4.0);
    float n2 = fbm(p * 0.9 + vec2(time_factor * 0.6, time_factor * 1.2), 0.8, 5.0);
    float n3 = fbm(p * 1.2 + vec2(time_factor * 0.4, time_factor * 0.8), 0.6, 4.0);

    // Combine noise layers to create complex structure
    float plasma_intensity = (n1 * 0.4 + n2 * 0.4 + n3 * 0.2) * 1.5;

    // --- 2. Directional Flow and Swirl ---
    // Use the magnitude and direction of the noise gradient to guide the plasma
    vec2 flow_direction = normalize(vec2(n1, n2));
    float flow_strength = sin(plasma_intensity * 2.0 + time_factor * 0.5) * 0.5 + 0.5;

    // Smooth the plasma field and enhance contrast
    float plasma_effect = pow(abs(plasma_intensity) - 0.5, 2.0) * flow_strength;
    plasma_effect = smoothstep(0.0, 1.0, plasma_effect) * 2.0;

    // --- 3. Color Shift (Chromatic Animation) ---
    // Use the plasma intensity and time to calculate an animated color offset
    float color_shift_r = sin(plasma_effect * 5.0 + time_factor * 1.5);
    float color_shift_g = sin(plasma_effect * 5.0 + time_factor * 0.5);
    float color_shift_b = sin(plasma_effect * 5.0 + time_factor * 2.5);

    // Map the combined energy to a rich, shifting color palette
    vec3 base_color = vec3(0.1, 0.5, 1.0); // Starting blue/cyan
    vec3 plasma_color = vec3(
        0.5 + 0.5 * color_shift_r,
        0.2 + 0.8 * color_shift_g,
        0.8 + 0.2 * color_shift_b
    );

    // Final color mixing: Plasma color weighted by intensity, background otherwise
    vec3 final_color = mix(
        vec3(0.0, 0.0, 0.0), // Dark background
        plasma_color,
        plasma_effect * 0.9
    );

    // Apply slight vignetting and cleanup
    float vignette = 1.0 - length(uv) * 0.5;
    final_color *= vignette;

    gl_FragColor = vec4(final_color, 1.0);
}