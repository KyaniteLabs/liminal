precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / u_resolution.xy;

    float v1 = sin(uv.x * 10.0 + u_time);
    float v2 = sin(10.0 * (uv.x * sin(u_time / 2.0) + uv.y * cos(u_time / 3.0)) + u_time);
    float c1 = sin(sqrt(100.0 * ((uv.x - 0.5) * (uv.x - 0.5) + (uv.y - 0.5) * (uv.y - 0.5))) + u_time);

    float plasma = (v1 + v2 + c1) / 3.0;

    vec3 color = vec3(
        sin(plasma * 3.14159 + u_time) * 0.5 + 0.5,
        sin(plasma * 3.14159 + u_time + 2.094) * 0.5 + 0.5,
        sin(plasma * 3.14159 + u_time + 4.189) * 0.5 + 0.5
    );

    fragColor = vec4(color, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
