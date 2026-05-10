export function audioBootstrapScript(): string {
  return `(function liminalAudioBootstrap() {
  window.__liminalAudio = window.__liminalAudio || {
    rms: 0,
    energy: 0,
    centroid: 0,
    brightness: 0,
    peak: 0,
    pitch: 0,
    note: '',
    onset: false,
    voiced: false,
    confidence: 0,
    capturedAt: 0,
    updatedAt: 0
  };
  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type !== 'liminal-audio-frame') return;
    const frame = data.frame || {};
    window.__liminalAudio = {
      rms: Number(frame.rms) || 0,
      energy: Number(frame.rms) || 0,
      centroid: Number(frame.centroid) || 0,
      brightness: Number(frame.centroid) || 0,
      peak: Number(frame.peak) || Number(frame.rms) || 0,
      pitch: Number(frame.pitch) || 0,
      note: String(frame.note || ''),
      onset: Boolean(frame.onset),
      voiced: Boolean(frame.voiced),
      confidence: Number(frame.confidence) || 0,
      capturedAt: Number(frame.capturedAt) || 0,
      updatedAt: performance.now()
    };
  });
})();`;
}
