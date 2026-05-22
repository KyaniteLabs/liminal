precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / u_resolution.xy;

    float v1 = sin(uv.x * 10.0 + u_time);
    float v2 = sin(10.0 * (uv.x * sin(u_time / 2.0) + uv.y * cos(u_time / 3.0)) + u_time);
    float cx = uv.x + 0.5 * sin(u_time / 5.0);
    float cy = uv.y + 0.5 * cos(u_time / 3.0);
    float v3 = sin(sqrt(100.0 * ((cx - 0.5) * (cx - 0.5) + (cy - 0.5) * (cy - 0.5))) + u_time);

    float v = v1 + v2 + v3;

    vec3 col = vec3(
        sin(v * 3.14159),
        sin(v * 3.14159 + 2.094),
        sin(v * 3.14159 + 4.188)
    );
    col = 0.5 + 0.5 * col;

    fragColor = vec4(col, 1.0);
}

void main() {
    mainImage(gl_FragCoord, gl_FragCoord);
}
