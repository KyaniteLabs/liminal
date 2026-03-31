precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for(int i = 0; i < 4; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(TAU * (c * t + d));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 p = uv * 3.0;
    
    float t = u_time * 0.5;
    
    float plasma = 0.0;
    
    plasma += sin(p.x * 3.0 + t * 1.2);
    plasma += sin(p.y * 2.5 + t * 0.8);
    plasma += sin((p.x + p.y) * 2.0 + t * 1.5);
    
    float cx = p.x + sin(t * 0.7) * 1.5;
    float cy = p.y + cos(t * 0.9) * 1.5;
    plasma += sin(sqrt(cx * cx + cy * cy) * 2.5 + t * 1.1);
    
    plasma += sin((p.x * 0.5 + t) * 2.0) * 0.5;
    plasma += sin((p.y * 0.5 - t * 1.3) * 2.0) * 0.5;
    
    float noiseVal = fbm(p * 1.5 + t * 0.3) * 1.5;
    plasma += noiseVal;
    
    float ripple = sin(length(p) * 4.0 - t * 2.0) * 0.3;
    plasma += ripple;
    
    plasma = plasma * 0.25 + 0.5;
    
    float colorShift = plasma + t * 0.1;
    vec3 col1 = palette(colorShift);
    vec3 col2 = palette(colorShift + 0.33);
    vec3 col3 = palette(colorShift + 0.66);
    
    vec3 finalColor;
    if(plasma < 0.33) {
        finalColor = mix(col1, col2, plasma * 3.0);
    } else if(plasma < 0.66) {
        finalColor = mix(col2, col3, (plasma - 0.33) * 3.0);
    } else {
        finalColor = mix(col3, col1, (plasma - 0.66) * 3.0);
    }
    
    float brightness = 0.7 + 0.3 * sin(plasma * TAU + t);
    finalColor *= brightness;
    
    float edge = smoothstep(1.5, 0.8, length(uv));
    finalColor *= edge;
    
    finalColor = pow(finalColor, vec3(0.9));
    
    gl_FragColor = vec4(finalColor, 1.0);
}