precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

// Reusable constants
#define MAX_STEPS 128

// Noise function definitions here, similar to provided examples...
float hash(vec2 p) { ... }
...

void main() {
    // Normalized mouse position for interaction (to be updated outside this shader)
    vec2 normalizedMouse = u_mouse;

    // Plasma parameters and time-based animations
    float plasmaColorShift = fract(sin(u_time + 0.5)) * 127;
    
    // Color transformation, combining noise with a vibrant palette over a shifting background
    float colorValue = (fbm(normalizedMouse) * 255.99 - 128.00);

    gl_FragColor = vec4(colorValue + plasmaColorShift, 
                  ((colorValue + plasmaColorShift) % 127), // Lighter shades of the same hue for saturation effect.
                  1.0); // Alpha channel is fully opaque
}