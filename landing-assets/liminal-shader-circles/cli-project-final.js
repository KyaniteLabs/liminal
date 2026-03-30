<think>
The user wants a GLSL fragment shader with concentric circles and color gradients. Let me create a visually appealing shader that:

1. Uses concentric circles as the main visual element
2. Incorporates color gradients that animate over time
3. Uses proper uniforms (u_resolution, u_time, u_mouse)
4. Is optimized for performance
5. Has smooth animation

Let me design something creative:

- Create concentric circles emanating from the center
- Add color gradients that shift over time
- Maybe add some pulsing/breathing effect
- Use sin/cos for smooth oscillations
- Add some noise or variation for organic feel

I'll use distance from center to create the circles, and use the circle index to vary colors through a gradient palette.
</think>

precision highp float;

#define PI 3.14159265359
#define CIRCLE_COUNT 12.0

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 center = vec2(0.0);
    
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);
    
    float circleRadius = dist * CIRCLE_COUNT;
    float circleIndex = floor(circleRadius);
    float circleFraction = fract(circleRadius);
    
    float smoothCircle = smoothstep(0.0, 0.1, circleFraction) * smoothstep(1.0, 0.9, circleFraction);
    
    float wave = sin(dist * 20.0 - u_time * 2.0) * 0.5 + 0.5;
    float pulse = sin(u_time * 1.5 + circleIndex * 0.5) * 0.5 + 0.5;
    
    float hue = fract(circleIndex / CIRCLE_COUNT + u_time * 0.1 + angle / (2.0 * PI) * 0.3);
    float saturation = 0.6 + 0.4 * sin(dist * 10.0 + u_time);
    float brightness = 0.4 + 0.6 * smoothCircle * pulse;
    
    vec3 color = hsv2rgb(vec3(hue, saturation, brightness));
    
    float innerGlow = smoothstep(0.8, 0.0, dist);
    float outerGlow = exp(-dist * 2.0);
    
    vec3 gradient1 = vec3(0.2, 0.4, 0.8);
    vec3 gradient2 = vec3(0.8, 0.3, 0.6);
    vec3 gradient3 = vec3(0.9, 0.7, 0.2);
    
    float t1 = sin(u_time * 0.8) * 0.5 + 0.5;
    float t2 = sin(u_time * 1.2 + 2.0) * 0.5 + 0.5;
    
    vec3 bgColor = mix(gradient1, gradient2, t1);
    bgColor = mix(bgColor, gradient3, t2 * 0.5);
    
    color = mix(bgColor * 0.3, color, smoothCircle * 0.8 + 0.2);
    color += vec3(0.1, 0.15, 0.2) * innerGlow;
    color += vec3(0.05, 0.08, 0.12) * outerGlow;
    
    float noise = random(uv + u_time * 0.01) * 0.03;
    color += noise;
    
    color = pow(color, vec3(0.9));
    
    gl_FragColor = vec4(color, 1.0);
}