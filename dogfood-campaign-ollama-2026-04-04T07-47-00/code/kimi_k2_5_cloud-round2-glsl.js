#version 330 소

// Uniforms passed from the CPU side
uniform vec2 u_resolution;
uniform float u_time;

// Pseudo-random hash function (simple implementation)
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.7, 28.5))) * 43758.5453);
}

// Value noise function (smoother than pure hash)
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Interpolate using smoothstep for smooth gradients
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Function to generate multi-octave noise for detail
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 4; ++i) {
        value += noise(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    // Normalize UV coordinates
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    
    // Center coordinates and scale for plasma effect
    vec2 p = uv * 1.5 - 0.5; 
    
    // Time-space coordinates for animation
    vec2 animated_p = p * 0.8 + vec2(u_time * 0.1, u_time * 0.05);

    // --- Plasma Dynamics ---
    
    // 1. Base Noise (Large scale structure)
    float noise_scale = fbm(animated_p * 0.5);

    // 2. Secondary Noise (Detail and turbulence)
    float detail_noise = fbm(animated_p * 2.0 + vec2(u_time * 0.2, 0.0));

    // Combine and normalize the signal (0.0 to 1.0)
    float plasma_intensity = (noise_scale * 0.6 + detail_noise * 0.4 + 0.5);
    
    // Smooth the intensity for better color mapping
    float plasma_map = smoothstep(0.3, 0.8, plasma_intensity);
    
    // --- Color Shifting and Animation ---
    
    // Use sine waves based on position and time to create pulsing color gradients
    float color_shift_r = sin(plasma_map * 10.0 + u_time * 1.5) * 0.5 + 0.5;
    float color_shift_g = cos(plasma_map * 12.0 - u_time * 1.0) * 0.5 + 0.5;
    float color_shift_b = sin(plasma_map * 8.0 + u_time * 0.8) * 0.5 + 0.5;

    // Mix the color shifts with the plasma intensity map
    vec3 plasma_color = vec3(
        color_shift_r * plasma_map * 1.5, // Red component
        color_shift_g * plasma_map * 1.2, // Green component
        color_shift_b * plasma_map * 1.8  // Blue component
    );
    
    // Apply some overall glow/falloff
    float glow = 1.0 - pow(length(uv - vec2(0.5)), 2.0) * 1.5;
    
    // Final Output Color
    vec3 final_color = plasma_color * glow;
    
    // Tone mapping and clamping
    gl_FragColor = vec4(pow(final_color, vec3(0.8)), 1.0);
}