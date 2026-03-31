precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

float turbulence(vec2 p) {
    float f = 0.0;
    float scale = 1.0;
    for (int i = 0; i < 4; i++) {
        f += abs(noise(p * scale) - 0.5) * 2.0 / scale;
        scale *= 2.0;
    }
    return f;
}

vec3 plasmaLayer(vec2 uv, float time, float frequency, float speed, float distortion) {
    float t = time * speed;
    vec2 p = uv * frequency;
    
    float wave1 = sin(p.x + t) * cos(p.y * 0.7 + t * 1.3);
    float wave2 = sin(p.y * 1.2 - t * 0.8) * cos(p.x * 0.9 - t * 1.1);
    float wave3 = sin(length(p - vec2(sin(t * 0.5), cos(t * 0.3))) * 2.0 - t * 1.5);
    
    float pattern = wave1 + wave2 * 0.5 + wave3 * 0.3;
    pattern += sin(p.x * p.y * 0.5 + t) * 0.3;
    
    vec2 distortedUV = uv + vec2(
        sin(uv.y * 5.0 + t * 2.0) * distortion,
        cos(uv.x * 5.0 + t * 1.7) * distortion
    );
    
    float n = noise(distortedUV * frequency * 2.0 + t);
    pattern += n * 0.4;
    
    return vec3(pattern);
}

vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
}

vec3 temperatureToRGB(float temp) {
    temp = clamp(temp, 0.0, 1.0);
    vec3 c1 = vec3(0.5, 0.5, 0.5);
    vec3 c2 = vec3(0.5, 0.5, 0.5);
    vec3 c3 = vec3(1.0, 1.0, 1.0);
    vec3 c4 = vec3(0.0, 0.33, 0.67);
    return c1 + c2 * cos(TAU * (c3 * temp + c4));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 centeredUV = uv - 0.5;
    centeredUV.x *= u_resolution.x / u_resolution.y;
    
    float time = u_time * 0.4;
    
    vec2 mouseInfluence = u_mouse * 2.0 - 1.0;
    float mouseDist = length(centeredUV - mouseInfluence * 0.5);
    float mouseEffect = 1.0 / (1.0 + mouseDist * 3.0);
    
    vec2 warpedUV = centeredUV;
    warpedUV += vec2(
        sin(warpedUV.y * 3.0 + time * 1.2) * 0.15,
        cos(warpedUV.x * 2.8 + time * 0.9) * 0.15
    );
    
    warpedUV += mouseInfluence * 0.1 * mouseEffect;
    
    float layer1 = sin(warpedUV.x * 4.0 + time * 1.5 + sin(warpedUV.y * 3.0 + time)) * 0.5 + 0.5;
    float layer2 = cos(warpedUV.y * 3.5 - time * 1.2 + cos(warpedUV.x * 2.5 - time * 0.8)) * 0.5 + 0.5;
    float layer3 = sin(length(warpedUV) * 5.0 - time * 2.0) * 0.5 + 0.5;
    
    float diagonal = (warpedUV.x + warpedUV.y) * 2.0;
    float angle = atan(warpedUV.y, warpedUV.x);
    float spiral = sin(diagonal + angle * 2.0 - time * 1.5) * 0.5 + 0.5;
    
    float combined = layer1 * 0.3 + layer2 * 0.3 + layer3 * 0.25 + spiral * 0.15;
    
    vec2 fbmUV = warpedUV * 2.0 + time * 0.3;
    float fbmValue = fbm(fbmUV);
    combined = combined * 0.7 + fbmValue * 0.3;
    
    float turbulent = turbulence(warpedUV * 3.0 + time * 0.5);
    combined = combined * 0.8 + turbulent * 0.2;
    
    float pulsing = sin(time * 2.0) * 0.1 + 0.9;
    combined *= pulsing;
    
    float colorShift = combined + time * 0.2;
    
    vec3 palette1 = cosPalette(colorShift, 
        vec3(0.5, 0.5, 0.5),
        vec3(0.5, 0.5, 0.5),
        vec3(1.0, 1.0, 1.0),
        vec3(0.0, 0.33, 0.67)
    );
    
    vec3 palette2 = cosPalette(colorShift * 0.8 + 0.2,
        vec3(0.5, 0.5, 0.5),
        vec3(0.5, 0.5, 0.5),
        vec3(1.0, 0.7, 0.4),
        vec3(0.0, 0.1, 0.2)
    );
    
    vec3 palette3 = temperatureToRGB(fract(colorShift * 0.5));
    
    vec3 mixedPalette = mix(palette1, palette2, sin(colorShift * PI) * 0.5 + 0.5);
    mixedPalette = mix(mixedPalette, palette3, 0.3);
    
    float brightness = combined * 0.8 + 0.2;
    vec3 finalColor = mixedPalette * brightness;
    
    float vignette = 1.0 - length(centeredUV) * 0.8;
    vignette = clamp(vignette, 0.0, 1.0);
    vignette = pow(vignette, 0.5);
    finalColor *= vignette;
    
    float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.03 + 0.97;
    finalColor *= scanline;
    
    float glow = exp(-mouseDist * 2.0) * mouseEffect;
    finalColor += vec3(0.8, 0.4, 0.9) * glow * 0.3;
    
    float beatPulse = pow(sin(time * 4.0) * 0.5 + 0.5, 3.0);
    finalColor += vec3(0.2, 0.5, 0.8) * beatPulse * 0.15 * combined;
    
    finalColor = pow(finalColor, vec3(0.95));
    finalColor = clamp(finalColor, 0.0, 1.0);
    
    gl_FragColor = vec4(finalColor, 1.0);
}