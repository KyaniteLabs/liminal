#!/usr/bin/env tsx
/**
 * Launch-scope audio input proof runner.
 *
 * Proves the noninteractive-safe audio path:
 * synthetic audio samples -> AudioAnalyzer -> visual mapping -> prompt context,
 * plus the microphone guard for non-TTY automation.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { AudioAnalyzer } from '../../src/audio/AudioAnalyzer.js';
import { captureMicAudio } from '../../src/audio/MicCapture.js';
import { buildContextForInjection } from '../../src/core/ContextBuilder.js';

interface AudioInputProofReport {
  generatedAt: string;
  outputDir: string;
  sampleRate: number;
  sampleCount: number;
  syntheticInput: {
    kind: 'sine';
    frequencyHz: number;
    amplitude: number;
  };
  analysis: {
    rms: number;
    centroid: number;
    pitchHz: number | null;
    brightness: number;
  };
  visualMapping: unknown;
  contextIncludesAudio: boolean;
  micCaptureGuard: {
    exercised: boolean;
    expectedNonTtyFailure: boolean;
    message: string;
  };
  summary: {
    passed: boolean;
    liveMicrophoneCaptured: boolean;
    notes: string[];
  };
}

const outputRoot = process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length)
  || path.join('.omx', 'proof', 'audio-input');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(outputRoot, timestamp);
const sampleRate = 44_100;
const sampleCount = 4096;
const frequencyHz = 440;
const amplitude = 0.65;

function synthesizeSine(): Float32Array {
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < samples.length; i++) {
    const envelope = Math.min(1, i / 512) * Math.min(1, (samples.length - i) / 512);
    samples[i] = Math.sin(2 * Math.PI * frequencyHz * i / sampleRate) * amplitude * envelope;
  }
  return samples;
}

async function micGuardResult(): Promise<AudioInputProofReport['micCaptureGuard']> {
  try {
    await captureMicAudio();
    return {
      exercised: true,
      expectedNonTtyFailure: false,
      message: 'captureMicAudio unexpectedly completed in noninteractive proof runner',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exercised: true,
      expectedNonTtyFailure: /interactive terminal|TTY/i.test(message),
      message,
    };
  }
}

function markdown(report: AudioInputProofReport): string {
  return [
    '# Audio Input Proof Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Output dir: ${report.outputDir}`,
    '',
    `Summary: ${report.summary.passed ? 'pass' : 'fail'}`,
    '',
    '| Check | Result | Evidence |',
    '| --- | --- | --- |',
    `| Synthetic audio analyzed | pass | ${report.sampleCount} samples @ ${report.sampleRate}Hz, ${report.syntheticInput.frequencyHz}Hz sine |`,
    `| RMS > 0 | ${report.analysis.rms > 0 ? 'pass' : 'fail'} | rms=${report.analysis.rms.toFixed(4)} |`,
    `| Visual mapping produced | ${report.visualMapping ? 'pass' : 'fail'} | palette/motion/form/dynamics/composition present in JSON |`,
    `| Context injection | ${report.contextIncludesAudio ? 'pass' : 'fail'} | Audio-derived visual parameters found in ContextBuilder output |`,
    `| Mic non-TTY guard | ${report.micCaptureGuard.expectedNonTtyFailure ? 'pass' : 'fail'} | ${report.micCaptureGuard.message} |`,
    '',
    '## Notes',
    '',
    ...report.summary.notes.map(note => `- ${note}`),
  ].join('\n');
}

await fs.mkdir(outDir, { recursive: true });
const analyzer = new AudioAnalyzer();
const samples = synthesizeSine();
const analysis = analyzer.analyze(samples, sampleRate);
const visualMapping = analyzer.getVisualMapping(analysis);
const context = buildContextForInjection(1, { visualMappingParams: visualMapping } as any);
const micGuard = await micGuardResult();

const report: AudioInputProofReport = {
  generatedAt: new Date().toISOString(),
  outputDir: outDir,
  sampleRate,
  sampleCount,
  syntheticInput: { kind: 'sine', frequencyHz, amplitude },
  analysis: {
    rms: analysis.features.rms,
    centroid: analysis.features.spectralCentroid,
    pitchHz: analysis.pitch?.frequency ?? null,
    brightness: analysis.timbre.brightness,
  },
  visualMapping,
  contextIncludesAudio: context.includes('Audio-derived visual parameters'),
  micCaptureGuard: micGuard,
  summary: {
    passed: analysis.features.rms > 0 && Boolean(visualMapping) && context.includes('Audio-derived visual parameters') && micGuard.expectedNonTtyFailure,
    liveMicrophoneCaptured: false,
    notes: [
      'This proof validates the audio-input analysis/mapping/context path without requiring a real microphone.',
      'Live microphone capture remains an interactive/manual proof because captureMicAudio intentionally hard-fails in non-TTY automation.',
    ],
  },
};

await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
await fs.writeFile(path.join(outDir, 'report.md'), markdown(report), 'utf8');
console.log(path.join(outDir, 'report.md'));
process.exit(report.summary.passed ? 0 : 1);
