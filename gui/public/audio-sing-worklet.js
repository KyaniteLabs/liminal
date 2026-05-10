/**
 * AudioWorklet processor for low-latency voice analysis.
 * Processes audio at the native sample rate and posts a complete
 * analysis frame to the main thread as soon as the buffer fills
 * (~42ms at 48kHz), with no artificial throttle.
 */
class AudioSingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 2048;
    this.buffer = new Float32Array(this.frameSize);
    this.writeIndex = 0;
    this.lastRms = 0;
    this.samplesSinceAnalyze = 0;
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.writeIndex] = channel[i];
      this.writeIndex = (this.writeIndex + 1) % this.frameSize;
      this.samplesSinceAnalyze++;
    }

    if (this.samplesSinceAnalyze >= this.frameSize) {
      this.samplesSinceAnalyze = 0;
      const frame = this.analyzeFrame();
      this.port.postMessage(frame);
    }

    return true;
  }

  analyzeFrame() {
    const n = this.frameSize;
    const buf = this.buffer;

    // RMS
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += buf[i] * buf[i];
    }
    const rms = Math.sqrt(sum / n);

    // Onset detection
    const onset = rms > 0.03 && rms - this.lastRms > 0.025;
    this.lastRms = rms;

    // Pitch detection via autocorrelation (YIN-like)
    const { pitch, confidence } = this.detectPitch();

    return {
      rms,
      onset,
      pitch,
      confidence,
      voiced: rms > 0.015 && confidence > 0.3 && pitch > 50,
    };
  }

  detectPitch() {
    const n = this.frameSize;
    const buf = this.buffer;

    // Difference function
    const diff = new Float32Array(n);
    for (let tau = 0; tau < n; tau++) {
      let d = 0;
      for (let i = 0; i < n - tau; i++) {
        const delta = buf[i] - buf[i + tau];
        d += delta * delta;
      }
      diff[tau] = d;
    }

    // Cumulative mean normalized difference
    const cmnd = new Float32Array(n);
    cmnd[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < n; tau++) {
      runningSum += diff[tau];
      cmnd[tau] = diff[tau] * tau / runningSum;
    }

    // Find first valley below threshold
    const threshold = 0.1;
    let tauEstimate = -1;
    for (let tau = 2; tau < n; tau++) {
      if (cmnd[tau] < threshold) {
        while (tau + 1 < n && cmnd[tau + 1] < cmnd[tau]) tau++;
        tauEstimate = tau;
        break;
      }
    }

    if (tauEstimate === -1) {
      let minVal = Infinity;
      for (let tau = 2; tau < n / 2; tau++) {
        if (cmnd[tau] < minVal) {
          minVal = cmnd[tau];
          tauEstimate = tau;
        }
      }
    }

    if (tauEstimate <= 0 || tauEstimate >= n / 2) {
      return { pitch: 0, confidence: 0 };
    }

    // Parabolic interpolation
    const x0 = tauEstimate - 1;
    const x2 = tauEstimate + 1;
    const y0 = cmnd[x0];
    const y1 = cmnd[tauEstimate];
    const y2 = cmnd[x2];
    const denom = 2 * (2 * y1 - y0 - y2);
    const shift = denom === 0 ? 0 : (y0 - y2) / denom;
    const tauOptimal = tauEstimate + shift;

    const pitch = sampleRate / tauOptimal;
    const confidence = 1 - Math.min(cmnd[tauEstimate], 1);
    return { pitch: pitch > 50 && pitch < 4000 ? pitch : 0, confidence };
  }
}

registerProcessor('audio-sing-processor', AudioSingProcessor);
