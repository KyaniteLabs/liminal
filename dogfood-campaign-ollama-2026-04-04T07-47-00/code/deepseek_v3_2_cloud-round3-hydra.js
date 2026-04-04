// Hydra Video Synth Patch: Feedback Kaleidoscope
// Parameters: 
//   t: Time
//   frame: Current frame count
//   uv: Normalized coordinates (0 to 1)

// --- Constants ---
const float PI = 3.1415926535;
const float FEEDBACK_RATE = 0.98;
const float SHIFT_SPEED = 0.005;

// --- Feedback Loop State ---
// Use a global/mutable variable to store the previous frame's primary offset
float prev_offset = 0.0;

// --- Core Pattern Function (Geometric/Noise) ---
float geometric_pattern(float x, float y, float time) {
    // Combine multiple oscillating patterns for complexity
    float a = sin(x * 3.5 + time * 0.5) * 0.5;
    float b = cos(y * 2.8 + time * 0.7) * 0.5;
    float c = sin((x + y) * 1.2 + time * 0.3) * 0.5;
    
    // Use distance calculation for a central effect
    float dist = length(vec2(x, y));
    
    // Combine and scale the patterns
    return (a + b + c) * 0.8 + sin(dist * 5.0 + time * 1.5) * 0.2;

// --- Color Shifting & Feedback Integration ---
vec3 color_shift_and_feedback(float x, float y, float time, float feedback_factor) {
    // 1. Calculate the base geometric pattern
    float pattern_val = geometric_pattern(x, y, time);
    
    // 2. Apply feedback influence
    // The feedback_factor modifies the pattern, causing echoes/trails
    float feedback_influence = pattern_val * feedback_factor * 0.5;
    float final_val = pattern_val + feedback_influence;

    // 3. Normalize and scale for visual intensity (Contrast Boost)
    float intensity = abs(sin(final_val * 3.0));
    intensity = pow(intensity, 1.5); // Exponential contrast boost

    // 4. Color Shifting (Hue based on position and time)
    // Map the base pattern value to Hue (0 to 1)
    float hue = (final_val * 0.5 + time * 0.1) % 1.0;
    
    // Use the intensity to drive saturation/brightness
    float saturation = 0.8 + intensity * 0.2;
    float brightness = 0.8 + intensity * 0.2;
    
    // Convert HSL to RGB (simplified color mapping)
    // HSL(h, s, b) -> RGB
    float r = abs(sin(hue * 6.0 + 0.0) * 0.5 + 0.5);
    float g = abs(sin(hue * 6.0 + 2.0) * 0.5 + 0.5);
    float b_color = abs(sin(hue * 6.0 + 4.0) * 0.5 + 0.5);
    
    // Apply the calculated intensity/saturation/brightness multipliers
    vec3 color = vec3(r, g, b_color) * saturation * brightness;

    return color;


// --- Main Render Loop ---
vec4 render(float t, float frame, vec2 uv) {
    // 1. Calculate the feedback factor based on the previous frame's state
    // This creates the memory/echo effect
    float current_feedback = prev_offset * FEEDBACK_RATE + 0.1;
    
    // 2. Generate the color and geometric output
    vec3 color_output = color_shift_and_feedback(uv.x, uv.y, t, current_feedback);
    
    // 3. Update the feedback state for the next frame
    // Store a modified version of the current output/pattern for the next iteration
    prev_offset = sin(color_output.r * 0.5 + t * 0.2) * 0.5;

    // 4. Final Output Mapping (Potential Vignette/Post-Process)
    float center_glow = 1.0 - length(uv - vec2(0.5));
    center_glow = pow(center_glow, 0.5); // Softening the glow
    
    vec3 final_color = color_output * center_glow;

    return vec4(final_color, 1.0);