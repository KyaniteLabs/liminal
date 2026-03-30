precision highp float;

#define MAX_STEPS 100
#define MAX_DIST 150.0
#define SURF_DIST 0.001
#define PI 3.14159265359

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

mat2 rot2D(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float hash(float n) {
    return fract(sin(n) * 43758.5453);
}

float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n = i.x + i.y * 157.0 + 113.0 * i.z;
    return mix(
        mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
            mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),
        mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
            mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y), f.z);
}

float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash2(i);
    float b = hash2(i + vec2(1.0, 0.0));
    float c = hash2(i + vec2(0.0, 1.0));
    float d = hash2(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for(int i = 0; i < 6; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

float fbm2D(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for(int i = 0; i < 6; i++) {
        value += amplitude * noise2D(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

float terrain(vec2 p) {
    float h = 0.0;
    float amp = 1.0;
    float freq = 0.003;
    
    for(int i = 0; i < 7; i++) {
        h += fbm2D(p * freq + vec2(100.0)) * amp;
        amp *= 0.4;
        freq *= 2.3;
    }
    
    h = pow(h, 1.5) * 25.0;
    
    float detail = fbm2D(p * 0.01) * 3.0;
    h += detail;
    
    return h;
}

float mapTerrain(vec3 p) {
    float h = terrain(p.xz);
    return p.y - h;
}

float map(vec3 p) {
    float terrainDist = mapTerrain(p);
    
    vec3 fp = fract(p * 0.5);
    float rocks = sin(fp.x * 10.0) * sin(fp.y * 10.0) * sin(fp.z * 10.0) * 0.5 + 0.5;
    rocks = smoothstep(0.4, 0.6, rocks) * 0.3;
    
    return terrainDist - rocks;
}

float rayMarch(vec3 ro, vec3 rd) {
    float d = 0.0;
    
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * d;
        float ds = map(p);
        d += ds * 0.7;
        if(ds < SURF_DIST || d > MAX_DIST) break;
    }
    
    return d;
}

float rayMarchDetail(vec3 ro, vec3 rd, float maxD) {
    float d = 0.0;
    
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * d;
        float ds = map(p);
        d += ds * 0.5;
        if(ds < SURF_DIST * 0.1 || d > maxD) break;
    }
    
    return d;
}

vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.01, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    
    for(int i = 0; i < 32; i++) {
        float h = map(ro + rd * t);
        res = min(res, k * h / t);
        t += clamp(h, 0.1, 1.0);
        if(h < 0.001 || t > maxt) break;
    }
    
    return clamp(res, 0.0, 1.0);
}

float ambientOcclusion(vec3 p, vec3 n) {
    float occ = 0.0;
    float weight = 1.0;
    
    for(int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i);
        float d = map(p + h * n);
        occ += (h - d) * weight;
        weight *= 0.95;
    }
    
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

float volumetricFog(vec3 ro, vec3 rd, float maxDist, float terrainHeight) {
    float fog = 0.0;
    float stepSize = maxDist / 32.0;
    
    for(int i = 0; i < 32; i++) {
        float t = stepSize * float(i);
        vec3 p = ro + rd * t;
        
        float heightFactor = exp(-max(p.y - terrainHeight * 0.5, 0.0) * 0.08);
        heightFactor *= smoothstep(terrainHeight * 0.3, terrainHeight * 0.8, p.y);
        
        float density = 0.02 * heightFactor;
        
        float turbulence = fbm(p * 0.1 + u_time * 0.05);
        density *= 0.5 + turbulence * 0.5;
        
        float lightDist = length(p - vec3(50.0, 80.0, 50.0));
        float lightIntensity = exp(-lightDist * 0.01);
        
        fog += density * stepSize * lightIntensity;
    }
    
    return fog;
}

vec3 applyFog(vec3 col, float dist, vec3 rd, vec3 sunDir, vec3 fogColor) {
    float fogAmount = 1.0 - exp(-dist * 0.015);
    float sunAmount = pow(max(dot(rd, sunDir), 0.0), 8.0);
    
    vec3 finalFog = fogColor + vec3(1.0, 0.9, 0.7) * sunAmount * 0.3;
    
    return mix(col, finalFog, fogAmount);
}

vec3 getSkyColor(vec3 rd, vec3 sunDir) {
    float sun = max(dot(rd, sunDir), 0.0);
    vec3 sky = mix(vec3(0.6, 0.75, 0.9), vec3(0.3, 0.5, 0.8), rd.y * 0.5 + 0.5);
    sky += vec3(1.0, 0.8, 0.4) * pow(sun, 32.0) * 0.5;
    sky += vec3(1.0, 0.9, 0.7) * pow(sun, 256.0);
    
    return sky;
}

vec3 getTerrainColor(vec3 p, vec3 n, vec3 lightDir, vec3 viewDir) {
    float slope = 1.0 - n.y;
    
    vec3 grassColor = vec3(0.15, 0.35, 0.12);
    vec3 dirtColor = vec3(0.4, 0.3, 0.2);
    vec3 rockColor = vec3(0.4, 0.38, 0.35);
    vec3 snowColor = vec3(0.95, 0.97, 1.0);
    
    float grassNoise = fbm(p * 0.1);
    float detailNoise = fbm(p * 0.5);
    
    float grassAmount = smoothstep(0.4, 0.7, n.y) * smoothstep(15.0, 8.0, p.y);
    grassAmount *= grassNoise * 0.5 + 0.5;
    
    float dirtAmount = smoothstep(0.3, 0.5, slope) * (1.0 - smoothstep(10.0, 15.0, p.y));
    dirtAmount *= (1.0 - grassAmount);
    
    float rockAmount = smoothstep(0.5, 0.8, slope);
    rockAmount += smoothstep(20.0, 25.0, p.y) * 0.5;
    rockAmount = min(rockAmount, 1.0 - grassAmount - dirtAmount * 0.5);
    
    float snowAmount = smoothstep(18.0, 22.0, p.y) * smoothstep(0.7, 0.9, n.y);
    snowAmount *= detailNoise * 0.3 + 0.7;
    
    vec3 col = grassColor * grassAmount;
    col += dirtColor * dirtAmount;
    col += rockColor * rockAmount;
    col += snowColor * snowAmount;
    
    col *= detailNoise * 0.3 + 0.7;
    
    return col;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    
    float time = u_time * 0.1;
    
    float camHeight = 25.0 + sin(time * 0.3) * 5.0;
    float camDist = 40.0 + sin(time * 0.2) * 10.0;
    
    vec3 ro = vec3(camDist * sin(time), camHeight, camDist * cos(time));
    vec3 target = vec3(0.0, 10.0, 0.0);
    
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    
    vec3 rd = normalize(forward + uv.x * right + uv.y * up);
    
    vec3 sunDir = normalize(vec3(0.8, 0.6, 0.3));
    vec3 sunColor = vec3(1.0, 0.95, 0.8);
    
    float d = rayMarch(ro, rd);
    
    vec3 col = vec3(0.0);
    
    if(d < MAX_DIST) {
        vec3 p = ro + rd * d;
        vec3 n = getNormal(p);
        
        vec3 terrainCol = getTerrainColor(p, n, sunDir, -rd);
        
        float diff = max(dot(n, sunDir), 0.0);
        float sky = max(dot(n, vec3(0.0, 1.0, 0.0)), 0.0);
        
        float shadow = softShadow(p + n * 0.1, sunDir, 0.1, 50.0, 16.0);
        shadow = mix(shadow, 1.0, 0.3);
        
        float ao = ambientOcclusion(p, n);
        
        vec3 h = normalize(sunDir - rd);
        float spec = pow(max(dot(n, h), 0.0), 32.0);
        
        vec3 light = vec3(0.0);
        light += sunColor * diff * shadow;
        light += vec3(0.4, 0.5, 0.7) * sky * 0.3 * ao;
        light += vec3(0.1, 0.15, 0.2) * ao;
        
        col = terrainCol * light;
        col += sunColor * spec * shadow * 0.3;
        
        float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
        col += vec3(0.1, 0.15, 0.2) * fresnel * 0.2;
        
    } else {
        col = getSkyColor(rd, sunDir);
    }
    
    float terrainH = terrain(ro.xz);
    float fogDensity = volumetricFog(ro, rd, min(d, MAX_DIST), terrainH);
    fogDensity = clamp(fogDensity, 0.0, 1.0);
    
    vec3 fogColor = mix(vec3(0.7, 0.8, 0.95), vec3(0.9, 0.85, 0.8), fogDensity);
    col = applyFog(col, d, rd, sunDir, fogColor);
    
    float sunGlow = pow(max(dot(rd, sunDir), 0.0), 2.0);
    col += vec3(1.0, 0.8, 0.5) * sunGlow * 0.2 * fogDensity;
    
    col = pow(col, vec3(0.4545));
    
    col *= 1.0 - 0.5 * pow(length(uv * 0.7), 2.0);
    
    col = clamp(col, 0.0, 1.0);
    
    gl_FragColor = vec4(col, 1.0);
}