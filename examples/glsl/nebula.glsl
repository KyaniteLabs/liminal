precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265359
#define TAU 6.28318530718
#define STAR_DENSITY 0.15
#define NEBULA_LAYERS 4

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float hash3(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract(p.x * p.y * p.z);
}

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

float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for(int i = 0; i < 6; i++) {
        if(i >= octaves) break;
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

float fbm3(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 5; i++) {
        value += amplitude * noise(p.xy + p.z * 0.3);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

float stars(vec2 uv, float brightness) {
    vec2 grid = floor(uv * 180.0);
    vec2 pos = fract(uv * 180.0);
    
    float result = 0.0;
    for(int x = -1; x <= 1; x++) {
        for(int y = -1; y <= 1; y++) {
            vec2 cell = grid + vec2(float(x), float(y));
            float h = hash(cell);
            if(h > 1.0 - STAR_DENSITY) {
                vec2 starPos = vec2(h, hash(cell + vec2(100.0, 0.0)));
                vec2 diff = pos - starPos - vec2(float(x), float(y));
                float dist = length(diff);
                float twinkle = 0.7 + 0.3 * sin(u_time * 3.0 + h * TAU);
                float starSize = 0.002 + h * 0.006;
                float intensity = smoothstep(starSize, 0.0, dist) * brightness * twinkle;
                float hue = hash(cell + vec2(200.0, 0.0));
                result += intensity;
            }
        }
    }
    return result;
}

float nebulaLayer(vec2 uv, float layer, float time) {
    vec2 p = uv * (2.0 + layer * 0.5);
    float slowTime = time * 0.1;
    
    vec3 q = vec3(fbm(p + slowTime, 5),
                  fbm(p + vec2(5.2, 1.3) + slowTime * 0.8, 5),
                  fbm(p + vec2(1.7, 8.9) + slowTime * 0.6, 5));
    
    vec2 r = vec2(fbm3(vec3(p, layer + slowTime)),
                  fbm3(vec3(p + q, layer + slowTime * 1.3)));
    
    float f = fbm3(vec3(p + r * 2.0, layer * 0.5 + slowTime * 0.4));
    
    f = pow(f, 1.2);
    
    float warp = fbm(uv * 3.0 + time * 0.05, 4);
    f += warp * 0.15;
    
    return clamp(f, 0.0, 1.0);
}

vec3 nebulaColor(float f, float layer) {
    float phase = f * PI + layer * 0.5;
    
    vec3 color1 = vec3(0.1, 0.0, 0.2);
    vec3 color2 = vec3(0.5, 0.1, 0.4);
    vec3 color3 = vec3(0.9, 0.3, 0.5);
    vec3 color4 = vec3(0.1, 0.3, 0.8);
    vec3 color5 = vec3(0.9, 0.6, 0.3);
    
    vec3 col = mix(color1, color2, sin(phase * 1.0) * 0.5 + 0.5);
    col = mix(col, color3, sin(phase * 2.3) * 0.5 + 0.5);
    col = mix(col, color4, sin(phase * 0.7) * 0.5 + 0.5);
    col = mix(col, color5, sin(phase * 3.1) * 0.5 + 0.5);
    
    return col;
}

vec3 deepSpaceBackground(vec2 uv) {
    vec3 bg = vec3(0.0, 0.01, 0.03);
    
    float dist = length(uv - 0.5);
    float gradient = smoothstep(0.8, 0.0, dist);
    bg += vec3(0.02, 0.01, 0.05) * gradient;
    
    return bg;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 centeredUV = uv - 0.5;
    centeredUV.x *= u_resolution.x / u_resolution.y;
    
    float time = u_time * 0.15;
    
    float nebula = 0.0;
    vec3 nebulaCol = vec3(0.0);
    
    for(int i = 0; i < NEBULA_LAYERS; i++) {
        float layer = float(i);
        float layerNebula = nebulaLayer(centeredUV, layer, time + layer * 2.0);
        
        vec3 col = nebulaColor(layerNebula, layer);
        float alpha = 0.7 - layer * 0.1;
        
        float depthFade = 1.0 - layer * 0.15;
        nebulaCol += col * layerNebula * alpha * depthFade;
        nebula += layerNebula * alpha;
    }
    
    vec3 bg = deepSpaceBackground(uv);
    
    float starBrightness = 1.0 - smoothstep(0.0, 0.7, length(centeredUV));
    float s = stars(centeredUV, starBrightness);
    
    float dustNoise = fbm(centeredUV * 8.0 + time * 0.02, 4);
    vec3 cosmicDust = vec3(0.05, 0.02, 0.08) * dustNoise * 0.5;
    
    float brightStars = stars(centeredUV * 1.5, starBrightness * 0.6);
    float shootingStars = 0.0;
    
    float angle = atan(centeredUV.y, centeredUV.x);
    float radius = length(centeredUV);
    
    for(int i = 0; i < 3; i++) {
        float seed = float(i) * 123.456;
        float t = mod(time * 0.3 + hash(vec2(seed)) * 10.0, 10.0);
        float startAngle = hash(vec2(seed + 1.0)) * TAU;
        float startRadius = 0.3 + hash(vec2(seed + 2.0)) * 0.4;
        
        float currentAngle = startAngle + t * 0.5;
        float currentRadius = startRadius - t * 0.1;
        
        if(currentRadius > 0.0 && currentRadius < 0.6) {
            vec2 starPos = vec2(cos(currentAngle), sin(currentAngle)) * currentRadius;
            float d = length(centeredUV - starPos);
            float streak = smoothstep(0.02, 0.0, d) * smoothstep(2.0, 0.0, t) * 0.4;
            shootingStars += streak;
        }
    }
    
    vec3 finalColor = bg;
    
    if(nebula > 0.1) {
        vec3 normalizedNebula = nebulaCol / max(nebula, 0.001);
        finalColor = mix(finalColor, normalizedNebula, min(nebula * 0.8, 1.0));
    }
    
    finalColor += vec3(s) * vec3(0.9, 0.95, 1.0);
    finalColor += vec3(brightStars) * vec3(1.0, 0.95, 0.9);
    finalColor += cosmicDust;
    finalColor += vec3(shootingStars) * vec3(1.0, 0.98, 0.9);
    
    float vignette = 1.0 - length(centeredUV) * 0.8;
    vignette = pow(vignette, 1.5);
    finalColor *= vignette;
    
    float exposure = 1.2;
    finalColor = 1.0 - exp(-finalColor * exposure);
    
    finalColor = pow(finalColor, vec3(0.9));
    
    gl_FragColor = vec4(finalColor, 1.0);
}