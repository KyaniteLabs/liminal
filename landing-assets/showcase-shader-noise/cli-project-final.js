    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D Value Noise
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

// FBM with configurable octaves
float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for(int i = 0; i < 6; i++) {
        if(i >= octaves) break;
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return value;
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord.xy / u_resolution.xy;
    uv = uv * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;
    
    float t = u_time * 0.3;
    
    vec2 p = uv * 3.0;
    vec2 q = vec2(fbm(p + vec2(0.0, 0.0), 4),
                  fbm(p + vec2(5.2, 1.3), 4));
    
    vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2), 4),
                  fbm(p + 4.0 * q + vec2(8.3, 2.8), 4));
    
    float f = fbm(p + 4.0 * r, 4);
    
    vec3 col = hsv2rgb(vec3(f + t, 0.8, 0.9));
    col = mix(col, hsv2rgb(vec3(f + t + 0.2, 0.6, 1.0)), smoothstep(0.4, 0.6, f));
    
    fragColor = vec4(col, 1.0);
}