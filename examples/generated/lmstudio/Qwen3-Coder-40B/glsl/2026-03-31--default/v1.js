precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265358979323846

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
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(PI * (c * t + d));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 mouseUV = u_mouse;
    float mx = (mouseUV.x - 0.5) * 1.5;
    float my = -(mouseUV.y - 0.5) * 1.5;
    
    vec3 color = vec3(0.0);
    float t = u_time * 0.75;
    
    vec2 centerOffset = uv - vec2(mx, my);
    float dist = length(centerOffset);
    
    for (int i = 0; i < 4; i++) {
        float phase1 = fbm(uv * 1.8 + t * 0.6) - 0.5;
        float phase2 = fbm(uv * 1.3 - t * 0.4) - 0.5;
        float wave1 = sin(dot(uv, vec2(1.0, 1.5)) + phase1 * 2.0 + t);
        float wave2 = sin(dot(uv, vec2(-1.2, 0.8)) + phase2 * 2.0 - t * 0.7);
        float wave3 = cos(dist * 2.5 - t * 1.2) * 0.6;
        
        uv.x += wave1 * 0.15;
        uv.y += wave2 * 0.15;
        
        float mixVal = (wave1 + wave2 + wave3) / 3.0 + 0.5;
        
        vec3 colA = vec3(0.3, 0.6, 1.0);
        vec3 colB = vec3(1.0, 0.2, 0.7);
        vec3 colC = vec3(0.9, 0.8, 0.4);
        vec3 colD = vec3(0.1, 0.5, 0.9);
        
        float p = mixVal;
        color += palette(p, colA, colB, colC, colD) * (0.6 / float(i + 1));
    }
    
    color /= 4.0;
    
    vec3 finalColor = clamp(color, 0.0, 1.0);
    
    finalColor.r += 0.05 * sin(u_time * 2.0 + uv.x * 5.0) * exp(-length(uv) * 1.5);
    finalColor.g += 0.03 * cos(u_time * 1.7 - uv.y * 4.0) * exp(-length(uv) * 1.8);
    
    gl_FragColor = vec4(finalColor, 1.0);
}