precision highp float;

uniform float iTime;
uniform vec2 iResolution;

// Hash function for noise
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// 2D Noise function
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

// Fractal Brownian Motion
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Color palette based on cosine functions
vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(6.28318 * (c * t + d));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Normalize coordinates to 0-1 and correct aspect ratio
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Time variable
    float t = iTime * 0.2;
    
    // Plasma calculation combining sine waves and noise
    vec2 p = uv * 3.0;
    
    float v = 0.0;
    v += sin(p.x * 4.0 + t);
    v += sin(p.y * 4.0 + t);
    v += sin((p.x + p.y) * 4.0 + t);
    v += sin(sqrt(p.x * p.x + p.y * p.y) * 4.0 + t);
    
    // Add noise distortion for mesmerizing effect
    float n = fbm(p * 2.0 + t * 0.5);
    v += n * 2.0;
    
    // Normalize value to 0-1 range
    v = v * 0.25 + 0.5;
    
    // Animate color shift
    vec3 color = palette(v + t * 0.1);
    
    // Output final color
    fragColor = vec4(color, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}