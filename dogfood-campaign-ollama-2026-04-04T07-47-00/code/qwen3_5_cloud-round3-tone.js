<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Tone.js Ambient Drone</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
    <style>
        body { display: flex; justify-content: center; align-items: center; height: 100vh; background: #111; color: #fff; font-family: sans-serif; }
        button { padding: 15px 30px; font-size: 16px; cursor: pointer; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; transition: background 0.3s; }
        button:hover { background: #555; }
        button:disabled { background: #222; color: #555; cursor: default; }
    </style>
</head>
<body>
    <button id="startBtn">Initialize Ambient Drone</button>
    <script>
        document.getElementById('startBtn').addEventListener('click', async () => {
            await Tone.start();
            const btn = document.getElementById('startBtn');
            btn.disabled = true;
            btn.innerText = "Drone Active";

            // Effects Chain
            const reverb = new Tone.Reverb({ decay: 4, wet: 0.6 });
            await reverb.generate();
            const delay = new Tone.FeedbackDelay("8n", 0.4);
            const chorus = new Tone.Chorus(4, 2.5, 0.5).start();
            const masterGain = new Tone.Gain(0.4);

            // Filter
            const filter = new Tone.Filter(300, "lowpass");
            const filterLFO = new Tone.LFO("0.1Hz", 200, 800).start();
            filterLFO.connect(filter.frequency);

            // Oscillators
            const osc1 = new Tone.Oscillator("C2", "sine");
            const osc2 = new Tone.Oscillator("C2", "triangle");
            const osc3 = new Tone.Oscillator("G1", "sine");

            // Detuning for richness
            osc1.detune.value = -15;
            osc2.detune.value = 15;
            osc3.detune.value = 0;

            // Pitch Modulation LFOs
            const pitchLFO1 =