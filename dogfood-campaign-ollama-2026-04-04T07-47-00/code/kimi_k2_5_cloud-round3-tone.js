// 1. Setup the core tone context
const synth = new Tone.PolySynth(Tone.Synth).toDestination();

// 2. Create the Ambient Effect Chain
const reverb = new Tone.Reverb({
    decay: 8,
    wet: 0.6
}).toDestination();

const delay = new Tone.PingPongDelay("2n", 0.5).connect(reverb);

// Connect the main synth output through the delay and then the reverb
synth.connect(delay);

// 3. Create the Modulating LFOs
// LFO 1: Slow frequency wobble (0.1 Hz)
const lfoFreq = new Tone.LFO("0.1", -5, 5).start();
// LFO 2: Slow amplitude modulation (0.15 Hz)
const lfoAmp = new Tone.LFO("0.15", -0.1, 0.1).start();

// 4. Create the Oscillators (The Drone Source)
// Use multiple oscillators for rich, detuned sound
const osc1 = new Tone.Oscillator({
    type: "sawtooth",
    frequency: "C2",
    detune: 0,
    volume: -10
}).connect(synth);

const osc2 = new Tone.Oscillator({
    type: "sine",
    frequency: "C2",
    detune: 50, // Slight detune for richness
    volume: -10
}).connect(synth);

const osc3 = new Tone.Oscillator({
    type: "sawtooth",
    frequency: "C2",
    detune: -50,
    volume: -10
}).connect(synth);

// 5. Connect LFOs to modulate frequency and amplitude
// Modulate frequency slightly using LFO 1
osc1.frequency.connect(lfoFreq.toDestination());
osc2.frequency.connect(lfoFreq.toDestination());
osc3.frequency.connect(lfoFreq.toDestination());

// Modulate amplitude using LFO 2 (requires a gain node or internal modulation if using PolySynth directly, but for simplicity, we'll modulate the synth volume)
// Since we are modulating the *synth* output, we'll use the LFO to modulate the main synth volume
const volumeMod = new Tone.Volume(-1).toDestination();
lfoAmp.connect(volumeMod);

// 6. Start the Droning Sequence
function startDrone() {
    // Start the oscillators
    osc1.start();
    osc2.start();
    osc3.start();

    // Start the LFOs
    lfoFreq.start();
    lfoAmp.start();

    // Start the main synth output (optional, but good practice if not using the osc nodes directly)
    Tone.Transport.start();
}

// Run the patch
startDrone();