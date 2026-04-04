// Setup the audio context
const synth = new Tone.Sampler().toDestination(); // Using a container for the chain

// --- 1. EFFECT PROCESSING CHAIN ---

// Reverb: Creates the ambient space
const reverb = new Tone.Reverb({
    decay: 8,
    wet: 0.6,
    preDelay: 0.1
}).toDestination();

// Delay: Creates echo and sustain
const delay = new Tone.FeedbackDelay("8n", 3).connect(reverb);

// Connect the delay output to the reverb input
delay.connect(reverb);


// --- 2. OSCILLATOR SOURCES (The Drone) ---

// Define the base frequency and detuning parameters
const baseFreq = 440;
const oscillators = [
    new Tone.Oscillator({ frequency: `${baseFreq} Hz`, type: "sine" }).start(),
    new Tone.Oscillator({ frequency: `${baseFreq * 0.99} Hz`, type: "sine" }).start(), // Slight detune
    new Tone.Oscillator({ frequency: `${baseFreq * 1.01} Hz`, type: "sine" }).start()  // Slight detune
];

// Pan the oscillators for stereo width
oscillators[0].pan.value = -1;
oscillators[1].pan.value = 0;
oscillators[2].pan.value = 1;


// --- 3. MODULATION SOURCES (LFOs) ---

// LFO 1: Slow frequency drift (The 'wobble' or 'drift')
const lfoFreq = new Tone.LFO({
    frequency: "0.1", // Very slow change
    amplitude: 10, // Max frequency change of 10 Hz
    type: "sine"
}).start();

// LFO 2: Slow amplitude modulation (The 'breathing' effect)
const lfoAmp = new Tone.LFO({
    frequency: "0.5",
    amplitude: 0.1,
    type: "sine"
}).start();


// --- 4. CONNECTION AND MODULATION ---

// Connect all oscillators to the delay input
oscillators.forEach(osc => {
    osc.connect(delay);
});

// Apply LFO 1 (Frequency Drift) to all oscillators
oscillators.forEach(osc => {
    osc.frequency.sync('fxLFO'); // Sync frequency to LFO 1
    osc.frequency.value = baseFreq;
});

// Apply LFO 2 (Amplitude Modulation) to the gain of the whole system
// We use a simple Tone.Gain node to capture the signal before the delay/reverb
const gainNode = new Tone.Gain(1).connect(delay);
oscillators.forEach(osc => {
    osc.connect(gainNode);
});

// Modulate the gain node's gain using LFO 2
gainNode.gain.linearRampToValueAtTime(1.0, Tone.now());
gainNode.gain.sync('fxLFO');
gainNode.gain.value = 1.0;


// --- 5. PLAYBACK FUNCTION ---

function startDrone() {
    console.log("Ambient Drone Started.");
    // Start all components
    oscillators.forEach(osc => osc.start());
    
    // Set an envelope for a slow fade in
    gainNode.envelope.attack = 5;
    gainNode.envelope.release = 10;
    gainNode.triggerAttackRelease("8m", "8m"); // Simple trigger to demonstrate the setup
}

// To run the code, call this function after the DOM is loaded:
// startDrone();