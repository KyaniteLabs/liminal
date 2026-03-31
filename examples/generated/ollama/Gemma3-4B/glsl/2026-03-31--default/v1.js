precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265358979323846

#define NOISE_SCALE 100.0

float valueNoise(vec2 uv) {
    float x = uv.x * NOISE_SCALE;
    float y = uv.y * NOISE_SCALE;
    return sin(dot(vec2(x, y), vec2(12.9898, 78.233)]);
}

void main() {
    vec2 uv = u_mouse * vec2(u_time, u_time) + vec2(0.5, 0.5);
    uv += vec2(valueNoise(uv * 32.0), valueNoise(uv * 64.0));

    float amplitude = 0.5 + 0.5 * sin(uv.x * PI + u_time * 2.0);
    float frequency = 2.0 + 0.5 * sin(uv.y * PI + u_time * 4.0);
    float speed = 0.2;

    vec3 color = vec3(0.0);

    for (int i = 0; i < 20; i++) {
        float phase = float(i) * speed;
        color += vec3(amplitude * 0.5 + 0.5, amplitude * 0.5 + 0.5, amplitude * 0.5 + 0.5) * cos(uv.x * frequency + phase);
    }

    gl_FragColor = vec4(color, 1.0);
}