import type { VoiceFeatureFrame } from '@liminal/audio-core/VoiceFeatureStream.js';
import type { PhraseFeedbackEvent } from '../teleprompter/phrases';

export interface SingSessionExport {
  audioBlob: Blob | null;
  telemetryBlob: Blob;
  startedAt: string;
  stoppedAt: string;
}

export class SessionRecorder {
  private recorder: MediaRecorder | null = null;
  private readonly chunks: Blob[] = [];
  private readonly telemetry: string[] = [];
  private startedAt = '';

  start(stream: MediaStream): void {
    this.chunks.length = 0;
    this.telemetry.length = 0;
    this.startedAt = new Date().toISOString();
    if (typeof MediaRecorder !== 'undefined') {
      this.recorder = new MediaRecorder(stream, { mimeType: preferredMimeType() });
      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      };
      this.recorder.start(250);
    }
  }

  appendTelemetry(frame: VoiceFeatureFrame): void {
    this.telemetry.push(JSON.stringify({
      t: frame.capturedAt,
      rms: frame.rms,
      pitchHz: frame.pitchHz,
      centroid: frame.centroid,
      spectralFlux: frame.spectralFlux,
      onset: frame.onset,
      voiced: frame.voiced,
      confidence: frame.confidence,
    }));
  }

  appendPhraseEvent(event: PhraseFeedbackEvent): void {
    this.telemetry.push(JSON.stringify({
      t: event.createdAt,
      type: event.type,
      phraseId: event.phraseId,
      text: event.text,
      reason: event.reason,
    }));
  }

  async stop(): Promise<SingSessionExport> {
    const stoppedAt = new Date().toISOString();
    const recorder = this.recorder;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
    }
    this.recorder = null;
    return {
      audioBlob: this.chunks.length > 0 ? new Blob(this.chunks, { type: preferredMimeType() }) : null,
      telemetryBlob: new Blob([this.telemetry.join('\n') + '\n'], { type: 'application/x-ndjson' }),
      startedAt: this.startedAt,
      stoppedAt,
    };
  }
}

function preferredMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  return 'audio/webm';
}
