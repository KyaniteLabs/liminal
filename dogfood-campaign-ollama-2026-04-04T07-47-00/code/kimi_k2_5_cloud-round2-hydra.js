// --- CORE GENERATORS ---
    Input_Time: { source: time, range: [0, 1] };
    Input_Pos: { source: coordinates, range: [0, 1] };
    Noise_Seed: { source: noise(frequency: 0.5, octave: 2) };

    // 1. GEOMETRIC PATTERN CORE (Sine/Cosine Field)
        type: sin_field,
        inputs: [Input_Time, Input_Pos],
        scale: 10.0 + (Input_Time * 5.0),
        offsets: [0.0, 0.5],
    };

        type: cos_field,
        inputs: [Input_Time * 0.8, Input_Pos * 1.2],
        scale: 8.0,
        offsets: [0.1, 0.3],
    };

    // 2. COLOR SHIFTING (HSV Mapping)
        inputs: [Input_Time, Noise_Seed, gradient_map, ripple_map],
        // Map time and noise to Hue (H)
        H: rem(Input_Time * 1.5 + Noise_Seed * 0.5, 1.0),
        // Map position/patterns to Saturation (S)
        S: smooth(gradient_map + ripple_map, 0.5),
        // Map time/patterns to Value/Brightness (V)
        V: sin(Input_Time * 2.0 + Input_Pos * 2.0) * 0.5 + 0.5,
    };

    // 3. FEEDBACK LOOP & TEXTURE APPLICATION
    // Initial Output takes the generated color and geometry
        inputs: [hsv_color, gradient_map, ripple_map],
        type: combine_visual,
        blend: multiply,
    };

    // Feedback Mechanism: Process the previous frame's output
        input: primary_frame,
        delay: 0.1, // Short delay for ghosting/trail effect
    };

    // Final Synthesis: Combine current frame with delayed feedback
        inputs: [primary_frame, residual_frame],
        type: blend,
        mode: screen, // Additive blending enhances 'synth' feel
        blend_factor: 0.8,
    };

    // --- CONNECTION FLOW ---
    connect(Input_Time -> Pattern_A.inputs[0]);
    connect(Input_Pos -> Pattern_A.inputs[1]);
    connect(Input_Time -> Pattern_B.inputs[0]);
    connect(Input_Pos -> Pattern_B.inputs[1]);

    connect(Input_Time -> Color_Shift.inputs[0]);
    connect(Noise_Seed -> Color_Shift.inputs[1]);
    connect(gradient_map -> Color_Shift.inputs[2]);
    connect(ripple_map -> Color_Shift.inputs[3]);

    connect(hsv_color -> Initial_Texture.inputs[0]);
    connect(gradient_map -> Initial_Texture.inputs[1]);
    connect(ripple_map -> Initial_Texture.inputs[2]);

    connect(Initial_Texture.output -> Feedback_Sample.input);
    connect(Feedback_Sample.output -> Final_Output.inputs[1]);
    connect(Initial_Texture.output -> Final_Output.inputs[0]);

    // --- RENDER SETTINGS ---
    render {
        resolution: 1920x1080;
        frame_rate: 30;
        duration: 10;
        output_target: final_video;
.out(o0)