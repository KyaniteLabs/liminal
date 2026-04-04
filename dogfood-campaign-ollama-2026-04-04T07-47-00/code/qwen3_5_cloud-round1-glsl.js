precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
in vec2 v_uv;
out vec4 fragColor;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
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

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(6.28318 * (c * t + d));
}

void main() {
    vec2 uv = v_uv;
    uv = (uv - 0.5) * 2.0;
    uv.x *= u_resolution.x / u_resolution.y;

    float t = u_time * 0.5;

    float v = 0.0;
    v += sin(uv.x * 4.0 + t);
    v += sin(uv.y * 4.0 + t);
    v += sin((uv.x + uv.y) * 4.0 + t);
    v += sin(sqrt(uv.x * uv.x + uv.y * uv.y) * 4.0 + t);
    v += noise(uv * 3.0 + t * 0.2) * 0.5;

    v = v * 0.125 + 0.5;
    vec3 color = palette(v + t * 0.1);

    fragColor = vec4(color, 1.0);
}