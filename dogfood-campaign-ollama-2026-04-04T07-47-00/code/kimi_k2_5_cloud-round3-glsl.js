precision highp float;

uniform float u_time;
uniform vec2 u_resolution;

// Hash function for pseudo-random value generation
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.32, 37.51))) * 43758.5453);
}

// Value noise function
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Smooth interpolation curve
    vec2 u = f * f * (3.0 - 2.0 * f);

    // Interpolate between corners
    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractional Brownian Motion (FBM) for complex noise structure
float fbm(vec2 p, float frequency, float lacunarity, float octaves) {
    float total = 0.0;
    float amplitude = 1.0;
    float frequency_val = frequency;

    for (int i = 0; i < 8; i++) {
        total += noise(p * frequency_val) * amplitude;
        amplitude *= 0.5; // Exponential decay of amplitude
        frequency_val *= lacunarity;
    }
    return total;
}

// Function to map noise value to a swirling, plasma color
vec3 plasma_color(float n, float t) {
    // Scale and offset the noise value based on time for animated shifts
    float p = n * 0.8 + sin(t * 0.2) * 0.5;

    // Use sin/cos waves to create the characteristic plasma gradient
    float r = 0.5 + 0.5 * sin(p * 1.5 + t * 0.5);
    float g = 0.5 + 0.5 * cos(p * 1.5 + t * 0.5);
    float b = 0.5 + 0.5 * sin(p * 1.5 + t * 0.5 + 1.0);

    // Apply a strong glow/contrast boost
    vec3 color = vec3(r, g, b);
    return color * (1.0 + sin(p * 0.5 + t * 0.7) * 0.2);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = uv * 3.0 - 1.0; // Center coordinates and scale
    float t = u_time * 0.3;

    // 1. Calculate multiple noise layers for depth and movement
    float noise1 = fbm(p * vec2(1.0, 1.0), 1.0, 2.0, 4.0);
    float noise2 = fbm(p * vec2(0.5, 0.5), 0.5, 2.5, 3.0);
    float noise3 = fbm(p * vec2(0.8, 1.2), 0.8, 2.2, 4.0);

    // 2. Combine noise into a single 'energy' field
    float energy = (noise1 * 0.7 + noise2 * 0.3 + noise3 * 0.5);

    // 3. Apply a smooth, pulsating mask to focus the plasma effect
    float mask = sin(p.y * 0.5) * 0.2 + 0.8;
    float final_intensity = pow(energy + mask * 0.2, 1.5);

    // 4. Generate the final color using the plasma function
    vec3 color = plasma_color(final_intensity, t);

    // 5. Apply slight fading/falloff at edges
    float dist = length(gl_FragCoord.xy - 0.5 * u_resolution.xy);
    float falloff = smoothstep(u_resolution.x * 0.05, u_resolution.x * 0.45, dist);

    gl_FragColor = vec4(color * falloff, 1.0);
}