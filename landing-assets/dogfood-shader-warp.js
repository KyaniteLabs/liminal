precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265359

vec3 hash3(vec2 p) {
    vec3 q = vec3(dot(p, vec2(127.1, 311.7)),
                  dot(p, vec2(269.5, 183.3)),
                  dot(p, vec2(419.2, 371.9)));
    return fract(sin(q) * 43758.5453);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float f = 0.0;
    float w = 0.5;
    for (int i = 0; i < 5; i++) {
        f += w * noise(p);
        p *= 2.0;
        w *= 0.5;
    }
    return f;
}

float domainWarp(vec2 p, float t) {
    vec2 q = vec2(fbm(p + vec2(0.0, 0.0)),
                  fbm(p + vec2(5.2, 1.3)));

    vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t),
                  fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.126 * t));

    return fbm(p + 4.0 * r);
}

float turbulence(vec2 p, float t) {
    float w = 1.0;
    float sum = 0.0;
    for (int i = 0; i < 4; i++) {
        sum += w * abs(noise(p - t * 0.1));
        p *= 2.0;
        w *= 0.5;
    }
    return sum;
}

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(2.0 * PI * (c * t + d));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 mouse = u_mouse - 0.5;

    float t = u_time * 0.3;

    vec2 p = uv * 3.0;
    p += vec2(sin(t * 0.5), cos(t * 0.3)) * 0.2;

    float w1 = domainWarp(p, t);
    float w2 = domainWarp(p * 1.5 + vec2(10.0), t * 0.7);
    float w3 = turbulence(p * 2.0, t);

    float final = w1 * 0.5 + w2 * 0.3 + w3 * 0.2;
    final = smoothstep(0.1, 0.9, final);

    vec3 color1 = palette(final + t * 0.1,
        vec3(0.5, 0.5, 0.5),
        vec3(0.5, 0.5, 0.5),
        vec3(1.0, 1.0, 0.5),
        vec3(0.8, 0.9, 0.3));

    vec3 color2 = palette(final * 2.0 - t * 0.15,
        vec3(0.5, 0.5, 0.5),
        vec3(0.5, 0.5, 0.5),
        vec3(2.0, 1.0, 0.0),
        vec3(0.2, 0.4, 0.6));

    vec3 color3 = palette(length(uv) + t * 0.2,
        vec3(0.8, 0.5, 0.4),
        vec3(0.2, 0.4, 0.2),
        vec3(2.0, 1.0, 1.0),
        vec3(0.0, 0.25, 0.25));

    vec3 finalColor = mix(color1, color2, sin(final * PI + t) * 0.5 + 0.5);
    finalColor = mix(finalColor, color3, w3 * 0.4);

    float edge = fwidth(final) * 2.0;
    float highlight = smoothstep(0.6 - edge, 0.6 + edge, final);
    finalColor += highlight * vec3(0.3, 0.4, 0.5);

    float vignette = 1.0 - dot(uv, uv) * 0.5;
    finalColor *= vignette;

    float mouseInfluence = length(mouse) * 0.3;
    finalColor *= 1.0 + mouseInfluence * sin(final * 10.0 + t);

    finalColor = pow(finalColor, vec3(0.9));
    finalColor *= 1.2;

    gl_FragColor = vec4(finalColor, 1.0);
}