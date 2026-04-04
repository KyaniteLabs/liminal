// Initialize the Tone context - required to start audio processing
await Tone.start();

// --- 1. CORE SYNTHESIS (Multiple Oscillators) ---
// Create a base frequency and slightly detuned oscillators for richness
const baseSynth = new Tone.PolySynth(Tone.Synth).toDestination();

// Detune oscillators for 'drone' effect
const detuneSynth1 = new Tone.Oscillator(240, "sine").start(); // Root
const detuneSynth2 = new Tone.Oscillator(240, "sine").start(); // Slightly detuned
detuneSynth2.frequency.value = 240 * 0.99;

// --- 2. MODULATION (LFOs) ---
// LFO 1: Controls pitch/detuning wobble (slow)
const lfoPitch = new Tone.LFO({
    frequency: "0.2",
    amplitude: 5, // Semitones of wobble
    min: -1,
    max: 1
}).start();

// LFO 2: Controls filter cutoff (slow sweep)
const lfoFilter = new Tone.LFO({
    frequency: "0.5",
    amplitude: 1000,
    min: 500,
    max: 3000
}).start();

// --- 3. EFFECTS CHAIN ---
// Reverb: Large hall setting for ambient space
const reverb = new Tone.Freeverb(5).toDestination();
reverb.wet.value = 0.7;

// Delay: Slapback or ping-pong for space
const delay = new Tone.PingPongDelay("8n", 0.5).toDestination();
delay.wet.value = 0.5;

// --- 4. SIGNAL ROUTING ---
// Connect the main synths to the effects chain
// Note: We must route the signal *through* the effects.
// We'll combine the output of the oscillators and send it to the reverb first.

detuneSynth1.connect(reverb);
detuneSynth2.connect(reverb);

// Connect the reverb output to the delay input
reverb.connect(delay);

// Connect the delay output to the final destination (speakers)
delay.toDestination();

// --- 5. MODULATION CONNECTIONS (Routing LFOs to parameters) ---
// 1. Route LFO Pitch to the frequency of the oscillators (via detuning)
detuneSynth1.frequency.connect(lfoPitch.output);
detuneSynth2.frequency.connect(lfoPitch.output);

// 2. Route LFO Filter to a hypothetical filter (or use a Tone.Filter node if needed, but let's modulate the reverb decay for simplicity)
// Instead, we'll modulate the delay feedback based on the second LFO
lfoFilter.connect(delay.feedback);

// --- 6. START THE DRONE ---
// Set initial starting frequencies and start the sound
detuneSynth1.frequency.value = 110; // A2
detuneSynth2.frequency.value = 110;

// Start the sound
detuneSynth1.triggerAttack(110);
detuneSynth2.triggerAttack(110);

// Schedule the sound to run indefinitely (or for a set duration)
Tone.Transport.bpm.value = 60;
Tone.Transport.start();

// Optional: Stop after 30 seconds for cleanup
Tone.Transport.scheduleOnce(() => {
    detuneSynth1.triggerRelease();
    detuneSynth2.triggerRelease();
    Tone.Transport.stop();
    console.log("Drone finished.");
}, 30);