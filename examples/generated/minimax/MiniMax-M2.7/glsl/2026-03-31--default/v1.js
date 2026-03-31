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
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = rot * p * 2.0;
        a *= 0.5;
    }
    return v;
}

float turbulence(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * abs(noise(p) * 2.0 - 1.0);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(TAU * (c * t + d));
}

vec3 palette2(float t) {
    vec3 a = vec3(0.6, 0.4, 0.7);
    vec3 b = vec3(0.4, 0.6, 0.3);
    vec3 c = vec3(1.0, 0.8, 1.2);
    vec3 d = vec3(0.1, 0.5, 0.8);
    return a + b * cos(TAU * (c * t + d));
}

vec3 palette3(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(2.0, 3.0, 1.0);
    vec3 d = vec3(0.00, 0.33, 0.67);
    return a + b * cos(TAU * (c * t + d));
}

float plasma1(vec2 p, float time) {
    float v = 0.0;
    v += sin(p.x * 3.0 + time * 0.8);
    v += sin(p.y * 3.5 + time * 0.6);
    v += sin((p.x + p.y) * 2.5 + time * 1.2);
    float cx = p.x + sin(time * 0.3) * 2.0;
    float cy = p.y + cos(time * 0.4) * 2.0;
    v += sin(sqrt(cx * cx + cy * cy) * 4.0 + time * 1.5);
    v += sin(sqrt(cx * cx * 0.5 + cy * cy * 0.8) * 3.0 + time * 0.9);
    return v * 0.5;
}

float plasma2(vec2 p, float time) {
    float v = 0.0;
    float r = length(p);
    float angle = atan(p.y, p.x);
    v += sin(r * 8.0 - time * 2.0 + angle * 3.0);
    v += sin(r * 12.0 + time * 1.5 - angle * 2.0);
    v += cos(r * 6.0 + time * 0.8 + angle * 4.0);
    return v * 0.4;
}

float domainWarp(vec2 p, float time) {
    vec2 q = vec2(
        fbm(p + vec2(0.0, 0.0) + time * 0.1),
        fbm(p + vec2(5.2, 1.3) + time * 0.15)
    );
    vec2 r = vec2(
        fbm(p + 4.0 * q + vec2(1.7, 9.2) + time * 0.2),
        fbm(p + 4.0 * q + vec2(8.3, 2.8) + time * 0.25)
    );
    return fbm(p + 4.0 * r);
}

float electricPattern(vec2 p, float time) {
    float v = 0.0;
    vec2 grid = fract(p * 8.0) - 0.5;
    vec2 id = floor(p * 8.0);
    float cellHash = hash(id);
    float phase = cellHash * TAU + time * (1.0 + cellHash * 2.0);
    float connection = step(0.5, cellHash);
    float dist = length(grid);
    float ring = smoothstep(0.4, 0.45, dist) - smoothstep(0.45, 0.5, dist);
    float pulse = sin(dist * 20.0 - time * 5.0 + phase) * 0.5 + 0.5;
    v += ring * pulse * connection;
    vec2 neighborDist = vec2(
        hash(id + vec2(1.0, 0.0)),
        hash(id + vec2(0.0, 1.0))
    );
    float lineX = smoothstep(0.02, 0.0, abs(grid.x)) * step(0.6, neighborDist.x);
    float lineY = smoothstep(0.02, 0.0, abs(grid.y)) * step(0.6, neighborDist.y);
    v += (lineX + lineY) * 0.5;
    return v;
}

float voronoi(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash(i + neighbor) * vec2(1.0);
            point = 0.5 + 0.4 * sin(u_time * 0.5 + TAU * point);
            vec2 diff = neighbor + point - f;
            float dist = length(diff);
            minDist = min(minDist, dist);
        }
    }
    return minDist;
}

float crystalline(vec2 p, float time) {
    float v = voronoi(p * 3.0);
    float edges = smoothstep(0.0, 0.1, v) - smoothstep(0.1, 0.15, v);
    float innerGlow = smoothstep(0.3, 0.0, v);
    float pulse = sin(v * 30.0 - time * 2.0) * 0.5 + 0.5;
    return edges + innerGlow * pulse * 0.5;
}

void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 uv0 = uv;
    float time = u_time * 0.4;

    vec2 mouseInfluence = vec2(0.0);
    if (u_mouse.x > 0.0 || u_mouse.y > 0.0) {
        vec2 mouse = u_mouse * 2.0 - 1.0;
        vec2 delta = uv - mouse;
        float mouseDist = length(delta);
        mouseInfluence = delta / (mouseDist * mouseDist + 0.5) * 0.1;
    }

    float plasma1Val = plasma1(uv * 2.0 + mouseInfluence, time);
    float plasma2Val = plasma2(uv * 1.5 + mouseInfluence * 0.5, time * 1.3);

    vec2 warpedUV = uv + mouseInfluence;
    warpedUV += vec2(
        sin(uv.y * 4.0 + time) * 0.1,
        cos(uv.x * 3.0 + time * 0.7) * 0.1
    );
    float warpedFbm = domainWarp(warpedUV * 1.5, time);

    float fbm1 = fbm(uv * 2.0 + time * 0.2);
    float fbm2 = fbm(uv * 3.0 - time * 0.15 + 10.0);
    float fbm3 = fbm(uv * 1.5 + time * 0.1 + vec2(5.0, 8.0));

    float turb = turbulence(uv * 4.0 + time * 0.3);

    float electric = electricPattern(uv + vec2(time * 0.1), time);
    float crystal = crystalline(uv, time);

    float combined = 0.0;
    combined += plasma1Val * 0.3;
    combined += plasma2Val * 0.25;
    combined += warpedFbm * 0.4;
    combined += fbm1 * 0.2;
    combined += fbm2 * 0.15;
    combined += turb * 0.2;
    combined += electric * 0.15;
    combined += crystal * 0.1;

    float shimmer = sin(uv.x * 20.0 + time * 3.0) * sin(uv.y * 15.0 + time * 2.5);
    combined += shimmer * 0.05;

    float ripple = sin(length(uv) * 10.0 - time * 2.0);
    combined += ripple * 0.05;

    vec3 col1 = palette(combined * 0.8 + time * 0.1);
    vec3 col2 = palette2(combined * 0.6 + fbm1 * 0.4 + time * 0.05);
    vec3 col3 = palette3(combined * 0.4 + turb * 0.6 + time * 0.08);

    float colorMix = sin(time * 0.3) * 0.5 + 0.5;
    float colorMix2 = cos(time * 0.25) * 0.5 + 0.5;

    vec3 finalColor = mix(col1, col2, colorMix);
    finalColor = mix(finalColor, col3, colorMix2 * 0.5);

    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    vec3 saturated = mix(vec3(luminance), finalColor, 1.4);
    finalColor = saturated;

    float contrast = 1.2;
    finalColor = (finalColor - 0.5) * contrast + 0.5;

    float vignette = 1.0 - length(uv0) * 0.3;
    vignette = smoothstep(0.0, 1.0, vignette);
    finalColor *= vignette;

    float scanline = sin(uv0.y * 200.0) * 0.02;
    finalColor -= scanline;

    float noiseGrain = hash(uv0 * u_resolution + u_time) * 0.03;
    finalColor += noiseGrain;

    finalColor = clamp(finalColor, 0.0, 1.0);

    finalColor = pow(finalColor, vec3(0.95));

    gl_FragColor = vec4(finalColor, 1.0);
}