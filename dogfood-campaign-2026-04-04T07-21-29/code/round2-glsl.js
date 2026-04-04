#version 300 es
precision highp float;

uniform float iTime;
uniform vec2  iResolution;

out vec4 fragColor;

/* ---------- noise utilities ---------- */

float hash(vec2 p){
    return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123);
}

float valueNoise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0,0.0));
    float c = hash(i + vec2(0.0,1.0));
    float d = hash(i + vec2(1.0,1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}

float fbm(vec2 p){
    float v = 0.0;
    float a = 0.5;
    for(int i=0;i<5;i++){
        v += a * valueNoise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

/* ---------- color palette ---------- */

vec3 palette(float t){
    // cosine based smooth hue rotation
    return vec3(0.5) + 0.5 * cos(6.28318*(vec3(1.0)*t + vec3(0.0,0.33,0.67)));
}

/* ---------- main plasma shader ---------- */

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    // normalize coordinates
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime * 0.5;

    // classic plasma terms
    float plasma  = sin(10.0 * uv.x + t);
    plasma       += sin(10.0 * (uv.x * uv.y) + t);
    plasma       += sin(sqrt(50.0 * dot(uv, uv)) + t);
    plasma       += sin(length(uv + vec2(sin(t), cos(t))) * 10.0);

    // animated noise layer
    float n = fbm(uv * 3.0 + t);

    // combine plasma + noise
    float pattern = plasma * 0.5 + n;

    // map to color (hue shifted over time)
    float hue = fract(pattern * 0.2 + t * 0.1);
    vec3 color = palette(hue);

    fragColor = vec4(color, 1.0);
}