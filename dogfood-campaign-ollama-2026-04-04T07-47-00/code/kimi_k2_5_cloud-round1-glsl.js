#version 330 소
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_aspect;

// Pseudo-random hash function for noise input
float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(41.2, 3.1))) * 43758.5453);
}

// Value noise function (Simplex/Perlin approximation)
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Smooth interpolation curve
    vec2 u = f * f * (3.0 - 2.0 * f);

    // Sample the 4 corners
    float a = hash12(i + vec2(0.0, 0.0));
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));

    // Interpolate
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 3D Noise incorporating time
float noise3d(vec3 p) {
    return noise(p.xy + p.z * 0.5);
}

// Plasma color mapping function
vec3 plasma_color(float v, float t) {
    // Use sin/cos waves combined with the value to create cyclical color shifts
    float r = 0.5 + 0.5 * cos(v + t * 0.3);
    float g = 0.5 + 0.5 * sin(v + t * 0.5);
    float b = 0.5 + 0.5 * cos(v + t * 0.7);
    return vec3(r, g, b);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = uv * 10.0;
    float t = u_time * 0.3;

    // Normalize coordinates and apply tiling/scaling
    vec2 coords = p * u_aspect.x;

    // --- Base Noise Calculation ---
    // Use noise in both XY plane and time (Z) for volume effect
    float noise_val = noise3d(vec3(coords.x * 0.5, coords.y * 0.5, t * 0.5));

    // --- Intensity and Detail Generation ---
    // Combine multiple octaves of noise for richer detail
    float detail = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    for (int i = 0; i < 4; ++i) {
        detail += noise(coords * frequency + vec2(t * 0.1, t * 0.05)) * amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    // Normalize and smooth the combined noise value
    float final_v = (noise_val * 0.5 + detail * 0.5) * 0.8 + 0.2;
    final_v = smoothstep(0.1, 0.9, final_v);

    // --- Color Mapping ---
    vec3 color = plasma_color(final_v * 10.0, t);

    // Apply an exponential falloff to simulate plasma core intensity
    float intensity = exp(-abs(final_v - 0.5) * 5.0);
    color *= intensity;

    // Final output
    gl_FragColor = vec4(color, 1.0);
}