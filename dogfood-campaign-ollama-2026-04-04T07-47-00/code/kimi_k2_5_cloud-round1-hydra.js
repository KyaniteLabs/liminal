// Patch: Chromatic Echo Chamber
// Function: Generative Visual Feedback Engine
// Resolution: 1920x1080 @ 60fps

    INPUT: TIME_STREAM(t);
    OUTPUT: [FRAME_DATA];

    // 1. GEOMETRIC PATTERN ENGINE (Radial Sinusoidal Flow)
    FUNCTION generate_geometry(t, frame_id) {
        let radius = sin(t * 0.001) * 0.3 + 0.7;
        let angle_mod = cos(t * 0.0005) * 0.5 + 1.0;
        let points = [];

        for (let i = 0; i < 120; i++) {
            let r = radius * (1 + sin(i * 0.1 + t * 0.0001) * 0.1);
            let theta = (i / 120.0) * PI * 2 * angle_mod;

            // Apply a time-based distortion field
            let distortion_x = sin(r * 0.05 + t * 0.002) * 50;
            let distortion_y = cos(r * 0.05 + t * 0.002) * 50;

            points.push({
                x: Math.sin(theta) * r + distortion_x,
                y: Math.cos(theta) * r + distortion_y,
                size: Math.abs(sin(i * 0.1)) * 5 + 1
            });
        return points;

    // 2. COLOR SHIFTING MODULE (Hue Cycling based on Time and Geometry)
    FUNCTION shift_color(t, points) {
        let color_cycle = t * 0.0005; // Slow, constant hue shift
        let saturation_osc = sin(t * 0.001) * 0.5 + 0.5; // Pulse saturation
        let lightness_mod = Math.floor(sin(t * 0.0008) * 50 + 100); // Brightness pulsation

        let colors = [];
        for (let p of points) {
            // HSL(Hue, Saturation, Lightness)
            let H = (color_cycle + p.x * 0.0001) % 1.0;
            let S = 0.8 * saturation_osc;
            let L = lightness_mod * (p.size / 10);

            colors.push(`hsl(${H * 360}, ${S * 100}%, ${L}%)`);
        return colors;

    // 3. FEEDBACK LOOP (Echoing the previous frame's geometry)
    VAR previous_frame_data = [];
    FUNCTION apply_feedback(current_points, previous_points, decay_rate) {
        let feedback_points = [];

        if (previous_points.length === 0) return current_points;

        for (let i = 0; i < current_points.length; i++) {
            let current = current_points[i];
            let echo = previous_points[i];

            // Calculate the weighted average for the echo effect
            let new_x = current.x * (1 - decay_rate) + echo.x * decay_rate;
            let new_y = current.y * (1 - decay_rate) + echo.y * decay_rate;

            feedback_points.push({
                x: new_x,
                y: new_y,
                size: current.size * (1 - decay_rate * 0.1)
            });
        return feedback_points;

// --- PATCH EXECUTION FLOW ---
PROCESS(frame_id) {
    // Step 1: Generate base geometric structure
    let base_points = CORE_GENERATOR.generate_geometry(TIME_STREAM.t, frame_id);

    // Step 2: Apply feedback (Uses data from the previous frame)
    let feedback_points = CORE_GENERATOR.apply_feedback(
        base_points,
        CORE_GENERATOR.previous_frame_data,
        0.25 // Decay rate
    );

    // Step 3: Get final, modulated geometry
    let final_points = feedback_points;

    // Step 4: Colorize the result
    let final_colors = CORE_GENERATOR.shift_color(
        TIME_STREAM.t,
    );

    // Step 5: Update state and render
    CORE_GENERATOR.previous_frame_data = final_points;

    RENDER(final_points, final_colors, {
        BLEND_MODE: "SCREEN_ADD",
        STROKE_WIDTH: 1,
        GLOBAL_MODULATOR: 1.2 // Boost intensity
    });
.out(o0)