precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

#define PI 3.14159265359
#define MAX_STEPS 80
#define STEP_SIZE 0.05
#define COLOR_SPEED 2.0
#define ANIM_SPEED 1.5

// Simplex Noise implementation
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,-0.577350269189626,0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    return 42.0 * dot( m*m, permute(p) );
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv -= 0.5;
    
    // Adjust aspect ratio and mouse influence
    uv.x *= (u_resolution.y / u_resolution.x);
    vec2 mouseOffset = (u_mouse - 0.5) * 3.0;

    vec3 finalColor = vec3(0.0);
    float brightness = 1.0;

    for(int i = 0; i < MAX_STEPS; i++) {
        float t = float(i) / float(MAX_STEPS) + u_time * ANIM_SPEED * 0.2;
        
        vec2 p = uv + mouseOffset * (float(i)/40.0);
        p.y *= 1.5; // Stretch vertically
        
        // Layered noise for plasma effect
        float n1 = snoise(p * 3.0 - t);
        float n2 = snoise(p * 6.0 + t * 1.5);
        float n3 = snoise(p * 12.0 - t * 3.0);
        
        // Combine noise layers into a smooth value
        float noiseVal = (n1 * 0.5 + n2) * 0.7 + (n3 * 0.6 + 0.4) * 0.3;
        
        // Create the plasma core using sine waves and noise
        float val = sin(length(p) * 20.0 - t * COLOR_SPEED);
        val += n1 * 0.8;
        
        if(val > brightness) {
            brightness = val;
            
            // Color palette: Cyan -> Purple -> Magenta -> Yellow
            vec3 col1 = vec3(0.5, 0.8, 1.0); // Cyan
            vec3 col2 = vec3(0.6, 0.0, 0.8); // Purple
            vec3 col3 = vec3(1.0, 0.0, 0.7); // Magenta
            
            float alpha = smoothstep(brightness - 0.3, brightness + 0.2, val);
            
            finalColor += mix(col1, col2, sin(t * 2.0 + i) * 0.5 + 0.5) * alpha;
            finalColor += mix(col2, col3, cos(t * 3.0 + i) * 0.5 + 0.5) * alpha * 0.8;
        }
        
        if(brightness > 1.5) break; // Optimization: early exit for very bright areas
    }

    // Add some glow and vignette
    finalColor *= smoothstep(0.9, 0.2, length(uv));
    
    gl_FragColor = vec4(finalColor + brightness * 0.1, 1.0);
}